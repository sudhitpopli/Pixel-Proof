import { createWorker, Worker, RecognizeResult } from 'tesseract.js';

/**
 * OCR Service for detecting and extracting text from images
 * Uses Tesseract.js for browser-based OCR processing
 */

// Type definition for ImageData (compatible with browser and canvas)
interface ImageDataLike {
    width: number;
    height: number;
    data: Uint8ClampedArray;
}

let worker: Worker | null = null;

export interface OCRResult {
    text: string;
    confidence: number;
    words?: Array<{
        text: string;
        confidence: number;
    }>;
}

/**
 * Initialize the Tesseract OCR worker
 * This should be called before performing OCR operations
 */
export async function initializeOCR(): Promise<void> {
    if (worker) {
        console.log("OCR worker already initialized");
        return;
    }

    try {
        console.log("Initializing Tesseract OCR worker...");
        worker = await createWorker('eng', 1, {
            logger: (m) => console.log('[Tesseract]', m)
        });
        console.log("OCR worker initialized successfully");
    } catch (error) {
        console.error("Failed to initialize OCR worker:", error);
        throw new Error(`OCR initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Extract text from image data using OCR
 * @param imageData - ImageData object containing the image to process
 * @returns OCR result with detected text and confidence score
 */
export async function extractTextFromImage(imageData: ImageDataLike): Promise<OCRResult> {
    if (!worker) {
        await initializeOCR();
    }

    try {
        console.log(`Processing image: ${imageData.width}x${imageData.height}`);

        const result: RecognizeResult = await worker!.recognize(imageData);

        const ocrResult: OCRResult = {
            text: result.data.text.trim(),
            confidence: result.data.confidence,
            words: result.data.words?.map(word => ({
                text: word.text,
                confidence: word.confidence
            })) || []
        };

        console.log(`OCR completed. Confidence: ${ocrResult.confidence.toFixed(2)}%`);
        console.log(`Detected text: "${ocrResult.text.substring(0, 100)}${ocrResult.text.length > 100 ? '...' : ''}"`);

        return ocrResult;
    } catch (error) {
        console.error("OCR processing failed:", error);
        throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Process multiple images with OCR
 * @param images - Array of ImageData objects
 * @returns Array of OCR results
 */
export async function extractTextFromMultipleImages(images: ImageDataLike[]): Promise<OCRResult[]> {
    if (!worker) {
        await initializeOCR();
    }

    const results: OCRResult[] = [];

    for (let i = 0; i < images.length; i++) {
        console.log(`Processing image ${i + 1} of ${images.length}`);
        try {
            const result = await extractTextFromImage(images[i]);
            results.push(result);
        } catch (error) {
            console.error(`Failed to process image ${i + 1}:`, error);
            // Add empty result for failed images
            results.push({
                text: '',
                confidence: 0,
                words: []
            });
        }
    }

    return results;
}

/**
 * Terminate the OCR worker to free up resources
 * Should be called when OCR operations are complete
 */
export async function terminateOCR(): Promise<void> {
    if (worker) {
        console.log("Terminating OCR worker...");
        await worker.terminate();
        worker = null;
        console.log("OCR worker terminated");
    }
}

/**
 * Check if OCR worker is initialized
 */
export function isOCRInitialized(): boolean {
    return worker !== null;
}
