import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from database import get_db
from models import User, Hospital, PharmacyStock, BloodBankStock, SMSAlertLog
from auth.rbac_guard import require_role
from auth.jwt_utils import hash_password
from services.websocket_manager import ws_manager
from services.sms_cron import trigger_refill_and_store_closing_alerts

router = APIRouter(prefix="/api/super-admin", tags=["Super Admin"])

class ProvisionOrgRequest(BaseModel):
    org_type: str # HOSPITAL | PHARMACY | BLOOD_BANK
    name: str
    admin_name: str
    email: str
    phone: str
    password: str
    city: str = "Visakhapatnam"
    gps_lat: float = 17.72
    gps_lng: float = 83.30
    hospital_type: Optional[str] = "MULTI_SPECIALTY"
    is_safe_zone: Optional[bool] = False

class DisasterAlertRequest(BaseModel):
    affected_city: str
    alert_title: str
    severity: str = "HIGH"
    danger_zone_hospital_ids: List[str] = []

@router.get("/overview")
def get_system_overview(
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(["SUPER_ADMIN"]))
):
    hospitals = db.query(Hospital).all()
    pharmacies = db.query(PharmacyStock).all()
    blood_banks = db.query(BloodBankStock).all()
    sms_logs = db.query(SMSAlertLog).order_by(SMSAlertLog.created_at.desc()).limit(20).all()
    total_users = db.query(User).count()

    return {
        "total_users": total_users,
        "total_hospitals": len(hospitals),
        "total_pharmacies": len(set(p.pharmacy_id for p in pharmacies)),
        "total_blood_banks": len(set(b.blood_bank_id for b in blood_banks)),
        "hospitals": hospitals,
        "recent_sms_alerts": sms_logs
    }

@router.post("/provision-org")
def provision_organization(
    req: ProvisionOrgRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(["SUPER_ADMIN"]))
):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    org_id = f"{req.org_type[:4]}-{uuid.uuid4().hex[:6].upper()}"

    if req.org_type == "HOSPITAL":
        new_hosp = Hospital(
            id=org_id,
            name=req.name,
            type=req.hospital_type or "MULTI_SPECIALTY",
            city=req.city,
            gps_lat=req.gps_lat,
            gps_lng=req.gps_lng,
            icu_beds_available=5,
            general_beds_available=20,
            equipment_list=["CT Scan", "X-Ray", "Emergency ICU"],
            internal_blood_stock={"O-ve": 2, "A+ve": 4, "B+ve": 4},
            is_safe_zone=req.is_safe_zone or False
        )
        db.add(new_hosp)
        admin_role = "HOSP_ADMIN"
    elif req.org_type == "PHARMACY":
        admin_role = "PHARMACY"
        # Seed an initial stock item
        seed_item = PharmacyStock(
            id=f"STK-{uuid.uuid4().hex[:6].upper()}",
            pharmacy_id=org_id,
            store_name=req.name,
            city=req.city,
            gps_lat=req.gps_lat,
            gps_lng=req.gps_lng,
            closing_time="22:00",
            medicine_brand="Paracetamol 650",
            generic_salt_name="Paracetamol 650mg",
            price=32.0,
            expiry_date="2027-12-31",
            stock_qty=100
        )
        db.add(seed_item)
    elif req.org_type == "BLOOD_BANK":
        admin_role = "BLOOD_BANK"
        seed_bb = BloodBankStock(
            id=f"BBS-{uuid.uuid4().hex[:6].upper()}",
            blood_bank_id=org_id,
            bank_name=req.name,
            city=req.city,
            gps_lat=req.gps_lat,
            gps_lng=req.gps_lng,
            blood_group="O-ve",
            live_units_available=8,
            registered_donors_list=[{"name": "Anil K", "phone": "+91-9848011223", "blood_group": "O-ve"}]
        )
        db.add(seed_bb)
    else:
        raise HTTPException(status_code=400, detail="Invalid organization type")

    # Create root admin user for this organization
    new_user = User(
        id=f"USR-{uuid.uuid4().hex[:6].upper()}",
        role=admin_role,
        org_id=org_id,
        name=req.admin_name,
        phone=req.phone,
        email=req.email,
        password_hash=hash_password(req.password)
    )
    db.add(new_user)
    db.commit()

    return {
        "status": "success",
        "message": f"Successfully provisioned {req.org_type} with ID {org_id}",
        "org_id": org_id,
        "admin_user_id": new_user.id
    }

@router.post("/disaster-alert")
async def trigger_disaster_alert(
    req: DisasterAlertRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(["SUPER_ADMIN"]))
):
    # Flag affected hospitals as danger zone
    for hid in req.danger_zone_hospital_ids:
        hosp = db.query(Hospital).filter(Hospital.id == hid).first()
        if hosp:
            hosp.is_safe_zone = False

    db.commit()

    # Trigger automated offline SMS alerts to all patients low on medication in that area
    sms_alerts = await trigger_refill_and_store_closing_alerts(
        db=db,
        alert_reason=f"DISASTER ALERT: {req.alert_title} in {req.affected_city}. Medical supply lines may be disrupted.",
        threshold_days=4
    )

    # Broadcast real-time disaster emergency payload across all connected portals
    disaster_payload = {
        "alert_title": req.alert_title,
        "affected_city": req.affected_city,
        "severity": req.severity,
        "danger_zone_hospitals": req.danger_zone_hospital_ids,
        "evacuation_required": True,
        "sms_broadcast_count": len(sms_alerts),
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    await ws_manager.broadcast_all("REGIONAL_DISASTER_ALERT", disaster_payload)

    return {
        "status": "disaster_alert_broadcasted",
        "details": disaster_payload,
        "dispatched_sms_alerts": sms_alerts
    }
