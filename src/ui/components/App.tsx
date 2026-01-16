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

interface AppProps {
    addOnUISdk: any;
    sandboxProxy: any;
}

const App: React.FC<AppProps> = ({ addOnUISdk, sandboxProxy }) => {
    const [extractedText, setExtractedText] = useState<string[]>([]);
    const [isExtracting, setIsExtracting] = useState(false);
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

                        <div className="button-group">
                            <Button size="m" onClick={handleExtractText} disabled={isExtracting}>
                                {isExtracting ? "Extracting..." : "📝 Extract Text"}
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

                        {extractedText.length === 0 && !error && !isExtracting && (
                            <div className="info-box" style={{ marginTop: "30px" }}>
                                <h4>How it works:</h4>
                                <ul>
                                    <li>✅ Scans all pages in your document</li>
                                    <li>✅ Iterates through all artboards</li>
                                    <li>✅ Extracts text from Text nodes</li>
                                    <li>✅ Displays results in a list</li>
                                </ul>
                                <p style={{ marginTop: "15px", color: "#666" }}>
                                    <strong>Note:</strong> Make sure your document has some text elements before extracting.
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
