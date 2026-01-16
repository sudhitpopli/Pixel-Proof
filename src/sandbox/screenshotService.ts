/**
 * Screenshot Service
 * Captures screenshots using rendition API and extracts image metadata
 */

import { editor } from "express-document-sdk";

// ============================================================================
// Type Definitions
// ============================================================================

export interface ImageMetadata {
    nodeId: string;
    type: string;
    position: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    boundsInParent: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    boundsLocal: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

export interface ScreenshotResult {
    success: boolean;
    screenshotBlob?: Blob;
    imageMetadata: ImageMetadata[];
    error?: string;
}

// ============================================================================
// Screenshot and Metadata Extraction
// ============================================================================

/**
 * Capture screenshot of entire page and extract image metadata
 * @returns ScreenshotResult with blob and image metadata
 */
export async function capturePageScreenshotWithMetadata(): Promise<ScreenshotResult> {
    console.log("[SCREENSHOT_SERVICE] Starting screenshot capture with metadata extraction...");
    
    try {
        const doc = editor.documentRoot;
        
        // Get current page
        const currentPage = editor.context.currentPage;
        if (!currentPage) {
            return {
                success: false,
                imageMetadata: [],
                error: "No current page found"
            };
        }
        
        console.log("[SCREENSHOT_SERVICE] Current page found:", currentPage.id);
        
        // Step 1: Extract image metadata before capturing screenshot
        const imageMetadata: ImageMetadata[] = [];
        
        for (const artboard of currentPage.artboards) {
            const children = Array.from(artboard.allChildren);
            
            for (const node of children) {
                const safeNode = node as any;
                
                if (safeNode.type === "MediaContainer" || safeNode.type === "Image") {
                    try {
                        const boundsInParent = safeNode.boundsInParent || { x: 0, y: 0, width: 0, height: 0 };
                        const boundsLocal = safeNode.boundsLocal || { x: 0, y: 0, width: 0, height: 0 };
                        const translation = safeNode.translation || { x: 0, y: 0 };
                        
                        imageMetadata.push({
                            nodeId: safeNode.id,
                            type: safeNode.type,
                            position: {
                                x: translation.x || boundsInParent.x || 0,
                                y: translation.y || boundsInParent.y || 0,
                                width: boundsInParent.width || boundsLocal.width || 0,
                                height: boundsInParent.height || boundsLocal.height || 0
                            },
                            boundsInParent: {
                                x: boundsInParent.x || 0,
                                y: boundsInParent.y || 0,
                                width: boundsInParent.width || 0,
                                height: boundsInParent.height || 0
                            },
                            boundsLocal: {
                                x: boundsLocal.x || 0,
                                y: boundsLocal.y || 0,
                                width: boundsLocal.width || 0,
                                height: boundsLocal.height || 0
                            }
                        });
                        
                        console.log("[SCREENSHOT_SERVICE] Found image node:", {
                            nodeId: safeNode.id,
                            position: imageMetadata[imageMetadata.length - 1].position
                        });
                    } catch (nodeError) {
                        console.warn("[SCREENSHOT_SERVICE] Error extracting metadata for node:", safeNode.id, nodeError);
                    }
                }
            }
        }
        
        console.log(`[SCREENSHOT_SERVICE] Extracted metadata for ${imageMetadata.length} image(s)`);
        
        // Step 2: Capture screenshot using rendition API
        // Note: createRenditions is called from UI side (iframe), not sandbox
        // So we'll just return the metadata here, and the UI will call createRenditions
        
        return {
            success: true,
            imageMetadata: imageMetadata
        };
        
    } catch (error) {
        console.error("[SCREENSHOT_SERVICE] Error:", error);
        return {
            success: false,
            imageMetadata: [],
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
