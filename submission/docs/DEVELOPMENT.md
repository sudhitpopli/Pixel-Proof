# ComplianceGuard Pro - Development Guide

## Getting Started

### Prerequisites

- **Node.js**: v16 or higher
- **npm**: v7 or higher
- **Adobe Express**: Account with developer access
- **Git**: For version control

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Pixel-Proof
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Load in Adobe Express**
   - Open Adobe Express
   - Enable Developer Mode
   - Load add-on from `dist/` folder

---

## Development Workflow

### 1. Make Code Changes

Edit files in `src/`:
- `src/ui/` - UI components
- `src/sandbox/` - Document API logic
- `src/ui/components/App.css` - Styling

### 2. Build

```bash
npm run build
```

**Build output**:
- `dist/index.js` - UI bundle
- `dist/code.js` - Sandbox bundle
- `dist/manifest.json` - Add-on manifest
- `dist/index.html` - UI HTML

### 3. Test in Adobe Express

1. Reload the add-on panel
2. Test functionality
3. Check browser console for logs
4. Verify results

### 4. Debug

**UI debugging**:
- Open Chrome DevTools (F12)
- Check Console tab for logs
- Use React DevTools extension

**Sandbox debugging**:
- Console logs appear in same DevTools
- Look for logs starting with "==="
- Check Network tab for API proxy calls

---

## Project Structure

```
Pixel-Proof/
├── docs/                    # Documentation
│   ├── ARCHITECTURE.md      # System architecture
│   ├── API_REFERENCE.md     # API documentation
│   ├── DEVELOPMENT.md       # This file
│   ├── implementation_plan.md
│   ├── task.md
│   └── datasets_catalog.md
├── src/
│   ├── ui/
│   │   ├── components/
│   │   │   ├── App.tsx      # Main UI component
│   │   │   └── App.css      # Styling
│   │   └── index.tsx        # UI entry point
│   ├── sandbox/
│   │   └── code.ts          # Document API logic
│   ├── manifest.json        # Add-on configuration
│   └── index.html           # UI HTML template
├── dist/                    # Build output (gitignored)
├── node_modules/            # Dependencies (gitignored)
├── package.json             # Project configuration
├── tsconfig.json            # TypeScript configuration
├── .gitignore
└── README.md
```

---

## Key Files Explained

### `src/ui/index.tsx`

**Purpose**: Entry point for UI

**Key code**:
```typescript
// Initialize SDK
addOnUISdk.ready.then(async () => {
  // Get sandbox proxy
  const sandboxProxy = await runtime.apiProxy("documentSandbox");
  
  // Render app
  root.render(<App sandboxProxy={sandboxProxy} />);
});
```

### `src/ui/components/App.tsx`

**Purpose**: Main application component

**Key sections**:
- State management (extracted text, loading, errors)
- Event handlers (handleExtractText)
- UI rendering (button, results display)

### `src/sandbox/code.ts`

**Purpose**: Document API access and text extraction

**Key functions**:
- `extractText()` - Main extraction logic
- `getDocumentInfo()` - Document metadata

**Key code**:
```typescript
// Expose API to UI
addOnSandboxSdk.instance.runtime.exposeApi({
  extractText,
  getDocumentInfo
});
```

### `src/manifest.json`

**Purpose**: Add-on configuration

**Key fields**:
- `id` - Unique add-on identifier
- `name` - Display name
- `version` - Semantic version
- `manifestVersion` - Adobe manifest format version
- `requirements` - SDK requirements

---

## Common Development Tasks

### Adding a New UI Component

1. Create file in `src/ui/components/`
2. Import in `App.tsx`
3. Add to render method
4. Rebuild

**Example**:
```typescript
// src/ui/components/ResultsCard.tsx
export const ResultsCard = ({ text }) => (
  <div className="results-card">{text}</div>
);

// src/ui/components/App.tsx
import { ResultsCard } from './ResultsCard';
```

### Adding a New Sandbox Method

1. Define function in `src/sandbox/code.ts`
2. Add to `exposeApi` object
3. Call from UI via `sandboxProxy.methodName()`
4. Rebuild

**Example**:
```typescript
// Sandbox
async function getColors() {
  // Implementation
  return colors;
}

addOnSandboxSdk.instance.runtime.exposeApi({
  extractText,
  getDocumentInfo,
  getColors  // New method
});

// UI
const colors = await sandboxProxy.getColors();
```

### Adding Styling

Edit `src/ui/components/App.css`:

```css
.my-new-class {
  padding: 10px;
  background: #f0f0f0;
}
```

Use in component:
```typescript
<div className="my-new-class">Content</div>
```

---

## TypeScript Configuration

### `tsconfig.json`

Key settings:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "jsx": "react",
    "strict": true,
    "esModuleInterop": true
  }
}
```

### Type Assertions

When Adobe SDK types are incomplete:
```typescript
const sandboxProxy = await runtime.apiProxy("documentSandbox" as any);
const textNode = node as any;
```

---

## Build System

### Webpack Configuration

Managed by `ccweb-add-on-scripts`. Key features:
- TypeScript compilation
- React JSX transformation
- Code bundling
- Source maps
- Asset copying

### Build Commands

```bash
# Development build
npm run build

# Watch mode (if configured)
npm run watch

# Clean build
rm -rf dist && npm run build
```

---

## Debugging Tips

### Console Logging Best Practices

**Sandbox logs**:
```typescript
console.log("=== Starting Operation ===");
console.log("Processing:", data);
console.log("=== Operation Complete ===");
```

**UI logs**:
```typescript
console.log("Calling sandbox method...");
console.log("Result:", result);
```

### Common Issues

#### "Cannot find module"
**Cause**: Missing import or incorrect path  
**Solution**: Check import statement and file path

#### "Property does not exist on type"
**Cause**: TypeScript type mismatch  
**Solution**: Add type assertion `as any` or define proper types

#### "Failed to load resource: 404"
**Cause**: Build output missing or incorrect path  
**Solution**: Rebuild project, check `dist/` folder

#### "Sandbox API not available"
**Cause**: API not exposed or typo in method name  
**Solution**: Check `exposeApi` call in sandbox

---

## Testing Strategy

### Phase 1 Testing

**Manual testing**:
1. Create document with text
2. Click "Extract Text"
3. Verify results display
4. Check console logs

**Test cases**:
- Empty document
- Single text element
- Multiple text elements
- Multiple pages
- Multiple artboards

### Future Testing (Phase 2+)

- Unit tests with Jest
- Integration tests
- E2E tests with Playwright
- Performance testing

---

## Performance Optimization

### Current Performance

- Text extraction: < 100ms for typical documents
- UI rendering: Instant for < 100 elements

### Optimization Techniques

1. **Memoization**: Cache expensive computations
2. **Lazy loading**: Load results on demand
3. **Virtual scrolling**: For large result lists
4. **Debouncing**: Prevent excessive API calls

---

## Code Style Guidelines

### TypeScript

```typescript
// Use interfaces for object shapes
interface TextResult {
  text: string;
  count: number;
}

// Use const for immutable values
const MAX_RESULTS = 100;

// Use async/await over promises
async function fetchData() {
  const result = await apiCall();
  return result;
}
```

### React

```typescript
// Use functional components
const MyComponent: React.FC<Props> = ({ prop1, prop2 }) => {
  return <div>{prop1}</div>;
};

// Use hooks for state
const [state, setState] = useState(initialValue);

// Use descriptive event handler names
const handleButtonClick = () => { };
```

### CSS

```css
/* Use kebab-case for class names */
.my-component-class { }

/* Group related properties */
.element {
  /* Positioning */
  position: relative;
  
  /* Box model */
  padding: 10px;
  margin: 5px;
  
  /* Visual */
  background: #fff;
  border: 1px solid #ddd;
}
```

---

## Git Workflow

### Branching Strategy

```bash
main          # Production-ready code
├── develop   # Integration branch
    ├── feature/text-extraction
    ├── feature/slogan-detection
    └── bugfix/extraction-error
```

### Commit Messages

```bash
# Format: <type>: <description>

feat: Add text extraction functionality
fix: Correct fullContent.text access
docs: Update API reference
refactor: Simplify extraction logic
test: Add extraction test cases
```

### Before Committing

1. Build successfully
2. Test in Adobe Express
3. Check console for errors
4. Review changes

---

## Deployment

### Development Deployment

1. Build project
2. Load in Adobe Express Developer Mode
3. Test thoroughly

### Production Deployment (Future)

1. Update version in `manifest.json`
2. Build production bundle
3. Test in staging environment
4. Submit to Adobe Express Marketplace
5. Wait for review approval

---

## Troubleshooting

### Build Fails

**Check**:
- Node.js version
- npm dependencies installed
- TypeScript errors
- Webpack configuration

**Solution**:
```bash
rm -rf node_modules
npm install
npm run build
```

### Add-on Won't Load

**Check**:
- `dist/` folder exists
- `manifest.json` is valid
- Adobe Express Developer Mode enabled

**Solution**:
- Rebuild project
- Check manifest syntax
- Reload Adobe Express

### Text Extraction Returns Empty

**Check**:
- Document has text elements
- Text nodes have `fullContent.text`
- Console logs show processing

**Solution**:
- Add console logs to debug
- Check node types
- Verify document structure

---

## Resources

### Adobe Express Documentation
- [Add-on SDK](https://developer.adobe.com/express/add-ons/)
- [Document API](https://developer.adobe.com/express/add-ons/docs/references/document-sandbox/)
- [UI SDK](https://developer.adobe.com/express/add-ons/docs/references/addonsdk/)

### Development Tools
- [React DevTools](https://react.dev/learn/react-developer-tools)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Webpack Documentation](https://webpack.js.org/)

### Community
- Adobe Express Developer Forum
- Stack Overflow (tag: adobe-express)

---

## Next Steps

### Phase 2: Basic Detection

1. Add slogan detection logic
2. Create results dashboard
3. Implement severity levels
4. Test with real slogans

### Phase 3+: Advanced Features

1. Cultural sensitivity detection
2. Interpretation risk analysis
3. ML model integration
4. External API integration
5. PDF report generation

---

## Support

For issues or questions:
1. Check documentation
2. Search existing issues
3. Create new issue with:
   - Description
   - Steps to reproduce
   - Expected vs actual behavior
   - Console logs
   - Screenshots
