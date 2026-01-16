from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
import json
import time

app = Flask(__name__)
CORS(app)  # Enable CORS for cross-origin requests

# Configuration
OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://ollama:11434')
MODEL_NAME = "pixel-proof-safety"

print(f"Server starting. Using Ollama at: {OLLAMA_BASE_URL} with model: {MODEL_NAME}")

def query_ollama(prompt):
    url = f"{OLLAMA_BASE_URL}/api/generate"
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "format": "json"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=60)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error communicating with Ollama: {e}")
        return None

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "service": "pixel-proof-backend"})

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({"error": "Missing 'text' field"}), 400
    
    text = data['text']
    
    # Query Ollama
    ollama_response = query_ollama(text)
    
    if not ollama_response or 'response' not in ollama_response:
         return jsonify({"error": "Failed to get analysis from AI model"}), 500

    try:
        # The model is instructed to return JSON, but we verify it
        analysis_result = json.loads(ollama_response['response'])
        return jsonify({
            "success": True,
            "data": analysis_result,
            "meta": {
                "model": MODEL_NAME,
                "timestamp": time.time()
            }
        })
    except json.JSONDecodeError:
        print(f"Failed to parse JSON from model response: {ollama_response['response']}")
        return jsonify({
            "error": "Model returned invalid format", 
            "raw_response": ollama_response['response']
        }), 500

if __name__ == '__main__':
    # Local dev fallback
    app.run(host='0.0.0.0', port=5000, debug=True)
