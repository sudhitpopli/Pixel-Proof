import React, { useState } from "react";
import { Theme } from "@swc-react/theme";
import { Button } from "@swc-react/button";
import "./App.css";

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
                </main>
            </div>
        </Theme >
    );
};

export default App;