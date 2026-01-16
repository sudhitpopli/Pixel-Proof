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

## Versioning

Current API Version: **1.0.0** (Phase 1)

### Changelog

#### v1.0.0 (2026-01-16)
- Initial release
- `extractText()` method
- `getDocumentInfo()` method
- Basic text extraction functionality
