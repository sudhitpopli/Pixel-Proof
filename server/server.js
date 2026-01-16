import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import fs from "fs";
import { spawn } from "child_process";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import Tesseract from "tesseract.js";

// Setup for ES modules pathing
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const upload = multer({ dest: "uploads/" });

// Initialize Gemini AI Client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

app.use(cors());
app.use(express.json());

// ==========================================
// 🐍 PYTHON INTEGRATION SECTION
// ==========================================

// 1. Point this to exactly where you put app.py
// Based on your folder structure, it's likely one level up in 'model_service'
const PYTHON_SCRIPT_PATH = path.join(__dirname, "../model_service/hatebert-final/app.py");
const PYTHON_PORT = 5001; // The port defined in your app.py

let pythonProcess = null;

const startPythonService = () => {
    console.log("------------------------------------------------");
    console.log("🐍 Initializing Python Model Service...");
    console.log(`📂 Target Script: ${PYTHON_SCRIPT_PATH}`);

    if (!fs.existsSync(PYTHON_SCRIPT_PATH)) {
        console.error(`❌ CRITICAL ERROR: app.py not found at path: ${PYTHON_SCRIPT_PATH}`);
        console.error("👉 Please ensure app.py is in the correct folder relative to server.js");
        return;
    }

    // Spawn the python process
    pythonProcess = spawn("python", [PYTHON_SCRIPT_PATH], {
        stdio: 'inherit', // Pipes python print statements to your node console
        env: { ...process.env, PORT: PYTHON_PORT.toString() }
    });

    pythonProcess.on('error', (err) => {
        console.error('❌ Failed to launch Python process. Do you have Python installed?', err);
    });

    console.log("✅ Python Service Launching... (Wait for 'Model loaded successfully')");
};

// Start Python when Node starts
startPythonService();

// Cleanup: Kill Python when Node stops
process.on('SIGINT', () => {
    if (pythonProcess) {
        console.log("🛑 Stopping Python Service...");
        pythonProcess.kill();
    }
    process.exit();
});


// ==========================================
// 🔗 ROUTE: HATE SPEECH DETECTION
// ==========================================
app.post("/analyze-hate", async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: "No text provided" });

        console.log(`🤖 Analyze Request: "${text.substring(0, 20)}..."`);

        try {
            const pythonResponse = await axios.post(`http://127.0.0.1:${PYTHON_PORT}/predict`, { 
                text: text 
            });
            
            const modelData = pythonResponse.data;
            console.log("✅ Model Response Received");

            // --- 🛡️ HATE SPEECH CHECK ---
            // Checks if any segment in the Python response is flagged as hate
            const isHateSpeech = Array.isArray(modelData.segments) && 
                                 modelData.segments.some(segment => segment.is_hate === true);

            console.log(`🔍 Hate Speech Detected? ${isHateSpeech}`);

            if (isHateSpeech) {
                // Collect the specific phrases that were flagged
                const hateSegments = modelData.segments.filter(s => s.is_hate);
                const badPhrases = hateSegments.map(s => s.text).join(" | ");

                console.log(`⚠️ Hate Content Found: "${badPhrases}". Asking Gemini 2.5 Flash to sanitize...`);
                console.log(badPhrases);
                const prompt = `
                    I have a text document. 
                    Context: "${text}"
                    The following specific segments were identified as offensive or hate speech: "${badPhrases}".
                    Please suggest EXACTLY ONE professional, and contextually appropriate replacement for these specific segments that preserves the original intent but removes the offensiveness.
                    Output only the replacement phrase(s).
                `;

                try {
                    const result = await geminiModel.generateContent(prompt);
                    const response = await result.response;
                    const suggestion = response.text().trim();
                    
                    console.log("💡 [GEMINI SUGGESTION]:", suggestion);
                    modelData.suggestion = suggestion; 

                } catch (geminiError) {
                    console.error("❌ Gemini API Error:", geminiError.message);
                    // Don't crash the request if Gemini fails, just return the detection
                }
            }

            res.json(modelData);

        } catch (pyError) {
            console.error("❌ Python Service Error:", pyError.message);
            if (pyError.code === 'ECONNREFUSED') {
                return res.status(503).json({
                    error: "Model is still loading",
                    details: "The AI model is large and takes a moment to load. Please try again in 10 seconds."
                });
            }
            res.status(500).json({ error: "Model processing failed", details: pyError.message });
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 📷 ROUTE: OCR (TESSERACT)
// ==========================================
app.post("/analyze-image", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No image file uploaded" });

        console.log(`Processing OCR for file: ${req.file.path}`);
        const { data: { text } } = await Tesseract.recognize(req.file.path, 'eng');
        
        fs.unlinkSync(req.file.path);
        res.json({ result: text });

    } catch (error) {
        console.error("OCR Error:", error.message);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Main Server running on http://localhost:${PORT}`);
});