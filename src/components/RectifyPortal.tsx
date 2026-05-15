import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Cpu, 
  RefreshCw, 
  Database, 
  ExternalLink, 
  AlertCircle,
  CheckCircle2,
  Clock,
  Activity,
  History
} from 'lucide-react';
import { motion } from 'motion/react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface SyncLog {
  id: string;
  date: string;
  status: 'success' | 'error';
  message: string;
  createdAt: any;
}

export default function RectifyPortal() {
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'sync_logs'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SyncLog[];
      setSyncLogs(logs);
      if (logs.length > 0 && logs[0].createdAt) {
        setLastSync(new Date(logs[0].createdAt?.toDate()).toLocaleString());
      }
    }, (err) => {
      console.error("Error fetching sync logs:", err);
      setError("Failed to fetch sync logs from Firestore.");
    });

    return () => unsubscribe();
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const response = await fetch('/api/sync-lottery');
      const data = await response.json();
      if (data.status === 'success') {
        // Log is automatically updated via onSnapshot
      } else {
        setError(data.message || "Manual sync failed.");
      }
    } catch (e) {
      setError("Network error during sync trigger.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-12 max-w-7xl mx-auto">
      <div className="bg-[#141414] text-white p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <RefreshCw size={120} className={isSyncing ? "animate-spin" : ""} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-red-600 text-white px-3 py-1 font-mono text-[10px] font-bold tracking-widest uppercase">Production Chain</span>
            <span className="text-white/40 font-mono text-[10px] uppercase">Node Status: Active</span>
          </div>
          <h2 className="text-4xl sm:text-6xl font-bold tracking-tighter uppercase mb-6">
            AI Rectify Portal
          </h2>
          <p className="font-serif italic text-lg opacity-80 max-w-2xl mb-8">
            Real-time synchronization engine for the Kerala State Lottery results. Powered by predictive neural parsing and permanent record anchoring.
          </p>
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={handleManualSync}
              disabled={isSyncing}
              className="bg-yellow-400 text-[#141414] px-8 py-4 font-bold uppercase tracking-widest flex items-center gap-3 hover:bg-yellow-300 transition-all disabled:opacity-50 shadow-[6px_6px_0_rgba(255,255,255,0.2)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
            >
              {isSyncing ? <RefreshCw size={20} className="animate-spin" /> : <Zap size={20} />}
              {isSyncing ? "Syncing Logic..." : "Trigger Manual Sync"}
            </button>
            <a 
              href="https://www.keralalotteries.net/?m=1" 
              target="_blank" 
              rel="noopener noreferrer"
              className="border-2 border-white/20 px-8 py-4 font-bold uppercase tracking-widest flex items-center gap-3 hover:bg-white/10 transition-all group"
            >
              Official Portal <ExternalLink size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          <div className="border-4 border-[#141414] bg-white p-8 shadow-[12px_12px_0_#141414]">
            <div className="flex justify-between items-center mb-8 border-b-2 border-[#141414] pb-4">
              <h3 className="text-2xl font-bold uppercase tracking-tighter flex items-center gap-3">
                <History size={24} /> Sync Chain Audit
              </h3>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                <span className="font-mono text-[10px] uppercase opacity-70">
                  {isSyncing ? "Syncing..." : "Ready"}
                </span>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-600 flex items-center gap-3">
                <AlertCircle className="text-red-600" size={18} />
                <span className="font-mono text-xs uppercase text-red-600 font-bold">{error}</span>
              </div>
            )}

            <div className="space-y-4">
              {syncLogs.length > 0 ? syncLogs.map((log) => (
                <div key={log.id} className="flex grid grid-cols-1 sm:grid-cols-4 items-center gap-6 p-4 border border-[#141414]/10 hover:bg-[#141414]/5 transition-colors">
                  <div className="font-mono text-[10px] opacity-40 uppercase">
                    {log.createdAt ? new Date(log.createdAt.toDate()).toLocaleString() : "Pending..."}
                  </div>
                  <div className="sm:col-span-2">
                    <p className="font-bold uppercase tracking-tight text-sm">{log.message}</p>
                    <p className="text-[10px] font-mono opacity-50 uppercase">{log.date}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 font-mono text-[10px] font-bold uppercase italic tracking-widest ${log.status === 'success' ? 'bg-green-100 text-green-700 border border-green-700' : 'bg-red-100 text-red-700 border border-red-700'}`}>
                      {log.status}
                    </span>
                  </div>
                </div>
              )) : (
                <div className="h-48 flex flex-col items-center justify-center bg-[#141414]/5 text-center p-12">
                   <Activity size={32} className="mb-4 opacity-10" />
                   <p className="font-mono text-[10px] uppercase opacity-30 italic">No sync records detected in history vault...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="border-4 border-[#141414] p-8 bg-white">
            <h4 className="text-xl font-bold uppercase tracking-tighter mb-6 flex items-center gap-2">
              <Database size={18} /> Sync Policy
            </h4>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="bg-[#141414] text-white w-8 h-8 flex items-center justify-center shrink-0 font-mono text-xs font-bold">01</div>
                <div>
                  <h5 className="font-bold text-sm uppercase mb-1">Daily Automated Pulse</h5>
                  <p className="text-xs opacity-60 leading-relaxed font-serif italic">Every 24 hours, the AI scraper forces a handshake with the official portal to ensure parity across all 9 prize tiers.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="bg-[#141414] text-white w-8 h-8 flex items-center justify-center shrink-0 font-mono text-xs font-bold">02</div>
                <div>
                  <h5 className="font-bold text-sm uppercase mb-1">Permanent Anchor</h5>
                  <p className="text-xs opacity-60 leading-relaxed font-serif italic">All successfully parsed results are written to Firestore as immutable records, protected by regional redundancy.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="bg-[#141414] text-white w-8 h-8 flex items-center justify-center shrink-0 font-mono text-xs font-bold">03</div>
                <div>
                  <h5 className="font-bold text-sm uppercase mb-1">Validation Chain</h5>
                  <p className="text-xs opacity-60 leading-relaxed font-serif italic">AI analysis is automatically triggered post-sync to identify new terminal patterns and machine biases.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-4 border-[#141414] p-8 bg-blue-600 text-white shadow-[8px_8px_0_#141414]">
            <h4 className="text-xl font-bold uppercase tracking-tighter mb-4 flex items-center gap-2">
              <Clock size={18} /> Next Scheduled Pulse
            </h4>
            <div className="text-5xl font-mono font-bold tracking-tighter mb-2">
              12:00 <span className="text-sm opacity-50 uppercase font-mono">IST</span>
            </div>
            <p className="font-mono text-[10px] uppercase opacity-70 tracking-widest">Target: {new Date().toLocaleDateString('en-US', { weekday: 'long' })} Draw Data</p>
          </div>
        </div>
      </div>
    </div>
  );
}
