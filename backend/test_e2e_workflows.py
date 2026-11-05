import sys
import os
import unittest
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
from database import SessionLocal
from models import User, Hospital, HospitalStaffStatus, AppointmentAndTriage, PharmacyStock, BloodBankStock

client = TestClient(app)

class TestArogyaFlowE2E(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tokens = {}
        # Test accounts for all 8 roles
        cls.accounts = {
            "SUPER_ADMIN": ("superadmin@arogyaflow.gov.in", "pass123"),
            "HOSP_ADMIN": ("admin.hospa@arogyaflow.gov.in", "pass123"),
            "HOSP_MGMT": ("mgmt1.hospa@arogyaflow.gov.in", "pass123"),
            "DOCTOR": ("dr.rajesh@apollo.arogyaflow.in", "pass123"),
            "LAB_TECH": ("lab1.hospa@arogyaflow.gov.in", "pass123"),
            "BLOOD_BANK": ("rotary.bb@arogyaflow.gov.in", "pass123"),
            "PHARMACY": ("pharma1@arogyaflow.gov.in", "pass123"),
            "PATIENT": ("kiran.kumar@patient.in", "pass123"),
        }

    def get_auth_header(self, role):
        if role in self.tokens:
            return {"Authorization": f"Bearer {self.tokens[role]}"}
        email, pw = self.accounts[role]
        res = client.post("/api/auth/login", json={"email": email, "password": pw})
        self.assertEqual(res.status_code, 200, f"Login failed for {role}")
        token = res.json()["access_token"]
        self.tokens[role] = token
        return {"Authorization": f"Bearer {token}"}

    def test_01_login_and_rbac_token_routing_all_8_roles(self):
        """1. Login & RBAC token routing for all 8 roles."""
        print("\n🧪 Test 1: Testing Login & RBAC Token Routing across all 8 roles...")
        for role in self.accounts.keys():
            headers = self.get_auth_header(role)
            me_res = client.get("/api/auth/me", headers=headers)
            self.assertEqual(me_res.status_code, 200)
            data = me_res.json()
            self.assertEqual(data["role"], role)
            print(f"  ✓ Role Verified: {role} -> User: {data['name']}")

    def test_02_doctor_attendance_rerouting_and_table_filter(self):
        """2. Hospital Admin marks Doctor Absent -> flags appointments and hides from Patient discovery."""
        print("\n🧪 Test 2: Hospital Admin Attendance Flip & Patient Table Hiding...")
        admin_headers = self.get_auth_header("HOSP_ADMIN")
        patient_headers = self.get_auth_header("PATIENT")

        # Toggle Dr. Rajesh Varma (STS-A1) to ABSENT
        toggle_res = client.patch(
            "/api/hospital-admin/attendance",
            json={"staff_id": "USR-DOC-A1", "is_present": False},
            headers=admin_headers
        )
        self.assertEqual(toggle_res.status_code, 200)
        self.assertFalse(toggle_res.json()["is_present_today"])
        print(f"  ✓ Hospital Admin toggled Dr. Rajesh Varma to ABSENT")

        # Verify Patient "Table" filter excludes Dr. Rajesh Varma
        table_res = client.post(
            "/api/patient/hospitals-table",
            json={"state": "Andhra Pradesh", "city": "Visakhapatnam", "specialist": "Cardiology"},
            headers=patient_headers
        )
        self.assertEqual(table_res.status_code, 200)
        hospitals = table_res.json()
        for h in hospitals:
            if h["hospital_id"] == "HOSP-A":
                # Ensure no absent doctor is listed
                doctor_names = [d["name"] for d in h["present_doctors"]]
                self.assertNotIn("Dr. Rajesh Varma", doctor_names)
        print("  ✓ Verified: Absent doctor is hidden from Patient Hospitals Table filter")

        # Toggle back to Present for remaining tests
        client.patch(
            "/api/hospital-admin/attendance",
            json={"staff_id": "USR-DOC-A1", "is_present": True},
            headers=admin_headers
        )

    def test_03_ai_triage_and_booking_with_consent_token(self):
        """3. Patient AI Triage, UHID Consent Token generation, and AI booking handoff."""
        print("\n🧪 Test 3: AI Triage, UHID Consent Token & Hospital Booking Handoff...")
        patient_headers = self.get_auth_header("PATIENT")

        # Run AI Triage for severe chest pain
        triage_res = client.post(
            "/api/patient/ai-triage",
            json={"symptoms": "Severe acute chest pain radiating to left arm and shortness of breath", "target_language": "en"},
            headers=patient_headers
        )
        self.assertEqual(triage_res.status_code, 200)
        triage_data = triage_res.json()
        self.assertEqual(triage_data["facility_type_recommended"], "MULTI_SPECIALTY")
        print(f"  ✓ AI Triage classified symptoms: Severity={triage_data['severity_level']}, Facility={triage_data['facility_type_recommended']}")

        # Patient books appointment with consent token sharing enabled
        book_res = client.post(
            "/api/patient/book-appointment",
            json={
                "hospital_id": "HOSP-A",
                "doctor_id": "USR-DOC-A1",
                "symptoms": "Acute chest pressure, needs ECG and Cardiology evaluation",
                "severity_level": "CRITICAL",
                "share_all_reports": True
            },
            headers=patient_headers
        )
        self.assertEqual(book_res.status_code, 200)
        book_data = book_res.json()
        self.assertIsNotNone(book_data["consent_token"])
        print(f"  ✓ Booking dispatched to Hospital Management with UHID Consent Token: {book_data['consent_token']}")

    def test_04_emergency_sos_cascade_and_blood_escalation(self):
        """4. Emergency SOS trigger -> bed check, cascade to Hospital B, auto-blood bank escalation."""
        print("\n🧪 Test 4: Emergency SOS Pre-Arrival Chain Reaction...")
        patient_headers = self.get_auth_header("PATIENT")

        # Patient 1 has blood group O-ve.
        # Hospital A has ICU beds = 0 and O-ve blood = 0.
        # Expected: Cascades to Hospital B (which has 10 ICU beds) and auto-escalates to Rotary Blood Bank!
        sos_res = client.post(
            "/api/patient/emergency-sos",
            json={
                "gps_lat": 17.7215,
                "gps_lng": 83.3150,
                "symptoms": "Massive trauma with heavy arterial bleeding"
            },
            headers=patient_headers
        )
        self.assertEqual(sos_res.status_code, 200)
        sos_data = sos_res.json()

        self.assertTrue(sos_data["cascade_triggered"], "Cascade should be triggered because Hosp A has 0 ICU beds")
        self.assertEqual(sos_data["assigned_hospital"]["id"], "HOSP-B", "Assigned hospital should cascade to Hospital B")
        self.assertTrue(sos_data["bed_locked"], "Bed should be locked at Hospital B")
        self.assertTrue(sos_data["blood_escalated"], "Blood escalation should be triggered because Hosp A had 0 O-ve units")
        print(f"  ✓ Cascade Verified: Primary={sos_data['primary_hospital']['name']} (0 ICU) -> Assigned={sos_data['assigned_hospital']['name']} (Bed Locked)")
        print(f"  ✓ Blood Escalation Verified: {sos_data['blood_status_message']}")

    def test_05_doctor_lab_order_and_lab_tech_dual_sync(self):
        """5. Doctor orders Lab Scan -> Lab Tech uploads report -> dual sync."""
        print("\n🧪 Test 5: Doctor Lab Order & Lab Technician Dual Sync...")
        doc_headers = self.get_auth_header("DOCTOR")
        lab_headers = self.get_auth_header("LAB_TECH")

        # Doctor orders chest X-Ray for Patient 1
        order_res = client.post(
            "/api/doctor/order-lab-test",
            json={
                "booking_id": "APT-P2-CONSULT",
                "patient_uhid": "UHID-2026-0001",
                "test_type": "Chest X-Ray PA View",
                "clinical_instructions": "Check for bilateral infiltrates or rib contusion"
            },
            headers=doc_headers
        )
        self.assertEqual(order_res.status_code, 200)
        order_id = order_res.json()["order_id"]
        print(f"  ✓ Doctor ordered lab test: Order ID={order_id}")

        # Lab Tech views worklist
        worklist_res = client.get("/api/lab-tech/worklist", headers=lab_headers)
        self.assertEqual(worklist_res.status_code, 200)
        pending_ids = [p["id"] for p in worklist_res.json()["pending"]]
        self.assertIn(order_id, pending_ids)
        print("  ✓ Order appeared in Lab Technician Diagnostic Worklist")

        # Lab Tech uploads scan report
        upload_res = client.post(
            "/api/lab-tech/upload-report",
            json={
                "order_id": order_id,
                "patient_uhid": "UHID-2026-0001",
                "test_title": "Chest X-Ray Digital Radiograph (Completed)",
                "file_url": "https://storage.arogyaflow.gov.in/scans/xray-p1-chest.png",
                "technician_notes": "Bilateral lung fields clear. No rib fractures or pneumothorax visible. Cardiac silhouette normal."
            },
            headers=lab_headers
        )
        self.assertEqual(upload_res.status_code, 200)
        upload_data = upload_res.json()
        self.assertIsNotNone(upload_data["ai_summary"])
        print(f"  ✓ Lab Tech uploaded report with AI summary: {upload_data['ai_summary']}")

    def test_06_generic_medicine_replacement_and_vendor_comparison(self):
        """6. Patient requests Generic -> Doctor approves -> Patient gets 3-pharmacy comparison table."""
        print("\n🧪 Test 6: Generic Medicine Replacement Pipeline & Multi-Pharmacy Table...")
        # Login as Patient 2 (Lakshmi Devi, who has active Augmentin prescription)
        p2_login = client.post("/api/auth/login", json={"email": "lakshmi.devi@patient.in", "password": "pass123"})
        p2_headers = {"Authorization": f"Bearer {p2_login.json()['access_token']}"}
        doc_headers = self.get_auth_header("DOCTOR")

        # 1. Patient requests generic alternative
        req_res = client.post(
            "/api/patient/request-generic",
            json={
                "booking_id": "APT-P2-CONSULT",
                "brand_name": "Augmentin 625",
                "generic_salt": "Amoxicillin + Clavulanic Acid 625mg"
            },
            headers=p2_headers
        )
        self.assertEqual(req_res.status_code, 200)
        print("  ✓ Patient requested generic replacement for Augmentin 625")

        # 2. Doctor approves generic replacement
        appr_res = client.post(
            "/api/doctor/approve-generic",
            json={
                "booking_id": "APT-P2-CONSULT",
                "approved": True,
                "notes": "Approved for equivalent generic salt formulation"
            },
            headers=doc_headers
        )
        self.assertEqual(appr_res.status_code, 200)
        self.assertEqual(appr_res.json()["generic_request_status"], "APPROVED")
        print("  ✓ Doctor approved generic replacement")

        # 3. Patient queries Vendor Comparison Table for Amoxicillin + Clavulanic Acid
        comp_res = client.get(
            "/api/patient/generic-comparison/Amoxicillin",
            headers=p2_headers
        )
        self.assertEqual(comp_res.status_code, 200)
        comp_data = comp_res.json()
        self.assertGreaterEqual(len(comp_data["comparison_table"]), 3, "Should return at least 3 pharmacy vendors")
        cheapest_store = comp_data["comparison_table"][0]
        print(f"  ✓ Vendor Comparison Table populated with {len(comp_data['comparison_table'])} pharmacies")
        print(f"  ✓ Lowest Price: ₹{cheapest_store['price']} at {cheapest_store['store_name']} ({cheapest_store['medicine_brand']})")

    def test_07_disaster_alert_transfer_and_offline_sms(self):
        """7. Super Admin triggers Disaster Alert -> Hospital A transfers patient to Hospital B + offline SMS."""
        print("\n🧪 Test 7: Regional Disaster Alert, Inter-Hospital Transfer & Offline SMS...")
        super_headers = self.get_auth_header("SUPER_ADMIN")
        mgmt_headers = self.get_auth_header("HOSP_MGMT")

        # Super Admin triggers disaster alert in Visakhapatnam
        disaster_res = client.post(
            "/api/super-admin/disaster-alert",
            json={
                "affected_city": "Visakhapatnam",
                "alert_title": "Severe Cyclone Alert (Coastal Red Zone)",
                "severity": "CRITICAL",
                "danger_zone_hospital_ids": ["HOSP-A"]
            },
            headers=super_headers
        )
        self.assertEqual(disaster_res.status_code, 200)
        disaster_data = disaster_res.json()
        print(f"  ✓ Super Admin broadcasted Disaster Alert: {disaster_data['details']['alert_title']}")
        print(f"  ✓ Offline SMS triggered for low-refill patients: {disaster_data['details']['sms_broadcast_count']} alerts sent")

        # Hospital A Management initiates Disaster Transfer of Patient 1 to Safe-Zone Hospital B
        transfer_res = client.post(
            "/api/hospital-mgmt/disaster-transfer",
            json={
                "target_hospital_id": "HOSP-B",
                "patient_uhids": ["UHID-2026-0001"],
                "notes": "Emergency coastal evacuation under cyclone protocol"
            },
            headers=mgmt_headers
        )
        self.assertEqual(transfer_res.status_code, 200)
        transfer_data = transfer_res.json()
        self.assertEqual(transfer_data["transferred_count"], 1)
        transferred_info = transfer_data["transfer_details"]["patients"][0]
        self.assertIsNotNone(transferred_info["consent_token"])
        print(f"  ✓ Patient 1 chart, records, and consent token cloned to Care Hospital B: Token={transferred_info['consent_token']}")

if __name__ == "__main__":
    unittest.main()
