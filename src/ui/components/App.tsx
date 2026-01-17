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

    // Navigation State
    const [activeTab, setActiveTab] = useState<'copyright' | 'proofread' | 'legal' | 'menu'>('proofread');

    // Disclaimer State
    const [disclaimerLanguage, setDisclaimerLanguage] = useState<string>("English");
    
    // Disclaimer Templates by Language
    const disclaimerTemplates: Record<string, string> = {
        "English": "The information provided is for general informational purposes only. All information is provided in good faith, however we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability or completeness of any information.",
        "Spanish": "La información proporcionada es solo para fines informativos generales. Toda la información se proporciona de buena fe, sin embargo, no hacemos ninguna representación o garantía de ningún tipo, expresa o implícita, con respecto a la precisión, adecuación, validez, confiabilidad, disponibilidad o integridad de cualquier información.",
        "French": "Les informations fournies sont uniquement à titre informatif. Toutes les informations sont fournies de bonne foi, cependant nous ne faisons aucune déclaration ou garantie d'aucune sorte, expresse ou implicite, concernant l'exactitude, l'adéquation, la validité, la fiabilité, la disponibilité ou l'exhaustivité de toute information.",
        "German": "Die bereitgestellten Informationen dienen nur allgemeinen Informationszwecken. Alle Informationen werden nach bestem Wissen und Gewissen bereitgestellt, jedoch geben wir keine Zusicherungen oder Garantien jeglicher Art, weder ausdrücklich noch stillschweigend, bezüglich der Genauigkeit, Angemessenheit, Gültigkeit, Zuverlässigkeit, Verfügbarkeit oder Vollständigkeit der Informationen."
    };

    const [disclaimerText, setDisclaimerText] = useState<string>(disclaimerTemplates["English"]);

    // Update disclaimer text when language changes
    useEffect(() => {
        if (disclaimerTemplates[disclaimerLanguage]) {
            setDisclaimerText(disclaimerTemplates[disclaimerLanguage]);
        }
    }, [disclaimerLanguage]);

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

    // --- SCREENSHOT FUNCTION ---
    const handleScreenshot = async () => {
        try {
            if (!addOnUISdk.app.document.createRenditions) {
                throw new Error("Renditions API is not available");
            }

            // Create rendition of current page as PNG
            const renditionResults = await addOnUISdk.app.document.createRenditions(
                { range: "currentPage", format: "image/png" },
                addOnUISdk.constants.RenditionIntent.export
            );
              console.log("Full results:", renditionResults);
            if (!renditionResults?.[0]?.blob || renditionResults[0].blob.size === 0) {
                throw new Error("Rendition failed: empty or invalid blob");
            }
            const blob = renditionResults[0].blob;

            // const blob = renditionResults[0].blob;
            console.log("blob", blob);

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `screenshot-${timestamp}.png`;

            // Try to use File System Access API - prefer folder picker, fallback to save file picker
            if ('showDirectoryPicker' in window || 'showSaveFilePicker' in window) {
                try {
                    let dirHandle: any = null;
                    let fileHandle: any = null;

                    // First, try folder picker (allows user to choose folder)
                    if ('showDirectoryPicker' in window) {
                        try {
                            // @ts-ignore - File System Access API
                            dirHandle = await window.showDirectoryPicker();
                            
                            // Create file in the selected directory
                            fileHandle = await dirHandle.getFileHandle(filename, { create: true });
                            
                            const writable = await fileHandle.createWritable();
                            await writable.write(blob);
                            await writable.close();
                            
                            // Try to show the folder name
                            const folderName = dirHandle.name || 'selected folder';
                            console.log(`Screenshot saved: ${folderName}/${filename}`);
                            setError(null);
                            return;
                        } catch (dirErr: any) {
                            // User cancelled folder picker, try save file picker instead
                            if (dirErr.name !== 'AbortError') {
                                console.warn("Folder picker failed, trying save file picker:", dirErr);
                            } else {
                                // User cancelled
                                console.log("Screenshot save cancelled");
                                return;
                            }
                        }
                    }

                    // Fallback: Use save file picker (lets user choose folder and filename)
                    if (!fileHandle && 'showSaveFilePicker' in window) {
                        // @ts-ignore - File System Access API
                        fileHandle = await window.showSaveFilePicker({
                            suggestedName: filename,
                            types: [{
                                description: 'PNG Image',
                                accept: { 'image/png': ['.png'] }
                            }]
                        });

                        const writable = await fileHandle.createWritable();
                        await writable.write(blob);
                        await writable.close();

                        // Try to get directory info
                        try {
                            // @ts-ignore
                            const parentDirHandle = await fileHandle.getParent?.();
                            if (parentDirHandle && parentDirHandle.name) {
                                console.log(`Screenshot saved to: ${parentDirHandle.name}/${fileHandle.name}`);
                            } else {
                                console.log(`Screenshot saved: ${fileHandle.name}`);
                            }
                        } catch (e) {
                            console.log(`Screenshot saved: ${fileHandle.name}`);
                        }
                        
                        setError(null);
                        return;
                    }
                } catch (err: any) {
                    // User cancelled the save dialog, just return
                    if (err.name === 'AbortError') {
                        console.log("Screenshot save cancelled");
                        return;
                    }
                    // If File System Access API fails, fall back to download method
                    console.warn("File System Access API failed, falling back to download:", err);
                }
            }

            // Fallback: Use browser download (standard method)
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);

            // Note: Browser download path is in the default Downloads folder
            // Common locations:
            // Linux: ~/Downloads/
            // Windows: C:\Users\<username>\Downloads\
            // macOS: ~/Downloads/
            const osType = navigator.platform.toLowerCase();
            let defaultPath = "your browser's default Downloads folder";
            if (osType.includes('linux')) {
                defaultPath = `~/Downloads/${filename}`;
            } else if (osType.includes('win')) {
                defaultPath = `C:\\Users\\<YourUsername>\\Downloads\\${filename}`;
            } else if (osType.includes('mac')) {
                defaultPath = `~/Downloads/${filename}`;
            }

            // Note: JavaScript cannot determine the actual download path due to browser security.
            // The file is saved to your browser's configured download folder.
            // Check your browser's downloads folder or use the browser's download manager to see the exact location.
            console.log(`Screenshot saved: ${filename}`);
            console.log(`⚠️  Note: Check your browser's download folder for the actual location.`);
            console.log(`   Common locations:`);
            console.log(`   - Linux: ~/Downloads/ or check browser settings`);
            console.log(`   - Check browser's download history/manager to see exact path`);
            setError(null);
        } catch (err: any) {
            console.error("Screenshot failed:", err);
            setError(`Screenshot failed: ${err.message}`);
        }
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
            
            // Filter hateful segments for underlining
            const hatefulSegments = formatted.segments.filter((seg: AnalyzedSegment) => seg.is_hate);
            
            // Call underline function in sandbox
            try {
                await sandboxProxy.underlineHatefulWords(hatefulSegments);
            } catch (e) {
                console.warn("Failed to underline hateful words:", e);
            }
            
            setMlResults(formatted);
            setActiveTab('proofread'); // Switch to proofread tab

        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    // Get hateful text for display
    const hatefulText = mlResults 
        ? mlResults.segments
            .filter((seg: AnalyzedSegment) => seg.is_hate)
            .map((seg: AnalyzedSegment) => seg.text)
            .join('\n')
        : '';

    return (
        <Theme system="express" scale="medium" color="light">
            <div className="pocket-legal-container">
                <div className="pocket-legal-content">
                    {/* Header Section */}
                    <div className="pocket-legal-header">
                        <div className="header-left">
                            <div className="logo-placeholder"></div>
                            <h1 className="app-title">Pocket Legal</h1>
                        </div>
                        
                        <div className="header-bottom">
                            <div className="header-buttons">
                                <button 
                                    className="refresh-button"
                                    onClick={handleAdvanceSpellCheck} 
                                    disabled={isProcessing}
                                >
                                    <svg className="refresh-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M20 11C19.7554 9.24021 18.9391 7.60966 17.6766 6.35949C16.4142 5.10933 14.7758 4.30891 13.0137 4.08155C11.2516 3.85418 9.46362 4.21248 7.9252 5.10124C6.38678 5.99001 5.18325 7.35993 4.5 9M4 5V9H8M4 13C4.24456 14.7598 5.06093 16.3903 6.32336 17.6405C7.58579 18.8907 9.22424 19.6911 10.9863 19.9184C12.7484 20.1458 14.5364 19.7875 16.0748 18.8988C17.6132 18.01 18.8168 16.6401 19.5 15M20 19V15H16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <span>Refresh</span>
                                </button>
                                <button 
                                    className="screenshot-button"
                                    onClick={handleScreenshot}
                                    disabled={isProcessing}
                                    title="Take screenshot of current page"
                                >
                                    <svg className="screenshot-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M3 9C3 7.89543 3.89543 7 5 7H5.92963C6.59834 7 7.2228 6.6658 7.59373 6.1094L8.40627 4.8906C8.7772 4.3342 9.40166 4 10.0704 4H14C15.1046 4 16 4.89543 16 6V7M3 9V18C3 19.1046 3.89543 20 5 20H19C20.1046 20 21 19.1046 21 18V9C21 7.89543 20.1046 7 19 7H5C3.89543 7 3 7.89543 3 9Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        <circle cx="12" cy="13" r="3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <span>Screenshot</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Bar */}
                    <div className="pocket-legal-nav-wrapper">
                        <div className="pocket-legal-nav">
                            <button 
                                className={`nav-icon ${activeTab === 'copyright' ? 'active' : ''}`}
                                onClick={() => setActiveTab('copyright')}
                            >
                                <img src={copyrightIcon} alt="Copyright" />
                            </button>
                            <button 
                                className={`nav-icon ${activeTab === 'proofread' ? 'active' : ''}`}
                                onClick={() => setActiveTab('proofread')}
                            >
                                <img src={proofreadIcon} alt="Proofread" />
                            </button>
                            <button 
                                className={`nav-icon ${activeTab === 'legal' ? 'active' : ''}`}
                                onClick={() => setActiveTab('legal')}
                            >
                                <img src={legalIcon} alt="Legal" />
                            </button>
                            <button 
                                className={`nav-icon ${activeTab === 'menu' ? 'active' : ''}`}
                                onClick={() => setActiveTab('menu')}
                            >
                                <img src={menuIcon} alt="Menu" />
                            </button>
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="pocket-legal-section">
                        {/* Tab Title */}
                        <div className="section-title">
                            {activeTab === 'copyright' && 'Copyright'}
                            {activeTab === 'proofread' && 'Proofread'}
                            {activeTab === 'legal' && 'Legal'}
                            {activeTab === 'menu' && 'Menu'}
                        </div>

                        {/* Proofread Content */}
                        {activeTab === 'proofread' && (
                            <div className="proofread-content">
                                {isProcessing && (
                                    <div className="processing-message">
                                        🔍 Scanning document...
                                    </div>
                                )}

                                {error && <div className="error-message">{error}</div>}

                                {!isProcessing && mlResults && (
                                    <>
                                        {mlResults.summary.hateSpeechCount === 0 ? (
                                            // Clean State
                                            <div className="status-container clean">
                                                <div className="status-icon clean">
                                                    <img src={checkIcon} alt="Clean" className="check-icon" />
                                                </div>
                                                <p className="status-message clean">
                                                    No hate speech or offensive language detected. Your content is clean and you are good to go!
                                                </p>
                                            </div>
                                        ) : (
                                            // Issues Found State
                                            <div className="status-container issues">
                                                <div className="status-icon issues">
                                                    <img src={cancelIcon} alt="Cancel" className="cancel-icon" />
                                                </div>
                                                <p className="status-message issues">
                                                    Hate speech or offensive<br />
                                                    language detected.<br />
                                                    Please review your content.
                                                </p>
                                                <textarea 
                                                    className="proofread-textarea"
                                                    readOnly
                                                    value={hatefulText}
                                                    placeholder="Hateful content will appear here..."
                                                    spellCheck={false}
                                                />
                                            </div>
                                        )}
                                    </>
                                )}

                                {!isProcessing && !mlResults && !error && (
                                    <div className="status-container clean">
                                        <div className="status-icon clean">
                                            <img src={checkIcon} alt="Clean" className="check-icon" />
                                        </div>
                                        <p className="status-message clean">
                                            Click Refresh to scan your document for hate speech and offensive language.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Legal Tab - Auto Disclaimer */}
                        {activeTab === 'legal' && (
                            <div className="auto-disclaimer-content">
                                <div className="disclaimer-header">
                                    <h3 className="disclaimer-title">Auto - Disclaimer</h3>
                                    <button 
                                        className="copy-button"
                                        onClick={async () => {
                                            try {
                                                await navigator.clipboard.writeText(disclaimerText);
                                                // Visual feedback - you could add a toast notification here
                                                console.log("Disclaimer copied to clipboard");
                                            } catch (err) {
                                                console.error("Failed to copy:", err);
                                                // Fallback for older browsers
                                                const textArea = document.createElement("textarea");
                                                textArea.value = disclaimerText;
                                                textArea.style.position = "fixed";
                                                textArea.style.left = "-999999px";
                                                document.body.appendChild(textArea);
                                                textArea.focus();
                                                textArea.select();
                                                try {
                                                    document.execCommand('copy');
                                                    console.log("Disclaimer copied to clipboard (fallback)");
                                                } catch (fallbackErr) {
                                                    console.error("Fallback copy failed:", fallbackErr);
                                                }
                                                document.body.removeChild(textArea);
                                            }
                                        }}
                                        title="Copy to clipboard"
                                    >
                                        <img src={copyIcon} alt="Copy" className="copy-icon" />
                                    </button>
                                </div>
                                <div className="disclaimer-language-selector">
                                    <label htmlFor="disclaimer-language" className="language-label">Language:</label>
                                    <select
                                        id="disclaimer-language"
                                        className="language-dropdown"
                                        value={disclaimerLanguage}
                                        onChange={(e) => setDisclaimerLanguage(e.target.value)}
                                    >
                                        {Object.keys(disclaimerTemplates).map((lang) => (
                                            <option key={lang} value={lang}>
                                                {lang}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <textarea
                                    className="disclaimer-textarea"
                                    value={disclaimerText}
                                    onChange={(e) => setDisclaimerText(e.target.value)}
                                    placeholder="Enter your disclaimer text here..."
                                    spellCheck={false}
                                />
                            </div>
                        )}

                        {/* Other Tabs Content Placeholder */}
                        {activeTab !== 'proofread' && activeTab !== 'legal' && (
                            <div className="tab-placeholder">
                                <p>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} section coming soon...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Theme>
    );
};

export default App;
