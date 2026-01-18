# Quick Start Guide

Get Pixel-Proof up and running in 10 minutes!

---

## ⚡ Prerequisites

Before you begin, ensure you have:

- ✅ **Node.js 18+** installed ([Download](https://nodejs.org/))
- ✅ **Python 3.8+** installed ([Download](https://www.python.org/downloads/))
- ✅ **Adobe Express account** ([Sign up](https://new.express.adobe.com))
- ✅ **Git** installed ([Download](https://git-scm.com/))

---

## 🚀 Installation (5 minutes)

### Step 1: Clone Repository

```bash
git clone https://github.com/sudhitpopli/Pixel-Proof.git
cd Pixel-Proof
```

### Step 2: Install Node.js Dependencies

```bash
npm install
```

This will install all required packages including React, Express, Tesseract.js, and more.

### Step 3: Install Python Dependencies

```bash
cd model_service/hatebert_final
pip install flask transformers torch opencv-python-headless pandas numpy pillow
cd ../..
```

### Step 4: Set Up Environment (Optional)

```bash
# Create .env file
echo "GEMINI_API_KEY=your_key_here" > .env
echo "SERPAPI_KEY=your_key_here" >> .env
```

*Note: API keys are optional for basic hate speech detection*

---

## 🎮 Running the Application (3 minutes)

You need to run **three servers** simultaneously:

### Terminal 1: Adobe Express Add-on

```bash
npm start
```

**Expected output:**
```
✔ Compiled successfully!
🚀 Add-on running at https://localhost:5241
```

### Terminal 2: Node.js Backend

```bash
node server/server.js
```

**Expected output:**
```
🐍 Initializing Python Model Service...
✅ Python Service Launching...
🚀 Main Server running on http://localhost:3000
```

### Terminal 3: Python ML Service

```bash
cd model_service/hatebert_final
python app.py
```

**Expected output:**
```
Loading model from: /path/to/model
✅ Model loaded successfully!
 * Running on http://0.0.0.0:5001
```

---

## 🎨 Load in Adobe Express (2 minutes)

### Step 1: Open Adobe Express

Navigate to [https://new.express.adobe.com](https://new.express.adobe.com)

### Step 2: Access Add-ons

Click **"Add-ons"** in the left sidebar → **"Your add-ons"**

### Step 3: Load Test Add-on

1. Click **"Load test add-on"**
2. Enter: `https://localhost:5241`
3. Click **"Load"**

### Step 4: Open Pixel-Proof

The Pixel-Proof panel should appear on the right side!

---

## ✨ First Analysis

### Create Test Content

1. Add a text layer to your Adobe Express document
2. Type some sample text: "This is a test message"
3. Click the **"Refresh"** button in Pixel-Proof panel

### View Results

You should see:
- ✅ **Clean status** if no hate speech detected
- 📊 **Confidence scores** for each classification
- 🔴 **Red highlighting** if hate speech is detected

---

## 🧪 Test the Features

### Test 1: Hate Speech Detection

```
1. Add text: "This is a friendly message"
2. Click Refresh
3. Expected: Green checkmark, "No hate speech detected"
```

### Test 2: OCR Text Extraction

```
1. Add an image with text to your document
2. Click Refresh
3. Expected: Text extracted from image and analyzed
```

### Test 3: Legal Disclaimer

```
1. Click "Legal" tab
2. Select language (English, Spanish, French, German)
3. Click copy icon to copy disclaimer
4. Paste into your document
```

---

## 🐛 Troubleshooting

### Issue: "Model is still loading"

**Solution:** Wait 10-15 seconds for the Python ML model to fully load, then try again.

### Issue: "Failed to underline hateful words"

**Solution:** Ensure the sandbox is properly loaded. Refresh the Adobe Express page and reload the add-on.

### Issue: Port already in use

**Solution:** 
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

### Issue: Python dependencies not found

**Solution:**
```bash
pip install --upgrade pip
pip install -r model_service/hatebert_final/requirements.txt
```

---

## 📚 Next Steps

### Learn More
- 📖 Read the [Architecture Guide](docs/ARCHITECTURE.md)
- 🔌 Explore the [API Reference](docs/API_REFERENCE.md)
- 🚀 Check the [Deployment Guide](docs/DEPLOYMENT.md)

### Contribute
- 🤝 Read [Contributing Guidelines](CONTRIBUTING.md)
- 🐛 Report bugs on [GitHub Issues](https://github.com/sudhitpopli/Pixel-Proof/issues)
- 💡 Suggest features in [Discussions](https://github.com/sudhitpopli/Pixel-Proof/discussions)

### Customize
- 🎨 Modify UI in `src/ui/components/App.tsx`
- 🧠 Swap ML models in `model_service/hatebert_final/app.py`
- 🔧 Add endpoints in `server/server.js`

---

## 🎯 Common Use Cases

### Use Case 1: Social Media Content Review

```
1. Create social media post in Adobe Express
2. Run Pixel-Proof analysis
3. Review flagged content
4. Make corrections
5. Export clean content
```

### Use Case 2: Marketing Material Compliance

```
1. Design marketing flyer
2. Check for copyright violations (logo detection)
3. Verify no offensive language
4. Add legal disclaimer
5. Approve for publication
```

### Use Case 3: Educational Content Screening

```
1. Create educational infographic
2. Run hate speech detection
3. Ensure cultural sensitivity
4. Export for distribution
```

---

## 💡 Pro Tips

### Tip 1: Batch Analysis
Create multiple text layers and analyze all at once with a single click.

### Tip 2: Custom Disclaimers
Edit the disclaimer text before copying to match your brand voice.

### Tip 3: Keyboard Shortcuts
- `Ctrl/Cmd + R`: Refresh analysis (when panel is focused)
- `Ctrl/Cmd + C`: Copy disclaimer (when in Legal tab)

### Tip 4: Performance
For large documents, consider analyzing individual pages rather than the entire document.

---

## 📊 Understanding Results

### Confidence Scores

- **90-100%**: Very high confidence
- **70-89%**: High confidence
- **50-69%**: Medium confidence
- **Below 50%**: Low confidence (may be false positive)

### Risk Levels

- 🟢 **Low**: No issues detected
- 🟡 **Medium**: Minor concerns, review recommended
- 🔴 **High**: Significant issues, action required

---

## 🔒 Privacy & Security

- ✅ All processing happens locally (no data sent to external servers)
- ✅ Temporary files are auto-deleted after analysis
- ✅ No user data is stored or logged
- ✅ API keys are stored locally in `.env` file

---

## 📞 Get Help

- 💬 **Discord**: [Join our community](#) (coming soon)
- 📧 **Email**: support@pixelproof.dev
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/sudhitpopli/Pixel-Proof/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/sudhitpopli/Pixel-Proof/discussions)

---

## 🎉 You're All Set!

Congratulations! You now have Pixel-Proof running locally. Start analyzing your content for compliance and safety.

**Happy Creating! 🚀**

---

*Need more detailed information? Check out the [full documentation](docs/README.md).*
