import datetime
import uuid
from typing import List
from sqlalchemy.orm import Session
from models import PatientRecord, User, SMSAlertLog
from services.websocket_manager import ws_manager

async def trigger_refill_and_store_closing_alerts(
    db: Session,
    alert_reason: str = "Regional Stores Closing Early / Weather Alert",
    threshold_days: int = 3
) -> List[dict]:
    """
    Checks all patient records for active prescriptions with low remaining days (<= threshold_days).
    Dispatches automated offline SMS alerts to those patients so they stock up in time.
    """
    records = db.query(PatientRecord).filter(PatientRecord.report_type == "PRESCRIPTION").all()
    dispatched_alerts = []

    for rec in records:
        prescriptions = rec.prescribed_medicines_json or []
        for rx in prescriptions:
            rem = rx.get("remaining_days", 99)
            if isinstance(rem, int) and rem <= threshold_days:
                # Find patient details
                patient = db.query(User).filter(User.uhid == rec.patient_uhid).first()
                if not patient:
                    continue

                phone = patient.phone
                patient_name = patient.name
                med_name = rx.get("brand_name", rx.get("generic_salt", "vital medicines"))
                msg = (
                    f"⚠️ URGENT HEALTH ALERT: Dear {patient_name}, your prescription for {med_name} "
                    f"has only {rem} day(s) of doses left. Local medical stores in your zone are closing early due to: {alert_reason}. "
                    f"Please restock today or visit your nearest 24/7 emergency pharmacy. Follow-up consultation is scheduled."
                )

                # Log alert
                alert_log = SMSAlertLog(
                    id=f"SMS-{uuid.uuid4().hex[:8].upper()}",
                    recipient_phone=phone,
                    recipient_name=patient_name,
                    uhid=patient.uhid,
                    alert_type="STORE_CLOSING" if "Closing" in alert_reason else "DISASTER",
                    message=msg,
                    created_at=datetime.datetime.utcnow()
                )
                db.add(alert_log)
                dispatched_alerts.append({
                    "id": alert_log.id,
                    "recipient_phone": phone,
                    "recipient_name": patient_name,
                    "uhid": patient.uhid,
                    "medicine": med_name,
                    "remaining_days": rem,
                    "message": msg,
                    "timestamp": alert_log.created_at.isoformat()
                })
                break # Avoid spamming multiple SMS for same patient in one cycle

    db.commit()

    if dispatched_alerts:
        await ws_manager.broadcast_all("SMS_DISPATCHED_BATCH", {
            "count": len(dispatched_alerts),
            "reason": alert_reason,
            "alerts": dispatched_alerts
        })

    return dispatched_alerts
