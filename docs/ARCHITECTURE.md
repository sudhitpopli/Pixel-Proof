# ComplianceGuard Pro - Architecture Documentation

## Overview

ComplianceGuard Pro is an Adobe Express add-on that detects compliance risks in designs across copyright, cultural sensitivity, and interpretation domains.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Adobe Express                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                  Add-on Panel (UI)                      │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │           React Application                       │  │ │
│  │  │  - App.tsx (Main UI Component)                   │  │ │
│  │  │  - Button controls                               │  │ │
│  │  │  - Results display                               │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                        ↕                                │ │
│  │              Runtime API Proxy                          │ │
│  │                        ↕                                │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │        Document Sandbox (Isolated)               │  │ │
│  │  │  - code.ts (Document API access)                 │  │ │
│  │  │  - Text extraction logic                         │  │ │
│  │  │  - Document traversal                            │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                        ↕                                │ │
│  │              Adobe Express Document SDK                 │ │
│  │                        ↕                                │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │          Document Structure                       │  │ │
│  │  │  - Pages → Artboards → Nodes                     │  │ │
│  │  │  - Text nodes with fullContent                   │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. UI Layer (`src/ui/`)

**Purpose**: User interface and interaction handling

**Components**:
- `index.tsx` - Entry point, initializes SDK and sandbox connection
- `components/App.tsx` - Main application component
- `components/App.css` - Styling

**Key Responsibilities**:
- Render user interface
- Handle user interactions
- Display results
- Communicate with sandbox via API proxy

**Technology Stack**:
- React 18
- TypeScript
- Adobe Spectrum Web Components
- Webpack

### 2. Sandbox Layer (`src/sandbox/`)

**Purpose**: Secure document access and data extraction

**Components**:
- `code.ts` - Document API integration

**Key Responsibilities**:
- Access Adobe Express document structure
- Iterate through pages and artboards
- Extract text from Text nodes
- Return structured data to UI

**Security Model**:
- Runs in isolated sandbox environment
- No direct DOM access
- Communication only via runtime API proxy

### 3. Document Structure

Adobe Express documents follow this hierarchy:

```
DocumentRoot
└── Pages (PageList)
    └── Page (PageNode)
        └── Artboards (ArtboardList)
            └── Artboard (ArtboardNode)
                └── Children (Nodes)
                    ├── Text (TextNode)
                    ├── Rectangle (RectangleNode)
                    ├── MediaContainer (ImageNode)
                    └── ... (other node types)
```

## Data Flow

### Text Extraction Flow

```
1. User clicks "Extract Text" button
   ↓
2. App.tsx calls sandboxProxy.extractText()
   ↓
3. Runtime API Proxy forwards to sandbox
   ↓
4. code.ts accesses editor.documentRoot
   ↓
5. Iterates: pages → artboards → allChildren
   ↓
6. For each Text node:
   - Access node.fullContent.text
   - Add to results array
   ↓
7. Return { success, textElements, count }
   ↓
8. UI receives results and displays
```

## API Communication

### UI to Sandbox Communication

**Method**: Runtime API Proxy (asynchronous)

**Example**:
```typescript
// UI side (index.tsx)
const sandboxProxy = await runtime.apiProxy("documentSandbox");

// Call sandbox function
const result = await sandboxProxy.extractText();
```

**Sandbox side (code.ts)**:
```typescript
// Expose API
addOnSandboxSdk.instance.runtime.exposeApi({
  extractText,
  getDocumentInfo
});
```

## Current Implementation (Phase 1)

### Features Implemented

✅ **Text Extraction**
- Iterates through all pages
- Processes all artboards
- Extracts text from Text nodes
- Returns structured results

✅ **Error Handling**
- Try-catch blocks at multiple levels
- Detailed error logging
- Graceful degradation

✅ **User Interface**
- Clean, simple UI
- Loading states
- Results display
- Error messages

### API Reference

#### `extractText()`

**Returns**: `Promise<TextExtractionResult>`

```typescript
interface TextExtractionResult {
  success: boolean;
  textElements: string[];
  count: number;
  error?: string;
}
```

**Example Response**:
```json
{
  "success": true,
  "textElements": [
    "Hello World",
    "Just Do It",
    "Contact us at 4 Main Street"
  ],
  "count": 3
}
```

#### `getDocumentInfo()`

**Returns**: `Promise<DocumentInfo>`

```typescript
interface DocumentInfo {
  pageCount: number;
  documentId: string;
}
```

## Performance Considerations

### Current Implementation

- **Synchronous iteration**: Processes nodes sequentially
- **Memory usage**: Stores all text in array
- **Time complexity**: O(n) where n = total nodes

### Optimization Opportunities (Future)

1. **Streaming results**: Return text as found
2. **Parallel processing**: Process pages concurrently
3. **Caching**: Cache document structure
4. **Lazy loading**: Load results on demand

## Security Model

### Sandbox Isolation

The sandbox environment:
- ✅ Cannot access browser DOM
- ✅ Cannot make network requests directly
- ✅ Cannot access local file system
- ✅ Limited to Document API only

### Data Privacy

- No data sent to external servers
- All processing happens locally
- No persistent storage (Phase 1)

## Error Handling Strategy

### Levels of Error Handling

1. **Node-level**: Individual text node extraction
2. **Artboard-level**: Artboard processing
3. **Page-level**: Page iteration
4. **Function-level**: Top-level try-catch

### Error Reporting

- Console logging at each level
- Structured error objects
- User-friendly error messages

## Future Architecture (Phases 2-5)

### Phase 2: Detection Logic
```
UI Layer
  ↓
Detection Services (inline in App.tsx)
  - Slogan detection
  - Pattern matching
  ↓
Results Dashboard
```

### Phase 3+: Advanced Features
```
UI Layer
  ↓
Service Layer (separate files)
  - Copyright detection
  - Cultural analysis
  - Interpretation risk
  ↓
ML Models (optional)
  - NLP processing
  - Pattern recognition
  ↓
External APIs (optional)
  - Trademark databases
  - Translation services
```

## Technology Decisions

### Why React?
- Adobe Spectrum components built for React
- Strong TypeScript support
- Large ecosystem

### Why Sandbox Architecture?
- Security requirement from Adobe
- Prevents malicious document access
- Isolates add-on from main app

### Why Inline Detection (Phase 2)?
- Simpler to debug
- Faster to implement
- Avoid premature abstraction

## Build System

### Webpack Configuration

**Entry Points**:
- `src/ui/index.tsx` → `dist/index.js`
- `src/sandbox/code.ts` → `dist/code.js`

**Output**:
- Bundled JavaScript
- Source maps for debugging
- Manifest.json (copied)

### Build Process

```bash
npm run build
  ↓
ccweb-add-on-scripts build --use webpack
  ↓
1. Clean dist/
2. Compile TypeScript
3. Bundle with Webpack
4. Copy static assets
  ↓
dist/ (ready for Adobe Express)
```

## Deployment

### Development
1. Build project: `npm run build`
2. Load in Adobe Express via Developer Mode
3. Test with sample documents

### Production (Future)
1. Build optimized bundle
2. Submit to Adobe Express Marketplace
3. Review and approval process

## Monitoring & Debugging

### Console Logging Strategy

**Sandbox logs**:
```
=== Starting Text Extraction ===
Document has X page(s)
Processing page: [id]
  Processing artboard: [id]
    Found X node(s)
      Found text: "..."
=== Extraction Complete ===
```

**UI logs**:
```
Calling extractText from sandbox...
Extraction result: {...}
```

### Debug Tools

- Chrome DevTools for UI
- Console logs for sandbox
- Network tab for API proxy calls

## Glossary

- **Artboard**: Canvas area within a page
- **Node**: Element in document tree
- **Sandbox**: Isolated execution environment
- **Runtime API Proxy**: Communication bridge
- **Document SDK**: Adobe's document manipulation API
