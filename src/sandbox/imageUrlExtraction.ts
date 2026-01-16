/**
 * Image URL Extraction Service
 * Extracts source URLs from Adobe Express document image nodes
 * Uses node metadata to find original image URLs if available
 */

import { editor } from "express-document-sdk";

// ============================================================================
// Type Definitions
// ============================================================================

export interface ImageUrlInfo {
    nodeId: string;
    type: string;
    sourceUrl?: string;
    metadata: {
        nodeAddOnData: Record<string, string>;
        mediaAddOnData: Record<string, string>;
        hasSourceUrl: boolean;
    };
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

// ============================================================================
// Debug Utilities
// ============================================================================

function debugLog(step: string, data: any, context?: string): void {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` [${context}]` : '';
    console.log(`[IMAGE_URL_EXTRACT${contextStr}] ${timestamp} | ${step}:`, JSON.stringify(data, null, 2));
}

// ============================================================================
// URL Extraction Functions
// ============================================================================

/**
 * Extract source URL from a MediaContainer node's metadata
 * Checks both nodeAddOnData and mediaAddOnData for source URL information
 * @param nodeId - The ID of the image node to extract URL from
 * @returns ImageUrlInfo with source URL if found, or null
 */
export async function getImageSourceUrl(nodeId: string): Promise<ImageUrlInfo | null> {
    debugLog("START", { nodeId }, "getImageSourceUrl");
    
    try {
        const doc = editor.documentRoot;
        let foundNode: any = null;

        // Search for the node across all pages and artboards
        for (const page of doc.pages) {
            for (const artboard of page.artboards) {
                const children = Array.from(artboard.allChildren);
                const match = children.find((n: any) => n.id === nodeId);
                if (match) {
                    foundNode = match;
                    break;
                }
            }
            if (foundNode) break;
        }

        if (!foundNode) {
            debugLog("NODE_NOT_FOUND", { nodeId }, "getImageSourceUrl");
            return null;
        }

        // Verify it's an image node
        if (foundNode.type !== "MediaContainer" && foundNode.type !== "Image") {
            debugLog("INVALID_NODE_TYPE", { 
                nodeId: foundNode.id,
                type: foundNode.type 
            }, "getImageSourceUrl");
            return null;
        }

        debugLog("NODE_FOUND", { 
            nodeId: foundNode.id,
            type: foundNode.type 
        }, "getImageSourceUrl");

        // Extract node-level metadata (nodeAddOnData)
        const nodeMetadata: Record<string, string> = {};
        let nodeSourceUrl: string | undefined = undefined;

        try {
            const nodeAddOnData = foundNode.addOnData;
            const nodeKeys = Array.from(nodeAddOnData.keys()) as string[];
            debugLog("NODE_METADATA_KEYS", { keys: nodeKeys }, "getImageSourceUrl");

            for (const key of nodeKeys) {
                const value = nodeAddOnData.getItem(key) as string;
                nodeMetadata[key] = value;
                
                // Check for common URL key names
                if ((key.toLowerCase().includes('url') || 
                     key.toLowerCase().includes('source') ||
                     key.toLowerCase().includes('link') ||
                     key.toLowerCase().includes('origin')) &&
                    typeof value === 'string' && 
                    (value.startsWith('http://') || value.startsWith('https://'))) {
                    nodeSourceUrl = value;
                    debugLog("URL_FOUND_IN_NODE_METADATA", { key, url: value.substring(0, 100) }, "getImageSourceUrl");
                }
            }
        } catch (error) {
            debugLog("NODE_METADATA_ERROR", { error: String(error) }, "getImageSourceUrl");
        }

        // Extract media-level metadata (mediaAddOnData)
        const mediaMetadata: Record<string, string> = {};
        let mediaSourceUrl: string | undefined = undefined;

        try {
            const mediaRectangle = foundNode.mediaRectangle;
            if (mediaRectangle && mediaRectangle.mediaAddOnData) {
                const mediaAddOnData = mediaRectangle.mediaAddOnData;
                const mediaKeys = Array.from(mediaAddOnData.keys()) as string[];
                debugLog("MEDIA_METADATA_KEYS", { keys: mediaKeys }, "getImageSourceUrl");

                for (const key of mediaKeys) {
                    const value = mediaAddOnData.getItem(key) as string;
                    mediaMetadata[key] = value;
                    
                    // Check for common URL key names
                    if ((key.toLowerCase().includes('url') || 
                         key.toLowerCase().includes('source') ||
                         key.toLowerCase().includes('link') ||
                         key.toLowerCase().includes('origin')) &&
                        typeof value === 'string' && 
                        (value.startsWith('http://') || value.startsWith('https://'))) {
                        mediaSourceUrl = value;
                        debugLog("URL_FOUND_IN_MEDIA_METADATA", { key, url: value.substring(0, 100) }, "getImageSourceUrl");
                    }
                }
            }
        } catch (error) {
            debugLog("MEDIA_METADATA_ERROR", { 
                error: String(error),
                note: "This is normal for PSD/AI assets or if mediaAddOnData is not available"
            }, "getImageSourceUrl");
        }

        // Get bounds
        const bounds = foundNode.boundsInParent || { x: 0, y: 0, width: 0, height: 0 };

        // Prefer media-level URL over node-level URL
        const sourceUrl = mediaSourceUrl || nodeSourceUrl;

        const result: ImageUrlInfo = {
            nodeId: foundNode.id,
            type: foundNode.type,
            sourceUrl: sourceUrl,
            metadata: {
                nodeAddOnData: nodeMetadata,
                mediaAddOnData: mediaMetadata,
                hasSourceUrl: !!sourceUrl
            },
            bounds: {
                x: bounds.x || 0,
                y: bounds.y || 0,
                width: bounds.width || 0,
                height: bounds.height || 0
            }
        };

        debugLog("EXTRACTION_COMPLETE", { 
            hasSourceUrl: !!sourceUrl,
            sourceUrl: sourceUrl ? sourceUrl.substring(0, 100) : undefined
        }, "getImageSourceUrl");

        return result;

    } catch (error) {
        debugLog("FATAL_ERROR", { 
            error: String(error),
            stack: error instanceof Error ? error.stack?.substring(0, 300) : undefined,
            nodeId 
        }, "getImageSourceUrl");
        return null;
    }
}

/**
 * Extract source URLs from all image nodes in the document
 * @returns Array of ImageUrlInfo for all image nodes
 */
export async function getAllImageSourceUrls(): Promise<ImageUrlInfo[]> {
    debugLog("START", {}, "getAllImageSourceUrls");
    
    try {
        const doc = editor.documentRoot;
        const allImageUrls: ImageUrlInfo[] = [];

        for (const page of doc.pages) {
            for (const artboard of page.artboards) {
                const children = Array.from(artboard.allChildren);
                
                for (const node of children) {
                    const safeNode = node as any;
                    
                    if (safeNode.type === "MediaContainer" || safeNode.type === "Image") {
                        debugLog("PROCESSING_NODE", { 
                            nodeId: safeNode.id,
                            type: safeNode.type 
                        }, "getAllImageSourceUrls");
                        
                        const urlInfo = await getImageSourceUrl(safeNode.id);
                        if (urlInfo) {
                            allImageUrls.push(urlInfo);
                        }
                    }
                }
            }
        }

        debugLog("COMPLETE", { 
            success: true,
            count: allImageUrls.length,
            urlsFound: allImageUrls.filter(info => info.sourceUrl).length
        }, "getAllImageSourceUrls");

        return allImageUrls;

    } catch (error) {
        debugLog("FATAL_ERROR", { 
            error: String(error),
            stack: error instanceof Error ? error.stack?.substring(0, 300) : undefined
        }, "getAllImageSourceUrls");
        return [];
    }
}
