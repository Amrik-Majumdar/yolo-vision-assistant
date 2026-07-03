import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import explainRoute from "./routes/explain.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS - allow everything
app.use(cors());

// Parse JSON
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve models with proper headers
app.use("/models", (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
}, express.static(path.join(__dirname, "../models")));

// Serve frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// API routes
app.use("/api/explain", explainRoute);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.get("/check-model", (req, res) => {
  const modelPath = path.join(__dirname, "../models/yolov8n.onnx");
  
  if (fs.existsSync(modelPath)) {
    const stats = fs.statSync(modelPath);
    res.json({
      exists: true,
      path: modelPath,
      size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`
    });
  } else {
    res.json({
      exists: false,
      path: modelPath
    });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server: http://localhost:5000`);
  console.log(`Models: ${path.join(__dirname, "../models")}`);
});