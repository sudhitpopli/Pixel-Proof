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

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// ==========================================
// DEBUG: CHECK KEY ON STARTUP
// ==========================================
console.log("------------------------------------------------");
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ CRITICAL ERROR: GEMINI_API_KEY is missing from .env file");
    process.exit(1);
}
// Print first 4 chars to verify it is not empty or "undefined"
console.log(`✅ Loaded API Key: ${process.env.GEMINI_API_KEY.substring(0, 4)}...`);
console.log("------------------------------------------------");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

// ==========================================
// CONFIGURATION
// ==========================================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// USE THE EXACT MODEL NAME FROM YOUR SCREENSHOT
const MODEL_NAME = "gemini-2.5-flash";

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// ==========================================
// START PYTHON MODEL SERVICE
// ==========================================
const PYTHON_SCRIPT_PATH = path.join(__dirname, "../model_service/hatebert-final/app.py");
let pythonProcess = null;

const startPythonService = () => {
    console.log("Starting Python Model Service...");
    // Attempt to verify file exists
    if (!fs.existsSync(PYTHON_SCRIPT_PATH)) {
        console.error(`❌ Python script not found at: ${PYTHON_SCRIPT_PATH}`);
        return;
    }

    pythonProcess = spawn("python", [PYTHON_SCRIPT_PATH], {
        stdio: 'inherit',
        env: { ...process.env, PORT: "5001" }
    });

    pythonProcess.on('error', (err) => {
        console.error('❌ Failed to start Python process:', err);
    });

    pythonProcess.on('exit', (code, signal) => {
        if (code !== 0 && code !== null) {
            console.error(`python process exited with code ${code}`);
        }
    });
};

startPythonService();

// Cleanup on exit
process.on('SIGINT', () => {
    if (pythonProcess) {
        console.log("Stopping Python Service...");
        pythonProcess.kill();
    }
    process.exit();
});

// ==========================================
// ROUTE 1: BIAS DETECTOR
// ==========================================
app.post("/analyze-bias", async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: "No text provided" });

        // Initialize the specific model
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            safetySettings
        });

        const prompt = `
    You are a strictly neutral Content Safety Classifier.
    Analyze the user input for these specific categories.
    
    INPUT TEXT: "${text}"

    CATEGORIES:
    1. Gender Bias: Stereotypes, misogyny, misandry, or gendered role assumptions.
    2. Cultural Insensitivity: Racial slurs, stereotypes, or cultural appropriation.
    3. Implied False Claims: Statements that imply a verified fact which is actually disputed or false.

    Return JSON ONLY in this format:
    {
        "safe": boolean,
        "scores": {
            "gender_bias": integer (0-100),
            "cultural_insensitivity": integer (0-100),
            "implicit_false_claim": integer (0-100)
        },
        "reasoning": "One sentence explanation.",
        "offending_quote": "The exact snippet from the text"
    }`;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        });

        const response = await result.response;
        res.json(JSON.parse(response.text()));

    } catch (error) {
        console.error(`Error with model ${MODEL_NAME}:`, error.message);

        // Detailed error logging to help you debug
        if (error.message.includes("404")) {
            res.status(404).json({ error: `Model '${MODEL_NAME}' not found. Check your API access.`, details: error.message });
        } else if (error.message.includes("400") || error.message.includes("API key")) {
            res.status(401).json({ error: "API Key Invalid. Check .env file.", details: error.message });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// ==========================================
// ROUTE 2: OCR / VISION
// ==========================================
app.post("/analyze-image", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No image file uploaded" });

        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            safetySettings
        });

        const imagePart = {
            inlineData: {
                data: Buffer.from(fs.readFileSync(req.file.path)).toString("base64"),
                mimeType: req.file.mimetype,
            },
        };

        const prompt = "Extract all text. Return JSON if it's a form, raw string otherwise.";

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        fs.unlinkSync(req.file.path);
        res.json({ result: text });

    } catch (error) {
        console.error("OCR Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// ROUTE 3: HATE SPEECH DETECTION (LOCAL MODEL)
// ==========================================
app.post("/analyze-hate", async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: "No text provided" });

        // Forward to Python Flask Service
        try {
            const pythonResponse = await axios.post("http://127.0.0.1:5001/predict", { text });
            res.json(pythonResponse.data);
        } catch (pyError) {
            console.error("Error communicating with Python service:", pyError.message);
            if (pyError.code === 'ECONNREFUSED') {
                return res.status(503).json({
                    error: "Model service is unavailable. It might be loading or failed to start.",
                    details: "Check server logs for Python process status."
                });
            }
            res.status(500).json({ error: "Model service error", details: pyError.message });
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 AI Server running on http://localhost:${PORT}`);
    console.log(`Using Model: ${MODEL_NAME}`);
});