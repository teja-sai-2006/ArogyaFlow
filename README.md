# 🏥 ArogyaFlow (ఆరోగ్యఫ్లో)
### Modular Monolith Integrated Healthcare, Emergency Triage & Resource Management Platform

*Built with Python FastAPI, WebSockets, SQLite / PostgreSQL, React 18, Vite, TypeScript, and Tailwind CSS.*

---

## 🌟 Key Features & Closed-Loop Integrations

ArogyaFlow resolves the critical cross-portal disconnects in public healthcare systems by uniting **8 distinct roles** on a reactive event-driven WebSocket layer:

1. **One-Tap Emergency SOS Pre-Arrival Chain (Zero Manual Steps)**:
   - Patient hits SOS $\rightarrow$ bundles GPS, blood type, and vault records.
   - Nearest Multi-Specialty hospital checked for ICU beds. If beds = 0 $\rightarrow$ automatically cascades to Hospital B.
   - Checks hospital internal blood stock $\rightarrow$ if 0, auto-escalates to Rotary Blood Bank and reserves a live unit before ambulance arrives.
2. **Attendance-to-Public-Availability Dynamic Re-routing**:
   - Hospital Admin marks a Doctor *Absent* $\rightarrow$ Doctor immediately disappears from Patient "Table" Discovery.
   - Existing appointments for today are automatically flagged as `RESCHEDULE_REQUIRED` with high-priority alerts pushed to Hospital Management.
   - Management reassigns those patients to another present specialist in 1 click.
3. **Closed-Loop Generic Medicine Replacement & Vendor Price Comparison**:
   - Doctor writes prescription with brand name and generic chemical salt composition.
   - Patient clicks "Request Generic Alternative" $\rightarrow$ Doctor approves in 1 click.
   - Prescription updates and unlocks the Multi-Pharmacy Price Comparison Table, ranking nearby medical stores (e.g. Jan Aushadhi Kendra, Sanjeevani MedPlus, Apollo Pharmacy) by lowest price.
4. **Smart Medicine Analyzer (Nameless / Cut Strips)**:
   - Blister pack / cut-strip OCR analysis.
   - If brand name is torn or unreadable, the AI cross-references the fragment with the patient's own past prescription history on file.
5. **"When to Take Medicines" Refill Tracker & Early-Closing Offline SMS**:
   - Tracks remaining days of active medication batches.
   - When Super Admin triggers a Regional Disaster Alert OR local pharmacies broadcast early closing, automated offline SMS alerts are dispatched to patients whose medicine runs out in $\le 3$ days.
6. **Disaster Patient Evacuation (Inter-Hospital Sync)**:
   - Hospital Management evacuates critical patients from Danger Zone (Hospital A) to Safe Zone (Hospital B).
   - Clones patient charts, doctor notes, and diagnostic scans, generating an active UHID consent token for Hospital B.
7. **Diagnostic Lab Scan Dual-Sync**:
   - Doctor orders X-Ray or blood test $\rightarrow$ appears on Lab Technician worklist.
   - Lab Tech uploads scan and findings $\rightarrow$ triggers Gemini AI plain-language summary and immediately dual-syncs to Doctor and Patient Vaults.

---

## 🚀 Quick Startup Commands

### 1. Start the FastAPI Backend
```bash
cd backend
./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
* Backend runs at: `http://localhost:8000`
* Interactive OpenAPI Docs: `http://localhost:8000/docs`
* Real-time WebSocket: `ws://localhost:8000/ws`

### 2. Start the React Frontend
```bash
cd frontend
npm run dev
```
* Web Application runs at: `http://localhost:5173`

### 3. Run Automated End-to-End Test Suite
```bash
cd backend
./venv/bin/python test_e2e_workflows.py
```

---

## 👥 Seeded Demo Login Credentials (All 8 Roles)

> **Universal Password for all accounts**: `pass123`  
> *(You can also use the **1-Click Quick Demo Role Switcher** in the top navigation bar to switch between any user instantly!)*

| Role | Name | Email | Organization / Hospital |
|---|---|---|---|
| **Super Admin** | Dr. K. Somasekhar | `superadmin@arogyaflow.gov.in` | National Health Command |
| **Hospital Admin (A)** | V. S. Murthy | `admin.hospa@arogyaflow.gov.in` | Apollo Speciality (HOSP-A) |
| **Hospital Mgmt (A)** | Sravani Rao | `mgmt1.hospa@arogyaflow.gov.in` | Apollo Speciality (HOSP-A) |
| **Doctor (Cardiology)** | Dr. Rajesh Varma | `dr.rajesh@apollo.arogyaflow.in` | Apollo Speciality (Present) |
| **Doctor (Neurology)** | Dr. Sneha Reddy | `dr.sneha@apollo.arogyaflow.in` | Apollo Speciality (Absent) |
| **Doctor (Gen Med)** | Dr. Vikram Rao | `dr.vikram@apollo.arogyaflow.in` | Apollo Speciality (Present) |
| **Doctor (Orthopedics)**| Dr. Priya Nair | `dr.priya@apollo.arogyaflow.in` | Apollo Speciality (Present) |
| **Lab Technician (A)** | G. Praveen | `lab1.hospa@arogyaflow.gov.in` | Apollo Speciality (HOSP-A) |
| **Hospital Admin (B)** | T. Chandrasekhar | `admin.hospb@arogyaflow.gov.in` | Care Super Speciality (Safe Zone) |
| **Hospital Mgmt (B)** | Madhavi Latha | `mgmt.hospb@arogyaflow.gov.in` | Care Super Speciality (Safe Zone) |
| **Patient 1 (Trauma SOS)**| Kiran Kumar | `kiran.kumar@patient.in` | UHID-2026-0001 (O-ve) |
| **Patient 2 (Low Refill)**| Lakshmi Devi | `lakshmi.devi@patient.in` | UHID-2026-0002 (B+ve) |
| **Patient 3 (Reschedule)**| Venkatesh Rao | `venkatesh.rao@patient.in` | UHID-2026-0003 (A+ve) |
| **Patient 4 (Reschedule)**| Ananya Sharma | `ananya.sharma@patient.in` | UHID-2026-0004 (AB+ve) |
| **Pharmacy 1** | Sanjeevani MedPlus | `pharma1@arogyaflow.gov.in` | Dwaraka Nagar |
| **Pharmacy 2** | Apollo Pharmacy | `pharma2@arogyaflow.gov.in` | Siripuram Junction |
| **Pharmacy 3** | Jan Aushadhi Kendra | `pharma3@arogyaflow.gov.in` | MVP Colony (Affordable Generic) |
| **Blood Bank 1** | Rotary Blood Bank | `rotary.bb@arogyaflow.gov.in` | Visakhapatnam Hub |
| **Blood Bank 2** | Red Cross Society | `redcross.bb@arogyaflow.gov.in` | Beach Road Center |
