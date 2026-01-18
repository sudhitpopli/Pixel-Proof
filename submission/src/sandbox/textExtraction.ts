import { editor } from "express-document-sdk";
import { extractTextFromImage, extractTextFromMultipleImages, OCRResult } from "./ocrService";

// Type definition for ImageData (compatible with browser and canvas)
export interface ImageDataLike {
    width: number;
    height: number;
    data: Uint8ClampedArray;
}

/**
 * Text Extraction Utilities
 * Provides functions to extract text from various sources in Adobe Express documents
 */

export interface TextNodeResult {
    text: string;
    source: 'text-node';
    nodeId: string;
}

export interface ImageOCRResult {
    text: string;
    source: 'ocr';
    confidence: number;
    nodeId: string;
    imageInfo?: {
        width: number;
        height: number;
    };
}

export type ExtractedTextResult = TextNodeResult | ImageOCRResult;

export interface ExtractionSummary {
    success: boolean;
    totalElements: number;
    textNodes: number;
    ocrResults: number;
    results: ExtractedTextResult[];
    rawText: string; // Combined raw text from all sources
    error?: string;
}

/**
 * Extract text from native Text nodes in the document
 */
export async function extractTextFromTextNodes(): Promise<TextNodeResult[]> {
    const textResults: TextNodeResult[] = [];
    const doc = editor.documentRoot;

    console.log("=== Extracting text from Text nodes ===");

    for (const page of doc.pages) {
        for (const artboard of page.artboards) {
            const children = Array.from(artboard.allChildren);

            for (const node of children) {
                if (node.type === "Text") {
                    try {
                        const textNode = node as any;
                        if (textNode.fullContent && textNode.fullContent.text) {
                            const textContent = textNode.fullContent.text;
                            console.log(`Found text node: "${textContent}"`);

                            textResults.push({
                                text: textContent,
                                source: 'text-node',
                                nodeId: node.id
                            });
                        }
                    } catch (error) {
                        console.error(`Error extracting text from node ${node.id}:`, error);
                    }
                }
            }
        }
    }

    console.log(`Extracted ${textResults.length} text node(s)`);
    return textResults;
}

/**
 * Convert Adobe Express image node to ImageData for OCR processing
 */
async function getImageDataFromNode(node: any): Promise<ImageDataLike | null> {
    try {
        // Check if node is an image type
        if (node.type !== "MediaContainer" && node.type !== "Image") {
            return null;
        }

        // Get the image's bounding box
        const bounds = node.boundsInParent;
        if (!bounds) {
            console.warn(`No bounds found for image node ${node.id}`);
            return null;
        }

        const width = Math.floor(bounds.width);
        const height = Math.floor(bounds.height);

        if (width <= 0 || height <= 0) {
            console.warn(`Invalid dimensions for image node ${node.id}: ${width}x${height}`);
            return null;
        }

        // Note: Adobe Express SDK sandbox doesn't support DOM operations like document.createElement
        // Image export would need to use Adobe Express SDK-specific methods
        // For now, this is a placeholder for future implementation

        // Example of what would be needed (not currently supported):
        // const canvas = document.createElement('canvas');
        // canvas.width = width;
        // canvas.height = height;
        // const ctx = canvas.getContext('2d');

        console.log(`Image node ${node.id}: ${width}x${height}`);
        console.log(`Note: Image data extraction requires Adobe Express SDK image export API`);

        // This is where you'd export the actual image from Adobe Express
        // The exact method depends on the Adobe Express SDK capabilities
        // For now, returning null to indicate this needs SDK-specific implementation

        return null; // Placeholder - needs Adobe Express SDK image export

    } catch (error) {
        console.error(`Error converting image node to ImageData:`, error);
        return null;
    }
}

/**
 * Extract text from images using OCR
 */
export async function extractTextFromImages(): Promise<ImageOCRResult[]> {
    const ocrResults: ImageOCRResult[] = [];
    const doc = editor.documentRoot;

    console.log("=== Extracting text from images using OCR ===");

    for (const page of doc.pages) {
        for (const artboard of page.artboards) {
            const children = Array.from(artboard.allChildren);

            for (const node of children) {
                // Look for image nodes (MediaContainer is the correct type in Adobe Express SDK)
                if (node.type === "MediaContainer") {
                    try {
                        console.log(`Processing image node: ${node.id}`);

                        const imageData = await getImageDataFromNode(node);

                        if (imageData) {
                            const ocrResult = await extractTextFromImage(imageData);

                            if (ocrResult.text.trim().length > 0) {
                                ocrResults.push({
                                    text: ocrResult.text,
                                    source: 'ocr',
                                    confidence: ocrResult.confidence,
                                    nodeId: node.id,
                                    imageInfo: {
                                        width: imageData.width,
                                        height: imageData.height
                                    }
                                });
                            }
                        } else {
                            console.log(`Skipping image node ${node.id} - could not extract image data`);
                        }
                    } catch (error) {
                        console.error(`Error processing image node ${node.id}:`, error);
                    }
                }
            }
        }
    }

    console.log(`Extracted text from ${ocrResults.length} image(s) using OCR`);
    return ocrResults;
}

/**
 * Extract all text from the document (both text nodes and images)
 * @param includeOCR - Whether to include OCR processing of images
 */
export async function extractAllText(includeOCR: boolean = true): Promise<ExtractionSummary> {
    try {
        console.log("=== Starting comprehensive text extraction ===");
        console.log(`OCR enabled: ${includeOCR}`);

        const results: ExtractedTextResult[] = [];

        // Extract from text nodes
        const textNodeResults = await extractTextFromTextNodes();
        results.push(...textNodeResults);

        // Extract from images if OCR is enabled
        let ocrResults: ImageOCRResult[] = [];
        if (includeOCR) {
            ocrResults = await extractTextFromImages();
            results.push(...ocrResults);
        }

        // Combine all text into raw text string
        const rawText = results.map(r => r.text).join('\n');

        const summary: ExtractionSummary = {
            success: true,
            totalElements: results.length,
            textNodes: textNodeResults.length,
            ocrResults: ocrResults.length,
            results: results,
            rawText: rawText
        };

        console.log("=== Extraction complete ===");
        console.log(`Total elements: ${summary.totalElements}`);
        console.log(`Text nodes: ${summary.textNodes}`);
        console.log(`OCR results: ${summary.ocrResults}`);
        console.log(`Raw text length: ${rawText.length} characters`);

        return summary;

    } catch (error) {
        console.error("=== Extraction failed ===");
        console.error("Error:", error);

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
 * Get information about images in the document
 */
export async function getDocumentImages(): Promise<Array<{ id: string; type: string }>> {
    const images: Array<{ id: string; type: string }> = [];
    const doc = editor.documentRoot;

    for (const page of doc.pages) {
        for (const artboard of page.artboards) {
            const children = Array.from(artboard.allChildren);

            for (const node of children) {
                if (node.type === "MediaContainer") {
                    images.push({
                        id: node.id,
                        type: node.type
                    });
                }
            }
        }
    }

    return images;
}
