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

// Expose API to UI
addOnSandboxSdk.instance.runtime.exposeApi({
    // Original API (backward compatible)
    extractText,
    getDocumentInfo,

    // New OCR-enabled APIs
    extractTextWithOCR,
    extractTextFromImagesOnly,
    getDocumentImages
});

console.log("Sandbox API initialized - Text extraction and OCR APIs available");
