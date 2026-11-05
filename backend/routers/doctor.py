import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from database import get_db
from models import User, AppointmentAndTriage, PatientRecord
from auth.rbac_guard import require_role
from services.websocket_manager import ws_manager

router = APIRouter(prefix="/api/doctor", tags=["Doctor"])

class PrescriptionItem(BaseModel):
    brand_name: str
    generic_salt: str
    dosage: str
    duration_days: int
    remaining_days: int

class CreatePrescriptionRequest(BaseModel):
    booking_id: str
    patient_uhid: str
    clinical_notes: str
    prescriptions: List[PrescriptionItem]

class OrderLabTestRequest(BaseModel):
    booking_id: str
    patient_uhid: str
    test_type: str # X-Ray, CT Scan, Blood Panel, ECG
    clinical_instructions: str

class GenericApprovalRequest(BaseModel):
    booking_id: str
    approved: bool
    notes: Optional[str] = "Generic substitution approved by attending physician."

@router.get("/appointments")
def get_doctor_appointments(
    db: Session = Depends(get_db),
    doctor: User = Depends(require_role(["DOCTOR"]))
):
    appts = db.query(AppointmentAndTriage).filter(
        AppointmentAndTriage.doctor_id == doctor.id,
        AppointmentAndTriage.hospital_id == doctor.org_id
    ).order_by(AppointmentAndTriage.created_at.desc()).all()

    result = []
    for a in appts:
        p = db.query(User).filter(User.uhid == a.patient_uhid).first()
        result.append({
            "booking_id": a.id,
            "patient_uhid": a.patient_uhid,
            "patient_name": p.name if p else "Patient",
            "patient_phone": p.phone if p else "",
            "patient_blood": p.blood_group if p else "Unknown",
            "symptoms": a.symptoms,
            "severity_level": a.severity_level,
            "status": a.status,
            "generic_request_status": a.generic_request_status,
            "generic_request_notes": a.generic_request_notes,
            "appointment_date": a.appointment_date,
            "created_at": a.created_at.isoformat()
        })
    return result

@router.get("/patient-records/{patient_uhid}")
def get_patient_history(
    patient_uhid: str,
    db: Session = Depends(get_db),
    doctor: User = Depends(require_role(["DOCTOR"]))
):
    p = db.query(User).filter(User.uhid == patient_uhid).first()
    records = db.query(PatientRecord).filter(
        PatientRecord.patient_uhid == patient_uhid
    ).order_by(PatientRecord.created_at.desc()).all()

    return {
        "patient": {
            "uhid": patient_uhid,
            "name": p.name if p else "Patient",
            "blood_group": p.blood_group if p else "Unknown",
            "allergies": p.allergies if p else "None noted"
        },
        "records": [
            {
                "id": r.id,
                "title": r.title,
                "report_type": r.report_type,
                "clinical_notes": r.clinical_notes,
                "ai_summary": r.ai_summary_text,
                "file_url": r.file_url,
                "prescribed_medicines": r.prescribed_medicines_json,
                "created_at": r.created_at.isoformat()
            } for r in records
        ]
    }

@router.post("/prescription")
async def save_prescription(
    req: CreatePrescriptionRequest,
    db: Session = Depends(get_db),
    doctor: User = Depends(require_role(["DOCTOR"]))
):
    record_id = f"RX-{uuid.uuid4().hex[:6].upper()}"
    new_record = PatientRecord(
        id=record_id,
        patient_uhid=req.patient_uhid,
        uploaded_by_role="DOCTOR",
        doctor_id=doctor.id,
        hospital_id=doctor.org_id,
        report_type="PRESCRIPTION",
        title=f"Clinical Consultation & Prescription by Dr. {doctor.name}",
        clinical_notes=req.clinical_notes,
        ai_summary_text=f"Prescription finalized. Active medications: {', '.join(p.brand_name for p in req.prescriptions)}",
        prescribed_medicines_json=[p.dict() for p in req.prescriptions],
        created_at=datetime.datetime.utcnow()
    )
    db.add(new_record)

    # Mark appointment completed
    appt = db.query(AppointmentAndTriage).filter(AppointmentAndTriage.id == req.booking_id).first()
    if appt:
        appt.status = "COMPLETED"

    db.commit()

    # Broadcast event to patient portal so Refill Tracker and Vault update in real time
    await ws_manager.broadcast_uhid(req.patient_uhid, "NEW_PRESCRIPTION_AVAILABLE", {
        "record_id": record_id,
        "doctor_name": doctor.name,
        "prescriptions": [p.dict() for p in req.prescriptions],
        "created_at": new_record.created_at.isoformat()
    })

    return {"status": "prescription_saved", "record_id": record_id}

@router.post("/order-lab-test")
async def order_lab_test(
    req: OrderLabTestRequest,
    db: Session = Depends(get_db),
    doctor: User = Depends(require_role(["DOCTOR"]))
):
    order_id = f"LABREQ-{uuid.uuid4().hex[:6].upper()}"
    # Create lab request record
    lab_record = PatientRecord(
        id=order_id,
        patient_uhid=req.patient_uhid,
        uploaded_by_role="DOCTOR",
        doctor_id=doctor.id,
        hospital_id=doctor.org_id,
        report_type="LAB_SCAN",
        title=f"PENDING ORDER: {req.test_type}",
        clinical_notes=f"Instructions: {req.clinical_instructions} | Ordered by Dr. {doctor.name}",
        ai_summary_text="Diagnostic scan requested. Awaiting Lab Technician upload.",
        file_url=None,
        created_at=datetime.datetime.utcnow()
    )
    db.add(lab_record)
    db.commit()

    # Broadcast to Lab Technicians of this hospital
    lab_payload = {
        "order_id": order_id,
        "patient_uhid": req.patient_uhid,
        "test_type": req.test_type,
        "instructions": req.clinical_instructions,
        "doctor_name": doctor.name,
        "booking_id": req.booking_id
    }
    await ws_manager.broadcast_org(doctor.org_id, "NEW_LAB_TEST_ORDERED", lab_payload)

    return {"status": "lab_order_dispatched", "order_id": order_id}

@router.post("/approve-generic")
async def handle_generic_approval(
    req: GenericApprovalRequest,
    db: Session = Depends(get_db),
    doctor: User = Depends(require_role(["DOCTOR"]))
):
    """
    Integration Fix C:
    Doctor reviews patient generic replacement request.
    Upon approval, updates appointment state and triggers notification to Patient.
    """
    appt = db.query(AppointmentAndTriage).filter(AppointmentAndTriage.id == req.booking_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    appt.generic_request_status = "APPROVED" if req.approved else "REJECTED"
    appt.generic_request_notes = req.notes
    db.commit()

    # Broadcast to patient
    approval_event = {
        "booking_id": appt.id,
        "status": appt.generic_request_status,
        "doctor_name": doctor.name,
        "notes": req.notes
    }
    await ws_manager.broadcast_uhid(appt.patient_uhid, "GENERIC_REQUEST_DECISION", approval_event)

    return {
        "status": "decision_saved",
        "generic_request_status": appt.generic_request_status,
        "doctor": doctor.name
    }
