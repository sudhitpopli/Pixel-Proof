import React, { useState, useEffect } from "react";
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

// ==========================================
// DISCLAIMER TEMPLATES
// ==========================================
const DISCLAIMER_TEMPLATES: Record<string, Record<string, string>> = {
    "English": {
        "General": "The information provided is for general informational purposes only. All information is provided in good faith, however we make no representation or warranty of any kind.",
        "Financial": "This content is for informational purposes only and should not be construed as financial advice. Please consult with a professional financial advisor.",
        "Health": "The content is not intended to be a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician.",
        "Copyright": "© 2024 All Rights Reserved. Unauthorized use and/or duplication of this material without express and written permission is strictly prohibited."
    },
    "Spanish": {
        "General": "La información proporcionada es solo para fines informativos generales. Toda la información se proporciona de buena fe, sin embargo, no hacemos ninguna representación o garantía.",
        "Financial": "Este contenido es solo para fines informativos y no debe interpretarse como asesoramiento financiero. Consulte con un asesor financiero profesional.",
        "Health": "El contenido no pretende sustituir el consejo, diagnóstico o tratamiento médico profesional. Busque siempre el consejo de su médico.",
        "Copyright": "© 2024 Todos los derechos reservados. Queda estrictamente prohibido el uso no autorizado y/o la duplicación de este material sin permiso expreso."
    },
    "French": {
        "General": "Les informations fournies sont uniquement à titre informatif. Toutes les informations sont fournies de bonne foi, toutefois nous ne faisons aucune déclaration ou garantie.",
        "Financial": "Ce contenu est à titre informatif uniquement et ne doit pas être interprété comme un conseil financier. Veuillez consulter un conseiller financier professionnel.",
        "Health": "Le contenu n'est pas destiné à se substituer à un avis médical professionnel, un diagnostic ou un traitement. Demandez toujours l'avis de votre médecin.",
        "Copyright": "© 2024 Tous droits réservés. L'utilisation non autorisée et/ou la duplication de ce matériel sans autorisation expresse est strictement interdite."
    },
    "German": {
        "General": "Die bereitgestellten Informationen dienen nur allgemeinen Informationszwecken. Alle Informationen werden nach bestem Wissen und Gewissen bereitgestellt, jedoch ohne Gewähr.",
        "Financial": "Dieser Inhalt dient nur zu Informationszwecken und sollte nicht als Finanzberatung ausgelegt werden. Bitte konsultieren Sie einen professionellen Finanzberater.",
        "Health": "Der Inhalt ist kein Ersatz für professionelle medizinische Beratung, Diagnose oder Behandlung. Suchen Sie immer den Rat Ihres Arztes.",
        "Copyright": "© 2024 Alle Rechte vorbehalten. Die unerlaubte Verwendung und/oder Vervielfältigung dieses Materials ohne ausdrückliche Genehmigung ist strengstens untersagt."
    }
};

const App: React.FC<AppProps> = ({ addOnUISdk, sandboxProxy }) => {
    // --- STATE ---
    const [rawOcrText, setRawOcrText] = useState<string>("");
    const [rawDocText, setRawDocText] = useState<string>("");
    const [mlResults, setMlResults] = useState<any>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'analysis' | 'raw'>('analysis');

    // Disclaimer State
    const [discLang, setDiscLang] = useState<string>("English");
    const [discType, setDiscType] = useState<string>("General");
    const [discText, setDiscText] = useState<string>(DISCLAIMER_TEMPLATES["English"]["General"]);

    // Save Image State
    const [isSavingImage, setIsSavingImage] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

    // Update text when language or type changes
    useEffect(() => {
        if (DISCLAIMER_TEMPLATES[discLang] && DISCLAIMER_TEMPLATES[discLang][discType]) {
            setDiscText(DISCLAIMER_TEMPLATES[discLang][discType]);
        }
    }, [discLang, discType]);

    // --- HANDLERS ---
    
    // 1. Insert Disclaimer
    const handleInsertDisclaimer = async () => {
        try {
            await sandboxProxy.createDisclaimerText(discText);
        } catch (err: any) {
            console.error("Failed to insert text:", err);
            setError("Failed to insert text into document.");
        }
    };

    // 2. Save Selected Image
    const handleSaveSelectedImage = async () => {
        setIsSavingImage(true);
        setError(null);
        setDownloadUrl(null);

        try {
            // STEP A: Get Selection Coordinates
            let selection;
            try {
                selection = await sandboxProxy.getSelectionDetails();
            } catch (err: any) {
                throw new Error(err.message || "Failed to get selection.");
            }

            console.log(`Targeting Selection: ${selection.type} at (${selection.x}, ${selection.y})`);

            // STEP B: Export Page
            if (!addOnUISdk.app.document.createRenditions) {
                throw new Error("createRenditions API not supported.");
            }

            const renditionResults = await addOnUISdk.app.document.createRenditions({
                range: "currentPage",
                format: "image/png"
            });

            if (!renditionResults || renditionResults.length === 0) {
                throw new Error("Failed to render page.");
            }

            // STEP C: Crop
            const pageBlob = renditionResults[0].blob;
            const pageUrl = URL.createObjectURL(pageBlob);

            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = selection.width;
                canvas.height = selection.height;
                const ctx = canvas.getContext('2d');

                if (ctx) {
                    ctx.drawImage(
                        img, 
                        selection.x, selection.y, selection.width, selection.height, 
                        0, 0, selection.width, selection.height
                    );

                    canvas.toBlob((blob) => {
                        if (!blob) {
                            setError("Failed to process image crop.");
                            return;
                        }
                        
                        const finalUrl = URL.createObjectURL(blob);
                        setDownloadUrl(finalUrl);
                        
                        URL.revokeObjectURL(pageUrl);
                        setIsSavingImage(false);
                        console.log("Image processed. Ready for download.");
                    }, 'image/png');
                }
            };
            
            img.onerror = () => {
                setError("Failed to load page image.");
                setIsSavingImage(false);
            };
            
            img.src = pageUrl;

        } catch (err: any) {
            console.error("Save Image Error:", err);
            setError(err.message);
            setIsSavingImage(false);
        }
    };

    // 3. Advance Spell Check
    const formatBackendResponse = (analysisData: any) => {
        const segments: AnalyzedSegment[] = analysisData.segments || [];
        let hateCount = 0;
        segments.forEach(seg => { if (seg.is_hate) hateCount++; });
        return {
            success: true,
            segments: segments,
            summary: { hateSpeechCount: hateCount, totalAnalyzed: segments.length }
        };
    };

    const handleAdvanceSpellCheck = async () => {
        console.log("🚀 STARTING SCAN...");
        setIsProcessing(true);
        setError(null);
        setMlResults(null);
        setRawOcrText("");
        setRawDocText("");

        try {
            // STEP 1: OCR SCAN
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
            } catch (e) { console.warn("OCR Skipped/Failed:", e); }

            // STEP 2: DOCUMENT TEXT (DISABLED TO PREVENT DUPLICATES)
            // We intentionally skip extracting text nodes so we don't send the same text twice.
            /* let docTxt = "";
            try {
                const extractionResult = await sandboxProxy.extractText();
                if (extractionResult.success) {
                    docTxt = extractionResult.textElements.join(' ');
                    setRawDocText(docTxt);
                }
            } catch (e) { console.warn("Doc Text Extraction Failed:", e); }
            */

            // STEP 3: ANALYZE (Send ONLY OCR Text)
            if (!ocrTxt) throw new Error("No text found in OCR layer.");

            // Use only the OCR result
            const combinedText = ocrTxt.trim();

            const analysisRes = await fetch("http://localhost:3000/analyze-hate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: combinedText })
            });

            if (!analysisRes.ok) throw new Error(await analysisRes.text());
            const analysisData = await analysisRes.json();
            const formatted = formatBackendResponse(analysisData);
            setMlResults(formatted);
            setViewMode('analysis');

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
                    {/* SECTION 1: SCANNER */}
                    <div className="scanner-panel">
                        <h2>Advance Spell Check</h2>
                        <p>Scans images (OCR) and text layers for hate speech.</p>

                        <div className="button-group">
                            <Button size="m" onClick={handleAdvanceSpellCheck} disabled={isProcessing} variant="cta">
                                {isProcessing ? "🔍 Scanning..." : "✨ Run Scan"}
                            </Button>
                        </div>

                        {!isProcessing && (rawOcrText || rawDocText) && (
                            <div style={{ marginTop: "20px", borderBottom: "1px solid #ddd" }}>
                                <button onClick={() => setViewMode('analysis')} style={{ padding: "8px 15px", marginRight: "10px", fontWeight: viewMode==='analysis'?'bold':'normal', borderBottom: viewMode==='analysis'?"2px solid blue":"none", background:"none", border:"none", cursor:"pointer"}}>🛡️ Analysis Results</button>
                                <button onClick={() => setViewMode('raw')} style={{ padding: "8px 15px", fontWeight: viewMode==='raw'?'bold':'normal', borderBottom: viewMode==='raw'?"2px solid blue":"none", background:"none", border:"none", cursor:"pointer"}}>📝 Raw Text Data</button>
                            </div>
                        )}

                        {error && <div className="error-message" style={{color: "red", marginTop: "10px"}}>{error}</div>}

                        {viewMode === 'analysis' && mlResults && (
                            <div style={{ marginTop: "15px" }}>
                                <div style={{ marginBottom: "20px", padding: "10px", borderRadius: "6px", backgroundColor: mlResults.summary.hateSpeechCount > 0 ? "#ffebee" : "#e8f5e9", color: mlResults.summary.hateSpeechCount > 0 ? "#c62828" : "#2e7d32", fontWeight: "bold", textAlign: "center" }}>
                                    {mlResults.summary.hateSpeechCount > 0 ? `⚠️ Found ${mlResults.summary.hateSpeechCount} Flagged Item(s)` : "✅ No Hate Speech Detected"}
                                </div>
                                {mlResults.summary.hateSpeechCount > 0 && (
                                    <div style={{ marginBottom: "25px", border: "1px solid #ef9a9a", borderRadius: "6px", overflow: "hidden" }}>
                                        <div style={{ backgroundColor: "#ffebee", padding: "8px 12px", borderBottom: "1px solid #ef9a9a", fontWeight: "bold", color: "#b71c1c", fontSize: "14px" }}>🚩 Flagged Content Details</div>
                                        <div style={{ maxHeight: "200px", overflowY: "auto", backgroundColor: "white" }}>
                                            {mlResults.segments.filter((s: AnalyzedSegment) => s.is_hate).map((seg: AnalyzedSegment, idx: number) => (
                                                <div key={idx} style={{ padding: "10px", borderBottom: "1px solid #eee", display: "flex", flexDirection: "column", gap: "5px" }}>
                                                    <div style={{ fontSize: "14px", color: "#333", fontWeight: "500" }}>"{seg.text}"</div>
                                                    <div style={{ display: "flex", gap: "10px", fontSize: "12px" }}>
                                                        <span style={{ backgroundColor: "#ffcdd2", color: "#b71c1c", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>{seg.label}</span>
                                                        <span style={{ color: "#666", alignSelf: "center" }}>Confidence: {(seg.confidence * 100).toFixed(1)}%</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {viewMode === 'raw' && (
                            <div style={{ marginTop: "15px" }}>
                                <div><strong>OCR Text:</strong><div style={{ backgroundColor: "#f4f4f4", padding: "10px", fontSize: "12px" }}>{rawOcrText || "(None)"}</div></div>
                            </div>
                        )}
                    </div>

                    {/* SECTION 2: TEMPLATE DISCLAIMER */}
                    <div className="scanner-panel" style={{ marginTop: "40px", paddingTop: "20px", borderTop: "2px solid #e0e0e0" }}>
                        <h2>⚖️ Auto Disclaimer</h2>
                        <p>Insert localized legal text instantly.</p>
                        <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", marginBottom: "4px" }}>Language:</label>
                                <select value={discLang} onChange={(e) => setDiscLang(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}>
                                    {Object.keys(DISCLAIMER_TEMPLATES).map(lang => (<option key={lang} value={lang}>{lang}</option>))}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", marginBottom: "4px" }}>Type:</label>
                                <select value={discType} onChange={(e) => setDiscType(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}>
                                    {Object.keys(DISCLAIMER_TEMPLATES["English"]).map(type => (<option key={type} value={type}>{type}</option>))}
                                </select>
                            </div>
                        </div>
                        <div style={{ padding: "10px", backgroundColor: "#f5f5f5", borderRadius: "6px", border: "1px solid #ddd", marginBottom: "15px" }}>
                            <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>Preview:</div>
                            <textarea value={discText} onChange={(e) => setDiscText(e.target.value)} style={{ width: "100%", height: "80px", padding: "8px", fontSize: "13px", borderRadius: "4px", border: "1px solid #ccc", fontFamily: "inherit", resize: "vertical" }}/>
                        </div>
                        <Button size="m" variant="cta" onClick={handleInsertDisclaimer} style={{ width: "100%" }}>⬇️ Insert into Document</Button>
                    </div>

                    {/* SECTION 3: SAVE SELECTION */}
                    <div className="scanner-panel" style={{ marginTop: "40px", paddingTop: "20px", borderTop: "2px solid #e0e0e0" }}>
                        <h2>💾 Save Selection</h2>
                        <p>Select an image on the canvas and click below.</p>
                        
                        <Button 
                            size="m" 
                            onClick={handleSaveSelectedImage} 
                            disabled={isSavingImage}
                            style={{ width: "100%" }}
                            variant="secondary"
                        >
                            {isSavingImage ? "Processing..." : "✂️ Crop & Prepare"}
                        </Button>
                        
                        {/* THE FIX: Manual HTML Link for Download */}
                        {downloadUrl && !isSavingImage && (
                            <div style={{ marginTop: "15px", padding: "10px", backgroundColor: "#e3f2fd", borderRadius: "6px", textAlign: "center" }}>
                                <div style={{ marginBottom: "8px", fontSize: "12px", color: "#0d47a1" }}>Image is ready!</div>
                                
                                <a 
                                    href={downloadUrl} 
                                    download={`extracted-image-${Date.now()}.png`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ 
                                        display: "block",
                                        width: "100%",
                                        padding: "10px 0",
                                        backgroundColor: "#0265DC", 
                                        color: "white",
                                        textDecoration: "none",
                                        borderRadius: "16px",
                                        fontWeight: "bold",
                                        fontSize: "14px",
                                        cursor: "pointer",
                                        border: "none",
                                        boxSizing: "border-box"
                                    }}
                                >
                                    ⬇️ Save to Computer
                                </a>

                                <div style={{ marginTop: "10px", fontSize: "11px", color: "#666" }}>
                                    (If download doesn't start, right-click button &gt; "Save Link As")
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