import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from database import get_db
from models import User, HospitalStaffStatus, AppointmentAndTriage
from auth.rbac_guard import require_role
from auth.jwt_utils import hash_password
from services.websocket_manager import ws_manager

router = APIRouter(prefix="/api/hospital-admin", tags=["Hospital Admin"])

class CreateStaffRequest(BaseModel):
    name: str
    email: str
    phone: str
    password: str
    role: str # DOCTOR | LAB_TECH | HOSP_MGMT
    specialty: Optional[str] = "General Medicine"

class ToggleAttendanceRequest(BaseModel):
    staff_id: str
    is_present: bool

@router.get("/staff")
def get_hospital_staff(
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(["HOSP_ADMIN"]))
):
    statuses = db.query(HospitalStaffStatus).filter(
        HospitalStaffStatus.hospital_id == admin.org_id
    ).all()
    
    result = []
    for s in statuses:
        u = db.query(User).filter(User.id == s.staff_id).first()
        result.append({
            "staff_id": s.staff_id,
            "status_id": s.id,
            "name": u.name if u else "Staff Member",
            "email": u.email if u else "",
            "phone": u.phone if u else "",
            "role": s.role,
            "specialty": s.specialty,
            "is_present_today": s.is_present_today,
            "current_patient_load": s.current_patient_load
        })
    return result

@router.post("/create-staff")
def create_staff(
    req: CreateStaffRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(["HOSP_ADMIN"]))
):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    new_user = User(
        id=f"STF-{uuid.uuid4().hex[:6].upper()}",
        role=req.role,
        org_id=admin.org_id,
        name=req.name,
        phone=req.phone,
        email=req.email,
        password_hash=hash_password(req.password)
    )
    db.add(new_user)

    staff_status = HospitalStaffStatus(
        id=f"STS-{uuid.uuid4().hex[:6].upper()}",
        staff_id=new_user.id,
        hospital_id=admin.org_id,
        role=req.role,
        specialty=req.specialty if req.role == "DOCTOR" else None,
        is_present_today=True,
        booked_dates_json=[]
    )
    db.add(staff_status)
    db.commit()

    return {
        "status": "success",
        "staff_id": new_user.id,
        "name": new_user.name,
        "role": req.role
    }

@router.patch("/attendance")
async def toggle_attendance(
    req: ToggleAttendanceRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(["HOSP_ADMIN"]))
):
    status_entry = db.query(HospitalStaffStatus).filter(
        HospitalStaffStatus.staff_id == req.staff_id,
        HospitalStaffStatus.hospital_id == admin.org_id
    ).first()

    if not status_entry:
        raise HTTPException(status_code=404, detail="Staff status record not found")

    status_entry.is_present_today = req.is_present
    db.commit()

    staff_user = db.query(User).filter(User.id == req.staff_id).first()
    staff_name = staff_user.name if staff_user else "Doctor"

    flagged_appointments = []
    # If a doctor is marked Absent, automatically flag existing today's appointments
    if not req.is_present and status_entry.role == "DOCTOR":
        today_str = datetime.date.today().isoformat()
        affected_appts = db.query(AppointmentAndTriage).filter(
            AppointmentAndTriage.hospital_id == admin.org_id,
            AppointmentAndTriage.doctor_id == req.staff_id,
            AppointmentAndTriage.status.in_(["PENDING_MGMT", "CONFIRMED"])
        ).all()

        for appt in affected_appts:
            appt.status = "RESCHEDULE_REQUIRED"
            flagged_appointments.append({
                "booking_id": appt.id,
                "patient_uhid": appt.patient_uhid,
                "previous_doctor_id": req.staff_id,
                "previous_doctor_name": staff_name,
                "symptoms": appt.symptoms
            })
        db.commit()

        # Fire real-time WebSocket notification to Hospital Management Portal
        mgmt_payload = {
            "doctor_id": req.staff_id,
            "doctor_name": staff_name,
            "hospital_id": admin.org_id,
            "status": "ABSENT",
            "flagged_count": len(flagged_appointments),
            "flagged_appointments": flagged_appointments,
            "action_required": "Reassign patients to another present specialist or reschedule."
        }
        await ws_manager.broadcast_org(admin.org_id, "DOCTOR_ABSENCE_ALERT", mgmt_payload)

    # Broadcast general attendance update
    await ws_manager.broadcast_org(admin.org_id, "STAFF_ATTENDANCE_UPDATED", {
        "staff_id": req.staff_id,
        "name": staff_name,
        "is_present": req.is_present
    })

    return {
        "status": "success",
        "staff_id": req.staff_id,
        "staff_name": staff_name,
        "is_present_today": req.is_present,
        "flagged_reschedules_count": len(flagged_appointments),
        "flagged_appointments": flagged_appointments
    }
