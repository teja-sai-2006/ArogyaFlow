import math
import datetime
import uuid
from sqlalchemy.orm import Session
from models import Hospital, BloodBankStock, EmergencyEvent, ConsentToken, AppointmentAndTriage, User
from services.websocket_manager import ws_manager

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    # Radius of earth in kilometers
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

async def process_emergency_sos(
    db: Session,
    patient_uhid: str,
    gps_lat: float,
    gps_lng: float,
    symptoms: str = "Severe Road Traffic Accident / Trauma"
):
    # Retrieve patient
    patient = db.query(User).filter(User.uhid == patient_uhid).first()
    blood_group = patient.blood_group if patient and patient.blood_group else "O-ve"
    patient_name = patient.name if patient else "Emergency Patient"

    # Query all multi-specialty hospitals
    multi_hospitals = db.query(Hospital).filter(Hospital.type == "MULTI_SPECIALTY").all()
    if not multi_hospitals:
        multi_hospitals = db.query(Hospital).all()

    # Sort hospitals by distance from patient GPS
    hospitals_with_distance = []
    for h in multi_hospitals:
        dist = calculate_haversine_distance(gps_lat, gps_lng, h.gps_lat, h.gps_lng)
        hospitals_with_distance.append((h, dist))

    hospitals_with_distance.sort(key=lambda x: x[1])

    primary_hospital, primary_dist = hospitals_with_distance[0]
    assigned_hospital = primary_hospital
    cascade_triggered = False
    cascade_reason = ""

    # Check ICU Beds availability at primary hospital
    if primary_hospital.icu_beds_available <= 0:
        cascade_triggered = True
        cascade_reason = f"Primary hospital {primary_hospital.name} has 0 ICU beds available."
        if len(hospitals_with_distance) > 1:
            assigned_hospital, assigned_dist = hospitals_with_distance[1]
        else:
            assigned_hospital = primary_hospital

    # Lock 1 ICU bed at assigned hospital if available
    if assigned_hospital.icu_beds_available > 0:
        assigned_hospital.icu_beds_available -= 1
        bed_locked = True
    else:
        bed_locked = False

    # Check Internal Blood Stock
    hospital_blood = assigned_hospital.internal_blood_stock or {}
    available_units_in_hospital = hospital_blood.get(blood_group, 0)

    blood_escalation_triggered = False
    assigned_blood_bank_id = None
    blood_status_message = ""
    donor_alert_triggered = False

    if available_units_in_hospital <= 0:
        # Internal stock is 0! Automatically escalate to external blood bank
        blood_escalation_triggered = True
        # Find nearest blood bank with this blood group
        all_blood_banks = db.query(BloodBankStock).filter(BloodBankStock.blood_group == blood_group).all()
        if all_blood_banks:
            # Sort by distance
            sorted_banks = sorted(
                all_blood_banks,
                key=lambda b: calculate_haversine_distance(gps_lat, gps_lng, b.gps_lat, b.gps_lng)
            )
            nearest_bb = sorted_banks[0]
            assigned_blood_bank_id = nearest_bb.blood_bank_id

            if nearest_bb.live_units_available > 0:
                nearest_bb.live_units_available -= 1
                blood_status_message = f"Hospital has 0 units of {blood_group}. 1 live unit automatically reserved at {nearest_bb.bank_name}."
            else:
                donor_alert_triggered = True
                blood_status_message = f"URGENT: 0 units of {blood_group} at hospital AND {nearest_bb.bank_name}. Automated donor outreach dispatched to {len(nearest_bb.registered_donors_list or [])} registered local donors."
        else:
            blood_status_message = f"Warning: No external blood bank found with stock for {blood_group}."
    else:
        # Reserve unit from hospital internal stock
        hospital_blood[blood_group] = available_units_in_hospital - 1
        assigned_hospital.internal_blood_stock = hospital_blood
        blood_status_message = f"1 unit of {blood_group} successfully reserved from hospital internal inventory."

    # Create emergency consent override token so doctors and staff can read all records immediately
    token_id = f"TOKEN-EMERGENCY-{uuid.uuid4().hex[:8].upper()}"
    emergency_token = ConsentToken(
        id=token_id,
        patient_uhid=patient_uhid,
        granted_to_hospital_id=assigned_hospital.id,
        status="EMERGENCY_OVERRIDE",
        created_at=datetime.datetime.utcnow(),
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    )
    db.add(emergency_token)

    # Create emergency triage appointment entry
    booking_id = f"EMG-{uuid.uuid4().hex[:8].upper()}"
    emergency_booking = AppointmentAndTriage(
        id=booking_id,
        patient_uhid=patient_uhid,
        hospital_id=assigned_hospital.id,
        booking_type="EMERGENCY_SOS",
        severity_level="CRITICAL",
        symptoms=f"{symptoms} | Blood: {blood_group} | Bed Locked: {bed_locked}",
        status="PENDING_MGMT",
        cascade_source_hospital_id=primary_hospital.id if cascade_triggered else None,
        appointment_date=datetime.date.today().isoformat(),
        created_at=datetime.datetime.utcnow()
    )
    db.add(emergency_booking)

    # Create Emergency Event
    event_id = f"EVT-{uuid.uuid4().hex[:8].upper()}"
    emergency_event = EmergencyEvent(
        id=event_id,
        patient_uhid=patient_uhid,
        primary_hospital_id=primary_hospital.id,
        assigned_hospital_id=assigned_hospital.id,
        status="ACTIVE",
        blood_bank_escalated=blood_escalation_triggered,
        blood_bank_id=assigned_blood_bank_id,
        bed_locked=bed_locked,
        details_json={
            "patient_name": patient_name,
            "patient_blood": blood_group,
            "gps_lat": gps_lat,
            "gps_lng": gps_lng,
            "cascade_triggered": cascade_triggered,
            "cascade_reason": cascade_reason,
            "blood_status_message": blood_status_message,
            "donor_alert_triggered": donor_alert_triggered,
            "booking_id": booking_id,
            "token_id": token_id
        },
        created_at=datetime.datetime.utcnow()
    )
    db.add(emergency_event)
    db.commit()

    # Prepare response payload
    sos_payload = {
        "event_id": event_id,
        "booking_id": booking_id,
        "token_id": token_id,
        "patient_uhid": patient_uhid,
        "patient_name": patient_name,
        "blood_group": blood_group,
        "gps": {"lat": gps_lat, "lng": gps_lng},
        "primary_hospital": {"id": primary_hospital.id, "name": primary_hospital.name},
        "assigned_hospital": {"id": assigned_hospital.id, "name": assigned_hospital.name},
        "cascade_triggered": cascade_triggered,
        "cascade_reason": cascade_reason,
        "bed_locked": bed_locked,
        "blood_escalated": blood_escalation_triggered,
        "assigned_blood_bank_id": assigned_blood_bank_id,
        "blood_status_message": blood_status_message,
        "donor_alert_triggered": donor_alert_triggered,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }

    # Broadcast real-time sirens and updates over WebSocket
    # 1. Alert assigned hospital management
    await ws_manager.broadcast_org(assigned_hospital.id, "EMERGENCY_SOS_ALERT", sos_payload)
    # 2. Alert blood bank portal if escalated
    if assigned_blood_bank_id:
        await ws_manager.broadcast_org(assigned_blood_bank_id, "EMERGENCY_BLOOD_REQUEST", sos_payload)
    # 3. Broadcast to all Super Admins & Patient
    await ws_manager.broadcast_role("SUPER_ADMIN", "EMERGENCY_SOS_ALERT", sos_payload)
    await ws_manager.broadcast_uhid(patient_uhid, "EMERGENCY_SOS_DISPATCHED", sos_payload)

    return sos_payload
