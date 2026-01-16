import React, { useState } from "react";
import { Theme } from "@swc-react/theme";
import { Button } from "@swc-react/button";
import { createWorker } from "tesseract.js";
import "./App.css";

interface TextExtractionResult {
    success: boolean;
    textElements: string[];
    count: number;
    error?: string;
}

interface ImageDataResult {
    success: boolean;
    images: Array<{ id: string; data: ArrayBuffer; type: string }>;
    count: number;
    error?: string;
}

interface AppProps {
    addOnUISdk: any;
    sandboxProxy: any;
}

const App: React.FC<AppProps> = ({ addOnUISdk, sandboxProxy }) => {
    const [extractedText, setExtractedText] = useState<string[]>([]);
    const [ocrText, setOcrText] = useState<string[]>([]);
    const [isExtracting, setIsExtracting] = useState(false);
    const [isPerformingOCR, setIsPerformingOCR] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleExtractText = async () => {
        setIsExtracting(true);
        setError(null);

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

    const handleExtractOCR = async () => {
        setIsPerformingOCR(true);
        setError(null);

        try {
            console.log("Calling extractImageData from sandbox...");
            const result: ImageDataResult = await sandboxProxy.extractImageData();

            console.log("Image data result:", result);

            if (result.success && result.images.length > 0) {
                // Initialize Tesseract worker
                const worker = await createWorker('eng'); 
                console.log("Tesseract worker initialized");

                const ocrResults: string[] = [];

                // Perform OCR on each image
                for (const imageInfo of result.images) {
                    try {
                        console.log(`Performing OCR on image: ${imageInfo.id}`);
                        
                        // Convert ArrayBuffer back to Blob
                        const imageBlob = new Blob([imageInfo.data], { type: imageInfo.type });
                        
                        // Perform OCR
                        const { data: { text } } = await worker.recognize(imageBlob);
                        
                        if (text && text.trim().length > 0) {
                            const cleanedText = text.trim();
                            console.log(`OCR Result: "${cleanedText}"`);
                            ocrResults.push(cleanedText);
                        }
                    } catch (err) {
                        console.error(`Error performing OCR on image ${imageInfo.id}:`, err);
                    }
                }

                // Terminate worker
                await worker.terminate();
                console.log("Tesseract worker terminated");

                setOcrText(ocrResults);
            } else if (result.success && result.images.length === 0) {
                setOcrText([]);
                setError("No images found in the document");
            } else {
                setError(result.error || "Unknown error occurred");
            }
        } catch (err) {
            console.error("Failed to perform OCR:", err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsPerformingOCR(false);
        }
    };

    return (
        <Theme system="express" scale="medium" color="light">
            <div className="compliance-container">
                <header className="compliance-header">
                    <h1>ComplianceGuard Pro</h1>
                    <p>Phase 1: Text Extraction</p>
                </header>

                <main className="compliance-content">
                    <div className="scanner-panel">
                        <h2>Extract Text from Document</h2>
                        <p>Click the button below to extract all text from your Adobe Express design.</p>

                        <div className="button-group" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                            <Button size="m" onClick={handleExtractText} disabled={isExtracting || isPerformingOCR}>
                                {isExtracting ? "Extracting..." : "📝 Extract Text"}
                            </Button>
                            <Button size="m" onClick={handleExtractOCR} disabled={isExtracting || isPerformingOCR}>
                                {isPerformingOCR ? "Performing OCR..." : "🔍 Extract Text from Images (OCR)"}
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

                        {extractedText.length > 0 && (
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

                        {ocrText.length > 0 && (
                            <div className="results-section" style={{ marginTop: "30px" }}>
                                <h3>OCR Extracted Text ({ocrText.length} elements)</h3>
                                <div className="text-list" style={{
                                    maxHeight: "400px",
                                    overflowY: "auto",
                                    border: "1px solid #4CAF50",
                                    borderRadius: "6px",
                                    padding: "15px",
                                    backgroundColor: "#f1f8f4"
                                }}>
                                    {ocrText.map((text, index) => (
                                        <div key={`ocr-${index}`} style={{
                                            padding: "10px",
                                            marginBottom: "10px",
                                            backgroundColor: "white",
                                            border: "1px solid #4CAF50",
                                            borderRadius: "4px",
                                            fontSize: "14px"
                                        }}>
                                            <strong>OCR #{index + 1}:</strong> {text}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {extractedText.length === 0 && ocrText.length === 0 && !error && !isExtracting && !isPerformingOCR && (
                            <div className="info-box" style={{ marginTop: "30px" }}>
                                <h4>How it works:</h4>
                                <ul>
                                    <li>✅ <strong>Extract Text:</strong> Scans all pages, artboards, and extracts text from Text nodes</li>
                                    <li>✅ <strong>OCR:</strong> Uses Tesseract.js to extract text from images using optical character recognition</li>
                                    <li>✅ Displays results in separate lists</li>
                                </ul>
                                <p style={{ marginTop: "15px", color: "#666" }}>
                                    <strong>Note:</strong> Make sure your document has text elements or images with text before extracting.
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
