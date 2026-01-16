# ML Backend Server

Python Flask server that provides a REST API for hate speech detection without requiring client-side API keys.

## Features

- ✅ Acts as proxy to Hugging Face Inference API
- ✅ No client-side API key management needed
- ✅ Built-in rate limiting
- ✅ Result caching
- ✅ Batch processing support
- ✅ CORS enabled for Adobe Express add-on

## Setup

### 1. Install Dependencies

```bash
cd server
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and add your Hugging Face API key
# HF_API_KEY=hf_xxxxxxxxxxxxx
```

### 3. Run Server

```bash
python ml_backend.py
```

Server will start on `http://localhost:5000`

## API Endpoints

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "model": "GroNLP/hateBERT",
  "timestamp": 1705401600000
}
```

### POST /analyze

Analyze single text for hate speech.

**Request:**
```json
{
  "text": "Your text here"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "label": "not-hate",
    "score": 0.98,
    "isHateSpeech": false,
    "confidence": 98.0,
    "model": "GroNLP/hateBERT",
    "timestamp": 1705401600000
  }
}
```

### POST /analyze-batch

Analyze multiple texts.

**Request:**
```json
{
  "texts": ["Text 1", "Text 2", "Text 3"]
}
```

**Response:**
```json
{
  "success": true,
  "results": [...],
  "summary": {
    "totalAnalyzed": 3,
    "hateSpeechCount": 1,
    "averageConfidence": 92.5
  }
}
```

## Deployment

### Deploy to Railway

1. Create account at [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Select your repository
4. Add environment variable: `HF_API_KEY=your_key`
5. Railway will auto-deploy

### Deploy to Render

1. Create account at [render.com](https://render.com)
2. Click "New" → "Web Service"
3. Connect your repository
4. Set build command: `pip install -r server/requirements.txt`
5. Set start command: `gunicorn -w 4 -b 0.0.0.0:$PORT server.ml_backend:app`
6. Add environment variable: `HF_API_KEY=your_key`
7. Deploy

### Deploy to Heroku

```bash
# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Set environment variable
heroku config:set HF_API_KEY=your_key

# Deploy
git push heroku main
```

## Configure Add-on to Use Backend

Once deployed, update your add-on to use the backend server instead of direct Hugging Face access:

```typescript
// In mlService.ts, add backend URL option
const BACKEND_URL = 'https://your-server-url.com';

// Modify detectHateSpeech to use backend
const response = await fetch(`${BACKEND_URL}/analyze`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text })
});

const data = await response.json();
return data.result;
```

## Benefits of Backend Approach

1. **No Client API Keys**: Users don't need to get their own Hugging Face API keys
2. **Centralized Management**: You control the API key and can monitor usage
3. **Rate Limiting**: Server-side rate limiting protects your API quota
4. **Caching**: Server can cache results to reduce API calls
5. **Security**: API key never exposed to client-side code

## Production Considerations

- Use Redis for caching instead of in-memory LRU cache
- Add authentication/API keys for your backend
- Monitor API usage and costs
- Set up logging and error tracking
- Use a production WSGI server (gunicorn, uwsgi)
- Enable HTTPS
- Add request validation and sanitization
