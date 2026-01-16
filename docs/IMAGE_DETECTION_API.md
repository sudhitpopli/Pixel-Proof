# Image Detection API Documentation

This API detects images within a screenshot and finds their URLs using AI services.

## Endpoint

**POST** `/detect-images-in-screenshot`

## Request Body

```json
{
  "screenshot_base64": "base64_encoded_screenshot_image",
  "services": ["gemini", "serpapi"]  // Optional, defaults to both
}
```

### Parameters

- `screenshot_base64` (required): Base64-encoded screenshot image (without data URL prefix)
- `services` (optional): Array of services to use. Options:
  - `"gemini"` - Uses Google Gemini Vision to detect and describe images
  - `"serpapi"` - Uses SerpAPI reverse image search to find URLs

## Response

```json
{
  "success": true,
  "results": {
    "detectedImages": [
      {
        "description": "A logo with text",
        "position": "top-left",
        "type": "logo",
        "confidence": 0.95,
        "branding": "Company Name"
      }
    ],
    "imageUrls": [
      {
        "url": "https://example.com/image.jpg",
        "source": "visual_match",
        "title": "Image Title",
        "thumbnail": "https://example.com/thumb.jpg",
        "serpapiIndex": 0
      }
    ],
    "geminiAnalysis": {
      "success": true,
      "images": [...]
    },
    "serpApiResults": {
      "success": true,
      "totalUrls": 5,
      "urls": [...]
    },
    "summary": {
      "totalImagesDetected": 2,
      "totalUrlsFound": 5
    }
  },
  "debugLogs": [...]
}
```

## Usage Examples

### Using the UI Utility Function

```typescript
import { detectImagesInScreenshot } from './utils/imageDetection';

// Automatically captures screenshot and detects images
const result = await detectImagesInScreenshot(
    undefined, // Will capture screenshot automatically
    'http://localhost:3000', // Backend URL
    ['gemini', 'serpapi'] // Services to use
);

if (result.success) {
    console.log('Detected images:', result.detectedImages);
    console.log('Image URLs:', result.imageUrls);
    console.log('Total URLs found:', result.summary?.totalUrlsFound);
} else {
    console.error('Error:', result.error);
    console.log('Debug logs:', result.debugLogs);
}
```

### Direct API Call

```typescript
// First, capture screenshot (using html2canvas)
import html2canvas from 'html2canvas';

const canvas = await html2canvas(document.body);
const screenshotBase64 = canvas.toDataURL('image/png').split(',')[1];

// Then call the API
const response = await fetch('http://localhost:3000/detect-images-in-screenshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        screenshot_base64: screenshotBase64,
        services: ['gemini', 'serpapi']
    })
});

const result = await response.json();
console.log('Detected images:', result.results.detectedImages);
console.log('Image URLs:', result.results.imageUrls);
```

## How It Works

1. **Gemini Vision Analysis**:
   - Analyzes the screenshot using Google Gemini Vision API
   - Detects and describes all images within the screenshot
   - Provides position, type, confidence, and branding information
   - Returns structured JSON with image descriptions

2. **SerpAPI Reverse Image Search**:
   - Uses SerpAPI Google Reverse Image Search
   - Finds URLs where similar images appear on the web
   - Returns visual matches, inline images, and related images
   - Removes duplicate URLs automatically

## Debug Logging

All operations are logged with detailed debug information:

- `[IMAGE_DETECT_DEBUG]` - Server-side logs
- `[IMAGE_DETECT_UI]` - Client-side logs

Check the browser console and server terminal for detailed logs at every step.

## Setup Requirements

### Environment Variables

Add to your `.env` file:

```
GEMINI_API_KEY=your_gemini_api_key_here
SERPAPI_KEY=your_serpapi_key_here
```

### Dependencies

```bash
npm install form-data
```

For screenshot capture (optional but recommended):

```bash
npm install html2canvas
```

## Response Fields

### `detectedImages` (from Gemini)

Array of objects describing detected images:
- `description`: Text description of the image
- `position`: Approximate position in screenshot (e.g., "top-left", "center")
- `type`: Type of image (logo, photo, illustration, icon, etc.)
- `confidence`: Confidence score (0.0 to 1.0)
- `branding`: Any brands or logos visible in the image

### `imageUrls` (from SerpAPI)

Array of objects with URL information:
- `url`: The actual image URL
- `source`: Where the URL was found ("visual_match", "inline_image", "related_image")
- `title`: Title or description of the image
- `thumbnail`: Thumbnail URL (if available)
- `serpapiIndex`: Index in SerpAPI response

## Error Handling

The API returns detailed error information in the response:

```json
{
  "success": false,
  "error": "Error message",
  "debugLogs": [
    {
      "timestamp": "2024-01-01T00:00:00.000Z",
      "msg": "Error description",
      "data": {...}
    }
  ]
}
```

## Common Issues

### 1. Gemini API Key Missing
**Error**: "Missing GEMINI_API_KEY"  
**Solution**: Add `GEMINI_API_KEY` to your `.env` file

### 2. SerpAPI Key Missing
**Error**: "Missing SERPAPI_KEY"  
**Solution**: Add `SERPAPI_KEY` to your `.env` file

### 3. Screenshot Capture Fails
**Error**: "Failed to capture screenshot"  
**Solution**: Install html2canvas: `npm install html2canvas`

### 4. No Images Detected
**Status**: Success but empty arrays  
**Note**: This is normal if the screenshot doesn't contain recognizable images or if the AI services can't find matching URLs

## Notes

- The API processes the entire screenshot to detect all images within it
- Multiple images are returned as an array
- URLs are deduplicated automatically
- Temporary screenshot files are automatically cleaned up
- All operations include comprehensive debug logging
