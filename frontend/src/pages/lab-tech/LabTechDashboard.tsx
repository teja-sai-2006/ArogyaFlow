import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FlaskConical, Upload, CheckCircle2, Clock, RefreshCw, FileText } from 'lucide-react';

export const LabTechDashboard: React.FC = () => {
  const { user, apiFetch } = useAuth();
  const [worklist, setWorklist] = useState<any>({ pending: [], completed: [] });
  const [loading, setLoading] = useState(true);

  // Upload Form
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [patientUhid, setPatientUhid] = useState('UHID-2026-0001');
  const [testTitle, setTestTitle] = useState('Chest X-Ray Digital Radiograph');
  const [fileUrl, setFileUrl] = useState('https://storage.arogyaflow.gov.in/scans/xray-p1-chest.png');
  const [techNotes, setTechNotes] = useState('Bilateral lung fields clear. No rib fractures or pneumothorax visible. Cardiac silhouette normal.');
  const [uploadMsg, setUploadMsg] = useState('');

  const fetchWorklist = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/lab-tech/worklist');
      if (res.ok) {
        const data = await res.json();
        setWorklist(data);
        if (data.pending?.length > 0 && !selectedOrder) {
          selectOrderItem(data.pending[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectOrderItem = (order: any) => {
    setSelectedOrder(order);
    setPatientUhid(order.patient_uhid);
    setTestTitle(order.title.replace('PENDING ORDER: ', ''));
  };

  useEffect(() => {
    fetchWorklist();
  }, []);

  const handleUploadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/lab-tech/upload-report', {
        method: 'POST',
        body: JSON.stringify({
          order_id: selectedOrder?.id,
          patient_uhid: patientUhid,
          test_title: testTitle,
          file_url: fileUrl,
          technician_notes: techNotes
        })
      });
      const data = await res.json();
      if (res.ok) {
        setUploadMsg(`✅ Diagnostic Scan uploaded! Real-time Dual-Sync sent to Attending Doctor & Patient Vault. AI Summary: "${data.ai_summary}"`);
        setSelectedOrder(null);
        fetchWorklist();
      } else {
        setUploadMsg(`❌ Error: ${data.detail || 'Could not upload'}`);
      }
    } catch (err: any) {
      setUploadMsg(`❌ Failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-900 to-cyan-900 text-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center space-x-3 mb-2">
          <FlaskConical className="w-8 h-8 text-teal-300" />
          <h1 className="text-2xl font-black tracking-tight">Lab Technician Diagnostic Worklist & Scan Portal</h1>
        </div>
        <p className="text-sm text-teal-200">
          Facility: <span className="font-bold text-white">{user?.org_name}</span> • Technician: {user?.name}
        </p>
        <p className="text-xs text-teal-300 mt-1">
          Perform ordered imaging and pathology tests, attach diagnostic files/observations. Uploading automatically triggers AI plain-language summarization and syncs directly into the Doctor review queue and Patient Personal Vault.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Pending Worklist */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2 text-slate-800">
              <Clock className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold">Pending Diagnostic Orders ({worklist.pending?.length || 0})</h2>
            </div>
            <button onClick={fetchWorklist} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {worklist.pending?.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                No pending diagnostic orders. Tests requested by doctors will appear here automatically in real time!
              </div>
            ) : (
              worklist.pending?.map((item: any) => {
                const isSelected = selectedOrder?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => selectOrderItem(item)}
                    className={`p-3.5 rounded-xl border text-xs transition cursor-pointer ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50/50 shadow-sm'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900">{item.title}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                        Awaiting Scan
                      </span>
                    </div>
                    <p className="text-slate-600 font-medium">
                      Patient: <strong className="text-slate-900">{item.patient_name}</strong> (<span className="font-mono text-cyan-700">{item.patient_uhid}</span>)
                    </p>
                    <p className="text-slate-500 text-[11px] mt-1">{item.clinical_notes}</p>
                    <p className="text-slate-400 text-[10px] mt-2 font-mono">Ordered by: {item.doctor_name}</p>
                  </div>
                );
              })
            )}
          </div>

          {/* Completed History List */}
          <div className="mt-6 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Recently Completed Scans</h3>
            <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
              {worklist.completed?.map((c: any) => (
                <div key={c.id} className="py-2 text-xs flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">{c.title}</p>
                    <p className="text-[10px] text-slate-500">{c.patient_name} ({c.patient_uhid})</p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upload Scan Portal */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center space-x-2 text-teal-800 mb-2">
            <Upload className="w-5 h-5" />
            <h2 className="text-base font-bold">Upload Report / Scan File</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Feature 6.1: Uploading attaches file to Patient UHID, runs AI summarization, and instantly dual-syncs to the Doctor & Patient dashboards.
          </p>

          <form onSubmit={handleUploadReport} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Patient UHID</label>
              <input
                type="text"
                required
                value={patientUhid}
                onChange={e => setPatientUhid(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Report Title</label>
              <input
                type="text"
                required
                value={testTitle}
                onChange={e => setTestTitle(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Scan Image / PDF URL</label>
              <input
                type="text"
                required
                value={fileUrl}
                onChange={e => setFileUrl(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Technician Observations & Clinical Findings
              </label>
              <textarea
                rows={4}
                required
                value={techNotes}
                onChange={e => setTechNotes(e.target.value)}
                placeholder="Observed radiologic landmarks, pathology values, biomarker status..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xs shadow transition flex items-center justify-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Scan & Trigger AI Dual-Sync</span>
            </button>

            {uploadMsg && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed font-medium">
                {uploadMsg}
              </div>
            )}
          </form>
        </div>

      </div>
    </div>
  );
};
