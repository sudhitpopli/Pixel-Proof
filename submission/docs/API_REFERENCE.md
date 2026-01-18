# ComplianceGuard Pro - API Reference

## Sandbox API

The sandbox exposes the following methods to the UI via the runtime API proxy.

---

## `extractText()`

Extracts all text content from the Adobe Express document.

### Signature

```typescript
function extractText(): Promise<TextExtractionResult>
```

### Returns

```typescript
interface TextExtractionResult {
  success: boolean;        // Whether extraction succeeded
  textElements: string[];  // Array of extracted text strings
  count: number;          // Total number of text elements found
  error?: string;         // Error message if success is false
}
```

### Behavior

1. Accesses `editor.documentRoot`
2. Iterates through all pages in the document
3. For each page, iterates through all artboards
4. For each artboard, gets all children nodes
5. Filters for nodes with `type === "Text"`
6. Extracts text via `node.fullContent.text`
7. Returns array of all text strings found

### Example Usage

```typescript
// UI side
const result = await sandboxProxy.extractText();

if (result.success) {
  console.log(`Found ${result.count} text elements`);
  result.textElements.forEach((text, index) => {
    console.log(`#${index + 1}: ${text}`);
  });
} else {
  console.error(`Extraction failed: ${result.error}`);
}
```

### Success Response Example

```json
{
  "success": true,
  "textElements": [
    "Welcome to ComplianceGuard Pro",
    "Just Do It",
    "Contact: 4 Main Street"
  ],
  "count": 3
}
```

### Error Response Example

```json
{
  "success": false,
  "textElements": [],
  "count": 0,
  "error": "Cannot read property 'pages' of undefined"
}
```

### Error Handling

The function includes multiple levels of error handling:

1. **Node-level**: Catches errors when accessing individual text nodes
2. **Top-level**: Catches any errors during document traversal
3. **Graceful degradation**: Returns empty array on failure

### Console Logging

When executed, the function logs:

```
=== Starting Text Extraction ===
Document has 2 page(s)
Processing page: page-id-123
  Processing artboard: artboard-id-456
    Found 5 node(s)
      Found text: "Hello World"
      Found text: "Just Do It"
=== Extraction Complete ===
Total text elements found: 2
```

### Performance

- **Time Complexity**: O(n) where n = total nodes in document
- **Space Complexity**: O(m) where m = number of text nodes
- **Typical execution**: < 100ms for documents with < 100 nodes

---

## `getDocumentInfo()`

Retrieves metadata about the current document.

### Signature

```typescript
function getDocumentInfo(): Promise<DocumentInfo>
```

### Returns

```typescript
interface DocumentInfo {
  pageCount: number;    // Number of pages in document
  documentId: string;   // Unique document identifier
}
```

### Behavior

1. Accesses `editor.documentRoot`
2. Reads `doc.pages.length`
3. Reads `doc.id` (or returns "unknown" if not available)
4. Returns metadata object

### Example Usage

```typescript
// UI side
const info = await sandboxProxy.getDocumentInfo();
console.log(`Document ${info.documentId} has ${info.pageCount} pages`);
```

### Success Response Example

```json
{
  "pageCount": 3,
  "documentId": "doc-abc-123-xyz"
}
```

### Error Response Example

```json
{
  "pageCount": 0,
  "documentId": "error"
}
```

### Error Handling

Returns safe defaults on error:
- `pageCount`: 0
- `documentId`: "error"

---

## UI Components API

## `App` Component

Main application component that renders the UI and handles user interactions.

### Props

```typescript
interface AppProps {
  addOnUISdk: any;      // Adobe Express Add-on SDK instance
  sandboxProxy: any;    // Proxy to sandbox API
}
```

### State

```typescript
const [extractedText, setExtractedText] = useState<string[]>([]);
const [isExtracting, setIsExtracting] = useState(false);
const [error, setError] = useState<string | null>(null);
```

### Methods

#### `handleExtractText()`

Handles the "Extract Text" button click.

**Behavior**:
1. Sets `isExtracting` to true
2. Calls `sandboxProxy.extractText()`
3. Updates state with results or error
4. Sets `isExtracting` to false

**Error Handling**:
- Catches all errors
- Displays user-friendly error message
- Logs detailed error to console

---

## Adobe Express Document SDK

### Key Objects Used

#### `editor.documentRoot`

Root of the document tree.

**Type**: `DocumentRoot`

**Properties**:
- `pages`: `PageList` - Collection of all pages
- `id`: `string` - Unique document identifier

#### `PageNode`

Represents a page in the document.

**Properties**:
- `artboards`: `ArtboardList` - Collection of artboards
- `id`: `string` - Unique page identifier
- `width`: `number` - Page width
- `height`: `number` - Page height

#### `ArtboardNode`

Represents an artboard (canvas area) on a page.

**Properties**:
- `allChildren`: `Iterable<Node>` - All child nodes
- `id`: `string` - Unique artboard identifier
- `width`: `number` - Artboard width
- `height`: `number` - Artboard height

#### `TextNode`

Represents a text element.

**Properties**:
- `type`: `"Text"` - Node type identifier
- `fullContent`: `FullContent` - Text content and styling
- `id`: `string` - Unique node identifier

#### `FullContent`

Contains the actual text and formatting.

**Properties**:
- `text`: `string` - The actual text content
- `paragraphs`: `Paragraph[]` - Paragraph structure
- `characterStyleRanges`: `CharacterStyleRange[]` - Character formatting

---

## Runtime API Proxy

### Communication Pattern

```typescript
// UI side - Get proxy
const { runtime } = addOnUISdk.instance;
const sandboxProxy = await runtime.apiProxy("documentSandbox" as any);

// Call sandbox method
const result = await sandboxProxy.methodName();
```

```typescript
// Sandbox side - Expose API
addOnSandboxSdk.instance.runtime.exposeApi({
  methodName: async () => {
    // Implementation
    return result;
  }
});
```

### Type Safety

Currently using `as any` for TypeScript compatibility. The runtime type system doesn't include "documentSandbox" in the enum, but it's a valid runtime value.

---

## Error Codes

### Common Errors

| Error Message | Cause | Solution |
|--------------|-------|----------|
| "Cannot read property 'pages' of undefined" | Document not loaded | Wait for document to load |
| "Cannot read property 'fullContent' of undefined" | Invalid text node | Check node type before accessing |
| "Failed to fetch" | Sandbox communication error | Reload add-on |

---

## Future API (Planned)

### Phase 2: Detection API

```typescript
interface DetectionResult {
  violations: Violation[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

interface Violation {
  type: 'copyright' | 'cultural' | 'interpretation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  found: string;
  suggestion: string;
  alternatives?: string[];
}
```

### Phase 3+: Advanced API

```typescript
// ML-based detection
function detectWithML(text: string): Promise<MLDetectionResult>;

// External API integration
function checkTrademark(text: string): Promise<TrademarkResult>;

// PDF export
function generateReport(results: DetectionResult): Promise<Blob>;
```

---

## `crawlWebPage(url: string)`

Crawls a web page and extracts text content and images.

### Signature

```typescript
function crawlWebPage(url: string): Promise<CrawlResult>
```

### Parameters

- `url` (string): The URL of the web page to crawl. Must be a valid HTTP/HTTPS URL.

### Returns

```typescript
interface CrawlResult {
  url: string;                    // The crawled URL
  title: string;                  // Page title
  text: TextContent;              // Extracted text content
  images: ImageInfo[];            // Extracted images
  metadata: PageMetadata;         // Page metadata
  timestamp: number;              // Crawl timestamp (ms)
  error?: string;                 // Error message if crawl failed
}

interface TextContent {
  headings: string[];             // All headings (h1-h6)
  paragraphs: string[];           // All paragraphs
  lists: string[];                // All list items
  links: LinkInfo[];              // All links
  fullText: string;               // Combined text content
}

interface ImageInfo {
  url: string;                    // Absolute image URL
  alt: string;                    // Alt text
  title?: string;                 // Title attribute
  width?: number;                 // Image width
  height?: number;                // Image height
}

interface LinkInfo {
  text: string;                   // Link text
  href: string;                   // Link URL
  title?: string;                 // Title attribute
}

interface PageMetadata {
  description?: string;           // Meta description
  keywords?: string;              // Meta keywords
  author?: string;                // Meta author
  ogTitle?: string;               // Open Graph title
  ogDescription?: string;         // Open Graph description
  ogImage?: string;               // Open Graph image
}
```

### Behavior

1. Validates the URL for security (prevents SSRF attacks)
2. Enforces rate limiting (2 seconds between requests)
3. Attempts direct fetch, falls back to CORS proxy if needed
4. Parses HTML using DOMParser
5. Extracts text content (headings, paragraphs, lists, links)
6. Extracts images with absolute URLs
7. Extracts page metadata
8. Returns comprehensive crawl result

### Example Usage

```typescript
// UI side
const result = await sandboxProxy.crawlWebPage('https://example.com');

if (!result.error) {
  console.log(`Title: ${result.title}`);
  console.log(`Found ${result.text.headings.length} headings`);
  console.log(`Found ${result.images.length} images`);
  console.log(`Full text: ${result.text.fullText.substring(0, 200)}...`);
} else {
  console.error(`Crawl failed: ${result.error}`);
}
```

### Success Response Example

```json
{
  "url": "https://example.com",
  "title": "Example Domain",
  "text": {
    "headings": ["Example Domain"],
    "paragraphs": ["This domain is for use in illustrative examples..."],
    "lists": [],
    "links": [
      {
        "text": "More information...",
        "href": "https://www.iana.org/domains/example"
      }
    ],
    "fullText": "Example Domain This domain is for use in illustrative examples..."
  },
  "images": [
    {
      "url": "https://example.com/logo.png",
      "alt": "Example Logo",
      "width": 200,
      "height": 100
    }
  ],
  "metadata": {
    "description": "Example Domain for documentation",
    "keywords": "example, domain, documentation"
  },
  "timestamp": 1705401600000
}
```

### Error Response Example

```json
{
  "url": "https://invalid-url.com",
  "title": "",
  "text": {
    "headings": [],
    "paragraphs": [],
    "lists": [],
    "links": [],
    "fullText": ""
  },
  "images": [],
  "metadata": {},
  "timestamp": 1705401600000,
  "error": "Failed to fetch URL after 2 attempts. Last error: Network error"
}
```

### Security Features

- **URL Validation**: Blocks localhost, private IPs, and non-HTTP(S) protocols
- **SSRF Protection**: Prevents access to internal network resources
- **Rate Limiting**: Enforces 2-second delay between requests
- **Timeout**: 10-second timeout per request
- **Retry Logic**: Automatic retry with exponential backoff

### Limitations

- Cannot crawl JavaScript-rendered content (SPAs)
- CORS restrictions may require proxy fallback
- No authentication support (login-protected content)
- Rate limited to prevent abuse
- Maximum 10-second timeout per request

---

## `crawlMultiplePages(urls: string[])`

Crawls multiple web pages sequentially.

### Signature

```typescript
function crawlMultiplePages(urls: string[]): Promise<CrawlResult[]>
```

### Parameters

- `urls` (string[]): Array of URLs to crawl

### Returns

Array of `CrawlResult` objects (see `crawlWebPage` for structure)

### Behavior

1. Crawls each URL sequentially (not parallel)
2. Enforces rate limiting between requests
3. Continues on error (returns error result for failed URLs)
4. Returns array of results in same order as input

### Example Usage

```typescript
const urls = [
  'https://example.com',
  'https://example.org',
  'https://example.net'
];

const results = await sandboxProxy.crawlMultiplePages(urls);

results.forEach((result, index) => {
  if (!result.error) {
    console.log(`✓ ${urls[index]}: ${result.title}`);
  } else {
    console.log(`✗ ${urls[index]}: ${result.error}`);
  }
});
```

### Performance

- Sequential processing (not parallel)
- Rate limited to 1 request per 2 seconds
- Total time ≈ (number of URLs × 2 seconds) + fetch time
- Example: 5 URLs ≈ 10+ seconds

---

## ML Detection APIs

### `configureMLService(config: Partial<MLConfig>)`

Configures the ML service with Hugging Face API credentials and settings.

#### Signature

```typescript
function configureMLService(config: Partial<MLConfig>): void

interface MLConfig {
  apiKey?: string;        // Hugging Face API key
  model?: string;         // Model identifier (default: 'GroNLP/hateBERT')
  useCache?: boolean;     // Enable result caching (default: true)
  timeout?: number;       // Request timeout in ms (default: 30000)
}
```

#### Parameters

- `config.apiKey` (string): Hugging Face API key from https://huggingface.co/settings/tokens
- `config.model` (string, optional): Model to use (default: 'GroNLP/hateBERT')
- `config.useCache` (boolean, optional): Enable caching (default: true)
- `config.timeout` (number, optional): Timeout in milliseconds (default: 30000)

#### Example Usage

```typescript
await sandboxProxy.configureMLService({
  apiKey: 'hf_xxxxxxxxxxxxx',
  model: 'GroNLP/hateBERT',
  useCache: true
});
```

---

### `analyzeTextForHateSpeech(text: string)`

Analyzes a single text string for hate speech.

#### Signature

```typescript
function analyzeTextForHateSpeech(text: string): Promise<HateSpeechResult>

interface HateSpeechResult {
  label: string;          // Classification label (e.g., "hate", "not-hate")
  score: number;          // Raw confidence score (0-1)
  isHateSpeech: boolean;  // True if classified as hate speech
  confidence: number;     // Confidence percentage (0-100)
  model: string;          // Model used for detection
  timestamp: number;      // Analysis timestamp
}
```

#### Returns

```typescript
{
  label: "not-hate",
  score: 0.98,
  isHateSpeech: false,
  confidence: 98.0,
  model: "GroNLP/hateBERT",
  timestamp: 1705401600000
}
```

#### Example Usage

```typescript
const result = await sandboxProxy.analyzeTextForHateSpeech(
  "I love learning new things every day"
);

if (result.isHateSpeech) {
  console.log(`⚠️ Hate speech detected with ${result.confidence}% confidence`);
} else {
  console.log(`✅ Clean text (${result.confidence}% confidence)`);
}
```

---

### `analyzeDocumentForHateSpeech()`

Analyzes all text in the current Adobe Express document for hate speech.

#### Signature

```typescript
function analyzeDocumentForHateSpeech(): Promise<MLAnalysisResult>

interface MLAnalysisResult {
  success: boolean;
  results: Array<{
    text: string;
    result: HateSpeechResult;
    error?: string;
  }>;
  summary?: {
    totalAnalyzed: number;
    hateSpeechCount: number;
    cleanCount: number;
    averageConfidence: number;
  };
  error?: string;
}
```

#### Behavior

1. Extracts all text nodes from the document
2. Analyzes each text segment for hate speech
3. Returns detailed results with summary statistics
4. Applies rate limiting (500ms between requests)
5. Caches results for performance

#### Returns

```typescript
{
  success: true,
  results: [
    {
      text: "Welcome to our community",
      result: {
        label: "not-hate",
        score: 0.99,
        isHateSpeech: false,
        confidence: 99.0,
        model: "GroNLP/hateBERT",
        timestamp: 1705401600000
      }
    },
    {
      text: "I hate those people",
      result: {
        label: "hate",
        score: 0.92,
        isHateSpeech: true,
        confidence: 92.0,
        model: "GroNLP/hateBERT",
        timestamp: 1705401601000
      }
    }
  ],
  summary: {
    totalAnalyzed: 2,
    hateSpeechCount: 1,
    cleanCount: 1,
    averageConfidence: 95.5
  }
}
```

#### Example Usage

```typescript
const analysis = await sandboxProxy.analyzeDocumentForHateSpeech();

if (analysis.success) {
  console.log(`Analyzed ${analysis.summary.totalAnalyzed} text elements`);
  console.log(`Found ${analysis.summary.hateSpeechCount} instances of hate speech`);
  
  // Show flagged content
  const flagged = analysis.results.filter(r => r.result.isHateSpeech);
  flagged.forEach(item => {
    console.log(`⚠️ "${item.text}" (${item.result.confidence}% confidence)`);
  });
}
```

---

### `analyzeCrawledContentForHateSpeech(crawlResult: CrawlResult)`

Analyzes text from a crawled web page for hate speech.

#### Signature

```typescript
function analyzeCrawledContentForHateSpeech(
  crawlResult: CrawlResult
): Promise<MLAnalysisResult>
```

#### Parameters

- `crawlResult` (CrawlResult): Result from `crawlWebPage()` function

#### Behavior

1. Extracts text from headings, paragraphs, and lists
2. Analyzes each text segment for hate speech
3. Returns results with URL and page title in summary
4. Applies rate limiting between requests

#### Returns

Same as `analyzeDocumentForHateSpeech()`, with additional summary fields:
- `summary.url`: The crawled URL
- `summary.pageTitle`: The page title

#### Example Usage

```typescript
// First crawl a webpage
const crawlResult = await sandboxProxy.crawlWebPage('https://example.com');

// Then analyze the content
const analysis = await sandboxProxy.analyzeCrawledContentForHateSpeech(crawlResult);

if (analysis.success) {
  console.log(`Analyzed ${analysis.summary.url}`);
  console.log(`Page: ${analysis.summary.pageTitle}`);
  console.log(`Hate speech found: ${analysis.summary.hateSpeechCount}`);
}
```

---

### `getMLConfig()`

Gets the current ML service configuration (API key masked).

#### Signature

```typescript
function getMLConfig(): MLConfig
```

#### Returns

```typescript
{
  apiKey: "***xxxx",      // Masked API key (last 4 chars)
  model: "GroNLP/hateBERT",
  useCache: true,
  timeout: 30000
}
```

---

### `isMLServiceReady()`

Checks if the ML service is configured and ready to use.

#### Signature

```typescript
function isMLServiceReady(): boolean
```

#### Returns

`true` if API key is configured, `false` otherwise

#### Example Usage

```typescript
if (!await sandboxProxy.isMLServiceReady()) {
  console.log('Please configure your Hugging Face API key first');
}
```

---

### `testMLService()`

Tests the ML service connection with a sample text.

#### Signature

```typescript
function testMLService(): Promise<{ success: boolean; message: string }>
```

#### Returns

```typescript
{
  success: true,
  message: "ML Service is working! Test analysis completed with 98.5% confidence."
}
```

#### Example Usage

```typescript
const test = await sandboxProxy.testMLService();
console.log(test.message);
```

---

### `clearMLCache()`

Clears the ML result cache.

#### Signature

```typescript
function clearMLCache(): void
```

#### Example Usage

```typescript
sandboxProxy.clearMLCache();
console.log('ML cache cleared');
```

---

## Error Handling

### ML Detection Errors

| Error Message | Cause | Solution |
|--------------|-------|----------|
| "ML Service not configured" | No API key set | Call `configureMLService()` with API key |
| "Invalid Hugging Face API key" | Invalid or expired key | Check key at https://huggingface.co/settings/tokens |
| "Rate limit exceeded" | Too many requests | Wait and retry (automatic delay applied) |
| "Request timeout" | Model loading or slow response | Wait 30 seconds and retry |
| "Cannot analyze empty text" | Empty input | Provide non-empty text |

---

## Versioning

Current API Version: **1.2.0** (Phase 1 + Web Crawler + ML Detection)

### Changelog

#### v1.2.0 (2026-01-16)
- Added ML hate speech detection APIs
- Added `configureMLService()` method
- Added `analyzeTextForHateSpeech()` method
- Added `analyzeDocumentForHateSpeech()` method
- Added `analyzeCrawledContentForHateSpeech()` method
- Added `getMLConfig()`, `isMLServiceReady()`, `testMLService()`, `clearMLCache()` utilities
- Integrated GroNLP/hateBERT model from Hugging Face
- Result caching and rate limiting

#### v1.1.0 (2026-01-16)
- Added `crawlWebPage()` method
- Added `crawlMultiplePages()` method
- Web crawler with text and image extraction
- CORS proxy fallback support
- Security features (URL validation, SSRF protection)

#### v1.0.0 (2026-01-16)
- Initial release
- `extractText()` method
- `getDocumentInfo()` method
- Basic text extraction functionality

