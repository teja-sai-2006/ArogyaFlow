import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from database import get_db
from models import (
    User, Hospital, HospitalStaffStatus, PatientRecord,
    ConsentToken, AppointmentAndTriage, PharmacyStock
)
from auth.rbac_guard import require_role
from services.websocket_manager import ws_manager
from services.sos_cascade import process_emergency_sos
from services.ai_multilingual import (
    summarize_report_ai, triage_symptoms_and_injury, analyze_medicine_strip
)

router = APIRouter(prefix="/api/patient", tags=["Patient"])

class AITriageRequest(BaseModel):
    symptoms: str
    target_language: str = "en"
    injury_image_url: Optional[str] = None

class SummarizeReportRequest(BaseModel):
    report_text: str
    target_language: str = "en"

class HospitalTableFilterRequest(BaseModel):
    state: str = "Andhra Pradesh"
    city: str = "Visakhapatnam"
    specialist: Optional[str] = None
    required_equipment: Optional[str] = None

class AIBookingRequest(BaseModel):
    hospital_id: str
    doctor_id: Optional[str] = None
    symptoms: str
    severity_level: str = "LOW"
    share_all_reports: bool = True

class EmergencySOSRequest(BaseModel):
    gps_lat: float = 17.7200
    gps_lng: float = 83.3000
    symptoms: Optional[str] = "Critical Road Traffic Accident"

class MedicineAnalyzerRequest(BaseModel):
    ocr_text: str

class RequestGenericSubstituteRequest(BaseModel):
    booking_id: str
    brand_name: str
    generic_salt: str

@router.post("/ai-triage")
async def run_ai_triage(
    req: AITriageRequest,
    patient: User = Depends(require_role(["PATIENT"]))
):
    result = await triage_symptoms_and_injury(
        symptoms_text=req.symptoms,
        injury_image_url=req.injury_image_url,
        target_lang=req.target_language
    )
    return result

@router.post("/summarize-report")
async def summarize_report(
    req: SummarizeReportRequest,
    patient: User = Depends(require_role(["PATIENT"]))
):
    result = await summarize_report_ai(
        report_text=req.report_text,
        target_lang=req.target_language
    )
    return result

@router.post("/hospitals-table")
def get_hospitals_table(
    req: HospitalTableFilterRequest,
    db: Session = Depends(get_db),
    patient: User = Depends(require_role(["PATIENT"]))
):
    """
    Hospital Discovery "Table" Filter:
    Filters hospitals by city, equipment, and shows live available doctors.
    CRITICAL: Excludes doctors where is_present_today == False!
    """
    hospitals = db.query(Hospital).filter(Hospital.city == req.city).all()

    filtered_hospitals = []
    for h in hospitals:
        # Check equipment filter
        if req.required_equipment and req.required_equipment not in (h.equipment_list or []):
            continue

        # Get Present Doctors for this hospital
        staff_query = db.query(HospitalStaffStatus).filter(
            HospitalStaffStatus.hospital_id == h.id,
            HospitalStaffStatus.role == "DOCTOR",
            HospitalStaffStatus.is_present_today == True  # ABSENT DOCTORS HIDDEN
        )
        if req.specialist:
            staff_query = staff_query.filter(HospitalStaffStatus.specialty == req.specialist)

        present_staff = staff_query.all()
        present_doctors_list = []
        for s in present_staff:
            u = db.query(User).filter(User.id == s.staff_id).first()
            present_doctors_list.append({
                "doctor_id": s.staff_id,
                "name": u.name if u else "Doctor",
                "specialty": s.specialty,
                "is_present": True
            })

        # Include hospital if no specialist filter OR if matching present doctors found
        if not req.specialist or present_doctors_list:
            filtered_hospitals.append({
                "hospital_id": h.id,
                "name": h.name,
                "type": h.type,
                "city": h.city,
                "icu_beds": h.icu_beds_available,
                "general_beds": h.general_beds_available,
                "equipment": h.equipment_list or [],
                "present_doctors": present_doctors_list,
                "is_safe_zone": h.is_safe_zone
            })

    return filtered_hospitals

@router.post("/book-appointment")
async def book_appointment(
    req: AIBookingRequest,
    db: Session = Depends(get_db),
    patient: User = Depends(require_role(["PATIENT"]))
):
    """
    Feature 3.2: AI Call / Manual Booking & UHID Consent Token Handoff
    Generates ConsentToken and PENDING_MGMT appointment.
    Alerts Hospital Management via WebSocket.
    """
    # 1. Generate UHID Consent Token if patient agreed to share reports
    consent_token_id = None
    if req.share_all_reports:
        consent_token_id = f"TOKEN-{uuid.uuid4().hex[:8].upper()}"
        token = ConsentToken(
            id=consent_token_id,
            patient_uhid=patient.uhid,
            granted_to_hospital_id=req.hospital_id,
            status="ACTIVE",
            created_at=datetime.datetime.utcnow(),
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=3)
        )
        db.add(token)

    # 2. Create Appointment
    booking_id = f"APT-{uuid.uuid4().hex[:8].upper()}"
    booking = AppointmentAndTriage(
        id=booking_id,
        patient_uhid=patient.uhid,
        hospital_id=req.hospital_id,
        doctor_id=req.doctor_id,
        booking_type="AI_CALL",
        severity_level=req.severity_level,
        symptoms=req.symptoms,
        status="PENDING_MGMT",
        appointment_date=datetime.date.today().isoformat(),
        created_at=datetime.datetime.utcnow()
    )
    db.add(booking)
    db.commit()

    # 3. Fire real-time alert to Hospital Management
    booking_payload = {
        "booking_id": booking_id,
        "patient_uhid": patient.uhid,
        "patient_name": patient.name,
        "patient_phone": patient.phone,
        "hospital_id": req.hospital_id,
        "doctor_id": req.doctor_id,
        "symptoms": req.symptoms,
        "severity_level": req.severity_level,
        "consent_token": consent_token_id,
        "booking_type": "AI_CALL",
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    await ws_manager.broadcast_org(req.hospital_id, "NEW_APPOINTMENT_REQUEST", booking_payload)

    return {
        "status": "booking_requested",
        "booking_id": booking_id,
        "consent_token": consent_token_id,
        "message": "AI automated booking sent to Hospital Management. Callback verification initiated."
    }

@router.post("/emergency-sos")
async def trigger_sos(
    req: EmergencySOSRequest,
    db: Session = Depends(get_db),
    patient: User = Depends(require_role(["PATIENT"]))
):
    """
    Feature 5: One-Tap Emergency SOS Pre-Arrival Chain Reaction
    """
    sos_result = await process_emergency_sos(
        db=db,
        patient_uhid=patient.uhid,
        gps_lat=req.gps_lat,
        gps_lng=req.gps_lng,
        symptoms=req.symptoms
    )
    return sos_result

@router.post("/analyze-medicine")
def analyze_medicine(
    req: MedicineAnalyzerRequest,
    db: Session = Depends(get_db),
    patient: User = Depends(require_role(["PATIENT"]))
):
    """
    Feature 7.1: Dual-Tier Medicine Analyzer (Nameless / Cut Strip Fallback)
    """
    # Fetch patient's past prescriptions
    records = db.query(PatientRecord).filter(
        PatientRecord.patient_uhid == patient.uhid,
        PatientRecord.report_type == "PRESCRIPTION"
    ).all()

    past_prescriptions = []
    for r in records:
        if r.prescribed_medicines_json:
            past_prescriptions.extend(r.prescribed_medicines_json)

    analysis = analyze_medicine_strip(
        ocr_text_fragment=req.ocr_text,
        patient_past_prescriptions=past_prescriptions
    )
    return analysis

@router.get("/refill-tracker")
def get_refill_tracker(
    db: Session = Depends(get_db),
    patient: User = Depends(require_role(["PATIENT"]))
):
    """
    Feature 7.2: 'When to take medicines' Refill Tracker
    """
    records = db.query(PatientRecord).filter(
        PatientRecord.patient_uhid == patient.uhid,
        PatientRecord.report_type == "PRESCRIPTION"
    ).order_by(PatientRecord.created_at.desc()).all()

    active_items = []
    for r in records:
        items = r.prescribed_medicines_json or []
        for it in items:
            active_items.append({
                "record_id": r.id,
                "title": r.title,
                "brand_name": it.get("brand_name"),
                "generic_salt": it.get("generic_salt"),
                "dosage": it.get("dosage"),
                "duration_days": it.get("duration_days"),
                "remaining_days": it.get("remaining_days"),
                "date_prescribed": r.created_at.strftime("%Y-%m-%d")
            })

    # Next follow-up appointment if any
    next_appt = db.query(AppointmentAndTriage).filter(
        AppointmentAndTriage.patient_uhid == patient.uhid,
        AppointmentAndTriage.status.in_(["PENDING_MGMT", "CONFIRMED"])
    ).order_by(AppointmentAndTriage.appointment_date.asc()).first()

    return {
        "active_prescriptions": active_items,
        "next_appointment": {
            "booking_id": next_appt.id,
            "date": next_appt.appointment_date,
            "status": next_appt.status,
            "symptoms": next_appt.symptoms
        } if next_appt else None
    }

@router.post("/request-generic")
async def request_generic(
    req: RequestGenericSubstituteRequest,
    db: Session = Depends(get_db),
    patient: User = Depends(require_role(["PATIENT"]))
):
    appt = db.query(AppointmentAndTriage).filter(AppointmentAndTriage.id == req.booking_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    appt.generic_request_status = "PENDING_DOCTOR"
    appt.generic_request_notes = f"Patient requested generic replacement for {req.brand_name} ({req.generic_salt})"
    db.commit()

    # Broadcast to doctor if assigned
    if appt.doctor_id:
        req_payload = {
            "booking_id": appt.id,
            "patient_uhid": patient.uhid,
            "patient_name": patient.name,
            "brand_name": req.brand_name,
            "generic_salt": req.generic_salt
        }
        await ws_manager.broadcast_org(appt.hospital_id, "GENERIC_REPLACEMENT_REQUESTED", req_payload)

    return {
        "status": "pending_doctor_approval",
        "booking_id": req.booking_id,
        "message": "Generic substitution request forwarded to your attending physician."
    }

@router.get("/generic-comparison/{generic_salt}")
def get_generic_vendor_comparison(
    generic_salt: str,
    db: Session = Depends(get_db),
    patient: User = Depends(require_role(["PATIENT"]))
):
    """
    Feature 6.2: Multi-Pharmacy Price & Stock Comparison Table
    """
    # Clean and match against generic salt
    search_term = f"%{generic_salt.strip()}%"
    stock_items = db.query(PharmacyStock).filter(
        PharmacyStock.generic_salt_name.ilike(search_term)
    ).all()

    if not stock_items:
        # Fallback to broader match
        stock_items = db.query(PharmacyStock).all()

    vendors = []
    for item in stock_items:
        vendors.append({
            "stock_id": item.id,
            "pharmacy_id": item.pharmacy_id,
            "store_name": item.store_name,
            "medicine_brand": item.medicine_brand,
            "generic_salt": item.generic_salt_name,
            "price": item.price,
            "stock_qty": item.stock_qty,
            "expiry_date": item.expiry_date,
            "closing_time": item.closing_time,
            "city": item.city
        })

    # Sort vendors by price ascending (cheapest first)
    vendors.sort(key=lambda x: x["price"])

    return {
        "requested_salt": generic_salt,
        "total_vendors_found": len(vendors),
        "comparison_table": vendors
    }

@router.get("/vault")
def get_patient_vault(
    db: Session = Depends(get_db),
    patient: User = Depends(require_role(["PATIENT"]))
):
    records = db.query(PatientRecord).filter(
        PatientRecord.patient_uhid == patient.uhid
    ).order_by(PatientRecord.created_at.desc()).all()

    return {
        "uhid": patient.uhid,
        "patient_name": patient.name,
        "records": [
            {
                "id": r.id,
                "title": r.title,
                "report_type": r.report_type,
                "clinical_notes": r.clinical_notes,
                "ai_summary": r.ai_summary_text,
                "file_url": r.file_url,
                "prescriptions": r.prescribed_medicines_json,
                "created_at": r.created_at.isoformat()
            } for r in records
        ]
    }

@router.get("/medicine-finder")
def search_medicine_availability(
    query: Optional[str] = None,
    city: Optional[str] = "All",
    in_stock_only: bool = False,
    db: Session = Depends(get_db),
    patient: User = Depends(require_role(["PATIENT"]))
):
    """
    Medicine Availability, Price & Stock Finder by City:
    Allows patients to check availability, exact prices, expiry dates,
    stock units, and store closing hours across pharmacies in any city.
    """
    stock_query = db.query(PharmacyStock)

    # City filter
    if city and city != "All":
        stock_query = stock_query.filter(PharmacyStock.city.ilike(f"%{city}%"))

    # Search term filter across brand or generic salt
    if query and query.strip():
        term = f"%{query.strip()}%"
        stock_query = stock_query.filter(
            (PharmacyStock.medicine_brand.ilike(term)) |
            (PharmacyStock.generic_salt_name.ilike(term))
        )

    # In stock filter
    if in_stock_only:
        stock_query = stock_query.filter(PharmacyStock.stock_qty > 0)

    # Sort by price ascending
    items = stock_query.order_by(PharmacyStock.price.asc()).all()

    # Get distinct cities from all pharmacies
    all_cities = [c[0] for c in db.query(PharmacyStock.city).distinct().all() if c[0]]

    results = []
    for it in items:
        status = "IN_STOCK"
        if it.stock_qty == 0:
            status = "OUT_OF_STOCK"
        elif it.stock_qty <= 10:
            status = "LOW_STOCK"

        results.append({
            "stock_id": it.id,
            "pharmacy_id": it.pharmacy_id,
            "store_name": it.store_name,
            "city": it.city,
            "medicine_brand": it.medicine_brand,
            "generic_salt_name": it.generic_salt_name,
            "price": it.price,
            "stock_qty": it.stock_qty,
            "status": status,
            "expiry_date": it.expiry_date,
            "closing_time": it.closing_time,
            "gps": {"lat": it.gps_lat, "lng": it.gps_lng}
        })

    return {
        "query": query or "",
        "selected_city": city,
        "available_cities": ["All"] + sorted(all_cities),
        "total_results": len(results),
        "medicines": results
    }

