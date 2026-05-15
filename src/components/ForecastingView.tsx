
import React, { useState, useEffect } from 'react';
import { Sparkles, BrainCircuit, Save, Loader2, AlertCircle, Check } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({ apiKey: key });
};
const ai = getAiClient();

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
    if (!ai) {
      alert("AI Engine unavailable. check GEMINI_API_KEY.");
      return;
    }
    setLoading(true);
    try {
      // 1. Get training data from server
      const trainingRes = await fetch('/api/training-data');
      const trainingData = await trainingRes.json();
      
      if (trainingData.status !== 'success') throw new Error("Failed to load historical context");

      // 2. Prepare Prompt
      const recentDataStr = JSON.stringify(trainingData.data, null, 2);
      const prompt = `
            SYSTEM DATA: ${recentDataStr}
            TARGET DATE: ${targetDate}
            CONSTRAINTS: 
            1. DO NOT REPEAT NUMBERS FROM THE SEARCH RESULTS OR RECENT PREDICTIONS.
            2. ANALYZE TERMINAL DIGIT DRIFT (LAST 4 DIGITS) TO IDENTIFY UNDERSERVED OR "HOT" PATTERNS.
            3. BE CREATIVE AND VARY THE DIGIT COMBINATIONS.
            4. RETURN ONLY JSON.

            Analyze these Kerala lottery results and synthesize unique winning number predictions for ${targetDate}.
            
            Return the response in JSON format with keys: "predictedNumbers", "confidenceScore" (0-1), "analysisBasis".
      `;

      // 3. Call Gemini API on client
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
        },
      });

      const forecast = JSON.parse(response.text || '{}');
      
      // 4. Save to Firestore (Global context)
      await addDoc(collection(db, 'forecasts'), {
          date: targetDate,
          targetLottery: "Predictive",
          predictedSegments: String(forecast.predictedNumbers),
          confidenceScore: Number(forecast.confidenceScore),
          analysisBasis: forecast.analysisBasis,
          createdAt: serverTimestamp()
      });
      
    } catch (err) {
      console.error(err);
      alert("Forecast failure: " + (err as Error).message);
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
