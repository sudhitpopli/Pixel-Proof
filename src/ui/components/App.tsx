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
            
            // STEP 1: Extract URLs directly from document node metadata FIRST (most reliable)
            console.log("📋 Step 1: Extracting image URLs from document node metadata...");
            let nodeImageUrls: any[] = [];
            let nodeMetadataDetails: any[] = [];
            try {
                const allImageUrls = await sandboxProxy.getAllImageSourceUrls();
                console.log(`📦 Found ${allImageUrls.length} image node(s) in document`);
                
                // Log all metadata for debugging
                allImageUrls.forEach((info, idx) => {
                    console.log(`\n📸 Image Node ${idx + 1}:`);
                    console.log(`   Node ID: ${info.nodeId}`);
                    console.log(`   Type: ${info.type}`);
                    console.log(`   Has Source URL: ${!!info.sourceUrl}`);
                    console.log(`   Node Metadata Keys:`, Object.keys(info.metadata.nodeAddOnData));
                    console.log(`   Media Metadata Keys:`, Object.keys(info.metadata.mediaAddOnData));
                    console.log(`   All Node Metadata:`, info.metadata.nodeAddOnData);
                    console.log(`   All Media Metadata:`, info.metadata.mediaAddOnData);
                });
                
                nodeImageUrls = allImageUrls.filter(info => info.sourceUrl);
                nodeMetadataDetails = allImageUrls; // Keep all for debugging
                console.log(`✅ Found ${nodeImageUrls.length} image URL(s) in document node metadata:`, nodeImageUrls);
            } catch (nodeError) {
                console.warn("⚠️ Could not extract URLs from document nodes:", nodeError);
                // Continue with screenshot detection
            }
            
            // STEP 2: Capture the actual Adobe Express Canvas (clean image, no UI)
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

            // Convert Blob to Base64
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            
            reader.onloadend = async () => {
                const base64data = reader.result?.toString().split(',')[1]; // Remove "data:image/png;base64," header

                if (!base64data) {
                    setImageDetectionError("Failed to process image data");
                    setIsDetectingImages(false);
                    return;
                }

                // STEP 3: Send to Backend for Gemini/SerpAPI analysis
                try {
                    console.log("📡 Step 2: Sending canvas to backend for analysis...");
                    
                    const response = await fetch('http://localhost:3000/detect-images-in-screenshot', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            screenshot_base64: base64data,
                            services: ['gemini', 'serpapi']
                        })
                    });

                    if (!response.ok) {
                        const errText = await response.text();
                        throw new Error(`Backend Error: ${errText}`);
                    }

                    const result = await response.json();
                    
                    // STEP 4: Combine results - prioritize node URLs over SerpAPI
                    const combinedImageUrls = [
                        // URLs from document nodes (most reliable - from metadata)
                        ...nodeImageUrls.map((nodeInfo, idx) => ({
                            url: nodeInfo.sourceUrl!,
                            source: "document_node" as const,
                            title: `Image from Document Metadata ${idx + 1}`,
                            nodeId: nodeInfo.nodeId,
                            metadata: nodeInfo.metadata
                        })),
                        // URLs from SerpAPI (if no node URLs found)
                        ...(result.results?.imageUrls || [])
                    ];

                    // Update result with combined URLs and node metadata
                    const enhancedResult = {
                        ...result,
                        results: {
                            ...result.results,
                            imageUrls: combinedImageUrls
                        },
                        nodeImageUrls: nodeImageUrls,
                        nodeMetadataDetails: nodeMetadataDetails,
                        summary: {
                            ...result.results?.summary,
                            totalUrlsFound: combinedImageUrls.length,
                            urlsFromNodes: nodeImageUrls.length,
                            urlsFromSerpAPI: (result.results?.imageUrls || []).length
                        }
                    };
                    
                    console.log("✅ Analysis Complete:", enhancedResult);
                    setImageDetectionResult(enhancedResult);

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

                    {/* SECTION 4: SCREENSHOT & CROP */}
                    <div className="scanner-panel" style={{ marginTop: "40px", paddingTop: "20px", borderTop: "2px solid #e0e0e0" }}>
                        <h2>📸 Screenshot & Crop Images</h2>
                        <p>Capture screenshot using rendition API and crop images based on metadata (position, width, height).</p>
                        
                        <div className="button-group" style={{ marginTop: "15px" }}>
                            <Button 
                                size="m" 
                                variant="cta"
                                onClick={async () => {
                                    try {
                                        console.log("📸 ========================================");
                                        console.log("📸 Starting SCREENSHOT & CROP process...");
                                        console.log("📸 ========================================");
                                        
                                        // Step 1: Get metadata from sandbox
                                        console.log("📋 Step 1: Extracting image metadata from document...");
                                        let metadataResult;
                                        try {
                                            metadataResult = await sandboxProxy.capturePageScreenshotWithMetadata();
                                            console.log("✅ Metadata extracted:", metadataResult);
                                        } catch (metaError: any) {
                                            console.error("❌ Metadata extraction error:", metaError);
                                            alert(`Failed to extract metadata: ${metaError.message || 'Unknown error'}\n\nCheck console for details.`);
                                            return;
                                        }
                                        
                                        if (!metadataResult || !metadataResult.success) {
                                            const errorMsg = metadataResult?.error || 'Unknown error';
                                            console.error("❌ Metadata extraction failed:", errorMsg);
                                            alert(`Failed to extract metadata: ${errorMsg}`);
                                            return;
                                        }
                                        
                                        const imageCount = metadataResult.imageMetadata ? metadataResult.imageMetadata.length : 0;
                                        console.log(`📋 Found ${imageCount} image(s) in document`);
                                        
                                        // Step 2: Capture screenshot using rendition API
                                        console.log("📸 Step 2: Capturing screenshot using rendition API...");
                                        if (!addOnUISdk || !addOnUISdk.app || !addOnUISdk.app.document) {
                                            console.error("❌ SDK Error: addOnUISdk not available");
                                            alert("SDK Error: Adobe Express SDK not available. Make sure you're running in Adobe Express.");
                                            return;
                                        }
                                        
                                        if (!addOnUISdk.app.document.createRenditions) {
                                            console.error("❌ SDK Error: createRenditions API missing");
                                            alert("SDK Error: createRenditions API missing. Check manifest.json permissions.");
                                            return;
                                        }
                                        
                                        console.log("📸 Calling createRenditions...");
                                        let renditionResults;
                                        try {
                                            renditionResults = await addOnUISdk.app.document.createRenditions({ 
                                                range: "currentPage", 
                                                format: "image/png" 
                                            });
                                            console.log("✅ Rendition API called, results:", renditionResults);
                                        } catch (rendError: any) {
                                            console.error("❌ Rendition API error:", rendError);
                                            alert(`Failed to capture screenshot: ${rendError.message || 'Unknown error'}\n\nCheck console for details.`);
                                            return;
                                        }
                                        
                                        if (!renditionResults || !renditionResults.length) {
                                            console.error("❌ No rendition results returned");
                                            alert("No content found on page. Make sure there's content visible on the page.");
                                            return;
                                        }
                                        
                                        console.log("✅ Screenshot captured, blob size:", renditionResults[0].blob?.size || 'unknown');
                                        const blob = renditionResults[0].blob;
                                        
                                        if (!blob) {
                                            console.error("❌ No blob in rendition result");
                                            alert("Screenshot blob is empty. Please try again.");
                                            return;
                                        }
                                        
                                        // Download screenshot IMMEDIATELY - SIMPLE APPROACH
                                        console.log("⬇️ Step 3: Downloading screenshot blob directly...");
                                        const timestamp = Date.now();
                                        const filename = `screenshot_${timestamp}.png`;
                                        
                                        try {
                                            // Method 1: Create blob URL and download
                                            const blobUrl = URL.createObjectURL(blob);
                                            console.log("✅ Blob URL created:", blobUrl);
                                            console.log("📦 Blob details:", {
                                                type: blob.type,
                                                size: blob.size,
                                                filename: filename
                                            });
                                            
                                            // Create download link
                                            const link = document.createElement('a');
                                            link.href = blobUrl;
                                            link.download = filename;
                                            link.style.position = 'fixed';
                                            link.style.top = '-9999px';
                                            link.style.left = '-9999px';
                                            
                                            document.body.appendChild(link);
                                            console.log("✅ Link element added to DOM, clicking...");
                                            
                                            // Force click
                                            link.click();
                                            console.log("✅ Click triggered");
                                            
                                            // Cleanup after a delay
                                            setTimeout(() => {
                                                document.body.removeChild(link);
                                                URL.revokeObjectURL(blobUrl);
                                                console.log("✅ Cleanup complete - URL revoked, link removed");
                                            }, 2000);
                                            
                                            // Also try window.open as fallback
                                            console.log("🔄 Trying window.open as backup...");
                                            const newWindow = window.open(blobUrl, '_blank');
                                            if (newWindow) {
                                                setTimeout(() => newWindow.close(), 1000);
                                                console.log("✅ Window.open also triggered");
                                            }
                                            
                                            alert(`✅ Screenshot downloading!\n\nFilename: ${filename}\nSize: ${(blob.size / 1024).toFixed(2)} KB\n\nCheck your browser downloads folder.`);
                                            
                                        } catch (downloadError: any) {
                                            console.error("❌ Download error:", downloadError);
                                            console.error("❌ Error stack:", downloadError.stack);
                                            
                                            // Fallback: Try direct window.open
                                            try {
                                                console.log("🔄 Fallback: Trying direct window.open...");
                                                const fallbackUrl = URL.createObjectURL(blob);
                                                window.open(fallbackUrl);
                                                alert(`✅ Screenshot opened in new tab!\n\nRight-click the image and "Save As..." if download didn't start.`);
                                            } catch (fallbackError: any) {
                                                console.error("❌ Fallback also failed:", fallbackError);
                                                alert(`❌ Download failed: ${downloadError.message}\n\nScreenshot captured successfully (${(blob.size / 1024).toFixed(2)} KB) but couldn't download. Check console for details.`);
                                            }
                                        }
                                        
                                        // Step 4: Convert Blob to Base64 for backend
                                        console.log("📦 Step 4: Converting screenshot to base64 for backend...");
                                        const reader = new FileReader();
                                        reader.readAsDataURL(blob);
                                        
                                        reader.onloadend = async () => {
                                            try {
                                                const dataUrl = reader.result?.toString();
                                                if (!dataUrl) {
                                                    console.error("❌ FileReader result is empty");
                                                    alert("Failed to process image data");
                                                    return;
                                                }
                                                
                                                const base64data = dataUrl.split(',')[1];
                                                console.log("✅ Base64 conversion complete, length:", base64data.length);
                                                
                                                if (!base64data) {
                                                    console.error("❌ Base64 data is empty after splitting");
                                                    alert("Failed to extract base64 data from image");
                                                    return;
                                                }
                                                
                                                // Download metadata
                                                console.log("⬇️ Downloading metadata...");
                                                try {
                                                    const metadataBlob = new Blob([JSON.stringify({
                                                        screenshot_path: `server/uploads/screenshot_${timestamp}.png`,
                                                        timestamp: timestamp,
                                                        image_metadata: metadataResult.imageMetadata || []
                                                    }, null, 2)], { type: 'application/json' });
                                                    const metadataUrl = URL.createObjectURL(metadataBlob);
                                                    const metadataLink = document.createElement('a');
                                                    metadataLink.href = metadataUrl;
                                                    metadataLink.download = `screenshot_${timestamp}_metadata.json`;
                                                    metadataLink.style.display = 'none';
                                                    document.body.appendChild(metadataLink);
                                                    metadataLink.click();
                                                    setTimeout(() => {
                                                        document.body.removeChild(metadataLink);
                                                        URL.revokeObjectURL(metadataUrl);
                                                    }, 1000);
                                                    console.log("✅ Metadata downloaded");
                                                } catch (metaDownloadError: any) {
                                                    console.error("❌ Metadata download error:", metaDownloadError);
                                                }
                                                
                                                // Step 5: Send to backend to save files to uploads folder
                                                console.log("📡 Step 5: Sending to backend to save files in uploads/ folder...");
                                                try {
                                                    const response = await fetch('http://localhost:3000/capture-and-crop-screenshot', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ 
                                                            screenshot_base64: base64data,
                                                            image_metadata: metadataResult.imageMetadata || []
                                                        })
                                                    });
                                                    
                                                    if (!response.ok) {
                                                        const errorText = await response.text();
                                                        console.error("❌ Backend returned error:", response.status, errorText);
                                                        alert(`❌ Backend save failed (${response.status}): ${errorText.substring(0, 200)}\n\nMake sure backend server is running on port 3000.\n\nCheck console for details.`);
                                                        return;
                                                    }
                                                    
                                                    const result = await response.json();
                                                    console.log("✅ Backend response:", result);
                                                    
                                                    if (result.success) {
                                                        const croppedCount = result.crop_results ? result.crop_results.filter((r: any) => r.success).length : 0;
                                                        const totalImages = result.image_metadata ? result.image_metadata.length : 0;
                                                        
                                                        let message = `✅ SUCCESS! Files saved to server/uploads/ folder:\n\n`;
                                                        message += `📸 Screenshot PNG: ${result.screenshot_path}\n`;
                                                        if (result.blob_text_path) {
                                                            message += `📄 BLOB TEXT FILE: ${result.blob_text_path}\n`;
                                                            message += `   (Contains base64 blob data: ${(result.blob_text_size / 1024).toFixed(2)} KB)\n`;
                                                        }
                                                        message += `📋 Metadata JSON: ${result.metadata_path}\n`;
                                                        
                                                        if (croppedCount > 0) {
                                                            message += `\n✂️ Cropped ${croppedCount} of ${totalImages} image(s):\n`;
                                                            result.crop_results.filter((r: any) => r.success).forEach((r: any, idx: number) => {
                                                                message += `   - ${r.cropped_path}\n`;
                                                            });
                                                        } else if (totalImages > 0) {
                                                            message += `\n⚠️ No images were cropped (check metadata dimensions)\n`;
                                                        }
                                                        
                                                        message += `\n📁 ALL FILES IN: server/uploads/ folder`;
                                                        
                                                        alert(message);
                                                        console.log("📁 All saved files:", {
                                                            screenshot: result.screenshot_path,
                                                            metadata: result.metadata_path,
                                                            cropped_images: result.crop_results?.filter((r: any) => r.success).map((r: any) => r.cropped_path) || []
                                                        });
                                                    } else {
                                                        console.error("❌ Backend reported failure:", result.error);
                                                        alert(`❌ Backend save failed: ${result.error || 'Unknown error'}\n\nCheck console and server logs for details.`);
                                                    }
                                                } catch (apiError: any) {
                                                    console.error("❌ Backend request failed:", apiError);
                                                    alert(`❌ Backend error: ${apiError.message}\n\nMake sure the backend server is running:\n  npm start (in server folder)\n  or\n  node server/server.js\n\nServer should be on http://localhost:3000`);
                                                }
                                            } catch (processError: any) {
                                                console.error("❌ Process error:", processError);
                                                alert(`Error during processing: ${processError.message || 'Unknown error'}\n\nCheck console for details.`);
                                            }
                                        };
                                        
                                        reader.onerror = (error) => {
                                            console.error("❌ FileReader error:", error);
                                            alert("Failed to read screenshot data. Please try again.");
                                        };
                                        
                                    } catch (err: any) {
                                        console.error("❌ Screenshot error:", err);
                                        console.error("❌ Error stack:", err.stack);
                                        alert(`Error: ${err.message || 'Unknown error'}\n\nCheck console for details.`);
                                    }
                                }}
                            >
                                📸 Capture Screenshot & Crop Images (SAVES FILES)
                            </Button>
                            <p style={{ fontSize: "12px", color: "#666", marginTop: "10px" }}>
                                ⚠️ Note: This button SAVES files on the server (server/uploads/). 
                                Use the "Detect Images" button below if you only want to analyze without saving.
                            </p>
                        </div>
                    </div>

                    {/* SECTION 5: IMAGE DETECTION */}
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

                                {/* Display Node Metadata Details FIRST - most important */}
                                {imageDetectionResult.nodeMetadataDetails && imageDetectionResult.nodeMetadataDetails.length > 0 && (
                                    <div style={{ marginBottom: "25px", padding: "15px", backgroundColor: "#f0f7ff", borderRadius: "6px", border: "2px solid #1976d2" }}>
                                        <h3 style={{ fontSize: "18px", marginBottom: "15px", color: "#1976d2" }}>
                                            📋 Document Node Metadata (Source URLs from Copied/Pasted Images)
                                        </h3>
                                        {imageDetectionResult.nodeMetadataDetails.map((nodeInfo: any, idx: number) => (
                                            <div key={idx} style={{ marginBottom: "15px", padding: "12px", backgroundColor: "#fff", borderRadius: "4px", border: nodeInfo.sourceUrl ? "2px solid #4caf50" : "1px solid #ddd" }}>
                                                <div style={{ marginBottom: "8px" }}>
                                                    <strong>Image Node {idx + 1}:</strong> <code style={{ fontSize: "12px", padding: "2px 5px", backgroundColor: "#f5f5f5" }}>{nodeInfo.nodeId}</code>
                                                </div>
                                                {nodeInfo.sourceUrl ? (
                                                    <div style={{ padding: "10px", backgroundColor: "#e8f5e9", borderRadius: "4px", marginTop: "8px" }}>
                                                        <strong style={{ color: "#2e7d32", fontSize: "16px" }}>✅ Source URL Found in Metadata!</strong>
                                                        <a 
                                                            href={nodeInfo.sourceUrl} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            style={{ 
                                                                display: "block",
                                                                color: "#1976d2", 
                                                                textDecoration: "underline",
                                                                wordBreak: "break-all",
                                                                marginTop: "8px",
                                                                fontSize: "14px",
                                                                fontWeight: "bold"
                                                            }}
                                                        >
                                                            {nodeInfo.sourceUrl}
                                                        </a>
                                                    </div>
                                                ) : (
                                                    <div style={{ padding: "10px", backgroundColor: "#fff3cd", borderRadius: "4px", marginTop: "8px" }}>
                                                        <strong style={{ color: "#856404" }}>⚠️ No URL found in metadata</strong>
                                                        <div style={{ fontSize: "12px", marginTop: "8px", color: "#666" }}>
                                                            <div><strong>Node Metadata Keys:</strong> {Object.keys(nodeInfo.metadata.nodeAddOnData).join(", ") || "none"}</div>
                                                            <div style={{ marginTop: "5px" }}><strong>Media Metadata Keys:</strong> {Object.keys(nodeInfo.metadata.mediaAddOnData).join(", ") || "none"}</div>
                                                        </div>
                                                        {/* ALWAYS show all metadata - don't hide it */}
                                                        <details style={{ marginTop: "8px" }} open={true}>
                                                            <summary style={{ cursor: "pointer", fontSize: "12px", fontWeight: "bold", color: "#1976d2" }}>
                                                                🔍 View ALL Node Metadata ({Object.keys(nodeInfo.metadata.nodeAddOnData || {}).length} keys)
                                                            </summary>
                                                            <pre style={{ fontSize: "11px", overflow: "auto", maxHeight: "300px", marginTop: "5px", padding: "8px", backgroundColor: "#f9f9f9", borderRadius: "4px", border: "1px solid #ddd" }}>
                                                                {JSON.stringify(nodeInfo.metadata.nodeAddOnData || {}, null, 2)}
                                                            </pre>
                                                        </details>
                                                        <details style={{ marginTop: "8px" }} open={true}>
                                                            <summary style={{ cursor: "pointer", fontSize: "12px", fontWeight: "bold", color: "#1976d2" }}>
                                                                🔍 View ALL Media Metadata ({Object.keys(nodeInfo.metadata.mediaAddOnData || {}).length} keys)
                                                            </summary>
                                                            <pre style={{ fontSize: "11px", overflow: "auto", maxHeight: "300px", marginTop: "5px", padding: "8px", backgroundColor: "#f9f9f9", borderRadius: "4px", border: "1px solid #ddd" }}>
                                                                {JSON.stringify(nodeInfo.metadata.mediaAddOnData || {}, null, 2)}
                                                            </pre>
                                                        </details>
                                                        {nodeInfo.metadata.nodeProperties && Object.keys(nodeInfo.metadata.nodeProperties).length > 0 && (
                                                            <details style={{ marginTop: "8px" }} open={true}>
                                                                <summary style={{ cursor: "pointer", fontSize: "12px", fontWeight: "bold", color: "#1976d2" }}>
                                                                    🔍 View ALL Node Properties ({Object.keys(nodeInfo.metadata.nodeProperties).length} properties) - EVERYTHING ABOUT THIS NODE
                                                                </summary>
                                                                <pre style={{ fontSize: "11px", overflow: "auto", maxHeight: "400px", marginTop: "5px", padding: "8px", backgroundColor: "#f9f9f9", borderRadius: "4px", border: "1px solid #ddd", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                                                    {JSON.stringify(nodeInfo.metadata.nodeProperties, null, 2)}
                                                                </pre>
                                                            </details>
                                                        )}
                                                        {nodeInfo.metadata.allNodeData && (
                                                            <details style={{ marginTop: "8px" }} open={true}>
                                                                <summary style={{ cursor: "pointer", fontSize: "12px", fontWeight: "bold", color: "#d32f2f" }}>
                                                                    🔬 COMPLETE NODE DUMP - Full Structure Analysis
                                                                </summary>
                                                                <pre style={{ fontSize: "10px", overflow: "auto", maxHeight: "500px", marginTop: "5px", padding: "8px", backgroundColor: "#fff", borderRadius: "4px", border: "2px solid #d32f2f", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                                                    {JSON.stringify(nodeInfo.metadata.allNodeData, null, 2)}
                                                                </pre>
                                                            </details>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Image URLs (from Document Nodes or SerpAPI) */}
                                {(imageDetectionResult.results?.imageUrls || imageDetectionResult.imageUrls) && 
                                 (imageDetectionResult.results?.imageUrls?.length > 0 || imageDetectionResult.imageUrls?.length > 0) && (
                                    <div>
                                        <h3 style={{ fontSize: "18px", marginBottom: "15px", color: "#333" }}>
                                            🔗 Image URLs Found
                                        </h3>
                                        {(imageDetectionResult.results?.imageUrls || imageDetectionResult.imageUrls || []).map((urlResult: any, idx: number) => {
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