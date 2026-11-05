import datetime
from sqlalchemy.orm import Session
from database import engine, SessionLocal, Base
from models import (
    User, Hospital, HospitalStaffStatus, PatientRecord,
    ConsentToken, AppointmentAndTriage, PharmacyStock, BloodBankStock
)
from auth.jwt_utils import hash_password

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # If users already seeded, skip
    if db.query(User).count() > 0:
        db.close()
        return

    print("🌱 Seeding comprehensive multi-user & multi-org ArogyaFlow database...")

    default_pw = hash_password("pass123")

    # ================= 1. SUPER ADMIN =================
    super_admin = User(
        id="USR-SUPER-01",
        role="SUPER_ADMIN",
        org_id=None,
        name="Dr. K. Somasekhar (Director General)",
        phone="+91-9848011000",
        email="superadmin@arogyaflow.gov.in",
        password_hash=default_pw
    )
    db.add(super_admin)

    # ================= 2. HOSPITALS =================
    # Hospital A: Multi-Specialty, Danger/Affected Zone (Safe Zone = False), ICU = 0, O-ve = 0
    hosp_a = Hospital(
        id="HOSP-A",
        name="Apollo Speciality Hospital (Ramnagar)",
        type="MULTI_SPECIALTY",
        state="Andhra Pradesh",
        city="Visakhapatnam",
        gps_lat=17.7215,
        gps_lng=83.3150,
        icu_beds_available=0,  # TEST SOS CASCADE
        general_beds_available=15,
        equipment_list=["CT Scan", "1.5T MRI", "Cardiac Cath Lab", "Emergency Trauma ICU", "Dialysis"],
        internal_blood_stock={"O-ve": 0, "A+ve": 4, "B+ve": 6, "AB+ve": 2}, # TEST BLOOD ESCALATION
        is_safe_zone=False
    )
    db.add(hosp_a)

    # Hospital B: Multi-Specialty, Safe Zone = True, ICU = 10, Full Blood
    hosp_b = Hospital(
        id="HOSP-B",
        name="Care Super Speciality Hospital (Maharanipeta)",
        type="MULTI_SPECIALTY",
        state="Andhra Pradesh",
        city="Visakhapatnam",
        gps_lat=17.7120,
        gps_lng=83.3080,
        # Hospital B: 10 ICU beds (receives cascade), but 0 O-ve blood (triggers blood bank auto-escalation)
        icu_beds_available=10,
        general_beds_available=40,
        equipment_list=["3T MRI", "64-Slice CT", "Cardiothoracic ICU", "Neuro ICU", "Burn Care Unit"],
        internal_blood_stock={"O-ve": 0, "A+ve": 12, "B+ve": 15, "AB+ve": 5},
        is_safe_zone=True
    )
    db.add(hosp_b)

    # Hospital C: Local Clinic
    hosp_c = Hospital(
        id="HOSP-C",
        name="Seethammadhara Urban Primary Health Clinic",
        type="LOCAL_CLINIC",
        state="Andhra Pradesh",
        city="Visakhapatnam",
        gps_lat=17.7420,
        gps_lng=83.3190,
        icu_beds_available=0,
        general_beds_available=8,
        equipment_list=["Digital X-Ray", "Basic Pathology Lab", "Observation Day-Beds"],
        internal_blood_stock={"O-ve": 0, "A+ve": 1, "B+ve": 1},
        is_safe_zone=True
    )
    db.add(hosp_c)

    # ================= 3. HOSPITAL STAFF =================
    # --- Hospital A Staff ---
    hosp_a_admin = User(
        id="USR-HOSPA-ADM",
        role="HOSP_ADMIN",
        org_id="HOSP-A",
        name="V. S. Murthy (Hospital Admin A)",
        phone="+91-9848011001",
        email="admin.hospa@arogyaflow.gov.in",
        password_hash=default_pw
    )
    hosp_a_mgmt1 = User(
        id="USR-HOSPA-MGMT1",
        role="HOSP_MGMT",
        org_id="HOSP-A",
        name="Sravani Rao (Triage & Beds Incharge)",
        phone="+91-9848011002",
        email="mgmt1.hospa@arogyaflow.gov.in",
        password_hash=default_pw
    )
    hosp_a_mgmt2 = User(
        id="USR-HOSPA-MGMT2",
        role="HOSP_MGMT",
        org_id="HOSP-A",
        name="Ramesh Babu (Emergency Coordinator)",
        phone="+91-9848011003",
        email="mgmt2.hospa@arogyaflow.gov.in",
        password_hash=default_pw
    )

    # 4 Doctors for Hospital A (1 Present, 1 Absent, 2 Present)
    doc_a1 = User(
        id="USR-DOC-A1",
        role="DOCTOR",
        org_id="HOSP-A",
        name="Dr. Rajesh Varma (Cardiology)",
        phone="+91-9848011004",
        email="dr.rajesh@apollo.arogyaflow.in",
        password_hash=default_pw
    )
    doc_a2 = User(
        id="USR-DOC-A2",
        role="DOCTOR",
        org_id="HOSP-A",
        name="Dr. Sneha Reddy (Neurology)",
        phone="+91-9848011005",
        email="dr.sneha@apollo.arogyaflow.in",
        password_hash=default_pw
    )
    doc_a3 = User(
        id="USR-DOC-A3",
        role="DOCTOR",
        org_id="HOSP-A",
        name="Dr. Vikram Rao (General Medicine)",
        phone="+91-9848011006",
        email="dr.vikram@apollo.arogyaflow.in",
        password_hash=default_pw
    )
    doc_a4 = User(
        id="USR-DOC-A4",
        role="DOCTOR",
        org_id="HOSP-A",
        name="Dr. Priya Nair (Orthopedics)",
        phone="+91-9848011007",
        email="dr.priya@apollo.arogyaflow.in",
        password_hash=default_pw
    )

    lab_a1 = User(
        id="USR-LAB-A1",
        role="LAB_TECH",
        org_id="HOSP-A",
        name="G. Praveen (Senior Radiographer)",
        phone="+91-9848011008",
        email="lab1.hospa@arogyaflow.gov.in",
        password_hash=default_pw
    )
    lab_a2 = User(
        id="USR-LAB-A2",
        role="LAB_TECH",
        org_id="HOSP-A",
        name="K. Bhavani (Pathology Incharge)",
        phone="+91-9848011009",
        email="lab2.hospa@arogyaflow.gov.in",
        password_hash=default_pw
    )

    db.add_all([
        hosp_a_admin, hosp_a_mgmt1, hosp_a_mgmt2,
        doc_a1, doc_a2, doc_a3, doc_a4,
        lab_a1, lab_a2
    ])

    # Statuses for Hospital A Staff: Notice doc_a2 (Dr. Sneha Reddy) is ABSENT today
    db.add_all([
        HospitalStaffStatus(id="STS-A1", staff_id=doc_a1.id, hospital_id="HOSP-A", role="DOCTOR", specialty="Cardiology", is_present_today=True),
        HospitalStaffStatus(id="STS-A2", staff_id=doc_a2.id, hospital_id="HOSP-A", role="DOCTOR", specialty="Neurology", is_present_today=False), # ABSENT!
        HospitalStaffStatus(id="STS-A3", staff_id=doc_a3.id, hospital_id="HOSP-A", role="DOCTOR", specialty="General Medicine", is_present_today=True),
        HospitalStaffStatus(id="STS-A4", staff_id=doc_a4.id, hospital_id="HOSP-A", role="DOCTOR", specialty="Orthopedics", is_present_today=True),
        HospitalStaffStatus(id="STS-LAB-A1", staff_id=lab_a1.id, hospital_id="HOSP-A", role="LAB_TECH", specialty="Radiology", is_present_today=True),
        HospitalStaffStatus(id="STS-LAB-A2", staff_id=lab_a2.id, hospital_id="HOSP-A", role="LAB_TECH", specialty="Pathology", is_present_today=True),
    ])

    # --- Hospital B Staff ---
    hosp_b_admin = User(
        id="USR-HOSPB-ADM",
        role="HOSP_ADMIN",
        org_id="HOSP-B",
        name="T. Chandrasekhar (Hospital Admin B)",
        phone="+91-9848011010",
        email="admin.hospb@arogyaflow.gov.in",
        password_hash=default_pw
    )
    hosp_b_mgmt = User(
        id="USR-HOSPB-MGMT",
        role="HOSP_MGMT",
        org_id="HOSP-B",
        name="Madhavi Latha (Safe Zone Operations)",
        phone="+91-9848011011",
        email="mgmt.hospb@arogyaflow.gov.in",
        password_hash=default_pw
    )
    doc_b1 = User(
        id="USR-DOC-B1",
        role="DOCTOR",
        org_id="HOSP-B",
        name="Dr. Arun Kumar (Critical Care & Emergency)",
        phone="+91-9848011012",
        email="dr.arun@care.arogyaflow.in",
        password_hash=default_pw
    )
    doc_b2 = User(
        id="USR-DOC-B2",
        role="DOCTOR",
        org_id="HOSP-B",
        name="Dr. Meera Sen (Cardiothoracic Surgery)",
        phone="+91-9848011013",
        email="dr.meera@care.arogyaflow.in",
        password_hash=default_pw
    )
    doc_b3 = User(
        id="USR-DOC-B3",
        role="DOCTOR",
        org_id="HOSP-B",
        name="Dr. Harish Patel (Trauma Surgery)",
        phone="+91-9848011014",
        email="dr.harish@care.arogyaflow.in",
        password_hash=default_pw
    )
    lab_b1 = User(
        id="USR-LAB-B1",
        role="LAB_TECH",
        org_id="HOSP-B",
        name="D. Srinivas (Emergency Imaging Tech)",
        phone="+91-9848011015",
        email="lab.hospb@arogyaflow.gov.in",
        password_hash=default_pw
    )

    db.add_all([hosp_b_admin, hosp_b_mgmt, doc_b1, doc_b2, doc_b3, lab_b1])
    db.add_all([
        HospitalStaffStatus(id="STS-B1", staff_id=doc_b1.id, hospital_id="HOSP-B", role="DOCTOR", specialty="Critical Care", is_present_today=True),
        HospitalStaffStatus(id="STS-B2", staff_id=doc_b2.id, hospital_id="HOSP-B", role="DOCTOR", specialty="Cardiology", is_present_today=True),
        HospitalStaffStatus(id="STS-B3", staff_id=doc_b3.id, hospital_id="HOSP-B", role="DOCTOR", specialty="Trauma Surgery", is_present_today=True),
        HospitalStaffStatus(id="STS-LAB-B1", staff_id=lab_b1.id, hospital_id="HOSP-B", role="LAB_TECH", specialty="Imaging", is_present_today=True)
    ])

    # --- Hospital C Staff ---
    hosp_c_admin = User(
        id="USR-HOSPC-ADM",
        role="HOSP_ADMIN",
        org_id="HOSP-C",
        name="P. Appa Rao (Clinic Admin C)",
        phone="+91-9848011020",
        email="admin.hospc@arogyaflow.gov.in",
        password_hash=default_pw
    )
    hosp_c_mgmt = User(
        id="USR-HOSPC-MGMT",
        role="HOSP_MGMT",
        org_id="HOSP-C",
        name="Sunita Das (Clinic Coordinator)",
        phone="+91-9848011021",
        email="mgmt.hospc@arogyaflow.gov.in",
        password_hash=default_pw
    )
    doc_c1 = User(
        id="USR-DOC-C1",
        role="DOCTOR",
        org_id="HOSP-C",
        name="Dr. Suresh Babu (General Physician)",
        phone="+91-9848011022",
        email="dr.suresh@clinic.arogyaflow.in",
        password_hash=default_pw
    )
    doc_c2 = User(
        id="USR-DOC-C2",
        role="DOCTOR",
        org_id="HOSP-C",
        name="Dr. Kavitha M (General Physician)",
        phone="+91-9848011023",
        email="dr.kavitha@clinic.arogyaflow.in",
        password_hash=default_pw
    )

    db.add_all([hosp_c_admin, hosp_c_mgmt, doc_c1, doc_c2])
    db.add_all([
        HospitalStaffStatus(id="STS-C1", staff_id=doc_c1.id, hospital_id="HOSP-C", role="DOCTOR", specialty="General Medicine", is_present_today=True),
        HospitalStaffStatus(id="STS-C2", staff_id=doc_c2.id, hospital_id="HOSP-C", role="DOCTOR", specialty="General Medicine", is_present_today=True)
    ])

    # Additional Doctors for specialties
    doc_a5 = User(
        id="USR-DOC-A5",
        role="DOCTOR",
        org_id="HOSP-A",
        name="Dr. Swathi Rao (Pediatrics)",
        phone="+91-9848011031",
        email="dr.swathi@apollo.arogyaflow.in",
        password_hash=default_pw
    )
    doc_b4 = User(
        id="USR-DOC-B4",
        role="DOCTOR",
        org_id="HOSP-B",
        name="Dr. N. Murthy (Pulmonology)",
        phone="+91-9848011032",
        email="dr.murthy@care.arogyaflow.in",
        password_hash=default_pw
    )
    doc_c3 = User(
        id="USR-DOC-C3",
        role="DOCTOR",
        org_id="HOSP-C",
        name="Dr. Sandeep V (Dermatology)",
        phone="+91-9848011033",
        email="dr.sandeep@clinic.arogyaflow.in",
        password_hash=default_pw
    )
    db.add_all([doc_a5, doc_b4, doc_c3])
    db.add_all([
        HospitalStaffStatus(id="STS-A5", staff_id=doc_a5.id, hospital_id="HOSP-A", role="DOCTOR", specialty="Pediatrics", is_present_today=True),
        HospitalStaffStatus(id="STS-B4", staff_id=doc_b4.id, hospital_id="HOSP-B", role="DOCTOR", specialty="Pulmonology", is_present_today=True),
        HospitalStaffStatus(id="STS-C3", staff_id=doc_c3.id, hospital_id="HOSP-C", role="DOCTOR", specialty="Dermatology", is_present_today=True)
    ])

    # ================= 4. PATIENTS =================
    # Patient 1: Critical trauma profile with O-ve blood
    p1 = User(
        id="USR-PAT-01",
        role="PATIENT",
        org_id=None,
        name="Kiran Kumar",
        phone="+91-9848099001",
        email="kiran.kumar@patient.in",
        password_hash=default_pw,
        uhid="UHID-2026-0001",
        blood_group="O-ve",
        allergies="Penicillin Allergy"
    )
    # Patient 2: Chronic patient with active prescription having 2 days doses left
    p2 = User(
        id="USR-PAT-02",
        role="PATIENT",
        org_id=None,
        name="Lakshmi Devi",
        phone="+91-9848099002",
        email="lakshmi.devi@patient.in",
        password_hash=default_pw,
        uhid="UHID-2026-0002",
        blood_group="B+ve",
        allergies="No known drug allergies"
    )
    # Patient 3: Booked with Absent doctor Dr. Sneha Reddy
    p3 = User(
        id="USR-PAT-03",
        role="PATIENT",
        org_id=None,
        name="Venkatesh Rao",
        phone="+91-9848099003",
        email="venkatesh.rao@patient.in",
        password_hash=default_pw,
        uhid="UHID-2026-0003",
        blood_group="A+ve",
        allergies="None"
    )
    # Patient 4: Also booked with Absent doctor Dr. Sneha Reddy
    p4 = User(
        id="USR-PAT-04",
        role="PATIENT",
        org_id=None,
        name="Ananya Sharma",
        phone="+91-9848099004",
        email="ananya.sharma@patient.in",
        password_hash=default_pw,
        uhid="UHID-2026-0004",
        blood_group="AB+ve",
        allergies="Sulfa drugs"
    )
    # Patient 5: Visakhapatnam resident
    p5 = User(
        id="USR-PAT-05",
        role="PATIENT",
        org_id=None,
        name="Suresh Verma",
        phone="+91-9848099005",
        email="suresh.verma@patient.in",
        password_hash=default_pw,
        uhid="UHID-2026-0005",
        blood_group="O+ve",
        allergies="None"
    )
    # Patient 6: Vijayawada resident
    p6 = User(
        id="USR-PAT-06",
        role="PATIENT",
        org_id=None,
        name="Pooja Reddy",
        phone="+91-9848099006",
        email="pooja.reddy@patient.in",
        password_hash=default_pw,
        uhid="UHID-2026-0006",
        blood_group="A+ve",
        allergies="Aspirin allergy"
    )
    # Patient 7: Guntur resident
    p7 = User(
        id="USR-PAT-07",
        role="PATIENT",
        org_id=None,
        name="M. Gangadhar",
        phone="+91-9848099007",
        email="gangadhar@patient.in",
        password_hash=default_pw,
        uhid="UHID-2026-0007",
        blood_group="B-ve",
        allergies="None"
    )

    db.add_all([p1, p2, p3, p4, p5, p6, p7])

    # Seed Patient Records for P1 and P2
    p1_record = PatientRecord(
        id="REC-P1-001",
        patient_uhid="UHID-2026-0001",
        uploaded_by_role="DOCTOR",
        doctor_id=doc_a1.id,
        hospital_id="HOSP-A",
        report_type="PAST_HISTORY",
        title="Previous Emergency Trauma Baseline & Blood Compatibility",
        clinical_notes="Patient has rare O-negative blood group. History of severe road accident 2 years ago. Penicillin allergy confirmed.",
        ai_summary_text="Patient requires universal O-negative blood donor match. Strict contraindication for penicillin-derived antibiotics.",
        prescribed_medicines_json=[],
        created_at=datetime.datetime.utcnow() - datetime.timedelta(days=120)
    )

    # P2: Active Prescription with remaining_days = 2
    p2_record = PatientRecord(
        id="REC-P2-001",
        patient_uhid="UHID-2026-0002",
        uploaded_by_role="DOCTOR",
        doctor_id=doc_a3.id,
        hospital_id="HOSP-A",
        report_type="PRESCRIPTION",
        title="Bacterial Bronchitis & Glycemic Management Plan",
        clinical_notes="Prescribed Augmentin 625mg twice daily for 5 days. Glycomet 500mg daily. Only 2 days remaining on active batch.",
        ai_summary_text="Active antibiotic and diabetes therapy in progress. Current batch expires in 2 days. Restock required before weekend clinic closure.",
        prescribed_medicines_json=[
            {
                "brand_name": "Augmentin 625",
                "generic_salt": "Amoxicillin + Clavulanic Acid 625mg",
                "dosage": "1 tablet twice daily after meals (1-0-1)",
                "duration_days": 5,
                "remaining_days": 2  # LOW REFILL TRIGGER!
            },
            {
                "brand_name": "Glycomet 500",
                "generic_salt": "Metformin Hydrochloride 500mg",
                "dosage": "1 tablet before breakfast (1-0-0)",
                "duration_days": 30,
                "remaining_days": 2  # LOW REFILL TRIGGER!
            }
        ],
        created_at=datetime.datetime.utcnow() - datetime.timedelta(days=3)
    )

    db.add_all([p1_record, p2_record])

    # Seed Appointments for Patient 3 & 4 with Absent Doctor (Dr. Sneha Reddy)
    appt_p3 = AppointmentAndTriage(
        id="APT-FLAGGED-01",
        patient_uhid="UHID-2026-0003",
        hospital_id="HOSP-A",
        doctor_id=doc_a2.id, # Dr. Sneha Reddy (ABSENT)
        booking_type="MANUAL_TABLE",
        severity_level="MODERATE",
        symptoms="Chronic migraine headaches with visual aura. Scheduled consultation.",
        status="RESCHEDULE_REQUIRED", # FLAGGED FOR MANAGEMENT
        appointment_date=datetime.date.today().isoformat(),
        created_at=datetime.datetime.utcnow() - datetime.timedelta(hours=4)
    )

    appt_p4 = AppointmentAndTriage(
        id="APT-FLAGGED-02",
        patient_uhid="UHID-2026-0004",
        hospital_id="HOSP-A",
        doctor_id=doc_a2.id, # Dr. Sneha Reddy (ABSENT)
        booking_type="MANUAL_TABLE",
        severity_level="MODERATE",
        symptoms="Persistent tingling and numbness in right extremities. Neurological evaluation.",
        status="RESCHEDULE_REQUIRED", # FLAGGED FOR MANAGEMENT
        appointment_date=datetime.date.today().isoformat(),
        created_at=datetime.datetime.utcnow() - datetime.timedelta(hours=2)
    )

    # Also seed an active consultation for Patient 2 so they can test requesting generic substitution
    appt_p2 = AppointmentAndTriage(
        id="APT-P2-CONSULT",
        patient_uhid="UHID-2026-0002",
        hospital_id="HOSP-A",
        doctor_id=doc_a3.id, # Dr. Vikram Rao
        booking_type="AI_CALL",
        severity_level="MODERATE",
        symptoms="Chest congestion and cough follow-up. Wants cheaper generic medicines.",
        status="CONFIRMED",
        generic_request_status="NONE",
        appointment_date=datetime.date.today().isoformat(),
        created_at=datetime.datetime.utcnow() - datetime.timedelta(hours=1)
    )

    db.add_all([appt_p3, appt_p4, appt_p2])

    # ================= 5. MEDICAL STORES (8 PHARMACIES ACROSS CITIES) =================
    pharm1_user = User(
        id="USR-PHARM-01",
        role="PHARMACY",
        org_id="PHARM-01",
        name="Sanjeevani MedPlus (Dwaraka Nagar)",
        phone="+91-9848033001",
        email="pharma1@arogyaflow.gov.in",
        password_hash=default_pw
    )
    pharm2_user = User(
        id="USR-PHARM-02",
        role="PHARMACY",
        org_id="PHARM-02",
        name="Apollo Pharmacy (Siripuram Junction)",
        phone="+91-9848033002",
        email="pharma2@arogyaflow.gov.in",
        password_hash=default_pw
    )
    pharm3_user = User(
        id="USR-PHARM-03",
        role="PHARMACY",
        org_id="PHARM-03",
        name="Jan Aushadhi Kendra (MVP Colony)",
        phone="+91-9848033003",
        email="pharma3@arogyaflow.gov.in",
        password_hash=default_pw
    )
    pharm4_user = User(
        id="USR-PHARM-04",
        role="PHARMACY",
        org_id="PHARM-04",
        name="Sri Balaji Medicals (Gajuwaka)",
        phone="+91-9848033004",
        email="pharma4@arogyaflow.gov.in",
        password_hash=default_pw
    )
    pharm5_user = User(
        id="USR-PHARM-05",
        role="PHARMACY",
        org_id="PHARM-05",
        name="Care 24/7 Night Pharmacy (Maharanipeta)",
        phone="+91-9848033005",
        email="pharma5@arogyaflow.gov.in",
        password_hash=default_pw
    )
    pharm6_user = User(
        id="USR-PHARM-06",
        role="PHARMACY",
        org_id="PHARM-06",
        name="Krishna Valley Medico (MG Road)",
        phone="+91-9848033006",
        email="pharma.vja@arogyaflow.gov.in",
        password_hash=default_pw
    )
    pharm7_user = User(
        id="USR-PHARM-07",
        role="PHARMACY",
        org_id="PHARM-07",
        name="Amaravati Wellness Chemist (Besant Road)",
        phone="+91-9848033007",
        email="pharma.ama@arogyaflow.gov.in",
        password_hash=default_pw
    )
    pharm8_user = User(
        id="USR-PHARM-08",
        role="PHARMACY",
        org_id="PHARM-08",
        name="Andhra Life Meds (Kothapet)",
        phone="+91-9848033008",
        email="pharma.gtr@arogyaflow.gov.in",
        password_hash=default_pw
    )
    db.add_all([
        pharm1_user, pharm2_user, pharm3_user, pharm4_user,
        pharm5_user, pharm6_user, pharm7_user, pharm8_user
    ])

    # Multi-vendor pricing across cities & popular medicine categories
    pharmacy_inventory = [
        # --- Visakhapatnam Stores ---
        # 1. Sanjeevani MedPlus (Dwaraka Nagar)
        PharmacyStock(id="STK-01", pharmacy_id="PHARM-01", store_name="Sanjeevani MedPlus (Dwaraka Nagar)", city="Visakhapatnam", gps_lat=17.7260, gps_lng=83.3100, closing_time="22:00", medicine_brand="Augmentin 625 Duo", generic_salt_name="Amoxicillin + Clavulanic Acid 625mg", price=145.00, expiry_date="2027-08-31", stock_qty=45),
        PharmacyStock(id="STK-02", pharmacy_id="PHARM-01", store_name="Sanjeevani MedPlus (Dwaraka Nagar)", city="Visakhapatnam", gps_lat=17.7260, gps_lng=83.3100, closing_time="22:00", medicine_brand="Dolo 650", generic_salt_name="Paracetamol 650mg", price=32.00, expiry_date="2027-10-31", stock_qty=120),
        PharmacyStock(id="STK-07", pharmacy_id="PHARM-01", store_name="Sanjeevani MedPlus (Dwaraka Nagar)", city="Visakhapatnam", gps_lat=17.7260, gps_lng=83.3100, closing_time="22:00", medicine_brand="Pan 40", generic_salt_name="Pantoprazole 40mg", price=88.00, expiry_date="2027-09-30", stock_qty=60),
        PharmacyStock(id="STK-08", pharmacy_id="PHARM-01", store_name="Sanjeevani MedPlus (Dwaraka Nagar)", city="Visakhapatnam", gps_lat=17.7260, gps_lng=83.3100, closing_time="22:00", medicine_brand="Glycomet 500", generic_salt_name="Metformin Hydrochloride 500mg", price=42.00, expiry_date="2028-01-15", stock_qty=95),
        PharmacyStock(id="STK-09", pharmacy_id="PHARM-01", store_name="Sanjeevani MedPlus (Dwaraka Nagar)", city="Visakhapatnam", gps_lat=17.7260, gps_lng=83.3100, closing_time="22:00", medicine_brand="Azithral 500", generic_salt_name="Azithromycin 500mg", price=118.00, expiry_date="2027-04-30", stock_qty=30),

        # 2. Apollo Pharmacy (Siripuram Junction)
        PharmacyStock(id="STK-03", pharmacy_id="PHARM-02", store_name="Apollo Pharmacy (Siripuram Junction)", city="Visakhapatnam", gps_lat=17.7200, gps_lng=83.3210, closing_time="23:00", medicine_brand="Clavam 625", generic_salt_name="Amoxicillin + Clavulanic Acid 625mg", price=138.50, expiry_date="2027-05-31", stock_qty=80),
        PharmacyStock(id="STK-04", pharmacy_id="PHARM-02", store_name="Apollo Pharmacy (Siripuram Junction)", city="Visakhapatnam", gps_lat=17.7200, gps_lng=83.3210, closing_time="23:00", medicine_brand="Calpol 650", generic_salt_name="Paracetamol 650mg", price=30.00, expiry_date="2027-12-31", stock_qty=150),
        PharmacyStock(id="STK-10", pharmacy_id="PHARM-02", store_name="Apollo Pharmacy (Siripuram Junction)", city="Visakhapatnam", gps_lat=17.7200, gps_lng=83.3210, closing_time="23:00", medicine_brand="Pantocid 40", generic_salt_name="Pantoprazole 40mg", price=84.00, expiry_date="2027-11-30", stock_qty=75),
        PharmacyStock(id="STK-11", pharmacy_id="PHARM-02", store_name="Apollo Pharmacy (Siripuram Junction)", city="Visakhapatnam", gps_lat=17.7200, gps_lng=83.3210, closing_time="23:00", medicine_brand="Telma 40", generic_salt_name="Telmisartan 40mg", price=72.00, expiry_date="2027-07-31", stock_qty=50),
        PharmacyStock(id="STK-12", pharmacy_id="PHARM-02", store_name="Apollo Pharmacy (Siripuram Junction)", city="Visakhapatnam", gps_lat=17.7200, gps_lng=83.3210, closing_time="23:00", medicine_brand="Montair LC", generic_salt_name="Montelukast + Levocetirizine", price=165.00, expiry_date="2027-03-31", stock_qty=40),

        # 3. Jan Aushadhi Kendra (MVP Colony - Affordable Generic)
        PharmacyStock(id="STK-05", pharmacy_id="PHARM-03", store_name="Jan Aushadhi Kendra (MVP Colony)", city="Visakhapatnam", gps_lat=17.7400, gps_lng=83.3320, closing_time="20:30", medicine_brand="Generic Amoxi-Clav 625", generic_salt_name="Amoxicillin + Clavulanic Acid 625mg", price=65.00, expiry_date="2026-11-30", stock_qty=15),
        PharmacyStock(id="STK-06", pharmacy_id="PHARM-03", store_name="Jan Aushadhi Kendra (MVP Colony)", city="Visakhapatnam", gps_lat=17.7400, gps_lng=83.3320, closing_time="20:30", medicine_brand="Generic Paracetamol 650", generic_salt_name="Paracetamol 650mg", price=12.00, expiry_date="2027-02-28", stock_qty=200),
        PharmacyStock(id="STK-13", pharmacy_id="PHARM-03", store_name="Jan Aushadhi Kendra (MVP Colony)", city="Visakhapatnam", gps_lat=17.7400, gps_lng=83.3320, closing_time="20:30", medicine_brand="Generic Pantoprazole 40", generic_salt_name="Pantoprazole 40mg", price=24.00, expiry_date="2027-06-30", stock_qty=110),
        PharmacyStock(id="STK-14", pharmacy_id="PHARM-03", store_name="Jan Aushadhi Kendra (MVP Colony)", city="Visakhapatnam", gps_lat=17.7400, gps_lng=83.3320, closing_time="20:30", medicine_brand="Generic Metformin 500", generic_salt_name="Metformin Hydrochloride 500mg", price=15.00, expiry_date="2027-10-31", stock_qty=180),
        PharmacyStock(id="STK-15", pharmacy_id="PHARM-03", store_name="Jan Aushadhi Kendra (MVP Colony)", city="Visakhapatnam", gps_lat=17.7400, gps_lng=83.3320, closing_time="20:30", medicine_brand="Shelcal 500 Generic", generic_salt_name="Calcium + Vitamin D3", price=35.00, expiry_date="2028-02-28", stock_qty=90),

        # 4. Sri Balaji Medicals (Gajuwaka)
        PharmacyStock(id="STK-16", pharmacy_id="PHARM-04", store_name="Sri Balaji Medicals (Gajuwaka)", city="Visakhapatnam", gps_lat=17.6900, gps_lng=83.2100, closing_time="22:30", medicine_brand="Augmentin 625 Duo", generic_salt_name="Amoxicillin + Clavulanic Acid 625mg", price=142.00, expiry_date="2027-09-30", stock_qty=35),
        PharmacyStock(id="STK-17", pharmacy_id="PHARM-04", store_name="Sri Balaji Medicals (Gajuwaka)", city="Visakhapatnam", gps_lat=17.6900, gps_lng=83.2100, closing_time="22:30", medicine_brand="Dolo 650", generic_salt_name="Paracetamol 650mg", price=31.50, expiry_date="2027-11-30", stock_qty=85),
        PharmacyStock(id="STK-18", pharmacy_id="PHARM-04", store_name="Sri Balaji Medicals (Gajuwaka)", city="Visakhapatnam", gps_lat=17.6900, gps_lng=83.2100, closing_time="22:30", medicine_brand="Atorva 10", generic_salt_name="Atorvastatin 10mg", price=95.00, expiry_date="2027-08-31", stock_qty=40),

        # 5. Care 24/7 Night Pharmacy (Maharanipeta - Open All Night)
        PharmacyStock(id="STK-19", pharmacy_id="PHARM-05", store_name="Care 24/7 Night Pharmacy (Maharanipeta)", city="Visakhapatnam", gps_lat=17.7120, gps_lng=83.3080, closing_time="24 Hours Open", medicine_brand="Augmentin 625 Duo", generic_salt_name="Amoxicillin + Clavulanic Acid 625mg", price=149.00, expiry_date="2027-12-31", stock_qty=100),
        PharmacyStock(id="STK-20", pharmacy_id="PHARM-05", store_name="Care 24/7 Night Pharmacy (Maharanipeta)", city="Visakhapatnam", gps_lat=17.7120, gps_lng=83.3080, closing_time="24 Hours Open", medicine_brand="Dolo 650", generic_salt_name="Paracetamol 650mg", price=33.00, expiry_date="2027-12-31", stock_qty=250),
        PharmacyStock(id="STK-21", pharmacy_id="PHARM-05", store_name="Care 24/7 Night Pharmacy (Maharanipeta)", city="Visakhapatnam", gps_lat=17.7120, gps_lng=83.3080, closing_time="24 Hours Open", medicine_brand="Human Actrapid 40IU", generic_salt_name="Regular Soluble Insulin 40IU", price=162.00, expiry_date="2026-12-31", stock_qty=25),

        # --- Vijayawada Stores ---
        # 6. Krishna Valley Medico (MG Road, Vijayawada)
        PharmacyStock(id="STK-22", pharmacy_id="PHARM-06", store_name="Krishna Valley Medico (MG Road)", city="Vijayawada", gps_lat=16.5062, gps_lng=80.6480, closing_time="22:30", medicine_brand="Augmentin 625 Duo", generic_salt_name="Amoxicillin + Clavulanic Acid 625mg", price=144.00, expiry_date="2027-07-31", stock_qty=60),
        PharmacyStock(id="STK-23", pharmacy_id="PHARM-06", store_name="Krishna Valley Medico (MG Road)", city="Vijayawada", gps_lat=16.5062, gps_lng=80.6480, closing_time="22:30", medicine_brand="Dolo 650", generic_salt_name="Paracetamol 650mg", price=31.00, expiry_date="2027-09-30", stock_qty=140),
        PharmacyStock(id="STK-24", pharmacy_id="PHARM-06", store_name="Krishna Valley Medico (MG Road)", city="Vijayawada", gps_lat=16.5062, gps_lng=80.6480, closing_time="22:30", medicine_brand="Pan 40", generic_salt_name="Pantoprazole 40mg", price=86.00, expiry_date="2027-08-31", stock_qty=80),
        PharmacyStock(id="STK-25", pharmacy_id="PHARM-06", store_name="Krishna Valley Medico (MG Road)", city="Vijayawada", gps_lat=16.5062, gps_lng=80.6480, closing_time="22:30", medicine_brand="Telma 40", generic_salt_name="Telmisartan 40mg", price=70.00, expiry_date="2027-10-31", stock_qty=55),

        # 7. Amaravati Wellness Chemist (Besant Road, Vijayawada)
        PharmacyStock(id="STK-26", pharmacy_id="PHARM-07", store_name="Amaravati Wellness Chemist (Besant Road)", city="Vijayawada", gps_lat=16.5120, gps_lng=80.6250, closing_time="21:30", medicine_brand="Clavam 625", generic_salt_name="Amoxicillin + Clavulanic Acid 625mg", price=136.00, expiry_date="2027-06-30", stock_qty=70),
        PharmacyStock(id="STK-27", pharmacy_id="PHARM-07", store_name="Amaravati Wellness Chemist (Besant Road)", city="Vijayawada", gps_lat=16.5120, gps_lng=80.6250, closing_time="21:30", medicine_brand="Calpol 650", generic_salt_name="Paracetamol 650mg", price=29.50, expiry_date="2027-11-30", stock_qty=110),
        PharmacyStock(id="STK-28", pharmacy_id="PHARM-07", store_name="Amaravati Wellness Chemist (Besant Road)", city="Vijayawada", gps_lat=16.5120, gps_lng=80.6250, closing_time="21:30", medicine_brand="Azithral 500", generic_salt_name="Azithromycin 500mg", price=115.00, expiry_date="2027-05-31", stock_qty=45),

        # --- Guntur Stores ---
        # 8. Andhra Life Meds (Kothapet, Guntur)
        PharmacyStock(id="STK-29", pharmacy_id="PHARM-08", store_name="Andhra Life Meds (Kothapet)", city="Guntur", gps_lat=16.3067, gps_lng=80.4365, closing_time="22:00", medicine_brand="Augmentin 625 Duo", generic_salt_name="Amoxicillin + Clavulanic Acid 625mg", price=143.00, expiry_date="2027-09-30", stock_qty=50),
        PharmacyStock(id="STK-30", pharmacy_id="PHARM-08", store_name="Andhra Life Meds (Kothapet)", city="Guntur", gps_lat=16.3067, gps_lng=80.4365, closing_time="22:00", medicine_brand="Dolo 650", generic_salt_name="Paracetamol 650mg", price=31.00, expiry_date="2027-10-31", stock_qty=130),
        PharmacyStock(id="STK-31", pharmacy_id="PHARM-08", store_name="Andhra Life Meds (Kothapet)", city="Guntur", gps_lat=16.3067, gps_lng=80.4365, closing_time="22:00", medicine_brand="Pan 40", generic_salt_name="Pantoprazole 40mg", price=85.00, expiry_date="2027-12-31", stock_qty=65),
        PharmacyStock(id="STK-32", pharmacy_id="PHARM-08", store_name="Andhra Life Meds (Kothapet)", city="Guntur", gps_lat=16.3067, gps_lng=80.4365, closing_time="22:00", medicine_brand="Glycomet 500", generic_salt_name="Metformin Hydrochloride 500mg", price=40.00, expiry_date="2028-02-15", stock_qty=85),
    ]
    db.add_all(pharmacy_inventory)

    # ================= 6. BLOOD BANKS (2 EXTERNAL BLOOD BANKS) =================
    bb1_user = User(
        id="USR-BB-01",
        role="BLOOD_BANK",
        org_id="BB-01",
        name="Rotary Blood Bank & Component Center",
        phone="+91-9848044001",
        email="rotary.bb@arogyaflow.gov.in",
        password_hash=default_pw
    )
    bb2_user = User(
        id="USR-BB-02",
        role="BLOOD_BANK",
        org_id="BB-02",
        name="Red Cross Society Blood Center (Beach Road)",
        phone="+91-9848044002",
        email="redcross.bb@arogyaflow.gov.in",
        password_hash=default_pw
    )
    db.add_all([bb1_user, bb2_user])

    bb_stocks = [
        # Rotary Blood Bank
        BloodBankStock(
            id="BBS-01",
            blood_bank_id="BB-01",
            bank_name="Rotary Blood Bank & Component Center",
            city="Visakhapatnam",
            gps_lat=17.7280,
            gps_lng=83.3120,
            blood_group="O-ve",
            live_units_available=6,  # Live units available for auto-escalation!
            registered_donors_list=[
                {"name": "M. Suresh", "phone": "+91-9848112233", "blood_group": "O-ve"},
                {"name": "K. Nagesh", "phone": "+91-9848112234", "blood_group": "O-ve"},
                {"name": "P. Swamy", "phone": "+91-9848112235", "blood_group": "O-ve"}
            ]
        ),
        BloodBankStock(
            id="BBS-02",
            blood_bank_id="BB-01",
            bank_name="Rotary Blood Bank & Component Center",
            city="Visakhapatnam",
            gps_lat=17.7280,
            gps_lng=83.3120,
            blood_group="A+ve",
            live_units_available=14,
            registered_donors_list=[
                {"name": "T. Ramana", "phone": "+91-9848112236", "blood_group": "A+ve"}
            ]
        ),
        BloodBankStock(
            id="BBS-03",
            blood_bank_id="BB-01",
            bank_name="Rotary Blood Bank & Component Center",
            city="Visakhapatnam",
            gps_lat=17.7280,
            gps_lng=83.3120,
            blood_group="B+ve",
            live_units_available=18,
            registered_donors_list=[]
        ),
        # Red Cross Blood Center
        BloodBankStock(
            id="BBS-04",
            blood_bank_id="BB-02",
            bank_name="Red Cross Society Blood Center (Beach Road)",
            city="Visakhapatnam",
            gps_lat=17.7100,
            gps_lng=83.3250,
            blood_group="O-ve",
            live_units_available=4,
            registered_donors_list=[
                {"name": "B. Satyanarayana", "phone": "+91-9848223344", "blood_group": "O-ve"},
                {"name": "S. Venkat", "phone": "+91-9848223345", "blood_group": "O-ve"}
            ]
        ),
        BloodBankStock(
            id="BBS-05",
            blood_bank_id="BB-02",
            bank_name="Red Cross Society Blood Center (Beach Road)",
            city="Visakhapatnam",
            gps_lat=17.7100,
            gps_lng=83.3250,
            blood_group="O+ve",
            live_units_available=22,
            registered_donors_list=[]
        )
    ]
    db.add_all(bb_stocks)

    db.commit()
    db.close()
    print("✅ Database seeding complete! All 8 roles, 3 hospitals, 4 patients, 3 pharmacies, and 2 blood banks seeded successfully.")

if __name__ == "__main__":
    seed_database()
