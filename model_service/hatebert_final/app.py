import os
import sys
import re
import json
from flask import Flask, request, jsonify
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
from img_editor import crop_image
from search_logos import search_logo

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

@app.route('/crop-images', methods=['POST'])
def crop_images():
    """
    Crop images from a screenshot based on image positions
    Expects: multipart/form-data with:
    - image: The screenshot file
    - image_positions: JSON string with array of image positions
    """
    try:
        # Check if image file is present
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        image_file = request.files['image']
        if image_file.filename == '':
            return jsonify({'error': 'No image file selected'}), 400
        
        # Get image positions from form data
        image_positions_json = request.form.get('image_positions', '[]')
        try:
            image_positions = json.loads(image_positions_json)
        except json.JSONDecodeError:
            return jsonify({'error': 'Invalid image_positions JSON'}), 400
        
        if not isinstance(image_positions, list):
            return jsonify({'error': 'image_positions must be an array'}), 400
        
        # Save uploaded image temporarily
        upload_dir = os.path.join(BASE_DIR, "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        image_path = os.path.join(upload_dir, image_file.filename)
        image_file.save(image_path)
        
        # Create output directory
        output_dir = os.path.join(BASE_DIR, "output")
        os.makedirs(output_dir, exist_ok=True)
        
        cropped_results = []
        
        # Crop each image
        for idx, img_info in enumerate(image_positions):
            try:
                x = int(img_info.get('x', 0))
                y = int(img_info.get('y', 0))
                width = int(img_info.get('width', 0))
                height = int(img_info.get('height', 0))
                img_id = img_info.get('id', f'image_{idx}')
                
                # Generate output filename
                base_name = os.path.splitext(image_file.filename)[0]
                output_filename = f"{base_name}_crop_{idx}_{img_id}.png"
                output_path = os.path.join(output_dir, output_filename)
                
                # Crop the image
                result = crop_image(image_path, output_path, x, y, width, height)
                
                if result['success']:
                    # Search for logo match in the cropped image
                    logo_result = search_logo(output_path, threshold=0.05)
                    
                    crop_data = {
                        'id': img_id,
                        'output_path': result['output_path'],
                        'crop_area': result['crop_area'],
                        'cropped_size': result['cropped_size']
                    }
                    
                    # Add logo search results if match found
                    if logo_result['found']:
                        company_name = logo_result['company']
                        # Convert to native Python float for JSON serialization
                        distance = float(logo_result['distance'])
                        print(f"✅ LOGO MATCH FOUND: Company: {company_name} (distance: {distance:.4f})")
                        print(f"   Image: {output_filename}")
                        crop_data['logo_match'] = {
                            'company': company_name,
                            'distance': distance,
                            'match_found': True
                        }
                    else:
                        logo_distance = logo_result.get('distance')
                        if logo_distance is not None:
                            # Convert to native Python float for JSON serialization
                            logo_distance = float(logo_distance)
                            print(f"❌ No logo match for {output_filename} (distance: {logo_distance:.4f} >= 0.05)")
                        else:
                            print(f"⚠️  Logo search failed for {output_filename}: {logo_result.get('error', 'Unknown error')}")
                        crop_data['logo_match'] = {
                            'match_found': False,
                            'distance': logo_distance,
                            'error': logo_result.get('error')
                        }
                    
                    cropped_results.append(crop_data)
                else:
                    cropped_results.append({
                        'id': img_id,
                        'success': False,
                        'error': result.get('error', 'Unknown error')
                    })
                    
            except Exception as e:
                cropped_results.append({
                    'id': img_info.get('id', f'image_{idx}'),
                    'success': False,
                    'error': str(e)
                })
        
        # Clean up temporary uploaded file
        try:
            os.remove(image_path)
        except:
            pass
        
        # Prepare response before cleanup
        response_data = {
            'success': True,
            'total_images': len(image_positions),
            'cropped_count': len([r for r in cropped_results if r.get('success', True)]),
            'results': cropped_results,
            'output_directory': output_dir
        }
        
        # Clean up output folder - remove all files after processing
        try:
            if os.path.exists(output_dir):
                for filename in os.listdir(output_dir):
                    file_path = os.path.join(output_dir, filename)
                    try:
                        if os.path.isfile(file_path):
                            os.remove(file_path)
                    except Exception as e:
                        print(f"⚠️  Warning: Could not delete {file_path}: {e}")
            print(f"🧹 Cleaned up output directory: {output_dir}")
        except Exception as e:
            print(f"⚠️  Warning: Error cleaning up output directory: {e}")
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"❌ Crop Error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port)