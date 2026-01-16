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
        nodeAddOnData: Record<string, any>;
        mediaAddOnData: Record<string, any>;
        nodeProperties?: Record<string, any>;
        allNodeData?: any;
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
/**
 * Try to fetch BitmapImage and check for URL (async - requires experimental API)
 */
async function tryFetchBitmapImageUrl(mediaRectangle: any): Promise<string | null> {
    try {
        if (mediaRectangle.type === 'ImageRectangle' && typeof (mediaRectangle as any).fetchBitmapImage === 'function') {
            debugLog("CALLING_FETCH_BITMAP_IMAGE", {}, "tryFetchBitmapImageUrl");
            const bitmapImage = await (mediaRectangle as any).fetchBitmapImage();
            
            if (bitmapImage) {
                debugLog("BITMAP_IMAGE_FETCHED", { 
                    width: bitmapImage.width, 
                    height: bitmapImage.height 
                }, "tryFetchBitmapImageUrl");
                
                // Check all properties of BitmapImage for URL
                const bitmapProps = ['sourceUrl', 'originalUrl', 'imageUrl', 'url', 'src', 'href', 'origin', 'source'];
                for (const prop of bitmapProps) {
                    try {
                        const urlValue = (bitmapImage as any)[prop];
                        if (typeof urlValue === 'string' && (urlValue.startsWith('http://') || urlValue.startsWith('https://'))) {
                            debugLog("URL_FOUND_IN_BITMAP_IMAGE", { prop, url: urlValue.substring(0, 100) }, "tryFetchBitmapImageUrl");
                            return urlValue;
                        }
                    } catch {}
                }
                
                // Try to get image data and see if there's any URL embedded in metadata
                try {
                    if (typeof bitmapImage.data === 'function') {
                        const blob = await bitmapImage.data();
                        // Blob might have metadata - check blob properties
                        // Note: browser blob doesn't expose URL, but we log what we can
                        debugLog("BITMAP_BLOB_RECEIVED", { 
                            type: blob.type, 
                            size: blob.size 
                        }, "tryFetchBitmapImageUrl");
                    }
                } catch {}
            }
        }
    } catch (error) {
        debugLog("FETCH_BITMAP_IMAGE_ERROR", { error: String(error) }, "tryFetchBitmapImageUrl");
    }
    return null;
}

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

        // Helper function to recursively search for URLs in objects (defined early for use below)
        const findUrlsInValue = (value: any, path: string = '', maxDepth: number = 5): string[] => {
            const urls: string[] = [];
            if (maxDepth <= 0) return urls;
            
            if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
                urls.push(value);
                debugLog("URL_FOUND_RECURSIVE", { path, url: value.substring(0, 100) }, "getImageSourceUrl");
            } else if (value && typeof value === 'object') {
                try {
                    if (Array.isArray(value)) {
                        value.forEach((item, idx) => {
                            urls.push(...findUrlsInValue(item, `${path}[${idx}]`, maxDepth - 1));
                        });
                    } else {
                        const keys = Object.keys(value);
                        for (const key of keys) {
                            try {
                                const nestedValue = (value as any)[key];
                                if (typeof nestedValue !== 'function' && nestedValue !== value) {
                                    urls.push(...findUrlsInValue(nestedValue, path ? `${path}.${key}` : key, maxDepth - 1));
                                }
                            } catch {}
                        }
                    }
                } catch {}
            }
            return urls;
        };

        // Extract node-level metadata (nodeAddOnData) - GET EVERYTHING
        const nodeMetadata: Record<string, any> = {};
        let nodeSourceUrl: string | undefined = undefined;
        
        // Declare nodeProperties early so it can be used in all scopes
        const nodeProperties: Record<string, any> = {};
        const allNodeData: any = {};

        try {
            const nodeAddOnData = foundNode.addOnData;
            const nodeKeys = Array.from(nodeAddOnData.keys()) as string[];
            debugLog("NODE_METADATA_KEYS", { keys: nodeKeys, count: nodeKeys.length }, "getImageSourceUrl");

            // Extract ALL metadata - don't filter anything
            for (const key of nodeKeys) {
                try {
                    const value = nodeAddOnData.getItem(key);
                    nodeMetadata[key] = value;
                    
                    // Check if value is a URL (starts with http:// or https://)
                    if (typeof value === 'string' && 
                        (value.startsWith('http://') || value.startsWith('https://'))) {
                        nodeSourceUrl = value;
                        debugLog("URL_FOUND_IN_NODE_METADATA", { key, url: value.substring(0, 100) }, "getImageSourceUrl");
                    }
                    // Also check for common URL key names
                    else if ((key.toLowerCase().includes('url') || 
                         key.toLowerCase().includes('source') ||
                         key.toLowerCase().includes('link') ||
                         key.toLowerCase().includes('origin') ||
                         key.toLowerCase().includes('href') ||
                         key.toLowerCase().includes('src')) &&
                        typeof value === 'string' && 
                        (value.startsWith('http://') || value.startsWith('https://'))) {
                        nodeSourceUrl = value;
                        debugLog("URL_FOUND_IN_NODE_METADATA_BY_KEY", { key, url: value.substring(0, 100) }, "getImageSourceUrl");
                    }
                    
                    // Log ALL values for debugging
                    debugLog("NODE_METADATA_VALUE", { 
                        key, 
                        value: typeof value === 'string' ? value.substring(0, 200) : JSON.stringify(value).substring(0, 200),
                        valueType: typeof value
                    }, "getImageSourceUrl");
                } catch (itemError) {
                    debugLog("NODE_METADATA_ITEM_ERROR", { key, error: String(itemError) }, "getImageSourceUrl");
                }
            }
        } catch (error) {
            debugLog("NODE_METADATA_ERROR", { error: String(error), stack: error instanceof Error ? error.stack?.substring(0, 300) : undefined }, "getImageSourceUrl");
        }

        // Extract media-level metadata (mediaAddOnData) - GET EVERYTHING
        const mediaMetadata: Record<string, any> = {};
        let mediaSourceUrl: string | undefined = undefined;
        const mediaRectProps: Record<string, any> = {}; // Declare in outer scope

        try {
            const mediaRectangle = foundNode.mediaRectangle;
            if (mediaRectangle) {
                debugLog("MEDIA_RECTANGLE_FOUND", { 
                    type: mediaRectangle.type,
                    hasMediaAddOnData: !!mediaRectangle.mediaAddOnData 
                }, "getImageSourceUrl");
                
                // Access mediaRectangle properties DIRECTLY (don't just serialize)
                try {
                    // Get actual property values, not serialized versions
                    const width = mediaRectangle.width;
                    const height = mediaRectangle.height;
                    mediaRectProps.width = width;
                    mediaRectProps.height = height;
                    
                    // Check all known properties
                    const knownProps = ['type', 'id', 'width', 'height', 'boundsInParent', 'boundsLocal', 
                                      'translation', 'rotation', 'opacity', 'mediaAddOnData'];
                    
                    for (const prop of knownProps) {
                        try {
                            const propValue = (mediaRectangle as any)[prop];
                            mediaRectProps[prop] = typeof propValue === 'function' ? '[Function]' : propValue;
                            
                            // Check if it's a URL string
                            if (typeof propValue === 'string' && (propValue.startsWith('http://') || propValue.startsWith('https://'))) {
                                mediaSourceUrl = propValue;
                                debugLog("URL_FOUND_IN_MEDIA_RECTANGLE_PROPERTY", { prop, url: propValue.substring(0, 100) }, "getImageSourceUrl");
                            }
                        } catch {}
                    }
                    
                    // Try to access ALL enumerable properties
                    try {
                        const allMediaProps = Object.keys(mediaRectangle);
                        debugLog("MEDIA_RECTANGLE_ALL_PROPERTIES", { properties: allMediaProps }, "getImageSourceUrl");
                        
                        for (const prop of allMediaProps) {
                            if (!knownProps.includes(prop)) {
                                try {
                                    const propValue = (mediaRectangle as any)[prop];
                                    if (typeof propValue !== 'function') {
                                        mediaRectProps[prop] = propValue;
                                        
                                        // Recursively search for URLs
                                        const foundUrls = findUrlsInValue(propValue, `mediaRectangle.${prop}`, 3);
                                        if (foundUrls.length > 0 && !mediaSourceUrl) {
                                            mediaSourceUrl = foundUrls[0];
                                        }
                                    }
                                } catch {}
                            }
                        }
                    } catch {}
                    
                    // SPECIAL: If it's an ImageRectangleNode, try async fetchBitmapImage to check for URL
                    if (mediaRectangle.type === 'ImageRectangle') {
                        try {
                            if (typeof (mediaRectangle as any).fetchBitmapImage === 'function') {
                                debugLog("ATTEMPTING_ASYNC_FETCH_BITMAP_IMAGE", {}, "getImageSourceUrl");
                                // Try to fetch BitmapImage (this is async - we'll try to await it if we can)
                                const bitmapUrl = await tryFetchBitmapImageUrl(mediaRectangle);
                                if (bitmapUrl && !mediaSourceUrl) {
                                    mediaSourceUrl = bitmapUrl;
                                    debugLog("URL_FOUND_VIA_BITMAP_FETCH", { url: bitmapUrl.substring(0, 100) }, "getImageSourceUrl");
                                }
                                mediaRectProps._bitmapImageMethod = 'fetchBitmapImage called (async)';
                            }
                            
                            // Also check for common URL property names directly on ImageRectangleNode
                            const urlPropNames = ['sourceUrl', 'originalUrl', 'imageUrl', 'url', 'src', 'href', 'origin', 'source'];
                            for (const urlProp of urlPropNames) {
                                try {
                                    const urlValue = (mediaRectangle as any)[urlProp];
                                    if (typeof urlValue === 'string' && (urlValue.startsWith('http://') || urlValue.startsWith('https://'))) {
                                        mediaSourceUrl = urlValue;
                                        mediaRectProps[urlProp] = urlValue;
                                        debugLog("URL_FOUND_IN_MEDIA_RECTANGLE_URL_PROP", { prop: urlProp, url: urlValue.substring(0, 100) }, "getImageSourceUrl");
                                    }
                                } catch {}
                            }
                        } catch (bitmapError) {
                            debugLog("BITMAP_FETCH_ERROR", { error: String(bitmapError) }, "getImageSourceUrl");
                        }
                    }
                    
                    nodeProperties.mediaRectangle = mediaRectProps;
                    
                } catch (propError) {
                    debugLog("MEDIA_RECTANGLE_PROPERTIES_ERROR", { error: String(propError) }, "getImageSourceUrl");
                }
                
                if (mediaRectangle.mediaAddOnData) {
                    const mediaAddOnData = mediaRectangle.mediaAddOnData;
                    const mediaKeys = Array.from(mediaAddOnData.keys()) as string[];
                    debugLog("MEDIA_METADATA_KEYS", { keys: mediaKeys, count: mediaKeys.length }, "getImageSourceUrl");

                    // Extract ALL metadata - don't filter anything
                    for (const key of mediaKeys) {
                        try {
                            const value = mediaAddOnData.getItem(key);
                            mediaMetadata[key] = value;
                            
                            // Check if value is a URL
                            if (typeof value === 'string' && 
                                (value.startsWith('http://') || value.startsWith('https://'))) {
                                mediaSourceUrl = value;
                                debugLog("URL_FOUND_IN_MEDIA_METADATA", { key, url: value.substring(0, 100) }, "getImageSourceUrl");
                            }
                            // Also check for common URL key names
                            else if ((key.toLowerCase().includes('url') || 
                                 key.toLowerCase().includes('source') ||
                                 key.toLowerCase().includes('link') ||
                                 key.toLowerCase().includes('origin') ||
                                 key.toLowerCase().includes('href') ||
                                 key.toLowerCase().includes('src')) &&
                                typeof value === 'string' && 
                                (value.startsWith('http://') || value.startsWith('https://'))) {
                                mediaSourceUrl = value;
                                debugLog("URL_FOUND_IN_MEDIA_METADATA_BY_KEY", { key, url: value.substring(0, 100) }, "getImageSourceUrl");
                            }
                            
                            // Log ALL values for debugging
                            debugLog("MEDIA_METADATA_VALUE", { 
                                key, 
                                value: typeof value === 'string' ? value.substring(0, 200) : JSON.stringify(value).substring(0, 200),
                                valueType: typeof value
                            }, "getImageSourceUrl");
                        } catch (itemError) {
                            debugLog("MEDIA_METADATA_ITEM_ERROR", { key, error: String(itemError) }, "getImageSourceUrl");
                        }
                    }
                }
            } else {
                debugLog("NO_MEDIA_RECTANGLE", {}, "getImageSourceUrl");
            }
        } catch (error) {
            debugLog("MEDIA_METADATA_ERROR", { 
                error: String(error),
                stack: error instanceof Error ? error.stack?.substring(0, 300) : undefined,
                note: "This is normal for PSD/AI assets or if mediaAddOnData is not available"
            }, "getImageSourceUrl");
        }

        // Get bounds and other node properties
        const bounds = foundNode.boundsInParent || { x: 0, y: 0, width: 0, height: 0 };
        
        try {
            // Get ALL properties of the node - including getters
            const nodePropKeys = [
                'id', 'type', 'parent', 'boundsInParent', 'boundsLocal', 
                'translation', 'rotation', 'opacity', 'locked', 'blendMode',
                'maskShape', 'mediaRectangle'
            ];
            
            // Also try to get all enumerable properties
            const enumerableKeys = Object.keys(foundNode);
            const allKeys = [...new Set([...nodePropKeys, ...enumerableKeys])];
            
            for (const prop of allKeys) {
                try {
                    // Skip addOnData and mediaAddOnData - these are SDK objects that can't be serialized
                    // We already extract their values separately above using .getItem()
                    if (prop === 'addOnData' || prop === 'mediaAddOnData') {
                        continue;
                    }
                    
                    const propValue = (foundNode as any)[prop];
                    
                    // Skip SDK objects that can't be serialized (AddOnData, Node objects, etc.)
                    if (propValue && typeof propValue === 'object' && 
                        (typeof (propValue as any).getItem === 'function' || typeof (propValue as any).keys === 'function')) {
                        // This is an AddOnData or similar SDK object - don't store it directly
                        nodeProperties[prop] = `[SDK Object: ${propValue.constructor?.name || 'unknown'}]`;
                        continue;
                    }
                    
                    // Store all non-function values
                    if (typeof propValue !== 'function') {
                        if (typeof propValue === 'object' && propValue !== null) {
                            // For objects, store a representation and search for URLs
                            try {
                                nodeProperties[prop] = {
                                    type: 'object',
                                    hasKeys: Object.keys(propValue).length,
                                    keys: Object.keys(propValue).slice(0, 50), // First 50 keys
                                    value: JSON.stringify(propValue).substring(0, 500) // First 500 chars
                                };
                                // Search for URLs in this object
                                const foundUrls = findUrlsInValue(propValue, prop, 3);
                                if (foundUrls.length > 0 && !nodeSourceUrl) {
                                    nodeSourceUrl = foundUrls[0];
                                }
                            } catch {
                                nodeProperties[prop] = `[Object - could not serialize]`;
                            }
                        } else {
                            nodeProperties[prop] = propValue;
                            
                            // Check if it's a URL
                            if (typeof propValue === 'string' && (propValue.startsWith('http://') || propValue.startsWith('https://'))) {
                                if (!nodeSourceUrl) {
                                    nodeSourceUrl = propValue;
                                }
                                debugLog("URL_FOUND_IN_NODE_PROPERTY", { prop, url: propValue.substring(0, 100) }, "getImageSourceUrl");
                            }
                        }
                    } else {
                        nodeProperties[prop] = `[Function: ${prop}]`;
                    }
                } catch (e) {
                    nodeProperties[prop] = `[Error accessing: ${String(e)}]`;
                }
            }
            
            // Add mediaRectangle props to nodeProperties (if they were extracted)
            // Note: mediaRectProps is only available if mediaRectangle exists
            try {
                if (mediaRectProps && Object.keys(mediaRectProps).length > 0) {
                    nodeProperties.mediaRectangle = mediaRectProps;
                }
            } catch {
                // mediaRectProps might not be in scope if mediaRectangle didn't exist
            }
            
            // Store complete node structure for debugging
            allNodeData.nodeProperties = nodeProperties;
            allNodeData.nodeKeys = allKeys;
            allNodeData.nodeType = foundNode.type;
            
        } catch (propError) {
            debugLog("NODE_PROPERTIES_ERROR", { error: String(propError), stack: propError instanceof Error ? propError.stack?.substring(0, 300) : undefined }, "getImageSourceUrl");
        }

        // Prefer media-level URL over node-level URL
        const sourceUrl = mediaSourceUrl || nodeSourceUrl;

        // Helper function to sanitize data - remove any SDK objects that can't be serialized
        const sanitizeForSerialization = (obj: any, maxDepth: number = 5): any => {
            if (maxDepth <= 0) return '[Max depth reached]';
            if (obj === null || obj === undefined) return obj;
            
            // Skip SDK objects that can't be serialized
            if (typeof obj === 'object') {
                const objType = obj.constructor?.name || '';
                if (objType.includes('AddOnData') || objType.includes('Node') || objType.includes('MediaRectangle') || 
                    typeof (obj as any).getItem === 'function' || typeof (obj as any).keys === 'function') {
                    return '[SDK Object - cannot serialize]';
                }
                
                if (Array.isArray(obj)) {
                    return obj.map(item => sanitizeForSerialization(item, maxDepth - 1));
                }
                
                const sanitized: Record<string, any> = {};
                const keys = Object.keys(obj);
                for (const key of keys) {
                    try {
                        const value = (obj as any)[key];
                        // Skip functions and SDK objects
                        if (typeof value !== 'function') {
                            sanitized[key] = sanitizeForSerialization(value, maxDepth - 1);
                        }
                    } catch {}
                }
                return sanitized;
            }
            
            return obj;
        };

        const result: ImageUrlInfo = {
            nodeId: foundNode.id,
            type: foundNode.type,
            sourceUrl: sourceUrl,
            metadata: {
                nodeAddOnData: sanitizeForSerialization(nodeMetadata),
                mediaAddOnData: sanitizeForSerialization(mediaMetadata),
                nodeProperties: sanitizeForSerialization(nodeProperties),
                allNodeData: sanitizeForSerialization(allNodeData),
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
            sourceUrl: sourceUrl ? sourceUrl.substring(0, 100) : undefined,
            nodeMetadataKeys: Object.keys(nodeMetadata),
            mediaMetadataKeys: Object.keys(mediaMetadata),
            nodePropertyKeys: Object.keys(nodeProperties)
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
