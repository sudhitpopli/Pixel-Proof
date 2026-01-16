import React, { useState } from "react";
import { Theme } from "@swc-react/theme";
import refreshIcon from "../../Assets/refresh-icon.svg";
import copyrightIcon from "../../Assets/copyright-icon.svg";
import visionIcon from "../../Assets/vision-icon.svg";
import legalIcon from "../../Assets/legal-icon.svg";
import menuIcon from "../../Assets/menu-icon.svg";
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
    const [activeTab, setActiveTab] = useState<'copyright' | 'vision' | 'legal' | 'menu'>('copyright');

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
            <div className="pixel-proof-container">
                {/* Top bar with checkbox and title */}
                <div className="top-bar">
                    <div className="title-section">
                        <input type="checkbox" className="title-checkbox" />
                        <span className="app-title">PIXEL PROOF</span>
                    </div>
                </div>

                {/* Centered Refresh Button */}
                <div className="refresh-section">
                    <button 
                        className="refresh-button"
                        onClick={handleAdvanceSpellCheck} 
                        disabled={isProcessing}
                    >
                        <img src={refreshIcon} alt="Refresh" className="refresh-icon" />
                        <span>Refresh</span>
                    </button>
                </div>

                {/* Navigation Tabs */}
                <div className="nav-tabs">
                    <button 
                        className={`nav-tab ${activeTab === 'copyright' ? 'active' : ''}`}
                        onClick={() => setActiveTab('copyright')}
                    >
                        <img src={copyrightIcon} alt="Copyright" className="nav-icon" />
                        {activeTab === 'copyright' && <div className="active-indicator"></div>}
                    </button>
                    <button 
                        className={`nav-tab ${activeTab === 'vision' ? 'active' : ''}`}
                        onClick={() => setActiveTab('vision')}
                    >
                        <img src={visionIcon} alt="Vision" className="nav-icon" />
                        {activeTab === 'vision' && <div className="active-indicator"></div>}
                    </button>
                    <button 
                        className={`nav-tab ${activeTab === 'legal' ? 'active' : ''}`}
                        onClick={() => setActiveTab('legal')}
                    >
                        <img src={legalIcon} alt="Legal" className="nav-icon" />
                        {activeTab === 'legal' && <div className="active-indicator"></div>}
                    </button>
                    <button 
                        className={`nav-tab ${activeTab === 'menu' ? 'active' : ''}`}
                        onClick={() => setActiveTab('menu')}
                    >
                        <img src={menuIcon} alt="Menu" className="nav-icon" />
                        {activeTab === 'menu' && <div className="active-indicator"></div>}
                    </button>
                </div>

                {/* Tab Title */}
                <div className="tab-title">
                    {activeTab === 'copyright' && 'Copyright'}
                    {activeTab === 'vision' && 'Vision'}
                    {activeTab === 'legal' && 'Legal'}
                    {activeTab === 'menu' && 'Menu'}
                </div>

                {/* Content Area */}
                <div className="content-area">

                    {isProcessing && (
                        <div className="processing-indicator">
                            <div className="spinner"></div>
                            <p>Scanning...</p>
                        </div>
                    )}

                    {error && <div className="error-message">{error}</div>}

                    {/* Analysis Results View */}
                    {!isProcessing && viewMode === 'analysis' && mlResults && (
                        <div className="results-content">
                            {/* Summary Header */}
                            <div className={`summary-header ${mlResults.summary.hateSpeechCount > 0 ? 'has-issues' : 'clean'}`}>
                                {mlResults.summary.hateSpeechCount > 0 
                                    ? `⚠️ Found ${mlResults.summary.hateSpeechCount} Flagged Item(s)` 
                                    : "✅ No hate speech or offensive language is detected"}
                            </div>

                            {/* Flagged Phrases */}
                            {mlResults.summary.hateSpeechCount > 0 && (
                                <div className="flagged-box">
                                    <div className="flagged-header">🚩 Flagged Content Details</div>
                                    <div className="flagged-list">
                                        {mlResults.segments.filter((s: AnalyzedSegment) => s.is_hate).map((seg: AnalyzedSegment, idx: number) => (
                                            <div key={idx} className="flagged-item">
                                                <div className="flagged-text">"{seg.text}"</div>
                                                <div className="flagged-meta">
                                                    <span className="flagged-label">{seg.label}</span>
                                                    <span className="flagged-confidence">Confidence: {(seg.confidence * 100).toFixed(1)}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Full Context View */}
                            <div className="context-view">
                                <h4>📄 Full Text Context</h4>
                                <div className="context-text">
                                    {mlResults.segments.map((seg: AnalyzedSegment, idx: number) => (
                                        <span 
                                            key={idx} 
                                            className={seg.is_hate ? 'flagged-text-highlight' : ''}
                                            title={seg.is_hate ? `${seg.label} (${(seg.confidence * 100).toFixed(0)}%)` : ""}
                                        >
                                            {seg.text}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Raw Text Data View */}
                    {!isProcessing && viewMode === 'raw' && (
                        <div className="raw-content">
                            <div className="raw-section">
                                <strong>🖼️ OCR Text (From Image):</strong>
                                <div className="raw-text-box">
                                    {rawOcrText || "(No text found in image)"}
                                </div>
                            </div>
                            <div className="raw-section">
                                <strong>📄 Document Text (From Layers):</strong>
                                <div className="raw-text-box">
                                    {rawDocText || "(No text layers found)"}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {!isProcessing && !mlResults && !error && (
                        <div className="empty-state">
                            Click Refresh to scan the document for compliance issues.
                        </div>
                    )}
                </div>
            </div>
        </Theme>
    );
};

export default App;