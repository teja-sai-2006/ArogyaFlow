import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, PlusCircle, AlertTriangle, Send, Activity, Hospital, Radio } from 'lucide-react';

export const SuperAdminDashboard: React.FC = () => {
  const { apiFetch } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Provisioning form
  const [orgType, setOrgType] = useState('HOSPITAL');
  const [orgName, setOrgName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('pass123');
  const [city, setCity] = useState('Visakhapatnam');
  const [hospitalType, setHospitalType] = useState('MULTI_SPECIALTY');
  const [isSafeZone, setIsSafeZone] = useState(false);
  const [provisionMessage, setProvisionMessage] = useState('');

  // Disaster Alert Form
  const [disasterTitle, setDisasterTitle] = useState('Coastal Red Alert - Severe Cyclone Warning');
  const [affectedCity, setAffectedCity] = useState('Visakhapatnam');
  const [dangerHospitalId, setDangerHospitalId] = useState('HOSP-A');
  const [disasterStatus, setDisasterStatus] = useState<any>(null);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/super-admin/overview');
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/super-admin/provision-org', {
        method: 'POST',
        body: JSON.stringify({
          org_type: orgType,
          name: orgName,
          admin_name: adminName,
          email,
          phone,
          password,
          city,
          hospital_type: hospitalType,
          is_safe_zone: isSafeZone
        })
      });
      const data = await res.json();
      if (res.ok) {
        setProvisionMessage(`✅ Successfully provisioned ${orgType} (ID: ${data.org_id})`);
        setOrgName('');
        setEmail('');
        fetchOverview();
      } else {
        setProvisionMessage(`❌ Error: ${data.detail || 'Could not provision'}`);
      }
    } catch (err: any) {
      setProvisionMessage(`❌ Failed: ${err.message}`);
    }
  };

  const handleTriggerDisaster = async () => {
    try {
      const res = await apiFetch('/api/super-admin/disaster-alert', {
        method: 'POST',
        body: JSON.stringify({
          affected_city: affectedCity,
          alert_title: disasterTitle,
          severity: 'CRITICAL',
          danger_zone_hospital_ids: [dangerHospitalId]
        })
      });
      const data = await res.json();
      if (res.ok) {
        setDisasterStatus(data);
        fetchOverview();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center space-x-3 mb-2">
          <ShieldAlert className="w-8 h-8 text-purple-300" />
          <h1 className="text-2xl font-black tracking-tight">Super Admin: National Emergency & Org Provisioning Command</h1>
        </div>
        <p className="text-sm text-purple-200 max-w-3xl">
          Central authority workspace for inter-hospital disaster alerts, offline SMS emergency broadcast dispatching, and organization root account lifecycle provisioning.
        </p>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 rounded-xl p-3 border border-white/10">
            <span className="text-xs text-purple-300">Registered Users</span>
            <p className="text-2xl font-bold">{overview?.total_users || 0}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 border border-white/10">
            <span className="text-xs text-purple-300">Active Hospitals</span>
            <p className="text-2xl font-bold">{overview?.total_hospitals || 0}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 border border-white/10">
            <span className="text-xs text-purple-300">Medical Stores</span>
            <p className="text-2xl font-bold">{overview?.total_pharmacies || 0}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 border border-white/10">
            <span className="text-xs text-purple-300">Blood Bank Hubs</span>
            <p className="text-2xl font-bold">{overview?.total_blood_banks || 0}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Disaster & Emergency Command (Integration Fix F & G) */}
        <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-sm">
          <div className="flex items-center space-x-2.5 mb-4 text-rose-700">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="text-lg font-bold">Feature 1.2: Regional Disaster Alert & Evacuation Command</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Broadcasts high-priority alerts to hospitals in danger zones to trigger patient transfers, and fires automated offline SMS alerts to patients low on recurring medication.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Disaster Alert Headline</label>
              <input
                type="text"
                value={disasterTitle}
                onChange={e => setDisasterTitle(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Affected City</label>
                <input
                  type="text"
                  value={affectedCity}
                  onChange={e => setAffectedCity(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mark Danger Zone Hospital</label>
                <select
                  value={dangerHospitalId}
                  onChange={e => setDangerHospitalId(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                >
                  <option value="HOSP-A">Hospital A (Apollo Speciality - Ramnagar)</option>
                  <option value="HOSP-B">Hospital B (Care Super Speciality)</option>
                  <option value="HOSP-C">Hospital C (Local Clinic)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleTriggerDisaster}
              className="w-full mt-2 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow flex items-center justify-center space-x-2 transition"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              <span>Broadcast Regional Disaster Alert & Fire Offline SMS</span>
            </button>
          </div>

          {disasterStatus && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
              <p className="font-bold text-rose-800">✅ Disaster Broadcast Sent Successfully!</p>
              <p className="text-slate-700">Affected: {disasterStatus.details?.alert_title}</p>
              <p className="text-slate-700">
                Offline SMS Sent: <strong className="text-rose-700">{disasterStatus.details?.sms_broadcast_count} patients</strong> (whose refill tracker has &lt; 4 days remaining)
              </p>
            </div>
          )}
        </div>

        {/* Account Provisioning */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center space-x-2.5 mb-4 text-purple-700">
            <PlusCircle className="w-5 h-5" />
            <h2 className="text-lg font-bold">Feature 1.1: Organization Account Provisioning</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Provision new Hospital Admin, Medical Store Owner, or Blood Bank Admin accounts.
          </p>

          <form onSubmit={handleProvision} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Organization Type</label>
                <select
                  value={orgType}
                  onChange={e => setOrgType(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option value="HOSPITAL">Hospital</option>
                  <option value="PHARMACY">Medical Store / Pharmacy</option>
                  <option value="BLOOD_BANK">Blood Bank</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Visakha Care Clinic"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Root Admin Name</label>
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={adminName}
                  onChange={e => setAdminName(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Email</label>
                <input
                  type="email"
                  required
                  placeholder="admin@org.in"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  required
                  placeholder="+91-..."
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              {orgType === 'HOSPITAL' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hospital Tier</label>
                  <select
                    value={hospitalType}
                    onChange={e => setHospitalType(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="MULTI_SPECIALTY">Multi-Specialty</option>
                    <option value="LOCAL_CLINIC">Local Primary Clinic</option>
                  </select>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-lg text-xs shadow transition mt-2"
            >
              Provision Organization & Generate Credentials
            </button>

            {provisionMessage && (
              <p className="text-xs p-2 rounded bg-slate-100 font-semibold text-slate-800">
                {provisionMessage}
              </p>
            )}
          </form>
        </div>
      </div>

      {/* Inter-Hospital Overview & Offline SMS Broadcast Log */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2 text-slate-800">
            <Activity className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-sm">Inter-Hospital Network Status & Offline SMS Dispatch Logs</h3>
          </div>
          <button
            onClick={fetchOverview}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
          >
            Refresh Logs
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Hospitals Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 text-xs font-bold text-slate-600">
              Active Hospital Nodes
            </div>
            <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {overview?.hospitals?.map((h: any) => (
                <div key={h.id} className="p-3 text-xs flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{h.name}</p>
                    <p className="text-slate-500 text-[11px]">{h.city} • {h.type}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      h.is_safe_zone ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {h.is_safe_zone ? 'Safe Zone' : 'Danger Zone / Normal'}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1">ICU Beds: {h.icu_beds_available}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SMS Logs */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 text-xs font-bold text-slate-600 flex items-center justify-between">
              <span>Recent Offline SMS Alerts Dispatched</span>
              <span className="text-[10px] text-slate-400">Works without internet</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {overview?.recent_sms_alerts?.length === 0 ? (
                <p className="p-4 text-xs text-slate-400 text-center">No SMS broadcasts sent yet.</p>
              ) : (
                overview?.recent_sms_alerts?.map((sms: any) => (
                  <div key={sms.id} className="p-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-800">{sms.recipient_name} ({sms.recipient_phone})</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                        {sms.alert_type}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">{sms.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
