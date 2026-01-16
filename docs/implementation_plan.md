# ComplianceGuard Pro - Fresh Implementation Plan

## Goal
Create a **simple, working** Adobe Express add-on that scans text in designs for basic compliance issues.

## Strategy: Start Simple, Build Up
Instead of trying to build everything at once, we'll create a minimal working version first, then add features incrementally.

---

## Phase 1: Minimal Working Add-on (Priority: CRITICAL)

### Objective
Get a basic add-on running that can extract and display text from Adobe Express documents.

### Files to Create
1. **src/ui/components/App.tsx** - Simple UI with one button
2. **src/sandbox/code.ts** - Basic text extraction using Adobe Express SDK
3. **src/ui/index.tsx** - Entry point (minimal changes)

### Features
- ✅ Button: "Extract Text"
- ✅ Display extracted text in a list
- ✅ No detection logic yet - just prove we can read the document

### Success Criteria
- Add-on loads in Adobe Express
- Clicking button shows text from the document
- No build errors

---

## Phase 2: Basic Text Detection (Priority: HIGH)

### Objective
Add simple trademark detection for 3-5 famous slogans.

### Implementation
- Inline detection logic in App.tsx (no separate services)
- Check extracted text against hardcoded slogan list
- Display results with severity badges

### Slogans to Detect
1. "Just Do It" (Nike)
2. "Think Different" (Apple)
3. "I'm Lovin' It" (McDonald's)

### Success Criteria
- Detects slogans in document text
- Shows results with "Critical" severity
- Suggests alternatives

---

## Phase 3: Cultural Sensitivity (Priority: MEDIUM)

### Objective
Add detection for culturally sensitive numbers.

### Implementation
- Check for numbers: 4, 13, 666
- Show which countries are affected
- Suggest alternatives

### Success Criteria
- Detects number "4" and warns about China/Japan
- Detects "13" and warns about Western cultures
- Shows country-specific explanations

---

## Phase 4: Results Dashboard (Priority: MEDIUM)

### Objective
Create a proper results view with severity summary.

### Features
- Summary cards (Critical, High, Medium, Low counts)
- Detailed violation list
- Fix suggestions for each issue

---

## Phase 5: Additional Features (Priority: LOW)

Only implement if Phases 1-4 are working perfectly:
- Gender-exclusive language detection
- Violent language detection
- Color sensitivity
- PDF export
- API integrations

---

## Technical Approach

### What We'll Do Differently
1. **No TypeScript in services** - Keep everything in .tsx files
2. **No complex imports** - All logic inline in components
3. **Test after each phase** - Don't move forward until current phase works
4. **Use @ts-ignore liberally** - Focus on functionality over type safety
5. **Console logging everywhere** - Debug issues immediately

### File Structure (Simplified)
```
src/
├── ui/
│   ├── components/
│   │   ├── App.tsx (ALL logic here)
│   │   └── App.css (styling)
│   └── index.tsx (minimal entry point)
└── sandbox/
    └── code.ts (text extraction only)
```

### No Separate Services
All detection logic will be inline functions in App.tsx:
- `detectSlogans(text)`
- `detectCulturalIssues(text)`
- `detectLanguageIssues(text)`

---

## Implementation Order

### Step 1: Clean Slate
- ✅ Delete all existing service files
- ✅ Delete complex components
- ✅ Keep only App.css

### Step 2: Phase 1 Implementation
- Create minimal App.tsx with "Extract Text" button
- Create simple sandbox code.ts
- Test extraction works

### Step 3: Phase 2 Implementation
- Add slogan detection inline
- Show results
- Test with real slogans

### Step 4: Iterate
- Only add Phase 3+ if Phase 2 works perfectly

---

## Key Principles

> [!IMPORTANT]
> **WORKING CODE > PERFECT CODE**
> 
> We will prioritize:
> 1. Getting it to run
> 2. Getting it to work
> 3. Making it pretty
> 4. Making it perfect

> [!WARNING]
> **DO NOT:**
> - Create separate service files until basic version works
> - Add TypeScript types that cause build errors
> - Implement multiple features at once
> - Move forward if current phase has errors

---

## Success Metrics

### Phase 1 Success
- [ ] Add-on loads without errors
- [ ] Can click "Extract Text" button
- [ ] See text from document displayed

### Phase 2 Success  
- [ ] Detects "Just Do It" in document
- [ ] Shows "Critical" severity
- [ ] Suggests removal/rephrasing

### Phase 3 Success
- [ ] Detects number "4"
- [ ] Shows affected countries
- [ ] Suggests alternatives

---

## Next Steps

1. Review this plan
2. Get approval
3. Implement Phase 1 only
4. Test thoroughly
5. Only then move to Phase 2
