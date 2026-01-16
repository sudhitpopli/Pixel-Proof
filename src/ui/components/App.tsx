import React, { useState } from "react";
import { Theme } from "@swc-react/theme";
import { Button } from "@swc-react/button";
import "./App.css";
import { detectImagesInScreenshot, ImageDetectionResult } from "../utils/imageDetection";

interface TextExtractionResult {
    success: boolean;
    textElements: string[];
    count: number;
    error?: string;
}

interface ExtractedTextResult {
    text: string;
    source: 'text-node' | 'ocr';
    nodeId: string;
    confidence?: number;
}

interface ExtractionSummary {
    success: boolean;
    totalElements: number;
    textNodes: number;
    ocrResults: number;
    results: ExtractedTextResult[];
    rawText: string;
    error?: string;
}

interface AppProps {
    addOnUISdk: any;
    sandboxProxy: any;
}

const App: React.FC<AppProps> = ({ addOnUISdk, sandboxProxy }) => {
    // UI State
    const [extractedText, setExtractedText] = useState<string[]>([]);
    const [ocrResults, setOcrResults] = useState<ExtractionSummary | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showRawText, setShowRawText] = useState(false);

    // Web Crawler state
    const [crawlUrl, setCrawlUrl] = useState<string>('');
    const [crawlResult, setCrawlResult] = useState<any>(null);
    const [isCrawling, setIsCrawling] = useState(false);
    const [crawlError, setCrawlError] = useState<string | null>(null);

    // ML / Analysis State
    const [mlResults, setMlResults] = useState<any>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [mlError, setMlError] = useState<string | null>(null);
    
    // Page-level OCR state
    const [pageOcrText, setPageOcrText] = useState<string | null>(null);
    const [isPageOcrProcessing, setIsPageOcrProcessing] = useState(false);

    // Image Detection state
    const [imageDetectionResult, setImageDetectionResult] = useState<ImageDetectionResult | null>(null);
    const [isDetectingImages, setIsDetectingImages] = useState(false);
    const [imageDetectionError, setImageDetectionError] = useState<string | null>(null);

    // =========================================================================
    // HELPER: Format Python Backend Response for UI
    // =========================================================================
    const formatBackendResponse = (text: string, analysisData: any) => {
        // Python returns: { text: "...", scores: { "Hate": 0.9, "Normal": 0.1 } }
        const scores = analysisData.scores || {};
        let maxLabel = "unknown";
        let maxScore = 0;

        for (const [label, score] of Object.entries(scores)) {
            if (typeof score === 'number' && score > maxScore) {
                maxScore = score;
                maxLabel = label;
            }
        }

        const isHateSpeech = maxLabel.toLowerCase().includes('hate') || maxLabel.toLowerCase().includes('offensive');

        return {
            success: true,
            results: [{
                text: text,
                result: {
                    label: maxLabel,
                    score: maxScore,
                    isHateSpeech: isHateSpeech,
                    confidence: maxScore * 100
                }
            }],
            summary: {
                hateSpeechCount: isHateSpeech ? 1 : 0,
                cleanCount: isHateSpeech ? 0 : 1,
                totalAnalyzed: 1,
                averageConfidence: maxScore * 100
            }
        };
    };

    // =========================================================================
    // 1. ADVANCE SPELL CHECK (OCR + DOCUMENT TEXT + HATE DETECTION)
    // =========================================================================
    const handleAdvanceSpellCheck = async () => {
        console.log("🚀 START: Advance Spell Check");
        setIsPageOcrProcessing(true);
        setError(null);
        setPageOcrText(null);
        setMlResults(null);
        setMlError(null);

        try {
            // STEP 1: CAPTURE IMAGE FOR OCR
            if (!addOnUISdk.app.document.createRenditions) throw new Error("SDK Error: createRenditions API is not available.");
            
            const renditionResults = await addOnUISdk.app.document.createRenditions({ range: "currentPage", format: "image/png" });
            if (!renditionResults || renditionResults.length === 0) throw new Error("SDK Error: No renditions returned.");
            const blob = renditionResults[0].blob;

            // STEP 2: SEND TO OCR (/analyze-image)
            const formData = new FormData();
            formData.append("image", blob, "page-rendition.png");
            
            const ocrResponse = await fetch("http://localhost:3000/analyze-image", { method: "POST", body: formData });
            if (!ocrResponse.ok) throw new Error(`OCR Failed: ${await ocrResponse.text()}`);
            
            const ocrData = await ocrResponse.json();
            const ocrText = ocrData.result;

            // STEP 3: FETCH DOCUMENT TEXT (Native Nodes)
            // We fetch this separately so we can combine it with the OCR text
            let docText = "";
            try {
                const extractionResult = await sandboxProxy.extractText();
                if (extractionResult.success) {
                    docText = extractionResult.textElements.join('\n');
                }
            } catch (e) {
                console.warn("Could not extract document text, continuing with only OCR text", e);
            }

            // STEP 4: COMBINE BOTH TEXTS
            // This ensures the user gets analyzed results for EVERYTHING on the page
            const combinedText = `--- [OCR RESULT] ---\n${ocrText}\n\n--- [DOCUMENT TEXT] ---\n${docText}`;
            setPageOcrText(combinedText);

            // STEP 5: SEND COMBINED TEXT TO HATE DETECTOR (/analyze-hate)
            const analysisResponse = await fetch("http://localhost:3000/analyze-hate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: combinedText })
            });

            if (!analysisResponse.ok) throw new Error(`Analysis Failed: ${await analysisResponse.text()}`);
            
            const analysisData = await analysisResponse.json();
            const formattedResult = formatBackendResponse(combinedText, analysisData);

            setMlResults(formattedResult);

        } catch (err: any) {
            console.error("❌ Error:", err);
            setError(err.message);
            setMlError(err.message);
        } finally {
            setIsPageOcrProcessing(false);
        }
    };

    // =========================================================================
    // 2. ANALYZE DOCUMENT TEXT NODES (NO OCR)
    // =========================================================================
    const handleAnalyzeDocument = async () => {
        setIsAnalyzing(true);
        setMlError(null);
        setMlResults(null);

        try {
            // 1. Get Text from Document (using existing sandbox logic)
            console.log('Extracting text from document nodes...');
            const extractionResult: TextExtractionResult = await sandboxProxy.extractText();
            
            if (!extractionResult.success) throw new Error(extractionResult.error || "Failed to extract text");
            
            const textToAnalyze = extractionResult.textElements.join(' \n ');
            if (!textToAnalyze.trim()) throw new Error("No text found in document to analyze.");

            // 2. Send to Local Backend
            console.log('Sending to local backend for analysis...');
            const response = await fetch("http://localhost:3000/analyze-hate", {
                 method: "POST",
                 headers: { "Content-Type": "application/json" },
                 body: JSON.stringify({ text: textToAnalyze })
            });

            if (!response.ok) throw new Error(await response.text());
            
            const data = await response.json();
            const formattedResult = formatBackendResponse(textToAnalyze, data);
            
            setMlResults(formattedResult);

        } catch (err: any) {
            console.error('Failed to analyze document:', err);
            setMlError(err.message || String(err));
        } finally {
            setIsAnalyzing(false);
        }
    };

    // =========================================================================
    // 3. ANALYZE CRAWLED CONTENT
    // =========================================================================
    const handleAnalyzeCrawledContent = async () => {
        if (!crawlResult) {
            setMlError('Please crawl a website first');
            return;
        }

        setIsAnalyzing(true);
        setMlError(null);
        setMlResults(null);

        try {
            const textToAnalyze = crawlResult.text.fullText;
            if (!textToAnalyze) throw new Error("No text content found in crawl result.");

            const response = await fetch("http://localhost:3000/analyze-hate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: textToAnalyze })
            });

            if (!response.ok) throw new Error(await response.text());

            const data = await response.json();
            const formattedResult = formatBackendResponse(textToAnalyze, data);

            setMlResults(formattedResult);
        } catch (err: any) {
            console.error('Failed to analyze crawled content:', err);
            setMlError(err.message || String(err));
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Keep existing utility functions
    const handleCrawlWebPage = async () => {
        if (!crawlUrl.trim()) { setCrawlError('Please enter a valid URL'); return; }
        setIsCrawling(true); setCrawlError(null); setCrawlResult(null);
        try {
            const result = await sandboxProxy.crawlWebPage(crawlUrl);
            if (result.error) setCrawlError(result.error);
            else setCrawlResult(result);
        } catch (err: any) { setCrawlError(err.message); } 
        finally { setIsCrawling(false); }
    };

    // =========================================================================
    // 4. DETECT IMAGES IN SCREENSHOT AND GET URLs
    // =========================================================================
    // =========================================================================
    // 4. DETECT IMAGES (Fixed: Uses SDK Rendition + Google Vision)
    // =========================================================================
    const handleDetectImagesInScreenshot = async () => {
        setIsDetectingImages(true);
        setImageDetectionError(null);
        setImageDetectionResult(null);

        try {
            console.log("🚀 Starting detection on ACTUAL document content...");
            
            // 1. Capture the actual Adobe Express Canvas (clean image, no UI)
            if (!addOnUISdk.app.document.createRenditions) {
                throw new Error("SDK Error: createRenditions API missing.");
            }

            // Export the current page as a PNG blob
            const renditionResults = await addOnUISdk.app.document.createRenditions({ 
                range: "currentPage", 
                format: "image/png" 
            });
            
            if (!renditionResults.length) throw new Error("No content found on page.");
            const blob = renditionResults[0].blob;

            // 2. Convert Blob to Base64
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            
            reader.onloadend = async () => {
                const base64data = reader.result?.toString().split(',')[1]; // Remove "data:image/png;base64," header

                if (!base64data) {
                    setImageDetectionError("Failed to process image data");
                    setIsDetectingImages(false);
                    return;
                }

                // 3. Send to Backend
                try {
                    console.log("📡 Sending high-res canvas to backend...");
                    
                    const response = await fetch('http://localhost:3000/detect-images-in-screenshot', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            screenshot_base64: base64data,
                            services: ['gemini', 'google_vision'] // Use Google Vision for URLs
                        })
                    });

                    if (!response.ok) {
                        const errText = await response.text();
                        throw new Error(`Backend Error: ${errText}`);
                    }

                    const result = await response.json();
                    console.log("✅ Analysis Complete:", result);
                    setImageDetectionResult(result);

                } catch (apiError: any) {
                    console.error("API call failed:", apiError);
                    setImageDetectionError(apiError.message);
                } finally {
                    setIsDetectingImages(false);
                }
            };

        } catch (err: any) {
            console.error("❌ Process Error:", err);
            setImageDetectionError(err.message || String(err));
            setIsDetectingImages(false);
        }
    };
    return (
        <Theme system="express" scale="medium" color="light">
            <div className="compliance-container">
                <header className="compliance-header">
                    <h1>ComplianceGuard Pro</h1>
                    <p>Powered by Local AI (HateBERT & Tesseract)</p>
                </header>

                <main className="compliance-content">
                    {/* SECTION 1: OCR & DOCUMENT SCAN */}
                    <div className="scanner-panel">
                        <h2>Extract & Analyze Document</h2>
                        <p>Scan the visible page image for text and hate speech.</p>

                        <div className="button-group">
                            <Button size="m" onClick={handleAdvanceSpellCheck} disabled={isPageOcrProcessing} variant="cta">
                                {isPageOcrProcessing ? "🔍 Scanning & Analyzing..." : "✨ Advance Spell Check (OCR + Doc)"}
                            </Button>
                        </div>

                        {error && (
                            <div className="error-message" style={{ marginTop: "20px", padding: "15px", backgroundColor: "#fee", color: "#c00", borderRadius: "6px" }}>
                                <strong>Error:</strong> {error}
                                {error.includes("Failed to fetch") && (
                                    <p style={{ fontSize: "12px", marginTop: "5px" }}>
                                        ⚠️ Cannot connect to server. Ensure Docker is running at <code>http://localhost:3000</code>
                                    </p>
                                )}
                            </div>
                        )}

                        {/* OCR Raw Text Preview - FIXED: Removed !mlResults so it persists */}
                        {pageOcrText && (
                            <div style={{ marginTop: "15px", padding: "10px", backgroundColor: "#f9f9f9", borderRadius: "4px" }}>
                                <strong>Extracted Text (Combined):</strong>
                                <p style={{ fontSize: "12px", whiteSpace: "pre-wrap" }}>{pageOcrText.substring(0, 300)}...</p>
                            </div>
                        )}
                    </div>

                    {/* SECTION 2: WEB CRAWLER */}
                    <div className="scanner-panel" style={{ marginTop: "40px", paddingTop: "20px", borderTop: "2px solid #e0e0e0" }}>
                        <h2>🌐 Web Crawler</h2>
                        <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
                            <input
                                type="url"
                                value={crawlUrl}
                                onChange={(e) => setCrawlUrl(e.target.value)}
                                placeholder="https://example.com"
                                style={{ flex: 1, padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
                            />
                            <Button size="m" onClick={handleCrawlWebPage} disabled={isCrawling}>
                                {isCrawling ? "Crawling..." : "Crawl"}
                            </Button>
                        </div>
                        {crawlResult && (
                            <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "#e8f5e9", color: "#2e7d32", borderRadius: "4px" }}>
                                ✅ Crawled: {crawlResult.title} ({crawlResult.text?.fullText?.length || 0} chars)
                            </div>
                        )}
                        {crawlError && <div style={{ color: "red", marginTop: "10px" }}>{crawlError}</div>}
                    </div>

                    {/* SECTION 3: HATE SPEECH DETECTION */}
                    <div className="scanner-panel" style={{ marginTop: "40px", paddingTop: "20px", borderTop: "2px solid #e0e0e0" }}>
                        <h2>🤖 Hate Speech Detection</h2>
                        <p>Analyze text using local HateBERT model.</p>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "15px" }}>
                            <Button 
                                size="m" 
                                onClick={handleAnalyzeDocument} 
                                disabled={isAnalyzing} 
                                variant="primary"
                            >
                                {isAnalyzing ? "Analyzing..." : "🔍 Analyze Document Text (No OCR)"}
                            </Button>

                            {crawlResult && (
                                <Button 
                                    size="m" 
                                    onClick={handleAnalyzeCrawledContent} 
                                    disabled={isAnalyzing}
                                >
                                    {isAnalyzing ? "Analyzing..." : "🌐 Analyze Crawled Content"}
                                </Button>
                            )}
                        </div>

                        {/* RESULTS DISPLAY */}
                        {mlError && <div style={{ marginTop: "15px", padding: "10px", backgroundColor: "#fee", color: "#c00" }}>Error: {mlError}</div>}

                        {mlResults && mlResults.success && (
                            <div style={{ marginTop: "25px", border: "1px solid #ddd", borderRadius: "6px", overflow: "hidden" }}>
                                <div style={{ 
                                    padding: "15px", 
                                    backgroundColor: mlResults.summary.hateSpeechCount > 0 ? "#ffebee" : "#e8f5e9",
                                    borderBottom: "1px solid #ddd"
                                }}>
                                    <strong style={{ fontSize: "16px", color: mlResults.summary.hateSpeechCount > 0 ? "#c62828" : "#2e7d32" }}>
                                        {mlResults.summary.hateSpeechCount > 0 ? "⚠️ Hate Speech Detected" : "✅ Content Seems Safe"}
                                    </strong>
                                </div>
                                <div style={{ padding: "15px", backgroundColor: "#f9f9f9" }}>
                                    {mlResults.results.map((item: any, idx: number) => (
                                        <div key={idx} style={{ marginBottom: "15px" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                                                <span style={{ fontWeight: "bold", textTransform: "capitalize" }}>
                                                    Label: {item.result.label}
                                                </span>
                                                <span>Conf: {item.result.confidence.toFixed(1)}%</span>
                                            </div>
                                            <div style={{ fontSize: "13px", color: "#555", padding: "10px", backgroundColor: "white", border: "1px solid #eee" }}>
                                                {/* Display snippet of analyzed text */}
                                                "{item.text.substring(0, 300)}{item.text.length > 300 ? "..." : ""}"
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SECTION 4: IMAGE DETECTION */}
                    <div className="scanner-panel" style={{ marginTop: "40px", paddingTop: "20px", borderTop: "2px solid #e0e0e0" }}>
                        <h2>🖼️ Image Detection & URL Finder</h2>
                        <p>Capture screenshot and detect images with their URLs using Gemini Vision & SerpAPI.</p>
                        
                        <div className="button-group" style={{ marginTop: "15px" }}>
                            <Button 
                                size="m" 
                                onClick={handleDetectImagesInScreenshot} 
                                disabled={isDetectingImages} 
                                variant="cta"
                            >
                                {isDetectingImages ? "🔍 Detecting Images..." : "📸 Detect Images in Screenshot"}
                            </Button>
                        </div>

                        {imageDetectionError && (
                            <div style={{ marginTop: "15px", padding: "10px", backgroundColor: "#fee", color: "#c00", borderRadius: "4px" }}>
                                <strong>Error:</strong> {imageDetectionError}
                            </div>
                        )}

                        {imageDetectionResult && imageDetectionResult.success && (
                            <div style={{ marginTop: "25px" }}>
                                {/* Summary */}
                                <div style={{ 
                                    padding: "15px", 
                                    backgroundColor: "#e3f2fd", 
                                    borderRadius: "6px",
                                    marginBottom: "20px"
                                }}>
                                    <strong style={{ fontSize: "16px", color: "#1976d2" }}>
                                        📊 Detection Summary
                                    </strong>
                                    <div style={{ marginTop: "10px", display: "flex", gap: "20px", fontSize: "14px" }}>
                                        <div>
                                            <strong>Images Detected:</strong> {imageDetectionResult.summary?.totalImagesDetected || 0}
                                        </div>
                                        <div>
                                            <strong>URLs Found:</strong> {imageDetectionResult.summary?.totalUrlsFound || 0}
                                        </div>
                                        {imageDetectionResult.summary?.urlsFromNodes !== undefined && (
                                            <>
                                                <div>
                                                    <strong>From Document Nodes:</strong> {imageDetectionResult.summary?.urlsFromNodes || 0}
                                                </div>
                                                <div>
                                                    <strong>From SerpAPI:</strong> {imageDetectionResult.summary?.urlsFromSerpAPI || 0}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Detected Images (from Gemini) */}
                                {imageDetectionResult.detectedImages && imageDetectionResult.detectedImages.length > 0 && (
                                    <div style={{ marginBottom: "25px" }}>
                                        <h3 style={{ fontSize: "18px", marginBottom: "15px", color: "#333" }}>
                                            🔍 Detected Images (Gemini Analysis)
                                        </h3>
                                        {imageDetectionResult.detectedImages.map((img, idx) => (
                                            <div 
                                                key={idx} 
                                                style={{ 
                                                    marginBottom: "15px", 
                                                    padding: "15px", 
                                                    backgroundColor: "#f9f9f9", 
                                                    border: "1px solid #ddd",
                                                    borderRadius: "4px"
                                                }}
                                            >
                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                                    <strong style={{ color: "#1976d2" }}>Image {idx + 1}</strong>
                                                    <span style={{ fontSize: "12px", color: "#666" }}>
                                                        Confidence: {(img.confidence * 100).toFixed(0)}%
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: "14px", marginBottom: "5px" }}>
                                                    <strong>Description:</strong> {img.description}
                                                </div>
                                                <div style={{ fontSize: "14px", marginBottom: "5px" }}>
                                                    <strong>Position:</strong> {img.position}
                                                </div>
                                                <div style={{ fontSize: "14px", marginBottom: "5px" }}>
                                                    <strong>Type:</strong> {img.type}
                                                </div>
                                                {img.branding && (
                                                    <div style={{ fontSize: "14px" }}>
                                                        <strong>Branding:</strong> {img.branding}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Image URLs (from Document Nodes or SerpAPI) */}
                                {imageDetectionResult.imageUrls && imageDetectionResult.imageUrls.length > 0 && (
                                    <div>
                                        <h3 style={{ fontSize: "18px", marginBottom: "15px", color: "#333" }}>
                                            🔗 Image URLs Found
                                        </h3>
                                        {imageDetectionResult.imageUrls.map((urlResult, idx) => {
                                            const isNodeUrl = urlResult.source === 'document_node';
                                            return (
                                                <div 
                                                    key={idx} 
                                                    style={{ 
                                                        marginBottom: "15px", 
                                                        padding: "15px", 
                                                        backgroundColor: isNodeUrl ? "#e8f5e9" : "#fff",
                                                        border: `1px solid ${isNodeUrl ? "#4caf50" : "#4caf50"}`,
                                                        borderRadius: "4px"
                                                    }}
                                                >
                                                    <div style={{ marginBottom: "8px" }}>
                                                        <strong style={{ 
                                                            color: isNodeUrl ? "#2e7d32" : "#2e7d32", 
                                                            fontSize: "14px" 
                                                        }}>
                                                            {isNodeUrl ? "✅" : "🔍"} URL {idx + 1} ({urlResult.source})
                                                            {isNodeUrl && " - From Document Node"}
                                                        </strong>
                                                    </div>
                                                    <div style={{ marginBottom: "5px" }}>
                                                        <a 
                                                            href={urlResult.url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            style={{ 
                                                                color: "#1976d2", 
                                                                textDecoration: "underline",
                                                                wordBreak: "break-all"
                                                            }}
                                                        >
                                                            {urlResult.url}
                                                        </a>
                                                    </div>
                                                    {urlResult.title && (
                                                        <div style={{ fontSize: "13px", color: "#666", marginTop: "5px" }}>
                                                            <strong>Title:</strong> {urlResult.title}
                                                        </div>
                                                    )}
                                                    {urlResult.nodeId && (
                                                        <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                                                            <strong>Node ID:</strong> {urlResult.nodeId}
                                                        </div>
                                                    )}
                                                    {urlResult.thumbnail && (
                                                        <div style={{ marginTop: "10px" }}>
                                                            <img 
                                                                src={urlResult.thumbnail} 
                                                                alt={urlResult.title || `Thumbnail ${idx + 1}`}
                                                                style={{ 
                                                                    maxWidth: "200px", 
                                                                    maxHeight: "150px",
                                                                    border: "1px solid #ddd",
                                                                    borderRadius: "4px"
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Debug Info - Show Gemini and SerpAPI responses for troubleshooting */}
                                {(imageDetectionResult.geminiAnalysis || imageDetectionResult.serpApiResults) && (
                                    <div style={{ marginTop: "25px" }}>
                                        <h3 style={{ fontSize: "18px", marginBottom: "15px", color: "#333" }}>
                                            🔧 Debug Information
                                        </h3>
                                        
                                        {imageDetectionResult.geminiAnalysis && (
                                            <div style={{ 
                                                marginBottom: "15px", 
                                                padding: "15px", 
                                                backgroundColor: "#f0f0f0", 
                                                borderRadius: "4px",
                                                fontSize: "12px"
                                            }}>
                                                <strong>Gemini Analysis:</strong>
                                                <pre style={{ 
                                                    marginTop: "10px", 
                                                    padding: "10px", 
                                                    backgroundColor: "#fff",
                                                    borderRadius: "4px",
                                                    overflow: "auto",
                                                    maxHeight: "300px",
                                                    whiteSpace: "pre-wrap",
                                                    wordBreak: "break-word"
                                                }}>
                                                    {JSON.stringify(imageDetectionResult.geminiAnalysis, null, 2)}
                                                </pre>
                                            </div>
                                        )}
                                        
                                        {imageDetectionResult.serpApiResults && (
                                            <div style={{ 
                                                marginBottom: "15px", 
                                                padding: "15px", 
                                                backgroundColor: "#f0f0f0", 
                                                borderRadius: "4px",
                                                fontSize: "12px"
                                            }}>
                                                <strong>SerpAPI Results:</strong>
                                                <pre style={{ 
                                                    marginTop: "10px", 
                                                    padding: "10px", 
                                                    backgroundColor: "#fff",
                                                    borderRadius: "4px",
                                                    overflow: "auto",
                                                    maxHeight: "300px",
                                                    whiteSpace: "pre-wrap",
                                                    wordBreak: "break-word"
                                                }}>
                                                    {JSON.stringify(imageDetectionResult.serpApiResults, null, 2)}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* No results message */}
                                {(!imageDetectionResult.detectedImages || imageDetectionResult.detectedImages.length === 0) &&
                                 (!imageDetectionResult.imageUrls || imageDetectionResult.imageUrls.length === 0) && (
                                    <div style={{ 
                                        padding: "20px", 
                                        backgroundColor: "#fff3cd", 
                                        borderRadius: "4px",
                                        marginTop: "20px"
                                    }}>
                                        <strong>ℹ️ No images detected or URLs found.</strong>
                                        <div style={{ marginTop: "10px", fontSize: "13px" }}>
                                            <p>Possible reasons:</p>
                                            <ul style={{ marginLeft: "20px", marginTop: "5px" }}>
                                                <li>The screenshot might not have captured the image properly</li>
                                                <li>Gemini might not recognize the image in the screenshot format</li>
                                                <li>SerpAPI might not find matching URLs for the image</li>
                                                <li>Check the Debug Information section below for more details</li>
                                            </ul>
                                            <p style={{ marginTop: "10px" }}>
                                                💡 <strong>Tip:</strong> Make sure the image is fully visible in the screenshot before capturing.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </Theme >
    );
};

export default App;