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
                </main>
            </div>
        </Theme>
    );
};

export default App;
