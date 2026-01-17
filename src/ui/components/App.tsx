import React, { useState, useEffect, useRef } from "react";
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
    const [activeTab, setActiveTab] = useState<'copyright' | 'proofread' | 'legal' | 'menu'>('copyright');

    // Ref for scrolling to textarea/div
    const textareaRef = useRef<HTMLDivElement>(null);

    // Disclaimer State
    const [disclaimerLanguage, setDisclaimerLanguage] = useState<string>("English");
    const [disclaimerType, setDisclaimerType] = useState<string>("General");
    const [disclaimerTypes, setDisclaimerTypes] = useState<string[]>([]);
    
    // Brand Kit State
    const [brandKitColors, setBrandKitColors] = useState<string[]>(['#FFFFFF', '#87CEEB', '#FFA500']);
    const [brandKitFonts, setBrandKitFonts] = useState<string[]>([]);
    const [isCheckingTheme, setIsCheckingTheme] = useState(false);
    const [themeMatchResult, setThemeMatchResult] = useState<'match' | 'suggestions' | null>(null);
    const [colorSuggestions, setColorSuggestions] = useState<Array<{from: string, to: string}>>([]);
    const [fontSuggestions, setFontSuggestions] = useState<Array<{from: string, to: string}>>([]);
    
    // Available fonts for dropdown
    const availableFonts = [
        'Arial',
        'Helvetica',
        'Times New Roman',
        'Courier New',
        'Verdana',
        'Georgia',
        'Palatino',
        'Garamond',
        'Comic Sans MS',
        'Trebuchet MS',
        'Arial Black',
        'Impact',
        'Tahoma',
        'Lucida Console',
        'Ubuntu',
        'Roboto',
        'Open Sans',
        'Lato',
        'Montserrat',
        'Playfair Display',
        'Oswald',
        'Raleway',
        'Source Sans Pro',
        'PT Sans',
        'Merriweather',
        'Poppins',
        'Nunito',
        'Fira Sans',
        'Inter',
        'Pacifico'
    ];
    
    // Disclaimer Templates by Language
    const disclaimerTemplates: Record<string, string> = {
        "English": "The information provided is for general informational purposes only. All information is provided in good faith, however we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability or completeness of any information.",
        "Spanish": "La información proporcionada es solo para fines informativos generales. Toda la información se proporciona de buena fe, sin embargo, no hacemos ninguna representación o garantía de ningún tipo, expresa o implícita, con respecto a la precisión, adecuación, validez, confiabilidad, disponibilidad o integridad de cualquier información.",
        "French": "Les informations fournies sont uniquement à titre informatif. Toutes les informations sont fournies de bonne foi, cependant nous ne faisons aucune déclaration ou garantie d'aucune sorte, expresse ou implicite, concernant l'exactitude, l'adéquation, la validité, la fiabilité, la disponibilité ou l'exhaustivité de toute information.",
        "German": "Die bereitgestellten Informationen dienen nur allgemeinen Informationszwecken. Alle Informationen werden nach bestem Wissen und Gewissen bereitgestellt, jedoch geben wir keine Zusicherungen oder Garantien jeglicher Art, weder ausdrücklich noch stillschweigend, bezüglich der Genauigkeit, Angemessenheit, Gültigkeit, Zuverlässigkeit, Verfügbarkeit oder Vollständigkeit der Informationen."
    };

    const [disclaimerText, setDisclaimerText] = useState<string>('');

    // Fetch disclaimer types from backend
    useEffect(() => {
        const fetchDisclaimerTypes = async () => {
            try {
                const response = await fetch('http://localhost:3000/disclaimer-types');
                if (response.ok) {
                    const data = await response.json();
                    const types = data.types || [];
                    setDisclaimerTypes(types);
                    // If no types are returned, use fallback
                    if (types.length === 0) {
                        setDisclaimerTypes(['General', 'Medical', 'Legal', 'Financial']);
                    }
                } else {
                    // If request fails, use fallback
                    setDisclaimerTypes(['General', 'Medical', 'Legal', 'Financial']);
                }
            } catch (error) {
                console.error('Failed to fetch disclaimer types:', error);
                // Fallback to default types immediately if fetch fails
                setDisclaimerTypes(['General', 'Medical', 'Legal', 'Financial', 'Custom']);
            }
        };
        fetchDisclaimerTypes();
    }, []);

    // Update disclaimer text when type or language changes
    useEffect(() => {
        const fetchDisclaimerText = async () => {
            if (!disclaimerType || !disclaimerLanguage) {
                return;
            }

            // For Custom type, don't fetch - user will enter their own text
            if (disclaimerType === 'Custom') {
                // Only clear if switching from another type to Custom for the first time
                // We'll use a different approach - don't clear on switch, let user edit
                return;
            }

            try {
                const url = `http://localhost:3000/disclaimer-template?type=${encodeURIComponent(disclaimerType)}&language=${encodeURIComponent(disclaimerLanguage)}`;
                console.log('Fetching disclaimer:', url);
                const response = await fetch(url);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('Received disclaimer data:', data);
                    if (data && data.text !== undefined) {
                        setDisclaimerText(data.text);
                        return;
                    } else {
                        console.warn('Backend response missing text field:', data);
                    }
                } else {
                    const errorText = await response.text();
                    console.warn('Backend response not ok, status:', response.status, response.statusText, errorText);
                }
            } catch (error: any) {
                console.error('Failed to fetch disclaimer template:', error.message || error);
            }
            
            // Fallback to local template (only General type available in local)
            if (disclaimerType === 'General' && disclaimerTemplates[disclaimerLanguage]) {
                console.log('Using local General template');
                setDisclaimerText(disclaimerTemplates[disclaimerLanguage]);
            } else {
                // For non-General types, backend is required
                console.warn(`Template not available locally for type: ${disclaimerType}, language: ${disclaimerLanguage}. Backend fetch may have failed.`);
                setDisclaimerText('');
            }
        };

        fetchDisclaimerText();
    }, [disclaimerType, disclaimerLanguage]);

    // Auto-scan on component mount
    useEffect(() => {
        // Trigger scan automatically when add-on loads
        handleAdvanceSpellCheck();
    }, []); // Empty dependency array means this runs once on mount

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

    // Function to highlight hateful words in full combined text (to avoid duplicates)
    const getHighlightedText = () => {
        if (!mlResults || (!rawOcrText && !rawDocText)) {
            return '<span style="color: #999;">Hateful content will appear here...</span>';
        }
        
        // Combine OCR and document text - this is the full original text
        const combinedText = `${rawOcrText}\n${rawDocText}`.trim();
        if (!combinedText) return '';
        
        const hatefulSegments = mlResults.segments.filter((seg: AnalyzedSegment) => seg.is_hate);
        if (hatefulSegments.length === 0) {
            // No hateful content, return plain text
            return combinedText.replace(/\n/g, '<br>');
        }
        
        // Remove duplicate segments (same text content, case-insensitive)
        const uniqueSegments: AnalyzedSegment[] = Array.from(
            new Map<string, AnalyzedSegment>(hatefulSegments.map(seg => [seg.text.toLowerCase().trim(), seg])).values()
        );
        
        // Escape HTML to prevent XSS
        let highlightedText = combinedText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        // Sort by length (longest first) to handle overlapping matches correctly
        const sortedSegments = [...uniqueSegments].sort((a, b) => b.text.length - a.text.length);
        
        // Track positions to avoid double highlighting
        const processedRanges: Array<{start: number, end: number}> = [];
        
        sortedSegments.forEach((seg: AnalyzedSegment) => {
            const segText = seg.text.trim();
            // Escape for regex and HTML
            const escapedForRegex = segText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const escapedForHTML = segText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const escapedForRegexHTML = escapedForHTML.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            const regex = new RegExp(escapedForRegexHTML, 'gi');
            let match;
            const matches: Array<{start: number, end: number, text: string}> = [];
            
            // Collect all matches first
            while ((match = regex.exec(highlightedText)) !== null) {
                matches.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    text: match[0]
                });
            }
            
            // Apply highlights from end to start to preserve indices
            matches.reverse().forEach(match => {
                // Check if this range overlaps with already processed ranges
                const overlaps = processedRanges.some(range => 
                    (match.start < range.end && match.end > range.start)
                );
                
                if (!overlaps) {
                    processedRanges.push({ start: match.start, end: match.end });
                    const before = highlightedText.substring(0, match.start);
                    const after = highlightedText.substring(match.end);
                    highlightedText = before + `<mark class="hateful-word-highlight">${match.text}</mark>` + after;
                }
            });
        });
        
        // Convert newlines to <br> tags for proper display
        highlightedText = highlightedText.replace(/\n/g, '<br>');
        
        return highlightedText;
    };

    // Handle Check Theme
    const handleCheckTheme = async () => {
        setIsCheckingTheme(true);
        setThemeMatchResult(null);
        setColorSuggestions([]);
        setFontSuggestions([]);

        try {
            // Extract colors and fonts from document
            const docData = await sandboxProxy.extractDocumentColorsAndFonts();
            
            if (!docData.success) {
                throw new Error(docData.error || 'Failed to extract document data');
            }

            const docColors = docData.colors || [];
            const docFonts = docData.fonts || [];

            console.log('Document colors:', docColors);
            console.log('Document fonts:', docFonts);
            console.log('Brand kit colors:', brandKitColors);
            console.log('Brand kit fonts:', brandKitFonts);

            // Compare colors - find closest matches
            const colorSuggestionsList: Array<{from: string, to: string}> = [];
            const matchedColors = new Set<string>();
            let allColorsMatch = true;
            
            // Only check if we have document colors AND brand kit colors
            if (docColors.length > 0 && brandKitColors.length > 0) {
                docColors.forEach((docColor: string) => {
                    const docColorUpper = docColor.toUpperCase();
                    // Check if color already matches a brand kit color (within stricter tolerance)
                    const matchesBrand = brandKitColors.some(brandColor => {
                        return colorsSimilar(docColorUpper, brandColor.toUpperCase(), 20); // Stricter tolerance
                    });
                    
                    if (!matchesBrand) {
                        allColorsMatch = false;
                        // Find closest brand kit color
                        const closest = findClosestColor(docColorUpper, brandKitColors);
                        if (closest && closest !== docColorUpper && !matchedColors.has(docColorUpper)) {
                            colorSuggestionsList.push({ from: docColorUpper, to: closest });
                            matchedColors.add(docColorUpper);
                        }
                    } else {
                        matchedColors.add(docColorUpper);
                    }
                });
            } else if (docColors.length > 0 && brandKitColors.length === 0) {
                // If document has colors but no brand kit colors are set, show mismatch
                allColorsMatch = false;
                docColors.forEach((docColor: string) => {
                    const docColorUpper = docColor.toUpperCase();
                    if (!matchedColors.has(docColorUpper)) {
                        colorSuggestionsList.push({ from: docColorUpper, to: '#000000' }); // Suggest a default
                        matchedColors.add(docColorUpper);
                    }
                });
            } else if (docColors.length === 0) {
                // No colors in document - cannot determine match, don't show match message
                allColorsMatch = false;
            }

            // Compare fonts - only if brand fonts are specified
            const fontSuggestionsList: Array<{from: string, to: string}> = [];
            const matchedFonts = new Set<string>();
            let allFontsMatch = true;
            
            const validBrandFonts = brandKitFonts.filter(f => f.trim() !== '');
            if (validBrandFonts.length > 0) {
                if (docFonts.length > 0) {
                    docFonts.forEach((docFont: string) => {
                        const docFontLower = docFont.toLowerCase().trim();
                        if (!docFontLower) return;
                        
                        const matchesBrand = validBrandFonts.some(brandFont => {
                            const brandFontLower = brandFont.toLowerCase().trim();
                            return fontsSimilar(docFontLower, brandFontLower);
                        });
                        
                        if (!matchesBrand) {
                            allFontsMatch = false;
                            if (!matchedFonts.has(docFontLower)) {
                                const closest = validBrandFonts[0];
                                fontSuggestionsList.push({ from: docFont, to: closest });
                                matchedFonts.add(docFontLower);
                            }
                        } else {
                            matchedFonts.add(docFontLower);
                        }
                    });
                }
            }

            console.log('Color suggestions:', colorSuggestionsList);
            console.log('Font suggestions:', fontSuggestionsList);
            console.log('All colors match:', allColorsMatch);
            console.log('All fonts match:', allFontsMatch);

            // Check for mismatches
            const hasColorMismatches = colorSuggestionsList.length > 0;
            const hasFontMismatches = fontSuggestionsList.length > 0;
            const hasAnyMismatch = hasColorMismatches || hasFontMismatches;
            
            // Only show match if:
            // 1. Document has colors AND all colors match brand kit colors
            // 2. If brand fonts are specified, all document fonts must match (or no fonts in document)
            const shouldShowMatch = 
                docColors.length > 0 && 
                allColorsMatch && 
                !hasColorMismatches && 
                (validBrandFonts.length === 0 || allFontsMatch) && 
                !hasFontMismatches;
            
            if (shouldShowMatch) {
                setThemeMatchResult('match');
            } else if (hasAnyMismatch) {
                // Show warning when there are mismatches
                setThemeMatchResult('suggestions');
                setColorSuggestions(colorSuggestionsList);
                setFontSuggestions(fontSuggestionsList);
            } else {
                // No document colors/fonts found or other case
                setThemeMatchResult('suggestions');
                setColorSuggestions(colorSuggestionsList);
                setFontSuggestions(fontSuggestionsList);
            }
        } catch (error: any) {
            console.error('Error checking theme:', error);
            setError(error.message || 'Failed to check theme');
        } finally {
            setIsCheckingTheme(false);
        }
    };

    // Handle Apply Suggestions
    const handleApplySuggestions = async () => {
        try {
            const suggestions = {
                colors: colorSuggestions.length > 0 ? colorSuggestions : undefined,
                fonts: fontSuggestions.length > 0 ? fontSuggestions : undefined
            };

            const result = await sandboxProxy.applyThemeSuggestions(suggestions);

            if (result.success) {
                // Reset suggestions and show match result
                setThemeMatchResult('match');
                setColorSuggestions([]);
                setFontSuggestions([]);
            } else {
                throw new Error(result.error || 'Failed to apply suggestions');
            }
        } catch (error: any) {
            console.error('Error applying suggestions:', error);
            setError(error.message || 'Failed to apply suggestions');
        }
    };

    // Helper: Check if colors are similar (within tolerance)
    const colorsSimilar = (color1: string, color2: string, tolerance: number): boolean => {
        const rgb1 = hexToRgb(color1);
        const rgb2 = hexToRgb(color2);
        if (!rgb1 || !rgb2) return false;
        
        // Use Euclidean distance for better color comparison
        const rDiff = rgb1.r - rgb2.r;
        const gDiff = rgb1.g - rgb2.g;
        const bDiff = rgb1.b - rgb2.b;
        const distance = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
        
        return distance <= tolerance;
    };

    // Helper: Find closest color from brand kit
    const findClosestColor = (targetColor: string, brandColors: string[]): string | null => {
        const targetRgb = hexToRgb(targetColor);
        if (!targetRgb || brandColors.length === 0) return null;

        let closest = brandColors[0];
        let minDiff = Infinity;

        brandColors.forEach(brandColor => {
            const brandRgb = hexToRgb(brandColor.toUpperCase());
            if (brandRgb) {
                const diff = Math.abs(targetRgb.r - brandRgb.r) + 
                           Math.abs(targetRgb.g - brandRgb.g) + 
                           Math.abs(targetRgb.b - brandRgb.b);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = brandColor.toUpperCase();
                }
            }
        });

        return closest;
    };

    // Helper: Check if fonts are similar
    const fontsSimilar = (font1: string, font2: string): boolean => {
        return font1.includes(font2) || font2.includes(font1) || font1 === font2;
    };

    // Helper: Convert hex to RGB
    const hexToRgb = (hex: string): {r: number, g: number, b: number} | null => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    };

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
                                    </div>
                            </div>

                    {/* Navigation Bar */}
                    <div className="pocket-legal-nav-wrapper">
                        <div className="pocket-legal-nav">
                            <button 
                                className={`nav-icon ${activeTab === 'copyright' ? 'active' : ''}`}
                                onClick={() => setActiveTab('copyright')}
                            >
                                <img src={copyrightIcon} alt="Trademark" />
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
                            {activeTab === 'copyright' && 'Trademark'}
                            {activeTab === 'proofread' && 'Proofread'}
                            {activeTab === 'legal' && 'Auto-Disclaimer'}
                            {activeTab === 'menu' && 'Brand Kit'}
                                    </div>

                        {/* Proofread Content */}
                        {activeTab === 'proofread' && (
                            <div className="proofread-content tab-content">
                                {isProcessing && (
                                    <div className="processing-message">
                                        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                                            <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                        </svg>
                                        <span>Scanning document...</span>
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
                                                <button
                                                    className="scroll-down-button"
                                                    onClick={() => {
                                                        textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                    }}
                                                    title="Scroll to content"
                                                >
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M12 5V19M12 19L19 12M12 19L5 12" stroke="#333333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    </svg>
                                                </button>
                                                <div 
                                                    ref={textareaRef as React.RefObject<HTMLDivElement>}
                                                    className="proofread-textarea"
                                                    dangerouslySetInnerHTML={{ __html: getHighlightedText() }}
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
                            <div className="auto-disclaimer-content tab-content">
                                <div className="disclaimer-header">
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
                                <div className="disclaimer-selectors">
                                    <div className="disclaimer-type-selector">
                                        <label htmlFor="disclaimer-type" className="language-label">Type:</label>
                                        <select
                                            id="disclaimer-type"
                                            className="language-dropdown"
                                            value={disclaimerType}
                                            onChange={(e) => setDisclaimerType(e.target.value)}
                                            disabled={disclaimerTypes.length === 0}
                                        >
                                            {disclaimerTypes.length === 0 ? (
                                                <option value="">Loading...</option>
                                            ) : (
                                                disclaimerTypes.map((type) => (
                                                    <option key={type} value={type}>
                                                        {type}
                                                    </option>
                                                ))
                                            )}
                                        </select>
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

                        {/* Brand Kit Tab (Menu) */}
                        {activeTab === 'menu' && (
                            <div className="brand-kit-content tab-content">
                                <div className="brand-kit-header">
                                    {themeMatchResult === 'suggestions' && (
                                        <button 
                                            className="close-suggestions-btn"
                                            onClick={() => {
                                                setThemeMatchResult(null);
                                                setColorSuggestions([]);
                                                setFontSuggestions([]);
                                            }}
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M18 6L6 18M6 6L18 18" stroke="#333333" strokeWidth="2" strokeLinecap="round"/>
                                            </svg>
                                        </button>
                        )}
                    </div>

                                {themeMatchResult === null && (
                                    <>
                                        {/* Theme Colors Section */}
                                        <div className="brand-kit-section">
                                            <h3 className="brand-kit-section-title">Choose Theme Colors:</h3>
                                            <div className="color-picker-container">
                                                {brandKitColors.map((color, index) => (
                                    <input
                                                        key={index}
                                                        type="color"
                                                        value={color}
                                                        onChange={(e) => {
                                                            const newColors = [...brandKitColors];
                                                            newColors[index] = e.target.value.toUpperCase();
                                                            setBrandKitColors(newColors);
                                                        }}
                                                        className="color-picker"
                                                    />
                                                ))}
                                                {brandKitColors.length < 10 && (
                                                    <button
                                                        className="add-color-btn"
                                                        onClick={() => setBrandKitColors([...brandKitColors, '#000000'])}
                                                    >
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M12 5V19M5 12H19" stroke="#333333" strokeWidth="2" strokeLinecap="round"/>
                                                        </svg>
                                                    </button>
                                                )}
                                </div>
                                </div>

                                        {/* Theme Fonts Section */}
                                        <div className="brand-kit-section">
                                            <h3 className="brand-kit-section-title">Choose Theme Fonts:</h3>
                                            <div className="font-input-container">
                                                {brandKitFonts.length === 0 ? (
                                                    <select
                                                        value=""
                                                        onChange={(e) => {
                                                            if (e.target.value) {
                                                                setBrandKitFonts([e.target.value]);
                                                            }
                                                        }}
                                                        className="font-dropdown"
                                                    >
                                                        <option value="">Select a font...</option>
                                                        {availableFonts.map((fontName) => (
                                                            <option key={fontName} value={fontName}>
                                                                {fontName}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    brandKitFonts.map((font, index) => (
                                                        <select
                                                            key={index}
                                                            value={font}
                                                            onChange={(e) => {
                                                                const newFonts = [...brandKitFonts];
                                                                newFonts[index] = e.target.value;
                                                                setBrandKitFonts(newFonts.filter(f => f !== ''));
                                                            }}
                                                            className="font-dropdown"
                                                        >
                                                            <option value="">Select a font...</option>
                                                            {availableFonts.map((fontName) => (
                                                                <option key={fontName} value={fontName}>
                                                                    {fontName}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ))
                                                )}
                                    <button
                                                    className="add-font-btn"
                                        onClick={() => {
                                                        if (brandKitFonts.length === 0) {
                                                            setBrandKitFonts(['']);
                                                        } else {
                                                            setBrandKitFonts([...brandKitFonts, '']);
                                                        }
                                                    }}
                                                >
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M12 5V19M5 12H19" stroke="#333333" strokeWidth="2" strokeLinecap="round"/>
                                                    </svg>
                                    </button>
                                </div>
                            </div>

                                        {/* Check Theme Button */}
                                        <button
                                            className="check-theme-btn"
                                            onClick={handleCheckTheme}
                                            disabled={isCheckingTheme || brandKitColors.length === 0}
                                        >
                                            {isCheckingTheme ? 'Checking...' : 'Check Theme match'}
                                        </button>
                                    </>
                                )}

                                {/* Theme Match Result */}
                                {themeMatchResult === 'match' && (
                                    <div className="theme-match-success">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M20 6L9 17L4 12" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                        <span>Design matches the theme</span>
                        </div>
                                )}

                                {/* Warning Message for Mismatches */}
                                {themeMatchResult === 'suggestions' && (colorSuggestions.length > 0 || fontSuggestions.length > 0) && (
                                    <>
                                        <div className="theme-warning-message">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#FF9800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                            <span>Theme or font not matched</span>
                                        </div>
                                        
                                        {/* Color Suggestions */}
                                        {colorSuggestions.length > 0 && (
                                            <div className="suggestions-section">
                                                <h3 className="brand-kit-section-title">Color suggestions:</h3>
                                                <div className="suggestions-list">
                                                    {colorSuggestions.map((suggestion, index) => (
                                                        <div key={index} className="suggestion-item">
                                                            <div 
                                                                className="color-circle" 
                                                                style={{ backgroundColor: suggestion.from }}
                                                                title={suggestion.from}
                                                            />
                                                            <span className="suggestion-arrow">→</span>
                                                            <div 
                                                                className="color-circle" 
                                                                style={{ backgroundColor: suggestion.to }}
                                                                title={suggestion.to}
                                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                                        {/* Font Suggestions */}
                                        {fontSuggestions.length > 0 && (
                                            <div className="suggestions-section">
                                                <h3 className="brand-kit-section-title">Font suggestions:</h3>
                                                <div className="font-suggestions-list">
                                                    {fontSuggestions.map((suggestion, index) => (
                                                        <div key={index} className="font-suggestion-item">
                                                            <input 
                                                                type="text" 
                                                                value={suggestion.from} 
                                                                readOnly 
                                                                className="font-suggestion-input"
                                                            />
                                                            <span className="suggestion-arrow">→</span>
                                                            <input 
                                                                type="text" 
                                                                value={suggestion.to} 
                                                                readOnly 
                                                                className="font-suggestion-input"
                                                            />
                            </div>
                                                    ))}
                                    </div>
                                    </div>
                                        )}

                                        {/* Apply Button */}
                                        <button
                                            className="apply-suggestions-btn"
                                            onClick={handleApplySuggestions}
                                        >
                                            apply
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Trademark Tab Content Placeholder */}
                        {activeTab === 'copyright' && (
                            <div className="tab-placeholder tab-content">
                                <p>Trademark section coming soon...</p>
                            </div>
                        )}
                    </div>
            </div>
            </div>
        </Theme>
    );
};

export default App;
