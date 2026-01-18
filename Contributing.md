# Contributing to Pixel-Proof

Thank you for your interest in contributing to Pixel-Proof! This document provides guidelines and instructions for contributing to the project.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)

---

## 🤝 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of background, identity, or experience level.

### Expected Behavior

- Be respectful and considerate
- Use welcoming and inclusive language
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards others

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Trolling, insulting, or derogatory remarks
- Publishing others' private information
- Any conduct that could be considered unprofessional

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.8+ with pip
- **Git** for version control
- **Code editor** (VS Code recommended)

### Fork and Clone

```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/Pixel-Proof.git
cd Pixel-Proof

# Add upstream remote
git remote add upstream https://github.com/sudhitpopli/Pixel-Proof.git
```

### Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
cd model_service/hatebert_final
pip install -r requirements.txt
cd ../..
```

### Set Up Development Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your API keys
# GEMINI_API_KEY=your_key_here
# SERPAPI_KEY=your_key_here
```

---

## 💻 Development Workflow

### Branch Strategy

We use **Git Flow** for branch management:

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Urgent production fixes

### Creating a Feature Branch

```bash
# Update your local repository
git checkout develop
git pull upstream develop

# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes
# ...

# Commit your changes
git add .
git commit -m "feat: add amazing feature"

# Push to your fork
git push origin feature/your-feature-name
```

### Commit Message Convention

We follow **Conventional Commits** specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```bash
feat(ml): add gender bias detection model
fix(ui): resolve text highlighting issue
docs(readme): update installation instructions
refactor(server): optimize image processing pipeline
```

---

## 📐 Coding Standards

### TypeScript/JavaScript

**Style Guide:** Airbnb JavaScript Style Guide

**Key Rules:**
- Use TypeScript for type safety
- Prefer `const` over `let`, avoid `var`
- Use arrow functions for callbacks
- Use async/await over promises
- Add JSDoc comments for public functions

**Example:**
```typescript
/**
 * Analyzes text for hate speech
 * @param text - The text to analyze
 * @returns Analysis result with confidence scores
 */
async function analyzeText(text: string): Promise<AnalysisResult> {
  const response = await fetch('/analyze-hate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  
  return response.json();
}
```

### Python

**Style Guide:** PEP 8

**Key Rules:**
- Use 4 spaces for indentation
- Maximum line length: 88 characters (Black formatter)
- Use type hints for function signatures
- Add docstrings for all functions

**Example:**
```python
def analyze_hate_speech(text: str) -> dict:
    """
    Analyze text for hate speech using HateBERT model.
    
    Args:
        text: Input text to analyze
        
    Returns:
        Dictionary containing analysis results with confidence scores
        
    Raises:
        ValueError: If text is empty
    """
    if not text:
        raise ValueError("Text cannot be empty")
    
    results = classifier(text)
    return format_results(results)
```

### React Components

**Guidelines:**
- Use functional components with hooks
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use TypeScript interfaces for props

**Example:**
```typescript
interface AnalysisResultProps {
  results: AnalysisResult;
  onRefresh: () => void;
}

const AnalysisResult: React.FC<AnalysisResultProps> = ({ results, onRefresh }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="analysis-result">
      <h3>Results</h3>
      {/* Component content */}
    </div>
  );
};
```

---

## 🧪 Testing Guidelines

### Unit Tests

**Framework:** Jest for JavaScript/TypeScript, pytest for Python

**Coverage Target:** 80% minimum

**Example (TypeScript):**
```typescript
// __tests__/analyzeText.test.ts
import { analyzeText } from '../utils/analyzeText';

describe('analyzeText', () => {
  it('should detect hate speech', async () => {
    const result = await analyzeText('offensive text');
    expect(result.isHateSpeech).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.8);
  });
  
  it('should handle empty text', async () => {
    await expect(analyzeText('')).rejects.toThrow('Text cannot be empty');
  });
});
```

**Example (Python):**
```python
# tests/test_app.py
import pytest
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_predict_endpoint(client):
    response = client.post('/predict', json={'text': 'test message'})
    assert response.status_code == 200
    assert 'segments' in response.json
```

### Integration Tests

Test the full flow from UI to backend to ML service:

```typescript
describe('End-to-End Analysis', () => {
  it('should analyze document and highlight hate speech', async () => {
    // 1. Extract text from document
    const text = await extractText();
    
    // 2. Send to backend
    const analysis = await analyzeText(text);
    
    // 3. Highlight results
    await highlightHatefulWords(analysis.hatefulSegments);
    
    // 4. Verify highlighting
    const highlighted = await getHighlightedText();
    expect(highlighted.length).toBeGreaterThan(0);
  });
});
```

### Running Tests

```bash
# JavaScript/TypeScript tests
npm test
npm run test:coverage

# Python tests
cd model_service/hatebert_final
pytest
pytest --cov=. --cov-report=html
```

---

## 🔍 Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] No merge conflicts with `develop`

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
```

### Review Process

1. **Automated Checks**: CI/CD pipeline runs tests and linting
2. **Code Review**: At least one maintainer reviews the code
3. **Testing**: Reviewer tests the changes locally
4. **Approval**: Maintainer approves and merges

### Addressing Feedback

```bash
# Make requested changes
git add .
git commit -m "fix: address review feedback"
git push origin feature/your-feature-name
```

---

## 🐛 Issue Reporting

### Bug Reports

**Template:**
```markdown
**Describe the bug**
Clear description of the bug

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen

**Screenshots**
If applicable, add screenshots

**Environment:**
- OS: [e.g., Windows 11]
- Browser: [e.g., Chrome 120]
- Version: [e.g., 1.0.0]

**Additional context**
Any other relevant information
```

### Feature Requests

**Template:**
```markdown
**Is your feature request related to a problem?**
Description of the problem

**Describe the solution you'd like**
Clear description of desired functionality

**Describe alternatives you've considered**
Alternative solutions or features

**Additional context**
Any other relevant information
```

---

## 🎨 Design Guidelines

### UI/UX Principles

- **Consistency**: Use Spectrum Web Components
- **Accessibility**: WCAG 2.1 Level AA compliance
- **Responsiveness**: Support all Adobe Express panel sizes
- **Performance**: Keep UI responsive (<100ms interactions)

### Color Palette

```css
/* Primary Colors */
--primary: #FF0000;      /* Adobe Red */
--secondary: #1473E6;    /* Adobe Blue */

/* Status Colors */
--success: #2D9D78;      /* Green */
--warning: #E68619;      /* Orange */
--error: #D7373F;        /* Red */

/* Neutral Colors */
--gray-900: #2C2C2C;
--gray-700: #6E6E6E;
--gray-500: #B3B3B3;
--gray-300: #E1E1E1;
--gray-100: #F5F5F5;
```

---

## 📚 Documentation

### Code Documentation

- Add JSDoc/docstrings for all public functions
- Include parameter types and return types
- Provide usage examples for complex functions

### README Updates

- Update README.md for new features
- Add screenshots for UI changes
- Update installation instructions if dependencies change

### API Documentation

- Document all new endpoints in `docs/API_REFERENCE.md`
- Include request/response examples
- Document error codes and messages

---

## 🏆 Recognition

Contributors will be recognized in:
- README.md Contributors section
- Release notes
- Project website (when available)

---

## 📞 Getting Help

- **Discord**: [Join our server](#) (coming soon)
- **GitHub Discussions**: [Ask questions](https://github.com/sudhitpopli/Pixel-Proof/discussions)
- **Email**: dev@pixelproof.dev

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Pixel-Proof! 🎉
