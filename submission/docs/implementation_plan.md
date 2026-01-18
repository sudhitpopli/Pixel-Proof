# Implementation Plan - Image Extraction & OCR

## Goal
Enable the add-on to extract the current view (page/artboard) as an image from the Adobe Express sandbox and perform OCR (Optical Character Recognition) using Tesseract on the backend to extract text from the image.

## User Review Required
> [!IMPORTANT]
> **System Requirement**: Tesseract OCR must be installed on the host machine where the Python backend is running.
> - **Windows**: Download and install from [UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/wiki).
> - **Path**: Ensure `tesseract.exe` is in your system PATH, or we may need to configure the path in `.env`.

> [!WARNING]
> **Permissions**: The `manifest.json` will be updated to include `"renditionPreview": true`. This allows the add-on to generate renditions of the document for processing.

## Proposed Changes

### Configuration & Dependencies

#### [MODIFY] [manifest.json](file:///c:/Users/Sudhit/Documents/Study%20Material/Pixel-Proof/src/manifest.json)
- Add `"renditionPreview": true` to `requirements`.
- Add `"allow-downloads"` to `permissions.sandbox` (optional, but good practice for ensuring export capabilities).

#### [MODIFY] [requirements.txt](file:///c:/Users/Sudhit/Documents/Study%20Material/Pixel-Proof/server/requirements.txt)
- Add `pytesseract`
- Add `Pillow` (PIL)

### Backend (Python)

#### [MODIFY] [ml_backend.py](file:///c:/Users/Sudhit/Documents/Study%20Material/Pixel-Proof/server/ml_backend.py)
- Import `pytesseract` and `PIL.Image`.
- Add configuration for Tesseract path (optional, via `.env`).
- Create a new endpoint `POST /ocr`.
    - Accept `multipart/form-data` with an image file.
    - Process image using `pytesseract.image_to_string`.
    - Return the extracted text.

### Frontend (Add-on)

#### [MODIFY] [code.ts](file:///c:/Users/Sudhit/Documents/Study%20Material/Pixel-Proof/src/sandbox/code.ts)
- Implement `createImageRendition` function in the sandbox.
    - Check `editor.documentRoot` availability.
    - Call `addOnUISdk.app.document.createRenditions`.
    - Return the blob/buffer to the UI.

#### [MODIFY] [App.tsx](file:///c:/Users/Sudhit/Documents/Study%20Material/Pixel-Proof/src/ui/components/App.tsx)
- Add a new button: "Extract Text (OCR)".
- Helper function to:
    - Call `sandbox.createImageRendition`.
    - Convert blob to `FormData`.
    - Send to `http://localhost:5000/ocr`.
    - Display the result.

## Verification Plan

### Automated Tests
- None for this phase (visual/integration feature).

### Manual Verification
1.  **Setup**:
    - Install Tesseract on your Windows machine.
    - Run `pip install -r server/requirements.txt`.
    - Start backend: `python server/ml_backend.py`.
    - Rebuild and deploy add-on: `npm run build` (or similar).
2.  **Execution**:
    - Open Adobe Express document.
    - Add an image with text (e.g., a screenshot of a quote).
    - Open the Add-on.
    - Click "Extract Text (OCR)".
3.  **Result**:
    - The add-on should display the text extracted from the image.
