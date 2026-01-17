import React, { useState, useEffect } from "react";
import { Theme } from "@swc-react/theme";
import copyrightIcon from "../../Assets/Vector.svg";
import proofreadIcon from "../../Assets/Vector-1.svg";
import legalIcon from "../../Assets/Vector-2.svg";
import menuIcon from "../../Assets/Vector-3.svg";
import checkIcon from "../../Assets/icon-park-solid_correct.svg";
import cancelIcon from "../../Assets/flat-color-icons_cancel.svg";
import copyIcon from "../../Assets/solar_copy-bold.svg";
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
    
    // Brand Compliance State
    const [brandFile, setBrandFile] = useState<File | null>(null);
    const [brandAnalysis, setBrandAnalysis] = useState<string | null>(null);
    
    // Image Positions State
    const [imagePositions, setImagePositions] = useState<any>(null);

    // Navigation State
    const [activeTab, setActiveTab] = useState<'copyright' | 'proofread' | 'legal' | 'brand' | 'menu'>('proofread');

    // Disclaimer State
    const [disclaimerLanguage, setDisclaimerLanguage] = useState<string>("English");
    const [disclaimerText, setDisclaimerText] = useState<string>("");
    
    // Disclaimer Templates by Language
    const disclaimerTemplates: Record<string, string> = {
        "English": "The information provided is for general informational purposes only. All information is provided in good faith, however we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability or completeness of any information.",
        "Spanish": "La información proporcionada es solo para fines informativos generales. Toda la información se proporciona de buena fe, sin embargo, no hacemos ninguna representación o garantía de ningún tipo, expresa o implícita, con respecto a la precisión, adecuación, validez, confiabilidad, disponibilidad o integridad de cualquier información.",
        "French": "Les informations fournies sont uniquement à titre informatif. Toutes les informations sont fournies de bonne foi, cependant nous ne faisons aucune déclaration ou garantie d'aucune sorte, expresse ou implicite, concernant l'exactitude, l'adéquation, la validité, la fiabilité, la disponibilité ou l'exhaustivité de toute information.",
        "German": "Die bereitgestellten Informationen dienen nur allgemeinen Informationszwecken. Alle Informationen werden nach bestem Wissen und Gewissen bereitgestellt, jedoch geben wir keine Zusicherungen oder Garantien jeglicher Art, weder ausdrücklich noch stillschweigend, bezüglich der Genauigkeit, Angemessenheit, Gültigkeit, Zuverlässigkeit, Verfügbarkeit oder Vollständigkeit der Informationen."
    };

    useEffect(() => {
        if (disclaimerTemplates[disclaimerLanguage]) {
            setDisclaimerText(disclaimerTemplates[disclaimerLanguage]);
        }
    }, [disclaimerLanguage]);

    // --- HELPER: FORMATTING ---
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

    // --- 1. BRAND COMPLIANCE FUNCTION ---
    const handleBrandComplianceCheck = async () => {
        if (!brandFile) {
            setError("Please upload your Brand Guidelines PDF first.");
            return;
        }

        console.log("🚀 Starting Brand Compliance Check...");
        setIsProcessing(true);
        setError(null);
        setBrandAnalysis(null);

        try {
            // Step A: Capture Screenshot
            if (!addOnUISdk.app.document.createRenditions) throw new Error("Renditions API not available");
            const renditionResults = await addOnUISdk.app.document.createRenditions(
                { range: "currentPage", format: "image/png" },
                addOnUISdk.constants.RenditionIntent.export
            );
            if (!renditionResults?.[0]?.blob) throw new Error("Failed to capture screenshot");
            const screenshotBlob = renditionResults[0].blob;

            // Step B: Prepare Data
            const formData = new FormData();
            formData.append("guidelines", brandFile);
            formData.append("image", screenshotBlob, "design.png");

            // Step C: Send to Server
            const res = await fetch("http://localhost:3000/analyze-brand-compliance", {
                method: "POST",
                body: formData
            });

            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            
            console.log("✅ Brand Analysis Received");
            setBrandAnalysis(data.analysis);

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Brand analysis failed.");
        } finally {
            setIsProcessing(false);
        }
    };

    // --- 2. SCREENSHOT / COPYRIGHT FUNCTION ---
    const handleScreenshot = async () => {
        try {
            if (!addOnUISdk.app.document.createRenditions) throw new Error("Renditions API not available");
            const renditionResults = await addOnUISdk.app.document.createRenditions(
                { range: "currentPage", format: "image/png" },
                addOnUISdk.constants.RenditionIntent.export
            );
            if (!renditionResults?.[0]?.blob) throw new Error("Rendition failed");
            const blob = renditionResults[0].blob;
            const filename = `screenshot-${Date.now()}.png`;

            // Get image positions
            try {
                const result = await sandboxProxy.getAllImagePositions();
                setImagePositions(result);
                
                if (result.success && result.images.length > 0) {
                    console.log(`Found ${result.count} images. Uploading for crop...`);
                    const formData = new FormData();
                    formData.append("image", blob, filename);
                    formData.append("image_positions", JSON.stringify(result.images));

                    const cropResponse = await fetch("http://localhost:3000/crop-images", {
                        method: "POST",
                        body: formData
                    });

                    if (cropResponse.ok) {
                        const cropResult = await cropResponse.json();
                        console.log(`✅ Successfully cropped ${cropResult.cropped_count} images.`);
                    }
                } else {
                    console.log("No images to crop.");
                }
            } catch (imgErr) { console.warn(imgErr); }
            setError(null);
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        }
    };

    // --- 3. PROOFREAD FUNCTION (OCR Only) ---
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
            } catch (e) { console.warn("OCR Failed:", e); }

            // STEP 2: ANALYZE (Using ONLY OCR Text to avoid duplicates)
            const combinedText = ocrTxt.trim(); 
            if (!combinedText) throw new Error("No text found in OCR layer.");

            const analysisRes = await fetch("http://localhost:3000/analyze-hate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: combinedText })
            });

            if (!analysisRes.ok) throw new Error(await analysisRes.text());
            const analysisData = await analysisRes.json();
            const formatted = formatBackendResponse(analysisData);
            
            // Underline Logic
            try {
                const hatefulSegments = formatted.segments.filter((seg: AnalyzedSegment) => seg.is_hate);
                if (sandboxProxy.underlineHatefulWords) await sandboxProxy.underlineHatefulWords(hatefulSegments);
            } catch (e) { console.warn("Underline failed:", e); }
            
            setMlResults(formatted);
            setActiveTab('proofread');

        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const hatefulText = mlResults 
        ? mlResults.segments.filter((seg: AnalyzedSegment) => seg.is_hate).map((seg: AnalyzedSegment) => seg.text).join('\n')
        : '';

    return (
        <Theme system="express" scale="medium" color="light">
            <div className="pocket-legal-container">
                <div className="pocket-legal-content">
                    <div className="pocket-legal-header">
                        <div className="header-left">
                            <div className="logo-placeholder"></div>
                            <h1 className="app-title">Pocket Legal</h1>
                        </div>
                    </div>

                    <div className="pocket-legal-nav-wrapper">
                        <div className="pocket-legal-nav">
                            <button className={`nav-icon ${activeTab === 'copyright' ? 'active' : ''}`} onClick={() => setActiveTab('copyright')}>
                                <img src={copyrightIcon} alt="Copyright" />
                            </button>
                            <button className={`nav-icon ${activeTab === 'proofread' ? 'active' : ''}`} onClick={() => setActiveTab('proofread')}>
                                <img src={proofreadIcon} alt="Proofread" />
                            </button>
                            <button className={`nav-icon ${activeTab === 'legal' ? 'active' : ''}`} onClick={() => setActiveTab('legal')}>
                                <img src={legalIcon} alt="Legal" />
                            </button>
                            <button className={`nav-icon ${activeTab === 'brand' ? 'active' : ''}`} onClick={() => setActiveTab('brand')} title="Brand Safety">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 15L8.5 11.5M12 15L15.5 11.5M12 15V3M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </button>
                            <button className={`nav-icon ${activeTab === 'menu' ? 'active' : ''}`} onClick={() => setActiveTab('menu')}>
                                <img src={menuIcon} alt="Menu" />
                            </button>
                        </div>
                    </div>

                    <div className="pocket-legal-section">
                        <div className="section-title">
                            {activeTab === 'copyright' && 'Copyright'}
                            {activeTab === 'proofread' && 'Proofread'}
                            {activeTab === 'legal' && 'Legal'}
                            {activeTab === 'brand' && 'Brand Safety'}
                            {activeTab === 'menu' && 'Menu'}
                        </div>

                        {/* BRAND SAFETY TAB */}
                        {activeTab === 'brand' && (
                            <div className="brand-content">
                                <div className="brand-upload-section">
                                    <p className="instruction-text">Upload Brand Guidelines (PDF) to check compliance.</p>
                                    <input 
                                        type="file" 
                                        accept="application/pdf"
                                        className="file-input"
                                        onChange={(e) => setBrandFile(e.target.files ? e.target.files[0] : null)}
                                    />
                                    {brandFile && <p className="file-name">📄 {brandFile.name}</p>}
                                    <button 
                                        className="refresh-button"
                                        onClick={handleBrandComplianceCheck}
                                        disabled={isProcessing || !brandFile}
                                        style={{width: '100%', marginTop: '15px'}}
                                    >
                                        {isProcessing ? "Analyzing..." : "🔍 Check Compliance"}
                                    </button>
                                </div>
                                {error && <div className="error-message">{error}</div>}
                                {brandAnalysis && (
                                    <div className="analysis-result">
                                        <h3>Report</h3>
                                        <div className="analysis-text">
                                            {brandAnalysis.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* PROOFREAD TAB */}
                        {activeTab === 'proofread' && (
                            <div className="proofread-content">
                                {isProcessing && <div className="processing-message">🔍 Scanning document...</div>}
                                {error && <div className="error-message">{error}</div>}
                                {!isProcessing && mlResults && (
                                    mlResults.summary.hateSpeechCount === 0 ? (
                                        <div className="status-container clean">
                                            <div className="status-icon clean"><img src={checkIcon} alt="Clean" className="check-icon" /></div>
                                            <p className="status-message clean">No hate speech detected!</p>
                                        </div>
                                    ) : (
                                        <div className="status-container issues">
                                            <div className="status-icon issues"><img src={cancelIcon} alt="Cancel" className="cancel-icon" /></div>
                                            <p className="status-message issues">Issues Found. Please review.</p>
                                            <textarea className="proofread-textarea" readOnly value={hatefulText} spellCheck={false} />
                                        </div>
                                    )
                                )}
                                {!isProcessing && !mlResults && !error && (
                                    <div className="status-container clean">
                                        <p className="status-message clean">Click Refresh to scan your document.</p>
                                        <button className="refresh-button" onClick={handleAdvanceSpellCheck}>Refresh</button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* COPYRIGHT TAB */}
                        {activeTab === 'copyright' && (
                            <div className="copyright-content" style={{textAlign: 'center', paddingTop: '20px'}}>
                                <button className="screenshot-button" onClick={handleScreenshot} disabled={isProcessing} style={{width: '100%'}}>
                                    📸 Scan for Logos (Crop)
                                </button>
                                <p style={{marginTop: '15px', color: '#666', fontSize: '13px'}}>Scans canvas for images and checks for logos.</p>
                            </div>
                        )}

                        {/* LEGAL TAB */}
                        {activeTab === 'legal' && (
                            <div className="auto-disclaimer-content">
                                <div className="disclaimer-header">
                                    <h3 className="disclaimer-title">Auto - Disclaimer</h3>
                                    <button className="copy-button" onClick={() => navigator.clipboard.writeText(disclaimerText)}>
                                        <img src={copyIcon} alt="Copy" className="copy-icon" />
                                    </button>
                                </div>
                                <div className="disclaimer-language-selector">
                                    <label className="language-label">Language:</label>
                                    <select className="language-dropdown" value={disclaimerLanguage} onChange={(e) => setDisclaimerLanguage(e.target.value)}>
                                        {Object.keys(disclaimerTemplates).map(lang => <option key={lang} value={lang}>{lang}</option>)}
                                    </select>
                                </div>
                                <textarea className="disclaimer-textarea" value={disclaimerText} readOnly />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Theme>
    );
};

export default App;