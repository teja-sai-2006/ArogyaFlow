import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Stethoscope, FileText, CheckCircle, XCircle, Plus, FlaskConical,
  Clock, Pill, User, AlertCircle, RefreshCw
} from 'lucide-react';

export const DoctorDashboard: React.FC = () => {
  const { user, apiFetch } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedPatientUhid, setSelectedPatientUhid] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [patientHistory, setPatientHistory] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Prescription Form
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [prescriptions, setPrescriptions] = useState<any[]>([
    { brand_name: 'Augmentin 625', generic_salt: 'Amoxicillin + Clavulanic Acid 625mg', dosage: '1-0-1', duration_days: 5, remaining_days: 5 }
  ]);
  const [rxSuccess, setRxSuccess] = useState('');

  // Lab Test Form
  const [testType, setTestType] = useState('Chest X-Ray PA View');
  const [labInstructions, setLabInstructions] = useState('Check for consolidation or fracture.');
  const [labSuccess, setLabSuccess] = useState('');

  // Generic Approval Feedback
  const [approvalMsg, setApprovalMsg] = useState('');

  const fetchAppointments = async () => {
    try {
      const res = await apiFetch('/api/doctor/appointments');
      if (res.ok) {
        const data = await res.json();
        setAppointments(data);
        if (data.length > 0 && !selectedPatientUhid) {
          selectPatient(data[0].patient_uhid, data[0].booking_id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const selectPatient = async (uhid: string, bookingId: string) => {
    setSelectedPatientUhid(uhid);
    setSelectedBookingId(bookingId);
    try {
      setLoadingHistory(true);
      const res = await apiFetch(`/api/doctor/patient-records/${uhid}`);
      if (res.ok) {
        const hist = await res.json();
        setPatientHistory(hist);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleAddMedicine = () => {
    setPrescriptions(prev => [
      ...prev,
      { brand_name: 'Pan 40', generic_salt: 'Pantoprazole 40mg', dosage: '1-0-0', duration_days: 5, remaining_days: 5 }
    ]);
  };

  const handlePrescriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingId || !selectedPatientUhid) return;
    try {
      const res = await apiFetch('/api/doctor/prescription', {
        method: 'POST',
        body: JSON.stringify({
          booking_id: selectedBookingId,
          patient_uhid: selectedPatientUhid,
          clinical_notes: clinicalNotes,
          prescriptions
        })
      });
      if (res.ok) {
        setRxSuccess('✅ Prescription saved and synced to Patient Vault & Refill Tracker.');
        setClinicalNotes('');
        selectPatient(selectedPatientUhid, selectedBookingId);
        setTimeout(() => setRxSuccess(''), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOrderLab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingId || !selectedPatientUhid) return;
    try {
      const res = await apiFetch('/api/doctor/order-lab-test', {
        method: 'POST',
        body: JSON.stringify({
          booking_id: selectedBookingId,
          patient_uhid: selectedPatientUhid,
          test_type: testType,
          clinical_instructions: labInstructions
        })
      });
      if (res.ok) {
        setLabSuccess(`✅ Order sent to Lab Tech worklist for ${testType}`);
        selectPatient(selectedPatientUhid, selectedBookingId);
        setTimeout(() => setLabSuccess(''), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenericDecision = async (bookingId: string, approved: boolean) => {
    try {
      const res = await apiFetch('/api/doctor/approve-generic', {
        method: 'POST',
        body: JSON.stringify({
          booking_id: bookingId,
          approved,
          notes: approved
            ? 'Generic substitute approved by attending physician.'
            : 'Generic substitute denied due to formulation specificity.'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setApprovalMsg(`✅ Generic Request: ${data.generic_request_status}. Patient vendor price comparison table unlocked!`);
        fetchAppointments();
        setTimeout(() => setApprovalMsg(''), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const pendingGenericRequests = appointments.filter(a => a.generic_request_status === 'PENDING_DOCTOR');

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center space-x-3 mb-2">
          <Stethoscope className="w-8 h-8 text-emerald-300" />
          <h1 className="text-2xl font-black tracking-tight">Doctor Clinical Workspace</h1>
        </div>
        <p className="text-sm text-emerald-200">
          Logged in: <span className="font-bold text-white">{user?.name}</span> ({user?.org_name})
        </p>
        <p className="text-xs text-emerald-300 mt-1">
          Review patient medical records and AI summaries, prescribe brand/generic medications, order diagnostic X-Rays/scans from lab technicians, and approve generic replacement requests.
        </p>
      </div>

      {/* Generic Medicine Approval Inbox Banner */}
      {pendingGenericRequests.length > 0 && (
        <div className="p-4 bg-teal-50 border border-teal-300 rounded-2xl text-xs space-y-3">
          <div className="flex items-center space-x-2 text-teal-900 font-bold">
            <Pill className="w-5 h-5 text-teal-600" />
            <span>Integration Fix C: Generic Medicine Replacement Inbox ({pendingGenericRequests.length} Pending)</span>
          </div>
          <p className="text-slate-600">
            Patients are requesting generic alternatives to reduce medical costs. Review and approve the chemical salt substitution.
          </p>

          <div className="space-y-2">
            {pendingGenericRequests.map(item => (
              <div key={item.booking_id} className="p-3 bg-white rounded-xl border border-teal-200 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800">{item.patient_name} ({item.patient_uhid})</p>
                  <p className="text-[11px] text-teal-700 font-medium">{item.generic_request_notes}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleGenericDecision(item.booking_id, true)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center space-x-1"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Approve Generic</span>
                  </button>
                  <button
                    onClick={() => handleGenericDecision(item.booking_id, false)}
                    className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold rounded-lg text-xs"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {approvalMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold">
          {approvalMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Patient Queue (1 Column) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-slate-900">Assigned Patient Queue</h3>
            <button onClick={fetchAppointments} className="p-1 rounded hover:bg-slate-50 text-slate-500">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5 max-h-[600px] overflow-y-auto">
            {appointments.map(a => {
              const isSelected = selectedPatientUhid === a.patient_uhid;
              return (
                <div
                  key={a.booking_id}
                  onClick={() => selectPatient(a.patient_uhid, a.booking_id)}
                  className={`p-3 rounded-xl border text-xs transition cursor-pointer ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900">{a.patient_name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {a.patient_blood}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-cyan-700">{a.patient_uhid}</p>
                  <p className="text-slate-600 mt-1 line-clamp-2">{a.symptoms}</p>
                  <div className="mt-2 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 font-mono">{a.appointment_date}</span>
                    <span className={`px-1.5 py-0.2 rounded font-bold ${
                      a.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {a.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Patient Vault & Clinical History (2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active Patient Details & Record History */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            {loadingHistory ? (
              <p className="text-xs text-slate-400">Loading patient records...</p>
            ) : patientHistory ? (
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {patientHistory.patient.name}
                    </h2>
                    <p className="text-xs text-slate-500">
                      UHID: <span className="font-mono font-bold text-cyan-700">{patientHistory.patient.uhid}</span> • Blood: <strong>{patientHistory.patient.blood_group}</strong> • Allergies: <span className="text-rose-600 font-semibold">{patientHistory.patient.allergies}</span>
                    </p>
                  </div>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full">
                    Active Chart
                  </span>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Clinical Records & Diagnostic Scans</h4>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {patientHistory.records.length === 0 ? (
                      <p className="text-xs text-slate-400">No previous records on file.</p>
                    ) : (
                      patientHistory.records.map((r: any) => (
                        <div key={r.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-900">{r.title}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                              {r.report_type}
                            </span>
                          </div>
                          {r.clinical_notes && <p className="text-slate-600 text-[11px] mt-1">{r.clinical_notes}</p>}
                          {r.ai_summary && (
                            <p className="text-emerald-700 bg-emerald-50/70 p-2 rounded-lg text-[11px] mt-1.5 font-medium">
                              🤖 AI Summary: {r.ai_summary}
                            </p>
                          )}
                          {r.file_url && (
                            <a href={r.file_url} target="_blank" rel="noreferrer" className="text-blue-600 underline text-[11px] mt-1 block">
                              View Diagnostic File / Scan
                            </a>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Select a patient from the queue to view records.</p>
            )}
          </div>

          {/* Action Boxes: Prescribe Medicine & Order Lab Scan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Prescribe Medicine */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center space-x-2 text-emerald-800 mb-3">
                <Pill className="w-5 h-5" />
                <h3 className="font-bold text-sm">Write Prescription</h3>
              </div>

              <form onSubmit={handlePrescriptionSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Doctor's Diagnosis & Notes</label>
                  <textarea
                    rows={2}
                    required
                    value={clinicalNotes}
                    onChange={e => setClinicalNotes(e.target.value)}
                    placeholder="Diagnosis, vitals, dietary recommendations..."
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[11px] text-slate-700">Medications</span>
                    <button type="button" onClick={handleAddMedicine} className="text-[10px] text-emerald-700 font-bold">
                      + Add Drug
                    </button>
                  </div>
                  {prescriptions.map((p, idx) => (
                    <div key={idx} className="p-2 bg-slate-50 border border-slate-200 rounded space-y-1">
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          placeholder="Brand Name"
                          value={p.brand_name}
                          onChange={e => {
                            const copy = [...prescriptions];
                            copy[idx].brand_name = e.target.value;
                            setPrescriptions(copy);
                          }}
                          className="p-1 border rounded text-[11px]"
                        />
                        <input
                          type="text"
                          placeholder="Generic Chemical Salt"
                          value={p.generic_salt}
                          onChange={e => {
                            const copy = [...prescriptions];
                            copy[idx].generic_salt = e.target.value;
                            setPrescriptions(copy);
                          }}
                          className="p-1 border rounded text-[11px]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          placeholder="Dosage (1-0-1)"
                          value={p.dosage}
                          onChange={e => {
                            const copy = [...prescriptions];
                            copy[idx].dosage = e.target.value;
                            setPrescriptions(copy);
                          }}
                          className="p-1 border rounded text-[11px]"
                        />
                        <input
                          type="number"
                          placeholder="Days remaining"
                          value={p.remaining_days}
                          onChange={e => {
                            const copy = [...prescriptions];
                            copy[idx].remaining_days = parseInt(e.target.value) || 0;
                            copy[idx].duration_days = parseInt(e.target.value) || 0;
                            setPrescriptions(copy);
                          }}
                          className="p-1 border rounded text-[11px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow transition"
                >
                  Save Prescription & Sync Vault
                </button>
                {rxSuccess && <p className="text-[11px] text-emerald-800 font-semibold">{rxSuccess}</p>}
              </form>
            </div>

            {/* Order Diagnostic Lab Scan */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center space-x-2 text-teal-800 mb-3">
                <FlaskConical className="w-5 h-5" />
                <h3 className="font-bold text-sm">Order Lab Scan / Diagnostic</h3>
              </div>

              <form onSubmit={handleOrderLab} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Diagnostic Test / Scan</label>
                  <select
                    value={testType}
                    onChange={e => setTestType(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    <option value="Chest X-Ray PA View">Chest X-Ray PA View</option>
                    <option value="Brain CT Scan Non-Contrast">Brain CT Scan Non-Contrast</option>
                    <option value="Cardiac 2D Echocardiogram">Cardiac 2D Echocardiogram</option>
                    <option value="Complete Blood Count (CBC)">Complete Blood Count (CBC)</option>
                    <option value="HbA1c & Fasting Lipid Panel">HbA1c & Fasting Lipid Panel</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Clinical Instructions for Lab Tech</label>
                  <textarea
                    rows={3}
                    required
                    value={labInstructions}
                    onChange={e => setLabInstructions(e.target.value)}
                    placeholder="Instructions for imaging tech or pathologist..."
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xs shadow transition"
                >
                  Dispatch to Lab Tech Worklist
                </button>
                {labSuccess && <p className="text-[11px] text-teal-800 font-semibold">{labSuccess}</p>}
              </form>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
