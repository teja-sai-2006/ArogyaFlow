import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Store, PlusCircle, Clock, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';

export const MedicalStoreDashboard: React.FC = () => {
  const { user, apiFetch } = useAuth();
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New stock form
  const [brand, setBrand] = useState('');
  const [salt, setSalt] = useState('Amoxicillin + Clavulanic Acid 625mg');
  const [price, setPrice] = useState<number>(120.0);
  const [expiry, setExpiry] = useState('2027-12-31');
  const [stockQty, setStockQty] = useState<number>(50);
  const [closingTime, setClosingTime] = useState('22:00');
  const [addMsg, setAddMsg] = useState('');

  // Early closing broadcast
  const [earlyClosingTime, setEarlyClosingTime] = useState('19:00');
  const [closingReason, setClosingReason] = useState('Impending severe weather and power line maintenance');
  const [earlyClosingResult, setEarlyClosingResult] = useState<any>(null);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/external/pharmacy/inventory');
      if (res.ok) {
        const data = await res.json();
        setInventory(data.inventory || []);
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

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/external/pharmacy/stock', {
        method: 'POST',
        body: JSON.stringify({
          medicine_brand: brand,
          generic_salt_name: salt,
          price,
          expiry_date: expiry,
          stock_qty: stockQty,
          closing_time: closingTime
        })
      });
      if (res.ok) {
        setAddMsg(`✅ Successfully added ${brand} to live inventory.`);
        setBrand('');
        fetchInventory();
        setTimeout(() => setAddMsg(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEarlyClosing = async () => {
    try {
      const res = await apiFetch('/api/external/pharmacy/broadcast-early-closing', {
        method: 'POST',
        body: JSON.stringify({
          closing_time: earlyClosingTime,
          reason: closingReason
        })
      });
      const data = await res.json();
      if (res.ok) {
        setEarlyClosingResult(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-900 to-orange-950 text-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center space-x-3 mb-2">
          <Store className="w-8 h-8 text-amber-300" />
          <h1 className="text-2xl font-black tracking-tight">Medical Store & Pharmacy Inventory Portal</h1>
        </div>
        <p className="text-sm text-amber-200">
          Store: <span className="font-bold text-white">{user?.name}</span> (Pharmacy ID: {user?.org_id})
        </p>
        <p className="text-xs text-amber-300 mt-1">
          Upload medicine inventory, map branded drugs to active generic chemical salts for patient cost-comparison tables, and notify chronic patients low on prescription refills when closing early.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Inventory Table (2 Columns) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Current Stock Inventory & Generic Salt Mappings</h2>
              <p className="text-xs text-slate-500">Live prices and quantities visible to patients comparing pharmacy vendors.</p>
            </div>
            <button onClick={fetchInventory} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Brand & Salt</th>
                  <th className="py-2.5 px-3">Price</th>
                  <th className="py-2.5 px-3">Stock</th>
                  <th className="py-2.5 px-3">Expiry</th>
                  <th className="py-2.5 px-3">Closing Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventory.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{item.medicine_brand}</p>
                      <p className="text-[11px] text-amber-700 font-medium">{item.generic_salt_name}</p>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 text-sm">₹{item.price.toFixed(2)}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.stock_qty < 20 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {item.stock_qty} Units
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                      {item.expiry_date}
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium">
                      Closes: {item.closing_time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Controls: Add Stock & Broadcast Early Closing (1 Column) */}
        <div className="space-y-6">
          
          {/* Add Stock Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center space-x-2 text-amber-800 mb-3">
              <PlusCircle className="w-4 h-4" />
              <h3 className="font-bold text-sm">Add Medicine Stock</h3>
            </div>

            <form onSubmit={handleAddStock} className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Brand Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Augmentin 625 Duo"
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Generic Chemical Salt</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amoxicillin + Clavulanic Acid 625mg"
                  value={salt}
                  onChange={e => setSalt(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={e => setPrice(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Quantity</label>
                  <input
                    type="number"
                    required
                    value={stockQty}
                    onChange={e => setStockQty(parseInt(e.target.value) || 0)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    required
                    value={expiry}
                    onChange={e => setExpiry(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Daily Closing</label>
                  <input
                    type="text"
                    value={closingTime}
                    onChange={e => setClosingTime(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shadow transition mt-1"
              >
                Upload to Comparison Engine
              </button>
              {addMsg && <p className="text-[11px] text-emerald-800 font-semibold">{addMsg}</p>}
            </form>
          </div>

          {/* Early Closing Broadcast (Integration Fix G) */}
          <div className="bg-white rounded-2xl border border-amber-200 p-5 shadow-sm">
            <div className="flex items-center space-x-2 text-amber-800 mb-2">
              <Clock className="w-4 h-4" />
              <h3 className="font-bold text-sm">Early Closing SMS Broadcast</h3>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Feature 7.2 / Integration Fix G: Triggers automated offline SMS to patients whose refill tracker has &lt;= 3 days remaining before stores shut down.
            </p>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">Early Closing Time</label>
                <input
                  type="text"
                  value={earlyClosingTime}
                  onChange={e => setEarlyClosingTime(e.target.value)}
                  className="w-full text-xs p-1.5 border border-slate-300 rounded"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">Reason for Early Closure</label>
                <input
                  type="text"
                  value={closingReason}
                  onChange={e => setClosingReason(e.target.value)}
                  className="w-full text-xs p-1.5 border border-slate-300 rounded"
                />
              </div>

              <button
                onClick={handleEarlyClosing}
                className="w-full py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg text-xs shadow transition"
              >
                Dispatch Early Closing Offline SMS
              </button>

              {earlyClosingResult && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] space-y-1">
                  <p className="font-bold text-amber-900">
                    ✅ Alerted {earlyClosingResult.sms_alerts_triggered} patient(s) via offline SMS!
                  </p>
                  <p className="text-slate-600">Patients low on doses notified to restock before {earlyClosingResult.closing_time}.</p>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
