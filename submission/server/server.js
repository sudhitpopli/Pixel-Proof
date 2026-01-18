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
import FormData from "form-data";

// Setup for ES modules pathing
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('✅ Created uploads directory');
}

const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

// ==========================================
// 🧠 GEMINI SETUP
// ==========================================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ==========================================
// 🐍 PYTHON INTEGRATION SECTION
// ==========================================
const PYTHON_SCRIPT_PATH = path.join(__dirname, "../model_service/hatebert_final/app.py");
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
// ⚖️ HATE SPEECH & COMPLIANCE DETECTION
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

            const isHateSpeech = Array.isArray(modelData.segments) &&
                modelData.segments.some(segment => segment.is_hate === true);

            if (isHateSpeech) {
                const hateSegments = modelData.segments.filter(s => s.is_hate);
                const badPhrases = hateSegments.map(s => s.text).join(" | ");

                console.log(`⚠️ Compliance Issue found. Asking Gemini to sanitize...`);

                const prompt = `
                    I have a text document containing problematic language.
                    Context: "${text}"
                    Problematic Segments: "${badPhrases}"
                    
                    Task: Rewrite the problematic segments to be professional, constructive, and culturally safe.
                    Strict Compliance Guidelines:
                    1. Unsubstantiated Claims: Convert implicit complaints into objective observations.
                    2. Gender Bias: Use inclusive, neutral language.
                    3. Cultural Sensitivity: Correct cultural misconceptions or taboos.
                    4. De-escalation: Remove personal attacks.
                    
                    Output ONLY the replacement text.
                `;

                try {
                    const result = await geminiModel.generateContent(prompt);
                    const response = await result.response;
                    modelData.suggestion = response.text().trim();
                } catch (geminiError) {
                    console.error("❌ Gemini API Error:", geminiError.message);
                }
            }

            res.json(modelData);

        } catch (pyError) {
            console.error("❌ Python Service Error:", pyError.message);
            if (pyError.code === 'ECONNREFUSED') {
                return res.status(503).json({ error: "Model is still loading", details: "Please try again in 10 seconds." });
            }
            res.status(500).json({ error: "Model processing failed", details: pyError.message });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 📷 OCR (TESSERACT)
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

// ==========================================
// ✂️ CROP IMAGES
// ==========================================
app.post("/crop-images", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No image file uploaded" });
        const image_positions = req.body.image_positions || '[]';

        const form = new FormData();
        const fileStream = fs.createReadStream(req.file.path);
        form.append('image', fileStream, req.file.filename);
        form.append('image_positions', image_positions);

        try {
            const pythonResponse = await axios.post(`http://127.0.0.1:${PYTHON_PORT}/crop-images`, form, {
                headers: form.getHeaders()
            });
            fs.unlinkSync(req.file.path);
            res.json(pythonResponse.data);
        } catch (pyError) {
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            res.status(500).json({ error: "Crop processing failed", details: pyError.message });
        }
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 🎨 BRAND COMPLIANCE CHECK
// ==========================================
app.post("/analyze-brand-compliance", upload.fields([{ name: 'guidelines', maxCount: 1 }, { name: 'image', maxCount: 1 }]), async (req, res) => {
    console.log("🚀 Starting Brand Compliance Analysis...");

    try {
        const files = req.files;

        // 1. Validation
        if (!files || !files.guidelines || !files.image) {
            return res.status(400).json({ error: "Both 'guidelines' (PDF) and 'image' (Screenshot) are required." });
        }

        const pdfPath = files.guidelines[0].path;
        const imagePath = files.image[0].path;

        console.log("📋 File Details:");
        console.log("  PDF:", {
            original: files.guidelines[0].originalname,
            mime: files.guidelines[0].mimetype,
            size: files.guidelines[0].size,
            path: pdfPath
        });
        console.log("  Image:", {
            original: files.image[0].originalname,
            mime: files.image[0].mimetype,
            size: files.image[0].size,
            path: imagePath
        });

        // 2. Extract Text from PDF using Gemini
        let guidelinesText = "";
        try {
            console.log("📖 Reading PDF Guidelines with Gemini...");

            if (!fs.existsSync(pdfPath)) {
                throw new Error(`PDF file not found at path: ${pdfPath}`);
            }

            const pdfBuffer = fs.readFileSync(pdfPath);
            const pdfBase64 = pdfBuffer.toString("base64");

            console.log(`  PDF loaded: ${pdfBuffer.length} bytes`);

            const pdfPart = {
                inlineData: {
                    data: pdfBase64,
                    mimeType: "application/pdf"
                }
            };

            const extractPrompt = "Extract all text content from this PDF document. Return only the text, no commentary.";

            console.log("  Asking Gemini to extract PDF text...");
            const extractResult = await geminiModel.generateContent([extractPrompt, pdfPart]);
            const extractResponse = await extractResult.response;
            guidelinesText = extractResponse.text();

            console.log(`✅ PDF Extracted via Gemini: ${guidelinesText.length} chars.`);

            if (!guidelinesText || guidelinesText.trim().length === 0) {
                console.warn("⚠️ No text extracted from PDF.");
            }

        } catch (pdfError) {
            console.error("❌ PDF Extract Error Details:");
            console.error("  Message:", pdfError.message);
            console.error("  Stack:", pdfError.stack);

            // Cleanup files before throwing
            try { fs.unlinkSync(pdfPath); } catch (e) { }
            try { fs.unlinkSync(imagePath); } catch (e) { }

            return res.status(500).json({
                error: "Failed to read PDF",
                details: pdfError.message,
                hint: "Ensure the PDF is not password-protected or corrupted"
            });
        }

        // 3. Prepare Image for Gemini
        const imageBuffer = fs.readFileSync(imagePath);
        const imageBase64 = imageBuffer.toString("base64");
        const imagePart = {
            inlineData: {
                data: imageBase64,
                mimeType: files.image[0].mimetype || "image/png"
            }
        };

        // 4. Construct Prompt
        const prompt = `
            You are a Brand Compliance Officer.
            I have attached an image of a design and the text from the Brand Guidelines below.

            *** BRAND GUIDELINES ***
            ${guidelinesText.substring(0, 15000)}
            ************************

            TASK: Analyze the image against these guidelines.
            Check: Logo usage, Color palette, Typography, and Tone.

            OUTPUT:
            Provide a report with:
            - **Compliance Status**: (PASS / WARNING / FAIL)
            - **Key Issues**: Bullet points.
            - **Recommendations**: Actionable advice.
        `;

        console.log("🤖 Sending to Gemini...");
        const result = await geminiModel.generateContent([prompt, imagePart]);
        const response = await result.response;
        const analysis = response.text();

        console.log("✅ Analysis Complete");

        // Cleanup
        fs.unlinkSync(pdfPath);
        fs.unlinkSync(imagePath);

        res.json({ success: true, analysis: analysis });

    } catch (error) {
        console.error("❌ Brand Check Failed:", error.message);
        console.error("Stack:", error.stack);

        // Cleanup on error
        if (req.files) {
            if (req.files.guidelines) {
                try { fs.unlinkSync(req.files.guidelines[0].path) } catch (e) { }
            }
            if (req.files.image) {
                try { fs.unlinkSync(req.files.image[0].path) } catch (e) { }
            }
        }
        res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Main Server running on http://localhost:${PORT}`);
});