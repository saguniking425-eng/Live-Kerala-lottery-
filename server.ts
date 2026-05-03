import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { initializeApp } from 'firebase/app';

let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'MY_GEMINI_API_KEY') {
      throw new Error("GEMINI_API_KEY not configured. Please check the Secrets panel in the AI Studio UI.");
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { exec } from 'child_process';
import { z } from 'zod';
import firebaseConfigJSON from './firebase-applet-config.json' with { type: 'json' };

const firebaseApp = initializeApp(firebaseConfigJSON);
const db = getFirestore(firebaseApp, firebaseConfigJSON.firestoreDatabaseId);

// 24/7 Background Worker for Auto Save & Sync Logic
function runBackgroundSync() {
  console.log("Initiating 24/7 background sync & rectify...");
  const today = new Date().toISOString().split('T')[0];
  
  exec(`python3 scrape_kerala_lottery.py --start ${today} --end ${today}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Background worker error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Background worker stderr: ${stderr}`);
    }
    console.log(`Background worker stdout: ${stdout}`);
  });
}

// Run immediately and then every day (24 * 60 * 60 * 1000 ms)
runBackgroundSync();
setInterval(runBackgroundSync, 24 * 60 * 60 * 1000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Input validation schemas
  const forecastSchema = z.object({
    date: z.string().min(1, "Date is required"),
    targetLottery: z.string().min(1, "Target lottery is required"),
    predictedSegments: z.string().min(1, "Predicted segments are required"),
    confidenceScore: z.number().min(0).max(100),
    analysisBasis: z.string().min(1, "Analysis basis is required")
  });

  const lotteryResultSchema = z.object({
    date: z.string().min(1, "Date is required"),
    lotteryName: z.string().min(1, "Lottery name is required"),
    drawNo: z.string().min(1, "Draw number is required"),
    tier: z.string().min(1, "Tier is required"),
    amount: z.number().min(0, "Amount must be zero or positive"),
    series: z.string().nullable().optional(),
    number: z.string().min(1, "Number is required"),
    last4: z.string().min(1, "Last 4 digits are required")
  });

  // API Route to save a forecast
  app.post("/api/save-forecast", async (req, res) => {
    try {
      const forecast = forecastSchema.parse(req.body);
      
      const docRef = await addDoc(collection(db, 'forecasts'), {
        ...forecast,
        createdAt: serverTimestamp()
      });
      
      console.log("Forecast saved to Firestore with ID: ", docRef.id);
      res.json({ status: "success", id: docRef.id });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error for forecast:", (error as any).errors);
        return res.status(400).json({ status: "error", message: "Invalid payload", details: (error as any).errors });
      }
      console.error("Error saving forecast:", error);
      res.status(500).json({ status: "error", message: "Failed to save" });
    }
  });

  // API Route to run a forecast
  app.post("/api/run-forecast", async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Load data
      const csvPath = path.join(process.cwd(), 'kerala_lottery_results.csv');
      const csvData = await fs.promises.readFile(csvPath, 'utf8');
      const lines = csvData.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      // Randomly sample data to reduce repetition
      const allData = lines.slice(1).filter(line => line.trim()).map(line => {
          const values = line.split(',');
          let obj: {[key: string]: string} = {};
          headers.forEach((h, i) => obj[h] = values[i]?.trim());
          return obj;
      });
      // Shuffle and take a sample
      const sampledData = allData.sort(() => 0.5 - Math.random()).slice(0, 15);

      // Prepare Prompt
      const recentDataStr = JSON.stringify(sampledData, null, 2);
      const prompt = `
            Analyze the following historical Kerala lottery results and predict winning numbers for ${today}.
            
            ${recentDataStr}
            
            Provide a prediction of winning numbers, a confidence score (0-1 as a number), and a concise basis for the prediction (as a string).
            
            Be creative and do not repeat the same numbers if you have predicted already for recent dates.
            
            Return the response in JSON format with keys: "predictedNumbers", "confidenceScore", "analysisBasis".
      `;

      // Call Gemini API
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const forecast = JSON.parse(response.text!);
      
      // Save to Firestore
      const payload = {
          date: today,
          targetLottery: "Predictive",
          predictedSegments: String(forecast.predictedNumbers),
          confidenceScore: Number(forecast.confidenceScore),
          analysisBasis: forecast.analysisBasis
      };

      const docRef = await addDoc(collection(db, 'forecasts'), {
        ...payload,
        createdAt: serverTimestamp()
      });

      res.json({ status: "success", id: docRef.id, forecast });
    } catch (error) {
      console.error("Error during forecast execution:", error);
      res.status(500).json({ status: "error", message: "Forecast Error: " + (error as any).message });
    }
  });

  const reportSchema = z.object({
    date: z.string().min(1, "Date is required"),
    lotteryName: z.string().min(1, "Lottery name is required"),
    report: z.string().min(1, "Report text is required")
  });

  // API Route to save an AI report
  app.post("/api/save-report", async (req, res) => {
    try {
      const reportData = reportSchema.parse(req.body);
      const docRef = await addDoc(collection(db, 'reports'), {
        ...reportData,
        createdAt: serverTimestamp()
      });
      console.log("Report saved to Firestore with ID: ", docRef.id);
      res.json({ status: "success", id: docRef.id });
    } catch (error) {
      if (error instanceof z.ZodError) {
         console.error("Validation error for report:", (error as any).errors);
         return res.status(400).json({ status: "error", message: "Invalid payload", details: (error as any).errors });
      }
      console.error("Error saving report to Firestore:", error);
      res.status(500).json({ status: "error", message: "Failed to save" });
    }
  });

  // API Route to save a lottery result
  app.post("/api/save-lottery-result", async (req, res) => {
    try {
      const result = lotteryResultSchema.parse(req.body);
      
      const docRef = await addDoc(collection(db, 'lottery_draws'), {
        ...result,
        createdAt: serverTimestamp()
      });
      
      console.log("Lottery result saved to Firestore with ID: ", docRef.id);
      res.json({ status: "success", id: docRef.id });
    } catch (error) {
      if (error instanceof z.ZodError) {
         console.error("Validation error for lottery result:", (error as any).errors);
         return res.status(400).json({ status: "error", message: "Invalid payload", details: (error as any).errors });
      }
      console.error("Error saving to Firestore:", error);
      res.status(500).json({ status: "error", message: "Failed to save" });
    }
  });

  // API Route for Syncing
  app.get("/api/sync-lottery", async (req, res) => {
    try {
        console.log("On-demand sync triggered.");
        const today = new Date().toISOString().split('T')[0];
      exec(`python3 scrape_kerala_lottery.py --start ${today} --end ${today}`, (error, stdout, stderr) => {
        if (error) {
          console.error(`Scrape error: ${error.message}`);
          return res.status(500).json({ status: "error", message: "Scrape Error", details: stderr });
        }
        res.json({
          status: "success",
          output: stdout
        });
      });
    } catch (error) {
      res.status(500).json({ status: "error", message: "Sync Node Unreachable" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
