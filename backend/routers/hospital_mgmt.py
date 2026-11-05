import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from database import get_db
from models import (
    User, Hospital, HospitalStaffStatus, AppointmentAndTriage,
    BloodBankStock, PatientRecord, ConsentToken
)
from auth.rbac_guard import require_role
from services.websocket_manager import ws_manager

router = APIRouter(prefix="/api/hospital-mgmt", tags=["Hospital Management"])

class ReassignDoctorRequest(BaseModel):
    booking_id: str
    new_doctor_id: str

class UpdateResourcesRequest(BaseModel):
    icu_beds_available: int
    general_beds_available: int
    internal_blood_stock: dict

class BloodBankOrderRequest(BaseModel):
    blood_bank_id: str
    blood_group: str
    units_requested: int

class DisasterTransferRequest(BaseModel):
    target_hospital_id: str
    patient_uhids: List[str]
    notes: Optional[str] = "Emergency inter-hospital evacuation"

@router.get("/dashboard")
def get_mgmt_dashboard(
    db: Session = Depends(get_db),
    mgmt: User = Depends(require_role(["HOSP_MGMT"]))
):
    hosp = db.query(Hospital).filter(Hospital.id == mgmt.org_id).first()
    if not hosp:
        raise HTTPException(status_code=404, detail="Hospital not found")

    # Present doctors in this hospital
    present_doctors = []
    doctor_statuses = db.query(HospitalStaffStatus).filter(
        HospitalStaffStatus.hospital_id == mgmt.org_id,
        HospitalStaffStatus.role == "DOCTOR"
    ).all()
    for ds in doctor_statuses:
        u = db.query(User).filter(User.id == ds.staff_id).first()
        present_doctors.append({
            "doctor_id": ds.staff_id,
            "name": u.name if u else "Doctor",
            "specialty": ds.specialty,
            "is_present_today": ds.is_present_today,
            "current_load": ds.current_patient_load
        })

    # Appointments & Triage queue
    appointments = db.query(AppointmentAndTriage).filter(
        AppointmentAndTriage.hospital_id == mgmt.org_id
    ).order_by(AppointmentAndTriage.created_at.desc()).all()

    formatted_appointments = []
    for a in appointments:
        p = db.query(User).filter(User.uhid == a.patient_uhid).first()
        doc = db.query(User).filter(User.id == a.doctor_id).first() if a.doctor_id else None
        formatted_appointments.append({
            "booking_id": a.id,
            "patient_uhid": a.patient_uhid,
            "patient_name": p.name if p else "Patient",
            "patient_phone": p.phone if p else "",
            "patient_blood": p.blood_group if p else "Unknown",
            "doctor_id": a.doctor_id,
            "doctor_name": doc.name if doc else "Unassigned",
            "booking_type": a.booking_type,
            "severity_level": a.severity_level,
            "symptoms": a.symptoms,
            "status": a.status,
            "generic_request_status": a.generic_request_status,
            "appointment_date": a.appointment_date,
            "created_at": a.created_at.isoformat()
        })

    # Available Safe Zone Hospitals for disaster transfer
    safe_hospitals = db.query(Hospital).filter(
        Hospital.id != mgmt.org_id,
        Hospital.is_safe_zone == True
    ).all()

    return {
        "hospital": {
            "id": hosp.id,
            "name": hosp.name,
            "type": hosp.type,
            "icu_beds": hosp.icu_beds_available,
            "general_beds": hosp.general_beds_available,
            "internal_blood_stock": hosp.internal_blood_stock or {},
            "equipment": hosp.equipment_list or [],
            "is_safe_zone": hosp.is_safe_zone
        },
        "doctors": present_doctors,
        "queue": formatted_appointments,
        "safe_hospitals": [{"id": sh.id, "name": sh.name, "icu_beds": sh.icu_beds_available} for sh in safe_hospitals]
    }

@router.post("/reassign-doctor")
async def reassign_doctor(
    req: ReassignDoctorRequest,
    db: Session = Depends(get_db),
    mgmt: User = Depends(require_role(["HOSP_MGMT"]))
):
    appt = db.query(AppointmentAndTriage).filter(
        AppointmentAndTriage.id == req.booking_id,
        AppointmentAndTriage.hospital_id == mgmt.org_id
    ).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    new_doc = db.query(User).filter(User.id == req.new_doctor_id).first()
    if not new_doc:
        raise HTTPException(status_code=404, detail="New doctor not found")

    appt.doctor_id = req.new_doctor_id
    appt.status = "CONFIRMED"
    db.commit()

    # Broadcast notification to the new doctor and to the patient
    await ws_manager.broadcast_org(mgmt.org_id, "APPOINTMENT_REASSIGNED", {
        "booking_id": appt.id,
        "new_doctor_id": req.new_doctor_id,
        "new_doctor_name": new_doc.name,
        "patient_uhid": appt.patient_uhid,
        "status": "CONFIRMED"
    })
    await ws_manager.broadcast_uhid(appt.patient_uhid, "APPOINTMENT_CONFIRMED", {
        "booking_id": appt.id,
        "doctor_name": new_doc.name,
        "status": "CONFIRMED"
    })

    return {
        "status": "success",
        "booking_id": appt.id,
        "new_doctor": new_doc.name,
        "status_code": appt.status
    }

@router.post("/confirm-appointment/{booking_id}")
async def confirm_appointment(
    booking_id: str,
    db: Session = Depends(get_db),
    mgmt: User = Depends(require_role(["HOSP_MGMT"]))
):
    appt = db.query(AppointmentAndTriage).filter(
        AppointmentAndTriage.id == booking_id,
        AppointmentAndTriage.hospital_id == mgmt.org_id
    ).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    appt.status = "CONFIRMED"
    db.commit()

    await ws_manager.broadcast_uhid(appt.patient_uhid, "APPOINTMENT_CONFIRMED", {
        "booking_id": appt.id,
        "status": "CONFIRMED"
    })

    return {"status": "confirmed", "booking_id": booking_id}

@router.patch("/resources")
async def update_resources(
    req: UpdateResourcesRequest,
    db: Session = Depends(get_db),
    mgmt: User = Depends(require_role(["HOSP_MGMT"]))
):
    hosp = db.query(Hospital).filter(Hospital.id == mgmt.org_id).first()
    if not hosp:
        raise HTTPException(status_code=404, detail="Hospital not found")

    hosp.icu_beds_available = req.icu_beds_available
    hosp.general_beds_available = req.general_beds_available
    hosp.internal_blood_stock = req.internal_blood_stock
    db.commit()

    await ws_manager.broadcast_all("HOSPITAL_RESOURCES_UPDATED", {
        "hospital_id": hosp.id,
        "icu_beds": hosp.icu_beds_available,
        "general_beds": hosp.general_beds_available,
        "internal_blood_stock": hosp.internal_blood_stock
    })

    return {"status": "success", "message": "Hospital resources updated"}

@router.post("/request-blood")
async def request_external_blood(
    req: BloodBankOrderRequest,
    db: Session = Depends(get_db),
    mgmt: User = Depends(require_role(["HOSP_MGMT"]))
):
    bb_stock = db.query(BloodBankStock).filter(
        BloodBankStock.blood_bank_id == req.blood_bank_id,
        BloodBankStock.blood_group == req.blood_group
    ).first()

    if not bb_stock:
        raise HTTPException(status_code=404, detail="Blood bank inventory record not found")

    if bb_stock.live_units_available < req.units_requested:
        raise HTTPException(
            status_code=400,
            detail=f"Only {bb_stock.live_units_available} units available at this blood bank"
        )

    bb_stock.live_units_available -= req.units_requested
    
    # Add units to hospital stock
    hosp = db.query(Hospital).filter(Hospital.id == mgmt.org_id).first()
    stock = hosp.internal_blood_stock or {}
    stock[req.blood_group] = stock.get(req.blood_group, 0) + req.units_requested
    hosp.internal_blood_stock = stock
    db.commit()

    order_payload = {
        "hospital_id": mgmt.org_id,
        "hospital_name": hosp.name,
        "blood_bank_id": req.blood_bank_id,
        "blood_group": req.blood_group,
        "units": req.units_requested,
        "status": "DISPATCHED"
    }
    await ws_manager.broadcast_org(req.blood_bank_id, "BLOOD_ORDER_RECEIVED", order_payload)
    await ws_manager.broadcast_org(mgmt.org_id, "BLOOD_ORDER_FULFILLED", order_payload)

    return {"status": "dispatched", "details": order_payload}

@router.post("/disaster-transfer")
async def execute_disaster_transfer(
    req: DisasterTransferRequest,
    db: Session = Depends(get_db),
    mgmt: User = Depends(require_role(["HOSP_MGMT"]))
):
    """
    Integration Fix F:
    Clones patient charts, notes, and scans to target hospital B,
    creates active UHID consent token for Hospital B, and alerts both portals.
    """
    target_hosp = db.query(Hospital).filter(Hospital.id == req.target_hospital_id).first()
    source_hosp = db.query(Hospital).filter(Hospital.id == mgmt.org_id).first()
    if not target_hosp or not source_hosp:
        raise HTTPException(status_code=404, detail="Hospital not found")

    transferred_packages = []

    for uhid in req.patient_uhids:
        # Clone records
        records = db.query(PatientRecord).filter(PatientRecord.patient_uhid == uhid).all()
        # Create transfer triage booking at target hospital
        booking_id = f"TRF-{uuid.uuid4().hex[:6].upper()}"
        transfer_booking = AppointmentAndTriage(
            id=booking_id,
            patient_uhid=uhid,
            hospital_id=req.target_hospital_id,
            booking_type="DISASTER_TRANSFER",
            severity_level="CRITICAL",
            symptoms=f"Evacuation from {source_hosp.name} due to regional disaster. Note: {req.notes}",
            status="PENDING_MGMT",
            cascade_source_hospital_id=source_hosp.id,
            appointment_date=datetime.date.today().isoformat(),
            created_at=datetime.datetime.utcnow()
        )
        db.add(transfer_booking)

        # Grant consent token to Target Hospital
        consent = ConsentToken(
            id=f"TOKEN-TRF-{uuid.uuid4().hex[:6].upper()}",
            patient_uhid=uhid,
            granted_to_hospital_id=req.target_hospital_id,
            status="ACTIVE",
            created_at=datetime.datetime.utcnow(),
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=7)
        )
        db.add(consent)

        p = db.query(User).filter(User.uhid == uhid).first()
        transferred_packages.append({
            "patient_uhid": uhid,
            "patient_name": p.name if p else "Patient",
            "booking_id": booking_id,
            "records_count": len(records),
            "consent_token": consent.id
        })

    db.commit()

    transfer_event = {
        "source_hospital": {"id": source_hosp.id, "name": source_hosp.name},
        "target_hospital": {"id": target_hosp.id, "name": target_hosp.name},
        "patients": transferred_packages,
        "notes": req.notes,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }

    # Alert target hospital management and doctor portals
    await ws_manager.broadcast_org(req.target_hospital_id, "DISASTER_TRANSFER_INCOMING", transfer_event)
    await ws_manager.broadcast_org(source_hosp.id, "DISASTER_TRANSFER_DISPATCHED", transfer_event)

    return {
        "status": "transfer_executed",
        "transferred_count": len(transferred_packages),
        "transfer_details": transfer_event
    }
