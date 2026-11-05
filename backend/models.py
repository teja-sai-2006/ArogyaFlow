import datetime

def utcnow():
    return datetime.datetime.now(datetime.timezone.utc)

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text, JSON, ForeignKey
)
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    role = Column(String, index=True)  # SUPER_ADMIN, HOSP_ADMIN, HOSP_MGMT, DOCTOR, LAB_TECH, BLOOD_BANK, PHARMACY, PATIENT
    org_id = Column(String, nullable=True, index=True) # hospital_id, pharmacy_id, blood_bank_id
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    uhid = Column(String, nullable=True, unique=True, index=True)
    blood_group = Column(String, nullable=True)
    allergies = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)

class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # MULTI_SPECIALTY | LOCAL_CLINIC
    state = Column(String, default="Andhra Pradesh")
    city = Column(String, default="Visakhapatnam")
    gps_lat = Column(Float, nullable=False)
    gps_lng = Column(Float, nullable=False)
    icu_beds_available = Column(Integer, default=0)
    general_beds_available = Column(Integer, default=10)
    equipment_list = Column(JSON, default=list) # e.g. ["CT Scan", "MRI", "Ventilator"]
    internal_blood_stock = Column(JSON, default=dict) # e.g. {"O-ve": 0, "A+ve": 5}
    is_safe_zone = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)

class HospitalStaffStatus(Base):
    __tablename__ = "hospital_staff_status"

    id = Column(String, primary_key=True, index=True)
    staff_id = Column(String, ForeignKey("users.id"), index=True)
    hospital_id = Column(String, ForeignKey("hospitals.id"), index=True)
    role = Column(String, nullable=False) # DOCTOR | LAB_TECH | HOSP_MGMT
    specialty = Column(String, nullable=True) # Cardiology, Neurology, General Medicine, Orthopedics
    is_present_today = Column(Boolean, default=True)
    booked_dates_json = Column(JSON, default=list)
    current_patient_load = Column(Integer, default=0)

    staff = relationship("User", foreign_keys=[staff_id])
    hospital = relationship("Hospital", foreign_keys=[hospital_id])

class PatientRecord(Base):
    __tablename__ = "patient_records"

    id = Column(String, primary_key=True, index=True)
    patient_uhid = Column(String, index=True)
    uploaded_by_role = Column(String, nullable=False) # DOCTOR | LAB_TECH | PATIENT
    doctor_id = Column(String, nullable=True)
    hospital_id = Column(String, nullable=True)
    file_url = Column(String, nullable=True)
    report_type = Column(String, nullable=False) # LAB_SCAN | PRESCRIPTION | PAST_HISTORY | EMERGENCY_SUMMARY
    title = Column(String, nullable=False)
    clinical_notes = Column(Text, nullable=True)
    ai_summary_text = Column(Text, nullable=True)
    prescribed_medicines_json = Column(JSON, default=list)
    created_at = Column(DateTime, default=utcnow)

class ConsentToken(Base):
    __tablename__ = "consent_tokens"

    id = Column(String, primary_key=True, index=True)
    patient_uhid = Column(String, index=True)
    granted_to_hospital_id = Column(String, index=True)
    status = Column(String, default="ACTIVE") # ACTIVE | REVOKED | EMERGENCY_OVERRIDE
    created_at = Column(DateTime, default=utcnow)
    expires_at = Column(DateTime, nullable=True)

class AppointmentAndTriage(Base):
    __tablename__ = "appointments_and_triage"

    id = Column(String, primary_key=True, index=True)
    patient_uhid = Column(String, index=True)
    hospital_id = Column(String, index=True)
    doctor_id = Column(String, nullable=True, index=True)
    booking_type = Column(String, nullable=False) # AI_CALL | MANUAL_TABLE | EMERGENCY_SOS | DISASTER_TRANSFER
    severity_level = Column(String, default="LOW") # LOW | MODERATE | CRITICAL
    symptoms = Column(Text, nullable=False)
    status = Column(String, default="PENDING_MGMT") # PENDING_MGMT | CONFIRMED | RESCHEDULE_REQUIRED | COMPLETED | CANCELLED
    generic_request_status = Column(String, default="NONE") # NONE | PENDING_DOCTOR | APPROVED | REJECTED
    generic_request_notes = Column(Text, nullable=True)
    cascade_source_hospital_id = Column(String, nullable=True)
    appointment_date = Column(String, default=lambda: datetime.date.today().isoformat())
    created_at = Column(DateTime, default=utcnow)

class PharmacyStock(Base):
    __tablename__ = "pharmacy_stock"

    id = Column(String, primary_key=True, index=True)
    pharmacy_id = Column(String, index=True)
    store_name = Column(String, nullable=False)
    city = Column(String, default="Visakhapatnam")
    gps_lat = Column(Float, nullable=False)
    gps_lng = Column(Float, nullable=False)
    closing_time = Column(String, default="21:30")
    medicine_brand = Column(String, nullable=False)
    generic_salt_name = Column(String, nullable=False, index=True)
    price = Column(Float, nullable=False)
    expiry_date = Column(String, nullable=False)
    stock_qty = Column(Integer, default=50)

class BloodBankStock(Base):
    __tablename__ = "blood_bank_stock"

    id = Column(String, primary_key=True, index=True)
    blood_bank_id = Column(String, index=True)
    bank_name = Column(String, nullable=False)
    city = Column(String, default="Visakhapatnam")
    gps_lat = Column(Float, nullable=False)
    gps_lng = Column(Float, nullable=False)
    blood_group = Column(String, nullable=False, index=True)
    live_units_available = Column(Integer, default=10)
    registered_donors_list = Column(JSON, default=list)

class EmergencyEvent(Base):
    __tablename__ = "emergency_events"

    id = Column(String, primary_key=True, index=True)
    patient_uhid = Column(String, index=True)
    primary_hospital_id = Column(String)
    assigned_hospital_id = Column(String)
    status = Column(String, default="ACTIVE")
    blood_bank_escalated = Column(Boolean, default=False)
    blood_bank_id = Column(String, nullable=True)
    bed_locked = Column(Boolean, default=True)
    details_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utcnow)

class SMSAlertLog(Base):
    __tablename__ = "sms_alerts_log"

    id = Column(String, primary_key=True, index=True)
    recipient_phone = Column(String, nullable=False)
    recipient_name = Column(String, nullable=False)
    uhid = Column(String, nullable=True)
    alert_type = Column(String, nullable=False) # DISASTER | STORE_CLOSING | REFILL_REMINDER | RESCHEDULE
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utcnow)
