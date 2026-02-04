
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Plus, Search, LayoutDashboard, Users, Settings, 
  ArrowLeft, Pill, Activity, Image as ImageIcon, Clipboard, 
  ChevronRight, ChevronLeft, Upload, Link as LinkIcon, 
  Heart, Thermometer, Droplets, Camera, 
  FlaskConical, Check, X, Edit3, Trash2, Microscope, Maximize2, Eye,
  Mail, Phone
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
}

interface LabDefinition {
  id: string;
  name: string;
  defaultRange: string;
  defaultUnit: string;
}

type ViewState = 'dashboard' | 'patient-detail' | 'patients-list' | 'settings';

// --- Services ---

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const parseLabResultsCSV = async (csvContent: string): Promise<Partial<LabResult>[]> => {
  const ai = getAI();
  const prompt = `
    Extract lab result data from the following text and return it as a structured JSON array.
    Ensure fields like date, testName, value, unit, and status are mapped.
    Status must be one of: 'Normal', 'Abnormal', 'Critical'.
    Text Content:
    ${csvContent}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              testName: { type: Type.STRING },
              value: { type: Type.STRING },
              unit: { type: Type.STRING },
              status: { type: Type.STRING, enum: ['Normal', 'Abnormal', 'Critical'] },
            },
            required: ['testName', 'value']
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Parsing error:", error);
    return [];
  }
};

const extractLabFromImage = async (base64Data: string): Promise<Partial<LabResult>[]> => {
  const ai = getAI();
  const prompt = `
    Analyze this medical lab report image. Extract all lab tests, their values, units, and status.
    Return as a JSON array.
    Status must be 'Normal', 'Abnormal', or 'Critical' based on the reference ranges if visible.
    Format the response as a valid JSON array of objects.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Data.split(',')[1], mimeType: 'image/jpeg' } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              testName: { type: Type.STRING },
              value: { type: Type.STRING },
              unit: { type: Type.STRING },
              status: { type: Type.STRING, enum: ['Normal', 'Abnormal', 'Critical'] },
            },
            required: ['testName', 'value']
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("OCR Vision Error:", error);
    return [];
  }
};

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
      { id: 'lb-2', date: '2024-02-10', testName: 'Total Cholesterol', value: '190', unit: 'mg/dL', referenceRange: '<200', status: 'Normal' },
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
    ]
  }
];

const DEFAULT_LAB_DEFINITIONS: LabDefinition[] = [
  { id: '1', name: 'Glucose', defaultRange: '70-99', defaultUnit: 'mg/dL' },
  { id: '2', name: 'Hemoglobin A1C', defaultRange: '4.0-5.6', defaultUnit: '%' },
  { id: '3', name: 'Total Cholesterol', defaultRange: '<200', defaultUnit: 'mg/dL' },
  { id: '4', name: 'Creatinine', defaultRange: '0.7-1.3', defaultUnit: 'mg/dL' },
  { id: '5', name: 'Potassium', defaultRange: '3.6-5.2', defaultUnit: 'mmol/L' },
  { id: '6', name: 'Sodium', defaultRange: '135-145', defaultUnit: 'mEq/L' },
  { id: '7', name: 'WBC Count', defaultRange: '4.5-11.0', defaultUnit: 'x10^3/uL' },
];

// --- Components ---

const PatientCard: React.FC<{ patient: Patient; onClick: () => void }> = ({ patient, onClick }) => {
  const age = new Date().getFullYear() - new Date(patient.dob).getFullYear();
  const avatarSrc = patient.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${patient.name}`;
  
  return (
    <div 
      onClick={onClick}
      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-100">
          <img src={avatarSrc} alt={patient.name} className="w-full h-full object-cover" />
        </div>
        <div className="bg-slate-50 px-2 py-1 rounded text-xs font-bold text-black uppercase tracking-tight">
          #{patient.id}
        </div>
      </div>
      
      <h3 className="font-bold text-black text-lg mb-1 truncate">{patient.name}</h3>
      <div className="text-sm text-black space-y-1">
        <p className="opacity-80">{patient.gender} • {age} years</p>
        <div className="flex items-center gap-1.5 pt-2">
          <Activity size={14} className="text-emerald-500" />
          <span className="text-xs font-bold">Last visit: {patient.visits[0]?.date || 'None'}</span>
        </div>
      </div>
      
      <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-100 text-blue-600 font-bold text-sm">
        View Profile
        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  );
};

const SidebarItem: React.FC<{ icon: React.ReactNode; label: string; active?: boolean; onClick: () => void; collapsed: boolean }> = ({ icon, label, active, onClick, collapsed }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
      active ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-600 hover:bg-slate-100'
    }`}
  >
    <span className="shrink-0">{icon}</span>
    {!collapsed && <span className="font-semibold text-sm">{label}</span>}
  </button>
);

// --- Main App ---

const App: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [view, setView] = useState<ViewState>('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [isEditPatientOpen, setIsEditPatientOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [labProcessing, setLabProcessing] = useState(false);
  const [isPhotoViewOpen, setIsPhotoViewOpen] = useState(false);
  
  // Lab Dictionary State
  const [labDefinitions, setLabDefinitions] = useState<LabDefinition[]>(DEFAULT_LAB_DEFINITIONS);

  // Manual Lab Entry State
  const [manualLabTestName, setManualLabTestName] = useState('');
  const [manualLabValue, setManualLabValue] = useState('');
  const [manualLabUnit, setManualLabUnit] = useState('');
  const [manualLabRange, setManualLabRange] = useState('');
  const [showLabForm, setShowLabForm] = useState(false);
  const [labFormType, setLabFormType] = useState<'manual' | 'upload' | 'camera'>('manual');

  // Radiology Link Input
  const [radType, setRadType] = useState('');
  const [radLink, setRadLink] = useState('');

  // Visit Form State
  const [showVisitForm, setShowVisitForm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const selectedPatient = useMemo(() => 
    patients.find(p => p.id === selectedPatientId), 
    [patients, selectedPatientId]
  );

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addPatient = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const customId = (formData.get('id') as string) || `pt-${Math.floor(1000 + Math.random() * 9000)}`;
    const newPatient: Patient = {
      id: customId,
      name: formData.get('name') as string,
      dob: formData.get('dob') as string,
      gender: formData.get('gender') as 'Male' | 'Female' | 'Other',
      contact: formData.get('contact') as string,
      email: formData.get('email') as string,
      bloodType: formData.get('bloodType') as string,
      labResults: [],
      radiology: [],
      visits: []
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
    
    setPatients(prev => prev.map(p => {
      if (p.id === selectedPatientId) {
        return {
          ...p,
          id: newId,
          name: formData.get('name') as string,
          dob: formData.get('dob') as string,
          gender: formData.get('gender') as 'Male' | 'Female' | 'Other',
          contact: formData.get('contact') as string,
          email: formData.get('email') as string,
          bloodType: formData.get('bloodType') as string,
        };
      }
      return p;
    }));
    
    setSelectedPatientId(newId);
    setIsEditPatientOpen(false);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPatientId) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setPatients(prev => prev.map(p => 
        p.id === selectedPatientId ? { ...p, avatar: base64 } : p
      ));
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedPatientId) return;
    setLabProcessing(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const parsedResults = await parseLabResultsCSV(text);
      setPatients(prev => prev.map(p => {
        if (p.id === selectedPatientId) {
          const newLabs: LabResult[] = parsedResults.map(r => ({
            id: `lb-${Math.random().toString(36).substr(2, 5)}`,
            date: r.date || new Date().toISOString().split('T')[0],
            testName: r.testName || 'Unknown',
            value: r.value || '0',
            unit: r.unit || '',
            referenceRange: '',
            status: (r.status as LabResult['status']) || 'Normal'
          } as LabResult));
          return { ...p, labResults: [...newLabs, ...p.labResults] };
        }
        return p;
      }));
      setLabProcessing(false);
      setShowLabForm(false);
    };
    reader.readAsText(file);
  };

  const handleCameraUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedPatientId) return;
    setLabProcessing(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      const parsedResults = await extractLabFromImage(base64);
      setPatients(prev => prev.map(p => {
        if (p.id === selectedPatientId) {
          const newLabs: LabResult[] = parsedResults.map(r => ({
            id: `lb-${Math.random().toString(36).substr(2, 5)}`,
            date: r.date || new Date().toISOString().split('T')[0],
            testName: r.testName || 'Unknown',
            value: r.value || '0',
            unit: r.unit || '',
            referenceRange: '',
            status: (r.status as LabResult['status']) || 'Normal'
          } as LabResult));
          return { ...p, labResults: [...newLabs, ...p.labResults] };
        }
        return p;
      }));
      setLabProcessing(false);
      setShowLabForm(false);
    };
    reader.readAsDataURL(file);
  };

  const addRadiologyLink = () => {
    if (!selectedPatientId || !radLink || !radType) return;
    setPatients(prev => prev.map(p => {
      if (p.id === selectedPatientId) {
        const newImg: RadiologyImage = {
          id: `rad-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          type: radType,
          description: 'Added via link',
          link: radLink
        };
        return { ...p, radiology: [newImg, ...p.radiology] };
      }
      return p;
    }));
    setRadType('');
    setRadLink('');
  };

  const addManualLabResult = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !manualLabTestName || !manualLabValue) return;
    const newLab: LabResult = {
      id: `lb-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      testName: manualLabTestName,
      value: manualLabValue,
      unit: manualLabUnit,
      referenceRange: manualLabRange,
      status: 'Normal'
    };
    setPatients(prev => prev.map(p => p.id === selectedPatientId ? { ...p, labResults: [newLab, ...p.labResults] } : p));
    setShowLabForm(false);
    setManualLabTestName('');
    setManualLabValue('');
    setManualLabUnit('');
    setManualLabRange('');
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
    setPatients(prev => prev.map(p => 
      p.id === selectedPatientId ? { ...p, visits: [newVisit, ...p.visits] } : p
    ));
    setShowVisitForm(false);
    e.currentTarget.reset();
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
          <SidebarItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={view === 'dashboard'} 
            onClick={() => setView('dashboard')}
            collapsed={isSidebarCollapsed}
          />
          <SidebarItem 
            icon={<Users size={20} />} 
            label="Patients" 
            active={view === 'patients-list' || view === 'patient-detail'} 
            onClick={() => setView('patients-list')}
            collapsed={isSidebarCollapsed}
          />
          <SidebarItem 
            icon={<Settings size={20} />} 
            label="Settings" 
            active={view === 'settings'} 
            onClick={() => setView('settings')}
            collapsed={isSidebarCollapsed}
          />
        </nav>

        <div className="mt-auto pt-10 px-2">
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="w-full flex items-center gap-3 p-3 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {isSidebarCollapsed ? <ChevronRight size={20} /> : <div className="flex items-center gap-3"><ChevronLeft size={20} /> <span className="text-sm font-medium text-black font-bold">Collapse</span></div>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-extrabold text-black">
              {view === 'dashboard' && "Clinic Overview"}
              {view === 'patients-list' && "Patient Directory"}
              {view === 'patient-detail' && "Patient Record"}
              {view === 'settings' && "System Settings"}
            </h2>
            <p className="text-slate-500 font-medium mt-1">
              Welcome back, Dr. Julian Vance.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search patient or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-black font-bold"
              />
            </div>
            <button 
              onClick={() => setIsAddPatientOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-200"
            >
              <Plus size={20} />
              Add Patient
            </button>
          </div>
        </header>

        {view === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-6">
                <div className="p-4 bg-slate-50 rounded-xl"><Users className="text-blue-500" /></div>
                <div>
                  <div className="text-2xl font-black text-black">{patients.length}</div>
                  <div className="text-sm font-bold text-slate-500">Total Registered Patients</div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-xl text-black">Patient Directory Preview</h3>
                <button onClick={() => setView('patients-list')} className="text-blue-600 font-bold text-sm">View full list</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {patients.slice(0, 8).map(p => (
                  <PatientCard key={p.id} patient={p} onClick={() => { setSelectedPatientId(p.id); setView('patient-detail'); }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'patients-list' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
               {filteredPatients.map(p => (
                 <PatientCard key={p.id} patient={p} onClick={() => { setSelectedPatientId(p.id); setView('patient-detail'); }} />
               ))}
               <button 
                onClick={() => setIsAddPatientOpen(true)}
                className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/30 transition-all group"
               >
                 <div className="w-12 h-12 rounded-full border-2 border-slate-200 flex items-center justify-center group-hover:border-blue-400 transition-colors">
                    <Plus size={24} />
                 </div>
                 <span className="font-bold">Add New Patient</span>
               </button>
             </div>
          </div>
        )}

        {view === 'patient-detail' && selectedPatient && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setView('patients-list')}
                className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-900 transition-colors"
              >
                <ArrowLeft size={18} />
                Back to Patients
              </button>
              <button 
                onClick={() => setIsEditPatientOpen(true)}
                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-black transition-all"
              >
                <Edit3 size={18} />
                Edit Profile Info
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Profile Side */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center relative group">
                  <div className="relative w-32 h-32 mx-auto mb-4">
                    <img 
                      src={selectedPatient.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedPatient.name}`} 
                      className="w-full h-full rounded-[2.5rem] object-cover shadow-inner border-4 border-slate-50" 
                    />
                    <div className="absolute bottom-1 right-1 flex gap-2">
                      <button 
                        onClick={() => avatarInputRef.current?.click()}
                        className="bg-white p-2 rounded-xl shadow-lg text-emerald-600 hover:text-emerald-800 transition-all border border-slate-100 hover:scale-110"
                        title="Edit Photo"
                      >
                        <Camera size={16} />
                      </button>
                      <button 
                        onClick={() => setIsPhotoViewOpen(true)}
                        className="bg-white p-2 rounded-xl shadow-lg text-blue-600 hover:text-blue-800 transition-all border border-slate-100 hover:scale-110"
                        title="View Full Picture"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                    <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
                  </div>
                  <h3 className="text-3xl font-black text-black leading-tight">{selectedPatient.name}</h3>
                  <div className="mt-1 flex items-center justify-center gap-2">
                    <span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-black text-slate-500 uppercase">Patient ID</span>
                    <p className="text-slate-900 font-bold">{selectedPatient.id}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-slate-100">
                    <div className="text-left">
                      <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Age</span>
                      <span className="font-bold text-black text-lg">
                        {new Date().getFullYear() - new Date(selectedPatient.dob).getFullYear()} yrs
                      </span>
                    </div>
                    <div className="text-left">
                      <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Blood Type</span>
                      <span className="font-bold text-rose-600 text-lg">{selectedPatient.bloodType}</span>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3 text-left">
                    <div className="flex items-center gap-3 text-sm font-bold text-black">
                      <Mail size={16} className="text-slate-300" /> {selectedPatient.email}
                    </div>
                    <div className="flex items-center gap-3 text-sm font-bold text-black">
                      <Phone size={16} className="text-slate-300" /> {selectedPatient.contact}
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                   <h4 className="font-extrabold text-lg text-black mb-4 flex items-center gap-2">
                    <FlaskConical size={20} className="text-blue-600" />
                    Laboratory Summary
                  </h4>
                  <div className="space-y-4">
                    {selectedPatient.labResults.length > 0 ? selectedPatient.labResults.slice(0, 3).map(lab => (
                      <div key={lab.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-black">{lab.testName}</span>
                          <span className="text-[10px] text-slate-400 font-bold">{lab.date}</span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-sm font-black text-black">{lab.value} {lab.unit}</span>
                          <span className={`text-[9px] font-black uppercase ${lab.status === 'Normal' ? 'text-emerald-600' : 'text-rose-600'}`}>{lab.status}</span>
                        </div>
                      </div>
                    )) : (
                      <p className="text-xs text-slate-400 font-bold italic">No lab results available.</p>
                    )}
                    <button 
                      onClick={() => setShowLabForm(true)}
                      className="w-full py-2.5 bg-blue-50 text-blue-600 font-bold text-xs hover:bg-blue-100 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> Add Results
                    </button>
                  </div>
                </div>
              </div>

              {/* Visits Section */}
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden p-8">
                  <div className="flex justify-between items-center mb-8">
                    <h4 className="font-extrabold text-xl text-black flex items-center gap-2">
                      <Clipboard size={22} className="text-blue-600" />
                      Clinical Visits & History
                    </h4>
                    <button 
                      onClick={() => setShowVisitForm(!showVisitForm)}
                      className={`text-sm font-bold px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 ${showVisitForm ? 'bg-rose-50 text-rose-600' : 'bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-700'}`}
                    >
                      {showVisitForm ? <X size={18} /> : <Plus size={18} />}
                      {showVisitForm ? 'Cancel' : 'Record New Visit'}
                    </button>
                  </div>

                  {showVisitForm && (
                    <div className="mb-10 bg-slate-50 p-8 rounded-3xl border border-slate-200 animate-in slide-in-from-top-4 duration-300">
                      <h5 className="font-black text-black mb-6 uppercase tracking-widest text-[10px]">Consultation Record Entry</h5>
                      <form onSubmit={addVisitNote} className="space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">BP (mmHg)</label>
                            <input name="bp" required type="text" placeholder="120/80" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-black focus:ring-2 focus:ring-blue-500/10 outline-none" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Heart Rate (bpm)</label>
                            <input name="hr" required type="text" placeholder="72" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-black focus:ring-2 focus:ring-blue-500/10 outline-none" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Temp (°F)</label>
                            <input name="temp" required type="text" placeholder="98.6" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-black focus:ring-2 focus:ring-blue-500/10 outline-none" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Chief Complaint / Primary Diagnosis</label>
                          <input name="diagnosis" required type="text" placeholder="e.g. Chronic joint pain assessment" className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-sm font-bold text-black outline-none" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Doctor's Consultation Notes</label>
                          <textarea name="notes" required rows={5} placeholder="Type detailed clinical observations here..." className="w-full bg-white border border-slate-200 rounded-xl px-5 py-4 text-sm font-bold text-black focus:ring-2 focus:ring-blue-500/10 outline-none resize-none" />
                        </div>
                        <button type="submit" className="w-full bg-black text-white py-4 rounded-2xl font-black shadow-lg hover:bg-blue-600 transition-all flex items-center justify-center gap-2">
                          <Check size={20} /> Save Clinical Visit Record
                        </button>
                      </form>
                    </div>
                  )}

                  <div className="space-y-6">
                    {selectedPatient.visits.length > 0 ? selectedPatient.visits.map(visit => (
                      <div key={visit.id} className="p-7 rounded-[2.5rem] border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-xl hover:shadow-slate-100 transition-all">
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">{visit.date}</p>
                            <h5 className="font-extrabold text-black text-xl leading-tight">{visit.diagnosis}</h5>
                          </div>
                          <div className="flex gap-2">
                             <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-100 text-[10px] font-black text-black shadow-sm flex items-center gap-1.5">
                              <Activity size={12} className="text-blue-600" /> {visit.vitals.bloodPressure} <span className="text-slate-400 font-medium">BP</span>
                             </div>
                             <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-100 text-[10px] font-black text-black shadow-sm flex items-center gap-1.5">
                              <Heart size={12} className="text-rose-600" /> {visit.vitals.heartRate} <span className="text-slate-400 font-medium">BPM</span>
                             </div>
                             <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-100 text-[10px] font-black text-black shadow-sm flex items-center gap-1.5">
                              <Thermometer size={12} className="text-emerald-600" /> {visit.vitals.temperature} <span className="text-slate-400 font-medium">°F</span>
                             </div>
                          </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm leading-relaxed">
                          <p className="text-black text-sm font-bold whitespace-pre-line opacity-90">
                            {visit.notes}
                          </p>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-24 border-2 border-dashed border-slate-100 rounded-[3rem]">
                        <Clipboard size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-slate-400 font-bold italic">No consultation history recorded for this patient.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Radiology & Imaging (Functional link system) */}
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden p-8">
                  <h4 className="font-extrabold text-xl text-black flex items-center gap-2 mb-6">
                    <ImageIcon size={22} className="text-blue-600" />
                    Imaging Links (PACS/DICOM)
                  </h4>
                  <div className="space-y-4">
                    {selectedPatient.radiology.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedPatient.radiology.map(rad => (
                          <div key={rad.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-100">
                                <ImageIcon size={20} />
                              </div>
                              <div>
                                <p className="font-bold text-black text-sm">{rad.type}</p>
                                <p className="text-[10px] text-slate-400 font-bold">{rad.date}</p>
                              </div>
                            </div>
                            <a href={rad.link} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                              <LinkIcon size={18} />
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 font-bold italic">No radiology links recorded.</p>
                    )}
                    
                    <div className="pt-6 mt-6 border-t border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Link New Imaging Study</p>
                      <div className="flex gap-3">
                        <input 
                          value={radType}
                          onChange={e => setRadType(e.target.value)}
                          placeholder="Study Type (e.g. MRI Brain)" 
                          className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-black outline-none focus:border-blue-400"
                        />
                        <input 
                          value={radLink}
                          onChange={e => setRadLink(e.target.value)}
                          placeholder="Secure Viewer URL..." 
                          className="flex-[2] bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-black outline-none focus:border-blue-400"
                        />
                        <button 
                          onClick={addRadiologyLink}
                          className="bg-slate-900 text-white px-6 rounded-xl font-bold hover:bg-black transition-all flex items-center gap-2"
                        >
                          <LinkIcon size={18} /> Link
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm animate-in fade-in duration-500">
            <h3 className="text-2xl font-black text-black mb-8">Clinical Lab Dictionary</h3>
            <div className="space-y-4 max-w-2xl">
              {labDefinitions.map(def => (
                <div key={def.id} className="flex items-center justify-between p-5 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-all">
                  <div className="text-black font-bold">
                    <div className="text-lg">{def.name}</div>
                    <div className="text-xs text-slate-400 uppercase tracking-widest mt-1">Ref Range: {def.defaultRange} {def.defaultUnit}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Register Patient Modal */}
      {isAddPatientOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
              <h3 className="text-2xl font-black">Register New Patient</h3>
              <button onClick={() => setIsAddPatientOpen(false)} className="text-slate-400 hover:text-white"><X size={28} /></button>
            </div>
            <form onSubmit={addPatient} className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Patient Identification (ID)</label>
                  <input required name="id" type="text" placeholder="e.g. PT-2024-001" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 focus:border-blue-500 outline-none text-black font-bold" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Full Legal Name</label>
                  <input required name="name" type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 focus:border-blue-500 outline-none text-black font-bold" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Date of Birth</label>
                  <input required name="dob" type="date" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 focus:border-blue-500 outline-none text-black font-bold" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Gender</label>
                  <select name="gender" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 focus:border-blue-500 outline-none text-black font-bold">
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-3xl shadow-xl shadow-blue-200 transition-all mt-4 text-lg">
                Complete Enrollment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Patient Modal */}
      {isEditPatientOpen && selectedPatient && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-blue-600 text-white">
              <h3 className="text-2xl font-black">Edit Clinical Profile</h3>
              <button onClick={() => setIsEditPatientOpen(false)} className="text-white/60 hover:text-white"><X size={28} /></button>
            </div>
            <form onSubmit={updatePatient} className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Update Patient ID</label>
                  <input required name="id" defaultValue={selectedPatient.id} type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 focus:border-blue-500 outline-none text-black font-bold" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Full Legal Name</label>
                  <input required name="name" defaultValue={selectedPatient.name} type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 focus:border-blue-500 outline-none text-black font-bold" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Date of Birth</label>
                  <input required name="dob" defaultValue={selectedPatient.dob} type="date" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 focus:border-blue-500 outline-none text-black font-bold" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Gender</label>
                  <select name="gender" defaultValue={selectedPatient.gender} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 focus:border-blue-500 outline-none text-black font-bold">
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full bg-slate-900 hover:bg-black text-white font-black py-5 rounded-3xl shadow-xl shadow-slate-200 transition-all mt-4 text-lg">
                Update Record
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Lab Results Modal (Restored Add feature) */}
      {showLabForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-extrabold text-black">Laboratory Data Entry</h3>
              <button onClick={() => setShowLabForm(false)} className="text-slate-400 hover:text-black"><X size={24} /></button>
            </div>
            <div className="p-10">
              <form onSubmit={addManualLabResult} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Test Parameter</label>
                    <select 
                      required
                      onChange={(e) => {
                        const def = labDefinitions.find(d => d.name === e.target.value);
                        if (def) {
                          setManualLabTestName(def.name);
                          setManualLabRange(def.defaultRange);
                          setManualLabUnit(def.defaultUnit);
                        } else {
                          setManualLabTestName(e.target.value);
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-black"
                    >
                      <option value="">Select Test Type</option>
                      {labDefinitions.map(def => <option key={def.id} value={def.name}>{def.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Observed Value</label>
                    <input required value={manualLabValue} onChange={e => setManualLabValue(e.target.value)} type="text" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-black" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Unit</label>
                    <input value={manualLabUnit} onChange={e => setManualLabUnit(e.target.value)} type="text" placeholder="e.g. mg/dL" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-black" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl transition-all shadow-lg">
                  Commit Lab Results
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Photo View Modal */}
      {isPhotoViewOpen && selectedPatient && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-10">
          <button 
            onClick={() => setIsPhotoViewOpen(false)}
            className="absolute top-10 right-10 text-white/50 hover:text-white transition-colors"
          >
            <X size={48} />
          </button>
          <div className="max-w-4xl max-h-full flex flex-col items-center gap-6">
            <img 
              src={selectedPatient.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedPatient.name}`} 
              className="max-w-full max-h-[80vh] rounded-[3rem] shadow-2xl border-8 border-white/10 object-contain bg-white" 
              alt={selectedPatient.name}
            />
            <h4 className="text-3xl font-black text-white">{selectedPatient.name}</h4>
            <p className="text-white/60 font-bold uppercase tracking-widest text-xs">Patient ID: {selectedPatient.id}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
