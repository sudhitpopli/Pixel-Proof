# Research-Grade Datasets for ComplianceGuard Pro

## Dataset Catalog for Model Fine-Tuning

---

## 1. Hate Speech & Offensive Language Detection

### 🔥 Primary Dataset: Hate Speech and Offensive Language (Kaggle)
- **Size**: 24,783 labeled tweets
- **Format**: CSV (`labeled_data.csv`)
- **Labels**: Hate speech, Offensive language, Neither
- **Download**: https://www.kaggle.com/datasets/mrmorj/hate-speech-and-offensive-language-dataset
- **Use Case**: Train violent/offensive language detector
- **Quality**: Manually labeled by multiple coders

### 🔥 Large-Scale Dataset: MINED30 Hate Speech
- **Size**: ~400,000 entries (after preprocessing)
- **Language**: English
- **Platform**: Twitter/X
- **Download**: https://github.com/MINED30/Hate_Speech_Detection
- **Challenge**: Class imbalance (needs balancing techniques)
- **Use Case**: Large-scale model training

### 🔥 ETHOS Hate Speech Dataset
- **Size**: 998 comments (43.4% hate speech)
- **Platforms**: YouTube, Reddit
- **Format**: Multi-label (violence, gender, race, religion)
- **Download**: https://www.kaggle.com/datasets/cosmos98/twitter-and-reddit-sentimental-analysis-dataset
- **Use Case**: Multi-category hate speech classification

### 🔥 Davidson et al. Dataset
- **Size**: 24,802 tweets
- **Paper**: "Automated Hate Speech Detection and the Problem of Offensive Language" (2017)
- **Download**: https://www.kaggle.com/datasets/usharengaraju/hate-speech-offensive-tweets-by-davidson-et-al
- **Use Case**: Academic benchmark dataset

### 🔥 Offensive Language Repository (GitHub)
- **Languages**: English, Spanish, German
- **Platforms**: Twitter, Wikipedia, Fox News
- **Download**: https://github.com/isabelline/OffensiveLanguage
- **Use Case**: Multilingual offensive language detection

---

## 2. Gender Bias & Inclusive Language

### 👥 WinoBias Dataset
- **Size**: Winograd-schema style sentences
- **Focus**: Occupation-based gender bias
- **Download**: https://www.kaggle.com/datasets/eibriel/winobias-genderbias-resolution
- **Use Case**: Coreference resolution, gender stereotype detection
- **Quality**: Specifically designed for bias evaluation

### 👥 GenderAlign Dataset
- **Size**: 8,000 single-turn dialogues
- **Purpose**: Mitigate comprehensive gender biases in LLMs
- **Format**: Automated annotation scheme
- **Paper**: https://arxiv.org/abs/[GenderAlign paper]
- **Use Case**: LLM alignment for gender neutrality

### 👥 Sexist Workplace Statements
- **Size**: 1,100+ examples
- **Balance**: Clear sexism vs. ambiguous/neutral
- **Download**: https://www.kaggle.com/datasets/dgrosz/sexist-workplace-statements
- **Use Case**: Workplace-specific bias detection

### 👥 EquiLens Corpus Generator
- **Type**: Template-driven prompt corpus
- **Purpose**: Controlled gender-bias detection
- **Download**: https://www.kaggle.com/datasets/equilens/pure-gender-bias-detection
- **Use Case**: Statistical comparison of gender-related responses

---

## 3. Trademark & Brand Detection

### ™️ USPTO Trademark Case Files (MASSIVE)
- **Size**: 12.7 MILLION applications
- **Date Range**: October 1870 - March 2024
- **Format**: JSON, CSV
- **Download**: https://www.uspto.gov/ip-policy/economic-research/research-datasets/trademark-case-files-dataset
- **Fields**: Word mark, serial number, filing date, goods/services, classification
- **Use Case**: Comprehensive trademark detection training

### ™️ US Trademark Applications (Kaggle)
- **Size**: Pending + registered trademarks
- **Date Range**: April 1884 - present
- **Format**: JSON
- **Download**: https://www.kaggle.com/datasets/uspto/trademark-applications
- **Use Case**: NLP classification, semantic similarity

### ™️ Known Brands Slogans (740 brands)
- **Size**: 740 brands with historical slogans
- **Additional Data**: Revenue 2020, risk assessment
- **Download**: https://www.kaggle.com/datasets/thedevastator/known-brands-slogans-and-risk-assessment
- **Use Case**: Slogan pattern analysis, revenue correlation

### ™️ 10k+ Slogan Dataset
- **Size**: 10,000+ slogans
- **Source**: sloganlist.com
- **Fields**: Company name, category, all slogans (not just suggested)
- **Download**: https://www.kaggle.com/datasets/deepcontractor/10k-company-slogans-from-sloganlistcom
- **Use Case**: Slogan generation, trend analysis

### ™️ Slogan Trends Dataset (1,162 companies)
- **Size**: 1,162 company slogans
- **Purpose**: Industry analysis, branding strategies
- **Download**: https://www.kaggle.com/datasets/chaitanyabapat/slogan-dataset
- **Use Case**: Identify successful slogan patterns

---

## 4. Cultural Sensitivity & Cross-Cultural NLP

### 🌍 CultureCare Dataset
- **Size**: First culturally sensitive emotional support dataset
- **Cultures**: 4 distinct cultures
- **Download**: https://github.com/CultureCare (check for public release)
- **Use Case**: Culturally aware emotional support systems

### 🌍 MultiMM Dataset
- **Type**: Multimodal (text-image)
- **Focus**: Cross-cultural metaphors in advertisements
- **Cultures**: Eastern vs. Western
- **Paper**: https://arxiv.org/abs/[MultiMM paper]
- **Use Case**: Cross-cultural visual-linguistic analysis

### 🌍 PALM Dataset (Arabic LLMs)
- **Size**: Culturally inclusive Arabic data
- **Coverage**: Various Arab countries and dialects
- **Download**: https://aclanthology.org/[PALM paper]
- **Use Case**: Culturally diverse language models

### 🌍 IEEE Cross-Cultural Communication Papers
- **Source**: IEEE Xplore
- **Topics**: Multilingual chatbots, disability awareness, low-resource languages
- **Access**: https://ieeexplore.ieee.org/
- **Search Terms**: "cross-cultural NLP", "cultural sensitivity dataset"
- **Use Case**: Academic research methodologies

---

## 5. Additional Resources

### 📚 GitHub Awesome Lists
- **Hate Speech Datasets**: https://github.com/aymeam/Datasets-for-Hate-Speech-Detection
- **Offensive Language**: https://github.com/isabelline/OffensiveLanguage
- **Use Case**: Curated lists with multiple dataset links

### 📚 Hate Speech Dataset Catalogue
- **URL**: https://hatespeechdata.com
- **Content**: Comprehensive catalogue of hate speech datasets
- **Platforms**: Twitter, Reddit, Wikipedia, news sites
- **Use Case**: Find domain-specific datasets

---

## Dataset Selection Recommendations

### For Phase 1 (Minimal Working Add-on)
**Skip datasets** - Use hardcoded detection rules

### For Phase 2 (Basic Detection)
- **Slogans**: 10k+ Slogan Dataset (10,000 entries)
- **Offensive Language**: Davidson et al. (24,802 tweets)

### For Phase 3 (Cultural Sensitivity)
- **Cultural**: CultureCare + MultiMM (research papers)
- **Numbers/Colors**: Manual curation from research

### For Production (Full Model Training)
- **Hate Speech**: MINED30 (400K entries)
- **Gender Bias**: GenderAlign (8K dialogues) + WinoBias
- **Trademarks**: USPTO (12.7M records)
- **Cultural**: PALM + IEEE papers

---

## Download Instructions

### Kaggle Datasets
1. Create Kaggle account
2. Install Kaggle API: `pip install kaggle`
3. Download API token from kaggle.com/account
4. Place in `~/.kaggle/kaggle.json`
5. Download: `kaggle datasets download -d <dataset-path>`

### GitHub Datasets
1. Clone repository: `git clone <repo-url>`
2. Or download ZIP from GitHub

### USPTO Data
1. Visit https://www.uspto.gov/ip-policy/economic-research/research-datasets
2. Download directly (large files, 10GB+)

### IEEE Papers
1. Requires institutional access or purchase
2. Alternative: Search on arXiv for preprints

---

## Dataset Sizes Summary

| Dataset | Size | Format | Use Case |
|---------|------|--------|----------|
| USPTO Trademarks | 12.7M | JSON/CSV | Trademark detection |
| MINED30 Hate Speech | 400K | CSV | Offensive language |
| GenderAlign | 8K | JSON | Gender bias |
| 10k Slogans | 10K | CSV | Slogan analysis |
| Davidson Hate Speech | 24.8K | CSV | Hate speech |
| WinoBias | ~3K | Text | Gender bias |
| ETHOS | 998 | CSV | Multi-label hate |

---

## Next Steps

1. **Download Priority Datasets**:
   - 10k Slogans (small, easy start)
   - Davidson Hate Speech (24K, manageable)
   - WinoBias (gender bias)

2. **Preprocessing**:
   - Clean data (remove duplicates, handle missing values)
   - Balance classes (if needed)
   - Split train/val/test (80/10/10)

3. **Model Training**:
   - Start with pre-trained models (BERT, RoBERTa)
   - Fine-tune on domain-specific data
   - Evaluate on held-out test sets

4. **Integration**:
   - Export trained models to ONNX/TensorFlow.js
   - Deploy in add-on for real-time inference
