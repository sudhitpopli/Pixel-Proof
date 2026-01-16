/**
 * Cloud OCR Service for extracting text from images using cloud APIs
 * Supports multiple OCR providers with fallback options
 */

// ============================================================================
// Environment Compatibility
// ============================================================================

// Type declarations for browser globals that may not be available in sandbox
declare const fetch: typeof globalThis.fetch;
declare const AbortController: typeof globalThis.AbortController;
declare const setTimeout: typeof globalThis.setTimeout;
declare const clearTimeout: typeof globalThis.clearTimeout;
declare const btoa: typeof globalThis.btoa;
declare const FormData: typeof globalThis.FormData;

/**
 * Check if browser APIs are available
 */
function checkEnvironment(): { available: boolean; missing: string[] } {
    const missing: string[] = [];

    if (typeof fetch === 'undefined') missing.push('fetch');
    if (typeof AbortController === 'undefined') missing.push('AbortController');
    if (typeof btoa === 'undefined') missing.push('btoa');

    return {
        available: missing.length === 0,
        missing
    };
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface OCRResult {
    text: string;
    confidence: number;
    words?: OCRWord[];
    lines?: OCRLine[];
    provider: string;
    processingTime?: number;
    error?: string;
}

export interface OCRWord {
    text: string;
    confidence: number;
    boundingBox?: BoundingBox;
}

export interface OCRLine {
    text: string;
    confidence: number;
    words: OCRWord[];
}

export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface OCRConfig {
    apiKey?: string;
    provider: 'ocrspace' | 'google' | 'azure';
    language?: string;
    detectOrientation?: boolean;
    scale?: boolean;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: OCRConfig = {
    provider: 'ocrspace',
    language: 'eng',
    detectOrientation: true,
    scale: true
};

// OCR.space API (Free tier: 25,000 requests/month)
const OCRSPACE_API_URL = 'https://api.ocr.space/parse/image';
const OCRSPACE_FREE_API_KEY = 'K87899142388957'; // Public demo key

// Request configuration
const REQUEST_TIMEOUT = 30000; // 30 seconds for OCR processing
const MAX_RETRIES = 2;
const RETRY_DELAY = 2000; // 2 seconds

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

// ============================================================================
// Configuration Management
// ============================================================================

let currentConfig: OCRConfig = { ...DEFAULT_CONFIG };

/**
 * Initialize cloud OCR with configuration
 * @param config - OCR configuration
 */
export function initializeCloudOCR(config: Partial<OCRConfig> = {}): void {
    currentConfig = {
        ...DEFAULT_CONFIG,
        ...config
    };

    console.log('Cloud OCR initialized with config:', {
        provider: currentConfig.provider,
        language: currentConfig.language,
        hasApiKey: !!currentConfig.apiKey
    });
}

/**
 * Get current OCR configuration
 */
export function getOCRConfig(): OCRConfig {
    return { ...currentConfig };
}

// ============================================================================
// Image Processing
// ============================================================================

/**
 * Convert ImageData to base64 string
 * @param imageData - ImageData object
 * @returns Base64 encoded image
 */
export function imageDataToBase64(imageData: { width: number; height: number; data: Uint8ClampedArray }): string {
    // Create canvas to convert ImageData to base64
    // Note: This won't work in sandbox, but we'll handle it gracefully
    try {
        const canvas = (globalThis as any).document?.createElement('canvas');
        if (!canvas) {
            throw new Error('Canvas not available in this environment');
        }

        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('Canvas context not available');
        }

        // Put image data on canvas
        const imgData = ctx.createImageData(imageData.width, imageData.height);
        imgData.data.set(imageData.data);
        ctx.putImageData(imgData, 0, 0);

        // Convert to base64
        return canvas.toDataURL('image/png').split(',')[1];
    } catch (error) {
        console.error('Failed to convert ImageData to base64:', error);
        throw new Error('Image conversion not supported in this environment. Use base64 image directly.');
    }
}

// ============================================================================
// OCR.space API Integration
// ============================================================================

/**
 * Extract text using OCR.space API
 * @param base64Image - Base64 encoded image
 * @returns OCR result
 */
async function extractWithOCRSpace(base64Image: string): Promise<OCRResult> {
    const apiKey = currentConfig.apiKey || OCRSPACE_FREE_API_KEY;
    const startTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        console.log('Calling OCR.space API...');

        // Prepare form data
        const formData = new FormData();
        formData.append('base64Image', `data:image/png;base64,${base64Image}`);
        formData.append('apikey', apiKey);
        formData.append('language', currentConfig.language || 'eng');
        formData.append('detectOrientation', String(currentConfig.detectOrientation));
        formData.append('scale', String(currentConfig.scale));
        formData.append('OCREngine', '2'); // Use OCR Engine 2 for better accuracy

        const response = await fetch(OCRSPACE_API_URL, {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.IsErroredOnProcessing) {
            throw new Error(result.ErrorMessage?.[0] || 'OCR processing failed');
        }

        if (!result.ParsedResults || result.ParsedResults.length === 0) {
            throw new Error('No text found in image');
        }

        const parsedResult = result.ParsedResults[0];
        const text = parsedResult.ParsedText || '';
        const processingTime = Date.now() - startTime;

        // Extract words with confidence (if available)
        const words: OCRWord[] = [];
        if (parsedResult.TextOverlay?.Lines) {
            parsedResult.TextOverlay.Lines.forEach((line: any) => {
                line.Words?.forEach((word: any) => {
                    words.push({
                        text: word.WordText,
                        confidence: word.Confidence || 0,
                        boundingBox: word.Left !== undefined ? {
                            x: word.Left,
                            y: word.Top,
                            width: word.Width,
                            height: word.Height
                        } : undefined
                    });
                });
            });
        }

        // Calculate average confidence
        const avgConfidence = words.length > 0
            ? words.reduce((sum, w) => sum + w.confidence, 0) / words.length
            : (parsedResult.FileParseExitCode === 1 ? 95 : 0);

        console.log(`OCR.space completed in ${processingTime}ms`);
        console.log(`Extracted text length: ${text.length} characters`);
        console.log(`Average confidence: ${avgConfidence.toFixed(2)}%`);

        return {
            text: text.trim(),
            confidence: avgConfidence,
            words: words.length > 0 ? words : undefined,
            provider: 'ocrspace',
            processingTime
        };

    } catch (error) {
        clearTimeout(timeoutId);
        console.error('OCR.space API error:', error);
        throw error;
    }
}

// ============================================================================
// Main OCR Functions
// ============================================================================

/**
 * Rate limiting helper
 */
async function enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
        console.log(`Rate limiting: waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    lastRequestTime = Date.now();
}

/**
 * Extract text from base64 encoded image using cloud OCR
 * @param base64Image - Base64 encoded image (without data URI prefix)
 * @returns OCR result with extracted text
 */
export async function extractTextFromBase64(base64Image: string): Promise<OCRResult> {
    console.log('Starting cloud OCR extraction...');

    // Check environment
    const env = checkEnvironment();
    if (!env.available) {
        return {
            text: '',
            confidence: 0,
            provider: currentConfig.provider,
            error: `Cloud OCR requires browser APIs: ${env.missing.join(', ')}`
        };
    }

    // Remove data URI prefix if present
    const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');

    try {
        // Enforce rate limiting
        await enforceRateLimit();

        // Try OCR with retries
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                switch (currentConfig.provider) {
                    case 'ocrspace':
                        return await extractWithOCRSpace(cleanBase64);

                    case 'google':
                        throw new Error('Google Cloud Vision API not yet implemented');

                    case 'azure':
                        throw new Error('Azure Computer Vision API not yet implemented');

                    default:
                        throw new Error(`Unknown OCR provider: ${currentConfig.provider}`);
                }
            } catch (error) {
                lastError = error as Error;
                console.warn(`OCR attempt ${attempt + 1} failed:`, error);

                if (attempt < MAX_RETRIES - 1) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                }
            }
        }

        // All retries failed
        throw new Error(
            `OCR failed after ${MAX_RETRIES} attempts. Last error: ${lastError?.message || 'Unknown error'}`
        );

    } catch (error) {
        console.error('Cloud OCR extraction failed:', error);

        return {
            text: '',
            confidence: 0,
            provider: currentConfig.provider,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Extract text from ImageData using cloud OCR
 * @param imageData - ImageData object
 * @returns OCR result
 */
export async function extractTextFromImageData(
    imageData: { width: number; height: number; data: Uint8ClampedArray }
): Promise<OCRResult> {
    try {
        const base64 = imageDataToBase64(imageData);
        return await extractTextFromBase64(base64);
    } catch (error) {
        console.error('Failed to process ImageData:', error);
        return {
            text: '',
            confidence: 0,
            provider: currentConfig.provider,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Extract text from image URL using cloud OCR
 * @param imageUrl - URL of the image
 * @returns OCR result
 */
export async function extractTextFromImageURL(imageUrl: string): Promise<OCRResult> {
    const apiKey = currentConfig.apiKey || OCRSPACE_FREE_API_KEY;
    const startTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        console.log(`Processing image URL: ${imageUrl}`);

        await enforceRateLimit();

        const formData = new FormData();
        formData.append('url', imageUrl);
        formData.append('apikey', apiKey);
        formData.append('language', currentConfig.language || 'eng');
        formData.append('detectOrientation', String(currentConfig.detectOrientation));
        formData.append('scale', String(currentConfig.scale));
        formData.append('OCREngine', '2');

        const response = await fetch(OCRSPACE_API_URL, {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.IsErroredOnProcessing) {
            throw new Error(result.ErrorMessage?.[0] || 'OCR processing failed');
        }

        if (!result.ParsedResults || result.ParsedResults.length === 0) {
            return {
                text: '',
                confidence: 0,
                provider: 'ocrspace',
                processingTime: Date.now() - startTime
            };
        }

        const parsedResult = result.ParsedResults[0];
        const text = parsedResult.ParsedText || '';
        const processingTime = Date.now() - startTime;

        console.log(`OCR completed in ${processingTime}ms for URL: ${imageUrl}`);

        return {
            text: text.trim(),
            confidence: parsedResult.FileParseExitCode === 1 ? 95 : 0,
            provider: 'ocrspace',
            processingTime
        };

    } catch (error) {
        clearTimeout(timeoutId);
        console.error('OCR from URL failed:', error);

        return {
            text: '',
            confidence: 0,
            provider: 'ocrspace',
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Process multiple images with OCR
 * @param imageUrls - Array of image URLs
 * @returns Array of OCR results
 */
export async function extractTextFromMultipleImages(imageUrls: string[]): Promise<OCRResult[]> {
    console.log(`Processing ${imageUrls.length} images with cloud OCR...`);

    const results: OCRResult[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
        console.log(`Processing image ${i + 1}/${imageUrls.length}`);
        const result = await extractTextFromImageURL(imageUrls[i]);
        results.push(result);
    }

    console.log(`Completed processing ${imageUrls.length} images`);
    return results;
}
