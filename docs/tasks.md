# ✅ NiskaChat Task Tracker

This file provides a developer-friendly checklist for each implementation phase.  
Follow test-driven development: write tests first, then implement, then validate.

---

## Phase 1: Project Setup

- [x] Scaffold Angular frontend using Extreme Angular template
- [x] Scaffold Express backend with health check
- [x] Set up Jest for backend
- [x] Set up Jasmine + Karma for frontend
- [x] Add Prettier and ESLint
- [x] Configure Git hooks (optional)

**Tests**

- [x] `GET /health` returns 200
- [x] Angular renders root component

---

## Phase 2: OAuth2 SMART Login (Backend)

- [x] Implement `/auth/launch` endpoint with correct OAuth2 parameters
- [x] Implement `/auth/callback` to exchange code for token
- [x] Store token securely (session or in-memory)
- [x] Handle error scenarios on invalid/missing code

**Tests**

- [x] Redirect includes `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge`
- [x] Callback with valid code stores token
- [x] Invalid code returns HTTP 400

---

## Phase 3: SMART Context Handling (Frontend)

- [ ] Use `fhirclient.js` to initialize from launch URL
- [ ] Retrieve `Patient` resource using token
- [ ] Store token in memory (not local storage)
- [ ] Create `FhirClientService` for reusable logic

**Tests**

- [ ] `FHIR.oauth2.ready()` resolves
- [ ] Patient is parsed correctly
- [ ] Invalid SMART launch fails gracefully

---

## Phase 4: Patient Summary Component

- [ ] Create component for demographics (name, DOB, age, gender, MRN)
- [ ] Integrate with `FhirClientService`

**Tests**

- [ ] Displays all available fields
- [ ] Handles missing fields gracefully

---

## Phase 5: Conditions List

- [ ] Fetch `Condition` resources with `clinicalStatus=active`
- [ ] Display: name, onset, recorded date
- [ ] Sort most recent first

**Tests**

- [ ] Filters for active conditions only
- [ ] Correct sorting applied

---

## Phase 6: Observations Chart

- [ ] Fetch `Observation` resources by LOINC codes (e.g., BP, A1c)
- [ ] Use Chart.js to plot time-series data
- [ ] Handle missing/abnormal values

**Tests**

- [ ] Valid data renders correctly
- [ ] Missing values handled without crash

---

## Phase 7: Medications List

- [ ] Fetch `MedicationRequest` resources
- [ ] Display: name, status, date written, dosage

**Tests**

- [ ] Filters for active medications
- [ ] Displays dosage if available

---

## Phase 8: Static FHIR Bundle Upload

- [ ] Create upload UI for `.json` FHIR Bundles
- [ ] Parse and route data into components
- [ ] Show user error for invalid files

**Tests**

- [ ] Valid bundle renders content
- [ ] Invalid bundle triggers error

---

## Phase 9: Optional Backend FHIR Proxy

- [ ] Create `/proxy/fhir/:path` route
- [ ] Forward token securely in backend
- [ ] Handle CORS and token expiry

**Tests**

- [ ] Proxies requests like `/Patient`, `/Observation`
- [ ] Handles 401/expired token cases

---

## Phase 10: LLM Summary Integration (Optional)

- [ ] Add "Summarize" button with sparkle icon
- [ ] Send structured summary to LLM (Claude/local)
- [ ] Display response in UI
- [ ] Log requests/responses
- [ ] Store prompt in a separate file
- [ ] Design plugin interface to swap LLM providers

**Tests**

- [ ] Summary returned successfully
- [ ] Timeout/error handled gracefully
- [ ] Summary updates on data change

---

## Phase 11: Deployment & Integration

- [ ] Deploy backend (Render/Heroku/Cloud Run)
- [ ] Deploy frontend (GitHub Pages/Netlify)
- [ ] End-to-end SMART flow validation (Sandbox → login → data load)

**Tests**

- [ ] Full login → load flow verified in staging
- [ ] No secrets/config leaks in prod build

---

## Phase 12: Chat UI (Analyze)

- [ ] Replace summarize with "Analyze" → opens chat interface
- [ ] Prompt tailored for provider-facing, clinical tone

---

## Phase 13: Chat with Pre-Set Topics

- [ ] Add summary at top of chat
- [ ] Highlight 3 key clinical items
- [ ] Clicking item starts chat with that topic

---

## 🧹 Maintenance & Quality

- [ ] Run all tests before each PR
- [ ] Follow code style with Prettier
- [ ] Maintain test coverage >90%
- [ ] Update PRD if scope changes

---
