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
import FormData from "form-data";

// Setup for ES modules pathing
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
// 🔍 ROUTE: DETECT IMAGES IN SCREENSHOT AND GET URLs
// ==========================================
// ==========================================
// 🔍 ROUTE: DETECT IMAGES & FIND URLs
// ==========================================
app.post("/detect-images-in-screenshot", async (req, res) => {
    const debugLogs = [];
    const log = (msg, data) => console.log(`[IMG_DETECT] ${msg}`, data ? JSON.stringify(data).substring(0, 100) : "");

    try {
        const { screenshot_base64, services = [] } = req.body;
        if (!screenshot_base64) return res.status(400).json({ error: "No image data provided" });

        log("Processing image...", { length: screenshot_base64.length });

        // 1. Save Temp File
        const imageBuffer = Buffer.from(screenshot_base64, 'base64');
        const imagePath = path.join(__dirname, "uploads", `search_${Date.now()}.png`);
        
        if (!fs.existsSync(path.join(__dirname, "uploads"))) fs.mkdirSync(path.join(__dirname, "uploads"));
        fs.writeFileSync(imagePath, imageBuffer);

        const results = {
            detectedImages: [], // From Gemini
            imageUrls: [],      // From Google Vision
            summary: { totalImagesDetected: 0, totalUrlsFound: 0 }
        };

        // ---------------------------------------------------------
        // A. GOOGLE CLOUD VISION (Web Detection) - BEST FOR URLs
        // ---------------------------------------------------------
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            log("Starting Google Cloud Vision Web Detection...");
            try {
                const client = new ImageAnnotatorClient();
                // We send the file path directly
                const [result] = await client.webDetection(imagePath);
                const webDetection = result.webDetection;

                if (webDetection) {
                    // 1. Exact Matches
                    if (webDetection.fullMatchingImages) {
                        webDetection.fullMatchingImages.forEach(img => {
                            results.imageUrls.push({
                                url: img.url,
                                source: "visual_match",
                                title: "Exact Visual Match"
                            });
                        });
                    }
                    // 2. Partial Matches
                    if (webDetection.partialMatchingImages) {
                        webDetection.partialMatchingImages.forEach(img => {
                            results.imageUrls.push({
                                url: img.url,
                                source: "related_image",
                                title: "Partial Match"
                            });
                        });
                    }
                    // 3. Pages containing the image
                    if (webDetection.pagesWithMatchingImages) {
                        webDetection.pagesWithMatchingImages.forEach(page => {
                            results.imageUrls.push({
                                url: page.url,
                                source: "page_match",
                                title: page.pageTitle || "Page containing image"
                            });
                        });
                    }
                    log(`✅ Found ${results.imageUrls.length} URLs via Google Vision`);
                }
            } catch (err) {
                log("❌ Google Vision Failed:", err.message);
                debugLogs.push(`Google Vision Error: ${err.message}`);
            }
        } else {
            log("⚠️ Skipping Google Vision: No Credentials (GOOGLE_APPLICATION_CREDENTIALS) set.");
        }

        // ---------------------------------------------------------
        // B. GEMINI VISION (Description & Analysis)
        // ---------------------------------------------------------
        if (process.env.GEMINI_API_KEY) {
            log("Starting Gemini Analysis...");
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Use 1.5 Flash for speed/vision

                const prompt = `
                Analyze this image. It is a design from Adobe Express.
                Identify the MAIN subject matter or primary photo content.
                Return a JSON array of objects with these keys: "description", "type" (photo/illustration), "branding" (if any).
                Example: [{"description": "A golden retriever dog running in grass", "type": "photo", "branding": "none"}]
                RETURN JSON ONLY.
                `;

                const result = await model.generateContent([
                    prompt,
                    { inlineData: { data: screenshot_base64, mimeType: "image/png" } }
                ]);
                
                const text = result.response.text();
                const jsonMatch = text.match(/\[.*\]/s); // Extract JSON array
                if (jsonMatch) {
                    results.detectedImages = JSON.parse(jsonMatch[0]);
                } else {
                    // Fallback if no array found
                    results.detectedImages = [{ description: text, type: "analysis" }];
                }
                log("✅ Gemini Analysis Complete");

            } catch (err) {
                log("❌ Gemini Failed:", err.message);
            }
        }

        // Cleanup
        fs.unlinkSync(imagePath);

        // Summarize
        results.summary.totalImagesDetected = results.detectedImages.length;
        results.summary.totalUrlsFound = results.imageUrls.length;

        res.json({ success: true, results, debugLogs });

    } catch (error) {
        console.error("Critical Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post("/detect-images-in-screenshot", async (req, res) => {
    const debugLogs = [];
    const log = (msg, data = null) => {
        const timestamp = new Date().toISOString();
        const entry = { timestamp, msg, data };
        console.log(`[IMAGE_DETECT_DEBUG] ${msg}`, data ? JSON.stringify(data).substring(0, 300) + "..." : "");
        debugLogs.push(entry);
    };

    try {
        log("REQUEST_RECEIVED", { contentType: req.headers['content-type'] });

        const { screenshot_base64, services = ['gemini', 'serpapi'] } = req.body;

        if (!screenshot_base64) {
            log("ERROR_NO_SCREENSHOT", {});
            return res.status(400).json({ 
                error: "Missing screenshot_base64 in request",
                debugLogs 
            });
        }

        log("SCREENSHOT_RECEIVED", { 
            base64Length: screenshot_base64.length,
            services: Array.isArray(services) ? services : [services]
        });

        // Decode base64 to buffer for processing
        const imageBuffer = Buffer.from(screenshot_base64, 'base64');
        const imagePath = path.join(__dirname, "uploads", `screenshot_${Date.now()}.png`);
        
        // Ensure uploads directory exists
        if (!fs.existsSync(path.join(__dirname, "uploads"))) {
            fs.mkdirSync(path.join(__dirname, "uploads"), { recursive: true });
        }

        // Save screenshot temporarily
        fs.writeFileSync(imagePath, imageBuffer);
        log("SCREENSHOT_SAVED", { path: imagePath, size: imageBuffer.length });

        const results = {
            detectedImages: [],
            imageUrls: [],
            summary: {
                totalImagesDetected: 0,
                totalUrlsFound: 0
            }
        };

        // ====================================================================
        // STEP 1: GEMINI VISION - Detect images in screenshot
        // ====================================================================
        if (services.includes('gemini') && process.env.GEMINI_API_KEY) {
            log("STEP_1_START", { step: "Gemini Image Detection" });
            
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                // Use gemini-2.5-flash (available and supports vision/images)
                const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
                log("GEMINI_MODEL_SELECTED", { model: "gemini-2.5-flash" });

                // Convert base64 to image part for Gemini
                const imagePart = {
                    inlineData: {
                        data: screenshot_base64,
                        mimeType: "image/png"
                    }
                };

            const prompt = `
You are analyzing a screenshot of an Adobe Express document that may contain user-imported content images.

STRICT FILTERING RULES - CRITICAL:
1. IGNORE ALL UI ELEMENTS: buttons, icons (magnifying glass, landscape, gear, etc.), controls, navigation bars, toolbars, checkboxes, dropdowns, sidebars, panels, cards containing UI controls
2. IGNORE ALL TEXT LABELS: text next to buttons ("Analyze Document Text", "Detect Images", etc.) - these are UI labels, NOT content
3. IGNORE ALL DECORATIVE ELEMENTS: small graphics, icons used for UI decoration, interface chrome
4. IGNORE ANYTHING IN UI CARDS OR PANELS: if it appears in a white card with buttons or is part of the add-on interface, it's UI, NOT content

ONLY DETECT IF ALL OF THESE ARE TRUE:
- The image is in the MAIN DOCUMENT AREA (the actual Adobe Express canvas/artboard where users place content)
- The image is SUBSTANTIAL (larger than 100x100 pixels typically)
- The image type is: photo, illustration, graphic, artwork, logo (for actual brands in content), screenshot of content
- The image is NOT: an icon, a button graphic, a UI control element, decorative element

FILTERING INSTRUCTIONS:
- If description mentions "icon", "button", "magnifying glass", "landscape icon", or appears next to button text → EXCLUDE
- If position mentions "card", "panel", "button", "control" → EXCLUDE  
- If type is "icon" → EXCLUDE
- If size is "small" and appears in a UI area → EXCLUDE

Return your analysis as a JSON array with this EXACT structure:
[
    {
        "description": "Description of the actual content image (NOT UI)",
        "position": "Position in document canvas (e.g., 'center of artboard', 'top-left of document')",
        "type": "photo|graphic|illustration|artwork|logo - MUST NOT be 'icon'",
        "confidence": 0.8,
        "branding": "Any brands/logos in the content",
        "size": "medium|large - small images are likely UI"
    }
]

Return ONLY valid JSON array - no markdown code blocks, no explanations, just the JSON array.
If you ONLY see UI elements (buttons, icons, controls), return an empty array: []
                `;

                log("GEMINI_SENDING_REQUEST", { promptLength: prompt.length });
            const result = await model.generateContent([prompt, imagePart]);
            const response = await result.response;
            const text = response.text();

                log("GEMINI_RESPONSE_RECEIVED", { 
                    responseLength: text.length,
                    firstChars: text.substring(0, 300)
                });

                // Parse JSON response
                try {
                    // Clean up the response - remove markdown code blocks if present
                    let jsonStr = text.trim();
                    
                    // Remove markdown code blocks
                    jsonStr = jsonStr.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
                    
                    // Sometimes Gemini wraps the JSON in explanations - try to extract just the array
                    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
                    if (arrayMatch) {
                        jsonStr = arrayMatch[0];
                    }
                    
                    log("GEMINI_CLEANED_JSON", { 
                        cleanedLength: jsonStr.length, 
                        preview: jsonStr.substring(0, 500) 
                    });
                    
                    const detectedImages = JSON.parse(jsonStr);
                    
                    if (Array.isArray(detectedImages)) {
                        // FILTER OUT UI ELEMENTS: Remove icons and UI-related detections
                        const filteredImages = detectedImages.filter(img => {
                            const desc = (img.description || "").toLowerCase();
                            const position = (img.position || "").toLowerCase();
                            const type = (img.type || "").toLowerCase();
                            const size = (img.size || "").toLowerCase();
                            
                            // Exclude icons
                            if (type === "icon" || desc.includes("icon")) {
                                log("FILTERED_OUT_ICON", { type, desc: desc.substring(0, 50) });
                                return false;
                            }
                            
                            // Exclude UI-related descriptions
                            if (desc.includes("magnifying glass") || 
                                desc.includes("button") || 
                                (desc.includes("stylized") && (desc.includes("icon") || desc.includes("handle"))) ||
                                desc.includes("landscape icon")) {
                                log("FILTERED_OUT_UI_ELEMENT", { desc: desc.substring(0, 50) });
                                return false;
                            }
                            
                            // Exclude things in UI cards/panels
                            if (position.includes("card") || position.includes("panel") || position.includes("button") ||
                                position.includes("content area") && (position.includes("white card") || position.includes("first white") || position.includes("second white"))) {
                                log("FILTERED_OUT_UI_POSITION", { position });
                                return false;
                            }
                            
                            // Exclude small images that are likely UI
                            if (size === "small" && (position.includes("left") || position.includes("top"))) {
                                log("FILTERED_OUT_SMALL_UI", { size, position });
                                return false;
                            }
                            
                            return true;
                        });
                        
                        results.detectedImages = filteredImages.map(img => ({
                            description: img.description || "",
                            position: img.position || "",
                            type: img.type || "",
                            confidence: typeof img.confidence === 'number' ? img.confidence : 0.8,
                            branding: img.branding || "",
                            size: img.size || ""
                        }));
                        
                        results.geminiAnalysis = { 
                            success: true, 
                            images: detectedImages,
                            filteredImages: results.detectedImages,
                            filteredCount: detectedImages.length - results.detectedImages.length,
                            rawResponse: text.substring(0, 1000) // Keep raw response for debugging
                        };
                        log("GEMINI_PARSED_AND_FILTERED", { 
                            originalCount: detectedImages.length,
                            filteredCount: results.detectedImages.length,
                            removed: detectedImages.length - results.detectedImages.length
                        });
                    } else {
                        log("GEMINI_INVALID_FORMAT", { 
                            response: text.substring(0, 500),
                            parsedType: typeof detectedImages
                        });
                        results.geminiAnalysis = { 
                            success: false, 
                            error: "Invalid response format - expected array", 
                            rawResponse: text
                        };
                    }
                } catch (parseError) {
                    log("GEMINI_PARSE_ERROR", { 
                        error: String(parseError),
                        errorMessage: parseError.message,
                        rawResponse: text.substring(0, 1000)
                    });
                    results.geminiAnalysis = { 
                        success: false, 
                        error: String(parseError), 
                        rawResponse: text,
                        parseError: parseError.message
                    };
                }

            } catch (geminiError) {
                log("GEMINI_ERROR", { 
                    error: geminiError.message,
                    stack: geminiError.stack?.substring(0, 200)
                });
                results.geminiAnalysis = { 
                    success: false, 
                    error: geminiError.message 
                };
            }
        } else {
            log("GEMINI_SKIPPED", { 
                reason: services.includes('gemini') ? "No API key" : "Service not requested"
            });
        }

        // ====================================================================
        // STEP 2: SERPAPI REVERSE IMAGE SEARCH - Find URLs for images
        // ====================================================================
        if (services.includes('serpapi') && process.env.SERPAPI_KEY) {
            log("STEP_2_START", { step: "SerpAPI Reverse Image Search" });
            
            try {
                if (!process.env.SERPAPI_KEY) {
                    throw new Error("SERPAPI_KEY environment variable is not set");
                }

                log("SERPAPI_PREPARING_REQUEST", {});
                
                // SerpAPI requires uploading the image first, then using the returned URL
                // Step 1: Upload image to SerpAPI
                const uploadFormData = new FormData();
                uploadFormData.append("image", fs.createReadStream(imagePath));
                
                log("SERPAPI_UPLOADING_IMAGE", {});
                let uploadResponse;
                let imageUrl;
                
                try {
                    uploadResponse = await axios.post(
                        `https://serpapi.com/upload?api_key=${encodeURIComponent(process.env.SERPAPI_KEY)}`,
                        uploadFormData,
                        {
                            headers: {
                                ...uploadFormData.getHeaders()
                            },
                            timeout: 30000,
                            validateStatus: (status) => status < 500 // Don't throw on 4xx
                        }
                    );
                    
                    log("SERPAPI_UPLOAD_RESPONSE", { 
                        status: uploadResponse.status,
                        statusText: uploadResponse.statusText,
                        hasData: !!uploadResponse.data,
                        dataPreview: uploadResponse.data ? JSON.stringify(uploadResponse.data).substring(0, 300) : "no data"
                    });
                    
                    if (uploadResponse.status !== 200) {
                        log("SERPAPI_UPLOAD_FAILED", { 
                            status: uploadResponse.status,
                            data: uploadResponse.data
                        });
                        throw new Error(`SerpAPI upload failed with status ${uploadResponse.status}: ${JSON.stringify(uploadResponse.data)}`);
                    }
                    
                    imageUrl = uploadResponse.data?.image_url || uploadResponse.data?.url;
                    
                    if (!imageUrl) {
                        log("SERPAPI_NO_IMAGE_URL", { 
                            response: JSON.stringify(uploadResponse.data).substring(0, 500),
                            keys: uploadResponse.data ? Object.keys(uploadResponse.data) : []
                        });
                        throw new Error("Failed to get image URL from SerpAPI upload response");
                    }
                    
                    log("SERPAPI_IMAGE_URL_RECEIVED", { imageUrl: imageUrl.substring(0, 100) });
                } catch (uploadError) {
                    log("SERPAPI_UPLOAD_ERROR", { 
                        error: uploadError.message,
                        code: uploadError.code,
                        response: uploadError.response ? {
                            status: uploadError.response.status,
                            data: uploadError.response.data
                        } : null
                    });
                    throw new Error(`SerpAPI upload error: ${uploadError.message}`);
                }
                
                log("SERPAPI_IMAGE_URL_RECEIVED", { imageUrl });

                // Step 2: Use the uploaded image URL for reverse image search
                // SerpAPI reverse image search uses GET request with query parameters
                const serpUrl = `https://serpapi.com/search?api_key=${encodeURIComponent(process.env.SERPAPI_KEY)}&engine=google_lens&image_url=${encodeURIComponent(imageUrl)}`;
                
                log("SERPAPI_SENDING_SEARCH_REQUEST", { 
                    url: serpUrl.substring(0, 150) + "...", // Truncate for logging
                    imageUrl: imageUrl.substring(0, 100) + "...",
                    method: "GET"
                });
                
                // SerpAPI reverse image search uses GET request
                const serpResponse = await axios.get(serpUrl, {
                    timeout: 30000
                });

                log("SERPAPI_RESPONSE_RECEIVED", { 
                    status: serpResponse.status,
                    hasData: !!serpResponse.data
                });

                // Extract image URLs from SerpAPI response
                const imageUrls = [];
                
                // SerpAPI returns visual matches and inline images
                if (serpResponse.data.visual_matches) {
                    serpResponse.data.visual_matches.forEach((match, index) => {
                        if (match.link) {
                            imageUrls.push({
                                url: match.link,
                                source: "visual_match",
                                title: match.title || `Visual Match ${index + 1}`,
                                thumbnail: match.thumbnail,
                                serpapiIndex: index
                            });
                            log("SERPAPI_URL_FOUND", { 
                                index,
                                url: match.link,
                                source: "visual_match"
                            });
                        }
                    });
                }

                if (serpResponse.data.inline_images) {
                    serpResponse.data.inline_images.forEach((img, index) => {
                        if (img.link) {
                            imageUrls.push({
                                url: img.link,
                                source: "inline_image",
                                title: img.title || `Inline Image ${index + 1}`,
                                thumbnail: img.thumbnail,
                                serpapiIndex: index
                            });
                            log("SERPAPI_URL_FOUND", { 
                                index,
                                url: img.link,
                                source: "inline_image"
                            });
                        }
                    });
                }

                // Also check for related images
                if (serpResponse.data.related_images) {
                    serpResponse.data.related_images.forEach((img, index) => {
                        if (img.link) {
                            imageUrls.push({
                                url: img.link,
                                source: "related_image",
                                title: img.title || `Related Image ${index + 1}`,
                                thumbnail: img.thumbnail,
                                serpapiIndex: index
                            });
                            log("SERPAPI_URL_FOUND", { 
                                index,
                                url: img.link,
                                source: "related_image"
                            });
                        }
                    });
                }

                // Remove duplicates
                const uniqueUrls = Array.from(
                    new Map(imageUrls.map(item => [item.url, item])).values()
                );

                results.imageUrls = uniqueUrls;
                results.serpApiResults = {
                    success: true,
                    totalUrls: uniqueUrls.length,
                    urls: uniqueUrls,
                    rawResponse: {
                        hasVisualMatches: !!serpResponse.data.visual_matches,
                        hasInlineImages: !!serpResponse.data.inline_images,
                        hasRelatedImages: !!serpResponse.data.related_images
                    }
                };

                log("SERPAPI_SUCCESS", { 
                    totalUrls: uniqueUrls.length,
                    uniqueUrls: uniqueUrls.length
                });

            } catch (serpError) {
                log("SERPAPI_ERROR", { 
                    error: serpError.message,
                    code: serpError.code,
                    status: serpError.response?.status,
                    statusText: serpError.response?.statusText,
                    responseData: serpError.response?.data ? JSON.stringify(serpError.response.data).substring(0, 1000) : undefined,
                    responseHeaders: serpError.response?.headers
                });
                results.serpApiResults = { 
                    success: false, 
                    error: serpError.message,
                    code: serpError.code,
                    status: serpError.response?.status,
                    responseData: serpError.response?.data
                };
            }
        } else {
            log("SERPAPI_SKIPPED", { 
                reason: services.includes('serpapi') ? "No API key" : "Service not requested"
            });
        }

        // Cleanup temporary file
        try {
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
                log("TEMP_FILE_CLEANED", { path: imagePath });
            }
        } catch (cleanupError) {
            log("CLEANUP_ERROR", { error: String(cleanupError) });
        }

        // Compile summary
        results.summary.totalImagesDetected = results.detectedImages?.length || 0;
        results.summary.totalUrlsFound = results.imageUrls?.length || 0;

        log("REQUEST_COMPLETE", {
            imagesDetected: results.summary.totalImagesDetected,
            urlsFound: results.summary.totalUrlsFound
        });

        res.json({
            success: true,
            results,
            debugLogs
        });

    } catch (error) {
        log("FATAL_ERROR", { 
            error: error.message,
            stack: error.stack?.substring(0, 500)
        });
        
        // Cleanup on error
        if (req.body?.screenshot_base64) {
            const imagePath = path.join(__dirname, "uploads", `screenshot_${Date.now()}.png`);
            try {
                if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
            } catch {}
        }

        res.status(500).json({ 
            error: error.message,
            debugLogs 
        });
    }
});

// ==========================================
// 🔍 DEBUG: API KEY STATUS ON STARTUP
// ==========================================
console.log("------------------------------------------------");
console.log("🔑 API KEY STATUS:");
console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? "✅ Loaded" : "❌ Missing"}`);
console.log(`   SERPAPI_KEY: ${process.env.SERPAPI_KEY ? "✅ Loaded" : "❌ Missing"}`);
console.log("------------------------------------------------");

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Main Server running on http://localhost:${PORT}`);
    console.log(`📸 Image Detection API: POST /detect-images-in-screenshot`);
});