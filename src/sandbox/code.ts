import addOnSandboxSdk from "add-on-sdk-document-sandbox";
import { editor } from "express-document-sdk";
import { initializeOCR, terminateOCR } from "./ocrService";
import {
    extractTextFromTextNodes,
    extractTextFromImages,
    extractAllText,
    getDocumentImages,
    ExtractionSummary
} from "./textExtraction";
import {
    crawlWebPage,
    crawlMultiplePages
} from "./crawlerService";
import {
    initializeMLService,
    detectHateSpeech,
    detectHateSpeechBatch,
    analyzeTextSegments,
    getMLConfig,
    isMLServiceReady,
    testMLService,
    clearMLCache,
    detectImplicitClaims,
    type MLConfig,
    type HateSpeechResult,
    type BatchHateSpeechResult,
    type MLAnalysisResult,
    type ClaimAnalysisResult
} from "./mlService";

// =========================================================================
// EXISTING FUNCTIONS
// =========================================================================

async function extractText() {
    try {
        const allText: string[] = [];
        const doc = editor.documentRoot;
        for (const page of doc.pages) {
            for (const artboard of page.artboards) {
                const children = Array.from(artboard.allChildren);
                for (const node of children) {
                    if (node.type === "Text") {
                        try {
                            const textNode = node as any;
                            if (textNode.fullContent && textNode.fullContent.text) {
                                allText.push(textNode.fullContent.text);
                            }
                        } catch (error) {
                            console.error(`Error extracting text:`, error);
                        }
                    }
                }
            }
        }
        return { success: true, textElements: allText, count: allText.length };
    } catch (error) {
        return { success: false, textElements: [], count: 0, error: String(error) };
    }
}

async function extractTextWithOCR(): Promise<ExtractionSummary> {
    try {
        await initializeOCR();
        const result = await extractAllText(true);
        await terminateOCR();
        return result;
    } catch (error) {
        try { await terminateOCR(); } catch (e) {}
        return { success: false, totalElements: 0, textNodes: 0, ocrResults: 0, results: [], rawText: '', error: String(error) };
    }
}

async function extractTextFromImagesOnly() {
    try {
        await initializeOCR();
        const ocrResults = await extractTextFromImages();
        await terminateOCR();
        const rawText = ocrResults.map(r => r.text).join('\n');
        return { success: true, results: ocrResults, count: ocrResults.length, rawText: rawText };
    } catch (error) {
        try { await terminateOCR(); } catch (e) {}
        return { success: false, results: [], count: 0, rawText: '', error: String(error) };
    }
}

async function getDocumentInfo() {
    try {
        const doc = editor.documentRoot;
        const images = await getDocumentImages();
        return { pageCount: doc.pages.length, documentId: doc.id || "unknown", imageCount: images.length, images: images };
    } catch (error) {
        return { pageCount: 0, documentId: "error", imageCount: 0, images: [] };
    }
}

function configureMLService(config: Partial<MLConfig>): void {
    initializeMLService(config);
}

async function analyzeTextForHateSpeech(text: string): Promise<HateSpeechResult> {
    return await detectHateSpeech(text);
}

async function analyzeDocumentForHateSpeech(): Promise<{ success: boolean; results: MLAnalysisResult[]; summary?: any; error?: string }> {
    try {
        const extractionResult = await extractAllText(false);
        if (!extractionResult.success || extractionResult.results.length === 0) {
            return { success: false, results: [], error: 'No text found in document' };
        }
        const textSegments = extractionResult.results.map(r => ({ text: r.text, source: r.source, id: r.nodeId }));
        const analysisResults = await analyzeTextSegments(textSegments);
        const hateSpeechCount = analysisResults.filter(r => r.result.isHateSpeech).length;
        const totalConfidence = analysisResults.reduce((sum, r) => sum + r.result.confidence, 0);
        
        return {
            success: true,
            results: analysisResults,
            summary: {
                totalAnalyzed: analysisResults.length,
                hateSpeechCount,
                cleanCount: analysisResults.length - hateSpeechCount,
                averageConfidence: analysisResults.length > 0 ? totalConfidence / analysisResults.length : 0
            }
        };
    } catch (error) {
        return { success: false, results: [], error: String(error) };
    }
}

async function analyzeCrawledContentForHateSpeech(crawlResult: any): Promise<{ success: boolean; results: MLAnalysisResult[]; summary?: any; error?: string }> {
    try {
        if (!crawlResult || !crawlResult.text) return { success: false, results: [], error: 'Invalid crawl result' };
        
        const textSegments: Array<{ text: string; source?: string }> = [];
        if (crawlResult.text.headings) crawlResult.text.headings.forEach((h: string) => h.trim() && textSegments.push({ text: h, source: 'heading' }));
        if (crawlResult.text.paragraphs) crawlResult.text.paragraphs.forEach((p: string) => p.trim() && textSegments.push({ text: p, source: 'paragraph' }));
        if (crawlResult.text.lists) crawlResult.text.lists.forEach((l: string) => l.trim() && textSegments.push({ text: l, source: 'list' }));

        if (textSegments.length === 0) return { success: false, results: [], error: 'No text content found' };

        const analysisResults = await analyzeTextSegments(textSegments);
        const hateSpeechCount = analysisResults.filter(r => r.result.isHateSpeech).length;
        const totalConfidence = analysisResults.reduce((sum, r) => sum + r.result.confidence, 0);

        return {
            success: true,
            results: analysisResults,
            summary: {
                totalAnalyzed: analysisResults.length,
                hateSpeechCount,
                cleanCount: analysisResults.length - hateSpeechCount,
                averageConfidence: analysisResults.length > 0 ? totalConfidence / analysisResults.length : 0,
                url: crawlResult.url,
                pageTitle: crawlResult.title
            }
        };
    } catch (error) {
        return { success: false, results: [], error: String(error) };
    }
}

async function analyzeImplicitClaims(text: string): Promise<any> {
    try {
        const result = await detectImplicitClaims(text);
        return { success: true, ...result };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}

// =========================================================================
// NEW FUNCTIONS (FIXED)
// =========================================================================

/**
 * NEW: Create disclaimer text
 * Uses "Geometric Override" to force size by rewriting width/height.
 */
function createDisclaimerText(text: string) {
    console.log("SANDBOX: Creating disclaimer (Geometric Override)...");

    try {
        // 1. Create and Add
        const textNode = editor.createText(text);
        const parent = editor.context.insertionParent || editor.documentRoot.pages[0].artboards[0];
        parent.children.append(textNode);
        
        // 2. Select it to ensure context is active
        editor.context.selection = [textNode];
        const node = editor.context.selection[0] as any;

        // 3. COLOR (Attempt standard set)
        try {
            const darkGrey = { red: 0.2, green: 0.2, blue: 0.2, alpha: 1 };
            if (node.fullContent && node.fullContent.characterStyle) {
                node.fullContent.characterStyle.fill = darkGrey;
            }
        } catch(e) {}

        // 4. THE GEOMETRIC FIX
        // Force the node to be 400px wide. This physically shrinks the text
        // if it was created at a massive default size.
        try {
            const targetWidth = 400; 
            if (node.width > targetWidth) {
                const ratio = targetWidth / node.width;
                const targetHeight = node.height * ratio;
                
                // Fallback: Set properties directly
                node.width = targetWidth;
                node.height = targetHeight;
            }
        } catch (e) {
            console.warn("SANDBOX: Geometric resize failed", e);
        }

        // 5. POSITION (Bottom Center)
        const currentPage = editor.context.currentPage;
        if (currentPage) {
            const currentWidth = node.width || 400; 
            const x = (currentPage.width / 2) - (currentWidth / 2); 
            const y = currentPage.height - 60; 
            
            if (typeof node.setPosition === 'function') {
                node.setPosition({ x, y });
            } else {
                node.translation = { x, y };
            }
        }

        console.log("SANDBOX: Disclaimer created.");

    } catch (e) {
        console.error("SANDBOX: Critical error creating text:", e);
    }
    return true;
}

/**
 * NEW: Get details of the selected node for cropping
 */
function getSelectionDetails() {
    const selection = editor.context.selection;
    
    if (selection.length === 0) throw new Error("Please select an image first.");
    if (selection.length > 1) throw new Error("Please select only one image.");

    // FIX: Cast to 'any' to access properties safely
    const node = selection[0] as any;

    let width = node.width;
    let height = node.height;
    let x = node.translation?.x ?? 0;
    let y = node.translation?.y ?? 0;

    // Check mediaRectangle (Common for images/containers)
    if ((typeof width !== 'number' || typeof height !== 'number') && node.mediaRectangle) {
        width = node.mediaRectangle.width;
        height = node.mediaRectangle.height;
    }
    
    // Check local bounds (Fallback)
    if ((typeof width !== 'number' || typeof height !== 'number') && node.bounds?.local) {
        width = node.bounds.local.width;
        height = node.bounds.local.height;
    }

    if (typeof width !== 'number' || typeof height !== 'number') {
        throw new Error(`Selected item (${node.type}) does not have accessible dimensions.`);
    }
    
    return {
        id: node.id,
        x: x,
        y: y,
        width: width,
        height: height,
        type: node.type
    };
}

/**
 * NEW: Extract colors and fonts from all document nodes
 */
async function extractDocumentColorsAndFonts() {
    try {
        const colors = new Set<string>();
        const fonts = new Set<string>();
        const doc = editor.documentRoot;
        
        for (const page of doc.pages) {
            for (const artboard of page.artboards) {
                const children = Array.from(artboard.allChildren);
                for (const node of children) {
                    try {
                        const nodeAny = node as any;
                        
                        // Extract colors from various properties
                        if (nodeAny.fill) {
                            const color = colorToString(nodeAny.fill);
                            if (color) colors.add(color);
                        }
                        if (nodeAny.stroke?.fill) {
                            const color = colorToString(nodeAny.stroke.fill);
                            if (color) colors.add(color);
                        }
                        
                        // For Text nodes, extract font and text color
                        if (node.type === "Text" && nodeAny.fullContent) {
                            // Extract font family
                            if (nodeAny.fullContent.characterStyle?.fontFamily) {
                                fonts.add(nodeAny.fullContent.characterStyle.fontFamily);
                            }
                            
                            // Extract text color
                            if (nodeAny.fullContent.characterStyle?.fill) {
                                const color = colorToString(nodeAny.fullContent.characterStyle.fill);
                                if (color) colors.add(color);
                            }
                            
                            // Check character style ranges
                            if (nodeAny.fullContent.characterStyleRanges) {
                                for (const range of nodeAny.fullContent.characterStyleRanges) {
                                    if (range.characterStyle?.fontFamily) {
                                        fonts.add(range.characterStyle.fontFamily);
                                    }
                                    if (range.characterStyle?.fill) {
                                        const color = colorToString(range.characterStyle.fill);
                                        if (color) colors.add(color);
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        console.error(`Error extracting colors/fonts from node:`, error);
                    }
                }
            }
        }
        
        return {
            success: true,
            colors: Array.from(colors),
            fonts: Array.from(fonts)
        };
    } catch (error) {
        return {
            success: false,
            colors: [],
            fonts: [],
            error: String(error)
        };
    }
}

/**
 * Helper: Convert color object to hex string
 */
function colorToString(color: any): string | null {
    try {
        if (typeof color === 'string') {
            // Already a string, check if it's hex
            if (color.startsWith('#')) return color.toUpperCase();
            return null;
        }
        
        if (color && typeof color === 'object') {
            // RGB object: {red, green, blue, alpha}
            if (typeof color.red === 'number' && typeof color.green === 'number' && typeof color.blue === 'number') {
                const r = Math.round(color.red * 255).toString(16).padStart(2, '0');
                const g = Math.round(color.green * 255).toString(16).padStart(2, '0');
                const b = Math.round(color.blue * 255).toString(16).padStart(2, '0');
                return `#${r}${g}${b}`.toUpperCase();
            }
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * NEW: Apply color and font suggestions to document
 */
async function applyThemeSuggestions(suggestions: { colors?: Array<{ from: string, to: string }>, fonts?: Array<{ from: string, to: string }> }) {
    try {
        const doc = editor.documentRoot;
        let updateCount = 0;
        
        const colorMap = new Map<string, string>();
        if (suggestions.colors && suggestions.colors.length > 0) {
            suggestions.colors.forEach(({ from, to }) => {
                const fromUpper = from.toUpperCase().trim();
                const toUpper = to.toUpperCase().trim();
                if (fromUpper && toUpper) {
                    colorMap.set(fromUpper, toUpper);
                }
            });
        }
        
        const fontMap = new Map<string, string>();
        if (suggestions.fonts && suggestions.fonts.length > 0) {
            suggestions.fonts.forEach(({ from, to }) => {
                const fromLower = from.toLowerCase().trim();
                const toTrimmed = to.trim();
                if (fromLower && toTrimmed) {
                    fontMap.set(fromLower, toTrimmed);
                }
            });
        }
        
        for (const page of doc.pages) {
            for (const artboard of page.artboards) {
                const children = Array.from(artboard.allChildren);
                for (const node of children) {
                    try {
                        const nodeAny = node as any;
                        let updated = false;
                        
                        // Apply color changes
                        if (colorMap.size > 0) {
                            if (nodeAny.fill) {
                                const currentColor = colorToString(nodeAny.fill);
                                if (currentColor) {
                                    const currentColorUpper = currentColor.toUpperCase();
                                    if (colorMap.has(currentColorUpper)) {
                                        const newColor = hexToColorObject(colorMap.get(currentColorUpper)!);
                                        if (newColor) {
                                            nodeAny.fill = newColor;
                                            updated = true;
                                        }
                                    }
                                }
                            }
                            
                            if (nodeAny.stroke?.fill) {
                                const currentColor = colorToString(nodeAny.stroke.fill);
                                if (currentColor) {
                                    const currentColorUpper = currentColor.toUpperCase();
                                    if (colorMap.has(currentColorUpper)) {
                                        const newColor = hexToColorObject(colorMap.get(currentColorUpper)!);
                                        if (newColor) {
                                            nodeAny.stroke.fill = newColor;
                                            updated = true;
                                        }
                                    }
                                }
                            }
                            
                            // For Text nodes
                            if (node.type === "Text" && nodeAny.fullContent) {
                                if (nodeAny.fullContent.characterStyle?.fill) {
                                    const currentColor = colorToString(nodeAny.fullContent.characterStyle.fill);
                                    if (currentColor) {
                                        const currentColorUpper = currentColor.toUpperCase();
                                        if (colorMap.has(currentColorUpper)) {
                                            const newColor = hexToColorObject(colorMap.get(currentColorUpper)!);
                                            if (newColor) {
                                                nodeAny.fullContent.characterStyle.fill = newColor;
                                                updated = true;
                                            }
                                        }
                                    }
                                }
                                
                                if (nodeAny.fullContent.characterStyleRanges) {
                                    for (const range of nodeAny.fullContent.characterStyleRanges) {
                                        if (range.characterStyle?.fill) {
                                            const currentColor = colorToString(range.characterStyle.fill);
                                            if (currentColor) {
                                                const currentColorUpper = currentColor.toUpperCase();
                                                if (colorMap.has(currentColorUpper)) {
                                                    const newColor = hexToColorObject(colorMap.get(currentColorUpper)!);
                                                    if (newColor) {
                                                        range.characterStyle.fill = newColor;
                                                        updated = true;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        
                        // Apply font changes
                        if (fontMap.size > 0 && node.type === "Text" && nodeAny.fullContent) {
                            if (nodeAny.fullContent.characterStyle?.fontFamily) {
                                const currentFont = nodeAny.fullContent.characterStyle.fontFamily.toLowerCase();
                                if (fontMap.has(currentFont)) {
                                    nodeAny.fullContent.characterStyle.fontFamily = fontMap.get(currentFont)!;
                                    updated = true;
                                }
                            }
                            
                            if (nodeAny.fullContent.characterStyleRanges) {
                                for (const range of nodeAny.fullContent.characterStyleRanges) {
                                    if (range.characterStyle?.fontFamily) {
                                        const currentFont = range.characterStyle.fontFamily.toLowerCase();
                                        if (fontMap.has(currentFont)) {
                                            range.characterStyle.fontFamily = fontMap.get(currentFont)!;
                                            updated = true;
                                        }
                                    }
                                }
                            }
                        }
                        
                        if (updated) updateCount++;
                    } catch (error) {
                        console.error(`Error applying suggestions to node:`, error);
                    }
                }
            }
        }
        
        return {
            success: true,
            updateCount
        };
    } catch (error) {
        return {
            success: false,
            updateCount: 0,
            error: String(error)
        };
    }
}

/**
 * Helper: Convert hex string to color object
 */
function hexToColorObject(hex: string): { red: number, green: number, blue: number, alpha: number } | null {
    try {
        const cleanHex = hex.replace('#', '');
        const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
        const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
        const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
        return { red: r, green: g, blue: b, alpha: 1 };
    } catch (error) {
        return null;
    }
}

// =========================================================================
// EXPOSE API BLOCK
// =========================================================================

addOnSandboxSdk.instance.runtime.exposeApi({
    // Original API
    extractText,
    getDocumentInfo,
    extractTextWithOCR,
    extractTextFromImagesOnly,
    getDocumentImages,
    crawlWebPage,
    crawlMultiplePages,
    configureMLService,
    analyzeTextForHateSpeech,
    analyzeDocumentForHateSpeech,
    analyzeCrawledContentForHateSpeech,
    analyzeImplicitClaims,
    getMLConfig,
    isMLServiceReady,
    testMLService,
    clearMLCache,

    // NEWLY ADDED FUNCTIONS
    createDisclaimerText, 
    getSelectionDetails,
    extractDocumentColorsAndFonts,
    applyThemeSuggestions
});

console.log("Sandbox API initialized - All services ready");