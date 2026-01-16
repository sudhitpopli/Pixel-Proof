# ComplianceGuard Pro - Troubleshooting Guide

## Common Issues and Solutions

---

## Build Issues

### Error: "ccweb-add-on-scripts not found"

**Symptoms**:
```
'ccweb-add-on-scripts' is not recognized as an internal or external command
```

**Cause**: Dependencies not installed

**Solution**:
```bash
npm install
```

---

### Error: "Cannot find module"

**Symptoms**:
```
Error: Cannot find module 'react'
Error: Cannot find module './components/App'
```

**Cause**: Missing dependency or incorrect import path

**Solution**:
1. Check if module is installed:
   ```bash
   npm list react
   ```

2. Install if missing:
   ```bash
   npm install react
   ```

3. Check import path is correct:
   ```typescript
   // Correct
   import App from './components/App';
   
   // Incorrect
   import App from './App';  // Wrong path
   ```

---

### Error: TypeScript compilation errors

**Symptoms**:
```
TS2322: Type 'string' is not assignable to type 'number'
TS2339: Property 'text' does not exist on type 'Node'
```

**Cause**: Type mismatch or incorrect type usage

**Solution**:
1. Add type assertion:
   ```typescript
   const textNode = node as any;
   ```

2. Or define proper types:
   ```typescript
   interface TextNode extends Node {
     fullContent: {
       text: string;
     };
   }
   ```

---

## Runtime Issues

### Error: "Failed to load resource: 404"

**Symptoms**:
- Add-on panel shows blank
- Console shows 404 errors for `index.html` or `index.js`

**Cause**: Build output missing or incorrect paths

**Solution**:
1. Rebuild project:
   ```bash
   npm run build
   ```

2. Verify `dist/` folder contains:
   - `index.html`
   - `index.js`
   - `code.js`
   - `manifest.json`

3. Reload add-on in Adobe Express

---

### Error: "Sandbox API not available"

**Symptoms**:
```
TypeError: sandboxProxy.extractText is not a function
```

**Cause**: API not properly exposed from sandbox

**Solution**:
1. Check `src/sandbox/code.ts` has:
   ```typescript
   addOnSandboxSdk.instance.runtime.exposeApi({
     extractText,
     getDocumentInfo
   });
   ```

2. Rebuild project

3. Check method name matches exactly

---

### Error: "Cannot read property 'pages' of undefined"

**Symptoms**:
```
TypeError: Cannot read property 'pages' of undefined
```

**Cause**: Document not loaded or `editor.documentRoot` is undefined

**Solution**:
1. Add null check:
   ```typescript
   const doc = editor.documentRoot;
   if (!doc) {
     console.error("Document not loaded");
     return { success: false, textElements: [], count: 0 };
   }
   ```

2. Ensure document is fully loaded before calling API

---

## Text Extraction Issues

### Issue: No text extracted (empty results)

**Symptoms**:
- `extractText()` returns `{ count: 0, textElements: [] }`
- Console shows "Total text elements found: 0"

**Possible Causes & Solutions**:

#### 1. Document has no text
**Check**: Add text elements to document  
**Verify**: Console should show "Found X node(s)" > 0

#### 2. Wrong property access
**Check**: Using `node.text` instead of `node.fullContent.text`  
**Fix**: Update to:
```typescript
if (textNode.fullContent && textNode.fullContent.text) {
  const textContent = textNode.fullContent.text;
}
```

#### 3. Text nodes not being detected
**Debug**: Add logging:
```typescript
for (const node of children) {
  console.log("Node type:", node.type);  // Should show "Text"
}
```

#### 4. Iteration not working
**Debug**: Check console for:
```
Document has X page(s)
Processing page: ...
  Processing artboard: ...
    Found X node(s)
```

If missing, check document structure.

---

### Issue: Some text missing from results

**Symptoms**:
- Only partial text extracted
- Some text elements not in results

**Possible Causes & Solutions**:

#### 1. Text in multiple artboards
**Check**: Ensure iterating through all artboards  
**Verify**: Console shows multiple "Processing artboard" messages

#### 2. Text in multiple pages
**Check**: Ensure iterating through all pages  
**Verify**: Console shows "Document has X page(s)" where X > 1

#### 3. Error in extraction
**Check**: Console for error messages  
**Look for**: "Error extracting text from node"

#### 4. Text node structure different
**Debug**: Log the node structure:
```typescript
console.log("Text node:", JSON.stringify(textNode, null, 2));
```

---

## UI Issues

### Issue: Button doesn't work

**Symptoms**:
- Clicking "Extract Text" does nothing
- No console logs appear

**Possible Causes & Solutions**:

#### 1. Event handler not connected
**Check**: Button has `onClick` prop:
```typescript
<Button onClick={handleExtractText}>Extract Text</Button>
```

#### 2. Function not defined
**Check**: `handleExtractText` is defined in component

#### 3. Sandbox proxy not initialized
**Check**: `sandboxProxy` is passed to App:
```typescript
<App sandboxProxy={sandboxProxy} />
```

---

### Issue: Results not displaying

**Symptoms**:
- Text extracted successfully (console shows results)
- UI doesn't update with results

**Possible Causes & Solutions**:

#### 1. State not updating
**Check**: `setExtractedText` is called:
```typescript
if (result.success) {
  setExtractedText(result.textElements);
}
```

#### 2. Conditional rendering issue
**Check**: Results section renders when `extractedText.length > 0`

#### 3. CSS hiding elements
**Check**: Inspect element in DevTools, verify visibility

---

## Performance Issues

### Issue: Slow extraction

**Symptoms**:
- Extraction takes > 5 seconds
- UI freezes during extraction

**Possible Causes & Solutions**:

#### 1. Large document
**Optimize**: Add pagination or limit results:
```typescript
const MAX_RESULTS = 100;
if (allText.length >= MAX_RESULTS) break;
```

#### 2. Excessive logging
**Optimize**: Reduce console.log calls in production

#### 3. Synchronous processing
**Future**: Implement streaming results

---

## Adobe Express Integration Issues

### Issue: Add-on won't load in Adobe Express

**Symptoms**:
- Add-on not appearing in panel
- Error loading add-on

**Possible Causes & Solutions**:

#### 1. Developer Mode not enabled
**Solution**: Enable Developer Mode in Adobe Express settings

#### 2. Invalid manifest
**Check**: `manifest.json` is valid JSON  
**Validate**: Use JSON validator online

#### 3. Wrong dist folder
**Check**: Loading from correct `dist/` folder path

#### 4. Port conflict
**Solution**: Kill process on port 5241:
```powershell
# Find process
Get-NetTCPConnection -LocalPort 5241 | Select-Object -ExpandProperty OwningProcess

# Kill process
Stop-Process -Id <PID> -Force
```

---

### Issue: Add-on loads but shows blank panel

**Symptoms**:
- Panel opens but is empty/white
- No UI visible

**Possible Causes & Solutions**:

#### 1. Build failed
**Check**: `dist/index.js` exists and is not empty  
**Solution**: Rebuild project

#### 2. React error
**Check**: Console for React errors  
**Common**: Missing key prop, invalid JSX

#### 3. CSS issue
**Check**: Elements exist but are hidden  
**Solution**: Inspect in DevTools

---

## Console Errors

### "Empty script code received"

**Severity**: Warning (can ignore)  
**Cause**: Adobe Express internal  
**Action**: None required

---

### "Failed to load resource: net::ERR_BLOCKED_BY_CLIENT"

**Severity**: Warning (can ignore)  
**Cause**: Ad blocker blocking telemetry  
**Action**: None required (doesn't affect add-on)

---

### "Locator: factory for EditorAssignmentStore not provided"

**Severity**: Error (Adobe Express internal)  
**Cause**: Adobe Express timing issue  
**Action**: Reload Adobe Express if add-on doesn't work

---

## Debugging Workflow

### Step-by-Step Debugging

1. **Check build**:
   ```bash
   npm run build
   ```
   - Should complete without errors
   - Check `dist/` folder has files

2. **Check console logs**:
   - Open DevTools (F12)
   - Look for "Sandbox API initialized"
   - Look for "=== Starting Text Extraction ==="

3. **Test extraction**:
   - Add text to document
   - Click "Extract Text"
   - Check console for processing logs

4. **Verify results**:
   - Check UI updates
   - Verify text matches document

5. **Check for errors**:
   - Look for red errors in console
   - Check Network tab for failed requests

---

## Getting Help

### Before Asking for Help

Collect this information:

1. **Error message** (exact text)
2. **Console logs** (copy full output)
3. **Steps to reproduce**
4. **Expected vs actual behavior**
5. **Environment**:
   - Node.js version: `node --version`
   - npm version: `npm --version`
   - OS: Windows/Mac/Linux

### Where to Get Help

1. Check this troubleshooting guide
2. Check `docs/DEVELOPMENT.md`
3. Check `docs/API_REFERENCE.md`
4. Search GitHub issues
5. Create new issue with collected information

---

## Preventive Measures

### Before Development

- [ ] Dependencies installed
- [ ] Build successful
- [ ] Add-on loads in Adobe Express
- [ ] Console shows no errors

### Before Committing

- [ ] Code builds without errors
- [ ] Tested in Adobe Express
- [ ] Console logs reviewed
- [ ] No TypeScript errors

### Before Deployment

- [ ] All features tested
- [ ] Performance acceptable
- [ ] Error handling in place
- [ ] Documentation updated

---

## Quick Reference

### Restart Everything

```bash
# 1. Kill port 5241
Stop-Process -Id <PID> -Force

# 2. Clean install
rm -rf node_modules dist
npm install

# 3. Rebuild
npm run build

# 4. Reload in Adobe Express
```

### Check Logs

```typescript
// Sandbox logs
console.log("=== Starting Text Extraction ===");

// UI logs
console.log("Calling extractText from sandbox...");
console.log("Extraction result:", result);
```

### Verify Build

```bash
# Check dist folder
ls dist/

# Should contain:
# - index.html
# - index.js
# - code.js
# - manifest.json
```

---

## Known Limitations

### Phase 1

- Only extracts text (no images, shapes, etc.)
- No detection logic yet
- No persistent storage
- Single-threaded processing

### Adobe Express SDK

- Some TypeScript types incomplete
- Sandbox has limited API access
- No direct file system access
- No network requests from sandbox

---

## Future Improvements

### Phase 2+

- Better error messages
- Retry logic for failed extractions
- Progress indicators
- Cancellation support
- Batch processing
- Export functionality
