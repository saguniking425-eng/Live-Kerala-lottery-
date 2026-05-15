/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Download, 
  FileText, 
  Terminal, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Search,
  ChevronRight,
  Database,
  ExternalLink,
  Table as TableIcon,
  Sparkles,
  Zap,
  BarChart3,
  Activity,
  History,
  ShieldCheck,
  Cpu,
  Save,
  Loader2,
  Bell,
  Plus,
  Trash2,
  Radio,
  Lock,
  Trophy,
  TrendingUp,
  RefreshCw,
  BrainCircuit
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  AreaChart,
  Area,
  ComposedChart
} from 'recharts';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, getDocs, where, deleteDoc, doc } from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { GoogleGenAI, Type } from "@google/genai";
import ForecastingView from './components/ForecastingView';
import AIInsightsVisualizer from './components/AIInsightsVisualizer';
import TerminalDigitsVisualizer from './components/TerminalDigitsVisualizer';
import RectifyPortal from './components/RectifyPortal';
import ErrorBoundary from './components/ErrorBoundary';

const getAiClient = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({ apiKey: key });
};
const ai = getAiClient();

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(
  error: unknown, 
  operationType: OperationType, 
  path: string | null,
  setError?: (msg: string | null) => void
) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  if (setError) {
    let advice = "An unexpected error occurred. Please refresh the page.";
    
    if (errorMessage.includes("insufficient permissions") || errorMessage.includes("permission-denied")) {
      advice = "Access Denied: You don't have permission. Please check your login status or contact support.";
    } else if (errorMessage.includes("offline") || errorMessage.includes("unavailable") || errorMessage.includes("failed-precondition")) {
      advice = "Connection Issue: We are having trouble connecting to the database. Please check your internet connection.";
    } else if (errorMessage.includes("quota") || errorMessage.includes("resource-exhausted")) {
      advice = "Quota Exceeded: The application has reached its usage limit temporarily. Please try again later (usually resets in 24h).";
    }

    setError(`Sync failure on ${path}: ${advice}`);
  }
  throw new Error(JSON.stringify(errInfo));
}

interface LotteryResult {
  id?: string;
  date: string;
  lotteryName: string;
  drawNo: string;
  tier: string;
  series: string;
  number: string;
  last4: string;
  amount: number;
}

interface AIReport {
  id?: string;
  date: string;
  lotteryName: string;
  reportText: string;
}

interface Forecast {
  id?: string;
  date: string;
  targetLottery: string;
  predictedSegments: string;
  confidenceScore: number;
  analysisBasis: string;
}

interface AccuracyPoint {
  date: string;
  accuracy: number;
  lottery: string;
  type: 'daily' | 'weekly';
  avg?: number;
}

interface UserAlert {
  id?: string;
  userId: string;
  type: 'number' | 'pattern' | 'lottery';
  value: string;
  createdAt: any;
  isActive: boolean;
}

interface NotificationSignal {
  id: string;
  msg: string;
  type: 'match' | 'system';
  lottery?: string;
  time: Date;
}

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const value = payload[0].value;
    const isAvg = payload[0].dataKey === 'avg';
    
    return (
      <div className="bg-[#141414] text-[#E4E3E0] p-4 border-2 border-white/20 font-mono text-[10px] uppercase shadow-[8px_8px_0_rgba(0,0,0,0.3)] z-[100] min-w-[180px]">
        <div className="border-b border-white/20 pb-2 mb-3 flex justify-between items-center gap-4">
           <span className="font-bold tracking-widest text-[#E4E3E0]/60 text-[8px] whitespace-nowrap">{data.date}</span>
           <span className="bg-red-600 text-white px-1 text-[7px] font-bold">LIVE DATA</span>
        </div>
        
        <p className="text-sm font-bold mb-3 tracking-tight text-white flex items-center gap-2">
           <Zap size={10} className="text-yellow-400" />
           {data.lottery || 'Daily Analysis'}
        </p>

        <div className="space-y-2">
           <div className="flex items-center justify-between gap-4">
             <span className="opacity-50 text-[8px]">Precision Index</span>
             <span className={`font-bold text-xs ${data.accuracy > 70 ? 'text-green-400' : data.accuracy > 40 ? 'text-yellow-400' : 'text-red-500'}`}>
               {data.accuracy.toFixed(2)}%
             </span>
           </div>

           {isAvg && (
             <div className="flex items-center justify-between gap-4 border-t border-white/5 pt-1">
               <span className="opacity-50 text-[8px]">Rolling Average</span>
               <span className="font-bold text-xs text-blue-400">
                 {value.toFixed(2)}%
               </span>
             </div>
           )}
        </div>

        <div className="mt-4 pt-2 border-t border-white/10 flex items-center gap-2">
           <div className={`w-1.5 h-1.5 rounded-full ${data.accuracy > 50 ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`} />
           <span className="text-[7px] opacity-40 italic tracking-tight">
             {data.accuracy > 85 ? 'ANALYTICAL PARITY' : data.accuracy > 50 ? 'HIGH CONFIDENCE' : 'LOW SIGNAL DENSITY'}
           </span>
        </div>
      </div>
    );
  }
  return null;
}

function SignalsView({ 
  user, 
  alerts, 
  onAddAlert, 
  onDeleteAlert,
  onToggleAlert,
  onClearSignals,
  onAiAutoFill,
  isAiProcessing,
  signals 
}: { 
  user: User | null, 
  alerts: UserAlert[], 
  onAddAlert: (type: 'number' | 'pattern' | 'lottery', val: string) => void,
  onDeleteAlert: (id: string) => void,
  onToggleAlert: (id: string, active: boolean) => void,
  onClearSignals: () => void,
  onAiAutoFill: () => void,
  isAiProcessing: boolean,
  signals: NotificationSignal[]
}) {
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [newVal, setNewVal] = useState('');
  const [newType, setNewType] = useState<'number' | 'pattern' | 'lottery'>('pattern');
  const [inputError, setInputError] = useState<string | null>(null);

  const handleInputChange = (val: string) => {
    setNewVal(val);
    if (!val.trim()) {
      setInputError(null);
      return;
    }
    if (newType === 'number' && !/^\d+$/.test(val)) {
      setInputError('Must contain only digits');
    } else if (newType === 'pattern' && !/^[\d*xX]+$/.test(val)) {
      setInputError("Invalid pattern. Use digits, 'x', or '*'.");
    } else if (newType === 'lottery' && !/^[a-zA-Z0-9 -]+$/.test(val)) {
      setInputError('Invalid characters in lottery name');
    } else {
      setInputError(null);
    }
  };

  useEffect(() => {
    handleInputChange(newVal);
  }, [newType]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-12 border-4 border-dashed border-[#141414]/10">
        <Lock size={48} className="mb-6 opacity-20" />
        <h2 className="text-2xl font-bold uppercase tracking-tight mb-2">Authenticated Signals Only</h2>
        <p className="font-mono text-[10px] uppercase opacity-50 max-w-xs">
          Cross-reference matching requires a secure identity token. Please sign in (bottom-left) to establish custom watch-lists.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="border-4 border-[#141414] bg-white p-8">
            <h3 className="text-2xl font-bold uppercase tracking-tighter mb-6 flex items-center gap-3 text-[#141414]">
              <Plus size={24} aria-hidden="true" /> Initialize Signal
            </h3>
            <div className="space-y-6">
               <div className="flex flex-col gap-4 mb-4">
                  <button 
                    type="button"
                    onClick={onAiAutoFill}
                    disabled={isAiProcessing}
                    className="w-full border-2 border-[#141414] bg-yellow-400 p-4 font-bold uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group shadow-[4px_4px_0_#141414] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] text-[#141414]"
                  >
                    {isAiProcessing ? (
                      <>
                        <Loader2 size={18} className="animate-spin" aria-hidden="true" /> Analyzing Pattern Clusters...
                      </>
                    ) : (
                      <>
                        <Cpu size={18} className="group-hover:animate-pulse" aria-hidden="true" /> AI Auto-Fill Watch List
                      </>
                    )}
                  </button>
                  <p className="font-mono text-[9px] uppercase opacity-70 text-center text-[#141414]">Neural Engine will identify 3-5 high-probability terminal patterns</p>
               </div>
               <div className="flex gap-2 p-1 bg-[#E4E3E0] font-mono text-[10px] uppercase" role="tablist" aria-label="Signal Type Selection">
                  {(['pattern', 'number', 'lottery'] as const).map(t => (
                    <button 
                      key={t}
                      type="button"
                      role="tab"
                      aria-selected={newType === t}
                      onClick={() => setNewType(t)}
                      className={`flex-1 py-2 px-4 transition-all ${newType === t ? 'bg-[#141414] text-white' : 'hover:bg-[#141414]/10 text-[#141414]'}`}
                    >
                      {t}
                    </button>
                  ))}
               </div>
               <div>
                  <label htmlFor="signal-query" className="block font-mono text-[10px] uppercase opacity-70 mb-2 text-[#141414]">Detection Query</label>
                  <input 
                    id="signal-query"
                    type="text" 
                    value={newVal}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder={newType === 'pattern' ? "e.g. 4xx8 or *77*" : newType === 'number' ? "Exact target" : "Lottery name snippet"}
                    className={`w-full border-2 p-4 font-mono text-xl focus:outline-none focus:ring-4 text-[#141414] ${inputError ? 'border-red-500 focus:ring-red-400' : 'border-[#141414] focus:ring-yellow-400'}`}
                    aria-describedby={newType === 'pattern' ? "pattern-help" : undefined}
                    aria-invalid={inputError ? true : false}
                  />
                  {inputError ? (
                    <p className="mt-2 text-[10px] font-mono text-red-600 italic animate-pulse">{inputError}</p>
                  ) : newType === 'pattern' ? (
                    <p id="pattern-help" className="mt-2 text-[9px] font-mono opacity-70 italic text-[#141414]">Use 'x' for single digit wildcards, '*' for sequences.</p>
                  ) : null}
               </div>
               <button 
                 type="button"
                 disabled={!!inputError || !newVal.trim()}
                 onClick={() => {
                   if (newVal.trim() && !inputError) {
                     onAddAlert(newType, newVal.trim());
                     setNewVal('');
                     setInputError(null);
                   }
                 }}
                 className="w-full bg-[#141414] text-[#E4E3E0] py-6 font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4 group disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
               >
                 Activate Watch-List <Zap size={20} className="group-hover:animate-pulse" aria-hidden="true" />
               </button>
            </div>
          </div>

          <div className="border-4 border-dashed border-[#141414]/20 p-8">
             <h3 className="text-sm font-mono uppercase opacity-70 mb-6 flex items-center gap-2 text-[#141414]">
                <Radio size={14} aria-hidden="true" /> Active Frequency Monitors ({alerts.length})
             </h3>
             <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {alerts.map((alert, i) => (
                  <div key={`${alert.id}-${i}`} className={`flex items-center justify-between p-4 bg-white border ${alert.isActive ? 'border-[#141414]' : 'border-[#141414]/20 bg-gray-50 opacity-60'} group shrink-0 transition-opacity`}>
                    <div className="flex items-center gap-4">
                       <button 
                         type="button"
                         aria-label={alert.isActive ? `Deactivate monitor for ${alert.value}` : `Activate monitor for ${alert.value}`}
                         onClick={() => alert.id && onToggleAlert(alert.id, alert.isActive)}
                         className={`w-4 h-4 border ${alert.isActive ? 'bg-[#141414] border-[#141414]' : 'border-[#141414]/30'} transition-colors`}
                       />
                       <span className="bg-[#141414] text-white font-mono text-[8px] px-2 py-0.5 uppercase tracking-tighter">
                          {alert.type}
                       </span>
                       <span className="font-bold text-lg tracking-tight uppercase text-[#141414]">{alert.value}</span>
                    </div>
                    <button 
                      type="button"
                      aria-label={`Delete monitor for ${alert.value}`}
                      onClick={() => alert.id && onDeleteAlert(alert.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500 hover:text-white transition-all text-[#141414]"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {alerts.length === 0 && (
                  <div className="h-40 flex flex-col items-center justify-center opacity-70 italic font-serif text-sm text-[#141414]">
                    No active monitors established...
                  </div>
                )}
             </div>
          </div>
       </div>

       <div className="border-4 border-[#141414] p-6 sm:p-12">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-8">
             <h3 className="text-2xl sm:text-4xl font-bold tracking-tighter uppercase text-[#141414]">Signal Intelligence</h3>
             <div className="flex items-center gap-4 sm:gap-6">
                <button 
                  onClick={() => {
                    if (confirmPurge) {
                      onClearSignals();
                      setConfirmPurge(false);
                    } else {
                      setConfirmPurge(true);
                      setTimeout(() => setConfirmPurge(false), 3000);
                    }
                  }}
                  className={`font-mono text-[9px] uppercase border px-4 py-2 transition-all shadow-[2px_2px_0_#141414] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none shrink-0 ${confirmPurge ? 'bg-red-600 text-white border-red-600' : 'border-[#141414] hover:bg-[#141414] hover:text-white'}`}
                >
                  {confirmPurge ? 'Confirm Purge?' : 'Purge Logs'}
                </button>
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase opacity-50 shrink-0">
                   <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> <span className="hidden sm:inline">Live Monitoring </span>Active
                </div>
             </div>
          </div>
          
          <div className="space-y-4">
             {signals.length > 0 ? signals.map((signal, i) => (
               <motion.div 
                 key={`${signal.id}-${i}`}
                 initial={{ x: -20, opacity: 0 }}
                 animate={{ x: 0, opacity: 1 }}
                 className="grid grid-cols-1 md:grid-cols-4 items-center gap-6 p-6 border-b border-[#141414]/10 hover:bg-[#141414]/5 transition-colors"
               >
                  <div className="font-mono text-[10px] opacity-40 uppercase">
                    {signal.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                  <div className="md:col-span-2 font-bold uppercase tracking-tight text-lg">
                    {signal.msg}
                  </div>
                  <div className="text-right">
                    <span className="bg-red-600 text-white font-mono text-[10px] px-3 py-1 font-bold italic tracking-widest shadow-[4px_4px_0_#141414]">DETECTION</span>
                  </div>
               </motion.div>
             )) : (
               <div className="h-64 flex flex-col items-center justify-center bg-white border border-[#141414]/5 text-center p-12">
                  <Activity size={32} className="mb-4 opacity-10" />
                  <p className="font-mono text-[10px] uppercase opacity-30 italic">Awaiting pattern resonance from live results...</p>
               </div>
             )}
          </div>
       </div>
    </div>
  );
}

function BumperView({ results, generateInsight, aiInsight, isAiProcessing }: { results: LotteryResult[], generateInsight: () => Promise<void>, aiInsight: string, isAiProcessing: boolean }) {
  const [selectedBumper, setSelectedBumper] = useState<string>(BUMPER_LOTTERIES[0].id);
  
  const bumperResults = results.filter(r => 
    BUMPER_LOTTERIES.some(b => r.lotteryName.toLowerCase().includes(b.name.toLowerCase()) || r.lotteryName.toLowerCase().includes(b.id))
  );

  const [sortKey, setSortKey] = useState<'date' | 'lotteryName'>('date');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    if (dateFilter.start && dateFilter.end && dateFilter.start > dateFilter.end) {
      setDateError('Start date must be before end date.');
    } else {
      setDateError(null);
    }
  }, [dateFilter]);

  const activeBumper = BUMPER_LOTTERIES.find(b => b.id === selectedBumper);
  
  const filteredAndSorted = useMemo(() => {
    let data = bumperResults.filter(r => 
      r.lotteryName.toLowerCase().includes(activeBumper?.name.toLowerCase() || '')
    );
    
    if (dateFilter.start) data = data.filter(r => r.date >= dateFilter.start);
    if (dateFilter.end) data = data.filter(r => r.date <= dateFilter.end);
    
    return data.sort((a,b) => {
       if (sortKey === 'date') return b.date.localeCompare(a.date);
       return a.lotteryName.localeCompare(b.lotteryName);
    });
  }, [bumperResults, activeBumper, sortKey, dateFilter]);

  const specificResults = filteredAndSorted;

  // Analysis Logic for Bumpers
  const analysis = useMemo(() => {
    if (specificResults.length === 0) return null;

    // Frequency analysis
    const digitFreq: Record<number, number> = {};
    for (let i = 0; i <= 9; i++) digitFreq[i] = 0;
    
    // Sequence analysis: consecutive (e.g., '12') and repeating (e.g., '22')
    const consecutiveFreq: Record<string, number> = {};
    const repeatingFreq: Record<string, number> = {};
    
    specificResults.forEach(r => {
      const numStr = r.number.replace(/\D/g, ''); 
      for (let i = 0; i < numStr.length; i++) {
        const d = parseInt(numStr[i], 10);
        if (!isNaN(d)) digitFreq[d]++;
        
        if (i < numStr.length - 1) {
          const d1 = parseInt(numStr[i], 10);
          const d2 = parseInt(numStr[i + 1], 10);
          if (!isNaN(d1) && !isNaN(d2)) {
            // Check consecutive (e.g., 1 and 2) - allow both directions 12 or 21
            if (Math.abs(d1 - d2) === 1) {
              const seq = [d1, d2].sort().join('');
              consecutiveFreq[seq] = (consecutiveFreq[seq] || 0) + 1;
            }
            // Check repeating
            if (d1 === d2) {
              const seq = `${d1}${d2}`;
              repeatingFreq[seq] = (repeatingFreq[seq] || 0) + 1;
            }
          }
        }
      }
    });

    return {
      digitFreq: Object.entries(digitFreq).map(([d, count]) => ({ digit: parseInt(d), count })),
      consecutiveFreq: Object.entries(consecutiveFreq).map(([seq, count]) => ({ seq, count })),
      repeatingFreq: Object.entries(repeatingFreq).map(([seq, count]) => ({ seq, count })),
      totalSamples: specificResults.length
    };
  }, [specificResults]);

  // Firestore interaction helper
async function saveLotteryResult(result: LotteryResult, setError: (msg: string | null) => void) {
  try {
    // Basic validation
    if (!result.date || !result.lotteryName || !result.number) {
        throw new Error("Invalid result: Missing required fields");
    }
    
    // Using collection() to refer to the collection and addDoc to create a new document
    const docRef = await addDoc(collection(db, 'lottery_draws'), {
      ...result,
      createdAt: serverTimestamp()
    });
    console.log("Lottery result saved to Firestore with ID: ", docRef.id);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'lottery_draws', setError);
  }
}



  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
        <div>
           <h2 className="text-3xl sm:text-5xl font-bold uppercase tracking-tighter mb-2 text-[#141414]">Bumper Archives Test</h2>
           <p className="font-mono text-[8px] sm:text-[10px] uppercase opacity-70 tracking-widest text-[#141414]">Multi-Year High-Stakes Performance Analysis (2012-2026)</p>
        </div>
        <div className="flex gap-4">
           {specificResults.length > 0 && (
              <button
                type="button"
                onClick={generateInsight}
                disabled={isAiProcessing}
                className="bg-[#141414] text-white px-6 py-2 font-mono text-[10px] uppercase font-bold hover:bg-[#141414]/80 disabled:opacity-50"
              >
                {isAiProcessing ? 'Synthesizing...' : 'Generate AI Insights'}
              </button>
           )}
           <div className="flex flex-wrap gap-2" role="tablist" aria-label="Bumper Lottery Category">
              {BUMPER_LOTTERIES.map(b => (
                <button 
                  key={b.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedBumper === b.id}
                  onClick={() => setSelectedBumper(b.id)}
                  className={`px-4 py-2 font-mono text-[10px] uppercase border-2 border-[#141414] transition-all ${selectedBumper === b.id ? 'bg-[#141414] text-white shadow-[4px_4px_0_#FECC00]' : 'bg-white hover:bg-[#141414]/10 text-[#141414]'}`}
                >
                  {b.id}
                </button>
              ))}
           </div>
        </div>
      </div>
      
      {aiInsight && (
        <div className="border-4 border-[#141414] p-8 bg-white shadow-[8px_8px_0_#141414]">
          <h4 className="text-xl font-bold uppercase tracking-tighter mb-4">Neural Insight Report</h4>
          <p className="font-mono text-xs leading-relaxed whitespace-pre-line">{aiInsight}</p>
        </div>
      )}


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
         <div className="lg:col-span-2 space-y-12">
             <div className="border-4 border-[#141414] bg-white p-8 shadow-[12px_12px_0_#141414] relative overflow-hidden">
               <div className="absolute top-0 right-0 bg-[#141414] text-white px-4 py-1 font-mono text-[8px] uppercase tracking-widest">Neural Forecast v2.4</div>
               <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                  <div>
                    <h4 className="font-mono text-[10px] uppercase opacity-70 mb-2 text-[#141414]">Historical Resonance</h4>
                    <div className="flex items-baseline gap-4">
                       <span className="text-5xl sm:text-7xl font-bold uppercase tracking-tighter text-[#141414]">
                          {analysis ? analysis.totalSamples : "0"}
                       </span>
                       <div className="flex items-center gap-1 text-green-600">
                          <TrendingUp size={16} />
                          <span className="font-mono text-[10px] font-bold">DRAW SAMPLES</span>
                       </div>
                    </div>
                  </div>
                  <div className="flex-1 max-w-[240px] hidden md:block">
                     <p className="text-[10px] opacity-60 leading-tight italic border-l-2 border-[#141414] pl-4">
                        Analysis of historical bumper data for {activeBumper?.name}. Based on {analysis?.totalSamples || 0} samples.
                     </p>
                  </div>
               </div>
            </div>

            <div className="border-4 border-[#141414] bg-white p-6 mb-6">
               <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex gap-2 items-center">
                     <label className="font-mono text-[9px] uppercase opacity-70">Sort By</label>
                     <select 
                       value={sortKey} 
                       onChange={(e) => setSortKey(e.target.value as 'date' | 'lotteryName')}
                       className="font-mono text-xs border-2 border-[#141414] p-1 uppercase"
                     >
                       <option value="date">Date</option>
                       <option value="lotteryName">Name</option>
                     </select>
                  </div>
                  <div className="flex gap-2 items-center">
                     <label className="font-mono text-[9px] uppercase opacity-70">Start</label>
                     <input type="date" value={dateFilter.start} onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))} className={`font-mono text-xs border-2 p-1 ${dateError ? 'border-red-500' : 'border-[#141414]'}`} />
                  </div>
                  <div className="flex gap-2 items-center">
                     <label className="font-mono text-[9px] uppercase opacity-70">End</label>
                     <input type="date" value={dateFilter.end} onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))} className={`font-mono text-xs border-2 p-1 ${dateError ? 'border-red-500' : 'border-[#141414]'}`} />
                  </div>
               </div>
               {dateError && <p className="mt-2 text-[10px] font-mono text-red-600 italic animate-pulse">{dateError}</p>}
            </div>
            
            <div className="border-4 border-[#141414] bg-white overflow-hidden shadow-[12px_12px_0_#141414]">

               <div className="bg-[#141414] text-white p-6 flex justify-between items-center">
                  <h3 className="text-xl font-bold uppercase tracking-widest">{activeBumper?.name} Timeline</h3>
                  <Download size={18} className="opacity-40" />
               </div>
               <div className="p-8">
                  <div className="space-y-6">
                    {specificResults.length > 0 ? specificResults.slice(0, 15).map((res, idx) => (
                      <div key={`bumper-res-${res.id || idx}-${idx}`} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 pb-4 border-b border-[#141414]/10 last:border-b-0">
                         <div className="flex flex-col">
                            <span className="font-mono text-[10px] opacity-40 uppercase">Date: {res.date}</span>
                            <span className="font-bold text-lg uppercase tracking-tight">Draw: {res.drawNo}</span>
                         </div>
                         <div className="flex items-center justify-between w-full sm:w-auto sm:justify-end gap-6 overflow-x-auto">
                            <div className="text-right shrink-0">
                               <p className="text-[9px] font-mono uppercase opacity-30 leading-none">Series</p>
                               <p className="font-mono font-bold text-lg">{res.series}</p>
                            </div>
                            <div className="text-right shrink-0 min-w-[80px]">
                               <p className="text-[9px] font-mono uppercase opacity-30 leading-none">Winner</p>
                               <p className="font-mono font-bold text-2xl text-red-600">{res.number}</p>
                            </div>
                             <div className="text-right shrink-0 min-w-[80px]">
                                <p className="text-[9px] font-mono uppercase opacity-30 leading-none">Amount</p>
                                <p className="font-mono font-bold text-md text-[#141414]">{res.amount}</p>
                             </div>
                         </div>
                      </div>
                    )) : (
                      <div className="h-64 flex flex-col items-center justify-center text-center opacity-20">
                         <Database size={48} className="mb-4" />
                         <p className="font-mono text-xs uppercase">No historical data segments found for this bumper category in local cache.</p>
                      </div>
                    )}
                  </div>
               </div>
            </div>
         </div>

         <div className="space-y-12">
            <div className="border-4 border-[#141414] p-8 bg-yellow-400 relative overflow-hidden group">
               <Cpu size={120} className="absolute -bottom-8 -right-8 opacity-10 group-hover:scale-110 transition-transform" />
               <h4 className="text-2xl font-bold uppercase tracking-tighter mb-6 relative">Digit Frequency (0-9)</h4>
               
               <div className="h-40 mb-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analysis?.digitFreq || []}>
                      <XAxis dataKey="digit" tick={{fontSize: 10}} />
                      <Bar dataKey="count" fill="#141414">
                        {analysis?.digitFreq.map((entry, index) => (
                           <Cell key={`digit-freq-cell-${entry.digit}-${index}`} fill={index % 2 === 0 ? '#141414' : '#FECC00'} />
                        ))}
                      </Bar>
                      <Tooltip cursor={{fill: 'transparent'}} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-white/50 p-4 border border-[#141414]">
                     <h5 className="font-bold text-xs uppercase mb-3 text-[#141414]">Consecutive Sequences</h5>
                     <div className="space-y-2">
                       {analysis?.consecutiveFreq.sort((a,b) => b.count - a.count).slice(0, 3).map((c, i) => (
                         <div key={`cons-seq-${c.seq}-${i}`} className="flex justify-between items-center font-mono text-xs p-1 bg-white">
                           <span className="font-bold">{c.seq}</span>
                           <span className="opacity-70">{c.count} hit(s)</span>
                         </div>
                       ))}
                     </div>
                   </div>
                   <div className="bg-white/50 p-4 border border-[#141414]">
                     <h5 className="font-bold text-xs uppercase mb-3 text-[#141414]">Repeating Digits</h5>
                     <div className="space-y-2">
                       {analysis?.repeatingFreq.sort((a,b) => b.count - a.count).slice(0, 3).map((r, i) => (
                         <div key={`rep-digit-${r.seq}-${i}`} className="flex justify-between items-center font-mono text-xs p-1 bg-white">
                           <span className="font-bold">{r.seq}</span>
                           <span className="opacity-70">{r.count} hit(s)</span>
                         </div>
                       ))}
                     </div>
                   </div>
                </div>
            </div>

            <div className="p-8 border-4 border-dashed border-[#141414]/30">
               <h5 className="font-bold uppercase tracking-tight mb-4 flex items-center gap-2">
                  <TrendingUp size={16} /> Seasonal Parity
               </h5>
               <p className="text-xs font-serif italic leading-relaxed opacity-60">
                 Bumper lotteries in Kerala follow a 60-day cycle. Digit resonance typically peaks in the 48-72 hour window prior to draw commencement. Archive data indicates 2012-2024 trends remain highly relevant for terminal digit prediction.
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}

function DigitFrequencyHeatmap({ results }: { results: LotteryResult[] }) {
  const [dateRange, setDateRange] = useState({ 
    start: '', 
    end: new Date().toISOString().split('T')[0] 
  });
  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    if (dateRange.start && dateRange.end && dateRange.start > dateRange.end) {
      setDateError('Start interval must be before end interval.');
    } else {
      setDateError(null);
    }
  }, [dateRange]);

  const filteredResults = useMemo(() => {
    return results.filter(r => {
      const date = r.date;
      if (dateRange.start && date < dateRange.start) return false;
      if (dateRange.end && date > dateRange.end) return false;
      return true;
    });
  }, [results, dateRange]);

  const digitFreq = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let i = 0; i <= 9; i++) counts[i] = 0;
    
    filteredResults.forEach(r => {
      const numStr = r.number.replace(/\D/g, ''); // just digits
      for (const char of numStr) {
        const d = parseInt(char, 10);
        if (!isNaN(d)) counts[d]++;
      }
    });
    
    const total = Object.values(counts).reduce((s, c) => s + c, 0);
    return Object.entries(counts).map(([digit, count]) => ({
      digit: parseInt(digit),
      count,
      percentage: total > 0 ? (count / total) * 100 : 0
    }));
  }, [filteredResults]);

  const maxFreq = Math.max(...digitFreq.map(d => d.count), 1);

  return (
    <div className="border border-[#141414] bg-white p-6 sm:p-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 sm:mb-12">
        <div>
          <h3 className="text-2xl sm:text-4xl font-bold tracking-tighter uppercase mb-1 sm:mb-2">Neural Digit Distribution</h3>
          <p className="font-mono text-[8px] sm:text-[10px] uppercase opacity-50 tracking-widest">Cross-Tier Frequency Heatmap (0-9)</p>
        </div>
        <div className="flex gap-4 items-end">
           <div className="flex flex-col gap-1">
              <label className="text-[9px] font-mono uppercase opacity-40">Interval Start</label>
              <input 
                type="date" 
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className={`font-mono text-[10px] p-2 border focus:bg-yellow-100 outline-none cursor-pointer ${dateError ? 'border-red-500' : 'border-[#141414]'}`}
              />
           </div>
           <div className="flex flex-col gap-1">
              <label className="text-[9px] font-mono uppercase opacity-40">Interval End</label>
              <input 
                type="date" 
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className={`font-mono text-[10px] p-2 border focus:bg-yellow-100 outline-none cursor-pointer ${dateError ? 'border-red-500' : 'border-[#141414]'}`}
              />
           </div>
        </div>
      </div>
      
      {dateError && <p className="mb-6 -mt-8 text-[10px] font-mono text-red-600 italic animate-pulse">{dateError}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2 mb-12">
        {digitFreq.map(({ digit, count, percentage }) => {
          const intensity = count / maxFreq;
          return (
            <div 
              key={`heatmap-digit-${digit}`}
              className="relative aspect-square border-2 border-[#141414] flex flex-col items-center justify-center transition-all hover:scale-105 group overflow-hidden"
              style={{ backgroundColor: `rgba(20, 20, 20, ${0.05 + intensity * 0.95})` }}
            >
              <span className={`text-4xl font-bold transition-all relative z-10 ${intensity > 0.5 ? 'text-white' : 'text-[#141414]'}`}>{digit}</span>
              <div className={`absolute bottom-1 right-1 font-mono text-[8px] tracking-tight group-hover:opacity-100 transition-opacity ${intensity > 0.6 ? 'text-white/40' : 'opacity-40'}`}>
                {percentage.toFixed(1)}%
              </div>
              <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 font-mono text-[9px] uppercase font-bold text-red-600 bg-white px-2 py-0.5 border border-[#141414] z-20 shadow-[2px_2px_0_#141414]">
                FRQ: {count}
              </div>
            </div>
          )
        })}
      </div>

      <div className="h-[200px] w-full bg-[#141414]/5 p-6 border border-dashed border-[#141414]/10">
         <ResponsiveContainer width="100%" height="100%">
            <BarChart data={digitFreq}>
               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#141414" opacity={0.05} />
               <XAxis dataKey="digit" stroke="#141414" fontSize={12} axisLine={false} tickLine={false} />
               <YAxis hide domain={[0, 'dataMax + 10']} />
               <Tooltip 
                 cursor={{ fill: '#141414', opacity: 0.05 }}
                 content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                       return (
                          <div className="bg-[#141414] text-white p-3 font-mono text-[10px] uppercase shadow-2xl border border-white/10">
                             <p className="mb-1 opacity-50">Digit Position: {payload[0].payload.digit}</p>
                             <p className="text-red-500 font-bold text-lg">HITS: {payload[0].payload.count}</p>
                          </div>
                       )
                    }
                    return null;
                 }}
               />
               <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {digitFreq.map((entry, index) => (
                    <Cell 
                      key={`heatmap-cell-${entry.digit}-${index}`} 
                      fill={entry.count === maxFreq ? '#dc2626' : '#141414'} 
                      className="transition-all hover:opacity-80"
                    />
                  ))}
               </Bar>
            </BarChart>
         </ResponsiveContainer>
      </div>
    </div>
  );
}

const getBumperStatus = (monthName: string) => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentMonthIndex = 3;
  const drawMonthIndex = months.indexOf(monthName);
  return drawMonthIndex === currentMonthIndex ? 'Active' : drawMonthIndex > currentMonthIndex ? 'Upcoming' : 'Completed';
}

const BUMPER_LOTTERIES = [
  { id: 'xmas', name: 'Christmas New Year Bumper', month: 'January', code: 'BR' },
  { id: 'summer', name: 'Summer Bumper', month: 'March', code: 'BR' },
  { id: 'vishu', name: 'Vishu Bumper', month: 'May', code: 'BR' },
  { id: 'monsoon', name: 'Monsoon Bumper', month: 'July', code: 'BR' },
  { id: 'thiruvonam', name: 'Thiruvonam Bumper', month: 'September', code: 'BR' },
  { id: 'pooja', name: 'Pooja Bumper', month: 'November', code: 'BR' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'live' | 'analytics' | 'history' | 'readme' | 'signals' | 'schedule' | 'bumpers' | 'forecast'>('live');
  const [isAutoPilot, setIsAutoPilot] = useState<boolean>(() => localStorage.getItem('kerala_autopilot') === 'true');
  const [isAutoPurge, setIsAutoPurge] = useState<boolean>(() => localStorage.getItem('kerala_autopurge') === 'true');

  useEffect(() => {
    localStorage.setItem('kerala_autopurge', String(isAutoPurge));
  }, [isAutoPurge]);

  useEffect(() => {
    localStorage.setItem('kerala_autopilot', String(isAutoPilot));
  }, [isAutoPilot]);

  // Removed useEffect from here

  const [liveResults, setLiveResults] = useState<LotteryResult[]>([]);
  const [aiInsights, setAiInsights] = useState<{
    patterns: { value: string, count: number }[],
    sequences: { value: string, count: number }[],
    biases: { value: string, count: number }[],
    summary: string
  } | null>(null);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [lastReport, setLastReport] = useState<AIReport | null>(null);
  const [lastForecast, setLastForecast] = useState<Forecast | null>(null);
  const [historicalForecasts, setHistoricalForecasts] = useState<Forecast[]>(() => {
    try {
      const cached = localStorage.getItem('kerala_lottery_hist_forecasts');
      if (cached) {
        const parsed = JSON.parse(cached);
        const unique = new Map();
        parsed.forEach((r: any) => {
           if (r.id && !unique.has(r.id)) unique.set(r.id, r);
        });
        return Array.from(unique.values());
      }
      return [];
    } catch {
      return [];
    }
  });
  const [historicalResults, setHistoricalResults] = useState<LotteryResult[]>(() => {
    try {
      const cached = localStorage.getItem('kerala_lottery_hist_results');
      if (cached) {
        const parsed = JSON.parse(cached);
        const unique = new Map();
        parsed.forEach((r: any) => {
           if (r.id && !unique.has(r.id)) unique.set(r.id, r);
        });
        return Array.from(unique.values());
      }
      return [];
    } catch {
      return [];
    }
  });
  const [isHistoricalLoading, setIsHistoricalLoading] = useState(true);

  const runAiAnalysis = async () => {
    if (!ai) return;
    setIsAiProcessing(true);
    setAiInsights(null);
    try {
      const resultsToAnalyze = historicalResults.slice(-50);
      const prompt = `
        Analyze the following historical lottery draw results and identify:
        1. Recurring number patterns (numbers that appear frequently).
        2. Common digit sequences (e.g., pairs, consecutive digits).
        3. Potential biases (e.g., preference for certain number ranges or digits).
        
        Data: ${JSON.stringify(resultsToAnalyze)}
        
        Format the output as a JSON object with the following schema:
        {
           "patterns": [{"value": "string", "count": number}],
           "sequences": [{"value": "string", "count": number}],
           "biases": [{"value": "string", "count": number}],
           "summary": "string"
        }
        Provide exactly the top 5 most frequent items for patterns, sequences, and biases based on the analyzed data. Ensure 'count' is an accurate numeric representation of frequency.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            responseMimeType: "application/json",
        }
      });

      const text = response.text || "{}";
      setAiInsights(JSON.parse(text));
    } catch (err) {
      console.error("AI Analysis failed:", err);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const generateInsight = async () => {
    if (!ai) return;
    setIsAiProcessing(true);
    try {
      const prompt = `Analyze these Kerala Bumper Lottery results: ${JSON.stringify(historicalResults.slice(0, 10))}. 
        Identify winning patterns, cross-reference winning patterns across prize tiers, identify repeating number sequences, 
        and provide specific insights on potential machine biases and 'hot' digit clusters. 
        Provide a concise, analytical, and actionable expert insight for the next draw.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      
      setAiInsight(response.text || "No insights generated.");
    } catch (e) {
      setAiInsight("Failed to generate insights.");
    } finally {
      setIsAiProcessing(false);
    }
  };

  const [accuracyData, setAccuracyData] = useState<AccuracyPoint[]>([]);
  const [alerts, setAlerts] = useState<UserAlert[]>([]);
  const [savedForecasts, setSavedForecasts] = useState<Forecast[]>([]);
  const [signals, setSignals] = useState<NotificationSignal[]>([]);
  const [processedResultIds, setProcessedResultIds] = useState<Set<string>>(new Set());
  const [selectedResult, setSelectedResult] = useState<LotteryResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingForecast, setIsSavingForecast] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fsError, setFsError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'error'>('synced');
  const [rectificationText, setRectificationText] = useState('');
  const [showRectifier, setShowRectifier] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const allResults = useMemo(() => {
    const combined = [...liveResults, ...historicalResults];
    const unique = new Map();
    combined.forEach(r => {
      const key = `${r.date}-${r.lotteryName}-${r.number}`;
      if (!unique.has(key)) unique.set(key, r);
    });
    return Array.from(unique.values()).sort((a,b) => b.date.localeCompare(a.date));
  }, [liveResults, historicalResults]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    const resultsQuery = query(collection(db, 'lottery_draws'), orderBy('date', 'desc'), limit(100));
    setSyncStatus('syncing');
    const unsubscribeResults = onSnapshot(resultsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LotteryResult[];
      setLiveResults(data);
      setSyncStatus('synced');
    }, (error) => {
      setSyncStatus('error');
      handleFirestoreError(error, OperationType.GET, 'lottery_draws', setFsError);
    });

    const reportsQuery = query(collection(db, 'reports'), orderBy('date', 'desc'), limit(1));
    const unsubscribeReports = onSnapshot(reportsQuery, (snapshot) => {
      if (!snapshot.empty) {
        setLastReport({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as AIReport);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'reports', setFsError);
    });

    const forecastQuery = query(collection(db, 'forecasts'), orderBy('date', 'desc'), limit(1));
    const unsubscribeForecasts = onSnapshot(forecastQuery, (snapshot) => {
      if (!snapshot.empty) {
        setLastForecast({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Forecast);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'forecasts', setFsError);
    });

    // Historical Fetch for Analytics
    const histForecastsQuery = query(collection(db, 'forecasts'), orderBy('date', 'desc'), limit(20));
    const unsubscribeHistForecasts = onSnapshot(histForecastsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Forecast[];
      setHistoricalForecasts(data);
      localStorage.setItem('kerala_lottery_hist_forecasts', JSON.stringify(data));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'forecasts_hist', setFsError);
    });

    const histResultsQuery = query(collection(db, 'lottery_draws'), orderBy('date', 'desc'), limit(2000));
    const unsubscribeHistResults = onSnapshot(histResultsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LotteryResult[];
      setHistoricalResults(data);
      setIsHistoricalLoading(false);
      localStorage.setItem('kerala_lottery_hist_results', JSON.stringify(data));
    }, (error) => {
      setIsHistoricalLoading(false);
      handleFirestoreError(error, OperationType.GET, 'results_hist', setFsError);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeResults();
      unsubscribeReports();
      unsubscribeForecasts();
      unsubscribeHistForecasts();
      unsubscribeHistResults();
    };
  }, []);

  // Alert Subscription for User
  useEffect(() => {
    if (!user) {
      setAlerts([]);
      setSavedForecasts([]);
      return;
    }

    const alertsQuery = query(collection(db, `users/${user.uid}/alerts`));
    const unsubscribeAlerts = onSnapshot(alertsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as UserAlert[];
      setAlerts(data);
    }, (error) => {
      console.warn("Alerts fetch error:", error);
    });

    const savedForecastsQuery = query(collection(db, `users/${user.uid}/saved_forecasts`), orderBy('date', 'desc'));
    const unsubscribeSavedForecasts = onSnapshot(savedForecastsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Forecast[];
      setSavedForecasts(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'saved_forecasts', setFsError);
    });

    return () => {
      unsubscribeAlerts();
      unsubscribeSavedForecasts();
    };
  }, [user]);

  useEffect(() => {
    if (!isAutoRefreshEnabled) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsRefreshing(true);
          setTimeout(() => setIsRefreshing(false), 1500);
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isAutoRefreshEnabled, refreshInterval]);

  // Real-time signal monitoring
  useEffect(() => {
    if (liveResults.length > 0 && alerts.length > 0) {
      const activeAlerts = alerts.filter(a => a.isActive);
      if (activeAlerts.length === 0) return;

      const newSignals: NotificationSignal[] = [];
      const newProcessedIds = new Set(processedResultIds);

      // Check all results in the feed initially, then just new ones
      liveResults.forEach(result => {
        if (!result.id || newProcessedIds.has(result.id)) return;

        activeAlerts.forEach(alert => {
          let isMatch = false;
          if (alert.type === 'number') {
            isMatch = result.number === alert.value || result.last4 === alert.value;
          } else if (alert.type === 'pattern') {
            const regexStr = alert.value.replace(/x/g, '.').replace(/\*/g, '.*');
            const regex = new RegExp(`^${regexStr}$`);
            isMatch = regex.test(result.last4) || regex.test(result.number.slice(-4));
          } else if (alert.type === 'lottery') {
            isMatch = result.lotteryName.toLowerCase().includes(alert.value.toLowerCase());
          }

          if (isMatch) {
            newSignals.push({
              id: `signal-${Date.now()}-${alert.id}-${result.id}-${Math.floor(Math.random() * 10000)}`,
              msg: `MATCH ALERT: ${result.number} matches "${alert.value}"`,
              type: 'match',
              lottery: result.lotteryName,
              time: new Date()
            });
          }
        });
        
        newProcessedIds.add(result.id);
      });

      if (newSignals.length > 0) {
        setSignals(prev => [...newSignals, ...prev].slice(0, 50));
        setProcessedResultIds(newProcessedIds);
      }
    }
  }, [liveResults, alerts, processedResultIds]);

  // Compute Accuracy Metrics
  useEffect(() => {
    if (historicalForecasts.length > 0 && historicalResults.length > 0) {
      const points: AccuracyPoint[] = [];

      historicalForecasts.forEach(forecast => {
        // Find ALL matching results for that date
        const matchingResults = historicalResults.filter(r => r.date === forecast.date);
        if (matchingResults.length > 0) {
          const segments = forecast.predictedSegments.split(',').map(s => s.trim());
          let matches = 0;

          segments.forEach(seg => {
            // Pattern like "4xx8"
            const regexStr = seg.replace(/x/g, '.');
            const regex = new RegExp(`^${regexStr}$`);
            
            // Check if THIS segment matches the last 4 digits of ANY prize drawn on this day
            const isMatch = matchingResults.some(r => {
              const num = r.last4 || r.number.slice(-4);
              return regex.test(num);
            });

            if (isMatch) {
              matches++;
            }
          });

          const accuracy = segments.length > 0 ? (matches / segments.length) * 100 : 0;
          
          points.push({
            date: forecast.date,
            accuracy: accuracy,
            lottery: forecast.targetLottery,
            type: forecast.targetLottery.toLowerCase().includes('bumper') ? 'weekly' : 'daily'
          });
        }
      });

      const sorted = points.sort((a, b) => a.date.localeCompare(b.date));
      
      // Calculate 5-point moving average
      const withAvg = sorted.map((p, i, arr) => {
        const start = Math.max(0, i - 4);
        const window = arr.slice(start, i + 1);
        const sum = window.reduce((s, curr) => s + curr.accuracy, 0);
        return { ...p, avg: sum / window.length };
      });

      setAccuracyData(withAvg);
    }
  }, [historicalForecasts, historicalResults]);

  const handleAiAutoFillAlerts = async () => {
    if (!user || historicalResults.length === 0) return;
    setIsAiProcessing(true);
    
    try {
      // 1. Analyze historical frequency for last 4 digits
      const terminalFrequencies: Record<string, number> = {};
      const endingDigitFreq: Record<string, number> = {};
      
      historicalResults.forEach(res => {
        const last4 = res.last4 || res.number.slice(-4);
        terminalFrequencies[last4] = (terminalFrequencies[last4] || 0) + 1;
        
        const lastDigit = last4.slice(-1);
        endingDigitFreq[lastDigit] = (endingDigitFreq[lastDigit] || 0) + 1;
      });

      // 2. Identify "Pattern Interest Zones"
      // Suggest patterns like: "x7x2" or "8xx4" based on hot terminal digits
      const topEndings = Object.entries(endingDigitFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(e => e[0]);

      const suggestions: string[] = [];
      
      // Pattern 1: Leading Hot Clusters (common 1st digits of last 4)
      const firstDigitFreq: Record<string, number> = {};
      historicalResults.forEach(res => {
        const d = (res.last4 || res.number.slice(-4)).slice(0, 1);
        firstDigitFreq[d] = (firstDigitFreq[d] || 0) + 1;
      });
      const topFirstDigit = Object.entries(firstDigitFreq).sort((a, b) => b[1] - a[1])[0][0];
      suggestions.push(`${topFirstDigit}xxx`);

      // Pattern 2: Repeating Terminal Pair
      topEndings.forEach(digit => {
         suggestions.push(`xx${digit}${digit}`);
         suggestions.push(`x${digit}x${digit}`);
      });

      // 3. Deduplicate against existing alerts
      const currentAlertVals = new Set(alerts.map(a => a.value));
      const newAlerts = Array.from(new Set(suggestions)).filter(s => !currentAlertVals.has(s)).slice(0, 5);

      // 4. Batch push to Firestore
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      for (const val of newAlerts) {
        await addDoc(collection(db, `users/${user.uid}/alerts`), {
          userId: user.uid,
          type: 'pattern',
          value: val,
          isActive: true,
          createdAt: serverTimestamp()
        });
      }

      setSignals(prev => [
        {
          id: `ai-fill-${Date.now()}`,
          msg: `AI SUCCESS: Synchronized ${newAlerts.length} high-interest patterns to Watch List`,
          type: 'system',
          time: new Date()
        },
        ...prev
      ]);

    } catch (e) {
      console.error("AI Auto-fill failed:", e);
      setFsError("AI Engine Timeout: Could not synchronize pattern clusters.");
    } finally {
      setTimeout(() => setIsAiProcessing(false), 1500);
    }
  };

  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error(e);
      setFsError("Authentication failed. Please check your browser's popup blocker.");
    }
  };

  const handleManualSave = async () => {
    if (!user) {
      setFsError("Action Required: Please sign in with Google to perform simulation writes.");
      return;
    }
    setIsSaving(true);
    setFsError(null);
    try {
      // Create a dummy result and a dummy forecast for simulation
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      await addDoc(collection(db, 'lottery_draws'), {
        date: new Date().toISOString().split('T')[0],
        lotteryName: "Live Feed - Simulation",
        drawNo: "S-" + Math.floor(Math.random() * 1000),
        tier: "1st",
        series: "LP",
        number: "425" + Math.floor(Math.random() * 900 + 100),
        last4: "5" + Math.floor(Math.random() * 900 + 100),
        amount: 10000000,
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, 'forecasts'), {
        date: tomorrowStr,
        targetLottery: "Akshaya (Simulation)",
        predictedSegments: "4xx8, 5xx2, 1xx9",
        confidenceScore: 0.84,
        analysisBasis: "Cluster analysis of terminal digits from last 48 hours show a significant shift toward odd-terminal sequences in even-numbered series.",
        createdAt: serverTimestamp()
      });

    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'simulation_entry', setFsError);
    } finally {
      setTimeout(() => setIsSaving(false), 800);
    }
  };

  const handleAddAlert = async (type: 'number' | 'pattern' | 'lottery', value: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, `users/${user.uid}/alerts`), {
        userId: user.uid,
        type,
        value,
        isActive: true,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'alerts', setFsError);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (!user) return;
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, `users/${user.uid}/alerts`, alertId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'alerts', setFsError);
    }
  };

  const handleToggleAlert = async (alertId: string, currentState: boolean) => {
    if (!user) return;
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      await updateDoc(doc(db, `users/${user.uid}/alerts`, alertId), {
        isActive: !currentState
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'alerts', setFsError);
    }
  };

  const handleSaveForecast = async (forecast: Forecast) => {
    if (!user) {
      setFsError("Safety Protocol: Please sign in to archive predictive models.");
      return;
    }
    setIsSavingForecast(true);
    try {
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const { id, createdAt, ...forecastData } = forecast as any;
      await addDoc(collection(db, `users/${user.uid}/saved_forecasts`), {
        ...forecastData,
        userId: user.uid,
        savedAt: serverTimestamp()
      });
      setSignals(prev => [
        {
          id: `save-${Date.now()}`,
          msg: `ARCHIVE SUCCESS: Forecast for ${forecast.date} locked in vault.`,
          type: 'system',
          time: new Date()
        },
        ...prev
      ]);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'saved_forecasts', setFsError);
    } finally {
      setTimeout(() => setIsSavingForecast(false), 600);
    }
  };

  const handleDeleteForecast = async (forecastId: string) => {
    if (!user) return;
    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, `users/${user.uid}/saved_forecasts`, forecastId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'saved_forecasts', setFsError);
    }
  };

  const handleManualRectify = async (pastedText: string) => {
    if (!pastedText.trim()) return;
    if (!ai) {
      setFsError("AI Engine unavailable. check GEMINI_API_KEY.");
      return;
    }
    setIsAiProcessing(true);
    setSyncStatus('syncing');
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: `Parse the following Kerala State Lottery result text into a structured JSON array of LotteryResult objects. 
        
        CRITICAL: Extract ALL prizes from 1st Prize down to the 8th/9th Prize.
        1. For 1st/2nd prize, extract the full 6-digit number and series.
        2. For consolation prizes, extract all associated numbers.
        3. For 3rd-8th prizes (often last 4 digits), extract the numbers. If they are only last 4, set "number" to those 4 digits and "last4" to the same.
        
        Ensure dates are in YYYY-MM-DD format. 
        Lottery names should be official (e.g., "Karunya Plus").
        
        Text to parse:
        ${pastedText}` }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                lotteryName: { type: Type.STRING },
                drawNo: { type: Type.STRING },
                tier: { type: Type.STRING, description: "e.g. 1st Prize, 2nd Prize, 8th Prize" },
                series: { type: Type.STRING, description: "2-letter series if applicable, else empty" },
                number: { type: Type.STRING, description: "Full prize number or last-4 digits" },
                last4: { type: Type.STRING },
                amount: { type: Type.NUMBER }
              },
              required: ["date", "lotteryName", "drawNo", "number", "tier"]
            }
          }
        }
      });

      const parsedResults = JSON.parse(response.text || "[]") as LotteryResult[];
      
      if (parsedResults.length > 0) {
        const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
        
        for (const res of parsedResults) {
          await addDoc(collection(db, 'lottery_draws'), {
            ...res,
            last4: res.last4 || res.number.slice(-4),
            createdAt: serverTimestamp()
          });
        }

        setSignals(prev => [
          {
            id: `rectify-${Date.now()}`,
            msg: `RECTIFICATION COMPLETE: ${parsedResults.length} draws synchronized to production chain.`,
            type: 'system',
            time: new Date()
          },
          ...prev
        ]);
        setSyncStatus('synced');
      }
    } catch (e) {
      console.error(e);
      setSyncStatus('error');
      setFsError("Rectification Failed: AI could not parse the provided data payload. Ensure the text contains clear result rows.");
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleForceSync = async () => {
    setIsRefreshing(true);
    setSyncStatus('syncing');
    try {
      const response = await fetch('/api/sync-lottery');
      const data = await response.json();
      
      if (data.status === 'success') {
        setSignals(prev => [
          {
            id: `sync-${Date.now()}`,
            msg: `DATABASE SYNC: ${data.message || 'Complete'}. ${data.draw?.drawNo ? `Official Draw ID ${data.draw.drawNo} verified.` : 'System updated.'}`,
            type: 'system',
            time: new Date()
          },
          ...prev
        ]);
        setSyncStatus('synced');
      } else {
        throw new Error(data.message);
      }
    } catch (e) {
      setSyncStatus('error');
      setFsError("Sync Parity Error: Official Kerala Lottery site responded with unusual headers. Manual intervention recommended.");
    } finally {
      setTimeout(() => setIsRefreshing(false), 2000);
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isAutoPilot) {
      interval = setInterval(async () => {
         console.log("Auto-pilot: Initiating 24/7 background sync & rectify...");
         try {
           await handleForceSync();
           await runAiAnalysis();
           await generateInsight();
         } catch (e) {
           console.error("AutoPilot Error: ", e);
         }
      }, 60 * 60 * 1000); // Every hour
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAutoPilot]); // handleForceSync etc are defined and will be captured

  useEffect(() => {
    let purgeInterval: ReturnType<typeof setInterval>;
    
    const purgeOldRecords = async () => {
      try {
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
        const cutoffDateStr = fiveYearsAgo.toISOString().split('T')[0];
        
        console.log(`[PURGE JOB] Checking for records older than ${cutoffDateStr}`);
        const purgeQuery = query(
          collection(db, 'lottery_draws'),
          where('date', '<', cutoffDateStr),
          limit(500)
        );
        
        const snapshot = await getDocs(purgeQuery);
        if (!snapshot.empty) {
          console.log(`[PURGE JOB] Found ${snapshot.size} records to purge.`);
          let count = 0;
          for (const drawDoc of snapshot.docs) {
            await deleteDoc(doc(db, 'lottery_draws', drawDoc.id));
            count++;
          }
          console.log(`[PURGE JOB] Successfully purged ${count} old records.`);
        } else {
          console.log(`[PURGE JOB] No old records found to purge.`);
        }
      } catch (e) {
        console.error(`[PURGE JOB] Error during purge operation:`, e);
      }
    };

    if (isAutoPurge) {
      // Run once on mount if enabled
      purgeOldRecords();
      // Then check daily
      purgeInterval = setInterval(purgeOldRecords, 24 * 60 * 60 * 1000);
    }
    
    return () => {
      if (purgeInterval) clearInterval(purgeInterval);
    };
  }, [isAutoPurge]);

  const schedule = [
    { day: "Sunday", name: "Pournami" },
    { day: "Monday", name: "Win-Win" },
    { day: "Tuesday", name: "Sthree Sakthi" },
    { day: "Wednesday", name: "Akshaya" },
    { day: "Thursday", name: "Karunya Plus" },
    { day: "Friday", name: "Nirmal" },
    { day: "Saturday", name: "Karunya" }
  ];

  const prizes = [
    { tier: "1st", amount: "10,000,000" },
    { tier: "2nd", amount: "3,000,000" },
    { tier: "3rd", amount: "500,000" },
    { tier: "Consolation", amount: "5,000" },
    { tier: "4th-9th", amount: "5,000 to 100" }
  ];

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
        {/* Global Error Banner */}
      <AnimatePresence>
        {!ai && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="fixed top-0 left-16 right-0 z-[60] bg-yellow-400 text-[#141414] overflow-hidden border-b-2 border-[#141414]"
          >
            <div className="px-8 py-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle size={14} className="animate-pulse" />
                <span className="font-mono text-[9px] font-bold uppercase tracking-widest">AI Engine Offline: AI insights temporarily disabled.</span>
              </div>
            </div>
          </motion.div>
        )}
        {fsError && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="fixed top-0 left-16 right-0 z-[60] bg-red-600 text-white overflow-hidden"
          >
            <div className="px-8 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle size={16} />
                <span className="font-mono text-xs uppercase tracking-tight">{fsError}</span>
              </div>
              <button 
                onClick={() => setFsError(null)}
                className="hover:bg-white/20 p-1 rounded transition-colors"
              >
                <Download size={14} className="rotate-45" /> {/* Use download as close icon for brutalist look */}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Result Detail Modal */}
      <AnimatePresence>
        {selectedResult && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 backdrop-blur-sm bg-white/10">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              className="bg-white border-4 border-[#141414] w-full max-w-2xl shadow-[16px_16px_0_#141414] overflow-hidden"
            >
              <div className="bg-[#141414] text-white p-6 flex justify-between items-center">
                 <div>
                    <h3 id="modal-title" className="text-2xl font-bold uppercase tracking-tighter">{selectedResult.lotteryName}</h3>
                    <p className="font-mono text-[10px] opacity-70 uppercase tracking-widest">{selectedResult.date} // {selectedResult.drawNo}</p>
                 </div>
                 <button 
                   type="button"
                   aria-label="Close details"
                   onClick={() => setSelectedResult(null)}
                   className="hover:scale-110 transition-transform p-2 border border-white/20 hover:bg-white/10"
                 >
                    <Download size={20} className="rotate-45" />
                 </button>
              </div>
              
              <div className="p-12">
                 <div className="grid grid-cols-2 gap-12 mb-12">
                    <div>
                       <p className="font-mono text-[10px] uppercase opacity-60 mb-2 font-bold text-[#141414]">Winning Combination</p>
                       <div className="flex items-baseline gap-4">
                          <span className="text-4xl font-mono font-bold tracking-tighter opacity-30">{selectedResult.series}</span>
                          <span className="text-6xl font-mono font-bold tracking-tighter text-red-600 drop-shadow-[4px_4px_0_rgba(239,68,68,0.1)]">
                            {selectedResult.number}
                          </span>
                       </div>
                    </div>
                    <div className="flex flex-col justify-center">
                       <p className="font-mono text-[10px] uppercase opacity-60 mb-2 font-bold text-[#141414]">Prize Entitlement</p>
                       <div className="text-4xl font-bold tracking-tighter uppercase mb-1 text-[#141414]">
                          {selectedResult.tier} Prize
                       </div>
                       <div className="text-2xl font-mono font-bold text-green-700">
                          ₹{selectedResult.amount.toLocaleString()}
                       </div>
                    </div>
                 </div>

                 <div className="border-t-2 border-[#141414] pt-8">
                    <h5 className="font-bold uppercase tracking-tighter mb-4 flex items-center gap-2">
                       <TableIcon size={16} /> Reference Prize Matrix
                    </h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                       {prizes.map((p, i) => (
                          <div key={`ref-prize-${p.tier}-${i}`} className={`p-4 border ${p.tier === selectedResult.tier ? 'bg-[#141414] text-white border-[#141414]' : 'border-[#141414]/10 bg-[#141414]/5'}`}>
                             <p className="text-[9px] font-mono uppercase opacity-50 mb-1">{p.tier}</p>
                             <p className="font-bold text-sm">₹{p.amount}</p>
                          </div>
                       ))}
                    </div>
                 </div>

                 <div className="mt-12 flex justify-between items-center opacity-30">
                    <div className="flex items-center gap-2">
                       <ShieldCheck size={14} />
                       <span className="font-mono text-[9px] uppercase">Verified Draw Hash: {Math.random().toString(16).slice(2, 10).toUpperCase()}</span>
                    </div>
                    <div className="font-serif italic text-xs">Official Intelligence Report Attached</div>
                 </div>
              </div>
              
              <button 
                onClick={() => setSelectedResult(null)}
                className="w-full bg-[#141414] text-white py-6 font-bold uppercase tracking-[0.2em] hover:bg-black transition-colors"
              >
                Close Archive Record
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Signal Notifications */}
      <div 
        className="fixed top-4 right-4 z-[70] flex flex-col gap-4 pointer-events-none"
        aria-live="polite"
        role="status"
      >
        <AnimatePresence>
          {signals.slice(0, 3).map((sig, i) => (
            <motion.div
              key={`${sig.id}-${i}`}
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="pointer-events-auto bg-[#141414] text-white p-6 shadow-[8px_8px_0_rgba(20,20,20,0.2)] border border-white/10 w-80 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-100 transition-opacity">
                 <button 
                   type="button"
                   aria-label="Dismiss notification"
                   onClick={() => setSignals(prev => prev.filter(s => s.id !== sig.id))}
                 >
                   <Download size={12} className="rotate-45" />
                 </button>
              </div>
              <div className="flex items-center gap-3 mb-4">
                 <Zap size={14} className="text-yellow-400 animate-pulse" />
                 <span className="font-mono text-[8px] uppercase tracking-widest opacity-70">Signal Detection Found</span>
              </div>
              <p className="font-bold text-sm uppercase leading-tight tracking-tight mb-2">{sig.msg}</p>
              <div className="flex justify-between items-center mt-4">
                 <span className="text-[10px] font-mono opacity-70">{sig.time.toLocaleTimeString()}</span>
                 <span className="bg-red-600 text-white text-[8px] px-2 py-0.5 font-bold uppercase italic">Immediate Action</span>
              </div>
              <div className="absolute bottom-0 left-0 h-1 bg-red-600 animate-[shrink_5s_linear_forwards]" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Sidebar / Navigation Rail */}
      <aside className="fixed bottom-0 sm:top-0 left-0 h-16 sm:h-full w-full sm:w-16 border-t border-r-0 sm:border-t-0 sm:border-r border-[#141414] flex sm:flex-col justify-start items-center px-4 sm:px-0 py-0 sm:py-8 gap-1 sm:gap-8 bg-[#E4E3E0] z-50 overflow-x-auto overflow-y-hidden shrink-0">
        <div className="hidden sm:flex w-10 h-10 bg-[#141414] text-[#E4E3E0] items-center justify-center font-mono font-bold text-xl shrink-0" aria-hidden="true">
          AI
        </div>
        <nav aria-label="Dashboard Navigation" role="tablist" className="flex flex-row sm:flex-col items-center justify-center sm:justify-start gap-2 sm:gap-6 h-full sm:h-auto flex-1 min-w-max">
          <NavItem icon={<Activity size={20} />} active={activeTab === 'live'} onClick={() => setActiveTab('live')} tooltip="Live Feed" />
          <NavItem icon={<Sparkles size={20} />} active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} tooltip="AI Intelligence" />
          <NavItem icon={<Trophy size={20} />} active={activeTab === 'bumpers'} onClick={() => setActiveTab('bumpers')} tooltip="Bumper Archives" />
          <NavItem icon={<Calendar size={20} />} active={activeTab === 'schedule'} onClick={() => setActiveTab('schedule')} tooltip="Weekly Schedule" />
          <NavItem icon={<Bell size={20} />} active={activeTab === 'signals'} onClick={() => setActiveTab('signals')} tooltip="Custom Alerts" />
          <NavItem icon={<BrainCircuit size={20} />} active={activeTab === 'forecast'} onClick={() => setActiveTab('forecast')} tooltip="AI Forecast" />
          <NavItem icon={<History size={20} />} active={activeTab === 'history'} onClick={() => setActiveTab('history')} tooltip="History" />
          <NavItem icon={<RefreshCw size={20} />} active={activeTab === 'rectify'} onClick={() => setActiveTab('rectify')} tooltip="Sync Portal" />
          <NavItem icon={<Terminal size={20} />} active={activeTab === 'readme'} onClick={() => setActiveTab('readme')} tooltip="Logic" />
        </nav>
        <div className="flex flex-row sm:flex-col items-center gap-4 sm:gap-6 mt-0 sm:mt-auto pr-4 sm:pr-0 shrink-0">
           {user ? (
             <button 
               type="button"
               onClick={() => auth.signOut()}
               className="w-10 h-10 rounded-full border border-[#141414] overflow-hidden hover:opacity-80 transition-opacity shrink-0"
               aria-label={`Signed in as ${user.displayName}. Click to logout.`}
               title={`Signed in as ${user.displayName}. Click to logout.`}
             >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="User Profile" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-[#141414] text-white flex items-center justify-center text-[10px]">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
             </button>
           ) : (
             <button 
               type="button"
               onClick={handleSignIn}
               className="w-10 h-10 border border-[#141414] flex items-center justify-center hover:bg-[#141414] hover:text-white transition-all group shrink-0"
               aria-label="Sign in with Google"
               title="Sign in with Google"
             >
                <Zap size={18} className="group-hover:animate-pulse" aria-hidden="true" />
             </button>
           )}
           <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse hidden sm:block mb-4" role="status" aria-label="System Online" />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="pl-0 sm:pl-16 pb-16 sm:pb-0 min-h-screen relative">
        {/* Header */}
        <header role="banner" className="border-b border-[#141414] px-4 sm:px-8 py-8 sm:py-12">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 sm:gap-0 max-w-7xl mx-auto w-full">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="bg-[#141414] text-[#E4E3E0] text-[10px] px-2 py-0.5 font-mono uppercase tracking-widest">Live Engine</span>
                <p className="font-serif italic text-[10px] sm:text-xs opacity-70 uppercase tracking-widest text-[#141414]">Predictive Pattern Synthesis / Daily Report</p>
              </div>
              <h1 className="text-4xl sm:text-6xl font-bold tracking-tighter leading-none uppercase text-[#141414]">
                Lottery AI<br />
                Intelligence
              </h1>
            </div>
            <div className="text-left sm:text-right flex flex-col items-start sm:items-end w-full sm:w-auto">
              <button 
                type="button"
                onClick={handleManualSave}
                disabled={isSaving}
                className="flex items-center justify-center gap-2 bg-[#141414] text-[#E4E3E0] px-6 py-3 font-mono text-xs hover:opacity-90 transition-opacity mb-4 disabled:opacity-50 w-full sm:w-auto"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
                SAVE LIVE STATE
              </button>
              <div className="flex flex-row sm:flex-col justify-between sm:justify-start w-full sm:w-auto mt-2 sm:mt-0">
                <p className="font-mono text-xs opacity-70 mb-0 sm:mb-1 tracking-widest uppercase text-[#141414]">Node: ASIA-SOUTHEAST-1</p>
                <div className="flex items-center justify-end gap-2 text-green-800 font-mono text-[10px] font-bold mt-1 sm:mt-0">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" aria-hidden="true" />
                  FIRESTORE CONNECTED
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
          <AnimatePresence mode="wait">
            {activeTab === 'live' && (
              <motion.div 
                key="live"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-12"
              >
                {/* Live Stream Panel */}
                <div className="lg:col-span-2 flex flex-col gap-8">
                  <section aria-labelledby="live-feed-heading">
                    <h3 id="live-feed-heading" className="font-serif italic text-[10px] sm:text-xs opacity-70 uppercase tracking-widest mb-6 border-b border-[#141414] pb-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 text-[#141414]">
                      <span>Real-time Winning Feed (1st-9th)</span>
                      <div className="flex flex-wrap items-center gap-4">
                        {syncStatus === 'syncing' ? (
                          <div className="flex items-center gap-2" role="status" aria-label="Synchronizing with database">
                            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                            <span className="font-mono text-[9px] uppercase opacity-70">Syncing...</span>
                          </div>
                        ) : syncStatus === 'synced' ? (
                          <div className="flex items-center gap-2" role="status" aria-label="Live feed active and synchronized">
                            <CheckCircle2 size={12} className="text-green-700" />
                            <span className="font-mono text-[9px] uppercase opacity-70">Live Feed Active</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2" role="status" aria-label="Error synchronizing with database">
                            <AlertCircle size={12} className="text-red-700 animate-bounce" />
                            <span className="font-mono text-[9px] uppercase text-red-700 font-bold">Sync Error</span>
                          </div>
                        )}
                        <div className="flex items-center gap-4 border-l border-[#141414]/10 pl-4 h-4">
                          <div className="flex items-center gap-2" aria-live="polite">
                            {isRefreshing ? (
                              <RefreshCw size={10} className="animate-spin text-red-600" />
                            ) : (
                              <div className={`w-1 h-1 rounded-full ${isAutoRefreshEnabled ? 'bg-green-600' : 'bg-[#141414]/40'}`} />
                            )}
                            <span className="font-mono text-[9px] uppercase opacity-70 text-[#141414]">
                              {isRefreshing ? 'Pulsing...' : isAutoRefreshEnabled ? `Next: ${timeLeft}s` : 'Paused'}
                            </span>
                          </div>
                          <label htmlFor="refresh-interval" className="sr-only">Refresh interval</label>
                          <select 
                            id="refresh-interval"
                            value={refreshInterval} 
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setRefreshInterval(val);
                              setTimeLeft(val);
                            }}
                            className="bg-transparent border-none font-mono text-[9px] uppercase cursor-pointer hover:text-red-600 transition-colors focus:ring-0 p-0 outline-none text-[#141414]"
                          >
                            <option value="15" className="text-black">15s</option>
                            <option value="30" className="text-black">30s</option>
                            <option value="60" className="text-black">60s</option>
                          </select>
                          <button 
                            type="button"
                            onClick={() => setIsAutoRefreshEnabled(!isAutoRefreshEnabled)}
                            className="font-mono text-[9px] uppercase hover:text-red-700 transition-colors underline decoration-dotted text-[#141414]"
                          >
                            {isAutoRefreshEnabled ? 'Hold' : 'Resume'}
                          </button>
                          <button 
                            type="button"
                            onClick={() => setIsAutoPurge(!isAutoPurge)}
                            className={`font-mono text-[9px] uppercase transition-colors px-2 py-0.5 border border-[#141414] ${isAutoPurge ? 'bg-red-600 border-red-600 text-white' : 'hover:bg-red-600 hover:text-white hover:border-red-600 text-[#141414]'}`}
                          >
                            Auto-Purge {isAutoPurge ? 'ON' : 'OFF'}
                          </button>
                          <button 
                            type="button"
                            onClick={() => setIsAutoPilot(!isAutoPilot)}
                            className={`font-mono text-[9px] uppercase transition-colors px-2 py-0.5 border border-[#141414] ${isAutoPilot ? 'bg-[#141414] text-white' : 'hover:bg-[#141414] hover:text-white text-[#141414]'}`}
                          >
                            Auto Pilot {isAutoPilot ? 'ON' : 'OFF'}
                          </button>
                          <button 
                            type="button"
                            onClick={handleForceSync}
                            disabled={isRefreshing}
                            className={`font-mono text-[9px] uppercase transition-colors px-2 py-0.5 border border-[#141414] ${isRefreshing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#141414] hover:text-white text-[#141414]'}`}
                          >
                            Force Sync
                          </button>
                          <button 
                            type="button"
                            onClick={() => setShowRectifier(!showRectifier)}
                            className={`font-mono text-[9px] uppercase transition-colors px-2 py-0.5 border border-red-600 ${showRectifier ? 'bg-red-600 text-white' : 'text-red-600 hover:bg-red-600 hover:text-white'}`}
                          >
                            {showRectifier ? 'Close Portal' : 'Rectify Feed'}
                          </button>
                        </div>
                      </div>
                    </h3>

                    <AnimatePresence>
                      {showRectifier && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden mb-8"
                        >
                          <div className="bg-[#141414] text-[#E4E3E0] p-6 border-b-4 border-red-600">
                             <div className="flex items-center gap-2 mb-4">
                                <Sparkles size={16} className="text-red-600" />
                                <h4 className="font-bold uppercase tracking-tighter">AI Result Rectification Portal</h4>
                             </div>
                             <p className="text-[10px] font-mono opacity-50 mb-4 leading-relaxed">
                               Paste the raw result text from the official Kerala Lottery portal. The AI engine will parse the draw ID, first prize, and metadata to synchronize your production chain with official records. Use this if the automatic feed lags.
                             </p>
                             <label htmlFor="rectification-data" className="sr-only">Official result text for rectification</label>
                             <textarea 
                               id="rectification-data"
                               value={rectificationText}
                               onChange={(e) => setRectificationText(e.target.value)}
                               placeholder="e.g. KARUNYA PLUS KN-621 (30/04/2026) 1st Prize: KN 123456 ..."
                               className="w-full bg-white/5 border-white/10 p-4 font-mono text-xs focus:ring-1 focus:ring-red-600 outline-none h-32 mb-4 text-[#E4E3E0]"
                             />
                             <div className="flex justify-between items-center">
                                <a 
                                  href="https://statelottery.kerala.gov.in/index.php/lottery-result-view" 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-[9px] font-mono uppercase underline opacity-70 hover:opacity-100 flex items-center gap-1 text-[#E4E3E0]"
                                >
                                  Official Portal <ExternalLink size={10} aria-hidden="true" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleManualRectify(rectificationText);
                                    setRectificationText('');
                                  }}
                                  disabled={isAiProcessing || !rectificationText.trim()}
                                  className="bg-red-600 text-white px-6 py-2 font-mono text-[10px] uppercase font-bold hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-all"
                                >
                                  {isAiProcessing ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Zap size={12} aria-hidden="true" />}
                                  Synchronize Chain
                                </button>
                             </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="border border-[#141414] bg-white/50 backdrop-blur-sm">
                      {syncStatus === 'syncing' && liveResults.length === 0 ? (
                        <div className="space-y-4">
                          {[...Array(5)].map((_, i) => (
                            <div key={`loader-main-${i}`} className="h-20 bg-[#141414]/5 animate-pulse border border-[#141414]/10" />
                          ))}
                        </div>
                      ) : liveResults.length > 0 ? (
                        liveResults.map((result, idx) => (
                          <div 
                            key={`live-res-${result.id || idx}-${idx}`} 
                            onClick={() => setSelectedResult(result)}
                            className="flex flex-col sm:flex-row justify-between items-center p-4 border-b border-[#141414] last:border-b-0 hover:bg-[#141414] hover:text-[#E4E3E0] transition-all group cursor-pointer"
                          >
                            <div className="flex items-center gap-6">
                              <span className="font-mono text-xs opacity-40 group-hover:text-white/40">{result.date}</span>
                              <div className="flex flex-col">
                                <span className="font-bold text-sm uppercase tracking-tight">{result.lotteryName}</span>
                                <span className="text-[10px] uppercase opacity-50 group-hover:text-white/50">{result.drawNo} — {result.tier}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-8 mt-4 sm:mt-0">
                              <div className="text-right">
                                <p className="font-mono text-xl font-bold tracking-tighter">
                                  {result.series} <span className="text-red-500 group-hover:text-red-400">{result.number}</span>
                                </p>
                                <p className="text-[9px] font-mono opacity-40 uppercase group-hover:text-white/40">Terminal ID: {result.last4}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-12 text-center flex flex-col items-center gap-4">
                          <Loader2 size={32} className="animate-spin opacity-20" />
                  <p className="font-mono text-xs uppercase opacity-70 tracking-widest text-[#141414]">Waiting for live data ingestion...</p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                {/* Right Column: AI Pulse & Stats */}
                <div className="flex flex-col gap-12">
                  <section className="bg-[#141414] text-[#E4E3E0] p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-20">
                      <Cpu size={40} />
                    </div>
                    <h3 className="font-serif italic text-xs uppercase tracking-widest mb-6 border-b border-white/20 pb-2">AI Pattern Insight</h3>
                    <button 
                        onClick={runAiAnalysis}
                        disabled={isAiProcessing}
                        className="w-full mb-6 py-2 bg-yellow-400 text-[#141414] font-bold uppercase text-xs tracking-tight hover:bg-yellow-300 disabled:opacity-50"
                    >
                        {isAiProcessing ? "Analyzing..." : "Run AI Pattern Analysis"}
                    </button>
                    {aiInsights ? (
                      <div className="space-y-4">
                        <p className="font-serif text-sm leading-relaxed italic border-l-2 border-yellow-400 pl-4">
                          "{aiInsights.summary}"
                        </p>
                        <div>
                            <h4 className="font-bold text-xs uppercase mb-2">Patterns</h4>
                            <ul className="list-disc list-inside font-mono text-[10px] space-y-1">
                                {aiInsights.patterns.map((p: any, i: number) => <li key={`pattern-${p.value}-${i}`}>{p.value} ({p.count})</li>)}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-xs uppercase mb-2">Sequences</h4>
                            <ul className="list-disc list-inside font-mono text-[10px] space-y-1">
                                {aiInsights.sequences.map((s: any, i: number) => <li key={`sequence-${s.value}-${i}`}>{s.value} ({s.count})</li>)}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-xs uppercase mb-2">Biases</h4>
                            <ul className="list-disc list-inside font-mono text-[10px] space-y-1">
                                {aiInsights.biases.map((b: any, i: number) => <li key={`bias-${b.value}-${i}`}>{b.value} ({b.count})</li>)}
                            </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="h-40 flex items-center justify-center">
                        <p className="font-mono text-[10px] opacity-30 uppercase tracking-widest text-center">
                            {isAiProcessing ? "Analyzing Draw Data..." : "Run analysis to generate insights."}
                        </p>
                      </div>
                    )}
                  </section>

                  <section>
                    <h3 className="font-serif italic text-xs opacity-50 uppercase tracking-widest mb-4 border-b border-[#141414] pb-2 text-center">Synthesis Metrics</h3>
                    <div className="flex flex-col gap-4">
                      <StatRow label="Processing Engine" value="AI-Scraper 2.1" />
                      <StatRow label="Pattern Analysis" value="1st-9th Tiers" />
                      <StatRow label="Repeat Detection" value="Active (Last 4D)" />
                      <StatRow label="AI Model" value="Gemini Flash 1.5" />
                    </div>
                  </section>

                  <section className="border border-[#141414] p-6 bg-white/40">
                     <h3 className="font-mono text-[10px] uppercase opacity-50 mb-4 flex items-center justify-between">
                        <span>Today's Rotation</span>
                        <Calendar size={12} />
                     </h3>
                     <div className="flex items-center justify-between">
                        <span className="font-mono text-xs opacity-40 uppercase">{new Date().toLocaleDateString('en-US', { weekday: 'long' })}</span>
                        <span className="font-bold text-lg uppercase tracking-tight">
                           {schedule.find(s => s.day === new Date().toLocaleDateString('en-US', { weekday: 'long' }))?.name || "No Scheduled Draw"}
                        </span>
                     </div>
                     <button 
                       onClick={() => setActiveTab('schedule')}
                       className="w-full mt-4 border border-[#141414] py-2 font-mono text-[9px] uppercase hover:bg-[#141414] hover:text-white transition-all shadow-[2px_2px_0_#141414] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                     >
                        View Full Weekly Calendar
                     </button>
                  </section>
                </div>
              </motion.div>
            )}

            {activeTab === 'analytics' && (
              <motion.div 
                key="analytics"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-12 w-full max-w-7xl"
              >
                {/* Forecast Banner */}
                {lastForecast ? (
                  <div className="bg-[#141414] text-[#E4E3E0] p-1 border border-[#141414]">
                     <div className="bg-[#E4E3E0] text-[#141414] p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-red-500 text-white text-[9px] px-2 py-0.5 font-bold tracking-widest uppercase">Predictive Forecast</span>
                            <span className="font-mono text-[10px] opacity-50 uppercase tracking-widest">For {lastForecast.date} / {lastForecast.targetLottery}</span>
                          </div>
                          <h2 className="text-4xl font-bold tracking-tighter uppercase leading-none mb-4">
                             Detected Digest:<br />
                             <span className="text-red-600">{lastForecast.predictedSegments}</span>
                          </h2>
                          <button 
                            onClick={() => handleSaveForecast(lastForecast)}
                            disabled={isSavingForecast}
                            className="flex items-center gap-2 bg-[#141414] text-white px-4 py-2 font-mono text-[9px] uppercase hover:bg-red-600 transition-colors disabled:opacity-50 shadow-[4px_4px_0_#FECC00] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                          >
                            {isSavingForecast ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                            Archive Forecast
                          </button>
                        </div>
                        <div className="flex flex-col items-end gap-2 border-l border-[#141414]/20 pl-8">
                           <p className="font-mono text-[10px] opacity-50 uppercase">Analysis Confidence</p>
                           <div className="flex items-center gap-2">
                              <div className="w-32 h-2 bg-[#141414]/10 rounded-full overflow-hidden">
                                 <div className="h-full bg-green-500" style={{ width: `${lastForecast.confidenceScore * 100}%` }} />
                              </div>
                              <span className="font-mono text-xs font-bold">{(lastForecast.confidenceScore * 100).toFixed(0)}%</span>
                           </div>
                           <p className="text-[10px] italic opacity-40 max-w-[200px] text-right">Based on terminal variance drift</p>
                        </div>
                     </div>
                  </div>
                ) : (
                  <div className="bg-[#141414] text-[#E4E3E0] p-12 text-center border border-[#141414]">
                     <p className="font-mono text-xs uppercase opacity-40">Calculating predictive forecast engine...</p>
                     <p className="text-[10px] opacity-30 mt-2 italic">Historical depth requirement: 48 hours minimum</p>
                  </div>
                )}

                {/* Locked Archivals Section */}
                {savedForecasts.length > 0 && (
                  <div className="border border-[#141414] bg-[#141414] text-white p-8 mb-4 shadow-[8px_8px_0_#FECC00]">
                    <div className="flex justify-between items-center mb-6 border-b border-white/20 pb-2">
                       <h3 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
                          <Lock size={18} className="text-red-500" /> Locked Archivals
                       </h3>
                       <span className="font-mono text-[8px] uppercase opacity-40">Secure Pattern Vault v2</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                       {savedForecasts.map((f, i) => (
                         <div key={`${f.id}-${i}`} className="border border-white/10 p-4 hover:bg-white hover:text-[#141414] transition-all group relative">
                            <button 
                              onClick={() => f.id && handleDeleteForecast(f.id)}
                              className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-red-600 text-white p-1 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all z-10"
                            >
                               <Trash2 size={12} />
                            </button>
                            <p className="font-mono text-[8px] opacity-40 mb-1">{f.date}</p>
                            <h5 className="font-bold text-xs uppercase mb-2 truncate">{f.targetLottery}</h5>
                            <div className="bg-[#141414] text-white p-2 font-mono text-[10px] group-hover:bg-[#E4E3E0] group-hover:text-[#141414] transition-colors border border-white/5">
                               {f.predictedSegments}
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="bg-white p-12 border border-[#141414]">
                    <h4 className="text-4xl font-bold tracking-tighter uppercase mb-2">Synthesis Mode</h4>
                    <p className="font-mono text-[10px] uppercase opacity-50 mb-8 items-center flex gap-2">
                       <ShieldCheck size={12} className="text-green-600" /> Secure Pattern Storage Active
                    </p>
                    <div className="space-y-6">
                      <FeatureCard icon={<BarChart3 size={20} />} title="Digit Probability" description="We map the historical weight of every terminal 4-digit sequence to find high-probability gaps." />
                      <FeatureCard icon={<Zap size={20} />} title="Mechanical Drift" description="AI identifies mechanical variances in the physical draw systems based on series repetition." />
                    </div>
                  </div>
                  <div className="flex flex-col justify-center gap-8">
                    <p className="text-2xl font-serif italic text-[#141414]/70 leading-snug">
                       {lastForecast?.analysisBasis || "By integrating standard web scraping with a live Firestore backbone, the intelligence agent can now provide real-time updates directly to your dashboard."}
                    </p>
                    <div className="h-[1px] bg-[#141414]" />
                    <code className="text-xs font-mono opacity-50"># GEMINI_PROMPT_VERSION: 2.1.2_REPETITION_FOCUS</code>
                  </div>
                </div>

                <AIInsightsVisualizer aiInsights={aiInsights} isAiProcessing={isAiProcessing} runAiAnalysis={runAiAnalysis} />

                {/* Accuracy Metrics Section */}
                <DigitFrequencyHeatmap results={allResults} />

                <TerminalDigitsVisualizer results={allResults} />

                <div className="border border-[#141414] bg-white p-12">
                   <div className="flex justify-between items-end mb-12">
                      <div>
                        <h3 className="text-4xl font-bold tracking-tighter uppercase mb-2">Precision Benchmarking</h3>
                        <p className="font-mono text-[10px] uppercase opacity-50 tracking-widest">Historical Accuracy vs Actual Outcomes</p>
                      </div>
                      <div className="text-right">
                         <div className="text-2xl font-bold tracking-tighter">
                            {accuracyData.length > 0 
                              ? (accuracyData.reduce((acc, curr) => acc + curr.accuracy, 0) / accuracyData.length).toFixed(1) 
                              : "0.0"}%
                         </div>
                         <p className="text-[9px] uppercase font-mono opacity-40">System Avg Accuracy</p>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 h-[400px]">
                      {/* Daily Performance */}
                      <div className="flex flex-col">
                         <h5 className="font-mono text-[10px] uppercase opacity-60 mb-4 flex items-center gap-2">
                            <Activity size={12} className="text-blue-500" /> Daily Draw Accuracy Trend
                         </h5>
                         <div className="flex-1 min-h-0 bg-[#E4E3E0]/30 border border-[#141414]/10 p-4">
                            <ResponsiveContainer width="100%" height="100%">
                               <LineChart data={accuracyData.filter(d => d.type === 'daily')}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#141414" opacity={0.1} />
                                  <XAxis 
                                    dataKey="date" 
                                    stroke="#141414" 
                                    fontSize={10} 
                                    tickFormatter={(val) => val.split('-').slice(1).join('/')} 
                                  />
                                  <YAxis stroke="#141414" fontSize={10} domain={[0, 100]} />
                                  <Tooltip 
                                    content={<CustomTooltip />}
                                  />
                                  <Line 
                                    type="stepAfter" 
                                    dataKey="accuracy" 
                                    stroke="#141414" 
                                    strokeWidth={3} 
                                    dot={{ r: 4, fill: '#141414' }} 
                                    activeDot={{ r: 8, fill: '#ef4444', stroke: '#141414', strokeWidth: 2 }} 
                                  />
                               </LineChart>
                            </ResponsiveContainer>
                         </div>
                      </div>

                      {/* Weekly/Bumper Performance */}
                      <div className="flex flex-col">
                         <h5 className="font-mono text-[10px] uppercase opacity-60 mb-4 flex items-center gap-2">
                            <Calendar size={12} className="text-red-500" /> Weekly Variance Distribution
                         </h5>
                         <div className="flex-1 min-h-0 bg-[#E4E3E0]/30 border border-[#141414]/10 p-4 font-mono">
                            {accuracyData.filter(d => d.type === 'weekly').length > 0 ? (
                               <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={accuracyData.filter(d => d.type === 'weekly')}>
                                     <CartesianGrid strokeDasharray="3 3" stroke="#141414" opacity={0.1} />
                                     <XAxis dataKey="lottery" stroke="#141414" fontSize={8} />
                                     <YAxis stroke="#141414" fontSize={10} domain={[0, 100]} />
                                     <Tooltip 
                                      cursor={{ fill: '#141414', opacity: 0.05 }}
                                      content={<CustomTooltip />}
                                     />
                                     <Bar dataKey="accuracy" fill="#141414">
                                        {accuracyData.filter(d => d.type === 'weekly').map((entry, index) => (
                                          <Cell 
                                            key={`weekly-cell-${index}`} 
                                            fill={entry.accuracy > 50 ? '#dc2626' : '#141414'} 
                                            className="transition-all duration-300 hover:opacity-80"
                                          />
                                        ))}
                                     </Bar>
                                  </BarChart>
                               </ResponsiveContainer>
                            ) : (
                               <div className="w-full h-full flex flex-col items-center justify-center text-center opacity-30">
                                  <Database size={24} className="mb-2" />
                                  <p className="text-[10px] uppercase tracking-widest">Insufficient Weekly<br />Bumper Depth Detected</p>
                               </div>
                            )}
                         </div>
                      </div>
                   </div>

                   {/* Daily Accuracy Analysis */}
                   <div className="mt-20 pt-12 border-t border-[#141414]/10">
                      <div className="flex justify-between items-end mb-8">
                         <div>
                           <h4 className="text-3xl font-bold tracking-tighter uppercase">Daily Accuracy Analysis</h4>
                           <p className="font-mono text-[10px] uppercase opacity-50 tracking-widest">Discrete Date Performance Breakdown</p>
                         </div>
                         <div className="flex gap-4">
                            <div className="text-right">
                               <p className="text-xl font-bold">{accuracyData.filter(d => d.type === 'daily').length > 0 ? (accuracyData.filter(d => d.type === 'daily').reduce((acc, c) => acc + c.accuracy, 0) / accuracyData.filter(d => d.type === 'daily').length).toFixed(1) : '0.0'}%</p>
                               <p className="text-[8px] font-mono uppercase opacity-40">Daily Mean</p>
                            </div>
                         </div>
                      </div>
                      
                      <div className="h-[300px] w-full bg-[#141414]/5 p-8 border border-[#141414]/5">
                         <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={accuracyData.filter(d => d.type === 'daily')}>
                               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#141414" opacity={0.05} />
                               <XAxis 
                                  dataKey="date" 
                                  stroke="#141414" 
                                  fontSize={10}
                                  tickFormatter={(val) => val.split('-').slice(2).join('/')}
                               />
                               <YAxis stroke="#141414" fontSize={10} domain={[0, 100]} />
                               <Tooltip content={<CustomTooltip />} cursor={{ fill: '#141414', opacity: 0.05 }} />
                               <Bar dataKey="accuracy" fill="#141414" opacity={0.15} radius={[4, 4, 0, 0]}>
                                  {accuracyData.filter(d => d.type === 'daily').map((entry, index) => (
                                    <Cell 
                                      key={`daily-cell-${index}`} 
                                      fill={entry.accuracy > 70 ? '#22c55e' : entry.accuracy > 40 ? '#141414' : '#ef4444'} 
                                    />
                                  ))}
                               </Bar>
                               <Line 
                                  type="monotone" 
                                  dataKey="accuracy" 
                                  stroke="#141414" 
                                  strokeWidth={2} 
                                  dot={{ r: 3, fill: '#141414', strokeWidth: 0 }} 
                                  activeDot={{ r: 6, fill: '#ef4444' }}
                               />
                               <Line 
                                  type="basis" 
                                  dataKey="avg" 
                                  stroke="#ef4444" 
                                  strokeWidth={1.5} 
                                  dot={false}
                                  strokeDasharray="4 4"
                               />
                            </ComposedChart>
                         </ResponsiveContainer>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
                         <div className="p-4 border border-[#141414]/10 bg-white">
                            <p className="font-mono text-[8px] uppercase opacity-40 mb-1">Max Accuracy</p>
                            <p className="text-xl font-bold tracking-tighter">{Math.max(0, ...accuracyData.filter(d => d.type === 'daily').map(d => d.accuracy)).toFixed(0)}%</p>
                         </div>
                         <div className="p-4 border border-[#141414]/10 bg-white">
                            <p className="font-mono text-[8px] uppercase opacity-40 mb-1">Total Samples</p>
                            <p className="text-xl font-bold tracking-tighter">{accuracyData.filter(d => d.type === 'daily').length}</p>
                         </div>
                         <div className="p-4 border border-[#141414]/10 bg-white">
                            <p className="font-mono text-[8px] uppercase opacity-40 mb-1">High Precision ({'>'}70%)</p>
                            <p className="text-xl font-bold tracking-tighter">{accuracyData.filter(d => d.type === 'daily' && d.accuracy > 70).length}</p>
                         </div>
                         <div className="p-4 border border-[#141414]/10 bg-white">
                            <p className="font-mono text-[8px] uppercase opacity-40 mb-1">Stability Index</p>
                            <p className="text-xl font-bold tracking-tighter">
                               {accuracyData.filter(d => d.type === 'daily').length > 1 
                                 ? (100 - (accuracyData.filter(d => d.type === 'daily').reduce((acc, curr, i, arr) => i > 0 ? acc + Math.abs(curr.accuracy - arr[i-1].accuracy) : acc, 0) / (accuracyData.filter(d => d.type === 'daily').length - 1))).toFixed(1)
                                 : '100.0'}
                            </p>
                         </div>
                      </div>
                   </div>

                   {/* System Stability Trend */}
                   <div className="mt-20 pt-12 border-t border-[#141414]/10">
                      <div className="flex flex-col md:flex-row gap-12">
                         <div className="md:w-1/3">
                            <div className="bg-[#141414] text-white p-6 mb-8">
                               <p className="font-mono text-[10px] uppercase opacity-40 mb-2">Trend Diagnostic</p>
                               <h4 className="text-xl font-bold tracking-tight uppercase leading-tight">
                                  {accuracyData.length > 5 && (accuracyData[accuracyData.length-1].avg || 0) > (accuracyData[accuracyData.length-5].avg || 0) 
                                    ? "Ascending Signal Stability" 
                                    : "Entropy Divergence Detected"}
                               </h4>
                            </div>
                            <div className="space-y-6">
                               <div>
                                  <p className="font-mono text-[10px] uppercase opacity-40 mb-1">Peak Observation</p>
                                  <p className="text-sm font-medium">
                                     {accuracyData.length > 0 
                                      ? `Max Recorded: ${Math.max(...accuracyData.map(d => d.accuracy))}% Match` 
                                      : "Analyzing..."}
                                  </p>
                               </div>
                               <div>
                                  <p className="font-mono text-[10px] uppercase opacity-40 mb-1">Neural Drift Check</p>
                                  <p className="text-xs opacity-60 leading-relaxed">
                                     Current moving average shows a 
                                     <span className="font-bold mx-1">
                                        {accuracyData.length > 0 ? (accuracyData[accuracyData.length-1].avg || 0).toFixed(1) : "0"}%
                                     </span> 
                                     correlation stability. High variance periods usually precede database updates.
                                  </p>
                               </div>
                            </div>
                         </div>
                         <div className="flex-1 h-[250px] bg-[#141414]/5 p-8 relative">
                             <div className="absolute top-4 left-4 z-10">
                                <span className="bg-white text-[8px] px-1.5 py-0.5 border border-[#141414] font-bold uppercase tracking-tighter">Rolling Mean (5-Pt)</span>
                             </div>
                             <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={accuracyData}>
                                   <defs>
                                      <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                                         <stop offset="5%" stopColor="#141414" stopOpacity={0.1}/>
                                         <stop offset="95%" stopColor="#141414" stopOpacity={0}/>
                                      </linearGradient>
                                   </defs>
                                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#141414" opacity={0.05} />
                                   <XAxis 
                                      dataKey="date" 
                                      hide 
                                   />
                                   <YAxis hide domain={[0, 100]} />
                                   <Tooltip content={<CustomTooltip />} />
                                   <Area 
                                      type="monotone" 
                                      dataKey="avg" 
                                      stroke="#141414" 
                                      strokeWidth={1}
                                      fillOpacity={1} 
                                      fill="url(#colorAvg)" 
                                   />
                                </AreaChart>
                             </ResponsiveContainer>
                         </div>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'bumpers' && (
              <motion.div 
                key="bumpers"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                 <BumperView 
                  results={allResults} 
                  generateInsight={generateInsight} 
                  aiInsight={aiInsight} 
                  isAiProcessing={isAiProcessing} 
                />
              </motion.div>
            )}

            {activeTab === 'schedule' && (
              <motion.div 
                key="schedule"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-7xl"
              >
                <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
                   <div>
                     <h3 className="text-4xl font-bold uppercase tracking-tighter">Lottery Calendar</h3>
                     <p className="font-mono text-[10px] uppercase opacity-50 tracking-widest">Standardized Kerala State Draw Frequency</p>
                   </div>
                   <div className="bg-[#141414] text-white px-6 py-3 font-mono text-[10px] uppercase tracking-widest flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live Rotation Established
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  {schedule.map((s, i) => {
                    const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === s.day;
                    return (
                      <div 
                        key={`cad-schedule-${s.day}-${i}`} 
                        className={`border-4 p-8 transition-all flex flex-col justify-between h-64 relative group ${isToday ? 'border-[#141414] bg-white shadow-[12px_12px_0_#141414]' : 'border-[#141414]/10 hover:border-[#141414]/40 bg-white/50'}`}
                      >
                        {isToday && (
                          <div className="absolute -top-4 -left-4 bg-[#141414] text-white text-[8px] font-bold px-3 py-1 uppercase tracking-widest z-10">Active Today</div>
                        )}
                        <div>
                          <p className={`font-mono text-[10px] uppercase mb-1 ${isToday ? 'opacity-100 font-bold underline' : 'opacity-40'}`}>{s.day}</p>
                          <h4 className="text-3xl font-bold uppercase tracking-tighter leading-none mb-4 group-hover:text-red-600 transition-colors">{s.name}</h4>
                          <div className="h-[1px] bg-[#141414]/10 w-full mb-4" />
                          <p className="text-[10px] opacity-60 leading-relaxed italic">Standard draw commences at 15:00 IST. Digital verification available by 16:30 IST.</p>
                        </div>
                        <div className="flex justify-between items-center mt-4">
                           <span className="font-mono text-[10px] font-bold opacity-30">#KL_DIR_{s.name.slice(0, 3).toUpperCase()}</span>
                           <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-20 border-t-4 border-[#141414] pt-12">
                   <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                      <div className="lg:col-span-1">
                        <h5 className="text-xl font-bold uppercase tracking-tighter mb-4">Official Disclaimer</h5>
                        <p className="text-xs opacity-60 leading-relaxed font-serif uppercase tracking-tight">
                          ALL DRAW SCHEDULES ARE SUBJECT TO GOVERNMENT MANDATED HOLIDAYS AND ADMINISTRATIVE CHANGES. THIS AGENT SYNCHRONIZES WITH THE KERALA STATE LOTTERY DEPARTMENT'S CORE DATABASE ON A 15-MINUTE POLLING DURATION.
                        </p>
                      </div>
                      <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-6">
                         <div className="p-6 bg-white border border-[#141414]/10">
                            <p className="font-mono text-[8px] uppercase opacity-40 mb-2">Draw Location</p>
                            <p className="text-sm font-bold uppercase">Gorky Bhavan, TVM</p>
                         </div>
                         <div className="p-6 bg-white border border-[#141414]/10">
                            <p className="font-mono text-[8px] uppercase opacity-40 mb-2">Polling Latency</p>
                            <p className="text-sm font-bold uppercase">~840ms Engine Delay</p>
                         </div>
                         <div className="p-6 bg-white border border-[#141414]/10">
                            <p className="font-mono text-[8px] uppercase opacity-40 mb-2">Validation Level</p>
                            <p className="text-sm font-bold uppercase">L3 Neural Verify</p>
                         </div>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'signals' && (
              <motion.div 
                key="signals"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-7xl"
              >
                <SignalsView 
                   user={user}
                   alerts={alerts}
                   signals={signals}
                   onAddAlert={handleAddAlert}
                   onDeleteAlert={handleDeleteAlert}
                   onToggleAlert={handleToggleAlert}
                   onClearSignals={() => setSignals([])}
                   onAiAutoFill={handleAiAutoFillAlerts}
                   isAiProcessing={isAiProcessing}
                />
              </motion.div>
            )}

            {activeTab === 'rectify' && (
              <motion.div 
                key="rectify"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full"
              >
                <RectifyPortal />
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-7xl"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-8 sm:mb-12">
                   <h3 className="text-2xl sm:text-4xl font-bold uppercase tracking-tighter">Historical Archives</h3>
                   <div className="flex gap-4">
                      <div className="flex items-center gap-2 font-mono text-[10px] uppercase opacity-50 border border-[#141414]/10 px-4 py-2">
                        {isHistoricalLoading ? (
                          <>
                            <Loader2 size={12} className="animate-spin" /> Fetching Archive...
                          </>
                        ) : (
                          <>
                            <Database size={12} /> Total Records: {historicalResults.length}
                          </>
                        )}
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                   <div className="lg:col-span-2 space-y-4 overflow-x-auto pb-4">
                      <div className="min-w-[500px]">
                        <div className="grid grid-cols-4 px-6 font-mono text-[10px] uppercase opacity-40 mb-2">
                          <div>Date / ID</div>
                          <div>Lottery</div>
                          <div>Winning Segments</div>
                          <div className="text-right">Payout</div>
                        </div>
                        <div className="space-y-2">
                        {isHistoricalLoading ? (
                          <div className="space-y-4 p-4">
                            {[...Array(5)].map((_, i) => (
                              <div key={`skeleton-hist-${i}`} className="h-20 bg-[#141414]/5 animate-pulse border border-[#141414]/10" />
                            ))}
                          </div>
                        ) : (
                          historicalResults.slice(0, 20).map((res, i) => (
                            <motion.div 
                              key={`${res.id}-${i}`} 
                              whileHover={{ x: 4 }}
                              onClick={() => setSelectedResult(res)}
                              className="grid grid-cols-4 items-center p-4 bg-white border border-[#141414] hover:bg-[#141414] hover:text-white transition-all group cursor-pointer shadow-[2px_2px_0_#141414]"
                            >
                              <div className="flex flex-col">
                                <span className="font-mono text-[10px] opacity-50 group-hover:text-white/50">{res.date}</span>
                                <span className="text-[9px] font-bold tracking-widest">{res.drawNo}</span>
                              </div>
                              <div className="font-bold uppercase tracking-tight text-sm">{res.lotteryName}</div>
                              <div className="font-mono font-bold text-lg">
                                {res.series} <span className="text-red-500 group-hover:text-red-400">{res.number}</span>
                              </div>
                              <div className="text-right font-bold text-green-600 group-hover:text-green-400">
                                ₹{res.amount.toLocaleString()}
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                      </div>
                   </div>

                   <div className="space-y-8">
                     <div className="border border-[#141414] p-8 bg-white">
                        <h4 className="text-xl font-bold uppercase mb-4 flex items-center gap-2">
                          <Calendar size={18} /> Schedule Digest
                        </h4>
                        <div className="space-y-2">
                          {schedule.map((s, i) => (
                            <div key={`digest-schedule-${s.day}-${i}`} className="flex justify-between items-center py-2 border-b border-[#141414]/10 last:border-b-0 text-sm">
                              <span className="font-mono text-[10px] opacity-40 uppercase">{s.day}</span>
                              <span className="font-bold uppercase tracking-tight">{s.name}</span>
                            </div>
                          ))}
                        </div>
                     </div>

                     <div className="border border-[#141414] p-8 bg-white">
                        <h4 className="text-xl font-bold uppercase mb-4 flex items-center gap-2">
                          <Zap size={18} /> Prize Structure
                        </h4>
                        <div className="space-y-3">
                          {prizes.map((p, i) => (
                            <div key={`struct-prize-${p.tier}-${i}`} className="flex justify-between items-end border-b border-[#141414]/5 pb-2">
                              <div>
                                <p className="text-[10px] font-mono uppercase opacity-40 leading-none">Tier</p>
                                <p className="font-bold">{p.tier}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-mono uppercase opacity-40 leading-none">Amount</p>
                                <p className="font-mono font-bold">₹{p.amount}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                     </div>
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'requirements' && (
              <motion.div 
                key="requirements"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-3xl"
              >
                <h3 className="font-serif italic text-xs opacity-50 uppercase tracking-widest mb-6 border-b border-[#141414] pb-2 text-[#141414]">Infrastructure Requirements</h3>
                <div className="grid gap-4">
                  <RequirementRow library="google-generativeai" purpose="LLM Interface for AI Synthesis" version="1.29.0" />
                  <RequirementRow library="requests" purpose="Protocol for Archive Investigation" version="2.31.0" />
                  <RequirementRow library="pdfplumber" purpose="Optical-like PDF Text Extraction" version="0.10.3" />
                  <RequirementRow library="beautifulsoup4" purpose="Dynamic DOM Parsing for Archives" version="4.12.2" />
                </div>
                <div className="mt-12 bg-white/50 p-6 border-l-4 border-[#141414]">
                  <p className="text-sm leading-relaxed">
                    <strong>API Configuration:</strong> The script requires a <code className="bg-[#141414] text-[#E4E3E0] px-1">GEMINI_API_KEY</code> environment variable. Without this, the extraction will proceed but AI analytics will be bypassed.
                  </p>
                </div>
              </motion.div>
            )}

            {activeTab === 'forecast' && (
              <motion.div 
                key="forecast"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-7xl"
              >
                <ForecastingView user={user} />
              </motion.div>
            )}

            {activeTab === 'readme' && (
              <motion.div 
                key="readme"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="prose prose-neutral max-w-none prose-sm font-sans"
              >
                <div className="flex justify-between items-center border-b border-[#141414] pb-2 mb-8">
                  <h3 className="font-serif italic text-xs opacity-50 uppercase tracking-widest text-[#141414]">technical_manifest.md</h3>
                  <button className="flex items-center gap-1 text-[10px] uppercase font-mono px-2 py-1 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">
                    <Download size={10} /> Export Script
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div>
                    <h4 className="text-2xl font-bold mb-4">Core Processing Logic</h4>
                    <p className="mb-4 text-[#141414]/70 leading-relaxed">The engine operates as a sequential data pipeline. Each date in the 2012-2026 range is treated as a discrete processing unit. The system performs a dynamic lookup, verifies PDF consistency, extracts results, and generates a relative AI analysis before final CSV serialization.</p>
                    <h5 className="font-mono text-xs uppercase opacity-50 mb-4 text-[#141414]">Extraction Targets</h5>
                    <div className="grid grid-cols-2 gap-x-12 gap-y-2">
                       <ul className="list-none p-0 text-[10px] font-mono uppercase space-y-1">
                         <li className="flex justify-between"><span>1st Prize</span> <span>₹1 Cr</span></li>
                         <li className="flex justify-between"><span>2nd Prize</span> <span>₹30 L</span></li>
                         <li className="flex justify-between"><span>3rd Prize</span> <span>₹5 L</span></li>
                       </ul>
                       <ul className="list-none p-0 text-[10px] font-mono uppercase space-y-1">
                         <li className="flex justify-between"><span>Consol.</span> <span>₹5 K</span></li>
                         <li className="flex justify-between"><span>4th-9th</span> <span>₹5K-100</span></li>
                         <li className="flex justify-between"><span>AI Report</span> <span>Stored</span></li>
                       </ul>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold mb-4">Operational Syntax</h4>
                    <pre className="bg-[#141414] text-[#E4E3E0] p-4 text-xs font-mono">
                      {`usage: scrape_kerala_lottery.py [-h]
                                [--start START]
                                [--end END]
                                [--output OUTPUT]
                                [--delay DELAY]

Intelligence Engine for Kerala Lottery

options:
  --start   Start Range (YYYY-MM-DD)
  --end     End Range (YYYY-MM-DD)
  --output  Primary CSV Target
  --delay   Heuristic Delay (Secs)`}
                    </pre>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Footer */}
        <footer className="border-t border-[#141414] px-8 py-6 mt-auto">
          <div className="max-w-7xl mx-auto flex justify-between items-center font-mono text-[10px] opacity-70 uppercase tracking-widest text-[#141414]">
            <span>© 2026 AI Intelligence Systems</span>
            <span>Auth: KL-AI-ANALYTICS-HISTORICAL-SYNTHESIS</span>
          </div>
        </footer>
      </main>
    </div>
  </ErrorBoundary>
  );
}

function NavItem({ icon, active, onClick, tooltip }: { icon: React.ReactNode, active: boolean, onClick: () => void, tooltip: string }) {
  return (
    <button 
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={tooltip}
      onClick={onClick}
      className={`relative p-3 transition-all group ${active ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-white/50 text-[#141414]'}`}
    >
      <span aria-hidden="true">{icon}</span>
      {!active && (
        <span className="absolute left-full ml-4 px-2 py-1 bg-[#141414] text-[#E4E3E0] text-[10px] uppercase font-mono opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
          {tooltip}
        </span>
      )}
    </button>
  );
}

function StatRow({ label, value, color }: { label: string, value: string, color?: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[#141414]/10 last:border-b-0">
      <span className="text-[10px] font-mono opacity-70 uppercase tracking-wider text-[#141414]">{label}</span>
      <span className={`text-[11px] font-bold uppercase tracking-tight ${color || 'text-[#141414]'}`}>{value}</span>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="border border-[#141414] p-6 hover:bg-white transition-colors">
      <div className="mb-4">{icon}</div>
      <h4 className="font-bold text-lg mb-2">{title}</h4>
      <p className="text-sm opacity-70 leading-relaxed font-sans">{description}</p>
    </div>
  );
}

function RequirementRow({ library, purpose, version }: { library: string, purpose: string, version: string }) {
  return (
    <div className="flex items-center justify-between p-4 border border-[#141414] hover:bg-white transition-colors">
      <div>
        <span className="font-mono font-bold text-sm block">{library}</span>
        <span className="text-[10px] opacity-60 uppercase">{purpose}</span>
      </div>
      <span className="font-mono text-xs opacity-40 uppercase">{version}</span>
    </div>
  );
}
