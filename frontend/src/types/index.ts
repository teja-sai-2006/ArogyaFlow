export type UserRole =
  | 'SUPER_ADMIN'
  | 'HOSP_ADMIN'
  | 'HOSP_MGMT'
  | 'DOCTOR'
  | 'LAB_TECH'
  | 'BLOOD_BANK'
  | 'PHARMACY'
  | 'PATIENT';

export interface UserProfile {
  id: string;
  role: UserRole;
  org_id?: string | null;
  org_name?: string | null;
  uhid?: string | null;
  name: string;
  email: string;
  phone: string;
  blood_group?: string | null;
  allergies?: string | null;
}

export interface DemoUser {
  id: string;
  name: string;
  role: UserRole;
  org_id?: string | null;
  uhid?: string | null;
  email: string;
  blood_group?: string | null;
}

export interface HospitalInfo {
  id: string;
  name: string;
  type: string;
  city: string;
  icu_beds: number;
  general_beds: number;
  equipment: string[];
  internal_blood_stock?: Record<string, number>;
  is_safe_zone?: boolean;
}

export interface PresentDoctor {
  doctor_id: string;
  name: string;
  specialty: string;
  is_present: boolean;
}

export interface HospitalTableItem extends HospitalInfo {
  present_doctors: PresentDoctor[];
}

export interface AppointmentQueueItem {
  booking_id: string;
  patient_uhid: string;
  patient_name: string;
  patient_phone: string;
  patient_blood: string;
  doctor_id?: string;
  doctor_name?: string;
  booking_type: string;
  severity_level: string;
  symptoms: string;
  status: string;
  generic_request_status: string;
  generic_request_notes?: string;
  appointment_date: string;
  created_at: string;
}

export interface PatientRecordItem {
  id: string;
  title: string;
  report_type: string;
  clinical_notes?: string;
  ai_summary?: string;
  file_url?: string;
  prescriptions?: Array<{
    brand_name: string;
    generic_salt: string;
    dosage: string;
    duration_days: number;
    remaining_days: number;
  }>;
  created_at: string;
}

export interface PharmacyStockItem {
  id?: string;
  stock_id?: string;
  pharmacy_id: string;
  store_name: string;
  medicine_brand: string;
  generic_salt_name?: string;
  generic_salt?: string;
  price: number;
  expiry_date: string;
  stock_qty: number;
  closing_time: string;
  city?: string;
}

export interface BloodStockItem {
  id: string;
  blood_group: string;
  live_units: number;
  bank_name: string;
  registered_donors: Array<{
    name: string;
    phone: string;
    blood_group: string;
  }>;
}

export interface RealtimeNotification {
  id: string;
  event: string;
  title: string;
  message: string;
  data?: any;
  timestamp: string;
  read: boolean;
}
