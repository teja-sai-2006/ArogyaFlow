import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Users, UserPlus, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

export const HospitalAdminDashboard: React.FC = () => {
  const { user, apiFetch } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New staff form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('DOCTOR');
  const [specialty, setSpecialty] = useState('Cardiology');
  const [createMsg, setCreateMsg] = useState('');

  // Attendance feedback
  const [attendanceAlert, setAttendanceAlert] = useState<any>(null);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/hospital-admin/staff');
      if (res.ok) {
        const data = await res.json();
        setStaff(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/hospital-admin/create-staff', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          phone,
          password: 'pass123',
          role,
          specialty: role === 'DOCTOR' ? specialty : null
        })
      });
      const data = await res.json();
      if (res.ok) {
        setCreateMsg(`✅ Created ${data.role} account for ${data.name}`);
        setName('');
        setEmail('');
        fetchStaff();
      } else {
        setCreateMsg(`❌ Error: ${data.detail || 'Could not create staff'}`);
      }
    } catch (err: any) {
      setCreateMsg(`❌ Failed: ${err.message}`);
    }
  };

  const handleToggleAttendance = async (staffId: string, currentPresent: boolean) => {
    try {
      const res = await apiFetch('/api/hospital-admin/attendance', {
        method: 'PATCH',
        body: JSON.stringify({
          staff_id: staffId,
          is_present: !currentPresent
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStaff(prev => prev.map(s => s.staff_id === staffId ? { ...s, is_present_today: data.is_present_today } : s));
        if (!data.is_present_today && data.flagged_reschedules_count > 0) {
          setAttendanceAlert({
            doctor: data.staff_name,
            count: data.flagged_reschedules_count,
            appointments: data.flagged_appointments
          });
        } else {
          setAttendanceAlert(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-900 to-blue-900 text-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center space-x-3 mb-2">
          <Users className="w-8 h-8 text-indigo-300" />
          <h1 className="text-2xl font-black tracking-tight">Hospital Admin Portal</h1>
        </div>
        <p className="text-sm text-indigo-200">
          Organization ID: <span className="font-mono font-bold text-white">{user?.org_id}</span> ({user?.org_name || 'Hospital'})
        </p>
        <p className="text-xs text-indigo-300 mt-1">
          Manage clinical staff accounts, assign specialties, and control live daily attendance which dynamically updates public patient discovery and triggers Management reassignments.
        </p>
      </div>

      {/* Flagged Appointments Alert if a doctor was marked absent */}
      {attendanceAlert && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs space-y-2">
          <div className="flex items-center space-x-2 text-amber-800 font-bold">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <span>Integration Fix B Triggered: {attendanceAlert.doctor} Marked Absent</span>
          </div>
          <p className="text-slate-700">
            <strong>{attendanceAlert.count} appointment(s)</strong> scheduled for today have been automatically flagged with status <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-bold">RESCHEDULE_REQUIRED</code>.
            A real-time WebSocket alert has been dispatched to Hospital Management to reassign these patients to a present doctor.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Staff Roster & Attendance Tracker (2 Columns) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Hospital Staff Roster & Daily Attendance</h2>
              <p className="text-xs text-slate-500">Toggling Attendance instantly hides absent doctors from the public Patient Table.</p>
            </div>
            <button
              onClick={fetchStaff}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Staff Member</th>
                  <th className="py-2.5 px-3">Role & Specialty</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3 text-center">Status Today</th>
                  <th className="py-2.5 px-3 text-right">Attendance Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((s) => (
                  <tr key={s.staff_id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{s.name}</p>
                      <p className="text-[10px] font-mono text-slate-400">{s.staff_id}</p>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-700">{s.role}</span>
                      {s.specialty && <p className="text-[11px] text-blue-600 font-medium">{s.specialty}</p>}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      <p>{s.email}</p>
                      <p className="text-[11px]">{s.phone}</p>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        s.is_present_today
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {s.is_present_today ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Present</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Absent</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleToggleAttendance(s.staff_id, s.is_present_today)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
                          s.is_present_today
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {s.is_present_today ? 'Mark Absent' : 'Mark Present'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Staff Form (1 Column) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center space-x-2 text-indigo-700 mb-3">
            <UserPlus className="w-5 h-5" />
            <h2 className="text-base font-bold">Add Staff Account</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Provision Doctor, Lab Technician, or Hospital Management credentials for this hospital node.
          </p>

          <form onSubmit={handleCreateStaff} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                placeholder="Dr. / Mr. / Ms."
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Role Scope</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="DOCTOR">Doctor (Clinical & Prescriptions)</option>
                <option value="LAB_TECH">Lab Technician (Imaging & Diagnostic Tests)</option>
                <option value="HOSP_MGMT">Hospital Management (Triage, Beds & Transfers)</option>
              </select>
            </div>

            {role === 'DOCTOR' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Specialty Department</label>
                <select
                  value={specialty}
                  onChange={e => setSpecialty(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="Cardiology">Cardiology</option>
                  <option value="Neurology">Neurology</option>
                  <option value="General Medicine">General Medicine</option>
                  <option value="Orthopedics">Orthopedics</option>
                  <option value="Critical Care">Critical Care / Emergency</option>
                  <option value="Pediatrics">Pediatrics</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                placeholder="staff@hospital.arogyaflow.in"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                required
                placeholder="+91-..."
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-lg text-xs shadow transition mt-2"
            >
              Create Staff Account
            </button>

            {createMsg && (
              <p className="text-xs p-2 rounded bg-slate-100 font-semibold text-slate-800">
                {createMsg}
              </p>
            )}
          </form>
        </div>

      </div>
    </div>
  );
};
