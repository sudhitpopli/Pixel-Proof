/**
 * Web Crawler Service for extracting text and images from web pages
 * Supports compliance analysis of external web content
 */

// ============================================================================
// Environment Compatibility
// ============================================================================

// Type declarations for browser globals that may not be available in sandbox
declare const URL: typeof globalThis.URL;
declare const DOMParser: typeof globalThis.DOMParser;
declare const fetch: typeof globalThis.fetch;
declare const AbortController: typeof globalThis.AbortController;
declare const setTimeout: typeof globalThis.setTimeout;
declare const clearTimeout: typeof globalThis.clearTimeout;
declare const HTMLAnchorElement: typeof globalThis.HTMLAnchorElement;
declare const HTMLImageElement: typeof globalThis.HTMLImageElement;

/**
 * Check if browser APIs are available
 */
function checkEnvironment(): { available: boolean; missing: string[] } {
    const missing: string[] = [];

    if (typeof URL === 'undefined') missing.push('URL');
    if (typeof DOMParser === 'undefined') missing.push('DOMParser');
    if (typeof fetch === 'undefined') missing.push('fetch');
    if (typeof AbortController === 'undefined') missing.push('AbortController');

    return {
        available: missing.length === 0,
        missing
    };
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface CrawlResult {
    url: string;
    title: string;
    text: TextContent;
    images: ImageInfo[];
    metadata: PageMetadata;
    timestamp: number;
    error?: string;
}

export interface TextContent {
    headings: string[];
    paragraphs: string[];
    lists: string[];
    links: LinkInfo[];
    fullText: string;
}

export interface ImageInfo {
    url: string;
    alt: string;
    title?: string;
    width?: number;
    height?: number;
}

export interface LinkInfo {
    text: string;
    href: string;
    title?: string;
}

export interface PageMetadata {
    description?: string;
    keywords?: string;
    author?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
const REQUEST_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests

// ============================================================================
// URL Validation
// ============================================================================

/**
 * Validate and sanitize a URL
 * @param url - URL to validate
 * @returns true if URL is valid and safe
 */
export function validateURL(url: string): boolean {
    try {
        const urlObj = new URL(url);

        // Only allow HTTP and HTTPS protocols
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            console.warn(`Invalid protocol: ${urlObj.protocol}`);
            return false;
        }

        // Prevent localhost and private IP addresses (basic SSRF protection)
        const hostname = urlObj.hostname.toLowerCase();
        if (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('172.16.') ||
            hostname === '0.0.0.0'
        ) {
            console.warn(`Private/local address not allowed: ${hostname}`);
            return false;
        }

        return true;
    } catch (error) {
        console.error('URL validation error:', error);
        return false;
    }
}

/**
 * Convert relative URL to absolute URL
 * @param relativeUrl - Relative URL
 * @param baseUrl - Base URL
 * @returns Absolute URL
 */
export function resolveURL(relativeUrl: string, baseUrl: string): string {
    try {
        return new URL(relativeUrl, baseUrl).href;
    } catch (error) {
        console.warn(`Failed to resolve URL: ${relativeUrl}`, error);
        return relativeUrl;
    }
}

// ============================================================================
// HTTP Fetching
// ============================================================================

/**
 * Fetch HTML content with CORS handling and retry logic
 * @param url - URL to fetch
 * @param useCorsProxy - Whether to use CORS proxy
 * @returns HTML content as string
 */
async function fetchWithCORS(url: string, useCorsProxy: boolean = false): Promise<string> {
    const fetchUrl = useCorsProxy ? `${CORS_PROXY}${encodeURIComponent(url)}` : url;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        console.log(`Fetching: ${fetchUrl}`);

        const response = await fetch(fetchUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        console.log(`Fetched ${html.length} bytes from ${url}`);

        return html;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * Fetch HTML with automatic retry and CORS proxy fallback
 * @param url - URL to fetch
 * @returns HTML content
 */
async function fetchHTML(url: string): Promise<string> {
    let lastError: Error | null = null;

    // Try direct fetch first
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await fetchWithCORS(url, false);
        } catch (error) {
            lastError = error as Error;
            console.warn(`Direct fetch attempt ${attempt + 1} failed:`, error);

            if (attempt < MAX_RETRIES - 1) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
        }
    }

    // Fallback to CORS proxy
    console.log('Falling back to CORS proxy...');
    try {
        return await fetchWithCORS(url, true);
    } catch (error) {
        console.error('CORS proxy fetch failed:', error);
        throw new Error(
            `Failed to fetch URL after ${MAX_RETRIES} attempts. ` +
            `Last error: ${lastError?.message || 'Unknown error'}. ` +
            `CORS proxy also failed: ${(error as Error).message}`
        );
    }
}

// ============================================================================
// HTML Parsing
// ============================================================================

/**
 * Parse HTML and extract text content
 * @param html - HTML string
 * @returns Structured text content
 */
export function extractTextFromHTML(html: string): TextContent {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extract headings (h1-h6)
    const headings: string[] = [];
    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
        doc.querySelectorAll(tag).forEach(el => {
            const text = el.textContent?.trim();
            if (text) headings.push(text);
        });
    });

    // Extract paragraphs
    const paragraphs: string[] = [];
    doc.querySelectorAll('p').forEach(el => {
        const text = el.textContent?.trim();
        if (text) paragraphs.push(text);
    });

    // Extract lists
    const lists: string[] = [];
    doc.querySelectorAll('li').forEach(el => {
        const text = el.textContent?.trim();
        if (text) lists.push(text);
    });

    // Extract links
    const links: LinkInfo[] = [];
    doc.querySelectorAll('a[href]').forEach(el => {
        const anchor = el as any; // Type assertion for anchor element
        const text = anchor.textContent?.trim();
        const href = anchor.getAttribute('href');
        const title = anchor.getAttribute('title');

        if (text && href) {
            links.push({
                text,
                href,
                title: title || undefined
            });
        }
    });

    // Extract full text (body content)
    const body = doc.querySelector('body');
    const fullText = body?.textContent?.trim().replace(/\s+/g, ' ') || '';

    return {
        headings,
        paragraphs,
        lists,
        links,
        fullText
    };
}

/**
 * Extract images from HTML
 * @param html - HTML string
 * @param baseUrl - Base URL for resolving relative URLs
 * @returns Array of image information
 */
export function extractImagesFromHTML(html: string, baseUrl: string): ImageInfo[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const images: ImageInfo[] = [];
    const seenUrls = new Set<string>();

    // Extract from <img> tags
    doc.querySelectorAll('img[src]').forEach(el => {
        const img = el as any; // Type assertion for image element
        const src = img.getAttribute('src');

        if (src) {
            const absoluteUrl = resolveURL(src, baseUrl);

            // Avoid duplicates
            if (!seenUrls.has(absoluteUrl)) {
                seenUrls.add(absoluteUrl);

                images.push({
                    url: absoluteUrl,
                    alt: img.getAttribute('alt') || '',
                    title: img.getAttribute('title') || undefined,
                    width: img.width || undefined,
                    height: img.height || undefined
                });
            }
        }
    });

    // Extract from <picture> elements
    doc.querySelectorAll('picture source[srcset], picture img[src]').forEach(el => {
        const src = el.getAttribute('src') || el.getAttribute('srcset')?.split(',')[0]?.trim().split(' ')[0];

        if (src) {
            const absoluteUrl = resolveURL(src, baseUrl);

            if (!seenUrls.has(absoluteUrl)) {
                seenUrls.add(absoluteUrl);

                images.push({
                    url: absoluteUrl,
                    alt: el.getAttribute('alt') || '',
                    title: el.getAttribute('title') || undefined
                });
            }
        }
    });

    console.log(`Extracted ${images.length} unique images`);

    return images;
}

/**
 * Extract page metadata
 * @param html - HTML string
 * @returns Page metadata
 */
export function extractMetadata(html: string): PageMetadata {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const getMetaContent = (name: string): string | undefined => {
        const meta = doc.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
        return meta?.getAttribute('content') || undefined;
    };

    return {
        description: getMetaContent('description'),
        keywords: getMetaContent('keywords'),
        author: getMetaContent('author'),
        ogTitle: getMetaContent('og:title'),
        ogDescription: getMetaContent('og:description'),
        ogImage: getMetaContent('og:image')
    };
}

// ============================================================================
// Main Crawler Function
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
 * Crawl a web page and extract text and images
 * @param url - URL to crawl
 * @returns Crawl result with extracted content
 */
export async function crawlWebPage(url: string): Promise<CrawlResult> {
    console.log(`Starting crawl for: ${url}`);

    // Validate URL
    if (!validateURL(url)) {
        return {
            url,
            title: '',
            text: { headings: [], paragraphs: [], lists: [], links: [], fullText: '' },
            images: [],
            metadata: {},
            timestamp: Date.now(),
            error: 'Invalid or unsafe URL'
        };
    }

    try {
        // Enforce rate limiting
        await enforceRateLimit();

        // Fetch HTML
        const html = await fetchHTML(url);

        // Parse HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract title
        const title = doc.querySelector('title')?.textContent?.trim() || 'Untitled';

        // Extract content
        const text = extractTextFromHTML(html);
        const images = extractImagesFromHTML(html, url);
        const metadata = extractMetadata(html);

        const result: CrawlResult = {
            url,
            title,
            text,
            images,
            metadata,
            timestamp: Date.now()
        };

        console.log(`Crawl completed successfully for: ${url}`);
        console.log(`- Title: ${title}`);
        console.log(`- Headings: ${text.headings.length}`);
        console.log(`- Paragraphs: ${text.paragraphs.length}`);
        console.log(`- Images: ${images.length}`);

        return result;

    } catch (error) {
        console.error(`Crawl failed for ${url}:`, error);

        return {
            url,
            title: '',
            text: { headings: [], paragraphs: [], lists: [], links: [], fullText: '' },
            images: [],
            metadata: {},
            timestamp: Date.now(),
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Crawl multiple web pages
 * @param urls - Array of URLs to crawl
 * @returns Array of crawl results
 */
export async function crawlMultiplePages(urls: string[]): Promise<CrawlResult[]> {
    console.log(`Crawling ${urls.length} pages...`);

    const results: CrawlResult[] = [];

    for (let i = 0; i < urls.length; i++) {
        console.log(`\nCrawling page ${i + 1}/${urls.length}: ${urls[i]}`);
        const result = await crawlWebPage(urls[i]);
        results.push(result);
    }

    console.log(`\nCompleted crawling ${urls.length} pages`);
    return results;
}
