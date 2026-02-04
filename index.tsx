
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Plus, Search, LayoutDashboard, Users, Settings, 
  ArrowLeft, Pill, Activity, Image as ImageIcon, Clipboard, 
  ChevronRight, ChevronLeft, Upload, Link as LinkIcon, 
  Heart, Thermometer, Droplets, Camera, 
  FlaskConical, Check, X, Edit3, Trash2, Microscope, Maximize2, Eye,
  Mail, Phone, Calendar, Filter, Beaker
} from 'lucide-react';

// --- Types ---

interface LabResult {
  id: string;
  date: string;
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: 'Normal' | 'Abnormal' | 'Critical';
}

interface RadiologyImage {
  id: string;
  date: string;
  type: string;
  description: string;
  link: string;
}

interface Medication {
  id: string;
  name: string;
  dose: string;
  startDate: string;
  endDate: string;
}

interface VisitNote {
  id: string;
  date: string;
  reason: string;
  diagnosis: string;
  notes: string;
  vitals: {
    bloodPressure: string;
    heartRate: string;
    temperature: string;
  };
}

interface Patient {
  id: string;
  name: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  contact: string;
  email: string;
  bloodType: string;
  avatar?: string;
  labResults: LabResult[];
  radiology: RadiologyImage[];
  visits: VisitNote[];
  medications: Medication[];
}

interface LabDefinition {
  id: string;
  name: string;
  defaultRange: string;
  defaultUnit: string;
}

type ViewState = 'dashboard' | 'patient-detail' | 'patients-list' | 'settings' | 'patient-labs';

// --- Services ---

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Mock Data ---

const INITIAL_PATIENTS: Patient[] = [
  {
    id: 'pt-7281',
    name: 'Eleanor Vance',
    dob: '1978-11-04',
    gender: 'Female',
    contact: '+1 415-555-0198',
    email: 'e.vance@example.com',
    bloodType: 'O+',
    labResults: [
      { id: 'lb-1', date: '2024-02-10', testName: 'Hemoglobin A1C', value: '5.8', unit: '%', referenceRange: '4.0-5.6', status: 'Abnormal' },
      { id: 'lb-2', date: '2024-02-10', testName: 'Total Cholesterol', value: '190', unit: 'mg/dL', referenceRange: '< 200', status: 'Normal' },
    ],
    radiology: [
      { id: 'rad-1', date: '2023-12-15', type: 'MRI Knee', description: 'Lateral meniscus assessment', link: 'https://imaging.example.com/study/vance_e_2023' }
    ],
    visits: [
      { 
        id: 'v-1', 
        date: '2024-02-15', 
        reason: 'Joint Pain Follow-up', 
        diagnosis: 'Mild Osteoarthritis', 
        notes: 'Reporting improved mobility after physical therapy. Continue current regimen.',
        vitals: { bloodPressure: '118/76', heartRate: '68', temperature: '98.4' }
      }
    ],
    medications: [
      { id: 'm-1', name: 'Lisinopril', dose: '10mg Daily', startDate: '2023-05-01', endDate: '2025-05-01' },
      { id: 'm-2', name: 'Amoxicillin', dose: '500mg BID', startDate: '2024-01-10', endDate: '2024-01-20' }
    ]
  }
];

const DEFAULT_LAB_DEFINITIONS: LabDefinition[] = [
  { id: '1', name: 'Glucose', defaultRange: '70-99', defaultUnit: 'mg/dL' },
  { id: '2', name: 'Hemoglobin A1C', defaultRange: '4.0-5.6', defaultUnit: '%' },
  { id: '3', name: 'Total Cholesterol', defaultRange: '< 200', defaultUnit: 'mg/dL' },
  { id: '4', name: 'Creatinine', defaultRange: '0.7-1.3', defaultUnit: 'mg/dL' },
  { id: '5', name: 'Potassium', defaultRange: '3.6-5.2', defaultUnit: 'mmol/L' },
];

// --- Components ---

const App: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [view, setView] = useState<ViewState>('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [isEditPatientOpen, setIsEditPatientOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isPhotoViewOpen, setIsPhotoViewOpen] = useState(false);
  
  // Lab Dictionary State
  const [labDefinitions] = useState<LabDefinition[]>(DEFAULT_LAB_DEFINITIONS);

  // Forms State
  const [showLabForm, setShowLabForm] = useState(false);
  const [editingLab, setEditingLab] = useState<LabResult | null>(null);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [showMedicationForm, setShowMedicationForm] = useState(false);
  const [prioritizeActiveMeds, setPrioritizeActiveMeds] = useState(false);

  // Manual Lab Entry State
  const [manualLabTestName, setManualLabTestName] = useState('');
  const [manualLabValue, setManualLabValue] = useState('');
  const [manualLabUnit, setManualLabUnit] = useState('');
  const [manualLabRange, setManualLabRange] = useState('');
  const [manualLabDate, setManualLabDate] = useState(new Date().toISOString().split('T')[0]);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  const selectedPatient = useMemo(() => 
    patients.find(p => p.id === selectedPatientId), 
    [patients, selectedPatientId]
  );

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isMedicationActive = (med: Medication) => {
    const today = new Date().toISOString().split('T')[0];
    return today >= med.startDate && (med.endDate === '' || today <= med.endDate);
  };

  const sortedMedications = useMemo(() => {
    if (!selectedPatient) return [];
    const meds = [...selectedPatient.medications];
    if (prioritizeActiveMeds) {
      return meds.sort((a, b) => {
        const activeA = isMedicationActive(a);
        const activeB = isMedicationActive(b);
        if (activeA && !activeB) return -1;
        if (!activeA && activeB) return 1;
        return 0;
      });
    }
    return meds;
  }, [selectedPatient, prioritizeActiveMeds]);

  // Actions
  const addPatient = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const customId = (formData.get('id') as string);
    const newPatient: Patient = {
      id: customId,
      name: formData.get('name') as string,
      dob: formData.get('dob') as string,
      gender: formData.get('gender') as 'Male' | 'Female' | 'Other',
      contact: '',
      email: '',
      bloodType: '',
      labResults: [],
      radiology: [],
      visits: [],
      medications: []
    };
    setPatients([...patients, newPatient]);
    setIsAddPatientOpen(false);
    setView('patients-list');
  };

  const updatePatient = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPatientId) return;
    const formData = new FormData(e.currentTarget);
    const newId = formData.get('id') as string;
    setPatients(prev => prev.map(p => p.id === selectedPatientId ? { ...p, id: newId, name: formData.get('name') as string, dob: formData.get('dob') as string, gender: formData.get('gender') as any } : p));
    setSelectedPatientId(newId);
    setIsEditPatientOpen(false);
  };

  const addOrUpdateLabResult = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !manualLabTestName || !manualLabValue) return;
    
    setPatients(prev => prev.map(p => {
      if (p.id === selectedPatientId) {
        let newResults;
        if (editingLab) {
          newResults = p.labResults.map(lab => lab.id === editingLab.id ? { 
            ...lab, 
            testName: manualLabTestName, 
            value: manualLabValue, 
            unit: manualLabUnit, 
            referenceRange: manualLabRange, 
            date: manualLabDate 
          } : lab);
        } else {
          const newLab: LabResult = {
            id: `lb-${Date.now()}`,
            date: manualLabDate,
            testName: manualLabTestName,
            value: manualLabValue,
            unit: manualLabUnit,
            referenceRange: manualLabRange,
            status: 'Normal'
          };
          newResults = [newLab, ...p.labResults];
        }
        return { ...p, labResults: newResults };
      }
      return p;
    }));
    setShowLabForm(false);
    setEditingLab(null);
    resetLabForm();
  };

  const deleteLab = (labId: string) => {
    if (!confirm('Are you sure you want to delete this lab entry?')) return;
    setPatients(prev => prev.map(p => p.id === selectedPatientId ? { ...p, labResults: p.labResults.filter(l => l.id !== labId) } : p));
  };

  const resetLabForm = () => {
    setManualLabTestName('');
    setManualLabValue('');
    setManualLabUnit('');
    setManualLabRange('');
    setManualLabDate(new Date().toISOString().split('T')[0]);
  };

  const openEditLab = (lab: LabResult) => {
    setEditingLab(lab);
    setManualLabTestName(lab.testName);
    setManualLabValue(lab.value);
    setManualLabUnit(lab.unit);
    setManualLabRange(lab.referenceRange);
    setManualLabDate(lab.date);
    setShowLabForm(true);
  };

  const addMedication = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPatientId) return;
    const formData = new FormData(e.currentTarget);
    const newMed: Medication = {
      id: `m-${Date.now()}`,
      name: formData.get('name') as string,
      dose: formData.get('dose') as string,
      startDate: formData.get('startDate') as string,
      endDate: formData.get('endDate') as string,
    };
    setPatients(prev => prev.map(p => p.id === selectedPatientId ? { ...p, medications: [newMed, ...p.medications] } : p));
    setShowMedicationForm(false);
  };

  const addVisitNote = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPatientId) return;
    const formData = new FormData(e.currentTarget);
    const newVisit: VisitNote = {
      id: `v-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      reason: formData.get('reason') as string,
      diagnosis: formData.get('diagnosis') as string,
      notes: formData.get('notes') as string,
      vitals: {
        bloodPressure: formData.get('bp') as string,
        heartRate: formData.get('hr') as string,
        temperature: formData.get('temp') as string,
      }
    };
    setPatients(prev => prev.map(p => p.id === selectedPatientId ? { ...p, visits: [newVisit, ...p.visits] } : p));
    setShowVisitForm(false);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPatientId) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setPatients(prev => prev.map(p => p.id === selectedPatientId ? { ...p, avatar: base64 } : p));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className={`bg-white border-r border-slate-200 p-4 transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
            <Microscope size={24} />
          </div>
          {!isSidebarCollapsed && <h1 className="font-extrabold text-xl tracking-tight">MedLink<span className="text-blue-600">Pro</span></h1>}
        </div>
        <nav className="space-y-2">
          <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={view === 'dashboard'} onClick={() => setView('dashboard')} collapsed={isSidebarCollapsed} />
          <SidebarItem icon={<Users size={20} />} label="Patients" active={view === 'patients-list' || view === 'patient-detail' || view === 'patient-labs'} onClick={() => setView('patients-list')} collapsed={isSidebarCollapsed} />
          <SidebarItem icon={<Settings size={20} />} label="Settings" active={view === 'settings'} onClick={() => setView('settings')} collapsed={isSidebarCollapsed} />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-extrabold text-black">
              {view === 'dashboard' && "Clinic Overview"}
              {view === 'patients-list' && "Patient Directory"}
              {view === 'patient-detail' && "Patient Record"}
              {view === 'patient-labs' && "Full Lab History"}
              {view === 'settings' && "System Settings"}
            </h2>
          </div>
          <div className="flex gap-4">
            {view === 'patients-list' && (
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Search patient..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-black font-bold" />
              </div>
            )}
            <button onClick={() => setIsAddPatientOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg">
              <Plus size={20} /> Add Patient
            </button>
          </div>
        </header>

        {view === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-6">
              <div className="p-4 bg-slate-50 rounded-xl"><Users className="text-blue-500" /></div>
              <div>
                <div className="text-2xl font-black text-black">{patients.length}</div>
                <div className="text-sm font-bold text-slate-500">Active Patients</div>
              </div>
            </div>
            <div className="md:col-span-2 lg:col-span-4 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-xl font-black mb-6">Recent Patients</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {patients.slice(0, 3).map(p => (
                  <PatientCardShortcut key={p.id} patient={p} onClick={() => { setSelectedPatientId(p.id); setView('patient-detail'); }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'patients-list' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-500">
            {filteredPatients.map(p => (
              <div key={p.id} onClick={() => { setSelectedPatientId(p.id); setView('patient-detail'); }} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                    <img src={p.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`} className="w-full h-full object-cover" />
                  </div>
                  <div className="bg-slate-50 px-2 py-1 rounded text-xs font-bold text-black uppercase">#{p.id}</div>
                </div>
                <h3 className="font-bold text-black text-lg mb-1">{p.name}</h3>
                <p className="text-sm text-slate-500 font-bold mb-4">{p.gender} • {new Date().getFullYear() - new Date(p.dob).getFullYear()} yrs</p>
                <div className="flex items-center justify-between text-blue-600 font-bold text-sm border-t pt-4">
                  View Record <ChevronRight size={18} />
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'patient-detail' && selectedPatient && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
              <button onClick={() => setView('patients-list')} className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-900 transition-colors"><ArrowLeft size={18} /> Directory</button>
              <button onClick={() => setIsEditPatientOpen(true)} className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-black transition-all flex items-center gap-2"><Edit3 size={18} /> Edit Profile</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center relative">
                  <div className="relative w-32 h-32 mx-auto mb-4">
                    <img src={selectedPatient.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedPatient.name}`} className="w-full h-full rounded-[2.5rem] object-cover border-4 border-slate-50" />
                    <div className="absolute bottom-1 right-1 flex gap-2">
                      <button onClick={() => avatarInputRef.current?.click()} className="bg-white p-2 rounded-xl shadow text-emerald-600 border border-slate-100 hover:scale-110 transition-transform"><Camera size={16} /></button>
                      <button onClick={() => setIsPhotoViewOpen(true)} className="bg-white p-2 rounded-xl shadow text-blue-600 border border-slate-100 hover:scale-110 transition-transform"><Eye size={16} /></button>
                    </div>
                    <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
                  </div>
                  <h3 className="text-3xl font-black text-black leading-tight">{selectedPatient.name}</h3>
                  <p className="text-slate-500 font-bold mt-1 uppercase tracking-widest text-[10px]">Patient ID: {selectedPatient.id}</p>
                  <div className="mt-6 flex justify-around text-left pt-6 border-t border-slate-100">
                    <div>
                      <span className="block text-[10px] font-black text-slate-400 uppercase">Age</span>
                      <span className="font-bold text-black">{new Date().getFullYear() - new Date(selectedPatient.dob).getFullYear()} yrs</span>
                    </div>
                    <div className="border-l border-slate-100 pl-4">
                      <span className="block text-[10px] font-black text-slate-400 uppercase">Blood</span>
                      <span className="font-bold text-rose-600">{selectedPatient.bloodType || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Lab Results Summary */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-extrabold text-lg flex items-center gap-2 text-black"><FlaskConical size={20} className="text-blue-600" /> Lab Results</h4>
                    <button onClick={() => setView('patient-labs')} className="text-[10px] font-black text-blue-600 uppercase hover:underline">View All</button>
                  </div>
                  <div className="space-y-3">
                    {selectedPatient.labResults.slice(0, 3).map(lab => (
                      <div key={lab.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-black text-black uppercase">{lab.testName}</p>
                          <p className="font-bold text-sm text-black">{lab.value} {lab.unit}</p>
                        </div>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${lab.status === 'Normal' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{lab.status}</span>
                      </div>
                    ))}
                    <button onClick={() => { setEditingLab(null); resetLabForm(); setShowLabForm(true); }} className="w-full py-3 bg-blue-50 text-blue-600 font-bold text-xs rounded-xl flex items-center justify-center gap-2 hover:bg-blue-100"><Plus size={14} /> Add Result</button>
                  </div>
                </div>

                {/* Medications Section */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-extrabold text-lg flex items-center gap-2 text-black"><Pill size={20} className="text-purple-600" /> Medications</h4>
                    <button onClick={() => setPrioritizeActiveMeds(!prioritizeActiveMeds)} className={`p-2 rounded-lg transition-colors ${prioritizeActiveMeds ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-400'}`} title="Prioritize Active"><Filter size={14} /></button>
                  </div>
                  <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
                    {sortedMedications.map(med => {
                      const active = isMedicationActive(med);
                      return (
                        <div key={med.id} className={`p-3 rounded-xl border ${active ? 'bg-purple-50/50 border-purple-100' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                          <div className="flex justify-between items-start">
                            <p className="font-black text-black text-sm">{med.name}</p>
                            {active && <span className="text-[8px] font-black bg-purple-600 text-white px-1.5 py-0.5 rounded uppercase">Active</span>}
                          </div>
                          <p className="text-xs font-bold text-slate-600">{med.dose}</p>
                          <p className="text-[9px] text-slate-400 font-bold mt-1">Started: {med.startDate}</p>
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={() => setShowMedicationForm(true)} className="w-full mt-4 py-3 bg-purple-50 text-purple-600 font-bold text-xs rounded-xl flex items-center justify-center gap-2 hover:bg-purple-100"><Plus size={14} /> Add Medication</button>
                </div>
              </div>

              {/* Visits List */}
              <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8">
                <div className="flex justify-between items-center mb-8">
                  <h4 className="font-extrabold text-xl flex items-center gap-2 text-black"><Clipboard size={22} className="text-blue-600" /> Clinical Visits</h4>
                  <button onClick={() => setShowVisitForm(true)} className="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700"><Plus size={18} /> Record Visit</button>
                </div>
                <div className="space-y-6">
                  {selectedPatient.visits.map(visit => (
                    <div key={visit.id} className="p-7 rounded-[2.5rem] border border-slate-100 bg-slate-50/50">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{visit.date}</p>
                          <h5 className="font-extrabold text-black text-xl">{visit.diagnosis}</h5>
                        </div>
                        <div className="flex gap-2 text-[10px] font-black">
                          <span className="bg-white px-2 py-1 rounded-lg border">BP: {visit.vitals.bloodPressure}</span>
                          <span className="bg-white px-2 py-1 rounded-lg border">HR: {visit.vitals.heartRate}</span>
                          <span className="bg-white px-2 py-1 rounded-lg border">TEMP: {visit.vitals.temperature}°F</span>
                        </div>
                      </div>
                      <p className="text-black text-sm font-bold opacity-80 leading-relaxed">"{visit.notes}"</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'patient-labs' && selectedPatient && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
              <button onClick={() => setView('patient-detail')} className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-900 transition-colors"><ArrowLeft size={18} /> Back to Profile</button>
              <button onClick={() => { setEditingLab(null); resetLabForm(); setShowLabForm(true); }} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg"><Plus size={20} /> Add Lab Record</button>
            </div>
            
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Test Name</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Result</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Normal Range</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedPatient.labResults.length > 0 ? selectedPatient.labResults.map(lab => (
                    <tr key={lab.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-6 font-bold text-sm text-slate-500">{lab.date}</td>
                      <td className="px-8 py-6 font-black text-black">{lab.testName}</td>
                      <td className="px-8 py-6">
                        <span className={`font-black text-lg ${lab.status === 'Normal' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {lab.value} <span className="text-sm opacity-60">{lab.unit}</span>
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <span className="bg-slate-100 px-3 py-1 rounded-lg text-xs font-bold text-slate-600">{lab.referenceRange || 'N/A'}</span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => openEditLab(lab)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit3 size={18} /></button>
                          <button onClick={() => deleteLab(lab.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-8 py-20 text-center font-bold text-slate-400 italic">No lab records available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Lab Form Modal (Add/Edit) */}
      {showLabForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-extrabold text-black">{editingLab ? 'Update Lab Record' : 'Add Lab Record'}</h3>
              <button onClick={() => setShowLabForm(false)} className="text-slate-400 hover:text-black"><X size={24} /></button>
            </div>
            <form onSubmit={addOrUpdateLabResult} className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Date of Result</label>
                  <input required type="date" value={manualLabDate} onChange={e => setManualLabDate(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-black" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Test Parameter</label>
                  <div className="flex gap-2">
                    <select value={manualLabTestName} onChange={e => {
                      const def = labDefinitions.find(d => d.name === e.target.value);
                      if (def) {
                        setManualLabTestName(def.name);
                        setManualLabRange(def.defaultRange);
                        setManualLabUnit(def.defaultUnit);
                      } else {
                        setManualLabTestName(e.target.value);
                      }
                    }} className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-black">
                      <option value="">Select Test Type</option>
                      {labDefinitions.map(def => <option key={def.id} value={def.name}>{def.name}</option>)}
                      <option value="custom">Custom Entry</option>
                    </select>
                    {(!labDefinitions.find(d => d.name === manualLabTestName) && manualLabTestName !== "") && (
                       <input value={manualLabTestName} onChange={e => setManualLabTestName(e.target.value)} placeholder="Type name..." className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-black" />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Observed Value</label>
                  <input required value={manualLabValue} onChange={e => setManualLabValue(e.target.value)} type="text" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-black" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Unit</label>
                  <input value={manualLabUnit} onChange={e => setManualLabUnit(e.target.value)} type="text" placeholder="e.g. mg/dL" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-black" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Normal/Reference Range</label>
                  <input value={manualLabRange} onChange={e => setManualLabRange(e.target.value)} type="text" placeholder="e.g. 70 - 110" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-black" />
                </div>
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-blue-600 transition-all">{editingLab ? 'Update Entry' : 'Add to Record'}</button>
            </form>
          </div>
        </div>
      )}

      {/* Medication Form Modal */}
      {showMedicationForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-extrabold text-black">New Prescription</h3>
              <button onClick={() => setShowMedicationForm(false)} className="text-slate-400 hover:text-black"><X size={24} /></button>
            </div>
            <form onSubmit={addMedication} className="p-10 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Medication Name</label>
                  <input required name="name" type="text" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-black" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Dosage Instructions</label>
                  <input required name="dose" type="text" placeholder="e.g. 10mg daily" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-black" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Start Date</label>
                    <input required name="startDate" type="date" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-black" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">End Date (Optional)</label>
                    <input name="endDate" type="date" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-black" />
                  </div>
                </div>
              </div>
              <button type="submit" className="w-full bg-purple-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-purple-700 transition-all">Add Medication</button>
            </form>
          </div>
        </div>
      )}

      {/* Enroll/Edit Patient Modal */}
      {(isAddPatientOpen || isEditPatientOpen) && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden">
            <div className={`p-10 border-b border-slate-100 flex justify-between items-center text-white ${isEditPatientOpen ? 'bg-blue-600' : 'bg-slate-900'}`}>
              <h3 className="text-2xl font-black">{isEditPatientOpen ? 'Edit Patient' : 'Register Patient'}</h3>
              <button onClick={() => { setIsAddPatientOpen(false); setIsEditPatientOpen(false); }} className="text-white/60 hover:text-white"><X size={28} /></button>
            </div>
            <form onSubmit={isEditPatientOpen ? updatePatient : addPatient} className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Patient ID</label>
                  <input required name="id" defaultValue={isEditPatientOpen ? selectedPatient?.id : ''} type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-blue-500 outline-none text-black font-bold" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Legal Name</label>
                  <input required name="name" defaultValue={isEditPatientOpen ? selectedPatient?.name : ''} type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-blue-500 outline-none text-black font-bold" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Date of Birth</label>
                  <input required name="dob" defaultValue={isEditPatientOpen ? selectedPatient?.dob : ''} type="date" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-blue-500 outline-none text-black font-bold" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Gender</label>
                  <select name="gender" defaultValue={isEditPatientOpen ? selectedPatient?.gender : 'Male'} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 focus:border-blue-500 outline-none text-black font-bold">
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <button type="submit" className={`w-full text-white font-black py-5 rounded-3xl shadow-xl transition-all ${isEditPatientOpen ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-900 hover:bg-black'}`}>
                {isEditPatientOpen ? 'Update Record' : 'Register Patient'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Photo Viewer */}
      {isPhotoViewOpen && selectedPatient && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[60] flex items-center justify-center p-10" onClick={() => setIsPhotoViewOpen(false)}>
          <img src={selectedPatient.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedPatient.name}`} className="max-w-full max-h-full rounded-[3rem] shadow-2xl bg-white p-4" />
        </div>
      )}
    </div>
  );
};

// Helpers
const SidebarItem: React.FC<{ icon: React.ReactNode; label: string; active?: boolean; onClick: () => void; collapsed: boolean }> = ({ icon, label, active, onClick, collapsed }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${active ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}>
    <span className="shrink-0">{icon}</span>
    {!collapsed && <span className="font-semibold text-sm">{label}</span>}
  </button>
);

const PatientCardShortcut: React.FC<{ patient: Patient; onClick: () => void }> = ({ patient, onClick }) => (
  <div onClick={onClick} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-4 cursor-pointer hover:bg-white hover:border-blue-200 hover:shadow-sm transition-all">
    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200">
      <img src={patient.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${patient.name}`} className="w-full h-full object-cover" />
    </div>
    <div className="min-w-0">
      <p className="font-bold text-black truncate">{patient.name}</p>
      <p className="text-[10px] font-black text-slate-400 uppercase">ID: {patient.id}</p>
    </div>
  </div>
);

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
