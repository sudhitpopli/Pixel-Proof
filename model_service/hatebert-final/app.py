import os
import sys
from flask import Flask, request, jsonify
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline

app = Flask(__name__)

# Base directory relative to this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "model")

print(f"Loading model from: {MODEL_DIR}")

# Load model and tokenizer
try:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR, local_files_only=True)
    
    classifier = pipeline(
        "text-classification",
        model=model,
        tokenizer=tokenizer,
        device=-1,  # CPU
        top_k=3,
        return_all_scores=True
    )
    print("Model loaded successfully!")
except Exception as e:
    print(f"Error loading model: {str(e)}")
    sys.exit(1)

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        text = data.get('text', '')
        if not text:
            return jsonify({'error': 'No text provided'}), 400

        results = classifier(text)
        # Result format: [[{'label': '...', 'score': ...}, ...]]
        # We want to simplify it or return as is.
        # Let's return the list of scores.
        
        scores_list = results[0]
        # Convert to dictionary for easier consumption: { "label": score, ... }
        scores_dict = {item['label']: item['score'] for item in scores_list}
        
        return jsonify({
            'text': text,
            'scores': scores_dict
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port)
