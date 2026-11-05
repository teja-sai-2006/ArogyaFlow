import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Activity, Siren, Bed, Droplet, UserCheck, ArrowRightLeft,
  CheckCircle, RefreshCw, AlertCircle, Phone
} from 'lucide-react';

export const HospitalMgmtDashboard: React.FC = () => {
  const { user, apiFetch } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Reassignment Modal State
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [targetDoctorId, setTargetDoctorId] = useState('');
  const [reassignSuccess, setReassignSuccess] = useState('');

  // Resources state
  const [icuBeds, setIcuBeds] = useState<number>(0);
  const [generalBeds, setGeneralBeds] = useState<number>(0);
  const [bloodStock, setBloodStock] = useState<Record<string, number>>({});
  const [resourceMsg, setResourceMsg] = useState('');

  // Blood Order state
  const [bloodGroupToOrder, setBloodGroupToOrder] = useState('O-ve');
  const [bloodBankId, setBloodBankId] = useState('BB-01');
  const [bloodUnits, setBloodUnits] = useState(2);
  const [bloodOrderMsg, setBloodOrderMsg] = useState('');

  // Disaster Transfer state
  const [targetHospitalId, setTargetHospitalId] = useState('HOSP-B');
  const [selectedUhids, setSelectedUhids] = useState<string[]>(['UHID-2026-0001']);
  const [transferNotes, setTransferNotes] = useState('Emergency cyclone evacuation to safe-zone facility');
  const [transferMsg, setTransferMsg] = useState('');

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/hospital-mgmt/dashboard');
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setIcuBeds(d.hospital.icu_beds);
        setGeneralBeds(d.hospital.general_beds);
        setBloodStock(d.hospital.internal_blood_stock || {});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleReassign = async () => {
    if (!selectedBooking || !targetDoctorId) return;
    try {
      const res = await apiFetch('/api/hospital-mgmt/reassign-doctor', {
        method: 'POST',
        body: JSON.stringify({
          booking_id: selectedBooking.booking_id,
          new_doctor_id: targetDoctorId
        })
      });
      const resData = await res.json();
      if (res.ok) {
        setReassignSuccess(`✅ Reassigned ${selectedBooking.patient_name} to ${resData.new_doctor}`);
        setSelectedBooking(null);
        fetchDashboard();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmAppointment = async (bookingId: string) => {
    try {
      const res = await apiFetch(`/api/hospital-mgmt/confirm-appointment/${bookingId}`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchDashboard();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateResources = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/hospital-mgmt/resources', {
        method: 'PATCH',
        body: JSON.stringify({
          icu_beds_available: icuBeds,
          general_beds_available: generalBeds,
          internal_blood_stock: bloodStock
        })
      });
      if (res.ok) {
        setResourceMsg('✅ Resources saved and broadcasted to network.');
        setTimeout(() => setResourceMsg(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRequestBlood = async () => {
    try {
      const res = await apiFetch('/api/hospital-mgmt/request-blood', {
        method: 'POST',
        body: JSON.stringify({
          blood_bank_id: bloodBankId,
          blood_group: bloodGroupToOrder,
          units_requested: bloodUnits
        })
      });
      const resData = await res.json();
      if (res.ok) {
        setBloodOrderMsg(`✅ Successfully reserved & dispatched ${bloodUnits} unit(s) of ${bloodGroupToOrder} from Blood Bank.`);
        fetchDashboard();
      } else {
        setBloodOrderMsg(`❌ Failed: ${resData.detail || 'Could not request blood'}`);
      }
    } catch (err: any) {
      setBloodOrderMsg(`❌ Error: ${err.message}`);
    }
  };

  const handleDisasterTransfer = async () => {
    try {
      const res = await apiFetch('/api/hospital-mgmt/disaster-transfer', {
        method: 'POST',
        body: JSON.stringify({
          target_hospital_id: targetHospitalId,
          patient_uhids: selectedUhids,
          notes: transferNotes
        })
      });
      const resData = await res.json();
      if (res.ok) {
        setTransferMsg(`✅ Transferred ${resData.transferred_count} patient(s) to Safe Zone Hospital. Full records and UHID consent tokens cloned!`);
        fetchDashboard();
      }
    } catch (err: any) {
      setTransferMsg(`❌ Error: ${err.message}`);
    }
  };

  const presentDoctors = data?.doctors?.filter((d: any) => d.is_present_today) || [];
  const flaggedQueue = data?.queue?.filter((q: any) => q.status === 'RESCHEDULE_REQUIRED') || [];
  const sosQueue = data?.queue?.filter((q: any) => q.booking_type === 'EMERGENCY_SOS') || [];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center space-x-3 mb-2">
          <Activity className="w-8 h-8 text-blue-300" />
          <h1 className="text-2xl font-black tracking-tight">Hospital Management & Live Triage Console</h1>
        </div>
        <p className="text-sm text-blue-200">
          Hospital Node: <span className="font-bold text-white">{data?.hospital?.name || user?.org_name}</span> ({data?.hospital?.type})
        </p>
        <p className="text-xs text-blue-300 mt-1">
          Coordinate Emergency Pre-Arrival SOS alerts, resolve absent-doctor scheduling bottlenecks, order emergency blood bags, and orchestrate inter-hospital disaster evacuations.
        </p>
      </div>

      {/* Emergency Siren Alert Banner if active SOS bookings exist */}
      {sosQueue.length > 0 && (
        <div className="p-4 bg-rose-600 text-white rounded-2xl shadow-lg border border-rose-700 siren-animation">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Siren className="w-6 h-6 animate-spin text-white" />
              <div>
                <h3 className="font-extrabold text-sm tracking-wide uppercase">
                  CRITICAL PRE-ARRIVAL EMERGENCY SOS ACTIVE ({sosQueue.length} Alert)
                </h3>
                <p className="text-xs text-rose-100">
                  Patient: {sosQueue[0].patient_name} ({sosQueue[0].patient_uhid}) • Blood: <strong>{sosQueue[0].patient_blood}</strong> • Severity: CRITICAL
                </p>
              </div>
            </div>
            <button
              onClick={() => handleConfirmAppointment(sosQueue[0].booking_id)}
              className="px-4 py-2 bg-white text-rose-700 font-black rounded-xl text-xs hover:bg-rose-50 transition shadow"
            >
              Admit & Confirm ICU Trauma Team
            </button>
          </div>
        </div>
      )}

      {/* Flagged Appointments Alert Banner */}
      {flaggedQueue.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-amber-900 font-bold">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>
                {flaggedQueue.length} Appointment(s) Require Reassignment because doctor was marked Absent!
              </span>
            </div>
            <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded">Action Required</span>
          </div>
        </div>
      )}

      {/* Reassignment Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-slate-900">Reassign Absent Doctor's Patient</h3>
            <p className="text-xs text-slate-500">
              Patient: <strong>{selectedBooking.patient_name}</strong> ({selectedBooking.patient_uhid})<br />
              Symptoms: {selectedBooking.symptoms}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Present Specialist to Reassign
              </label>
              <select
                value={targetDoctorId}
                onChange={e => setTargetDoctorId(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">-- Choose a Present Doctor --</option>
                {presentDoctors.map((doc: any) => (
                  <option key={doc.doctor_id} value={doc.doctor_id}>
                    {doc.name} ({doc.specialty}) • Load: {doc.current_load}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={handleReassign}
                disabled={!targetDoctorId}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-lg text-xs transition"
              >
                Confirm Reassignment
              </button>
              <button
                onClick={() => setSelectedBooking(null)}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-xs hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Appointments & Triage Queue (2 Columns) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Live Triage & Booking Queue</h2>
              <p className="text-xs text-slate-500">AI Call bookings, SOS emergency cascades, and doctor reassignment inbox.</p>
            </div>
            <button onClick={fetchDashboard} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
              <RefreshCw className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          {reassignSuccess && (
            <p className="p-2 mb-3 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-lg">
              {reassignSuccess}
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Patient</th>
                  <th className="py-2.5 px-3">Type & Severity</th>
                  <th className="py-2.5 px-3">Symptoms</th>
                  <th className="py-2.5 px-3">Assigned Doctor</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.queue?.map((item: any) => {
                  const isFlagged = item.status === 'RESCHEDULE_REQUIRED';
                  const isSOS = item.booking_type === 'EMERGENCY_SOS';
                  return (
                    <tr key={item.booking_id} className={`hover:bg-slate-50/70 ${isFlagged ? 'bg-amber-50/40' : ''} ${isSOS ? 'bg-rose-50/40' : ''}`}>
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-900">{item.patient_name}</p>
                        <p className="text-[10px] font-mono text-cyan-700">{item.patient_uhid} ({item.patient_blood})</p>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isSOS ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {item.booking_type}
                        </span>
                        <p className={`text-[10px] font-bold mt-1 ${
                          item.severity_level === 'CRITICAL' ? 'text-rose-600' : 'text-slate-600'
                        }`}>
                          {item.severity_level}
                        </p>
                      </td>
                      <td className="py-3 px-3 max-w-[180px] truncate text-slate-600">
                        {item.symptoms}
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-medium text-slate-800">{item.doctor_name}</p>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'CONFIRMED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'RESCHEDULE_REQUIRED'
                            ? 'bg-amber-100 text-amber-900 font-extrabold animate-pulse'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isFlagged ? (
                          <button
                            onClick={() => setSelectedBooking(item)}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold shadow-sm"
                          >
                            Reassign Doctor
                          </button>
                        ) : item.status === 'PENDING_MGMT' ? (
                          <button
                            onClick={() => handleConfirmAppointment(item.booking_id)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold"
                          >
                            Confirm
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resource Console & Blood Bank Escalation (1 Column) */}
        <div className="space-y-6">
          
          {/* Bed & Internal Blood Editor */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center space-x-2 text-blue-800 mb-3">
              <Bed className="w-5 h-5" />
              <h3 className="font-bold text-sm">Bed & Blood Inventory Console</h3>
            </div>
            
            <form onSubmit={handleUpdateResources} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">ICU Beds Free</label>
                  <input
                    type="number"
                    value={icuBeds}
                    onChange={e => setIcuBeds(parseInt(e.target.value) || 0)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">General Beds Free</label>
                  <input
                    type="number"
                    value={generalBeds}
                    onChange={e => setGeneralBeds(parseInt(e.target.value) || 0)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Internal Blood Stock (Units)</label>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {['O-ve', 'A+ve', 'B+ve', 'AB+ve'].map(bg => (
                    <div key={bg} className="text-center p-1.5 bg-slate-50 border border-slate-200 rounded">
                      <span className="font-bold text-[10px] text-rose-700">{bg}</span>
                      <input
                        type="number"
                        value={bloodStock[bg] ?? 0}
                        onChange={e => setBloodStock({ ...bloodStock, [bg]: parseInt(e.target.value) || 0 })}
                        className="w-full text-center text-xs font-bold bg-white border border-slate-300 rounded mt-1 p-0.5"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg text-xs shadow transition"
              >
                Sync Resources to Network
              </button>
              {resourceMsg && <p className="text-[11px] text-emerald-700 font-semibold">{resourceMsg}</p>}
            </form>
          </div>

          {/* External Blood Bank Order Box */}
          <div className="bg-white rounded-2xl border border-rose-200 p-5 shadow-sm">
            <div className="flex items-center space-x-2 text-rose-700 mb-2">
              <Droplet className="w-5 h-5" />
              <h3 className="font-bold text-sm">Request External Blood Units</h3>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Order blood units from external regional blood banks if hospital inventory is depleted.
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Blood Group</label>
                  <select
                    value={bloodGroupToOrder}
                    onChange={e => setBloodGroupToOrder(e.target.value)}
                    className="w-full text-xs p-1.5 border border-slate-300 rounded"
                  >
                    <option value="O-ve">O-ve (Universal Trauma)</option>
                    <option value="A+ve">A+ve</option>
                    <option value="B+ve">B+ve</option>
                    <option value="AB+ve">AB+ve</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Units Needed</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={bloodUnits}
                    onChange={e => setBloodUnits(parseInt(e.target.value) || 1)}
                    className="w-full text-xs p-1.5 border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">Target Blood Bank</label>
                <select
                  value={bloodBankId}
                  onChange={e => setBloodBankId(e.target.value)}
                  className="w-full text-xs p-1.5 border border-slate-300 rounded"
                >
                  <option value="BB-01">Rotary Blood Bank (Visakhapatnam)</option>
                  <option value="BB-02">Red Cross Blood Center (Beach Road)</option>
                </select>
              </div>

              <button
                onClick={handleRequestBlood}
                className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow transition"
              >
                Dispatch Live Blood Request
              </button>
              {bloodOrderMsg && <p className="text-[11px] text-slate-800 font-semibold">{bloodOrderMsg}</p>}
            </div>
          </div>

          {/* Disaster Transfer Box (Integration Fix F) */}
          <div className="bg-white rounded-2xl border border-indigo-200 p-5 shadow-sm">
            <div className="flex items-center space-x-2 text-indigo-700 mb-2">
              <ArrowRightLeft className="w-5 h-5" />
              <h3 className="font-bold text-sm">Disaster Evacuation Transfer</h3>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              One-click clones clinical records and active charts to a safe-zone hospital before ambulance departure.
            </p>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">Safe-Zone Destination</label>
                <select
                  value={targetHospitalId}
                  onChange={e => setTargetHospitalId(e.target.value)}
                  className="w-full text-xs p-1.5 border border-slate-300 rounded"
                >
                  <option value="HOSP-B">Care Super Speciality (Maharanipeta - Safe Zone)</option>
                </select>
              </div>

              <button
                onClick={handleDisasterTransfer}
                className="w-full py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-lg text-xs shadow transition"
              >
                Execute Evacuation & Record Clone
              </button>
              {transferMsg && <p className="text-[11px] text-slate-800 font-semibold">{transferMsg}</p>}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
