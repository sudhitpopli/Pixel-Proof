# Research-Grade Datasets & Models Catalog

## 🎯 RESOURCE OVERVIEW

This catalog is optimized for **ComplianceGuard Pro**. It focuses on:
1.  **Implicit Claims & Exaggeration**: Detecting verified/unverified marketing claims (e.g., "100% germ killing").
2.  **Hate Speech & Bias**: Detecting offensive language and stereotypes.
3.  **Trademarks & Brands**: Protecting intellectual property.

**Structure**:
*   **Datasets**: Multiple high-quality databases for fine-tuning.
*   **Models**: **One** top-tier, efficient model recommendation per category to save space and compute.

---

## 📚 PART 1: DATASETS (For Fine-Tuning)

### A. Implicit Claims, Exaggeration & Fact-Checking
*For detecting impossible business claims, fake scientific properties, and clickbait.*

| Dataset Name | Description | Size | Best For |
| :--- | :--- | :--- | :--- |
| **SciFact** | Expert-written scientific claims paired with evidence-containing abstracts. Labels: *SUPPORT*, *REFUTE*. | 1.4K Claims | Verifying "scientific" marketing claims (e.g., "clinically proven"). |
| **FEVER (Fact Extraction and VERification)** | Large-scale dataset for verifying claims against Wikipedia evidence. | 185K Claims | General knowledge verification and fact-checking baseline. |
| **PUBHEALTH** | Public health claims fact-checked by experts (e.g., Snopes, Politifact). | 11.8K Claims | Detecting health/medical misinformation in ads. |
| **Politifact (Fact Check)** | Statements graded on a truth-o-meter (True to Pants-on-Fire). | 21K+ Claims | Detecting exaggerated or deceptive political/business statements. |
| **Bad News / Clickbait** | Headlines and text labeled as clickbait, deceptive, or reliable. | ~20K entries | Identifying sensationalist or clickbait marketing styles. |
| **SciClaimHunt** | Large-scale dataset of scientific claims derived from research papers. | 10K+ Claims | Advanced scientific claim detection. |

### B. Hate Speech & Offensive Language
*For maintaining brand safety and community guidelines.*

| Dataset Name | Description | Size | Best For |
| :--- | :--- | :--- | :--- |
| **HateXplain** | Hate speech with rationale annotations (why it is hate speech). | 20K posts | Explaining *why* a phrase is flagged. |
| **Dynabench (Dynahate)** | Human-in-the-loop generated hate speech (harder examples). | 40K entries | Detecting subtle, implicit hate speech. |
| **ETHOS** | Binary and multi-label hate speech detection dataset. | 998 entries | High-quality, diverse dataset for validation. |
| **Measuring Hate Speech** | Annotations for sentiment, respect, and offensiveness. | 39K comments | Fine-grained severity analysis. |

### C. Trademarks & Named Entities (NER)
*For detecting unauthorized use of brand names.*

| Dataset Name | Description | Size | Best For |
| :--- | :--- | :--- | :--- |
| **CoNLL-2003** | Standard NER dataset with organizations (ORG), locations (LOC), etc. | 22K sentences | Baseline for detecting company names/brands. |
| **USPTO Trademark Data** | United States Patent and Trademark Office textual data. | Millions | The ultimate source for verifying US trademarks. |
| **WNUT 2017** | Noisy user-generated text with emerging entities. | 5K sentences | Detecting brand mentions in social media style text. |

---

## 🤖 PART 2: RECOMMENDED MODELS (One Per Category)

To reduce file size and complexity, we recommend deploying **one** robust model per category.

### 1. Implicit Claim & Fact Verification
**Recommended Model**: `Dzeniks/roberta-fact-check`
*   **Base**: RoBERTa
*   **Task**: Fact Checking / Claim Verification
*   **Why**: It is specifically fine-tuned to classify a claim as *SUPPORTED* or *REFUTED* by evidence. It helps detect if a marketing claim ("This kills 100% of germs") contradicts established facts or lacks evidence.
*   **Hugging Face**: [Dzeniks/roberta-fact-check](https://huggingface.co/Dzeniks/roberta-fact-check)

### 2. Hate Speech & Toxicity
**Recommended Model**: `facebook/roberta-hate-speech-dynabench-r4-target`
*   **Base**: RoBERTa
*   **Task**: Text Classification
*   **Why**: Trained on "Dynabench" data, it is excellent at detecting *implicit* and challenging hate speech that standard models miss. It's more robust against adversarial attacks.
*   **Hugging Face**: [facebook/roberta-hate-speech-dynabench-r4-target](https://huggingface.co/facebook/roberta-hate-speech-dynabench-r4-target)

### 3. Trademark & Brand Detection
**Recommended Model**: `babelscape/wikineural-multilingual-ner`
*   **Base**: WiNER
*   **Task**: Named Entity Recognition (NER)
*   **Why**: State-of-the-art performance on detecting entities (Organizations, Locations, Products) across multiple languages, making it superior for global brand compliance.
*   **Hugging Face**: [babelscape/wikineural-multilingual-ner](https://huggingface.co/babelscape/wikineural-multilingual-ner)

---

## 🛠️ PART 3: FINE-TUNING STRATEGY

To handle specific "impossible business claims" (e.g., property usage, 100% guarantees), you should **fine-tune** the Fact Verification model.

### Recipe: "Marketing Truth Model"

**Goal**: Create a model that flags claims like "Guaranteed to make you rich" or "100% cure."

**Steps**:
1.  **Base Model**: Start with `Dzeniks/roberta-fact-check`.
2.  **Dataset Mix**:
    *   50% **SciFact** (for strict scientific/medical accuracy).
    *   30% **Politifact** (for truthfulness patterns).
    *   20% **Bad News** (to learn sensationalist phrasing).
3.  **Training Objective**: Classify inputs into `VERIFIED_TRUE`, `EXAGGERATED`, or `UNVERIFIED_CLAIM`.
4.  **Deployment**: Any claim flagged as `EXAGGERATED` or `UNVERIFIED` triggers a "Compliance Warning" in your UI.

```python
# Pseudo-code for using the recommended Fact Check model
from transformers import pipeline

fact_checker = pipeline("text-classification", model="Dzeniks/roberta-fact-check")

claim = "Our toothpaste kills 100% of all bacteria forever."
# Evidence could be retrieved from a reliable knowledge base or the model's internal knowledge
result = fact_checker(claim) 

# Result might indicate: REFUTED (or low confidence support)
print(f"Claim Compliance Status: {result}")
```
