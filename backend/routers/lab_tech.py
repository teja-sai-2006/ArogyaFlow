import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from database import get_db
from models import User, PatientRecord, AppointmentAndTriage
from auth.rbac_guard import require_role
from services.websocket_manager import ws_manager
from services.ai_multilingual import summarize_report_ai

router = APIRouter(prefix="/api/lab-tech", tags=["Lab Technician"])

class UploadScanRequest(BaseModel):
    patient_uhid: str
    test_title: str
    file_url: str
    technician_notes: str
    order_id: Optional[str] = None

@router.get("/worklist")
def get_lab_worklist(
    db: Session = Depends(get_db),
    tech: User = Depends(require_role(["LAB_TECH"]))
):
    pending_orders = db.query(PatientRecord).filter(
        PatientRecord.hospital_id == tech.org_id,
        PatientRecord.report_type == "LAB_SCAN",
        PatientRecord.file_url == None
    ).order_by(PatientRecord.created_at.desc()).all()

    completed_orders = db.query(PatientRecord).filter(
        PatientRecord.hospital_id == tech.org_id,
        PatientRecord.report_type == "LAB_SCAN",
        PatientRecord.file_url != None
    ).order_by(PatientRecord.created_at.desc()).limit(15).all()

    def format_item(r):
        p = db.query(User).filter(User.uhid == r.patient_uhid).first()
        doc = db.query(User).filter(User.id == r.doctor_id).first() if r.doctor_id else None
        return {
            "id": r.id,
            "patient_uhid": r.patient_uhid,
            "patient_name": p.name if p else "Patient",
            "doctor_name": doc.name if doc else "Attending Doctor",
            "title": r.title,
            "clinical_notes": r.clinical_notes,
            "ai_summary": r.ai_summary_text,
            "file_url": r.file_url,
            "created_at": r.created_at.isoformat()
        }

    return {
        "pending": [format_item(r) for r in pending_orders],
        "completed": [format_item(r) for r in completed_orders]
    }

@router.post("/upload-report")
async def upload_diagnostic_report(
    req: UploadScanRequest,
    db: Session = Depends(get_db),
    tech: User = Depends(require_role(["LAB_TECH"]))
):
    """
    Feature 6.1:
    Lab Tech uploads scan file.
    System generates AI summary and automatically syncs to Doctor and Patient Vaults!
    """
    # Generate AI summary for patient
    ai_summary = await summarize_report_ai(req.technician_notes, target_lang="en")

    record_id = req.order_id if req.order_id else f"LAB-{uuid.uuid4().hex[:6].upper()}"
    existing_rec = db.query(PatientRecord).filter(PatientRecord.id == record_id).first() if req.order_id else None

    if existing_rec:
        existing_rec.title = req.test_title
        existing_rec.file_url = req.file_url
        existing_rec.clinical_notes = req.technician_notes
        existing_rec.ai_summary_text = ai_summary.get("summary")
        final_record = existing_rec
    else:
        final_record = PatientRecord(
            id=record_id,
            patient_uhid=req.patient_uhid,
            uploaded_by_role="LAB_TECH",
            hospital_id=tech.org_id,
            report_type="LAB_SCAN",
            title=req.test_title,
            file_url=req.file_url,
            clinical_notes=req.technician_notes,
            ai_summary_text=ai_summary.get("summary"),
            created_at=datetime.datetime.utcnow()
        )
        db.add(final_record)

    db.commit()

    sync_payload = {
        "record_id": final_record.id,
        "patient_uhid": req.patient_uhid,
        "title": final_record.title,
        "file_url": final_record.file_url,
        "notes": final_record.clinical_notes,
        "ai_summary": final_record.ai_summary_text,
        "uploaded_by": f"Lab Technician ({tech.name})",
        "created_at": final_record.created_at.isoformat()
    }

    # Instant Dual Sync via WebSocket:
    # 1. Sync to Doctor Portal
    await ws_manager.broadcast_org(tech.org_id, "LAB_REPORT_COMPLETED", sync_payload)
    # 2. Sync to Patient Portal Vault
    await ws_manager.broadcast_uhid(req.patient_uhid, "NEW_SCAN_UPLOADED", sync_payload)

    return {
        "status": "report_uploaded",
        "record_id": final_record.id,
        "ai_summary": final_record.ai_summary_text
    }
