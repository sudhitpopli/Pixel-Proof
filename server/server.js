import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

// ==========================================
// 🧠 GEMINI SETUP (2026 STANDARD)
// ==========================================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

app.use(cors());
app.use(express.json());

// ==========================================
// 🐍 PYTHON INTEGRATION SECTION
// ==========================================
const PYTHON_SCRIPT_PATH = path.join(__dirname, "../model_service/hatebert-final/app.py");
const PYTHON_PORT = 5001; 

let pythonProcess = null;

const startPythonService = () => {
    console.log("------------------------------------------------");
    console.log("🐍 Initializing Python Model Service...");
    if (!fs.existsSync(PYTHON_SCRIPT_PATH)) {
        console.error(`❌ CRITICAL ERROR: app.py not found at path: ${PYTHON_SCRIPT_PATH}`);
        return;
    }
    pythonProcess = spawn("python", [PYTHON_SCRIPT_PATH], {
        stdio: 'inherit',
        env: { ...process.env, PORT: PYTHON_PORT.toString() }
    });
    console.log("✅ Python Service Launching...");
};

startPythonService();

process.on('SIGINT', () => {
    if (pythonProcess) pythonProcess.kill();
    process.exit();
});

// ==========================================
// 🔗 ROUTE: HATE SPEECH & COMPLIANCE
// ==========================================
app.post("/analyze-hate", async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: "No text provided" });

        console.log(`🤖 Analyze Request: "${text.substring(0, 20)}..."`);

        try {
            // 1. First Pass: Python Model (HateBERT)
            const pythonResponse = await axios.post(`http://127.0.0.1:${PYTHON_PORT}/predict`, { 
                text: text 
            });
            
            const modelData = pythonResponse.data;
            console.log("✅ Model Response Received");

            // --- 🛡️ COMPLIANCE TRIGGER ---
            // We verify if the model flagged anything
            const isHateSpeech = Array.isArray(modelData.segments) && 
                                 modelData.segments.some(segment => segment.is_hate === true);

            console.log(`🔍 Content Flagged? ${isHateSpeech}`);

            if (isHateSpeech) {
                const hateSegments = modelData.segments.filter(s => s.is_hate);
                const badPhrases = hateSegments.map(s => s.text).join(" | ");

                console.log(`⚠️ Compliance Issue: "${badPhrases}". Asking Gemini 2.5 Flash to sanitize...`);

                // --- 📝 ADVANCED COMPLIANCE PROMPT ---
                // Updated to catch implicit complaints, bias, and cultural nuances
                const prompt = `
                    I have a text document that contains problematic language.
                    Context: "${text}"
                    Problematic Segments: "${badPhrases}"
                    
                    Task: Rewrite the problematic segments to be professional, constructive, and culturally safe.
                    
                    Strict Compliance Guidelines:
                    1. **Unsubstantiated Claims**: Remove any implicit complaints that lack evidence. Convert them into objective observations or constructive questions.
                    2. **Gender Bias**: Eliminate any gendered stereotypes or bias. Use inclusive, neutral language.
                    3. **Cultural Sensitivity**: Check for and correct cultural misconceptions or taboos (e.g., references that might be offensive in specific cultures, like number symbolism or stereotypes).
                    4. **De-escalation**: Remove personal attacks and hate speech entirely.
                    
                    Output ONLY the replacement text.
                `;

                try {
                    const result = await geminiModel.generateContent(prompt);
                    const response = await result.response;
                    const suggestion = response.text().trim();
                    
                    console.log("💡 [GEMINI SUGGESTION]:", suggestion);
                    modelData.suggestion = suggestion; 

                } catch (geminiError) {
                    console.error("❌ Gemini API Error:", geminiError.message);
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