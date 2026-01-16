# ComplianceGuard Pro - Task Breakdown

## Phase 1: Minimal Working Add-on ⚡ CURRENT FOCUS

### Setup & Cleanup
- [x] Delete existing service files
- [x] Delete complex components  
- [x] Create fresh implementation plan
- [ ] Review and approve plan

### Core Files
- [ ] Create simple `src/ui/components/App.tsx`
  - One button: "Extract Text"
  - Display area for results
  - No detection logic yet
- [ ] Create basic `src/sandbox/code.ts`
  - Extract text from document using Adobe Express SDK
  - Return array of text strings
  - Console logging for debugging
- [ ] Update `src/ui/index.tsx` (minimal changes)
  - Connect to sandbox
  - Render App component

### Testing Phase 1
- [ ] Build without errors
- [ ] Load add-on in Adobe Express
- [ ] Click "Extract Text" button
- [ ] Verify text appears from document
- [ ] Check console logs

---

## Phase 2: Basic Slogan Detection (NEXT)

### Implementation
- [ ] Add slogan detection function in App.tsx
  - Hardcoded list: Nike, Apple, McDonald's
  - Case-insensitive matching
- [ ] Display results with severity
- [ ] Add fix suggestions

### Testing Phase 2
- [ ] Create document with "Just Do It"
- [ ] Run scan
- [ ] Verify detection works
- [ ] Check severity shows as "Critical"

---

## Phase 3: Cultural Sensitivity (FUTURE)

### Implementation
- [ ] Add number detection (4, 13, 666)
- [ ] Show affected countries
- [ ] Suggest alternatives

### Testing Phase 3
- [ ] Test with number "4"
- [ ] Verify country warnings
- [ ] Check alternatives display

---

## Phase 4: Results Dashboard (FUTURE)

### Implementation
- [ ] Create summary cards
- [ ] Add detailed violation list
- [ ] Style with severity colors

---

## Phase 5: Additional Features (OPTIONAL)

- [ ] Gender-exclusive language
- [ ] Violent language  
- [ ] Color sensitivity
- [ ] PDF export

---

## Notes

**Current Status**: Starting Phase 1

**Blockers**: None - fresh start

**Next Action**: Create minimal App.tsx
