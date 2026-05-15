import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { initializeApp } from 'firebase/app';
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
  
  exec(`npx tsx mock_scraper.ts --start ${today} --end ${today}`, { env: { ...process.env } }, async (error, stdout, stderr) => {
    try {
      if (error) {
        console.error(`Background worker error: ${error.message}`);
        await addDoc(collection(db, 'sync_logs'), {
          date: today,
          status: 'error',
          message: `Worker error: ${error.message}`,
          createdAt: serverTimestamp()
        });
      } else {
        const successMessage = stdout.includes("Successfully scraped") ? "Daily results synchronized." : "Sync completed (Check logs for results).";
        await addDoc(collection(db, 'sync_logs'), {
          date: today,
          status: stdout.includes("Successfully scraped") ? 'success' : 'error',
          message: successMessage,
          createdAt: serverTimestamp()
        });
        
        console.log(`Background worker stdout: ${stdout}`);
      }
      
      // Run daily AI auto-debugging after sync
      exec(`npx tsx auto_debug.ts`, { env: { ...process.env } }, (dbgError, dbgStdout, dbgStderr) => {
        if (dbgError) {
          console.error(`Auto Debugger error: ${dbgError.message}`);
        } else {
          console.log(`Auto Debugger output: ${dbgStdout}`);
        }
      });
      
    } catch (e) {
      console.error("Failed to log sync activity:", e);
    }
  });
}

// Fisher-Yates Shuffle
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
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

  // API Route to provide training data for forecasting (Moving AI to client-side)
  app.get("/api/training-data", async (req, res) => {
    try {
      const csvPath = path.join(process.cwd(), 'kerala_lottery_results.csv');
      const csvData = await fs.promises.readFile(csvPath, 'utf8');
      const lines = csvData.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const allData = lines.slice(1).filter(line => line.trim()).map(line => {
          const values = line.split(',');
          let obj: {[key: string]: string} = {};
          headers.forEach((h, i) => obj[h] = values[i]?.trim());
          return obj;
      });
      const shuffledData = shuffleArray(allData);
      const sampledData = shuffledData.slice(0, 30);
      res.json({ status: "success", data: sampledData });
    } catch (error) {
      console.error("Error reading training data:", error);
      res.status(500).json({ status: "error", message: "Failed to read data" });
    }
  });

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
      exec(`npx tsx mock_scraper.ts --start ${today} --end ${today}`, { env: { ...process.env } }, (error, stdout, stderr) => {
        if (error) {
          console.error(`Scrape error: ${error.message}`);
          return res.status(500).json({ status: "error", message: "Scrape Error", details: stderr });
        }
        res.json({
          status: "success",
          message: "Scrape successful",
          draw: {
            date: today,
            drawNo: stdout.match(/Draw No: (\S+)/)?.[1] || "DAILY-SYNC"
          },
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
