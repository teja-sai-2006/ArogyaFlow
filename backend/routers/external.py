import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from database import get_db
from models import User, BloodBankStock, PharmacyStock, SMSAlertLog
from auth.rbac_guard import require_role
from services.websocket_manager import ws_manager
from services.sms_cron import trigger_refill_and_store_closing_alerts

router = APIRouter(prefix="/api/external", tags=["External Portals"])

# --- Blood Bank Models ---
class UpdateBloodUnitRequest(BaseModel):
    blood_group: str
    live_units: int

class TriggerDonorAlertRequest(BaseModel):
    blood_group: str
    hospital_name: Optional[str] = "Regional Trauma Center"

# --- Pharmacy Models ---
class UploadMedicineStockRequest(BaseModel):
    medicine_brand: str
    generic_salt_name: str
    price: float
    expiry_date: str
    stock_qty: int
    closing_time: str = "21:30"

class PharmacyEarlyClosingRequest(BaseModel):
    closing_time: str
    reason: str = "Emergency maintenance / local holiday"

# ==================== BLOOD BANK ENDPOINTS ====================

@router.get("/blood-bank/inventory")
def get_blood_bank_inventory(
    db: Session = Depends(get_db),
    bank_admin: User = Depends(require_role(["BLOOD_BANK"]))
):
    stocks = db.query(BloodBankStock).filter(
        BloodBankStock.blood_bank_id == bank_admin.org_id
    ).all()

    return {
        "blood_bank_id": bank_admin.org_id,
        "stocks": [
            {
                "id": s.id,
                "blood_group": s.blood_group,
                "live_units": s.live_units_available,
                "bank_name": s.bank_name,
                "registered_donors": s.registered_donors_list or []
            } for s in stocks
        ]
    }

@router.post("/blood-bank/update-units")
async def update_blood_units(
    req: UpdateBloodUnitRequest,
    db: Session = Depends(get_db),
    bank_admin: User = Depends(require_role(["BLOOD_BANK"]))
):
    stock_entry = db.query(BloodBankStock).filter(
        BloodBankStock.blood_bank_id == bank_admin.org_id,
        BloodBankStock.blood_group == req.blood_group
    ).first()

    if not stock_entry:
        stock_entry = BloodBankStock(
            id=f"BBS-{uuid.uuid4().hex[:6].upper()}",
            blood_bank_id=bank_admin.org_id,
            bank_name=bank_admin.name,
            gps_lat=17.72,
            gps_lng=83.30,
            blood_group=req.blood_group,
            live_units_available=req.live_units,
            registered_donors_list=[]
        )
        db.add(stock_entry)
    else:
        stock_entry.live_units_available = req.live_units

    db.commit()

    await ws_manager.broadcast_all("BLOOD_STOCK_UPDATED", {
        "blood_bank_id": bank_admin.org_id,
        "blood_group": req.blood_group,
        "live_units": req.live_units
    })

    return {"status": "success", "blood_group": req.blood_group, "units": req.live_units}

@router.post("/blood-bank/donor-outreach")
async def trigger_donor_outreach(
    req: TriggerDonorAlertRequest,
    db: Session = Depends(get_db),
    bank_admin: User = Depends(require_role(["BLOOD_BANK"]))
):
    stock_entry = db.query(BloodBankStock).filter(
        BloodBankStock.blood_bank_id == bank_admin.org_id,
        BloodBankStock.blood_group == req.blood_group
    ).first()

    donors = stock_entry.registered_donors_list if stock_entry else []
    dispatched_sms = []

    for d in donors:
        msg = (
            f"🩸 CRITICAL BLOOD SHORTAGE: Immediate request for {req.blood_group} blood at {req.hospital_name}. "
            f"You are a registered volunteer donor. Please proceed to {bank_admin.name} or contact us immediately to save a life."
        )
        alert = SMSAlertLog(
            id=f"SMS-DONOR-{uuid.uuid4().hex[:6].upper()}",
            recipient_phone=d.get("phone", "+91-9000000000"),
            recipient_name=d.get("name", "Donor"),
            alert_type="DISASTER",
            message=msg,
            created_at=datetime.datetime.utcnow()
        )
        db.add(alert)
        dispatched_sms.append({"donor": d.get("name"), "phone": d.get("phone"), "status": "SMS Dispatched"})

    db.commit()

    return {
        "status": "donor_alerts_dispatched",
        "blood_group": req.blood_group,
        "alerted_donors_count": len(dispatched_sms),
        "details": dispatched_sms
    }

# ==================== MEDICAL STORE ENDPOINTS ====================

@router.get("/pharmacy/inventory")
def get_pharmacy_inventory(
    db: Session = Depends(get_db),
    pharmacy_admin: User = Depends(require_role(["PHARMACY"]))
):
    items = db.query(PharmacyStock).filter(
        PharmacyStock.pharmacy_id == pharmacy_admin.org_id
    ).all()

    return {
        "pharmacy_id": pharmacy_admin.org_id,
        "inventory": [
            {
                "id": it.id,
                "medicine_brand": it.medicine_brand,
                "generic_salt_name": it.generic_salt_name,
                "price": it.price,
                "expiry_date": it.expiry_date,
                "stock_qty": it.stock_qty,
                "closing_time": it.closing_time,
                "store_name": it.store_name
            } for it in items
        ]
    }

@router.post("/pharmacy/stock")
async def add_or_update_stock(
    req: UploadMedicineStockRequest,
    db: Session = Depends(get_db),
    pharmacy_admin: User = Depends(require_role(["PHARMACY"]))
):
    new_item = PharmacyStock(
        id=f"STK-{uuid.uuid4().hex[:6].upper()}",
        pharmacy_id=pharmacy_admin.org_id,
        store_name=pharmacy_admin.name,
        city="Visakhapatnam",
        gps_lat=17.72,
        gps_lng=83.30,
        closing_time=req.closing_time,
        medicine_brand=req.medicine_brand,
        generic_salt_name=req.generic_salt_name,
        price=req.price,
        expiry_date=req.expiry_date,
        stock_qty=req.stock_qty
    )
    db.add(new_item)
    db.commit()

    await ws_manager.broadcast_all("PHARMACY_STOCK_UPDATED", {
        "pharmacy_id": pharmacy_admin.org_id,
        "store_name": pharmacy_admin.name,
        "generic_salt": req.generic_salt_name,
        "price": req.price,
        "stock": req.stock_qty
    })

    return {"status": "stock_saved", "stock_id": new_item.id}

@router.post("/pharmacy/broadcast-early-closing")
async def trigger_early_closing_broadcast(
    req: PharmacyEarlyClosingRequest,
    db: Session = Depends(get_db),
    pharmacy_admin: User = Depends(require_role(["PHARMACY"]))
):
    """
    Integration Fix G:
    Medical store triggers early closing. Backend triggers offline SMS alerts
    to patients whose refill tracker shows <= 3 days of remaining doses.
    """
    alerts = await trigger_refill_and_store_closing_alerts(
        db=db,
        alert_reason=f"{pharmacy_admin.name} closing at {req.closing_time} due to {req.reason}",
        threshold_days=3
    )

    return {
        "status": "early_closing_broadcast_sent",
        "closing_time": req.closing_time,
        "reason": req.reason,
        "sms_alerts_triggered": len(alerts),
        "alerts": alerts
    }
