/**
 * Cloud OCR Integration for Adobe Express Document Images
 * 
 * This module provides functions to extract text from images in Adobe Express documents
 * using cloud-based OCR (OCR.space API) instead of browser-based Tesseract.js
 */

import { editor } from "express-document-sdk";
import {
    extractTextFromImageURL,
    extractTextFromBase64,
    type OCRResult
} from "./cloudOcrService";

export interface DocumentImageOCRResult {
    nodeId: string;
    text: string;
    confidence: number;
    provider: string;
    error?: string;
    imageInfo?: {
        type: string;
        bounds?: any;
    };
}

export interface DocumentOCRSummary {
    success: boolean;
    totalImages: number;
    processedImages: number;
    results: DocumentImageOCRResult[];
    rawText: string;
    error?: string;
}

/**
 * Extract text from all images in the Adobe Express document using cloud OCR
 * 
 * NOTE: Adobe Express SDK has limitations on image export from the sandbox.
 * This function attempts multiple strategies to get image data for OCR processing.
 * 
 * @returns OCR results for all images in the document
 */
export async function extractTextFromDocumentImagesWithCloudOCR(): Promise<DocumentOCRSummary> {
    try {
        console.log("=== Starting Cloud OCR for Document Images ===");

        const doc = editor.documentRoot;
        const imageResults: DocumentImageOCRResult[] = [];
        let totalImages = 0;

        // Iterate through all pages and artboards
        for (const page of doc.pages) {
            console.log(`Processing page: ${page.id}`);

            for (const artboard of page.artboards) {
                console.log(`  Processing artboard: ${artboard.id}`);

                const children = Array.from(artboard.allChildren);
                console.log(`    Found ${children.length} node(s)`);

                for (const node of children) {
                    // Look for MediaContainer nodes (images)
                    if (node.type === "MediaContainer") {
                        totalImages++;
                        console.log(`    Found image node: ${node.id}`);

                        try {
                            // Get node information
                            const mediaNode = node as any;
                            const bounds = mediaNode.boundsInParent;

                            console.log(`      Image dimensions: ${bounds?.width}x${bounds?.height}`);

                            // STRATEGY 1: Check if image has a URL (for web-imported images)
                            // Note: This is a workaround since direct image export isn't available
                            let ocrResult: OCRResult | null = null;

                            // Try to get image metadata that might contain URL
                            if (mediaNode.mediaAddOnData) {
                                const imageUrl = mediaNode.mediaAddOnData.get('originalUrl');
                                if (imageUrl) {
                                    console.log(`      Found image URL in metadata: ${imageUrl}`);
                                    ocrResult = await extractTextFromImageURL(imageUrl);
                                }
                            }

                            // STRATEGY 2: Placeholder for future Adobe SDK image export
                            if (!ocrResult) {
                                console.log(`      ⚠️ Cannot extract image data - Adobe Express SDK doesn't provide image export in sandbox`);
                                console.log(`      Workaround: Images need to be from URLs or require UI-side processing`);

                                imageResults.push({
                                    nodeId: node.id,
                                    text: '',
                                    confidence: 0,
                                    provider: 'ocrspace',
                                    error: 'Image export not supported in sandbox. Use web-imported images with URLs or process in UI layer.',
                                    imageInfo: {
                                        type: node.type,
                                        bounds: bounds ? {
                                            width: bounds.width,
                                            height: bounds.height
                                        } : undefined
                                    }
                                });
                                continue;
                            }

                            // Add successful OCR result
                            imageResults.push({
                                nodeId: node.id,
                                text: ocrResult.text,
                                confidence: ocrResult.confidence,
                                provider: ocrResult.provider,
                                imageInfo: {
                                    type: node.type,
                                    bounds: bounds ? {
                                        width: bounds.width,
                                        height: bounds.height
                                    } : undefined
                                }
                            });

                            console.log(`      ✅ OCR completed: "${ocrResult.text.substring(0, 50)}..."`);

                        } catch (error) {
                            console.error(`      Error processing image node ${node.id}:`, error);
                            imageResults.push({
                                nodeId: node.id,
                                text: '',
                                confidence: 0,
                                provider: 'ocrspace',
                                error: error instanceof Error ? error.message : String(error),
                                imageInfo: {
                                    type: node.type
                                }
                            });
                        }
                    }
                }
            }
        }

        // Combine all extracted text
        const rawText = imageResults
            .filter(r => r.text.length > 0)
            .map(r => r.text)
            .join('\n');

        const processedImages = imageResults.filter(r => !r.error).length;

        console.log("=== Cloud OCR Complete ===");
        console.log(`Total images found: ${totalImages}`);
        console.log(`Successfully processed: ${processedImages}`);
        console.log(`Extracted text length: ${rawText.length} characters`);

        return {
            success: true,
            totalImages,
            processedImages,
            results: imageResults,
            rawText
        };

    } catch (error) {
        console.error("=== Cloud OCR Failed ===");
        console.error("Error:", error);

        return {
            success: false,
            totalImages: 0,
            processedImages: 0,
            results: [],
            rawText: '',
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Get information about all images in the document
 * Useful for understanding what images are available before OCR processing
 */
export async function getDocumentImagesInfo(): Promise<Array<{
    nodeId: string;
    type: string;
    bounds?: { width: number; height: number };
    hasMetadata: boolean;
}>> {
    const images: Array<{
        nodeId: string;
        type: string;
        bounds?: { width: number; height: number };
        hasMetadata: boolean;
    }> = [];

    const doc = editor.documentRoot;

    for (const page of doc.pages) {
        for (const artboard of page.artboards) {
            const children = Array.from(artboard.allChildren);

            for (const node of children) {
                if (node.type === "MediaContainer") {
                    const mediaNode = node as any;
                    const bounds = mediaNode.boundsInParent;

                    images.push({
                        nodeId: node.id,
                        type: node.type,
                        bounds: bounds ? {
                            width: bounds.width,
                            height: bounds.height
                        } : undefined,
                        hasMetadata: !!mediaNode.mediaAddOnData
                    });
                }
            }
        }
    }

    return images;
}
