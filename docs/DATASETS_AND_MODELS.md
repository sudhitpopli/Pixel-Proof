# Research-Grade Datasets & Models Catalog

## Complete Resource for ComplianceGuard Pro Model Training

This catalog includes:
1. **Datasets** - Training data (12.7M+ records)
2. **Detection Models** - Pre-trained models for compliance detection
3. **Text Replacement Models** - Paraphrasing and alternative suggestion models

---

## 🎯 PART 1: DATASETS FOR TRAINING

[Previous dataset content remains the same - keeping all Kaggle, USPTO, GitHub datasets]

---

## 🤖 PART 2: PRE-TRAINED DETECTION MODELS

### Hate Speech & Offensive Language Detection

#### Recommended Models (Hugging Face)

**1. GroNLP/hateBERT** ⭐ Top Choice
- **URL**: https://huggingface.co/GroNLP/hateBERT
- **Base**: BERT
- **Specialty**: English hate speech detection
- **Performance**: State-of-the-art on hate speech benchmarks
- **Use Case**: Primary hate speech detector

**2. Hate-speech-CNERG/dehatebert-mono-english**
- **URL**: https://huggingface.co/Hate-speech-CNERG/dehatebert-mono-english
- **Base**: DeBERTa
- **Specialty**: Monolingual English hate speech
- **Paper**: 2020 foundational model
- **Use Case**: Ensemble with hateBERT

**3. KoalaAI/HateSpeechDetector**
- **URL**: https://huggingface.co/KoalaAI/HateSpeechDetector
- **Base**: DeBERTa
- **Training**: tweet_eval dataset
- **Updated**: January 2024
- **Use Case**: Twitter/social media text

**4. cardiffnlp/twitter-roberta-base-hate-latest**
- **URL**: https://huggingface.co/cardiffnlp/twitter-roberta-base-hate-latest
- **Base**: RoBERTa
- **Specialty**: Twitter hate speech
- **Updated**: February 2025
- **Use Case**: Social media content

**5. minuva/MiniLMv2-toxic-jigsaw**
- **URL**: https://huggingface.co/minuva/MiniLMv2-toxic-jigsaw
- **Base**: MiniLM
- **Specialty**: Toxic language (Jigsaw dataset)
- **Size**: Lightweight, fast inference
- **Use Case**: Real-time detection

---

### Gender Bias & Inclusive Language Detection

#### Recommended Models

**1. d4data/bias-detection-model** ⭐ Top Choice
- **URL**: https://huggingface.co/d4data/bias-detection-model
- **Task**: Sequence classification
- **Specialty**: Bias and fairness detection
- **Language**: English
- **Use Case**: Primary gender bias detector

**2. facebook/md_gender_bias (Dataset + Model)**
- **URL**: https://huggingface.co/datasets/facebook/md_gender_bias
- **Tasks**: 
  - Controlling gender bias in generative models
  - Detecting bias in arbitrary text
  - Classifying offensive gendered content
- **Use Case**: Fine-tune for gender bias

**3. WinoBias Evaluation**
- **Tool**: LangTest with WinoBias dataset
- **Method**: Pronoun masking + coreference analysis
- **Use Case**: Evaluate model bias

---

### Trademark & Brand Detection (NER)

#### Recommended Models

**1. xlm-roberta-large-finetuned-conll03-english** ⭐ Top Choice
- **URL**: https://huggingface.co/xlm-roberta-large-finetuned-conll03-english
- **Base**: XLM-RoBERTa-large
- **Task**: Named Entity Recognition
- **Entities**: ORG (organizations/brands)
- **Use Case**: Detect brand names in text

**2. dslim/bert-base-NER**
- **URL**: https://huggingface.co/dslim/bert-base-NER
- **Base**: BERT
- **Task**: NER (PER, ORG, LOC, MISC)
- **Use Case**: General entity recognition

**3. Falconsai/brand_identification** (Visual)
- **URL**: https://huggingface.co/Falconsai/brand_identification
- **Base**: Vision Transformer (ViT)
- **Task**: Logo classification from images
- **Use Case**: Visual brand detection

**4. haydarkadioglu/brand-eye** (Visual)
- **URL**: https://huggingface.co/haydarkadioglu/brand-eye
- **Base**: YOLO
- **Task**: Real-time logo detection
- **Use Case**: Image/video brand monitoring

---

### Ensemble Approach for Detection

**Recommended Strategy**:
```python
# Combine multiple models for higher accuracy
ensemble = {
    'hate_speech': [
        'GroNLP/hateBERT',
        'Hate-speech-CNERG/dehatebert-mono-english',
        'cardiffnlp/twitter-roberta-base-hate-latest'
    ],
    'gender_bias': [
        'd4data/bias-detection-model',
        # Fine-tuned model on facebook/md_gender_bias
    ],
    'trademark': [
        'xlm-roberta-large-finetuned-conll03-english',
        'dslim/bert-base-NER'
    ]
}

# Voting mechanism: If 2+ models agree, flag as violation
```

---

## ✍️ PART 3: TEXT REPLACEMENT & PARAPHRASING MODELS

### For Generating Alternative Suggestions

#### Top Paraphrasing Models

**1. google/flan-t5-large** ⭐ Best Overall
- **URL**: https://huggingface.co/google/flan-t5-large
- **Base**: T5 (fine-tuned with FLAN)
- **Size**: 780M parameters
- **Strength**: Instruction-following, sophisticated rewrites
- **Prompt Example**: "Paraphrase this text to be more inclusive: [text]"
- **Use Case**: Primary text replacement engine

**2. google/flan-t5-xl** (Larger variant)
- **URL**: https://huggingface.co/google/flan-t5-xl
- **Size**: 3B parameters
- **Performance**: Higher quality, slower
- **Use Case**: Offline/batch processing

**3. Vamsi/T5_Paraphrase_Paws**
- **URL**: https://huggingface.co/Vamsi/T5_Paraphrase_Paws
- **Base**: T5
- **Training**: Google PAWS Dataset
- **Specialty**: Paraphrasing English sentences
- **Use Case**: Quick paraphrases

**4. Ateeqq/Text-Rewriter-Paraphraser**
- **URL**: https://huggingface.co/Ateeqq/Text-Rewriter-Paraphraser
- **Base**: T5-Base
- **Specialty**: Non-AI-detectable paraphrases
- **Use Case**: Natural-sounding alternatives

**5. kalpeshk2011/dipper-paraphraser-xxl**
- **URL**: https://huggingface.co/kalpeshk2011/dipper-paraphraser-xxl
- **Base**: DIPPER
- **Size**: XXL variant
- **Use Case**: High-quality paraphrasing

---

#### Advanced Text Generation Models

**For Complex Replacements & Suggestions**

**1. meta-llama/Llama-2-7b-chat-hf** ⭐ Recommended
- **URL**: https://huggingface.co/meta-llama/Llama-2-7b-chat-hf
- **Size**: 7B parameters
- **License**: Commercial use allowed
- **Strength**: Instruction-following, chat format
- **Prompt Example**: "Rewrite this to remove gender bias: [text]"
- **Use Case**: Complex rewrites with context

**2. mistralai/Mistral-7B-Instruct-v0.2**
- **URL**: https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.2
- **Size**: 7B parameters
- **Strength**: Fast, efficient, high-quality
- **Use Case**: Real-time alternative generation

**3. google/gemma-2b-it**
- **URL**: https://huggingface.co/google/gemma-2b-it
- **Size**: 2B parameters (lightweight!)
- **License**: Apache 2.0
- **Strength**: Fast inference, good quality
- **Use Case**: Resource-constrained environments

**4. facebook/bart-large-cnn**
- **URL**: https://huggingface.co/facebook/bart-large-cnn
- **Base**: BART
- **Task**: Summarization (can be adapted for paraphrasing)
- **Use Case**: Condensing/rewriting text

---

### Specialized Replacement Models

**For Specific Compliance Issues**

**1. Inclusive Language Replacement**
```python
# Use FLAN-T5 with specific prompts:
prompt = """
Replace gendered language with inclusive alternatives:
Input: "Hey guys, the chairman will see you now"
Output:"""

# Expected: "Hello everyone, the chair will see you now"
```

**2. Slogan Replacement**
```python
# Use Llama-2 or Mistral with context:
prompt = """
This text contains a trademarked slogan. Suggest 3 alternative phrases:
Input: "Just Do It - our new campaign"
Alternatives:"""

# Expected: 
# 1. "Take Action - our new campaign"
# 2. "Make It Happen - our new campaign"  
# 3. "Get Started - our new campaign"
```

**3. Cultural Sensitivity Replacement**
```python
# Use FLAN-T5 with cultural context:
prompt = """
Replace culturally insensitive content for Chinese market:
Input: "Call us at 4 Main Street, Suite 444"
Output:"""

# Expected: "Call us at 8 Main Street, Suite 888"
```

---

## 🔧 PART 4: MODEL DEPLOYMENT STRATEGIES

### Option 1: Hugging Face Inference API (Easiest)

```python
from huggingface_hub import InferenceClient

client = InferenceClient(token="YOUR_HF_TOKEN")

# Detection
result = client.text_classification(
    "Your text here",
    model="GroNLP/hateBERT"
)

# Paraphrasing
alternative = client.text_generation(
    "Paraphrase: Your text here",
    model="google/flan-t5-large"
)
```

**Pros**: No local setup, always latest models  
**Cons**: API costs, internet required

---

### Option 2: Local Deployment (Best Performance)

```python
from transformers import pipeline

# Load detection model
detector = pipeline(
    "text-classification",
    model="GroNLP/hateBERT"
)

# Load paraphrasing model
paraphraser = pipeline(
    "text2text-generation",
    model="google/flan-t5-large"
)

# Use
result = detector("Your text")
alternative = paraphraser("Paraphrase: Your text")
```

**Pros**: Fast, offline, no API costs  
**Cons**: Requires GPU, storage space

---

### Option 3: Quantized Models (Lightweight)

```python
# Use GGUF quantized models for smaller size
# Example: Llama-2-7B-GGUF (4-bit quantization)
# Reduces from 14GB to ~4GB

from llama_cpp import Llama

model = Llama(
    model_path="llama-2-7b-chat.Q4_K_M.gguf",
    n_ctx=2048
)

result = model("Paraphrase this: [text]")
```

**Pros**: Small size, CPU-friendly  
**Cons**: Slightly lower quality

---

## 📊 PART 5: RECOMMENDED MODEL COMBINATIONS

### For Phase 2 (Basic Detection)

**Detection Only** (No replacement yet):
- Hate Speech: `GroNLP/hateBERT`
- Gender Bias: `d4data/bias-detection-model`
- Trademark: `xlm-roberta-large-finetuned-conll03-english`

**Total Size**: ~2GB  
**Inference**: CPU-friendly

---

### For Phase 3+ (Detection + Replacement)

**Full Stack**:

**Detection**:
- Hate Speech: `GroNLP/hateBERT` + `cardiffnlp/twitter-roberta-base-hate-latest`
- Gender Bias: `d4data/bias-detection-model`
- Trademark: `xlm-roberta-large-finetuned-conll03-english`

**Replacement**:
- Primary: `google/flan-t5-large` (780M)
- Advanced: `mistralai/Mistral-7B-Instruct-v0.2` (7B)

**Total Size**: ~10GB  
**Inference**: GPU recommended

---

### For Production (Optimized)

**Lightweight Stack**:

**Detection**:
- All-in-one: `minuva/MiniLMv2-toxic-jigsaw` (lightweight)
- NER: `dslim/bert-base-NER`

**Replacement**:
- Primary: `google/gemma-2b-it` (2B, fast)
- Fallback: `Vamsi/T5_Paraphrase_Paws` (smaller)

**Total Size**: ~4GB  
**Inference**: CPU-friendly, fast

---

## 🎓 PART 6: TRAINING & FINE-TUNING

### Fine-Tuning Datasets (From Part 1)

**For Hate Speech**:
- MINED30 (400K entries)
- Davidson et al. (24.8K tweets)
- ETHOS (998 comments)

**For Gender Bias**:
- GenderAlign (8K dialogues)
- WinoBias (Winograd schemas)
- facebook/md_gender_bias

**For Trademarks**:
- USPTO (12.7M records)
- 10K Slogans dataset

---

### Fine-Tuning Process

```python
from transformers import AutoModelForSequenceClassification, Trainer

# 1. Load base model
model = AutoModelForSequenceClassification.from_pretrained(
    "GroNLP/hateBERT",
    num_labels=2  # hate/not-hate
)

# 2. Prepare dataset
from datasets import load_dataset
dataset = load_dataset("csv", data_files="your_data.csv")

# 3. Train
trainer = Trainer(
    model=model,
    train_dataset=dataset["train"],
    eval_dataset=dataset["test"]
)
trainer.train()

# 4. Save
model.save_pretrained("./my-finetuned-model")
```

---

## 🚀 PART 7: IMPLEMENTATION ROADMAP

### Phase 2: Basic Detection (No Replacement)

**Models to Deploy**:
1. `GroNLP/hateBERT` - Hate speech
2. Pattern matching - Slogans (hardcoded)

**No text replacement yet** - Just detection

---

### Phase 3: Detection + Simple Replacement

**Add**:
1. `Vamsi/T5_Paraphrase_Paws` - Basic paraphrasing
2. Template-based replacements for slogans

**Example**:
- Detected: "Just Do It"
- Replacement: "Take Action" (from template)

---

### Phase 4: Advanced Detection + AI Replacement

**Full Stack**:
1. **Detection**: Ensemble of 3+ models per category
2. **Replacement**: `google/flan-t5-large` or `Llama-2-7b-chat`

**Example**:
- Detected: "Hey guys, the chairman said..."
- AI Replacement: "Hello everyone, the chair said..."

---

## 📦 PART 8: QUICK START GUIDE

### Install Dependencies

```bash
pip install transformers torch datasets huggingface-hub
```

### Download Models

```python
from transformers import pipeline

# Detection
hate_detector = pipeline(
    "text-classification",
    model="GroNLP/hateBERT"
)

# Replacement
paraphraser = pipeline(
    "text2text-generation",
    model="google/flan-t5-large"
)
```

### Use in ComplianceGuard Pro

```python
# Detect
text = "Your problematic text"
result = hate_detector(text)

if result[0]['label'] == 'HATE':
    # Generate alternative
    prompt = f"Paraphrase to be respectful: {text}"
    alternative = paraphraser(prompt)[0]['generated_text']
    
    return {
        'detected': True,
        'original': text,
        'alternative': alternative
    }
```

---

## 📚 Additional Resources

### Hugging Face Collections
- [Hate Speech Models](https://huggingface.co/models?pipeline_tag=text-classification&search=hate)
- [Paraphrasing Models](https://huggingface.co/models?search=paraphrase)
- [NER Models](https://huggingface.co/models?pipeline_tag=token-classification)

### Documentation
- [Transformers Library](https://huggingface.co/docs/transformers)
- [Datasets Library](https://huggingface.co/docs/datasets)
- [Model Hub](https://huggingface.co/models)

### Papers
- hateBERT: [arXiv:2010.12472](https://arxiv.org/abs/2010.12472)
- FLAN-T5: [arXiv:2210.11416](https://arxiv.org/abs/2210.11416)
- Llama 2: [arXiv:2307.09288](https://arxiv.org/abs/2307.09288)

---

## 🎯 Summary

**Total Resources**:
- **Datasets**: 12.7M+ records across 15+ sources
- **Detection Models**: 15+ pre-trained models
- **Replacement Models**: 10+ paraphrasing/generation models

**Recommended Starter Stack**:
1. Detection: `GroNLP/hateBERT`
2. Replacement: `google/flan-t5-large`
3. NER: `xlm-roberta-large-finetuned-conll03-english`

**Total Size**: ~3GB  
**Performance**: Good balance of quality and speed  
**Cost**: Free (open-source)

---

## 🚀 PART 9: IMPLEMENTED ML MODELS

### Hate Speech Detection - GroNLP/hateBERT

**Status**: ✅ Implemented and Active

#### Model Details

**Model**: `GroNLP/hateBERT`  
**URL**: https://huggingface.co/GroNLP/hateBERT  
**Type**: BERT-based text classification  
**Task**: Hate speech detection  
**Language**: English  

#### Implementation

The hate speech detection model is integrated via the Hugging Face Inference API and accessible through the ComplianceGuard Pro UI.

**Service File**: `src/sandbox/mlService.ts`  
**Sandbox Integration**: `src/sandbox/code.ts`  
**UI Component**: `src/ui/components/App.tsx`

#### Features

- **Real-time Detection**: Analyzes text for hate speech with confidence scores
- **Batch Processing**: Processes multiple text segments efficiently
- **Result Caching**: Caches results to reduce API calls
- **Rate Limiting**: Prevents API throttling with automatic delays
- **Error Handling**: Robust error handling with user-friendly messages

#### Usage

**Configuration**:
```typescript
// Configure with Hugging Face API key
await sandboxProxy.configureMLService({ 
  apiKey: 'hf_xxxxxxxxxxxxx',
  model: 'GroNLP/hateBERT'
});
```

**Analyze Document**:
```typescript
// Analyze all text in current document
const result = await sandboxProxy.analyzeDocumentForHateSpeech();

// Result format:
{
  success: true,
  results: [
    {
      text: "Sample text...",
      result: {
        label: "hate" | "not-hate",
        score: 0.95,
        isHateSpeech: true,
        confidence: 95.0,
        model: "GroNLP/hateBERT",
        timestamp: 1234567890
      }
    }
  ],
  summary: {
    totalAnalyzed: 10,
    hateSpeechCount: 2,
    cleanCount: 8,
    averageConfidence: 87.5
  }
}
```

**Analyze Web Content**:
```typescript
// First crawl a webpage
const crawlResult = await sandboxProxy.crawlWebPage('https://example.com');

// Then analyze the crawled content
const analysis = await sandboxProxy.analyzeCrawledContentForHateSpeech(crawlResult);
```

**Direct Text Analysis**:
```typescript
// Analyze specific text
const result = await sandboxProxy.analyzeTextForHateSpeech("Your text here");

// Result:
{
  label: "not-hate",
  score: 0.98,
  isHateSpeech: false,
  confidence: 98.0,
  model: "GroNLP/hateBERT",
  timestamp: 1234567890
}
```

#### Performance Characteristics

- **Accuracy**: State-of-the-art on hate speech benchmarks
- **Speed**: ~500ms per text segment (via API)
- **Rate Limit**: 500ms delay between requests to avoid throttling
- **Cache**: In-memory cache for up to 100 results
- **Model Size**: Hosted on Hugging Face (no local storage needed)

#### API Requirements

**Free Tier**: Hugging Face Inference API  
**API Key**: Required (get from https://huggingface.co/settings/tokens)  
**Rate Limits**: Standard Hugging Face limits apply  
**Cost**: Free for moderate usage

#### Integration Points

1. **Document Analysis**: Analyzes all text nodes in Adobe Express documents
2. **Web Crawler**: Analyzes text from crawled web pages
3. **Direct Input**: Analyzes arbitrary text strings

#### Future Enhancements

**Planned**:
- Ensemble detection with multiple models
- Gender bias detection (d4data/bias-detection-model)
- Trademark detection (NER models)
- Custom fine-tuning on domain-specific data
- Offline model support for privacy

**Ensemble Configuration** (Future):
```typescript
// Use multiple models for higher accuracy
await sandboxProxy.configureMLService({
  apiKey: 'hf_xxxxxxxxxxxxx',
  models: [
    'GroNLP/hateBERT',
    'Hate-speech-CNERG/dehatebert-mono-english',
    'cardiffnlp/twitter-roberta-base-hate-latest'
  ],
  votingStrategy: 'majority' // or 'weighted'
});
```

#### Troubleshooting

**Common Issues**:

1. **"ML Service not configured"**
   - Solution: Enter your Hugging Face API key in the UI configuration panel

2. **"Invalid API key"**
   - Solution: Verify your API key at https://huggingface.co/settings/tokens

3. **"Rate limit exceeded"**
   - Solution: Wait a moment and try again. The service automatically handles rate limiting.

4. **"Request timeout"**
   - Solution: The model may be loading. Wait 30 seconds and retry.

#### Example Workflow

```typescript
// 1. Configure ML service
await sandboxProxy.configureMLService({ 
  apiKey: 'hf_xxxxxxxxxxxxx'
});

// 2. Extract text from document
const extraction = await sandboxProxy.extractText();

// 3. Analyze for hate speech
const analysis = await sandboxProxy.analyzeDocumentForHateSpeech();

// 4. Review results
if (analysis.summary.hateSpeechCount > 0) {
  console.log(`⚠️ Found ${analysis.summary.hateSpeechCount} instances of hate speech`);
  
  // Filter flagged content
  const flagged = analysis.results.filter(r => r.result.isHateSpeech);
  flagged.forEach(item => {
    console.log(`Text: "${item.text}"`);
    console.log(`Confidence: ${item.result.confidence}%`);
  });
}
```

---

## 📚 Additional Resources
```
