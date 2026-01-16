import os
from transformers import (
    AutoTokenizer, AutoModelForSequenceClassification, 
    pipeline
)
import torch

model_dir = "./model"

print(f"Loading: {os.path.abspath(model_dir)}")

tokenizer = AutoTokenizer.from_pretrained(model_dir, local_files_only=True)
model = AutoModelForSequenceClassification.from_pretrained(model_dir, local_files_only=True)

classifier = pipeline(
    "text-classification",
    model=model,
    tokenizer=tokenizer,
    device=-1,
    top_k=3,
    return_all_scores=True
)

test_texts = [
    "You are a fucking idiot loser",
    "I hate everyone", 
    "Nice day",
    "kill yourself",
    "offensive shit",
    "test this",
    "dont freak out",
    "you are a freak",
    "offensive language",
    "nigga",
    "black neighbourhood"
]

for text in test_texts:
    result = classifier(text)
    scores_list = result[0]  # Your format: [{'label': 'neither', 'score': 0.97}, ...]
    scores = {item['label']: item['score'] for item in scores_list}
    
    best_label = max(scores, key=scores.get)
    best_score = scores[best_label]
    
    print(f"Input:  '{text}'")
    print(f"Pred:   {best_label:<20} {best_score:.1%}")
    print(f"All:    { {k: f'{v:.1%}' for k,v in scores.items()} }")
    print("-" * 60)
