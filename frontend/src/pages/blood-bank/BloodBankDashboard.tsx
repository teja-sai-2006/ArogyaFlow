import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Droplet, Send, Users, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

export const BloodBankDashboard: React.FC = () => {
  const { user, apiFetch } = useAuth();
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Update units form
  const [selectedGroup, setSelectedGroup] = useState('O-ve');
  const [newUnits, setNewUnits] = useState(6);
  const [updateMsg, setUpdateMsg] = useState('');

  // Donor outreach form
  const [outreachGroup, setOutreachGroup] = useState('O-ve');
  const [outreachHospital, setOutreachHospital] = useState('Apollo Speciality Hospital (Ramnagar)');
  const [outreachResult, setOutreachResult] = useState<any>(null);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/external/blood-bank/inventory');
      if (res.ok) {
        const data = await res.json();
        setInventory(data.stocks || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleUpdateUnits = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/external/blood-bank/update-units', {
        method: 'POST',
        body: JSON.stringify({
          blood_group: selectedGroup,
          live_units: newUnits
        })
      });
      if (res.ok) {
        setUpdateMsg(`✅ Updated ${selectedGroup} stock to ${newUnits} live units.`);
        fetchInventory();
        setTimeout(() => setUpdateMsg(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDonorOutreach = async () => {
    try {
      const res = await apiFetch('/api/external/blood-bank/donor-outreach', {
        method: 'POST',
        body: JSON.stringify({
          blood_group: outreachGroup,
          hospital_name: outreachHospital
        })
      });
      const data = await res.json();
      if (res.ok) {
        setOutreachResult(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-rose-900 to-red-950 text-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center space-x-3 mb-2">
          <Droplet className="w-8 h-8 text-rose-300" />
          <h1 className="text-2xl font-black tracking-tight">Blood Bank Live Inventory & Donor Outreach Portal</h1>
        </div>
        <p className="text-sm text-rose-200">
          Facility: <span className="font-bold text-white">{user?.name}</span> (Org ID: {user?.org_id})
        </p>
        <p className="text-xs text-rose-300 mt-1">
          Maintain live unit quantities for rare and trauma blood types, service automated emergency escalation requests from hospital management, and dispatch emergency SMS outreach to registered local volunteer donors when hospital internal stock reaches zero.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Live Inventory Ledger (2 Columns) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Live Blood Units Available</h2>
              <p className="text-xs text-slate-500">Real-time status synced to emergency hospital triage algorithms.</p>
            </div>
            <button onClick={fetchInventory} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {inventory.map(item => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border text-center transition ${
                  item.live_units === 0
                    ? 'border-rose-300 bg-rose-50/70 text-rose-900'
                    : 'border-slate-200 bg-slate-50 text-slate-900'
                }`}
              >
                <span className="text-xs font-bold text-rose-600 block">{item.blood_group}</span>
                <p className="text-3xl font-black tracking-tight my-1">{item.live_units}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  item.live_units === 0
                    ? 'bg-rose-200 text-rose-800'
                    : item.live_units < 5
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {item.live_units === 0 ? 'CRITICAL DEPLETION' : `${item.live_units} Units Live`}
                </span>
              </div>
            ))}
          </div>

          {/* Registered Donors List */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Users className="w-4 h-4 text-slate-500" />
              <span>Registered Volunteer Donors on Record</span>
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {inventory.flatMap(i => i.registered_donors || []).length === 0 ? (
                <p className="text-xs text-slate-400">No registered donors listed.</p>
              ) : (
                inventory.flatMap(i => i.registered_donors || []).map((donor: any, idx: number) => (
                  <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{donor.name}</p>
                      <p className="text-[11px] text-slate-500">{donor.phone}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold font-mono">
                      {donor.blood_group}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Action Controls: Update Units & Zero-Stock Donor Alert (1 Column) */}
        <div className="space-y-6">
          
          {/* Update Units Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-bold text-sm text-slate-900 mb-2">Update Blood Stock Units</h3>
            <form onSubmit={handleUpdateUnits} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Blood Group</label>
                <select
                  value={selectedGroup}
                  onChange={e => setSelectedGroup(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                >
                  <option value="O-ve">O-ve (Universal Trauma)</option>
                  <option value="A+ve">A+ve</option>
                  <option value="B+ve">B+ve</option>
                  <option value="AB+ve">AB+ve</option>
                  <option value="O+ve">O+ve</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Live Units Available</label>
                <input
                  type="number"
                  min={0}
                  value={newUnits}
                  onChange={e => setNewUnits(parseInt(e.target.value) || 0)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow transition"
              >
                Update Live Inventory
              </button>
              {updateMsg && <p className="text-[11px] text-emerald-800 font-semibold">{updateMsg}</p>}
            </form>
          </div>

          {/* Zero-Stock Donor Outreach Box */}
          <div className="bg-white rounded-2xl border border-rose-200 p-5 shadow-sm">
            <div className="flex items-center space-x-2 text-rose-700 mb-2">
              <Send className="w-4 h-4" />
              <h3 className="font-bold text-sm">Emergency Donor Outreach</h3>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Feature 5 / Integration Fix D: Dispatches urgent offline SMS outreach to registered volunteer donors matching the blood group.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">Depleted Blood Group</label>
                <select
                  value={outreachGroup}
                  onChange={e => setOutreachGroup(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded"
                >
                  <option value="O-ve">O-ve</option>
                  <option value="A+ve">A+ve</option>
                  <option value="B+ve">B+ve</option>
                  <option value="AB+ve">AB+ve</option>
                </select>
              </div>

              <button
                onClick={handleDonorOutreach}
                className="w-full py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg text-xs shadow transition"
              >
                Broadcast Urgent Donor SMS
              </button>

              {outreachResult && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] space-y-1">
                  <p className="font-bold text-rose-800">
                    ✅ Dispatched {outreachResult.alerted_donors_count} SMS alerts!
                  </p>
                  <p className="text-slate-600">Blood Group: {outreachResult.blood_group}</p>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
