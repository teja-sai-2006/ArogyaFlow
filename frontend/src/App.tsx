import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { SuperAdminDashboard } from './pages/super-admin/SuperAdminDashboard';
import { HospitalAdminDashboard } from './pages/hospital-admin/HospitalAdminDashboard';
import { HospitalMgmtDashboard } from './pages/hospital-mgmt/HospitalMgmtDashboard';
import { DoctorDashboard } from './pages/doctor/DoctorDashboard';
import { LabTechDashboard } from './pages/lab-tech/LabTechDashboard';
import { BloodBankDashboard } from './pages/blood-bank/BloodBankDashboard';
import { MedicalStoreDashboard } from './pages/medical-store/MedicalStoreDashboard';
import { PatientDashboard } from './pages/patient/PatientDashboard';
import {
  ShieldAlert, Hospital, UserCheck, Stethoscope,
  FlaskConical, Droplet, Store, User, Lock, Mail, ArrowRight
} from 'lucide-react';

export const App: React.FC = () => {
  const { user, login, demoUsers, switchUser } = useAuth();
  const [email, setEmail] = useState('superadmin@arogyaflow.gov.in');
  const [password, setPassword] = useState('pass123');
  const [loginError, setLoginError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const ok = await login(email, password);
    if (!ok) {
      setLoginError('Invalid credentials. (Hint: Use password "pass123" or click any seeded quick-login account below!)');
    }
  };

  const renderDashboardByRole = () => {
    if (!user) return null;
    switch (user.role) {
      case 'SUPER_ADMIN': return <SuperAdminDashboard />;
      case 'HOSP_ADMIN': return <HospitalAdminDashboard />;
      case 'HOSP_MGMT': return <HospitalMgmtDashboard />;
      case 'DOCTOR': return <DoctorDashboard />;
      case 'LAB_TECH': return <LabTechDashboard />;
      case 'BLOOD_BANK': return <BloodBankDashboard />;
      case 'PHARMACY': return <MedicalStoreDashboard />;
      case 'PATIENT': return <PatientDashboard />;
      default: return <div className="p-8 text-center">Unknown User Role: {user.role}</div>;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'border-purple-300 bg-purple-50 text-purple-900';
      case 'HOSP_ADMIN': return 'border-indigo-300 bg-indigo-50 text-indigo-900';
      case 'HOSP_MGMT': return 'border-blue-300 bg-blue-50 text-blue-900';
      case 'DOCTOR': return 'border-emerald-300 bg-emerald-50 text-emerald-900';
      case 'LAB_TECH': return 'border-teal-300 bg-teal-50 text-teal-900';
      case 'BLOOD_BANK': return 'border-rose-300 bg-rose-50 text-rose-900';
      case 'PHARMACY': return 'border-amber-300 bg-amber-50 text-amber-900';
      default: return 'border-cyan-300 bg-cyan-50 text-cyan-900';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!user ? (
          /* ================= LOGIN PORTAL WITH 1-CLICK DEMO ACCOUNTS ================= */
          <div className="max-w-4xl mx-auto space-y-8 py-6">
            
            {/* Header Title */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                <span>🏥 Visakhapatnam Public Health Network</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
                ArogyaFlow (ఆరోగ్యఫ్లో)
              </h1>
              <p className="text-sm text-slate-500 max-w-xl mx-auto">
                Select any seeded demo account below or sign in to test the multi-tier RBAC system across all 8 roles.
              </p>
            </div>

            {/* Quick 1-Click Seeded Accounts Cards */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    ⚡ 1-Click Quick Demo Access ({demoUsers.length} Seeded Accounts Across AP)
                  </span>
                  <p className="text-[11px] text-slate-400">Click any card to immediately enter their dedicated RBAC workspace.</p>
                </div>
                <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 font-bold px-2.5 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
                  Universal Password: pass123
                </span>
              </div>

              {/* Category Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 max-h-[460px] overflow-y-auto pr-1">
                {demoUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => switchUser(u)}
                    className={`p-3 rounded-xl border text-left transition hover:scale-[1.02] shadow-sm flex flex-col justify-between ${getRoleBadgeColor(u.role)}`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono font-bold uppercase">{u.role}</span>
                        <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                      </div>
                      <p className="text-xs font-extrabold truncate">{u.name}</p>
                    </div>
                    <div className="mt-2 text-[10px] opacity-75 truncate font-mono">
                      {u.uhid ? `UHID: ${u.uhid}` : u.email}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Standard Login Form */}
            <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="font-bold text-sm text-slate-800">Or Sign In with Email & Password</h2>
              
              <form onSubmit={handleLogin} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {loginError && (
                  <p className="text-[11px] text-rose-600 font-semibold bg-rose-50 p-2 rounded">
                    {loginError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow transition"
                >
                  Sign In to Workspace
                </button>
              </form>
            </div>

          </div>
        ) : (
          /* ================= AUTHENTICATED ROLE DASHBOARD ================= */
          renderDashboardByRole()
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-400">
          ArogyaFlow (ఆరోగ్యఫ్లో) — Modular Monolith with Event-Driven WebSocket Layer • React 18, FastAPI, SQLite / PostgreSQL
        </div>
      </footer>
    </div>
  );
};
