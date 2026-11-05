import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Siren, Bot, FileText, Search, Pill, Clock, AlertTriangle,
  CheckCircle2, Languages, Shield, ArrowRight, Hospital, Stethoscope, Store,
  Mic, MicOff, Volume2, VolumeX, Sparkles, Key
} from 'lucide-react';

export const PatientDashboard: React.FC = () => {
  const { user, apiFetch } = useAuth();
  const [activeTab, setActiveTab] = useState<'sos' | 'triage' | 'vault' | 'hospitals' | 'analyzer' | 'refill' | 'generic' | 'finder'>('finder');

  // Emergency SOS State
  const [sosLoading, setSosLoading] = useState(false);
  const [sosResult, setSosResult] = useState<any>(null);

  // AI Triage State
  const [triageSymptoms, setTriageSymptoms] = useState('Severe headache with throbbing pain on left temple for 2 days.');
  const [triageLang, setTriageLang] = useState('en');
  const [triageResult, setTriageResult] = useState<any>(null);
  const [triageLoading, setTriageLoading] = useState(false);

  // Voice to Type (Speech-to-Text) & Voice Output (Text-to-Speech) State
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [speechError, setSpeechError] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeakReply, setAutoSpeakReply] = useState(true);
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('gemini_custom_key') || '');
  const [showGeminiConfig, setShowGeminiConfig] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Check speech recognition support
  useEffect(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setSpeechSupported(false);
    }
  }, []);

  // Hospital Discovery "Table" Filter State
  const [filterCity, setFilterCity] = useState('Visakhapatnam');
  const [filterSpecialist, setFilterSpecialist] = useState('');
  const [filterEquipment, setFilterEquipment] = useState('');
  const [hospitalsTable, setHospitalsTable] = useState<any[]>([]);
  const [bookingMsg, setBookingMsg] = useState('');

  // Medicine Analyzer State
  const [ocrInput, setOcrInput] = useState('Augmentin 625 Duo');
  const [analyzerResult, setAnalyzerResult] = useState<any>(null);

  // Refill Tracker State
  const [refillData, setRefillData] = useState<any>(null);

  // Generic Comparison State
  const [genericSalt, setGenericSalt] = useState('Amoxicillin + Clavulanic Acid 625mg');
  const [genericComparison, setGenericComparison] = useState<any>(null);

  // Vault State
  const [vaultRecords, setVaultRecords] = useState<any[]>([]);

  // Medicine Finder by City State
  const [finderQuery, setFinderQuery] = useState('');
  const [finderCity, setFinderCity] = useState('All');
  const [finderInStockOnly, setFinderInStockOnly] = useState(false);
  const [finderResults, setFinderResults] = useState<any[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>(['All', 'Visakhapatnam', 'Vijayawada', 'Guntur']);
  const [finderLoading, setFinderLoading] = useState(false);
  const [reservationMsg, setReservationMsg] = useState('');

  // Fetch initial data
  useEffect(() => {
    fetchHospitalsTable();
    fetchRefillTracker();
    fetchVault();
    fetchGenericComparison('Amoxicillin');
    searchMedicines('', 'All', false);
  }, []);

  const triggerSOS = async () => {
    try {
      setSosLoading(true);
      const res = await apiFetch('/api/patient/emergency-sos', {
        method: 'POST',
        body: JSON.stringify({
          gps_lat: 17.7215,
          gps_lng: 83.3150,
          symptoms: `Emergency SOS triggered by ${user?.name}. Blood: ${user?.blood_group || 'O-ve'}`
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSosResult(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSosLoading(false);
    }
  };

  const startListening = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setSpeechError('Speech recognition is not supported in this browser. Please use Google Chrome, Edge, or Brave.');
      return;
    }

    setSpeechError('');
    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;

      // Map language code for recognition
      const langMap: Record<string, string> = {
        'te': 'te-IN',
        'hi': 'hi-IN',
        'en': 'en-IN',
        'ta': 'ta-IN',
        'kn': 'kn-IN'
      };
      recognition.lang = langMap[triageLang] || 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + ' ';
        }
        if (transcript.trim()) {
          setTriageSymptoms(transcript.trim());

          // Auto-detect script language if set to auto or for smart switching
          for (const ch of transcript) {
            if (ch >= '\u0c00' && ch <= '\u0c7f') { setTriageLang('te'); break; }
            if (ch >= '\u0900' && ch <= '\u097f') { setTriageLang('hi'); break; }
            if (ch >= '\u0b80' && ch <= '\u0bff') { setTriageLang('ta'); break; }
            if (ch >= '\u0c80' && ch <= '\u0cff') { setTriageLang('kn'); break; }
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition notice:', event.error);
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone access was blocked. Please click the lock/tune icon in the browser address bar and allow Microphone.');
        } else if (event.error !== 'no-speech') {
          setSpeechError(`Voice notice: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setSpeechError(err.message || 'Could not start voice recognition.');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn(e);
      }
    }
    setIsListening(false);
  };

  const speakVoiceReply = (textToSpeak: string, langCode: string) => {
    if (!('speechSynthesis' in window)) {
      return;
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const bcpMap: Record<string, string> = {
      'te': 'te-IN',
      'hi': 'hi-IN',
      'en': 'en-IN',
      'ta': 'ta-IN',
      'kn': 'kn-IN'
    };
    utterance.lang = bcpMap[langCode] || 'en-IN';
    utterance.rate = 0.92; // Slightly measured, clear cadence for medical advice
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const handleSaveGeminiKey = (key: string) => {
    setGeminiApiKey(key);
    localStorage.setItem('gemini_custom_key', key);
    setShowGeminiConfig(false);
  };

  const runAITriage = async () => {
    try {
      setTriageLoading(true);
      const res = await apiFetch('/api/patient/ai-triage', {
        method: 'POST',
        body: JSON.stringify({
          symptoms: triageSymptoms,
          target_language: triageLang,
          gemini_api_key: geminiApiKey || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTriageResult(data);
        if (autoSpeakReply && (data.voice_reply_text || data.triage_advice)) {
          const speakText = data.voice_reply_text || data.triage_advice;
          speakVoiceReply(speakText, data.language || triageLang);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTriageLoading(false);
    }
  };

  const fetchHospitalsTable = async () => {
    try {
      const res = await apiFetch('/api/patient/hospitals-table', {
        method: 'POST',
        body: JSON.stringify({
          state: 'Andhra Pradesh',
          city: filterCity,
          specialist: filterSpecialist || null,
          required_equipment: filterEquipment || null
        })
      });
      if (res.ok) {
        const data = await res.json();
        setHospitalsTable(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const bookViaAICall = async (hospitalId: string, doctorId?: string) => {
    try {
      const res = await apiFetch('/api/patient/book-appointment', {
        method: 'POST',
        body: JSON.stringify({
          hospital_id: hospitalId,
          doctor_id: doctorId || null,
          symptoms: triageSymptoms || 'General medical consultation requested',
          severity_level: triageResult?.severity_level || 'LOW',
          share_all_reports: true
        })
      });
      const data = await res.json();
      if (res.ok) {
        setBookingMsg(`✅ AI Call Booking Dispatched! UHID Consent Token (${data.consent_token}) unlocked reports for Hospital Management.`);
        setTimeout(() => setBookingMsg(''), 5000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const runMedicineAnalyzer = async () => {
    try {
      const res = await apiFetch('/api/patient/analyze-medicine', {
        method: 'POST',
        body: JSON.stringify({ ocr_text: ocrInput })
      });
      if (res.ok) {
        const data = await res.json();
        setAnalyzerResult(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRefillTracker = async () => {
    try {
      const res = await apiFetch('/api/patient/refill-tracker');
      if (res.ok) {
        const data = await res.json();
        setRefillData(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchGenericComparison = async (saltName: string) => {
    try {
      const res = await apiFetch(`/api/patient/generic-comparison/${encodeURIComponent(saltName)}`);
      if (res.ok) {
        const data = await res.json();
        setGenericComparison(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVault = async () => {
    try {
      const res = await apiFetch('/api/patient/vault');
      if (res.ok) {
        const data = await res.json();
        setVaultRecords(data.records || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const searchMedicines = async (queryText?: string, cityName?: string, inStock?: boolean) => {
    try {
      setFinderLoading(true);
      const q = queryText !== undefined ? queryText : finderQuery;
      const c = cityName !== undefined ? cityName : finderCity;
      const s = inStock !== undefined ? inStock : finderInStockOnly;

      const params = new URLSearchParams({
        query: q,
        city: c,
        in_stock_only: s.toString()
      });
      const res = await apiFetch(`/api/patient/medicine-finder?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setFinderResults(data.medicines || []);
        if (data.available_cities) {
          setAvailableCities(data.available_cities);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFinderLoading(false);
    }
  };

  const handleReserveMedicine = (med: any) => {
    setReservationMsg(`✅ Reserved 1 unit of ${med.medicine_brand} at ${med.store_name} (${med.city})! Pickup window: Today before ${med.closing_time}. Price: ₹${med.price.toFixed(2)}.`);
    setTimeout(() => setReservationMsg(''), 6000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-cyan-700 text-white rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-2xl">👤</span>
              <h1 className="text-2xl font-black tracking-tight">{user?.name}</h1>
            </div>
            <p className="text-xs text-blue-100 mt-1">
              UHID: <span className="font-mono font-bold text-white bg-white/20 px-2 py-0.5 rounded">{user?.uhid}</span> • Blood Group: <strong className="text-rose-200">{user?.blood_group}</strong> • Allergies: {user?.allergies || 'None'}
            </p>
          </div>

          {/* Quick SOS Trigger Button in Header */}
          <button
            onClick={() => {
              setActiveTab('sos');
              triggerSOS();
            }}
            disabled={sosLoading}
            className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl shadow-xl border-2 border-white/30 flex items-center justify-center space-x-2 transition siren-animation text-sm shrink-0"
          >
            <Siren className="w-5 h-5 animate-spin" />
            <span>{sosLoading ? 'DISPATCHING SOS...' : 'ONE-TAP EMERGENCY SOS'}</span>
          </button>
        </div>

        {/* Feature Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-white/20 text-xs font-semibold">
          {[
            { id: 'finder', label: '🏬 Medicine Finder by City', icon: Search },
            { id: 'sos', label: '🚨 Emergency SOS', icon: Siren },
            { id: 'triage', label: '🤖 Multilingual AI Triage', icon: Bot },
            { id: 'hospitals', label: '🏥 Hospital Discovery ("Table")', icon: Hospital },
            { id: 'analyzer', label: '🔍 Medicine Strip Analyzer', icon: Pill },
            { id: 'refill', label: '⏰ "When to Take Medicines"', icon: Clock },
            { id: 'generic', label: '💊 Generic Price Comparison', icon: Store },
            { id: 'vault', label: '📁 Reports & Scans Vault', icon: FileText }
          ].map(tab => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition ${
                  isSelected
                    ? 'bg-white text-blue-900 shadow font-bold'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= TAB 0: MEDICINE FINDER BY CITY ================= */}
      {activeTab === 'finder' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center space-x-2 text-indigo-700">
                <Search className="w-6 h-6" />
                <h2 className="text-lg font-bold">Medicine Availability & Price Finder by City</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Real-time pharmacy inventory lookup: check which medical store has your medicine in stock, compare exact prices, view expiry dates, and verify daily closing hours.
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full shrink-0">
              {finderResults.length} Available Listings
            </span>
          </div>

          {reservationMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-semibold flex items-center space-x-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{reservationMsg}</span>
            </div>
          )}

          {/* Search Bar & City Selector */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Search Medicine Brand or Generic Chemical Salt
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={finderQuery}
                    onChange={e => {
                      setFinderQuery(e.target.value);
                      searchMedicines(e.target.value, finderCity, finderInStockOnly);
                    }}
                    placeholder="e.g. Dolo, Augmentin, Pan 40, Paracetamol, Metformin, Insulin..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Filter by City
                </label>
                <select
                  value={finderCity}
                  onChange={e => {
                    setFinderCity(e.target.value);
                    searchMedicines(finderQuery, e.target.value, finderInStockOnly);
                  }}
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-800"
                >
                  {availableCities.map(city => (
                    <option key={city} value={city}>{city === 'All' ? 'All Cities (AP)' : city}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3 flex items-end">
                <label className="flex items-center space-x-2 text-xs text-slate-700 font-semibold cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={finderInStockOnly}
                    onChange={e => {
                      setFinderInStockOnly(e.target.checked);
                      searchMedicines(finderQuery, finderCity, e.target.checked);
                    }}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span>In-Stock Only</span>
                </label>
              </div>
            </div>

            {/* Quick Keyword Preset Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
              <span className="text-slate-400 font-medium">Quick search:</span>
              {[
                'Dolo 650', 'Augmentin 625', 'Pan 40', 'Glycomet 500',
                'Azithral 500', 'Telma 40', 'Shelcal 500', 'Insulin'
              ].map(chip => (
                <button
                  key={chip}
                  onClick={() => {
                    setFinderQuery(chip);
                    searchMedicines(chip, finderCity, finderInStockOnly);
                  }}
                  className="px-2 py-0.5 rounded bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-200 transition font-medium"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Medicine Formulation</th>
                  <th className="py-2.5 px-3">Medical Store / Pharmacy</th>
                  <th className="py-2.5 px-3">City</th>
                  <th className="py-2.5 px-3">Unit Price</th>
                  <th className="py-2.5 px-3">Stock Status</th>
                  <th className="py-2.5 px-3">Expiry Date</th>
                  <th className="py-2.5 px-3">Closing Time</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {finderLoading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Searching pharmacy network inventory...
                    </td>
                  </tr>
                ) : finderResults.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No medicines matched your query in {finderCity}. Try clearing filters or searching for generic salt.
                    </td>
                  </tr>
                ) : (
                  finderResults.map((item, idx) => {
                    const isLowest = idx === 0;
                    return (
                      <tr key={item.stock_id} className={`hover:bg-slate-50/80 transition ${isLowest ? 'bg-indigo-50/20' : ''}`}>
                        <td className="py-3 px-3">
                          <p className="font-extrabold text-slate-900">{item.medicine_brand}</p>
                          <p className="text-[10px] text-indigo-700 font-medium">{item.generic_salt_name}</p>
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-800">{item.store_name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">ID: {item.pharmacy_id}</p>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded font-semibold text-[10px] bg-slate-100 text-slate-700">
                            {item.city}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-black text-slate-900 text-sm">₹{item.price.toFixed(2)}</span>
                            {isLowest && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                                Lowest Price
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === 'OUT_OF_STOCK'
                              ? 'bg-rose-100 text-rose-800'
                              : item.status === 'LOW_STOCK'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {item.status === 'OUT_OF_STOCK'
                              ? 'Out of Stock'
                              : `${item.stock_qty} Units in Stock`}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                          {item.expiry_date}
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-medium">
                          {item.closing_time}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleReserveMedicine(item)}
                            disabled={item.status === 'OUT_OF_STOCK'}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded text-[11px] transition shadow-sm"
                          >
                            Reserve Dose
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 1: EMERGENCY SOS (FEATURE 5) ================= */}
      {activeTab === 'sos' && (
        <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center space-x-2 text-rose-700">
            <Siren className="w-6 h-6 animate-pulse" />
            <h2 className="text-lg font-black">Feature 5: One-Tap Emergency Pre-Arrival SOS Chain Reaction</h2>
          </div>
          <p className="text-xs text-slate-500">
            Pressing this button executes zero manual steps: it bundles your live GPS, blood type ({user?.blood_group}), and medical records $\rightarrow$ checks nearest hospital ICU beds $\rightarrow$ cascades to 2nd nearest if beds are 0 $\rightarrow$ checks internal blood stock $\rightarrow$ auto-escalates to the external blood bank if stock is 0.
          </p>

          <div className="text-center py-6">
            <button
              onClick={triggerSOS}
              disabled={sosLoading}
              className="w-48 h-48 rounded-full bg-gradient-to-tr from-rose-600 to-red-700 text-white font-black text-lg shadow-2xl hover:scale-105 active:scale-95 transition flex flex-col items-center justify-center space-y-2 border-4 border-rose-300 mx-auto siren-animation"
            >
              <Siren className="w-10 h-10 animate-spin" />
              <span>{sosLoading ? 'DISPATCHING...' : 'PRESS FOR SOS'}</span>
              <span className="text-[10px] font-normal opacity-80">Instant Ambulance & Bed Lock</span>
            </button>
          </div>

          {sosResult && (
            <div className="p-5 bg-rose-50 border-2 border-rose-300 rounded-2xl space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-rose-200">
                <span className="font-extrabold text-rose-900 text-sm">
                  🚨 LIVE PRE-ARRIVAL DISPATCH COMPLETE (Event: {sosResult.event_id})
                </span>
                <span className="bg-rose-200 text-rose-900 font-bold px-2 py-0.5 rounded text-[10px]">
                  Emergency Override Token: {sosResult.token_id}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-700">
                <div className="p-3 bg-white rounded-xl border border-rose-200 space-y-1">
                  <p className="font-bold text-slate-900">Hospital Routing & Bed Lock:</p>
                  <p>Primary Hospital: <strong>{sosResult.primary_hospital.name}</strong> (0 ICU Beds Available)</p>
                  {sosResult.cascade_triggered && (
                    <p className="text-rose-700 font-bold">
                      ⚡ Cascade Triggered: Diverted to 2nd Nearest <strong>{sosResult.assigned_hospital.name}</strong>
                    </p>
                  )}
                  <p className="text-emerald-700 font-bold">
                    {sosResult.bed_locked ? '✅ 1 ICU Trauma Bed Successfully Locked' : '❌ Bed lock pending'}
                  </p>
                </div>

                <div className="p-3 bg-white rounded-xl border border-rose-200 space-y-1">
                  <p className="font-bold text-slate-900">Pre-Arrival Blood Verification:</p>
                  <p>Patient Blood Group: <strong>{sosResult.blood_group}</strong></p>
                  <p className="text-blue-800 font-medium">{sosResult.blood_status_message}</p>
                  {sosResult.blood_escalated && (
                    <p className="text-purple-700 font-bold">
                      🩸 Auto-Escalation: Live unit reserved at Rotary Blood Bank before ambulance arrives!
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: MULTILINGUAL AI TRIAGE (FEATURE 3.1) ================= */}
      {activeTab === 'triage' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-indigo-700">
              <Bot className="w-6 h-6" />
              <div>
                <h2 className="text-lg font-bold">Feature 3.1: Multilingual AI Voice Triage & Doctor Voice Reply</h2>
                <p className="text-[11px] text-slate-500">Google in-built voice-to-text with auto-detect or language selection & Gemini AI</p>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2 text-xs">
              {/* Gemini Model Badge & Config Toggle */}
              <button
                onClick={() => setShowGeminiConfig(!showGeminiConfig)}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 text-purple-800 font-bold hover:bg-purple-100 transition shadow-sm"
                title="Configure Gemini Free Unlimited Access API Key"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
                <span>{geminiApiKey ? 'Gemini 2.0 Flash (Custom Key)' : 'Gemini 2.0 Flash (Free Tier)'}</span>
                <Key className="w-3 h-3 text-purple-500 ml-1" />
              </button>

              {/* Language Selector */}
              <div className="flex items-center space-x-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
                <Languages className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={triageLang}
                  onChange={e => setTriageLang(e.target.value)}
                  className="bg-transparent font-semibold text-slate-700 text-xs focus:outline-none cursor-pointer"
                >
                  <option value="auto">🌐 Auto Detect Language (ఆటో / ऑटो)</option>
                  <option value="te">🇮🇳 తెలుగు (Telugu)</option>
                  <option value="hi">🇮🇳 हिंदी (Hindi)</option>
                  <option value="en">🇮🇳 English (Indian English)</option>
                  <option value="ta">🇮🇳 தமிழ் (Tamil)</option>
                  <option value="kn">🇮🇳 ಕನ್ನಡ (Kannada)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Gemini API Key Configuration Drawer */}
          {showGeminiConfig && (
            <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200 rounded-xl space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-purple-900 flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>Google Gemini Free Unlimited API Configuration</span>
                </span>
                <button
                  onClick={() => setShowGeminiConfig(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-sm"
                >
                  ✕
                </button>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Google provides <strong>100% free unlimited rate-limited access</strong> to <strong>Gemini 2.0 Flash</strong> & <strong>Gemini 1.5 Flash</strong> via Google AI Studio (zero credit card required). You can paste your key below or add it to <code className="bg-white px-1.5 py-0.5 rounded text-purple-700 font-mono">backend/.env</code> as <code className="bg-white px-1.5 py-0.5 rounded text-purple-700 font-mono">GEMINI_API_KEY=...</code>.
              </p>
              <div className="flex items-center space-x-2">
                <input
                  type="password"
                  placeholder="Paste your Gemini API Key (AIzaSy...)"
                  value={geminiApiKey}
                  onChange={e => setGeminiApiKey(e.target.value)}
                  className="flex-1 p-2 bg-white border border-purple-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
                <button
                  onClick={() => handleSaveGeminiKey(geminiApiKey)}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-lg shadow-sm transition"
                >
                  Save Key
                </button>
                {geminiApiKey && (
                  <button
                    onClick={() => handleSaveGeminiKey('')}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition"
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                💡 Don't have a key? Leave it blank — our built-in offline clinical intelligence engine will instantly handle Telugu, Hindi, and English triage and audio synthesis!
              </p>
            </div>
          )}

          {/* Speech Error Banner if any */}
          {speechError && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center justify-between">
              <span>⚠️ {speechError}</span>
              <button onClick={() => setSpeechError('')} className="font-bold text-amber-900 ml-2">✕</button>
            </div>
          )}

          {/* Input & Voice-to-Type Controls */}
          <div className="space-y-3">
            <div className="relative">
              <textarea
                rows={3}
                value={triageSymptoms}
                onChange={e => setTriageSymptoms(e.target.value)}
                placeholder="Describe symptoms in Telugu, Hindi, or English (e.g. గుండె నొప్పి, सीने में दर्द, sharp chest pain)..."
                className={`w-full text-xs p-3.5 pr-12 border rounded-xl focus:ring-2 focus:outline-none transition ${
                  isListening
                    ? 'border-rose-400 bg-rose-50/30 ring-2 ring-rose-300'
                    : 'border-slate-300 focus:ring-indigo-500'
                }`}
              />

              {/* Floating Mic Button inside textarea */}
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={`absolute right-3 top-3 p-2 rounded-xl transition shadow-md flex items-center justify-center ${
                  isListening
                    ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-200'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
                title={isListening ? 'Click to stop listening' : 'Click to speak via Google In-Built Voice to Text'}
              >
                {isListening ? <MicOff className="w-4 h-4 animate-bounce" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>

            {/* Voice Control Toolbar & Listening Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1.5 transition ${
                    isListening
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow animate-pulse'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-sm'
                  }`}
                >
                  {isListening ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-white animate-ping mr-1" />
                      <span>🔴 Listening... Speak now (Click to stop)</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5 text-indigo-600" />
                      <span>🎙️ Voice to Type (Google Voice-to-Text)</span>
                    </>
                  )}
                </button>

                {isListening && (
                  <div className="flex items-center space-x-1 text-rose-600 font-mono text-[11px] animate-pulse">
                    <span>Listening in {triageLang.toUpperCase()}</span>
                    <span className="flex space-x-0.5">
                      <span className="w-1 h-3 bg-rose-500 rounded-full animate-pulse" />
                      <span className="w-1 h-4 bg-rose-600 rounded-full animate-bounce" />
                      <span className="w-1 h-2 bg-rose-500 rounded-full animate-pulse" />
                    </span>
                  </div>
                )}
              </div>

              {/* Spoken Chips for Quick Testing */}
              <div className="flex items-center space-x-1 text-[11px] text-slate-500 flex-wrap">
                <span className="font-semibold text-slate-600">Quick Voice Test:</span>
                <button
                  type="button"
                  onClick={() => {
                    setTriageSymptoms('గుండె నొప్పి మరియు శ్వాస తీసుకోవడం కష్టంగా ఉంది');
                    setTriageLang('te');
                  }}
                  className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-indigo-700 font-medium text-[10px]"
                >
                  🇮🇳 గుండె నొప్పి (Telugu)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTriageSymptoms('सीने में बहुत तेज़ दर्द और सांस लेने में तकलीफ');
                    setTriageLang('hi');
                  }}
                  className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-indigo-700 font-medium text-[10px]"
                >
                  🇮🇳 सीने में दर्द (Hindi)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTriageSymptoms('Severe headache and mild dizziness for 2 days');
                    setTriageLang('en');
                  }}
                  className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-indigo-700 font-medium text-[10px]"
                >
                  🇮🇳 Mild Headache (Eng)
                </button>
              </div>
            </div>

            {/* Run Triage Button & Auto-speak Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                onClick={runAITriage}
                disabled={triageLoading}
                className="py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center space-x-2"
              >
                <Bot className="w-4 h-4" />
                <span>{triageLoading ? 'Gemini AI Analyzing Symptoms...' : 'Run Multilingual AI Triage (AI విశ్లేషణ)'}</span>
              </button>

              <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoSpeakReply}
                  onChange={e => setAutoSpeakReply(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <Volume2 className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold">Auto-speak Doctor's voice reply in patient's language</span>
              </label>
            </div>
          </div>

          {/* AI Triage Result with Voice Output Player */}
          {triageResult && (
            <div className="p-5 bg-gradient-to-br from-slate-50 via-indigo-50/20 to-white border border-slate-200 rounded-2xl space-y-4 text-xs shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full font-extrabold text-[11px] ${
                    triageResult.severity_level === 'CRITICAL'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : triageResult.severity_level === 'MODERATE'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}>
                    Severity: {triageResult.severity_level}
                  </span>
                  <span className="font-bold text-slate-700">
                    Recommended: <strong className="text-indigo-700">{triageResult.facility_type_recommended}</strong>
                  </span>
                </div>

                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                  {triageResult.ai_model_used || 'Gemini 2.0 Flash'}
                </span>
              </div>

              {/* Spoken Voice Advice Card */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-emerald-800 font-bold text-xs">
                    <Volume2 className="w-4 h-4 text-emerald-700" />
                    <span>🔊 Spoken Doctor's Voice Advice ({triageResult.language === 'te' ? 'తెలుగు' : triageResult.language === 'hi' ? 'हिंदी' : 'English'})</span>
                  </div>

                  <button
                    onClick={() => {
                      if (isSpeaking) {
                        stopSpeaking();
                      } else {
                        speakVoiceReply(
                          triageResult.voice_reply_text || triageResult.triage_advice,
                          triageResult.language || triageLang
                        );
                      }
                    }}
                    className={`px-3 py-1 rounded-lg font-bold text-xs flex items-center space-x-1.5 transition shadow-sm ${
                      isSpeaking
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {isSpeaking ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5" />
                        <span>Stop Voice</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Listen to Advice (వినండి / सुनिए)</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-emerald-950 font-medium leading-relaxed italic text-sm">
                  "{triageResult.voice_reply_text || triageResult.triage_advice}"
                </p>

                {isSpeaking && (
                  <div className="flex items-center space-x-1 text-emerald-700 text-[11px] font-mono pt-1">
                    <span>Speaking in patient's native tongue...</span>
                    <span className="flex space-x-1">
                      <span className="w-1 h-3 bg-emerald-600 rounded-full animate-bounce" />
                      <span className="w-1 h-4 bg-emerald-700 rounded-full animate-pulse" />
                      <span className="w-1 h-2 bg-emerald-600 rounded-full animate-bounce" />
                    </span>
                  </div>
                )}
              </div>

              {/* Clinical Details */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                <p className="font-bold text-slate-800 text-xs">
                  Suggested Specialist: <span className="text-indigo-700">{triageResult.suggested_specialist}</span>
                </p>
                <p className="text-slate-600 leading-relaxed text-xs">{triageResult.triage_advice}</p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => setActiveTab('hospitals')}
                  className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center space-x-1"
                >
                  <span>Find matching {triageResult.facility_type_recommended} in Hospital Discovery Table</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                {triageResult.severity_level === 'CRITICAL' && (
                  <button
                    onClick={() => {
                      setActiveTab('sos');
                      triggerSOS();
                    }}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg text-xs shadow flex items-center space-x-1 animate-pulse"
                  >
                    <Siren className="w-3.5 h-3.5" />
                    <span>Trigger Immediate SOS</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: HOSPITAL DISCOVERY ("TABLE" FILTER) (FEATURE 4) ================= */}
      {activeTab === 'hospitals' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center space-x-2 text-blue-700">
            <Hospital className="w-6 h-6" />
            <h2 className="text-lg font-bold">Feature 4: Hospitals and Availability ("Table" Filter)</h2>
          </div>
          <p className="text-xs text-slate-500">
            Filter hospitals by state, city, specialist, and equipment. <strong className="text-slate-800">Integration Fix B:</strong> Doctors marked Absent by Hospital Admins are automatically hidden from this public table in real time.
          </p>

          {bookingMsg && (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold">
              {bookingMsg}
            </div>
          )}

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-1">City</label>
              <input
                type="text"
                value={filterCity}
                onChange={e => setFilterCity(e.target.value)}
                className="w-full p-2 border rounded bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-1">Filter by Specialist</label>
              <select
                value={filterSpecialist}
                onChange={e => setFilterSpecialist(e.target.value)}
                className="w-full p-2 border rounded bg-white"
              >
                <option value="">All Specialties</option>
                <option value="Cardiology">Cardiology</option>
                <option value="Neurology">Neurology (Dr. Sneha is Absent)</option>
                <option value="General Medicine">General Medicine</option>
                <option value="Orthopedics">Orthopedics</option>
                <option value="Critical Care">Critical Care</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchHospitalsTable}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs transition"
              >
                Apply Table Filter
              </button>
            </div>
          </div>

          {/* Hospitals Discovery Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Hospital Name</th>
                  <th className="py-2.5 px-3">Tier</th>
                  <th className="py-2.5 px-3">Available Beds</th>
                  <th className="py-2.5 px-3">Present Specialists (Live Attendance)</th>
                  <th className="py-2.5 px-3 text-right">AI Call Booking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hospitalsTable.map(h => (
                  <tr key={h.hospital_id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{h.name}</p>
                      <p className="text-[11px] text-slate-500">{h.city}</p>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        h.type === 'MULTI_SPECIALTY' ? 'bg-purple-100 text-purple-800' : 'bg-cyan-100 text-cyan-800'
                      }`}>
                        {h.type}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <p>ICU: <strong>{h.icu_beds}</strong></p>
                      <p className="text-slate-500 text-[11px]">General: {h.general_beds}</p>
                    </td>
                    <td className="py-3 px-3">
                      {h.present_doctors?.length === 0 ? (
                        <span className="text-[11px] text-rose-600 italic">No matching specialists present today</span>
                      ) : (
                        <div className="space-y-1">
                          {h.present_doctors?.map((doc: any) => (
                            <div key={doc.doctor_id} className="flex items-center space-x-1.5 text-[11px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span className="font-semibold text-slate-800">{doc.name}</span>
                              <span className="text-slate-500">({doc.specialty})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => bookViaAICall(h.hospital_id, h.present_doctors?.[0]?.doctor_id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-sm transition"
                      >
                        Book via AI Call
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 4: MEDICINE ANALYZER (NAMELESS STRIPS) (FEATURE 7.1) ================= */}
      {activeTab === 'analyzer' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center space-x-2 text-indigo-700">
            <Pill className="w-6 h-6" />
            <h2 className="text-lg font-bold">Feature 7.1: Smart Medicine Analyzer (Nameless / Cut Strip Fallback)</h2>
          </div>
          <p className="text-xs text-slate-500">
            <strong className="text-slate-800">Integration Fix E:</strong> If a blister pack is torn or the brand name is completely cut off, instead of guessing blindly, the AI cross-references the fragment against your own past prescription records on file.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Enter Visible Text Fragment or Blister Pack Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ocrInput}
                  onChange={e => setOcrInput(e.target.value)}
                  placeholder="e.g. Augmentin, Dolo, or leave blank to test nameless past-prescription fallback"
                  className="flex-1 text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  onClick={runMedicineAnalyzer}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition"
                >
                  Analyze Medicine
                </button>
              </div>
            </div>

            <div className="flex gap-2 text-[11px]">
              <span className="text-slate-400">Quick test presets:</span>
              <button onClick={() => setOcrInput('Augmentin 625 Duo')} className="text-indigo-600 underline">Augmentin</button>
              <button onClick={() => setOcrInput('Dolo 650')} className="text-indigo-600 underline">Dolo (OTC Safe)</button>
              <button onClick={() => setOcrInput('cut strip / torn')} className="text-indigo-600 underline">Cut/Torn Strip (Past Rx Fallback)</button>
            </div>
          </div>

          {analyzerResult && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-900 text-sm">{analyzerResult.medicine_brand}</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                  analyzerResult.tier === 1 ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                }`}>
                  {analyzerResult.identification_method}
                </span>
              </div>
              <p className="text-indigo-700 font-semibold">{analyzerResult.generic_salt}</p>
              <p className="text-slate-600">{analyzerResult.primary_uses}</p>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                <span className="font-semibold text-slate-700">Safety Status:</span>
                <span className={`font-bold ${analyzerResult.is_otc_safe ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {analyzerResult.safety_warning}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 5: "WHEN TO TAKE MEDICINES" (FEATURE 7.2) ================= */}
      {activeTab === 'refill' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center space-x-2 text-blue-700">
            <Clock className="w-6 h-6" />
            <h2 className="text-lg font-bold">Feature 7.2: "When to take medicines" (Refill Tracker)</h2>
          </div>
          <p className="text-xs text-slate-500">
            Countdown tracker for your active prescriptions. When doses drop below 3 days, or when nearby pharmacies are closing early, the platform dispatches automated offline SMS alerts to your phone.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {refillData?.active_prescriptions?.length === 0 ? (
              <p className="text-xs text-slate-400">No active prescriptions currently on record.</p>
            ) : (
              refillData?.active_prescriptions?.map((item: any, idx: number) => {
                const isLow = item.remaining_days <= 3;
                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border text-xs space-y-2 ${
                      isLow ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{item.brand_name}</span>
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        isLow ? 'bg-amber-200 text-amber-900 animate-pulse' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {item.remaining_days} Days Remaining
                      </span>
                    </div>
                    <p className="text-slate-600 font-medium">{item.generic_salt}</p>
                    <p className="text-slate-500 text-[11px]">Dosage: <strong>{item.dosage}</strong></p>
                    <p className="text-slate-400 text-[10px]">Prescribed on: {item.date_prescribed}</p>
                  </div>
                );
              })
            )}
          </div>

          {/* Next Follow-Up Consultation */}
          {refillData?.next_appointment && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs flex items-center justify-between">
              <div>
                <p className="font-bold text-blue-900">Next Follow-Up Appointment</p>
                <p className="text-blue-700 mt-0.5">{refillData.next_appointment.symptoms}</p>
              </div>
              <span className="font-mono font-bold text-blue-900 bg-white px-3 py-1 rounded shadow-sm">
                {refillData.next_appointment.date}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 6: GENERIC MEDICINE COMPARISON TABLE (FEATURE 6.2) ================= */}
      {activeTab === 'generic' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center space-x-2 text-amber-800">
            <Store className="w-6 h-6 text-amber-600" />
            <h2 className="text-lg font-bold">Feature 6.2: Generic Medicine Vendor Price Comparison Table</h2>
          </div>
          <p className="text-xs text-slate-500">
            <strong className="text-slate-800">Integration Fix C:</strong> Once your doctor approves a generic medicine request, this table queries live pharmacy stocks across Visakhapatnam to display prices, stock counts, and daily closing times, sorted from lowest price first.
          </p>

          <div className="flex gap-2 text-xs">
            <input
              type="text"
              value={genericSalt}
              onChange={e => setGenericSalt(e.target.value)}
              placeholder="Search active salt (e.g. Amoxicillin, Paracetamol)..."
              className="flex-1 p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
            <button
              onClick={() => fetchGenericComparison(genericSalt)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition"
            >
              Compare Vendors
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Medical Store / Pharmacy</th>
                  <th className="py-2.5 px-3">Available Brand / Formulation</th>
                  <th className="py-2.5 px-3">Unit Price</th>
                  <th className="py-2.5 px-3">Stock Units</th>
                  <th className="py-2.5 px-3">Expiry Date</th>
                  <th className="py-2.5 px-3">Closing Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {genericComparison?.comparison_table?.map((item: any, idx: number) => {
                  const isCheapest = idx === 0;
                  return (
                    <tr key={item.stock_id} className={`hover:bg-slate-50/70 ${isCheapest ? 'bg-emerald-50/40' : ''}`}>
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-1.5">
                          <p className="font-bold text-slate-900">{item.store_name}</p>
                          {isCheapest && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                              Best Price
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">{item.city}</p>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800">{item.medicine_brand}</span>
                        <p className="text-[10px] text-amber-700">{item.generic_salt}</p>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-black text-slate-900 text-sm">₹{item.price.toFixed(2)}</span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700">
                        {item.stock_qty} in stock
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                        {item.expiry_date}
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-medium">
                        Closes: {item.closing_time}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 7: REPORTS & SCANS VAULT (FEATURE 3.1 & 6.1) ================= */}
      {activeTab === 'vault' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center space-x-2 text-indigo-700">
            <FileText className="w-6 h-6" />
            <h2 className="text-lg font-bold">Feature 3.1 & 6.1: Personal Reports and Scans Vault</h2>
          </div>
          <p className="text-xs text-slate-500">
            All diagnostic scans uploaded by hospital lab technicians and prescriptions written by attending doctors sync into your sovereign patient vault.
          </p>

          <div className="space-y-3">
            {vaultRecords.length === 0 ? (
              <p className="text-xs text-slate-400">No medical records uploaded yet.</p>
            ) : (
              vaultRecords.map(r => (
                <div key={r.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{r.title}</span>
                    <span className="px-2 py-0.5 rounded font-mono font-bold bg-blue-100 text-blue-800 text-[10px]">
                      {r.report_type}
                    </span>
                  </div>
                  {r.clinical_notes && <p className="text-slate-600 text-[11px]">{r.clinical_notes}</p>}
                  {r.ai_summary && (
                    <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-lg text-[11px] font-medium">
                      🤖 AI Summary: {r.ai_summary}
                    </div>
                  )}
                  {r.file_url && (
                    <a href={r.file_url} target="_blank" rel="noreferrer" className="text-blue-600 underline font-semibold text-[11px] inline-block">
                      View Radiograph Scan File
                    </a>
                  )}
                  <p className="text-[10px] text-slate-400 font-mono">Date: {r.created_at}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
};
