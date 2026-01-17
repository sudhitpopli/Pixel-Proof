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

        // Forward the text to the local Python Flask API
        try {
            const pythonResponse = await axios.post(`http://127.0.0.1:${PYTHON_PORT}/predict`, { 
                text: text 
            });
            
            // Your app.py returns { text: "...", scores: { label: score } }
            // We pass this directly back to the frontend
            console.log("✅ Model Response Received");
            res.json(pythonResponse.data);

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

// ==========================================
// 📋 ROUTE: GET DISCLAIMER TYPES
// ==========================================
app.get("/disclaimer-types", async (req, res) => {
    try {
        const disclaimerTypes = [
            "General",
            "Medical",
            "Legal",
            "Financial",
            "Custom"
        ];
        res.json({ types: disclaimerTypes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 📋 ROUTE: GET DISCLAIMER TEMPLATE
// ==========================================
app.get("/disclaimer-template", async (req, res) => {
    try {
        const { type, language } = req.query;
        
        const disclaimerTemplates = {
            "General": {
                "English": "The information provided is for general informational purposes only. All information is provided in good faith, however we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability or completeness of any information.",
                "Spanish": "La información proporcionada es solo para fines informativos generales. Toda la información se proporciona de buena fe, sin embargo, no hacemos ninguna representación o garantía de ningún tipo, expresa o implícita, con respecto a la precisión, adecuación, validez, confiabilidad, disponibilidad o integridad de cualquier información.",
                "French": "Les informations fournies sont uniquement à titre informatif. Toutes les informations sont fournies de bonne foi, cependant nous ne faisons aucune déclaration ou garantie d'aucune sorte, expresse ou implicite, concernant l'exactitude, l'adéquation, la validité, la fiabilité, la disponibilité ou l'exhaustivité de toute information.",
                "German": "Die bereitgestellten Informationen dienen nur allgemeinen Informationszwecken. Alle Informationen werden nach bestem Wissen und Gewissen bereitgestellt, jedoch geben wir keine Zusicherungen oder Garantien jeglicher Art, weder ausdrücklich noch stillschweigend, bezüglich der Genauigkeit, Angemessenheit, Gültigkeit, Zuverlässigkeit, Verfügbarkeit oder Vollständigkeit der Informationen."
            },
            "Medical": {
                "English": "The information provided is not intended to replace professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition. Never disregard professional medical advice or delay in seeking it because of something you have read here.",
                "Spanish": "La información proporcionada no pretende reemplazar el consejo médico profesional, el diagnóstico o el tratamiento. Siempre busque el consejo de su médico u otro proveedor de salud calificado con cualquier pregunta que pueda tener sobre una condición médica. Nunca ignore el consejo médico profesional ni se demore en buscarlo debido a algo que haya leído aquí.",
                "French": "Les informations fournies ne sont pas destinées à remplacer les conseils, le diagnostic ou le traitement médicaux professionnels. Consultez toujours votre médecin ou un autre professionnel de la santé qualifié pour toute question que vous pourriez avoir concernant un problème de santé. Ne négligez jamais les conseils médicaux professionnels et ne retardez pas leur recherche à cause de quelque chose que vous avez lu ici.",
                "German": "Die bereitgestellten Informationen sollen keine professionelle medizinische Beratung, Diagnose oder Behandlung ersetzen. Wenden Sie sich immer an Ihren Arzt oder einen anderen qualifizierten Gesundheitsdienstleister, wenn Sie Fragen zu einem medizinischen Problem haben. Ignorieren Sie niemals professionelle medizinische Ratschläge oder verzögern Sie deren Suche aufgrund von etwas, das Sie hier gelesen haben."
            },
            "Legal": {
                "English": "The information contained herein is provided for informational purposes only and should not be construed as legal advice on any subject matter. You should not act or refrain from acting on the basis of any content included in this site without seeking legal or other professional advice. The contents of this site contain general information and may not reflect current legal developments or address your situation.",
                "Spanish": "La información contenida en este documento se proporciona únicamente con fines informativos y no debe interpretarse como asesoramiento legal sobre ningún tema. No debe actuar ni abstenerse de actuar sobre la base de ningún contenido incluido en este sitio sin buscar asesoramiento legal u otro asesoramiento profesional. El contenido de este sitio contiene información general y puede no reflejar desarrollos legales actuales o abordar su situación.",
                "French": "Les informations contenues dans ce document sont fournies à titre informatif uniquement et ne doivent pas être interprétées comme des conseils juridiques sur un sujet quelconque. Vous ne devez pas agir ou vous abstenir d'agir sur la base d'un contenu inclus dans ce site sans consulter un conseil juridique ou autre conseil professionnel. Le contenu de ce site contient des informations générales et peut ne pas refléter les évolutions juridiques actuelles ou répondre à votre situation.",
                "German": "Die hierin enthaltenen Informationen werden nur zu Informationszwecken bereitgestellt und sollten nicht als Rechtsberatung zu einem bestimmten Thema ausgelegt werden. Sie sollten nicht handeln oder sich von Handlungen auf der Grundlage von Inhalten auf dieser Website abhalten, ohne rechtlichen oder anderen professionellen Rat einzuholen. Der Inhalt dieser Website enthält allgemeine Informationen und spiegelt möglicherweise keine aktuellen rechtlichen Entwicklungen wider oder behandelt Ihre Situation."
            },
            "Financial": {
                "English": "The information provided is for general informational purposes only and does not constitute financial, investment, or trading advice. Past performance is not indicative of future results. All investments involve risk, including the possible loss of principal. You should consult with a qualified financial advisor or other professional before making any investment decisions.",
                "Spanish": "La información proporcionada es solo para fines informativos generales y no constituye asesoramiento financiero, de inversión o comercial. El rendimiento pasado no es indicativo de resultados futuros. Todas las inversiones implican riesgo, incluyendo la posible pérdida del capital. Debe consultar con un asesor financiero calificado u otro profesional antes de tomar cualquier decisión de inversión.",
                "French": "Les informations fournies sont uniquement à des fins d'information générale et ne constituent pas des conseils financiers, d'investissement ou de trading. Les performances passées ne sont pas indicatives des résultats futurs. Tous les investissements comportent des risques, y compris la perte possible du capital. Vous devriez consulter un conseiller financier qualifié ou un autre professionnel avant de prendre toute décision d'investissement.",
                "German": "Die bereitgestellten Informationen dienen nur allgemeinen Informationszwecken und stellen keine Finanz-, Anlage- oder Handelsberatung dar. Die Wertentwicklung in der Vergangenheit ist kein Indikator für zukünftige Ergebnisse. Alle Investitionen beinhalten Risiken, einschließlich des möglichen Verlusts des Kapitals. Sie sollten einen qualifizierten Finanzberater oder einen anderen Fachmann konsultieren, bevor Sie Anlageentscheidungen treffen."
            }
        };

        if (!type || !language) {
            return res.status(400).json({ error: "Type and language parameters are required" });
        }

        // Handle Custom type - return empty string so user can enter their own text
        if (type === "Custom") {
            return res.json({ text: "" });
        }

        if (!disclaimerTemplates[type] || !disclaimerTemplates[type][language]) {
            return res.status(404).json({ error: "Disclaimer template not found for the specified type and language" });
        }

        res.json({ text: disclaimerTemplates[type][language] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Main Server running on http://localhost:${PORT}`);
});