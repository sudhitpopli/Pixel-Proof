import os
import sys
import re
from flask import Flask, request, jsonify
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "model")

print(f"Loading model from: {MODEL_DIR}")

try:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR, local_files_only=True)
    
    # helper pipeline
    classifier = pipeline(
        "text-classification",
        model=model,
        tokenizer=tokenizer,
        device=-1,  # CPU
        top_k=None, # Return scores for ALL labels
        truncation=True,
        max_length=512
    )
    print("✅ Model loaded successfully!")
except Exception as e:
    print(f"❌ Error loading model: {str(e)}")
    sys.exit(1)

def split_into_sentences(text):
    """Splits text into sentences but keeps punctuation."""
    if not text: return []
    # Split by punctuation (. ! ?) followed by whitespace
    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sentences if s.strip()]

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        text = data.get('text', '')
        if not text:
            return jsonify({'error': 'No text provided'}), 400

        print(f"🔍 Analyzing text length: {len(text)} chars")

        # 1. Split text into segments
        sentences = split_into_sentences(text)
        
        # Fallback if splitting failed (e.g. no punctuation)
        if not sentences: 
            sentences = [text]

        # 2. Batch process
        results = classifier(sentences)
        
        analyzed_segments = []
        
        for sentence, result_list in zip(sentences, results):
            # Find the label with highest score
            top_result = max(result_list, key=lambda x: x['score'])
            
            # DEBUG: Print label to console to ensure we catch 'HATE' vs 'hate_speech' etc.
            # print(f"Segment: {sentence[:20]}... -> {top_result['label']}")

            # Check for hate speech (Adjust these strings to match your specific model)
            label_str = top_result['label'].upper()
            is_hate = any(x in label_str for x in ['HATE', 'OFFENSIVE', 'ABUSIVE', 'TOXIC'])

            analyzed_segments.append({
                "text": sentence,
                "label": top_result['label'],
                "confidence": top_result['score'],
                "is_hate": is_hate
            })

        return jsonify({
            'full_text': text,
            'segments': analyzed_segments
        })

    except Exception as e:
        print(f"❌ Prediction Error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port)