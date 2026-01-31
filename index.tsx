
import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Plus, Search, LayoutDashboard, Users, FileText, Settings, LogOut, 
  ArrowLeft, Pill, Activity, Image as ImageIcon, Clipboard, 
  ChevronRight, Upload, Link as LinkIcon, Sparkles, AlertCircle,
  User, Calendar, Mail, Phone, Heart, Thermometer, Droplets
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
  labResults: LabResult[];
  radiology: RadiologyImage[];
  visits: VisitNote[];
}

type ViewState = 'dashboard' | 'patient-detail';

// --- Services ---

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const summarizePatientHistory = async (patient: Patient): Promise<string> => {
  const prompt = `
    Analyze the following patient history and provide a concise medical summary for a doctor.
    Focus on trends in lab results and key findings from recent visits. 
    Use medical terminology but keep it actionable.

    Patient: ${patient.name} (${patient.gender}, DOB: ${patient.dob})
    Lab Results: ${JSON.stringify(patient.labResults.slice(-5))}
    Recent Visits: ${JSON.stringify(patient.visits.slice(-3))}

    Summary should be formatted in clean Markdown without code blocks.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "No summary available.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Clinical insight unavailable at this time.";
  }
};

const parseLabResultsCSV = async (csvContent: string): Promise<Partial<LabResult>[]> => {
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
      { id: 'lb-1', date: '2024-02-10', testName: 'A1C', value: '5.8', unit: '%', referenceRange: '4.0-5.6', status: 'Abnormal' },
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
  },
  {
    id: 'pt-8821',
    name: 'Marcus Thorne',
    dob: '1992-04-22',
    gender: 'Male',
    contact: '+1 415-555-0212',
    email: 'm.thorne@example.com',
    bloodType: 'A-',
    labResults: [],
    radiology: [],
    visits: []
  }
];

// --- Components ---

const PatientCard: React.FC<{ patient: Patient; onClick: () => void }> = ({ patient, onClick }) => {
  const age = new Date().getFullYear() - new Date(patient.dob).getFullYear();
  return (
    <div 
      onClick={onClick}
      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="bg-blue-50 p-3 rounded-xl group-hover:bg-blue-100 transition-colors">
          <User className="text-blue-600 w-6 h-6" />
        </div>
        <div className="bg-slate-50 px-2 py-1 rounded text-xs font-bold text-slate-500 uppercase tracking-tight">
          #{patient.id}
        </div>
      </div>
      
      <h3 className="font-bold text-slate-900 text-lg mb-1">{patient.name}</h3>
      <div className="text-sm text-slate-500 space-y-1">
        <p>{patient.gender} • {age} years</p>
        <div className="flex items-center gap-1.5 pt-2">
          <Activity size={14} className="text-emerald-500" />
          <span className="text-xs">Last visit: {patient.visits[0]?.date || 'None'}</span>
        </div>
      </div>
      
      <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-100 text-blue-600 font-bold text-sm">
        View Profile
        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  );
};

// --- Main App ---

const App: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [view, setView] = useState<ViewState>('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const selectedPatient = useMemo(() => 
    patients.find(p => p.id === selectedPatientId), 
    [patients, selectedPatientId]
  );

  useEffect(() => {
    if (selectedPatientId && selectedPatient) {
      handleGetAiSummary(selectedPatient);
    } else {
      setAiSummary(null);
    }
  }, [selectedPatientId]);

  const handleGetAiSummary = async (patient: Patient) => {
    setIsAiLoading(true);
    const summary = await summarizePatientHistory(patient);
    setAiSummary(summary);
    setIsAiLoading(false);
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addPatient = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newPatient: Patient = {
      id: `pt-${Math.floor(1000 + Math.random() * 9000)}`,
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
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedPatientId) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const parsedResults = await parseLabResultsCSV(text);
      
      const updatedPatients = patients.map(p => {
        if (p.id === selectedPatientId) {
          const newLabs: LabResult[] = parsedResults.map(r => ({
            ...r,
            id: `lb-${Math.random().toString(36).substr(2, 5)}`,
            date: r.date || new Date().toISOString().split('T')[0],
            testName: r.testName || 'Unknown',
            value: r.value || '0',
            unit: r.unit || '',
            referenceRange: '',
            status: (r.status as LabResult['status']) || 'Normal'
          } as LabResult));
          return { ...p, labResults: [...p.labResults, ...newLabs] };
        }
        return p;
      });
      setPatients(updatedPatients);
    };
    reader.readAsText(file);
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
    e.currentTarget.reset();
  };

  const addRadiologyLink = (link: string, type: string) => {
    if (!selectedPatientId) return;
    setPatients(prev => prev.map(p => {
      if (p.id === selectedPatientId) {
        return { 
          ...p, 
          radiology: [{ id: `rad-${Date.now()}`, date: new Date().toISOString().split('T')[0], type, description: 'Quick Link', link }, ...p.radiology] 
        };
      }
      return p;
    }));
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-400 flex flex-col fixed h-full z-20 shadow-2xl">
        <div className="p-8 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-blue-600 p-2.5 rounded-xl">
            <Activity className="text-white w-6 h-6" />
          </div>
          <span className="text-xl font-black text-white tracking-tight">MedLink Pro</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1.5">
          <button 
            onClick={() => { setView('dashboard'); setSelectedPatientId(null); }}
            className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all font-semibold ${view === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-slate-800 hover:text-slate-200 transition-all font-semibold">
            <Users size={20} /> Patients
          </button>
          <button className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-slate-800 hover:text-slate-200 transition-all font-semibold">
            <FileText size={20} /> Reports
          </button>
          <button className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-slate-800 hover:text-slate-200 transition-all font-semibold">
            <Settings size={20} /> Settings
          </button>
        </nav>
        
        <div className="p-6 border-t border-slate-800">
          <button className="flex items-center gap-3 w-full p-3 rounded-xl text-slate-500 hover:bg-red-900/20 hover:text-red-400 transition-all font-semibold">
            <LogOut size={20} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 h-20 flex items-center justify-between px-10 shrink-0">
          <div className="flex items-center gap-6 flex-1">
            {view === 'patient-detail' && (
              <button onClick={() => setView('dashboard')} className="p-2.5 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                <ArrowLeft size={22} />
              </button>
            )}
            <div className="relative w-full max-w-lg">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search by name, ID, or condition..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-5 ml-8">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-900 leading-none">Dr. Julian Vance</p>
              <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mt-1">General Surgery</p>
            </div>
            <div className="w-11 h-11 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-slate-200">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Julian" alt="Doctor" />
            </div>
          </div>
        </header>

        {/* View Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
          {view === 'dashboard' ? (
            <div className="space-y-10 animate-in fade-in duration-500">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-4xl font-black text-slate-900 tracking-tight">Clinic Dashboard</h1>
                  <p className="text-slate-500 font-medium mt-1">Welcome back. You have <span className="text-blue-600 font-bold">12</span> appointments today.</p>
                </div>
                <button 
                  onClick={() => setIsAddPatientOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-2xl flex items-center gap-2.5 font-bold shadow-xl shadow-blue-200 transition-all hover:-translate-y-0.5"
                >
                  <Plus size={22} /> Add New Patient
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Active Patients', val: patients.length, change: '+2 this week', icon: Users, color: 'blue' },
                  { label: 'Critical Results', val: '03', change: 'High Priority', icon: AlertCircle, color: 'red' },
                  { label: 'Daily Consults', val: '14', change: '80% completed', icon: Calendar, color: 'emerald' },
                  { label: 'Patient Rating', val: '4.9', change: 'Top Tier', icon: Sparkles, color: 'amber' },
                ].map((s, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className={`w-12 h-12 rounded-2xl bg-${s.color}-50 text-${s.color}-600 flex items-center justify-center mb-4`}>
                      <s.icon size={24} />
                    </div>
                    <p className="text-slate-400 text-xs font-black uppercase tracking-widest">{s.label}</p>
                    <h2 className="text-3xl font-black text-slate-900 mt-1">{s.val}</h2>
                    <p className={`mt-2 text-${s.color}-600 text-xs font-bold`}>{s.change}</p>
                  </div>
                ))}
              </div>

              {/* Patient List */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black text-slate-900">Recent Patients</h2>
                  <button className="text-blue-600 font-bold text-sm hover:underline">View Directory</button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredPatients.map(patient => (
                    <PatientCard 
                      key={patient.id} 
                      patient={patient} 
                      onClick={() => {
                        setSelectedPatientId(patient.id);
                        setView('patient-detail');
                      }}
                    />
                  ))}
                  {filteredPatients.length === 0 && (
                    <div className="col-span-full py-20 text-center">
                      <Search className="mx-auto text-slate-200 mb-4" size={48} />
                      <p className="text-slate-400 font-bold text-lg">No patients found matching your search.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : selectedPatient ? (
            <div className="space-y-8 animate-in slide-in-from-bottom-6 fade-in duration-500">
              {/* Profile Card */}
              <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm relative overflow-hidden flex flex-col md:flex-row gap-8 items-start">
                <div className="absolute top-0 right-0 p-8 flex gap-2">
                  <div className="bg-red-50 text-red-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 flex items-center gap-1.5">
                    <Droplets size={12} /> Blood Type: {selectedPatient.bloodType}
                  </div>
                </div>

                <div className="w-28 h-28 bg-slate-100 rounded-3xl overflow-hidden shrink-0 border border-slate-200 shadow-inner">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedPatient.name}`} alt="Profile" className="w-full h-full object-cover" />
                </div>
                
                <div className="flex-1 space-y-6">
                  <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">{selectedPatient.name}</h1>
                    <div className="flex items-center gap-3 mt-1.5 text-slate-500 font-medium">
                      <span>{selectedPatient.gender}</span>
                      <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                      <span>DOB: {selectedPatient.dob}</span>
                      <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                      <span className="text-blue-600 font-bold">#{selectedPatient.id}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Primary Email</p>
                      <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                        <Mail size={14} className="text-slate-300" /> {selectedPatient.email}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Contact No.</p>
                      <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                        <Phone size={14} className="text-slate-300" /> {selectedPatient.contact}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Insight Section */}
              <div className="bg-indigo-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-800 rounded-full blur-3xl opacity-50"></div>
                <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-blue-600 rounded-full blur-3xl opacity-30"></div>
                
                <div className="relative z-10 flex gap-6">
                  <div className="bg-white/10 p-3.5 rounded-2xl backdrop-blur-md h-fit">
                    <Sparkles className="text-indigo-200 w-7 h-7" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-black mb-3 flex items-center gap-3">
                      Clinical Intelligence Insight
                      {isAiLoading && <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping" />}
                    </h3>
                    <div className="text-indigo-100 text-sm leading-relaxed prose prose-invert prose-sm max-w-none font-medium opacity-90">
                      {isAiLoading ? (
                        <div className="space-y-2">
                          <div className="h-4 bg-white/5 rounded w-3/4 animate-pulse"></div>
                          <div className="h-4 bg-white/5 rounded w-1/2 animate-pulse"></div>
                        </div>
                      ) : (
                        aiSummary || "Add more clinical data to generate AI insights."
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
                {/* Left Column: Results and Imaging */}
                <div className="lg:col-span-3 space-y-10">
                  {/* Lab Results Table */}
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <Activity className="text-blue-600" /> Lab Observations
                      </h2>
                      <label className="bg-white border-2 border-slate-100 px-5 py-2.5 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 cursor-pointer flex items-center gap-2.5 transition-all active:scale-95 shadow-sm">
                        <Upload size={18} className="text-blue-600" /> Bulk Upload (CSV)
                        <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                      </label>
                    </div>
                    
                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Test Parameter</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Result</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedPatient.labResults.length > 0 ? selectedPatient.labResults.map(lab => (
                              <tr key={lab.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-6 py-5 text-sm text-slate-500 font-bold">{lab.date}</td>
                                <td className="px-6 py-5">
                                  <p className="text-sm text-slate-900 font-black">{lab.testName}</p>
                                  <p className="text-[11px] text-slate-400 font-bold">Ref: {lab.referenceRange || 'N/A'}</p>
                                </td>
                                <td className="px-6 py-5 text-sm text-slate-900 font-black">
                                  {lab.value} <span className="text-slate-400 font-medium ml-1">{lab.unit}</span>
                                </td>
                                <td className="px-6 py-5">
                                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                                    lab.status === 'Normal' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                                    lab.status === 'Abnormal' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-red-50 text-red-600 border border-red-100'
                                  }`}>
                                    {lab.status}
                                  </span>
                                </td>
                              </tr>
                            )) : (
                              <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-bold italic">
                                  No clinical data available for this profile.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Radiology Imaging */}
                  <div className="space-y-6">
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                      <ImageIcon className="text-blue-600" /> Imaging Studies
                    </h2>
                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                      {selectedPatient.radiology.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedPatient.radiology.map(rad => (
                            <div key={rad.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="bg-white p-2.5 rounded-xl shadow-sm border border-slate-200 text-slate-500">
                                  <ImageIcon size={20} />
                                </div>
                                <div>
                                  <p className="font-black text-slate-900 leading-tight">{rad.type}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{rad.date}</p>
                                </div>
                              </div>
                              <a 
                                href={rad.link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 p-2 hover:bg-white rounded-xl transition-all"
                              >
                                <LinkIcon size={20} />
                              </a>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-400 font-medium text-center py-6 text-sm">No external imaging links recorded.</p>
                      )}
                      
                      <div className="pt-8 border-t border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Add Imaging Link (PACS/DICOM)</p>
                        <div className="flex gap-3">
                          <input 
                            id="rad-type"
                            type="text" 
                            placeholder="Study Type (e.g. CT Chest)" 
                            className="w-1/3 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold"
                          />
                          <input 
                            id="rad-link"
                            type="text" 
                            placeholder="Secure URL..." 
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold"
                          />
                          <button 
                            onClick={() => {
                              const type = (document.getElementById('rad-type') as HTMLInputElement).value;
                              const link = (document.getElementById('rad-link') as HTMLInputElement).value;
                              if (type && link) {
                                addRadiologyLink(link, type);
                                (document.getElementById('rad-type') as HTMLInputElement).value = '';
                                (document.getElementById('rad-link') as HTMLInputElement).value = '';
                              }
                            }}
                            className="bg-slate-900 text-white px-6 rounded-2xl font-bold hover:bg-slate-800 transition-all"
                          >
                            Link Study
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Visit Notes */}
                <div className="lg:col-span-2 space-y-8">
                  <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                    <Clipboard className="text-blue-600" /> Clinical Notes
                  </h2>
                  
                  {/* New Note Form */}
                  <form onSubmit={addVisitNote} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-1">
                          <Droplets size={10} /> BP
                        </label>
                        <input name="bp" required type="text" placeholder="120/80" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:bg-white transition-all" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-1">
                          <Heart size={10} /> HR
                        </label>
                        <input name="hr" required type="text" placeholder="72" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:bg-white transition-all" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-1">
                          <Thermometer size={10} /> Temp
                        </label>
                        <input name="temp" required type="text" placeholder="98.6" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:bg-white transition-all" />
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Primary Reason / Diagnosis</label>
                      <input name="diagnosis" required type="text" placeholder="e.g. Hypertension review" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold focus:bg-white transition-all" />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Medical Observations</label>
                      <textarea name="notes" required rows={6} placeholder="Detailed medical summary..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium focus:bg-white transition-all resize-none" />
                    </div>
                    
                    <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                      <Pill size={20} /> Record Consultation
                    </button>
                  </form>

                  {/* Note History */}
                  <div className="space-y-4">
                    {selectedPatient.visits.length > 0 ? selectedPatient.visits.map(visit => (
                      <div key={visit.id} className="bg-white p-7 rounded-3xl border border-slate-200 shadow-sm space-y-4 hover:border-slate-300 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">{visit.date}</p>
                            <h4 className="font-black text-slate-900 text-lg leading-tight">{visit.diagnosis}</h4>
                          </div>
                          <div className="flex gap-3 text-[10px] font-black text-slate-400">
                            <span className="flex items-center gap-1 px-2 py-1 bg-slate-50 rounded-lg">{visit.vitals.bloodPressure}</span>
                          </div>
                        </div>
                        <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line font-medium opacity-90">{visit.notes}</p>
                      </div>
                    )) : (
                      <div className="bg-slate-100/50 border-2 border-dashed border-slate-200 p-10 rounded-3xl text-center">
                        <p className="text-slate-400 font-bold italic text-sm">No historical clinical notes found.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      {/* Modals */}
      {isAddPatientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] w-full max-w-2xl shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-slate-900 p-10 text-white flex justify-between items-center relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-3xl font-black tracking-tight">Enroll Patient</h2>
                <p className="text-slate-400 font-bold mt-1 uppercase text-[10px] tracking-[0.2em]">New Medical Record Creation</p>
              </div>
              <button onClick={() => setIsAddPatientOpen(false)} className="bg-white/10 p-3 rounded-2xl hover:bg-white/20 transition-all text-white relative z-10">
                <Plus className="rotate-45" size={28} />
              </button>
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-20"></div>
            </div>
            
            <form onSubmit={addPatient} className="p-10 grid grid-cols-2 gap-8">
              <div className="col-span-2 space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Legal Name</label>
                <input name="name" required type="text" placeholder="e.g. Jonathan Thorne" className="w-full bg-slate-50 border-2 border-slate-100 py-3.5 px-6 rounded-2xl focus:border-blue-500 outline-none text-lg font-bold transition-all" />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date of Birth</label>
                <input name="dob" required type="date" className="w-full bg-slate-50 border-2 border-slate-100 py-3.5 px-6 rounded-2xl focus:border-blue-500 outline-none font-bold transition-all" />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sex Assigned at Birth</label>
                <select name="gender" className="w-full bg-slate-50 border-2 border-slate-100 py-3.5 px-6 rounded-2xl focus:border-blue-500 outline-none font-bold transition-all">
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Blood Type</label>
                <select name="bloodType" className="w-full bg-slate-50 border-2 border-slate-100 py-3.5 px-6 rounded-2xl focus:border-blue-500 outline-none font-bold transition-all">
                  {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Number</label>
                <input name="contact" required type="tel" placeholder="+1..." className="w-full bg-slate-50 border-2 border-slate-100 py-3.5 px-6 rounded-2xl focus:border-blue-500 outline-none font-bold transition-all" />
              </div>

              <div className="col-span-2 space-y-1.5 pt-4">
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-[24px] font-black text-xl shadow-2xl shadow-blue-200 transition-all active:scale-[0.98]">
                  Initialize Medical Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
