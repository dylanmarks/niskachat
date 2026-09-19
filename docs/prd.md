# NiskaChat: Product Requirements Document (PRD)

## 🧭 Project Overview

**NiskaChat** is a FHIR bundle viewer and SMART on FHIR reference application for learning and prototyping interoperability workflows. It is not a clinical product or a compliance certification.

The application will consist of:

- **Frontend**: Angular 20+
- **Backend**: Node.js/Express
- **Auth**: SMART on FHIR OAuth2 with PKCE
- **Hosting**: GitHub Pages/Netlify (frontend), Render/Heroku/Cloud Run (backend)
- **Data Sources**: SMART Sandbox (initial), Google Cloud Healthcare API (future), and static FHIR Bundle upload (for test mode)

**Goals**:

- Modular, standards-informed, test-driven reference application
- Portable and extensible architecture
- Support optional LLM-based summarization and chat

---

## 👥 Target Users

- Clinicians reviewing longitudinal patient health data
- Care coordinators managing multi-provider plans
- Patients wanting full access to their data
- Future agentic systems assisting with health decision-making

---

## 🔑 Core Features

- SMART on FHIR OAuth2 login (via Sandbox or real EHR)
- Patient summary with demographics and identifiers
- Structured views of Conditions, Medications, Observations
- Charting labs/vitals over time (e.g., BP, A1c)
- Optional AI summary/chat on clinical data
- Local static FHIR Bundle upload for test mode
- Secure backend token exchange + optional proxy

---

## 🎯 Success Criteria

| Metric                      | Target                    |
| --------------------------- | ------------------------- |
| Time to patient view        | < 10 seconds              |
| Resource parsing accuracy   | 100% by `resourceType`    |
| Compatibility               | SMART R4, GCP Healthcare  |
| Security                    | No client secrets exposed |
| LLM summary cost (optional) | <$0.10 per summary        |

---

## 🏗️ Technical Architecture

| Layer       | Stack                                      |
| ----------- | ------------------------------------------ |
| Frontend    | Angular 20+, Chart.js, fhirclient.js       |
| Backend     | Node.js, Express, Jest, Supertest          |
| Auth        | SMART on FHIR OAuth2 + PKCE                |
| Hosting     | GitHub Pages, Netlify, Render, Heroku      |
| FHIR Source | SMART Sandbox, static upload, Google Cloud |
| AI Option   | Claude via Bedrock, or local LLM           |

---

## 🧪 Development Phases (Test-Driven)

Each phase includes a **goal**, **deliverables**, and **test cases**.  
Branch naming format: `feature/<phase-name>` (e.g. `feature/patient-summary`)

---

### ✅ Phase 1: Project Setup

**Goal**: Initialize the NiskaChat development environment, CI, and test setup.

**Deliverables**:

- Scaffold Angular + Express app
- Configure Jest, Jasmine/Karma
- Set up Prettier, ESLint, Git hooks

**Test Cases**:

- [ ] `GET /health` returns 200
- [ ] Angular renders root component

---

### ✅ Phase 2: OAuth2 SMART App Launch Flow (Backend)

**Goal**: Implement secure backend for SMART login.

**Deliverables**:

- `/auth/launch` initiates login
- `/auth/callback` exchanges code for token
- Secure token/session storage

**Test Cases**:

- [ ] Redirect URL contains correct OAuth2 parameters
- [ ] Token is stored securely
- [ ] Invalid code returns 400

---

### ✅ Phase 3: SMART Client Context Handling (Frontend)

**Goal**: Use `fhirclient.js` to retrieve launch context and token.

**Deliverables**:

- Load `Patient` resource
- Store token in memory
- Create reusable `FhirClientService`

**Test Cases**:

- [ ] `FHIR.oauth2.ready()` resolves
- [ ] Patient resource is fetched and parsed
- [ ] Invalid launch handled gracefully

---

### ✅ Phase 4: Patient Summary Component

**Goal**: Display demographics: name, DOB, age, gender, MRN (optional)

**Test Cases**:

- [ ] Component renders valid patient
- [ ] Handles missing fields gracefully

---

### ✅ Phase 5: Conditions List Component

**Goal**: List active conditions using FHIR `Condition`

**Deliverables**:

- Filter by `clinicalStatus=active`
- Display name, onset date, date recorded

**Test Cases**:

- [ ] Filters only active conditions
- [ ] Sorted most recent first

---

### ✅ Phase 6: Observations Chart Component

**Goal**: Visualize labs/vitals using `Observation`

**Deliverables**:

- Plot time-series data using Chart.js
- Filter by LOINC code (BP, A1c, LDL)

**Test Cases**:

- [ ] Valid Observation data renders chart
- [ ] Handles missing/abnormal values

---

### ✅ Phase 7: Medication List Component

**Goal**: Show current medications using `MedicationRequest`

**Deliverables**:

- Show name, status, date written, dosage

**Test Cases**:

- [ ] Filters for active medications
- [ ] Displays name and dosage

---

### ✅ Phase 8: Local Bundle Upload (Test Mode)

**Goal**: Enable test mode with static FHIR Bundles

**Deliverables**:

- File upload and parsing into components

**Test Cases**:

- [ ] Valid bundle is parsed correctly
- [ ] Invalid bundle shows user error

---

### ✅ Phase 9: Optional Backend FHIR Proxy

**Goal**: Proxy FHIR API calls through backend securely

**Deliverables**:

- `GET /proxy/fhir/:path`
- Protect token, handle CORS

**Test Cases**:

- [ ] Proxies `Patient` and `Observation`
- [ ] Handles token refresh and expiry

---

### ✅ Phase 10: LLM Summary Integration

**Goal**: Summarize clinical data using Claude or local LLM

**Deliverables**:

- "Summarize" button with sparkle icon at the top of the page
- Component sends structured summary to LLM with the full bundle payload
- Plugin system for pluggable LLM providers
- Store secret credentials for API properly
- Prompt stored in external file to allow refinement and evaluation
- Logging of interactions

**Test Cases**:

- [ ] LLM returns usable summary
- [ ] Handles timeout/error gracefully
- [ ] Re-generates summary on data change

---

### ✅ Phase 11: Deployment & Integration Testing

**Goal**: Deploy to staging and validate SMART login + data rendering

**Deliverables**:

- Deploy frontend/backend
- Validate SMART Sandbox flow

**Test Cases**:

- [ ] Launchpad → Login → Data Load flow works
- [ ] No secrets or config leaks in production

---

### ✅ Phase 12: Chat UI (Provider-Facing)

**Goal**: Evolve from summarization to interactive clinical Q&A

**Deliverables**:

- "Analyze" button → Chat interface
- Focused medical prompt for providers

---

### ✅ Phase 13: Chat UI with Pre-Set Topics

**Goal**: Augment chat with suggested clinical highlights

**Deliverables**:

- Show summary + 3 highlighted items
- Items are clickable to start chat

---

## 🧰 Workflow: Test-Driven Development

1. Create feature branch (e.g. `feature/observations-chart`)
2. Define test cases first
3. Implement with AI/code tools after tests are ready
4. Validate all tests pass before PR
5. Merge and optionally tag a release

**Test Frameworks**:

- **Frontend**: Jasmine + Karma
- **Backend**: Jest + Supertest

---

## 🔮 Future Enhancements (Post-MVP)

- Support `DiagnosticReport`, `DocumentReference`
- Dark mode and WCAG accessibility compliance
- Offline mode via IndexedDB/localStorage
- More flexible chart filtering (date ranges, code selectors)
- Integration with Google Cloud FHIR Store

---
