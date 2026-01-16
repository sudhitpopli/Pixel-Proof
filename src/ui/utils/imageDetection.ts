/**
 * Image Detection Utility
 * Captures screenshot and detects images with their URLs
 * Includes comprehensive debugging at every step
 */

// ============================================================================
// Debug Utilities
// ============================================================================

function debugLog(step: string, data: any, context?: string): void {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` [${context}]` : '';
    console.log(`[IMAGE_DETECT_UI${contextStr}] ${timestamp} | ${step}:`, data);
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface DetectedImage {
    description: string;
    position: string;
    type: string;
    confidence: number;
    branding?: string;
}

export interface ImageUrlResult {
    url: string;
    source: 'visual_match' | 'inline_image' | 'related_image' | 'document_node';
    title: string;
    thumbnail?: string;
    serpapiIndex?: number;
    nodeId?: string;
    metadata?: any;
}

export interface ImageDetectionResult {
    success: boolean;
    detectedImages?: DetectedImage[];
    imageUrls?: ImageUrlResult[];
    geminiAnalysis?: any;
    serpApiResults?: any;
    nodeImageUrls?: any[];
    nodeMetadataDetails?: any[];
    results?: {
        detectedImages?: DetectedImage[];
        imageUrls?: ImageUrlResult[];
        summary?: {
            totalImagesDetected: number;
            totalUrlsFound: number;
            urlsFromNodes?: number;
            urlsFromSerpAPI?: number;
        };
    };
    summary?: {
        totalImagesDetected: number;
        totalUrlsFound: number;
        urlsFromNodes?: number;
        urlsFromSerpAPI?: number;
    };
    error?: string;
    debugLogs?: any[];
}

// ============================================================================
// Screenshot Capture (Simple version without html2canvas dependency)
// ============================================================================

/**
 * Capture screenshot using canvas API
 * This is a simplified version - for full browser support, install html2canvas
 */
async function captureScreenshotSimple(): Promise<string | null> {
    debugLog("START", {}, "captureScreenshotSimple");
    
    try {
        // Try to use html2canvas if available
        let html2canvas: any = null;
        try {
            html2canvas = (await import('html2canvas')).default;
            debugLog("HTML2CANVAS_AVAILABLE", {}, "captureScreenshotSimple");
        } catch (error) {
            debugLog("HTML2CANVAS_NOT_AVAILABLE", { error: String(error) }, "WARNING");
        }

        if (html2canvas) {
            // Find target element
            const selectors = [
                '[data-testid="canvas"]',
                '.canvas-container',
                '#canvas',
                'body'
            ];

            let targetElement: HTMLElement | null = null;
            for (const selector of selectors) {
                targetElement = document.querySelector(selector);
                if (targetElement) {
                    debugLog("TARGET_FOUND", { selector }, "captureScreenshotSimple");
                    break;
                }
            }

            if (!targetElement) {
                targetElement = document.body;
            }

            const canvas = await html2canvas(targetElement, {
                useCORS: true,
                logging: false,
                scale: 1,
                backgroundColor: '#ffffff'
            });

            const base64 = canvas.toDataURL('image/png');
            const base64Data = base64.split(',')[1];
            
            debugLog("SCREENSHOT_CAPTURED", { 
                length: base64Data.length,
                method: "html2canvas"
            }, "captureScreenshotSimple");

            return base64Data;
        } else {
            debugLog("NO_SCREENSHOT_METHOD", {}, "ERROR");
            return null;
        }

    } catch (error) {
        debugLog("CAPTURE_ERROR", { 
            error: String(error),
            stack: error instanceof Error ? error.stack?.substring(0, 200) : undefined
        }, "ERROR");
        return null;
    }
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Main function to detect images in screenshot and get their URLs
 * @param screenshotBase64 - Base64 encoded screenshot (optional, will capture if not provided)
 * @param backendUrl - URL of the backend server
 * @param services - Array of services to use: 'gemini', 'serpapi'
 * @returns ImageDetectionRexsult with detected images and URLs
 */
export async function detectImagesInScreenshot(
    screenshotBase64?: string,
    backendUrl: string = 'http://localhost:3000',
    services: string[] = ['gemini', 'serpapi']
): Promise<ImageDetectionResult> {
    debugLog("START", { 
        hasScreenshot: !!screenshotBase64,
        backendUrl,
        services 
    }, "detectImagesInScreenshot");

    const debugLogs: any[] = [];
    const addDebugLog = (step: string, data: any) => {
        debugLogs.push({ step, timestamp: new Date().toISOString(), data });
        debugLog(step, data, "detectImagesInScreenshot");
    };

    try {
        // Capture screenshot if not provided
        let screenshot = screenshotBase64;
        
        if (!screenshot) {
            addDebugLog("CAPTURING_SCREENSHOT", {});
            screenshot = await captureScreenshotSimple();
            
            if (!screenshot) {
                return {
                    success: false,
                    error: "Failed to capture screenshot. Please install html2canvas: npm install html2canvas",
                    debugLogs
                };
            }
            
            addDebugLog("SCREENSHOT_CAPTURED", { length: screenshot.length });
        } else {
            addDebugLog("USING_PROVIDED_SCREENSHOT", { length: screenshot.length });
        }

        // Send to backend
        addDebugLog("SENDING_TO_BACKEND", { 
            backendUrl,
            services 
        });

        const response = await fetch(`${backendUrl}/detect-images-in-screenshot`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                screenshot_base64: screenshot,
                services: services
            })
        });

        addDebugLog("RESPONSE_RECEIVED", {
            status: response.status,
            statusText: response.statusText
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            addDebugLog("ERROR_RESPONSE", errorData);
            return {
                success: false,
                error: `Backend returned error: ${response.status} ${response.statusText}`,
                debugLogs: [...debugLogs, ...(errorData.debugLogs || [])]
            };
        }

        const result = await response.json();
        addDebugLog("SUCCESS", {
            imagesDetected: result.results?.summary?.totalImagesDetected || 0,
            urlsFound: result.results?.summary?.totalUrlsFound || 0
        });

        // Merge backend debug logs
        if (result.debugLogs) {
            debugLogs.push(...result.debugLogs);
        }

        return {
            success: result.success,
            detectedImages: result.results?.detectedImages,
            imageUrls: result.results?.imageUrls,
            geminiAnalysis: result.results?.geminiAnalysis,
            serpApiResults: result.results?.serpApiResults,
            summary: result.results?.summary,
            error: result.error,
            debugLogs
        };

    } catch (error) {
        addDebugLog("FATAL_ERROR", {
            error: String(error),
            stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined
        });
        return {
            success: false,
            error: `Unexpected error: ${String(error)}`,
            debugLogs
        };
    }
}
