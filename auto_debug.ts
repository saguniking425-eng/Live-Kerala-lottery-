import fs from 'fs';
import path from 'path';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { GoogleGenAI } from '@google/genai';
import firebaseConfigJSON from './firebase-applet-config.json' with { type: 'json' };

const firebaseApp = initializeApp(firebaseConfigJSON);
const db = getFirestore(firebaseApp, firebaseConfigJSON.firestoreDatabaseId);

async function runAutoDebugger() {
  console.log("Starting daily AI auto-debugging...");
  
  try {
    const errorLogPath = path.join(process.cwd(), 'errors.csv');
    if (!fs.existsSync(errorLogPath)) {
      console.log("No error log found to debug.");
      return;
    }
    
    const errors = await fs.promises.readFile(errorLogPath, 'utf8');
    const lines = errors.split('\n').filter(line => line.trim());
    if (lines.length <= 1) {
      console.log("No recent errors to debug.");
      return;
    }

    // Only take the last 20 errors to avoid huge payloads
    const recentErrors = lines.slice(-20).join('\n');
    
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'MY_GEMINI_API_KEY') {
      console.warn("GEMINI_API_KEY invalid. AI Auto Debugging disabled.");
      return;
    }
    
    const ai = new GoogleGenAI({ apiKey: key });
    
    const prompt = `
      You are an automated code and system debugger.
      Below are the most recent error logs from our Kerala Lottery Scraper & Prediction system:
      
      ${recentErrors}
      
      Analyze these errors and provide:
      1. The root causes of the most critical issues.
      2. Specific, actionable bugfix instructions or configurations needed.
      
      Return a concise debug report.
    `;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    
    const report = response.text;
    
    const docRef = await addDoc(collection(db, 'debug_reports'), {
      date: new Date().toISOString().split('T')[0],
      analysis: report,
      createdAt: serverTimestamp()
    });
    
    console.log("AI Debugging successful! Report ID:", docRef.id);
  } catch (err) {
    console.error("AI Auto-Debugging failed:", err);
  }
}

runAutoDebugger();
