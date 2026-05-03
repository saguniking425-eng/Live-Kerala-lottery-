
import React, { useState, useEffect } from 'react';
import { Sparkles, BrainCircuit, Save, Loader2, AlertCircle, Check } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Forecast {
  id?: string;
  date: string;
  targetLottery: string;
  predictedSegments: string;
  confidenceScore: number;
  analysisBasis: string;
}

export default function ForecastingView({ user }: { user: any }) {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [lastForecast, setLastForecast] = useState<Forecast | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'forecasts'), orderBy('createdAt', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newForecasts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Forecast));
      setForecasts(prev => {
        if (JSON.stringify(prev) === JSON.stringify(newForecasts)) return prev;
        return newForecasts;
      });
    });
    return () => unsubscribe();
  }, []);

  const runForecast = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/run-forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: targetDate }),
      });
      const data = await response.json();
      if (data.status !== 'success') throw new Error(data.message);
      
      // Fetch latest forecast after running
      const latestSnapshot = await fetch('/api/get-latest-forecast'); // Need to add this
      // Wait, let's just use the snapshot observer
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 p-8 border-4 border-[#141414] bg-white">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold uppercase tracking-tighter">Predictive Forecast Module</h2>
        <button 
           onClick={runForecast}
           disabled={loading}
           className="flex items-center gap-2 bg-yellow-400 p-4 font-bold uppercase hover:bg-yellow-500 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" /> : <BrainCircuit />}
          {loading ? 'Analyzing...' : 'Generate New Forecast'}
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-6 border-2 border-[#141414]">
          <h3 className="text-lg font-bold uppercase mb-4">Run Forecast</h3>
          <input 
            type="date" 
            value={targetDate} 
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full p-2 border-2 border-[#141414] mb-4"
          />
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-bold uppercase mb-4">Past Forecasts</h3>
        <div className="space-y-4">
          {forecasts.map(f => (
            <div key={f.id} className="p-4 border-b border-[#141414]">
              <p className="font-bold">{f.date}: {f.predictedSegments}</p>
              <p className="text-sm">Confidence: {(f.confidenceScore * 100).toFixed(0)}%</p>
              <p className="text-xs italic">{f.analysisBasis}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
