# System Architecture

PocketLegal is built on a decoupled, service-oriented architecture designed to overcome the limitations of the browser sandbox while providing powerful AI capabilities.

## High-Level Overview

[Frontend UI] <--> [Document Sandbox] <--> [Node.js Bridge] <--> [Python ML Service]
                                                  |
                                                  +--> [External APIs: Gemini, SerpApi]

---

## 🧩 Components

### 1. The Frontend (React + TypeScript)
* **Responsibility**: Renders the UI panel in Adobe Express.
* **Constraints**: Runs in an iframe; cannot directly access the host file system or run heavy ML models efficiently.
* **Key Tech**: Adobe Spectrum Web Components (`@swc-react`) for native look-and-feel.

### 2. The Document Sandbox
* **Responsibility**: Direct manipulation of the Adobe Express document.
* **Operations**:
    * **Text Extraction**: Traverses the node tree to pull text from text boxes.
    * **Rendition**: Generates `.png` screenshots of the current page for OCR and Image Analysis.
    * **Visual Feedback**: Applies styling (red underlines) to nodes identified as problematic.

### 3. The Node.js Bridge (Port 3000)
* **Why it exists**:
    * **CORS**: Browsers often block requests to local Python servers or external APIs like SerpApi directly from an iframe. The Node server acts as a proxy.
    * **Heavy Lifting**: Runs `Tesseract.js` for OCR, keeping the UI thread unblocked.
    * **Secrets**: Safely holds API keys (`.env`) for Gemini and SerpApi so they aren't exposed in the client bundle.

### 4. The Python ML Service (Port 5001)
* **Why it exists**: Javascript is not ideal for running heavy PyTorch/Transformer models. Python provides the native environment required for **HateBERT**.
* **Model**: Uses a fine-tuned BERT model loaded via `transformers`. It is kept resident in memory for fast inference (milliseconds vs. seconds for loading).

---

## 🔄 Data Flow: "Compliance Scan"

1.  **Trigger**: User clicks "Refresh" in the UI.
2.  **Capture**: Sandbox generates a PNG screenshot of the page.
3.  **Extraction**: Sandbox extracts raw text strings from text nodes.
4.  **Upload**: UI sends the PNG and text to the Node.js Bridge.
5.  **OCR**: Node.js runs Tesseract on the PNG to find text in images.
6.  **Analysis**: Node.js combines Document Text + OCR Text and sends it to Python.
7.  **Inference**: Python model classifies segments (Safe vs. Hate).
8.  **Feedback**: Result returns to UI -> Sandbox applies red underlines to matching text nodes on the canvas.