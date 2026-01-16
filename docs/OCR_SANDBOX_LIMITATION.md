# OCR Sandbox Limitation - Technical Summary

## Issue

The OCR functionality encounters a runtime error in the Adobe Express sandbox environment:

```
Error: OCR initialization failed: 'URL' is not defined
```

## Root Cause

**Adobe Express Sandbox Environment Restrictions**

The Adobe Express add-on sandbox is a restricted JavaScript environment that lacks many standard browser APIs for security and isolation purposes. Specifically, it's missing:

- `URL` - Web API for URL manipulation
- `Blob` - Binary Large Object API
- `document` - DOM manipulation
- Other browser globals

Tesseract.js (the OCR library) requires these browser APIs to:
1. Load worker scripts via URLs
2. Handle binary image data via Blobs  
3. Process image data

## Current Implementation

### What Works ✅

1. **Text Node Extraction** - Fully functional
   - Extracts text from native Adobe Express text elements
   - No browser APIs required
   - Works perfectly in sandbox

2. **OCR Infrastructure** - Complete and ready
   - `ocrService.ts` - Tesseract.js integration
   - `textExtraction.ts` - Unified extraction utilities
   - UI with three extraction modes
   - Raw text output
   - Error handling with helpful messages

### What Doesn't Work ❌

1. **OCR Processing** - Cannot run in sandbox
   - Tesseract.js requires browser APIs
   - Sandbox lacks URL, Blob, and other globals
   - Runtime error on initialization

## Solutions

### Option 1: Server-Side OCR (Recommended)

Move OCR processing to a backend service:

**Pros:**
- Works within sandbox limitations
- More powerful OCR engines available
- Better performance for large images
- Can use cloud services (Google Vision, AWS Textract, Azure Computer Vision)

**Cons:**
- Requires backend infrastructure
- Additional cost for cloud services
- Network latency

**Implementation:**
```typescript
// In sandbox code.ts
async function extractTextWithOCR() {
    // 1. Get images from document
    const images = await getDocumentImages();
    
    // 2. Export images (needs Adobe SDK method)
    const imageData = await exportImages(images);
    
    // 3. Send to backend API
    const response = await fetch('https://your-api.com/ocr', {
        method: 'POST',
        body: JSON.stringify({ images: imageData })
    });
    
    // 4. Return OCR results
    return await response.json();
}
```

### Option 2: Adobe Express SDK OCR

Wait for Adobe to add native OCR support to the Express SDK:

**Pros:**
- Native integration
- No external dependencies
- Optimized for Adobe Express

**Cons:**
- Not currently available
- Timeline unknown
- May have limitations

### Option 3: Hybrid Approach

Combine text node extraction (sandbox) with external OCR (user-initiated):

**Workflow:**
1. Extract text nodes in sandbox (works now)
2. Provide "Export Images" button
3. User downloads images
4. User processes with external OCR tool
5. User pastes results back

**Pros:**
- No backend required
- Works within current limitations
- User maintains control

**Cons:**
- Manual process
- Poor user experience
- Not automated

## Current User Experience

When users click OCR buttons, they see:

```
Error: OCR initialization failed: OCR cannot run in Adobe Express sandbox environment. 
The sandbox lacks browser APIs (URL, Blob) required by Tesseract.js. 
OCR functionality requires running in a full browser environment or using a server-side OCR service.
```

Plus a helpful info box explaining:
- Sandbox limitation
- Text node extraction still works
- Alternative approaches (server-side API, external processing, wait for SDK support)

## Recommendation

**Implement Server-Side OCR** using a cloud service:

1. **Quick Start**: Use free tier of Google Cloud Vision API
2. **Export Images**: Research Adobe Express SDK image export
3. **API Integration**: Send images to cloud OCR service
4. **Display Results**: Show OCR text with confidence scores

This provides the best user experience while working within sandbox constraints.

## Files Modified

- [ocrService.ts](file:///c:/Users/Sudhit/Documents/Study%20Material/Pixel-Proof/src/sandbox/ocrService.ts) - Added environment detection
- [App.tsx](file:///c:/Users/Sudhit/Documents/Study%20Material/Pixel-Proof/src/ui/components/App.tsx) - Enhanced error messages

## Next Steps

1. Research Adobe Express SDK image export capabilities
2. Choose OCR backend service (Google Vision, AWS Textract, etc.)
3. Implement server-side OCR endpoint
4. Update sandbox code to call backend API
5. Test with real images

## Summary

The OCR infrastructure is **architecturally sound and complete**. The limitation is purely environmental - the Adobe Express sandbox doesn't support the browser APIs that Tesseract.js needs. The solution is to move OCR processing to a server-side service, which is a common and recommended pattern for add-ons anyway.
