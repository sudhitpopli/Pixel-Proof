# API Documentation

PocketLegal uses a microservices architecture. The Frontend communicates primarily with the **Node.js Bridge**, which then orchestrates calls to the **Python ML Service** or external APIs.

---

## 🟢 Node.js Bridge Server (Port 3000)

The primary entry point for the Add-on.

### 1. Analyze Document Text (Hate Speech)
Forwards text to the Python ML model for classification.

* **Endpoint**: `POST /analyze-hate`
* **Content-Type**: `application/json`
* **Body**:
    ```json
    {
      "text": "The text content extracted from the document..."
    }
    ```
* **Response**:
    ```json
    {
      "full_text": "...",
      "segments": [
        {
          "text": "Segment 1",
          "label": "LABEL_0",
          "confidence": 0.98,
          "is_hate": false
        }
      ]
    }
    ```

### 2. Analyze Image (OCR)
Uploads a raw image, runs Tesseract.js, and returns the extracted text.

* **Endpoint**: `POST /analyze-image`
* **Content-Type**: `multipart/form-data`
* **Body**: `image` (File Object)
* **Response**:
    ```json
    {
      "result": "Extracted text string from the image..."
    }
    ```

### 3. Detect Images & Copyright
Analyzes a screenshot to find images and check their sources via reverse image search.

* **Endpoint**: `POST /detect-images-in-screenshot`
* **Content-Type**: `application/json`
* **Body**:
    ```json
    {
      "screenshot_base64": "base64_encoded_string...",
      "services": ["gemini", "serpapi"]
    }
    ```
* **Response**:
    ```json
    {
      "success": true,
      "results": {
        "detectedImages": [
            { "description": "A dog running", "type": "photo" }
        ],
        "imageUrls": [
            { "url": "[https://example.com/image.jpg](https://example.com/image.jpg)", "source": "visual_match" }
        ]
      }
    }
    ```

---

## 🐍 Python ML Service (Port 5001)

The internal inference engine. You generally do not call this directly from the Frontend.

### 1. Predict (Inference)
Runs the loaded HateBERT model on the provided text.

* **Endpoint**: `POST /predict`
* **Content-Type**: `application/json`
* **Body**:
    ```json
    {
      "text": "Text to classify"
    }
    ```
* **Response**:
    ```json
    {
      "segments": [
        {
          "label": "LABEL_1",
          "confidence": 0.99
        }
      ]
    }
    ```