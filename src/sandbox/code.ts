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
        console.log("=== Starting Text Extraction (Text Nodes Only) ===");
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
        // Instead of setting font size, we force the node to be physically smaller.
        // A standard disclaimer shouldn't be wider than 300px.
        try {
            console.log(`SANDBOX: Original Width: ${node.width}, Height: ${node.height}`);
            
            // Calculate scale ratio to bring it down to reasonable width (e.g., 400px)
            const targetWidth = 400; 
            
            if (node.width > targetWidth) {
                const ratio = targetWidth / node.width;
                const targetHeight = node.height * ratio;
                
                console.log(`SANDBOX: Resizing to ${targetWidth} x ${targetHeight} (Ratio: ${ratio})`);
                
                // Try 'resize' method if available (common in scene graphs)
                if (typeof node.resize === 'function') {
                    node.resize(targetWidth, targetHeight);
                } else {
                    // Fallback: Set properties directly
                    node.width = targetWidth;
                    node.height = targetHeight;
                }
            }
        } catch (e) {
            console.warn("SANDBOX: Geometric resize failed", e);
        }

        // 5. POSITION (Bottom Center)
        const currentPage = editor.context.currentPage;
        if (currentPage) {
            // Recalculate x based on NEW width
            const currentWidth = node.width || 400; // Fallback if read failed
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
    console.log("SANDBOX: Processing selection type:", node.type);

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
    getSelectionDetails   
});

console.log("Sandbox API initialized - All services ready");