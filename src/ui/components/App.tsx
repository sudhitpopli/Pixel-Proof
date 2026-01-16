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

    // ML Detection state
    const [mlApiKey, setMlApiKey] = useState<string>('');
    const [mlBackendUrl, setMlBackendUrl] = useState<string>(''); // For server-side proxy
    const [mlConfigured, setMlConfigured] = useState<boolean>(false);
    const [mlResults, setMlResults] = useState<any>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [mlError, setMlError] = useState<string | null>(null);
    const [claimResult, setClaimResult] = useState<any>(null);
    const [isAnalyzingClaims, setIsAnalyzingClaims] = useState(false);

    const handleExtractText = async () => {
        setIsExtracting(true);
        setError(null);
        setOcrResults(null);

        try {
            console.log("Calling extractText from sandbox...");
            const result: TextExtractionResult = await sandboxProxy.extractText();

            console.log("Extraction result:", result);

            if (result.success) {
                setExtractedText(result.textElements);
            } else {
                setError(result.error || "Unknown error occurred");
            }
        } catch (err) {
            console.error("Failed to extract text:", err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsExtracting(false);
        }
    };

    const handleExtractWithOCR = async () => {
        setIsExtracting(true);
        setError(null);
        setExtractedText([]);

        try {
            console.log("Calling extractTextWithOCR from sandbox...");
            const result: ExtractionSummary = await sandboxProxy.extractTextWithOCR();

            console.log("OCR Extraction result:", result);

            if (result.success) {
                setOcrResults(result);
            } else {
                setError(result.error || "Unknown error occurred");
            }
        } catch (err) {
            console.error("Failed to extract text with OCR:", err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsExtracting(false);
        }
    };

    const handleExtractImagesOnly = async () => {
        setIsExtracting(true);
        setError(null);
        setExtractedText([]);

        try {
            console.log("Calling extractTextFromImagesOnly from sandbox...");
            const result: any = await sandboxProxy.extractTextFromImagesOnly();

            console.log("OCR-only result:", result);

            if (result.success) {
                setOcrResults({
                    success: true,
                    totalElements: result.count,
                    textNodes: 0,
                    ocrResults: result.count,
                    results: result.results,
                    rawText: result.rawText
                });
            } else {
                setError(result.error || "Unknown error occurred");
            }
        } catch (err) {
            console.error("Failed to extract text from images:", err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsExtracting(false);
        }
    };

    const handleCrawlWebPage = async () => {
        if (!crawlUrl.trim()) {
            setCrawlError('Please enter a valid URL');
            return;
        }

        setIsCrawling(true);
        setCrawlError(null);
        setCrawlResult(null);

        try {
            console.log(`Crawling web page: ${crawlUrl}`);
            const result = await sandboxProxy.crawlWebPage(crawlUrl);

            console.log('Crawl result:', result);

            if (result.error) {
                setCrawlError(result.error);
            } else {
                setCrawlResult(result);
            }
        } catch (err) {
            console.error('Failed to crawl web page:', err);
            setCrawlError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsCrawling(false);
        }
    };

    const handleConfigureML = async () => {
        if (!mlApiKey.trim()) {
            setMlError('Please enter a valid Hugging Face API key');
            return;
        }

        try {
            await sandboxProxy.configureMLService({ apiKey: mlApiKey });
            setMlConfigured(true);
            setMlError(null);
            console.log('ML Service configured successfully');

            // Save to localStorage for persistence
            localStorage.setItem('hf_api_key', mlApiKey);
        } catch (err) {
            console.error('Failed to configure ML service:', err);
            setMlError(err instanceof Error ? err.message : String(err));
        }
    };

    const handleAnalyzeDocument = async () => {
        if (!mlConfigured) {
            setMlError('Please configure your Hugging Face API key first');
            return;
        }

        setIsAnalyzing(true);
        setMlError(null);
        setMlResults(null);

        try {
            console.log('Analyzing document for hate speech...');
            const result = await sandboxProxy.analyzeDocumentForHateSpeech();

            console.log('Analysis result:', result);

            if (result.success) {
                setMlResults(result);
            } else {
                setMlError(result.error || 'Analysis failed');
            }
        } catch (err) {
            console.error('Failed to analyze document:', err);
            setMlError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAnalyzeCrawledContent = async () => {
        if (!mlConfigured) {
            setMlError('Please configure your Hugging Face API key first');
            return;
        }

        if (!crawlResult) {
            setMlError('Please crawl a website first');
            return;
        }

        setIsAnalyzing(true);
        setMlError(null);
        setMlResults(null);

        try {
            console.log('Analyzing crawled content for hate speech...');
            const result = await sandboxProxy.analyzeCrawledContentForHateSpeech(crawlResult);

            console.log('Analysis result:', result);

            if (result.success) {
                setMlResults(result);
            } else {
                setMlError(result.error || 'Analysis failed');
            }
        } catch (err) {
            console.error('Failed to analyze crawled content:', err);
            setMlError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAnalyzeClaims = async () => {
        if (!mlConfigured) {
            setMlError('Please configure your Hugging Face API key first');
            return;
        }

        if (!extractedText.length && !crawlResult) {
            setMlError('Please extract text or crawl a website first');
            return;
        }

        // prioritize extracted text
        const textToAnalyze = extractedText.length > 0 ? extractedText.join(' \n ') : (crawlResult?.text?.fullText || '');

        if (!textToAnalyze.trim()) {
            setMlError('No text content validation to analyze');
            return;
        }

        setIsAnalyzingClaims(true);
        setMlError(null);
        setClaimResult(null);

        try {
            console.log('Analyzing text for implicit claims...');
            // We use the first 500 characters for the demo to avoid token limits on free tier
            // In prod, you'd batch this.
            const textSample = textToAnalyze.substring(0, 1000);

            const result = await sandboxProxy.analyzeImplicitClaims(textSample);
            console.log('Claim Analysis Result:', result);

            if (result.success) {
                setClaimResult(result);
            } else {
                setMlError(result.error);
            }
        } catch (err) {
            console.error('Claim Analysis failed:', err);
            setMlError(String(err));
        } finally {
            setIsAnalyzingClaims(false);
        }
    };

    // Load saved config on mount
    React.useEffect(() => {
        const savedKey = localStorage.getItem('hf_api_key');
        const savedBackend = localStorage.getItem('ml_backend_url');

        if (savedKey) setMlApiKey(savedKey);
        if (savedBackend) setMlBackendUrl(savedBackend);

        if (savedKey || savedBackend) {
            sandboxProxy.configureMLService({
                apiKey: savedKey || undefined,
                backendUrl: savedBackend || undefined
            }).then(() => {
                setMlConfigured(true);
            }).catch((err: any) => {
                console.error('Failed to restore ML config:', err);
            });
        }
    }, [sandboxProxy]);

    return (
        <Theme system="express" scale="medium" color="light">
            <div className="compliance-container">
                <header className="compliance-header">
                    <h1>ComplianceGuard Pro</h1>
                    <p>Text Extraction with OCR</p>
                </header>

                <main className="compliance-content">
                    <div className="scanner-panel">
                        <h2>Extract Text from Document</h2>
                        <p>Choose an extraction method below:</p>

                        <div className="button-group" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            <Button size="m" onClick={handleExtractText} disabled={isExtracting}>
                                {isExtracting ? "Extracting..." : "📝 Extract Text (Text Nodes Only)"}
                            </Button>

                            <Button size="m" onClick={handleExtractWithOCR} disabled={isExtracting} variant="primary">
                                {isExtracting ? "Processing..." : "🔍 Extract All Text (with OCR)"}
                            </Button>

                            <Button size="m" onClick={handleExtractImagesOnly} disabled={isExtracting}>
                                {isExtracting ? "Processing..." : "�️ Extract from Images Only (OCR)"}
                            </Button>
                        </div>

                        {error && (
                            <div className="error-message" style={{
                                marginTop: "20px",
                                padding: "15px",
                                backgroundColor: "#fee",
                                border: "1px solid #fcc",
                                borderRadius: "6px",
                                color: "#c00"
                            }}>
                                <strong>Error:</strong> {error}

                                {error.includes("sandbox environment") && (
                                    <div style={{
                                        marginTop: "10px",
                                        padding: "10px",
                                        backgroundColor: "#fff3cd",
                                        border: "1px solid #ffc107",
                                        borderRadius: "4px",
                                        color: "#856404"
                                    }}>
                                        <strong>ℹ️ Sandbox Limitation:</strong>
                                        <p style={{ margin: "5px 0 0 0", fontSize: "13px" }}>
                                            Adobe Express sandbox environment doesn't support browser APIs needed for OCR.
                                            Text node extraction still works! For OCR functionality, consider:
                                        </p>
                                        <ul style={{ margin: "5px 0 0 20px", fontSize: "13px" }}>
                                            <li>Using a server-side OCR API</li>
                                            <li>Exporting images and processing externally</li>
                                            <li>Waiting for Adobe Express SDK OCR support</li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* OCR Results Display */}
                        {ocrResults && ocrResults.totalElements > 0 && (
                            <div className="results-section" style={{ marginTop: "30px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                                    <h3>Extraction Results</h3>
                                    <Button size="s" onClick={() => setShowRawText(!showRawText)}>
                                        {showRawText ? "Show Structured" : "Show Raw Text"}
                                    </Button>
                                </div>

                                <div style={{
                                    padding: "10px",
                                    backgroundColor: "#f0f0f0",
                                    borderRadius: "4px",
                                    marginBottom: "15px"
                                }}>
                                    <strong>Summary:</strong> {ocrResults.totalElements} total elements
                                    ({ocrResults.textNodes} text nodes, {ocrResults.ocrResults} OCR results)
                                </div>

                                {showRawText ? (
                                    <div style={{
                                        maxHeight: "400px",
                                        overflowY: "auto",
                                        border: "1px solid #ddd",
                                        borderRadius: "6px",
                                        padding: "15px",
                                        backgroundColor: "#f9f9f9",
                                        whiteSpace: "pre-wrap",
                                        fontFamily: "monospace"
                                    }}>
                                        {ocrResults.rawText || "(No text extracted)"}
                                    </div>
                                ) : (
                                    <div className="text-list" style={{
                                        maxHeight: "400px",
                                        overflowY: "auto",
                                        border: "1px solid #ddd",
                                        borderRadius: "6px",
                                        padding: "15px",
                                        backgroundColor: "#f9f9f9"
                                    }}>
                                        {ocrResults.results.map((result, index) => (
                                            <div key={index} style={{
                                                padding: "12px",
                                                marginBottom: "10px",
                                                backgroundColor: result.source === 'ocr' ? "#e3f2fd" : "white",
                                                border: `1px solid ${result.source === 'ocr' ? '#2196f3' : '#e0e0e0'}`,
                                                borderRadius: "4px",
                                                fontSize: "14px"
                                            }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                                    <span style={{
                                                        fontSize: "12px",
                                                        fontWeight: "bold",
                                                        color: result.source === 'ocr' ? '#1976d2' : '#666'
                                                    }}>
                                                        {result.source === 'ocr' ? '🔍 OCR' : '📝 Text Node'}
                                                    </span>
                                                    {result.confidence !== undefined && (
                                                        <span style={{ fontSize: "12px", color: "#666" }}>
                                                            Confidence: {result.confidence.toFixed(1)}%
                                                        </span>
                                                    )}
                                                </div>
                                                <div>{result.text}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Legacy Text Node Results Display */}
                        {extractedText.length > 0 && !ocrResults && (
                            <div className="results-section" style={{ marginTop: "30px" }}>
                                <h3>Extracted Text ({extractedText.length} elements)</h3>
                                <div className="text-list" style={{
                                    maxHeight: "400px",
                                    overflowY: "auto",
                                    border: "1px solid #ddd",
                                    borderRadius: "6px",
                                    padding: "15px",
                                    backgroundColor: "#f9f9f9"
                                }}>
                                    {extractedText.map((text, index) => (
                                        <div key={index} style={{
                                            padding: "10px",
                                            marginBottom: "10px",
                                            backgroundColor: "white",
                                            border: "1px solid #e0e0e0",
                                            borderRadius: "4px",
                                            fontSize: "14px"
                                        }}>
                                            <strong>#{index + 1}:</strong> {text}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!extractedText.length && !ocrResults && !error && !isExtracting && (
                            <div className="info-box" style={{ marginTop: "30px" }}>
                                <h4>How it works:</h4>
                                <ul>
                                    <li>✅ <strong>Text Nodes Only:</strong> Extracts text from native text elements</li>
                                    <li>🔍 <strong>With OCR:</strong> Extracts from both text nodes AND images using OCR</li>
                                    <li>🖼️ <strong>Images Only:</strong> Extracts text from images only using OCR</li>
                                    <li>📄 <strong>Raw Text:</strong> View combined text from all sources</li>
                                </ul>
                                <p style={{ marginTop: "15px", color: "#666" }}>
                                    <strong>Note:</strong> OCR processing may take a few moments for images with text.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Web Crawler Section */}
                    <div className="scanner-panel" style={{ marginTop: "40px", paddingTop: "30px", borderTop: "2px solid #e0e0e0" }}>
                        <h2>🌐 Web Crawler</h2>
                        <p>Extract text and images from any website for compliance analysis</p>

                        <div style={{ marginTop: "20px" }}>
                            <label htmlFor="crawl-url" style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
                                Website URL:
                            </label>
                            <div style={{ display: "flex", gap: "10px" }}>
                                <input
                                    id="crawl-url"
                                    type="url"
                                    value={crawlUrl}
                                    onChange={(e) => setCrawlUrl(e.target.value)}
                                    placeholder="https://example.com"
                                    disabled={isCrawling}
                                    style={{
                                        flex: 1,
                                        padding: "10px",
                                        fontSize: "14px",
                                        border: "1px solid #ccc",
                                        borderRadius: "4px"
                                    }}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter' && !isCrawling) {
                                            handleCrawlWebPage();
                                        }
                                    }}
                                />
                                <Button size="m" onClick={handleCrawlWebPage} disabled={isCrawling} variant="primary">
                                    {isCrawling ? "Crawling..." : "🔍 Crawl Website"}
                                </Button>
                            </div>
                        </div>

                        {crawlError && (
                            <div className="error-message" style={{
                                marginTop: "15px",
                                padding: "12px",
                                backgroundColor: "#fee",
                                border: "1px solid #fcc",
                                borderRadius: "6px",
                                color: "#c00",
                                fontSize: "14px"
                            }}>
                                <strong>Crawl Error:</strong> {crawlError}
                            </div>
                        )}

                        {crawlResult && (
                            <div className="crawl-results" style={{ marginTop: "25px" }}>
                                <h3>📄 {crawlResult.title || 'Crawl Results'}</h3>

                                {/* Summary */}
                                <div style={{
                                    padding: "12px",
                                    backgroundColor: "#e8f5e9",
                                    border: "1px solid #4caf50",
                                    borderRadius: "4px",
                                    marginBottom: "20px"
                                }}>
                                    <strong>✅ Crawl Successful</strong>
                                    <div style={{ marginTop: "8px", fontSize: "13px" }}>
                                        • {crawlResult.text.headings.length} headings<br />
                                        • {crawlResult.text.paragraphs.length} paragraphs<br />
                                        • {crawlResult.images.length} images<br />
                                        • {crawlResult.text.links.length} links
                                    </div>
                                </div>

                                {/* Text Content */}
                                {crawlResult.text.fullText && (
                                    <div style={{ marginBottom: "20px" }}>
                                        <h4>📝 Extracted Text</h4>
                                        <div style={{
                                            maxHeight: "300px",
                                            overflowY: "auto",
                                            border: "1px solid #ddd",
                                            borderRadius: "6px",
                                            padding: "15px",
                                            backgroundColor: "#f9f9f9",
                                            fontSize: "13px",
                                            lineHeight: "1.6"
                                        }}>
                                            {/* Headings */}
                                            {crawlResult.text.headings.length > 0 && (
                                                <div style={{ marginBottom: "15px" }}>
                                                    <strong style={{ color: "#1976d2" }}>Headings:</strong>
                                                    <ul style={{ marginTop: "5px", paddingLeft: "20px" }}>
                                                        {crawlResult.text.headings.slice(0, 10).map((heading: string, idx: number) => (
                                                            <li key={idx}>{heading}</li>
                                                        ))}
                                                        {crawlResult.text.headings.length > 10 && (
                                                            <li style={{ color: "#666" }}>... and {crawlResult.text.headings.length - 10} more</li>
                                                        )}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Full Text Preview */}
                                            <div>
                                                <strong style={{ color: "#1976d2" }}>Full Text Preview:</strong>
                                                <p style={{ marginTop: "8px", whiteSpace: "pre-wrap" }}>
                                                    {crawlResult.text.fullText.substring(0, 500)}
                                                    {crawlResult.text.fullText.length > 500 && '...'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Images */}
                                {crawlResult.images.length > 0 && (
                                    <div>
                                        <h4>🖼️ Extracted Images ({crawlResult.images.length})</h4>
                                        <div style={{
                                            maxHeight: "300px",
                                            overflowY: "auto",
                                            border: "1px solid #ddd",
                                            borderRadius: "6px",
                                            padding: "15px",
                                            backgroundColor: "#f9f9f9"
                                        }}>
                                            {crawlResult.images.slice(0, 20).map((img: any, idx: number) => (
                                                <div key={idx} style={{
                                                    padding: "10px",
                                                    marginBottom: "10px",
                                                    backgroundColor: "white",
                                                    border: "1px solid #e0e0e0",
                                                    borderRadius: "4px",
                                                    fontSize: "13px"
                                                }}>
                                                    <div style={{ marginBottom: "5px" }}>
                                                        <strong>#{idx + 1}</strong>
                                                        {img.alt && <span style={{ marginLeft: "10px", color: "#666" }}>Alt: {img.alt}</span>}
                                                    </div>
                                                    <div style={{
                                                        fontSize: "12px",
                                                        color: "#1976d2",
                                                        wordBreak: "break-all"
                                                    }}>
                                                        {img.url}
                                                    </div>
                                                </div>
                                            ))}
                                            {crawlResult.images.length > 20 && (
                                                <div style={{ padding: "10px", color: "#666", textAlign: "center" }}>
                                                    ... and {crawlResult.images.length - 20} more images
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {!crawlResult && !crawlError && !isCrawling && (
                            <div className="info-box" style={{ marginTop: "20px" }}>
                                <h4>How Web Crawler Works:</h4>
                                <ul>
                                    <li>🌐 <strong>Enter URL:</strong> Provide any public website URL</li>
                                    <li>📄 <strong>Extract Content:</strong> Automatically extracts text, headings, and paragraphs</li>
                                    <li>🖼️ <strong>Find Images:</strong> Discovers all images with their URLs and alt text</li>
                                    <li>🔍 <strong>Analyze:</strong> Use extracted content for compliance checking</li>
                                </ul>
                                <p style={{ marginTop: "15px", color: "#666", fontSize: "13px" }}>
                                    <strong>Note:</strong> The crawler respects CORS policies and may use a proxy for restricted sites.
                                    JavaScript-rendered content (SPAs) may not be fully captured.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* ML Detection Section */}
                    <div className="scanner-panel" style={{ marginTop: "40px", paddingTop: "30px", borderTop: "2px solid #e0e0e0" }}>
                        <h2>🤖 ML Hate Speech Detection</h2>
                        <p>Analyze text for hate speech using BERT-based AI models from Hugging Face</p>

                        {/* Configuration */}
                        {!mlConfigured && (
                            <div style={{ marginTop: "20px", padding: "15px", backgroundColor: "#fff3cd", border: "1px solid #ffc107", borderRadius: "6px" }}>
                                <h4 style={{ marginTop: 0, marginBottom: "10px" }}>⚙️ Configuration Required</h4>

                                {/* Option 1: Backend Server (Recommended) */}
                                <div style={{ marginBottom: "15px" }}>
                                    <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "5px" }}>
                                        Option 1: Backend Server URL (Recommended)
                                    </label>
                                    <input
                                        type="text"
                                        value={mlBackendUrl}
                                        onChange={(e) => setMlBackendUrl(e.target.value)}
                                        placeholder="http://localhost:5000"
                                        style={{
                                            width: "100%",
                                            padding: "8px",
                                            fontSize: "14px",
                                            border: "1px solid #ccc",
                                            borderRadius: "4px"
                                        }}
                                    />
                                    <p style={{ fontSize: "11px", color: "#666", marginTop: "3px" }}>
                                        Use your own Python server. No user API key needed.
                                    </p>
                                </div>

                                <div style={{ textAlign: "center", margin: "10px 0", fontSize: "12px", color: "#999" }}>
                                    - OR -
                                </div>

                                {/* Option 2: Direct API Key */}
                                <div style={{ marginBottom: "15px" }}>
                                    <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "5px" }}>
                                        Option 2: Hugging Face API Key
                                    </label>
                                    <input
                                        type="password"
                                        value={mlApiKey}
                                        onChange={(e) => setMlApiKey(e.target.value)}
                                        placeholder="hf_xxxxxxxxxxxxx"
                                        style={{
                                            width: "100%",
                                            padding: "8px",
                                            fontSize: "14px",
                                            border: "1px solid #ccc",
                                            borderRadius: "4px"
                                        }}
                                    />
                                    <p style={{ fontSize: "11px", color: "#666", marginTop: "3px" }}>
                                        Required if not using backend server. <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer">Get Token</a>
                                    </p>
                                </div>

                                <Button size="m" onClick={handleConfigureML} variant="primary" style={{ width: "100%" }}>
                                    💾 Save Configuration
                                </Button>
                            </div>
                        )}

                        {mlConfigured && (
                            <div style={{ marginTop: "20px", padding: "12px", backgroundColor: "#e8f5e9", border: "1px solid #4caf50", borderRadius: "6px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <strong>✅ ML Service Configured</strong>
                                        <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                                            {mlBackendUrl ? `Using Server: ${mlBackendUrl}` : 'Using Direct API Key'}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setMlConfigured(false);
                                            setMlBackendUrl('');
                                            setMlApiKey('');
                                            localStorage.removeItem('hf_api_key');
                                            localStorage.removeItem('ml_backend_url');
                                        }}
                                        style={{
                                            background: "none",
                                            border: "none",
                                            color: "#d32f2f",
                                            cursor: "pointer",
                                            fontSize: "12px",
                                            textDecoration: "underline"
                                        }}
                                    >
                                        Reset
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Analysis Buttons */}
                        <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <Button
                                size="m"
                                onClick={handleAnalyzeDocument}
                                disabled={!mlConfigured || isAnalyzing}
                                variant="primary"
                            >
                                {isAnalyzing ? "Analyzing..." : "🔍 Analyze Document for Hate Speech"}
                            </Button>

                            {crawlResult && (
                                <Button
                                    size="m"
                                    onClick={handleAnalyzeCrawledContent}
                                    disabled={!mlConfigured || isAnalyzing}
                                >
                                    {isAnalyzing ? "Analyzing..." : "🌐 Analyze Crawled Content"}
                                </Button>
                            )}
                        </div>

                        {/* Implicit Claim Analysis (New) */}
                        <div style={{ marginTop: "20px", borderTop: "1px dashed #ccc", paddingTop: "15px" }}>
                            <h4 style={{ margin: "0 0 10px 0" }}>📢 Marketing Claim Detection (Zero-Shot)</h4>
                            <p style={{ fontSize: "12px", color: "#666", marginBottom: "10px" }}>
                                Detects exaggerated claims, marketing fluff, or subjective opinions using BART.
                            </p>
                            <Button
                                size="m"
                                onClick={handleAnalyzeClaims}
                                disabled={!mlConfigured || isAnalyzingClaims}
                                variant="secondary"
                                style={{ width: "100%" }}
                            >
                                {isAnalyzingClaims ? "Thinking..." : "🧐 Analyze for Implicit Claims"}
                            </Button>
                        </div>

                        {/* Claim Results Display */}
                        {claimResult && (
                            <div style={{ marginTop: "25px", border: "1px solid #2196f3", borderRadius: "6px", padding: "15px", backgroundColor: "#e3f2fd" }}>
                                <h3 style={{ color: "#0d47a1", marginTop: 0 }}>🧐 Claim Analysis Result</h3>

                                <div style={{ marginBottom: "15px" }}>
                                    <span style={{
                                        padding: "4px 8px",
                                        borderRadius: "4px",
                                        backgroundColor: claimResult.isClaim ? "#f44336" : "#4caf50",
                                        color: "white",
                                        fontWeight: "bold",
                                        fontSize: "14px"
                                    }}>
                                        {claimResult.isClaim ? "⚠️ CLAIM DETECTED" : "✅ FACTUAL / NEUTRAL"}
                                    </span>
                                    <span style={{ marginLeft: "10px", fontWeight: "bold", color: "#333" }}>
                                        {claimResult.primaryLabel.toUpperCase()}
                                    </span>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                    {Object.entries(claimResult.scores).map(([label, score]: [string, any]) => (
                                        <div key={label} style={{ backgroundColor: "white", padding: "8px", borderRadius: "4px" }}>
                                            <div style={{ fontSize: "11px", color: "#666", textTransform: "capitalize" }}>{label}</div>
                                            <div style={{ height: "6px", backgroundColor: "#eee", borderRadius: "3px", marginTop: "4px" }}>
                                                <div style={{
                                                    width: `${score * 100}%`,
                                                    height: "100%",
                                                    backgroundColor: label.includes('claim') ? '#ff9800' : '#2196f3',
                                                    borderRadius: "3px"
                                                }}></div>
                                            </div>
                                            <div style={{ fontSize: "12px", textAlign: "right", marginTop: "2px" }}>{(score * 100).toFixed(1)}%</div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ marginTop: "10px", fontSize: "11px", color: "#666", textAlign: "right" }}>
                                    Model: {claimResult.model}
                                </div>
                            </div>
                        )}

                        {/* Error Display */}
                        {mlError && (
                            <div style={{
                                marginTop: "15px",
                                padding: "12px",
                                backgroundColor: "#fee",
                                border: "1px solid #fcc",
                                borderRadius: "6px",
                                color: "#c00",
                                fontSize: "14px"
                            }}>
                                <strong>Error:</strong> {mlError}
                            </div>
                        )}

                        {/* Results Display */}
                        {mlResults && mlResults.success && (
                            <div style={{ marginTop: "25px" }}>
                                <h3>📊 Analysis Results</h3>

                                {/* Summary */}
                                <div style={{
                                    padding: "15px",
                                    backgroundColor: mlResults.summary.hateSpeechCount > 0 ? "#fee" : "#e8f5e9",
                                    border: `1px solid ${mlResults.summary.hateSpeechCount > 0 ? '#fcc' : '#4caf50'}`,
                                    borderRadius: "6px",
                                    marginBottom: "20px"
                                }}>
                                    <div style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "10px" }}>
                                        {mlResults.summary.hateSpeechCount > 0 ? "⚠️ Hate Speech Detected" : "✅ No Hate Speech Detected"}
                                    </div>
                                    <div style={{ fontSize: "14px" }}>
                                        • Total Analyzed: {mlResults.summary.totalAnalyzed}<br />
                                        • Hate Speech: {mlResults.summary.hateSpeechCount}<br />
                                        • Clean: {mlResults.summary.cleanCount}<br />
                                        • Average Confidence: {mlResults.summary.averageConfidence.toFixed(1)}%
                                    </div>
                                </div>

                                {/* Detailed Results */}
                                <div style={{
                                    maxHeight: "400px",
                                    overflowY: "auto",
                                    border: "1px solid #ddd",
                                    borderRadius: "6px",
                                    padding: "15px",
                                    backgroundColor: "#f9f9f9"
                                }}>
                                    {mlResults.results.map((item: any, index: number) => (
                                        <div key={index} style={{
                                            padding: "12px",
                                            marginBottom: "10px",
                                            backgroundColor: item.result.isHateSpeech ? "#fee" : "white",
                                            border: `2px solid ${item.result.isHateSpeech ? '#f44336' : '#e0e0e0'}`,
                                            borderRadius: "6px"
                                        }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                                <span style={{
                                                    fontSize: "12px",
                                                    fontWeight: "bold",
                                                    color: item.result.isHateSpeech ? '#f44336' : '#4caf50'
                                                }}>
                                                    {item.result.isHateSpeech ? "⚠️ HATE SPEECH" : "✅ CLEAN"}
                                                </span>
                                                <span style={{ fontSize: "12px", color: "#666" }}>
                                                    Confidence: {item.result.confidence.toFixed(1)}%
                                                </span>
                                            </div>
                                            <div style={{ fontSize: "14px", lineHeight: "1.5" }}>
                                                {item.text}
                                            </div>
                                            {item.error && (
                                                <div style={{ marginTop: "8px", fontSize: "12px", color: "#c00" }}>
                                                    Error: {item.error}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!mlResults && !mlError && !isAnalyzing && mlConfigured && (
                            <div className="info-box" style={{ marginTop: "20px" }}>
                                <h4>How ML Detection Works:</h4>
                                <ul>
                                    <li>🤖 <strong>BERT Model:</strong> Uses GroNLP/hateBERT from Hugging Face</li>
                                    <li>📝 <strong>Document Analysis:</strong> Analyzes all text in your document</li>
                                    <li>🌐 <strong>Web Content:</strong> Analyzes crawled website content</li>
                                    <li>📊 <strong>Confidence Scores:</strong> Shows detection confidence for each segment</li>
                                    <li>⚡ <strong>Fast Processing:</strong> Results cached for repeated analysis</li>
                                </ul>
                                <p style={{ marginTop: "15px", color: "#666", fontSize: "13px" }}>
                                    <strong>Note:</strong> Analysis may take a few moments as the model processes each text segment.
                                    Rate limiting applies to avoid API throttling.
                                </p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </Theme >
    );
};

export default App;
