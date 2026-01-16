import React, { useState } from "react";
import { Theme } from "@swc-react/theme";
import { Button } from "@swc-react/button";
import "./App.css";

// INTERFACES
interface AnalyzedSegment {
    text: string;
    label: string;
    confidence: number;
    is_hate: boolean;
}

interface AppProps {
    addOnUISdk: any;
    sandboxProxy: any;
}

const App: React.FC<AppProps> = ({ addOnUISdk, sandboxProxy }) => {
    // --- STATE ---
    const [rawOcrText, setRawOcrText] = useState<string>("");
    const [rawDocText, setRawDocText] = useState<string>("");
    
    // Analysis State
    const [mlResults, setMlResults] = useState<any>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Toggle views
    const [viewMode, setViewMode] = useState<'analysis' | 'raw'>('analysis');

    // --- HELPER: FORMATTING ---
    const formatBackendResponse = (analysisData: any) => {
        const segments: AnalyzedSegment[] = analysisData.segments || [];
        let hateCount = 0;
        
        segments.forEach(seg => {
            if (seg.is_hate) hateCount++;
        });

        return {
            success: true,
            segments: segments,
            summary: {
                hateSpeechCount: hateCount,
                totalAnalyzed: segments.length
            }
        };
    };

    // --- MAIN FUNCTION ---
    const handleAdvanceSpellCheck = async () => {
        console.log("🚀 STARTING SCAN...");
        setIsProcessing(true);
        setError(null);
        setMlResults(null);
        setRawOcrText("");
        setRawDocText("");

        try {
            // 1. OCR SCAN (From Image)
            let ocrTxt = "";
            try {
                if (addOnUISdk.app.document.createRenditions) {
                    const renditionResults = await addOnUISdk.app.document.createRenditions({ range: "currentPage", format: "image/png" });
                    const blob = renditionResults[0].blob;
                    
                    const formData = new FormData();
                    formData.append("image", blob, "page.png");
                    
                    const res = await fetch("http://localhost:3000/analyze-image", { method: "POST", body: formData });
                    if (res.ok) {
                        const data = await res.json();
                        ocrTxt = data.result || "";
                        setRawOcrText(ocrTxt);
                    }
                }
            } catch (e) {
                console.warn("OCR Skipped/Failed:", e);
            }

            // 2. DOCUMENT TEXT (From Sandbox)
            let docTxt = "";
            try {
                const extractionResult = await sandboxProxy.extractText();
                if (extractionResult.success) {
                    docTxt = extractionResult.textElements.join(' ');
                    setRawDocText(docTxt);
                }
            } catch (e) {
                console.warn("Doc Text Extraction Failed:", e);
            }

            // 3. COMBINE & ANALYZE
            const combinedText = `${ocrTxt}\n ${docTxt}`.trim();

            if (!combinedText) {
                throw new Error("No text found in either OCR or Document Layers.");
            }

            const analysisRes = await fetch("http://localhost:3000/analyze-hate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: combinedText })
            });

            if (!analysisRes.ok) throw new Error(await analysisRes.text());
            
            const analysisData = await analysisRes.json();
            const formatted = formatBackendResponse(analysisData);
            
            setMlResults(formatted);
            setViewMode('analysis'); // Switch to results view

        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Theme system="express" scale="medium" color="light">
            <div className="compliance-container">
                <header className="compliance-header">
                    <h1>ComplianceGuard Pro</h1>
                </header>

                <main className="compliance-content">
                    <div className="scanner-panel">
                        <h2>Advance Spell Check</h2>
                        <p>Scans images (OCR) and text layers for hate speech.</p>

                        <div className="button-group">
                            <Button size="m" onClick={handleAdvanceSpellCheck} disabled={isProcessing} variant="cta">
                                {isProcessing ? "🔍 Scanning..." : "✨ Run Scan"}
                            </Button>
                        </div>

                        {/* TABS FOR VIEWING RESULTS */}
                        {!isProcessing && (rawOcrText || rawDocText) && (
                            <div style={{ marginTop: "20px", borderBottom: "1px solid #ddd" }}>
                                <button 
                                    onClick={() => setViewMode('analysis')}
                                    style={{ padding: "8px 15px", marginRight: "10px", fontWeight: viewMode==='analysis'?'bold':'normal', borderBottom: viewMode==='analysis'?"2px solid blue":"none", background:"none", border:"none", cursor:"pointer"}}
                                >
                                    🛡️ Analysis Results
                                </button>
                                <button 
                                    onClick={() => setViewMode('raw')}
                                    style={{ padding: "8px 15px", fontWeight: viewMode==='raw'?'bold':'normal', borderBottom: viewMode==='raw'?"2px solid blue":"none", background:"none", border:"none", cursor:"pointer"}}
                                >
                                    📝 Raw Text Data
                                </button>
                            </div>
                        )}

                        {error && <div className="error-message" style={{color: "red", marginTop: "10px"}}>{error}</div>}

                        {/* ========================================================= */}
                        {/* VIEW 1: ANALYSIS RESULTS                                  */}
                        {/* ========================================================= */}
                        {viewMode === 'analysis' && mlResults && (
                            <div style={{ marginTop: "15px" }}>
                                
                                {/* 1. SUMMARY HEADER */}
                                <div style={{ 
                                    marginBottom: "20px", 
                                    padding: "10px", 
                                    borderRadius: "6px", 
                                    backgroundColor: mlResults.summary.hateSpeechCount > 0 ? "#ffebee" : "#e8f5e9",
                                    color: mlResults.summary.hateSpeechCount > 0 ? "#c62828" : "#2e7d32",
                                    fontWeight: "bold",
                                    textAlign: "center"
                                }}>
                                    {mlResults.summary.hateSpeechCount > 0 
                                        ? `⚠️ Found ${mlResults.summary.hateSpeechCount} Flagged Item(s)` 
                                        : "✅ No Hate Speech Detected"}
                                </div>

                                {/* 2. NEW BOX: FLAGGED PHRASES ONLY */}
                                {mlResults.summary.hateSpeechCount > 0 && (
                                    <div style={{ marginBottom: "25px", border: "1px solid #ef9a9a", borderRadius: "6px", overflow: "hidden" }}>
                                        <div style={{ backgroundColor: "#ffebee", padding: "8px 12px", borderBottom: "1px solid #ef9a9a", fontWeight: "bold", color: "#b71c1c", fontSize: "14px" }}>
                                            🚩 Flagged Content Details
                                        </div>
                                        <div style={{ maxHeight: "200px", overflowY: "auto", backgroundColor: "white" }}>
                                            {mlResults.segments.filter((s: AnalyzedSegment) => s.is_hate).map((seg: AnalyzedSegment, idx: number) => (
                                                <div key={idx} style={{ padding: "10px", borderBottom: "1px solid #eee", display: "flex", flexDirection: "column", gap: "5px" }}>
                                                    <div style={{ fontSize: "14px", color: "#333", fontWeight: "500" }}>
                                                        "{seg.text}"
                                                    </div>
                                                    <div style={{ display: "flex", gap: "10px", fontSize: "12px" }}>
                                                        <span style={{ 
                                                            backgroundColor: "#ffcdd2", color: "#b71c1c", 
                                                            padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" 
                                                        }}>
                                                            {seg.label}
                                                        </span>
                                                        <span style={{ color: "#666", alignSelf: "center" }}>
                                                            Confidence: {(seg.confidence * 100).toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 3. FULL CONTEXT VIEW */}
                                <div style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "6px", backgroundColor: "#fff" }}>
                                    <h4 style={{marginTop: 0, marginBottom: "10px", fontSize: "14px", color: "#555"}}>📄 Full Text Context</h4>
                                    <div style={{ lineHeight: "1.8", fontSize: "14px" }}>
                                        {mlResults.segments.map((seg: AnalyzedSegment, idx: number) => (
                                            <span key={idx} 
                                                style={{ 
                                                    backgroundColor: seg.is_hate ? "rgba(255, 0, 0, 0.1)" : "transparent",
                                                    borderBottom: seg.is_hate ? "2px solid red" : "none",
                                                    marginRight: "5px",
                                                    padding: "2px 0",
                                                    borderRadius: "3px",
                                                    cursor: seg.is_hate ? "help" : "default"
                                                }}
                                                title={seg.is_hate ? `${seg.label} (${(seg.confidence * 100).toFixed(0)}%)` : ""}
                                            >
                                                {seg.text}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ========================================================= */}
                        {/* VIEW 2: RAW TEXT DATA                                     */}
                        {/* ========================================================= */}
                        {viewMode === 'raw' && (
                            <div style={{ marginTop: "15px" }}>
                                <div style={{ marginBottom: "20px" }}>
                                    <strong>🖼️ OCR Text (From Image):</strong>
                                    <div style={{ backgroundColor: "#f4f4f4", padding: "10px", fontSize: "12px", borderRadius: "4px", maxHeight: "150px", overflowY: "auto", whiteSpace: "pre-wrap" }}>
                                        {rawOcrText || "(No text found in image)"}
                                    </div>
                                </div>
                                <div>
                                    <strong>📄 Document Text (From Layers):</strong>
                                    <div style={{ backgroundColor: "#f4f4f4", padding: "10px", fontSize: "12px", borderRadius: "4px", maxHeight: "150px", overflowY: "auto", whiteSpace: "pre-wrap" }}>
                                        {rawDocText || "(No text layers found)"}
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </main>
            </div>
        </Theme>
    );
};

export default App;