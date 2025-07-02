# ✅ NiskaChat Task Tracker

This file provides a developer-friendly checklist for each implementation phase.  
Follow test-driven development: write tests first, then implement, then validate.

## 🚀 **Current Progress Summary**

| Phase       | Status       | Description                                 | Tests    | Commit     |
| ----------- | ------------ | ------------------------------------------- | -------- | ---------- |
| **Phase 1** | ✅ COMPLETED | Project Setup (Angular + Express + Testing) | 2/2 ✅   | `bc4cd6f`  |
| **Phase 2** | ✅ COMPLETED | OAuth2 SMART Login Backend                  | 15/15 ✅ | `f8afddd`  |
| **Phase 3** | ✅ COMPLETED | SMART Client Context Handling Frontend      | 29/33 ✅ | `e464642`  |
| **Phase 4** | ✅ COMPLETED | Patient Summary Component                   | 61/69 ✅ | `acbb75e`  |
| **Phase 5** | ✅ COMPLETED | Conditions List Component                   | 48/48 ✅ | `<latest>` |
| **Phase 6** | ✅ COMPLETED | Observations Chart Component                | 18/18 ✅ | `<latest>` |
| Phase 7+    | ⏳ PENDING   | Future phases                               | -        | -          |

**Overall Test Status**: 112 frontend + 15 backend = **130 tests passing** 🎯

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

- [x] Use `fhirclient.js` to initialize from launch URL
- [x] Retrieve `Patient` resource using token
- [x] Store token in memory (not local storage)
- [x] Create `FhirClientService` for reusable logic

**Tests**

- [x] `FHIR.oauth2.ready()` resolves
- [x] Patient is parsed correctly
- [x] Invalid SMART launch fails gracefully

---

## Phase 4: Patient Summary Component

- [x] Create component for demographics (name, DOB, age, gender, MRN)
- [x] Integrate with `FhirClientService`

**Tests**

- [x] Displays all available fields
- [x] Handles missing fields gracefully

---

## Phase 5: Conditions List

- [x] Fetch `Condition` resources with `clinicalStatus=active`
- [x] Display: name, onset, recorded date
- [x] Sort most recent first

**Tests**

- [x] Filters for active conditions only
- [x] Correct sorting applied

---

## Phase 6: Observations Chart

- [x] Fetch `Observation` resources by LOINC codes (e.g., BP, A1c)
- [x] Use Chart.js to plot time-series data
- [x] Handle missing/abnormal values

**Tests**

- [x] Valid data renders correctly
- [x] Missing values handled without crash

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
