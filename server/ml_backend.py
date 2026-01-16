"""
ML Backend Server for Hate Speech Detection
Provides a REST API endpoint for hate speech detection without requiring client-side API keys

This server acts as a proxy to Hugging Face, so users don't need to manage their own API keys.
You can deploy this to a cloud service (Heroku, Railway, Render, etc.) and configure the
add-on to use your server URL instead of direct Hugging Face access.

Usage:
    1. Set your Hugging Face API key as environment variable: HF_API_KEY
    2. Run: python ml_backend.py
    3. Server will start on http://localhost:5000
    4. Configure add-on to use: http://your-server-url.com/analyze

Dependencies:
    pip install flask flask-cors requests python-dotenv
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv
import time
from functools import lru_cache

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for Adobe Express add-on

# Configuration
HF_API_KEY = os.getenv('HF_API_KEY')
HF_MODEL = os.getenv('HF_MODEL', 'GroNLP/hateBERT')
HF_API_URL = f'https://api-inference.huggingface.co/models/{HF_MODEL}'

# Rate limiting
last_request_time = 0
MIN_REQUEST_INTERVAL = 0.5  # 500ms between requests

# Simple in-memory cache (for production, use Redis)
@lru_cache(maxsize=100)
def cached_analysis(text_hash):
    """Cache results to reduce API calls"""
    pass

def analyze_text_hf(text):
    """
    Analyze text using Hugging Face Inference API
    
    Args:
        text (str): Text to analyze
        
    Returns:
        dict: Analysis result with label, score, isHateSpeech, confidence
    """
    global last_request_time
    
    # Rate limiting
    current_time = time.time()
    time_since_last = current_time - last_request_time
    if time_since_last < MIN_REQUEST_INTERVAL:
        time.sleep(MIN_REQUEST_INTERVAL - time_since_last)
    last_request_time = time.time()
    
    # Call Hugging Face API
    headers = {
        'Authorization': f'Bearer {HF_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        'inputs': text
    }
    
    try:
        response = requests.post(
            HF_API_URL,
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            results = response.json()
            
            # Process results
            hate_label = None
            not_hate_label = None
            
            for item in results[0] if isinstance(results[0], list) else results:
                label = item['label'].lower()
                if 'hate' in label and 'not' not in label:
                    hate_label = item
                elif 'not' in label or 'normal' in label:
                    not_hate_label = item
            
            # Determine if hate speech
            is_hate = hate_label and hate_label['score'] > (not_hate_label['score'] if not_hate_label else 0)
            primary = hate_label if is_hate else (not_hate_label or results[0][0])
            
            return {
                'label': primary['label'],
                'score': primary['score'],
                'isHateSpeech': is_hate,
                'confidence': primary['score'] * 100,
                'model': HF_MODEL,
                'timestamp': int(time.time() * 1000)
            }
        else:
            raise Exception(f'Hugging Face API error: {response.status_code} - {response.text}')
            
    except Exception as e:
        raise Exception(f'Analysis failed: {str(e)}')

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model': HF_MODEL,
        'timestamp': int(time.time() * 1000)
    })

@app.route('/analyze', methods=['POST'])
def analyze():
    """
    Analyze text for hate speech
    
    Request body:
        {
            "text": "Text to analyze"
        }
        
    Response:
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
    """
    try:
        # Validate API key is configured
        if not HF_API_KEY:
            return jsonify({
                'success': False,
                'error': 'Server not configured. Please set HF_API_KEY environment variable.'
            }), 500
        
        # Get request data
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing "text" field in request body'
            }), 400
        
        text = data['text']
        
        if not text or not text.strip():
            return jsonify({
                'success': False,
                'error': 'Text cannot be empty'
            }), 400
        
        # Analyze text
        result = analyze_text_hf(text)
        
        return jsonify({
            'success': True,
            'result': result
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/analyze-batch', methods=['POST'])
def analyze_batch():
    """
    Analyze multiple texts for hate speech
    
    Request body:
        {
            "texts": ["Text 1", "Text 2", "Text 3"]
        }
        
    Response:
        {
            "success": true,
            "results": [...],
            "summary": {
                "totalAnalyzed": 3,
                "hateSpeechCount": 1,
                "averageConfidence": 92.5
            }
        }
    """
    try:
        if not HF_API_KEY:
            return jsonify({
                'success': False,
                'error': 'Server not configured. Please set HF_API_KEY environment variable.'
            }), 500
        
        data = request.get_json()
        
        if not data or 'texts' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing "texts" field in request body'
            }), 400
        
        texts = data['texts']
        
        if not isinstance(texts, list):
            return jsonify({
                'success': False,
                'error': '"texts" must be an array'
            }), 400
        
        # Analyze each text
        results = []
        hate_count = 0
        total_confidence = 0
        
        for text in texts:
            if not text or not text.strip():
                continue
                
            try:
                result = analyze_text_hf(text)
                results.append(result)
                
                if result['isHateSpeech']:
                    hate_count += 1
                total_confidence += result['confidence']
                
            except Exception as e:
                print(f'Failed to analyze text: {e}')
                continue
        
        summary = {
            'totalAnalyzed': len(results),
            'hateSpeechCount': hate_count,
            'averageConfidence': total_confidence / len(results) if results else 0
        }
        
        return jsonify({
            'success': True,
            'results': results,
            'summary': summary
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/', methods=['GET'])
def index():
    """Root endpoint with API documentation"""
    return jsonify({
        'name': 'ML Hate Speech Detection API',
        'version': '1.0.0',
        'model': HF_MODEL,
        'endpoints': {
            'GET /health': 'Health check',
            'POST /analyze': 'Analyze single text',
            'POST /analyze-batch': 'Analyze multiple texts'
        },
        'documentation': 'https://github.com/your-repo/ml-backend'
    })

if __name__ == '__main__':
    # Check if API key is set
    if not HF_API_KEY:
        print('WARNING: HF_API_KEY environment variable not set!')
        print('Please set it before starting the server:')
        print('  export HF_API_KEY=hf_xxxxxxxxxxxxx')
        print('  python ml_backend.py')
        exit(1)
    
    print(f'Starting ML Backend Server...')
    print(f'Model: {HF_MODEL}')
    print(f'Server will run on http://localhost:5000')
    print(f'Use POST /analyze to analyze text')
    
    # Run server
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000)),
        debug=os.getenv('DEBUG', 'False').lower() == 'true'
    )
