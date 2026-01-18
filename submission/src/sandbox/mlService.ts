/**
 * ML Service for Hate Speech Detection using Hugging Face Models
 * Integrates with GroNLP/hateBERT and other models for compliance analysis
 */

import { HfInference } from '@huggingface/inference';

// Helper function to create a delay (works in both browser and sandbox environments)
function delay(ms: number): Promise<void> {
    return new Promise(resolve => {
        // Use globalThis.setTimeout which should be available in the sandbox
        const timer = (globalThis as any).setTimeout(() => resolve(), ms);
        // Fallback: if setTimeout doesn't exist, resolve immediately
        if (!timer) resolve();
    });
}

// Type declaration for fetch (may not be available in sandbox)
declare const fetch: typeof globalThis.fetch;

// ============================================================================
// Type Definitions
// ============================================================================

export interface MLConfig {
    apiKey?: string;
    model?: string;
    useCache?: boolean;
    timeout?: number;
    backendUrl?: string;  // Optional: Use backend server instead of direct HF API
}

export interface HateSpeechResult {
    label: string;
    score: number;
    isHateSpeech: boolean;
    confidence: number;
    model: string;
    timestamp: number;
}

export interface BatchHateSpeechResult {
    results: HateSpeechResult[];
    summary: {
        totalAnalyzed: number;
        hateSpeechCount: number;
        averageConfidence: number;
    };
}

export interface MLAnalysisResult {
    text: string;
    result: HateSpeechResult;
    error?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: MLConfig = {
    model: 'GroNLP/hateBERT',
    useCache: true,
    timeout: 30000 // 30 seconds
};

let currentConfig: MLConfig = { ...DEFAULT_CONFIG };
let hfClient: HfInference | null = null;

// Simple in-memory cache for results
const resultCache = new Map<string, HateSpeechResult>();
const CACHE_MAX_SIZE = 100;

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize ML service with configuration
 * @param config - ML service configuration
 */
export function initializeMLService(config: Partial<MLConfig>): void {
    currentConfig = {
        ...DEFAULT_CONFIG,
        ...config
    };

    if (currentConfig.apiKey) {
        hfClient = new HfInference(currentConfig.apiKey);
        console.log('ML Service initialized with Hugging Face API');
        console.log(`Using model: ${currentConfig.model}`);
    } else {
        console.warn('ML Service initialized without API key. Please configure API key before using.');
    }
}

/**
 * Get current ML service configuration
 * @returns Current configuration (API key masked)
 */
export function getMLConfig(): MLConfig {
    return {
        ...currentConfig,
        apiKey: currentConfig.apiKey ? '***' + currentConfig.apiKey.slice(-4) : undefined
    };
}

/**
 * Check if ML service is ready to use
 * @returns true if API key is configured
 */
export function isMLServiceReady(): boolean {
    return hfClient !== null && currentConfig.apiKey !== undefined;
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Generate cache key for text
 */
function getCacheKey(text: string, model: string): string {
    return `${model}:${text.substring(0, 100)}`;
}

/**
 * Get cached result if available
 */
function getCachedResult(text: string, model: string): HateSpeechResult | null {
    if (!currentConfig.useCache) return null;

    const key = getCacheKey(text, model);
    return resultCache.get(key) || null;
}

/**
 * Cache a result
 */
function cacheResult(text: string, model: string, result: HateSpeechResult): void {
    if (!currentConfig.useCache) return;

    const key = getCacheKey(text, model);

    // Simple LRU: if cache is full, remove oldest entry
    if (resultCache.size >= CACHE_MAX_SIZE) {
        const firstKey = resultCache.keys().next().value;
        resultCache.delete(firstKey);
    }

    resultCache.set(key, result);
}

/**
 * Clear the result cache
 */
export function clearMLCache(): void {
    resultCache.clear();
    console.log('ML result cache cleared');
}

// ============================================================================
// Implicit Claim Detection
// ============================================================================

export interface ClaimAnalysisResult {
    isClaim: boolean;
    primaryLabel: string;
    scores: Record<string, number>;
    model: string;
}

export async function detectImplicitClaims(text: string): Promise<ClaimAnalysisResult> {
    if (!currentConfig.backendUrl) {
        throw new Error('Claim analysis requires Backend Server URL configuration.');
    }

    try {
        const response = await fetch(`${currentConfig.backendUrl}/analyze-claims`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            throw new Error(`Backend error: ${response.status}`);
        }

        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        return data.result;
    } catch (error) {
        console.error('Claim analysis failed:', error);
        throw error;
    }
}

// ============================================================================
// Hate Speech Detection
// ============================================================================

/**
 * Detect hate speech in text using Hugging Face model
 * @param text - Text to analyze
 * @returns Hate speech detection result
 */
export async function detectHateSpeech(text: string): Promise<HateSpeechResult> {
    // Check if using backend server or direct HF API
    const useBackend = currentConfig.backendUrl && currentConfig.backendUrl.trim().length > 0;

    if (!useBackend && !isMLServiceReady()) {
        throw new Error(
            'ML Service not configured. Please set your Hugging Face API key or backend URL using configureMLService().'
        );
    }

    if (!text || text.trim().length === 0) {
        throw new Error('Cannot analyze empty text');
    }

    const model = currentConfig.model || DEFAULT_CONFIG.model!;

    // Check cache first
    const cached = getCachedResult(text, model);
    if (cached) {
        console.log('Returning cached result for text');
        return cached;
    }

    try {
        console.log(`Analyzing text with ${model}...`);
        console.log(`Text preview: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);

        let result: HateSpeechResult;

        if (useBackend) {
            // Use backend server
            console.log(`Using backend server: ${currentConfig.backendUrl}`);
            const response = await fetch(`${currentConfig.backendUrl}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            if (!response.ok) {
                throw new Error(`Backend server error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Backend analysis failed');
            }

            result = data.result;
        } else {
            // Use direct Hugging Face API
            const response = await hfClient!.textClassification({
                model: model,
                inputs: text
            });

            console.log('Raw API response:', response);

            // Process response
            let hateSpeechLabel: any = null;
            let notHateLabel: any = null;

            if (Array.isArray(response)) {
                // Find hate and not-hate labels
                for (const item of response) {
                    const label = item.label.toLowerCase();
                    if (label.includes('hate') && !label.includes('not')) {
                        hateSpeechLabel = item;
                    } else if (label.includes('not') || label.includes('normal') || label.includes('neither')) {
                        notHateLabel = item;
                    }
                }

                // Determine if it's hate speech
                const isHate = hateSpeechLabel && hateSpeechLabel.score > (notHateLabel?.score || 0);
                const primaryLabel = isHate ? hateSpeechLabel : (notHateLabel || response[0]);

                result = {
                    label: primaryLabel.label,
                    score: primaryLabel.score,
                    isHateSpeech: isHate,
                    confidence: primaryLabel.score * 100,
                    model: model,
                    timestamp: Date.now()
                };
            } else {
                throw new Error('Unexpected API response format');
            }
        }

        // Cache the result
        cacheResult(text, model, result);

        console.log(`Analysis complete: ${result.isHateSpeech ? 'HATE SPEECH' : 'NOT HATE SPEECH'} (${result.confidence.toFixed(1)}% confidence)`);

        return result;

    } catch (error) {
        console.error('Hate speech detection failed:', error);

        // Provide helpful error messages
        if (error instanceof Error) {
            if (error.message.includes('401') || error.message.includes('unauthorized')) {
                throw new Error('Invalid Hugging Face API key. Please check your API key and try again.');
            } else if (error.message.includes('429') || error.message.includes('rate limit')) {
                throw new Error('Rate limit exceeded. Please wait a moment and try again.');
            } else if (error.message.includes('timeout')) {
                throw new Error('Request timeout. The model may be loading. Please try again in a moment.');
            }
        }

        throw new Error(`Hate speech detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Detect hate speech in multiple texts (batch processing)
 * @param texts - Array of texts to analyze
 * @returns Batch analysis results
 */
export async function detectHateSpeechBatch(texts: string[]): Promise<BatchHateSpeechResult> {
    if (!isMLServiceReady()) {
        throw new Error('ML Service not configured. Please set your Hugging Face API key.');
    }

    if (!texts || texts.length === 0) {
        throw new Error('No texts provided for analysis');
    }

    console.log(`Starting batch analysis of ${texts.length} texts...`);

    const results: HateSpeechResult[] = [];
    let hateSpeechCount = 0;
    let totalConfidence = 0;

    // Process each text sequentially to avoid rate limiting
    for (let i = 0; i < texts.length; i++) {
        const text = texts[i];

        if (!text || text.trim().length === 0) {
            console.warn(`Skipping empty text at index ${i}`);
            continue;
        }

        try {
            console.log(`Analyzing text ${i + 1}/${texts.length}...`);
            const result = await detectHateSpeech(text);
            results.push(result);

            if (result.isHateSpeech) {
                hateSpeechCount++;
            }
            totalConfidence += result.confidence;

            // Add small delay to avoid rate limiting (500ms between requests)
            if (i < texts.length - 1) {
                await delay(500);
            }
        } catch (error) {
            console.error(`Failed to analyze text ${i + 1}:`, error);
            // Continue with other texts even if one fails
        }
    }

    const summary = {
        totalAnalyzed: results.length,
        hateSpeechCount,
        averageConfidence: results.length > 0 ? totalConfidence / results.length : 0
    };

    console.log(`Batch analysis complete: ${summary.totalAnalyzed} analyzed, ${summary.hateSpeechCount} flagged as hate speech`);

    return {
        results,
        summary
    };
}

/**
 * Analyze multiple text segments with metadata
 * @param textSegments - Array of text segments with metadata
 * @returns Array of analysis results
 */
export async function analyzeTextSegments(
    textSegments: Array<{ text: string; source?: string; id?: string }>
): Promise<MLAnalysisResult[]> {
    console.log(`Analyzing ${textSegments.length} text segments...`);

    const results: MLAnalysisResult[] = [];

    for (let i = 0; i < textSegments.length; i++) {
        const segment = textSegments[i];

        try {
            const result = await detectHateSpeech(segment.text);
            results.push({
                text: segment.text,
                result
            });
        } catch (error) {
            console.error(`Failed to analyze segment ${i + 1}:`, error);
            results.push({
                text: segment.text,
                result: {
                    label: 'error',
                    score: 0,
                    isHateSpeech: false,
                    confidence: 0,
                    model: currentConfig.model || DEFAULT_CONFIG.model!,
                    timestamp: Date.now()
                },
                error: error instanceof Error ? error.message : String(error)
            });
        }

        // Rate limiting delay
        if (i < textSegments.length - 1) {
            await delay(500);
        }
    }

    return results;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get model information
 */
export function getModelInfo(): { name: string; description: string; provider: string } {
    return {
        name: currentConfig.model || DEFAULT_CONFIG.model!,
        description: 'BERT-based hate speech detection model trained on hate speech datasets',
        provider: 'Hugging Face'
    };
}

/**
 * Test ML service connection
 */
export async function testMLService(): Promise<{ success: boolean; message: string }> {
    if (!isMLServiceReady()) {
        return {
            success: false,
            message: 'ML Service not configured. Please set your Hugging Face API key.'
        };
    }

    try {
        const testText = "This is a test message to verify the ML service is working correctly.";
        const result = await detectHateSpeech(testText);

        return {
            success: true,
            message: `ML Service is working! Test analysis completed with ${result.confidence.toFixed(1)}% confidence.`
        };
    } catch (error) {
        return {
            success: false,
            message: `ML Service test failed: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

console.log('ML Service module loaded - Hate speech detection available');
