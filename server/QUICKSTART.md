# Quick Start Guide - Local ML Backend Server

## Prerequisites
- Python 3.8 or higher installed
- Hugging Face API key (get from https://huggingface.co/settings/tokens)

## Setup Steps

### 1. Install Dependencies
```bash
cd server
pip install -r requirements.txt
```

### 2. Configure Environment
Create a `.env` file in the `server` directory:
```bash
HF_API_KEY=your_huggingface_api_key_here
HF_MODEL=GroNLP/hateBERT
PORT=5000
DEBUG=True
```

### 3. Run the Server
```bash
python ml_backend.py
```

Server will start at: `http://localhost:5000`

### 4. Test the Server

**Health Check:**
```bash
curl http://localhost:5000/health
```

**Analyze Text:**
```bash
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "I love learning new things"}'
```

### 5. Configure Add-on to Use Local Server

In the add-on UI, configure the ML service with:
```
Backend URL: http://localhost:5000
```

Leave the API key field empty when using backend mode.

## Troubleshooting

**Port already in use:**
```bash
# Change PORT in .env file to a different port (e.g., 5001)
```

**Module not found:**
```bash
pip install -r requirements.txt --upgrade
```

**API key error:**
- Make sure `.env` file exists in the `server` directory
- Verify your Hugging Face API key is correct
- Check that the key has read permissions

## Next Steps

Once local testing is complete, you can deploy to:
- Railway (free tier, easiest)
- Render (free tier)
- Heroku
- Any Python hosting service

See `server/README.md` for deployment instructions.
