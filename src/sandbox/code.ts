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
    type MLConfig,
    type HateSpeechResult,
    type BatchHateSpeechResult,
    type MLAnalysisResult
} from "./mlService";

/**
 * Extract all text from the Adobe Express document (Text nodes only)
 * This is the original function, maintained for backward compatibility
 */
async function extractText() {
    try {
        console.log("=== Starting Text Extraction (Text Nodes Only) ===");

        const allText: string[] = [];
        const doc = editor.documentRoot;

        console.log(`Document has ${doc.pages.length} page(s)`);

        // Iterate through all pages
        for (const page of doc.pages) {
            console.log(`Processing page: ${page.id}`);

            // Iterate through all artboards on the page
            for (const artboard of page.artboards) {
                console.log(`  Processing artboard: ${artboard.id}`);

                // Get all children in the artboard
                const children = Array.from(artboard.allChildren);
                console.log(`    Found ${children.length} node(s)`);

                // Extract text from Text nodes
                for (const node of children) {
                    if (node.type === "Text") {
                        try {
                            // Access text content through fullContent.text property
                            const textNode = node as any; // Type assertion for text access

                            if (textNode.fullContent && textNode.fullContent.text) {
                                const textContent = textNode.fullContent.text;
                                console.log(`      Found text: "${textContent}"`);
                                allText.push(textContent);
                            }
                        } catch (error) {
                            console.error(`      Error extracting text from node:`, error);
                        }
                    }
                }
            }
        }

        console.log("=== Extraction Complete ===");
        console.log(`Total text elements found: ${allText.length}`);

        return {
            success: true,
            textElements: allText,
            count: allText.length
        };

    } catch (error) {
        console.error("=== Extraction Failed ===");
        console.error("Error:", error);

        return {
            success: false,
            textElements: [],
            count: 0,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Extract text from both text nodes and images using OCR
 * Returns comprehensive results with raw text
 */
async function extractTextWithOCR(): Promise<ExtractionSummary> {
    try {
        console.log("=== Starting OCR-Enabled Text Extraction ===");

        // Initialize OCR worker
        await initializeOCR();

        // Extract all text (text nodes + OCR)
        const result = await extractAllText(true);

        // Cleanup OCR worker
        await terminateOCR();

        return result;
    } catch (error) {
        console.error("=== OCR Extraction Failed ===");
        console.error("Error:", error);

        // Try to cleanup worker even on error
        try {
            await terminateOCR();
        } catch (cleanupError) {
            console.error("Failed to cleanup OCR worker:", cleanupError);
        }

        return {
            success: false,
            totalElements: 0,
            textNodes: 0,
            ocrResults: 0,
            results: [],
            rawText: '',
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Extract text from images only (OCR only)
 */
async function extractTextFromImagesOnly() {
    try {
        console.log("=== Starting OCR-Only Text Extraction ===");

        await initializeOCR();
        const ocrResults = await extractTextFromImages();
        await terminateOCR();

        const rawText = ocrResults.map(r => r.text).join('\n');

        return {
            success: true,
            results: ocrResults,
            count: ocrResults.length,
            rawText: rawText
        };
    } catch (error) {
        console.error("=== OCR-Only Extraction Failed ===");
        console.error("Error:", error);

        try {
            await terminateOCR();
        } catch (cleanupError) {
            console.error("Failed to cleanup OCR worker:", cleanupError);
        }

        return {
            success: false,
            results: [],
            count: 0,
            rawText: '',
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Get document metadata
 */
async function getDocumentInfo() {
    try {
        const doc = editor.documentRoot;
        const images = await getDocumentImages();

        return {
            pageCount: doc.pages.length,
            documentId: doc.id || "unknown",
            imageCount: images.length,
            images: images
        };
    } catch (error) {
        return {
            pageCount: 0,
            documentId: "error",
            imageCount: 0,
            images: []
        };
    }
}

/**
 * Configure ML service with API key and settings
 * @param config - ML service configuration
 */
function configureMLService(config: Partial<MLConfig>): void {
    initializeMLService(config);
    console.log('ML Service configured');
}

/**
 * Analyze text for hate speech
 * @param text - Text to analyze
 * @returns Hate speech detection result
 */
async function analyzeTextForHateSpeech(text: string): Promise<HateSpeechResult> {
    try {
        console.log('=== Analyzing text for hate speech ===');
        const result = await detectHateSpeech(text);
        console.log(`Result: ${result.isHateSpeech ? 'HATE SPEECH' : 'CLEAN'} (${result.confidence.toFixed(1)}% confidence)`);
        return result;
    } catch (error) {
        console.error('Hate speech analysis failed:', error);
        throw error;
    }
}

/**
 * Analyze extracted document text for hate speech
 * Combines text extraction with ML analysis
 */
async function analyzeDocumentForHateSpeech(): Promise<{ success: boolean; results: MLAnalysisResult[]; summary?: any; error?: string }> {
    try {
        console.log('=== Analyzing document for hate speech ===');

        // First, extract all text from the document
        const extractionResult = await extractAllText(false); // Use text nodes only for speed

        if (!extractionResult.success || extractionResult.results.length === 0) {
            return {
                success: false,
                results: [],
                error: 'No text found in document to analyze'
            };
        }

        console.log(`Extracted ${extractionResult.results.length} text elements`);

        // Prepare text segments for analysis
        const textSegments = extractionResult.results.map(r => ({
            text: r.text,
            source: r.source,
            id: r.nodeId
        }));

        // Analyze all text segments
        const analysisResults = await analyzeTextSegments(textSegments);

        // Calculate summary statistics
        const hateSpeechCount = analysisResults.filter(r => r.result.isHateSpeech).length;
        const totalConfidence = analysisResults.reduce((sum, r) => sum + r.result.confidence, 0);

        const summary = {
            totalAnalyzed: analysisResults.length,
            hateSpeechCount,
            cleanCount: analysisResults.length - hateSpeechCount,
            averageConfidence: analysisResults.length > 0 ? totalConfidence / analysisResults.length : 0
        };

        console.log('=== Analysis Complete ===');
        console.log(`Total: ${summary.totalAnalyzed}, Hate Speech: ${summary.hateSpeechCount}, Clean: ${summary.cleanCount}`);

        return {
            success: true,
            results: analysisResults,
            summary
        };
    } catch (error) {
        console.error('Document analysis failed:', error);
        return {
            success: false,
            results: [],
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Analyze crawled web page content for hate speech
 * @param crawlResult - Result from crawlWebPage
 */
async function analyzeCrawledContentForHateSpeech(crawlResult: any): Promise<{ success: boolean; results: MLAnalysisResult[]; summary?: any; error?: string }> {
    try {
        console.log('=== Analyzing crawled content for hate speech ===');

        if (!crawlResult || !crawlResult.text) {
            return {
                success: false,
                results: [],
                error: 'Invalid crawl result provided'
            };
        }

        // Prepare text segments from crawled content
        const textSegments: Array<{ text: string; source?: string }> = [];

        // Add headings
        if (crawlResult.text.headings && crawlResult.text.headings.length > 0) {
            crawlResult.text.headings.forEach((heading: string) => {
                if (heading.trim()) {
                    textSegments.push({ text: heading, source: 'heading' });
                }
            });
        }

        // Add paragraphs
        if (crawlResult.text.paragraphs && crawlResult.text.paragraphs.length > 0) {
            crawlResult.text.paragraphs.forEach((paragraph: string) => {
                if (paragraph.trim()) {
                    textSegments.push({ text: paragraph, source: 'paragraph' });
                }
            });
        }

        // Add list items
        if (crawlResult.text.lists && crawlResult.text.lists.length > 0) {
            crawlResult.text.lists.forEach((item: string) => {
                if (item.trim()) {
                    textSegments.push({ text: item, source: 'list' });
                }
            });
        }

        if (textSegments.length === 0) {
            return {
                success: false,
                results: [],
                error: 'No text content found in crawled page'
            };
        }

        console.log(`Analyzing ${textSegments.length} text segments from crawled page`);

        // Analyze all segments
        const analysisResults = await analyzeTextSegments(textSegments);

        // Calculate summary
        const hateSpeechCount = analysisResults.filter(r => r.result.isHateSpeech).length;
        const totalConfidence = analysisResults.reduce((sum, r) => sum + r.result.confidence, 0);

        const summary = {
            totalAnalyzed: analysisResults.length,
            hateSpeechCount,
            cleanCount: analysisResults.length - hateSpeechCount,
            averageConfidence: analysisResults.length > 0 ? totalConfidence / analysisResults.length : 0,
            url: crawlResult.url,
            pageTitle: crawlResult.title
        };

        console.log('=== Crawled Content Analysis Complete ===');
        console.log(`URL: ${summary.url}`);
        console.log(`Total: ${summary.totalAnalyzed}, Hate Speech: ${summary.hateSpeechCount}, Clean: ${summary.cleanCount}`);

        return {
            success: true,
            results: analysisResults,
            summary
        };
    } catch (error) {
        console.error('Crawled content analysis failed:', error);
        return {
            success: false,
            results: [],
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

// Expose API to UI
addOnSandboxSdk.instance.runtime.exposeApi({
    // Original API (backward compatible)
    extractText,
    getDocumentInfo,

    // New OCR-enabled APIs
    extractTextWithOCR,
    extractTextFromImagesOnly,
    getDocumentImages,

    // Web Crawler APIs
    crawlWebPage,
    crawlMultiplePages,

    // ML Detection APIs
    configureMLService,
    analyzeTextForHateSpeech,
    analyzeDocumentForHateSpeech,
    analyzeCrawledContentForHateSpeech,
    getMLConfig,
    isMLServiceReady,
    testMLService,
    clearMLCache
});

console.log("Sandbox API initialized - Text extraction, OCR, Web Crawler, and ML Detection APIs available");
