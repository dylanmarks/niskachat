# ✅ NiskaChat Task Tracker

This file provides a developer-friendly checklist for each implementation phase.  
Follow test-driven development: write tests first, then implement, then validate.

## 🚀 **Current Progress Summary**

| Phase        | Status       | Description                                 | Tests    | Commit    |
| ------------ | ------------ | ------------------------------------------- | -------- | --------- |
| **Phase 1**  | ✅ COMPLETED | Project Setup (Angular + Express + Testing) | 2/2 ✅   | `bc4cd6f` |
| **Phase 2**  | ✅ COMPLETED | OAuth2 SMART Login Backend                  | 15/15 ✅ | `f8afddd` |
| **Phase 3**  | ✅ COMPLETED | SMART Client Context Handling Frontend      | 29/33 ✅ | `e464642` |
| **Phase 4**  | ✅ COMPLETED | Patient Summary Component                   | 61/69 ✅ | `acbb75e` |
| **Phase 5**  | ✅ COMPLETED | Conditions List Component                   | 48/48 ✅ | `3652eba` |
| **Phase 6**  | ✅ COMPLETED | Observations Chart Component                | 18/18 ✅ | `8542225` |
| **Phase 7**  | ✅ COMPLETED | Medications List Component                  | 8/8 ✅   | `b8d7e9a` |
| **Phase 8**  | ✅ COMPLETED | Static FHIR Bundle Upload                   | 8/8 ✅   | `de2cd1f` |
| **Phase 9**  | ✅ COMPLETED | Optional Backend FHIR Proxy                 | 17/17 ✅ | `current` |
| **Phase 10** | ✅ COMPLETED | LLM Summary Integration (MacBook Air Safe)  | 8/8 ✅   | `current` |
| **Phase 11** | ⏳ PENDING   | Deployment & Integration Testing            | 0/0 ⏳   | -         |
| **Phase 12** | ✅ COMPLETED | Custom Chat UI (Provider-Facing)            | 10/10 ✅ | `current` |
| **Phase 13** | ⏳ PENDING   | Chat UI with Pre-Set Topics                 | 0/0 ⏳   | -         |
| **Phase 14** | ⏳ PENDING   | Enhanced Security & Compliance              | 0/0 ⏳   | -         |
| **Phase 15** | ⏳ PENDING   | Performance & Optimization                  | 0/0 ⏳   | -         |
| **Phase 16** | ⏳ PENDING   | Advanced Features                           | 0/0 ⏳   | -         |
| **Phase 17** | ⏳ PENDING   | UI & Design System Improvements             | 0/0 ⏳   | -         |

**Overall Test Status**: 138 frontend + 40 backend = **178 tests passing** 🎯

---

## Phase 1: Project Setup

- [x] Scaffold Angular frontend using Extreme Angular template
- [x] Set up Angular 16+ with modern tooling
- [x] Scaffold Express backend with health check
- [x] Set up Jest for backend testing
- [x] Set up Jasmine + Karma for frontend testing
- [x] Add Prettier and ESLint configuration
- [x] Configure Git hooks (pre-commit, pre-push)
- [x] Set up proper project structure and documentation

**Tests**

- [x] `GET /health` returns 200
- [x] Angular renders root component

---

## Phase 2: OAuth2 SMART Login (Backend)

- [x] Implement `/auth/launch` endpoint with correct OAuth2 parameters
- [x] Include `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge` in redirect
- [x] Implement `/auth/callback` to exchange code for token
- [x] Store token securely (session or in-memory)
- [x] Handle error scenarios on invalid/missing code
- [x] Implement proper PKCE flow for security
- [x] Add comprehensive error handling

**Tests**

- [x] Redirect includes `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge`
- [x] Callback with valid code stores token
- [x] Invalid code returns HTTP 400
- [x] PKCE verification works correctly
- [x] Error scenarios handled gracefully

---

## Phase 3: SMART Context Handling (Frontend)

- [x] Use `fhirclient.js` to initialize from launch URL
- [x] Retrieve `Patient` resource using token
- [x] Store token in memory (not local storage)
- [x] Create `FhirClientService` for reusable logic
- [x] Handle launch context and parameters
- [x] Implement proper error handling for invalid launches
- [x] Add authentication status tracking

**Tests**

- [x] `FHIR.oauth2.ready()` resolves
- [x] Patient is parsed correctly
- [x] Invalid SMART launch fails gracefully
- [x] Authentication status is tracked properly
- [x] Token storage works correctly

---

## Phase 4: Patient Summary Component

- [x] Create component for demographics (name, DOB, age, gender, MRN)
- [x] Integrate with `FhirClientService`
- [x] Handle missing patient data gracefully
- [x] Display contact information (phone, email)
- [x] Display addresses
- [x] Show identifiers (MRN, SSN, etc.)
- [x] Calculate age from birth date
- [x] Implement responsive design

**Tests**

- [x] Displays all available fields
- [x] Handles missing fields gracefully
- [x] Age calculation works correctly
- [x] Contact information displays properly
- [x] Addresses are formatted correctly

---

## Phase 5: Conditions List

- [x] Fetch `Condition` resources with `clinicalStatus=active`
- [x] Display: name, onset, recorded date
- [x] Sort most recent first
- [x] Handle different onset formats (DateTime, Period, Age)
- [x] Show clinical status badges
- [x] Show verification status
- [x] Display condition codes and systems
- [x] Handle missing/incomplete data

**Tests**

- [x] Filters for active conditions only
- [x] Correct sorting applied
- [x] Different onset formats handled
- [x] Status badges display correctly
- [x] Missing data handled gracefully

---

## Phase 6: Observations Chart

- [x] Fetch `Observation` resources by LOINC codes (e.g., BP, A1c)
- [x] Use Chart.js to plot time-series data
- [x] Handle missing/abnormal values
- [x] Implement category filtering (BP, A1c, Glucose, Weight, Height)
- [x] Support different value types (Quantity, String, CodeableConcept)
- [x] Color-coded datasets
- [x] Responsive chart design
- [x] Date-based time axis

**Tests**

- [x] Valid data renders correctly
- [x] Missing values handled without crash
- [x] Category filtering works
- [x] Different value types supported
- [x] Chart responds to data changes

---

## Phase 7: Medications List

- [x] Fetch `MedicationRequest` resources
- [x] Display: name, status, date written, dosage
- [x] Filter for active medications
- [x] Handle different medication representations
- [x] Show prescriber information
- [x] Display frequency and duration
- [x] Show medication codes (RxNorm, NDC)
- [x] Handle missing dosage information

**Tests**

- [x] Filters for active medications
- [x] Displays dosage if available
- [x] Different medication formats handled
- [x] Prescriber information shown
- [x] Missing data handled gracefully
- [x] Component renders correctly
- [x] Status display and classes work
- [x] Date formatting functions correctly

---

## Phase 8: Static FHIR Bundle Upload

- [x] Create upload UI for `.json` FHIR Bundles
- [x] Parse and validate FHIR Bundle format
- [x] Route data into existing components
- [x] Show user error for invalid files
- [x] Support drag-and-drop file upload
- [x] Validate Bundle structure and resources
- [x] Extract Patient, Condition, Observation, MedicationRequest resources
- [x] Provide upload progress feedback
- [x] Add offline mode support to FHIR client service
- [x] Integrate file upload into main app template

**Tests**

- [x] Valid bundle renders content
- [x] Invalid bundle triggers error
- [x] File format validation works
- [x] Resource extraction works correctly
- [x] Upload progress shown
- [x] Component renders correctly
- [x] Error handling works properly
- [x] Offline mode integration functions

---

## Phase 9: Optional Backend FHIR Proxy

- [x] Create `/proxy/fhir/:path` route
- [x] Forward token securely in backend
- [x] Handle CORS and token expiry
- [x] Implement request/response logging
- [x] Support different FHIR endpoints
- [x] Handle authentication refresh
- [x] Implement rate limiting
- [x] Add request validation

**Tests**

- [x] Proxies requests like `/Patient`, `/Observation`
- [x] Handles 401/expired token cases
- [x] CORS headers set correctly
- [x] Rate limiting works
- [x] Request logging functions

---

## ✅ Phase 10: Local LLM Testing via `llama.cpp`

**Goal**: Enable local summarization using a quantized open-source LLM

**Tasks**

- [x] Install `llama.cpp` via Homebrew
- [x] Create `/llm` API endpoint accepting FHIR Bundle input
- [x] Implement clinical data extraction from FHIR Bundle
- [x] Add enhanced fallback summary with clinical formatting
- [x] Configure MacBook Air safe settings (TinyLlama, low threads, small context)
- [x] Add environment variable controls for LLM enable/disable
- [x] Create `run-llm.sh` script for CLI testing
- [x] Create `start-macbook-air.sh` for safe startup

**Tests**

- [x] API validates FHIR Bundle input correctly
- [x] Enhanced fallback summary includes patient demographics with age calculation
- [x] Conditions displayed with codes, onset dates, and verification status
- [x] Observations include clinical interpretation (BP ranges, etc.)
- [x] Medications show dosage, frequency, and prescriber information
- [x] Handles missing/invalid data gracefully
- [x] LLM timeout and error handling works correctly
- [x] MacBook Air mode prevents crashes via resource limits

---

## ✅ Phase 10.1: LLM Summary UI Integration

**Goal**: Display summary generated by local (or hosted) LLM in the UI

**Tasks**

- [ ] Add "Summarize" button with sparkle icon
- [ ] Send structured summary request to LLM (local first)
- [ ] Display response in UI (basic text output)
- [ ] Store prompt in a separate file for reuse
- [ ] Add loading state and error handling
- [ ] Implement plugin interface to optionally support hosted Claude/GPT

**Tests**

- [ ] Summary displays on button click
- [ ] Error/timeout handled gracefully
- [ ] Summary updates when FHIR data changes
- [ ] Works with local LLM and pluggable backend

---

## Phase 11: Deployment & Integration

- [ ] Deploy backend (Render/Heroku/Cloud Run)
- [ ] Deploy frontend (GitHub Pages/Netlify)
- [ ] Configure environment variables
- [ ] Set up CI/CD pipeline
- [ ] End-to-end SMART flow validation (Sandbox → login → data load)
- [ ] Performance optimization
- [ ] Security audit
- [ ] HTTPS and SSL certificates

**Tests**

- [ ] Full login → load flow verified in staging
- [ ] No secrets/config leaks in prod build
- [ ] Performance meets targets
- [ ] Security scan passes
- [ ] HTTPS works correctly

---

## Phase 12: Custom Chat UI (Provider-Facing)

**Goal**: Build a completely custom, open-source chat interface integrated with existing LLM backend

**Tasks**

- [x] Create basic chat component structure (ChatComponent)
- [x] Implement message interface and types (ChatMessage)
- [x] Build chat message display with user/AI message styling
- [x] Add message input with send functionality
- [x] Integrate with existing `/llm` endpoint for AI responses
- [x] Add loading states and typing indicators
- [x] Implement auto-scroll to bottom on new messages
- [x] Add "Clear Chat" functionality
- [x] Support markdown rendering in AI responses (basic HTML support)
- [x] Add basic error handling for failed requests
- [x] Integrate chat into main app layout
- [x] Add clinical context passing to LLM (patient data)
- [x] **NEW**: Wire chat interface with pluggable LLM system
- [x] **NEW**: Create separate clinical chat prompt file for easy editing
- [x] **NEW**: Implement prompt loading and caching system
- [x] **NEW**: Add support for different context types (summary vs chat)
- [x] **NEW**: Create prompt reload utility for development iteration
- [x] **NEW**: Generate chat examples and customization documentation
- [x] **NEW**: Implement Claude Haiku as second LLM provider
- [x] **NEW**: Add secure API key management with environment variables
- [x] **NEW**: Create pluggable provider system with automatic fallback
- [x] **NEW**: Add comprehensive provider testing and status monitoring

**Tests**

- [x] Chat component renders correctly
- [x] User messages display with correct styling
- [x] AI messages display with correct styling
- [x] Send button enables/disables appropriately
- [x] Loading states show during API calls
- [x] Error messages display on API failures
- [x] Clear chat functionality works
- [x] Markdown rendering works in AI responses
- [x] Chat integrates with existing FHIR data context
- [x] Mobile-responsive layout functions properly
- [x] **NEW**: Chat uses clinical_chat context correctly
- [x] **NEW**: Prompt loading system works with variable substitution
- [x] **NEW**: Different context types (summary/chat) route properly
- [x] **NEW**: Prompt reload utility functions correctly

---

## Phase 13: Chat with Pre-Set Topics

- [ ] Add summary at top of chat
- [ ] Highlight 3 key clinical items
- [ ] Clicking item starts chat with that topic
- [ ] Implement topic detection algorithm
- [ ] Add customizable topic categories
- [ ] Support different clinical specialties
- [ ] Implement topic priority ranking
- [ ] Add topic suggestion system

**Tests**

- [ ] Clinical topics identified correctly
- [ ] Topic clicks initiate proper chat
- [ ] Summary displays key items
- [ ] Topic ranking works
- [ ] Specialty-specific topics shown

---

## Phase 14: Enhanced Security & Compliance

- [ ] Implement proper session management
- [ ] Add security headers (CSP, HSTS, etc.)
- [ ] Audit logging for all actions
- [ ] Implement data encryption at rest
- [ ] Add HIPAA compliance features
- [ ] Session timeout and renewal
- [ ] Input validation and sanitization
- [ ] XSS and CSRF protection

**Tests**

- [ ] Security headers present
- [ ] Session management works
- [ ] Audit logs captured
- [ ] Data encryption verified
- [ ] Attack vectors blocked

---

## Phase 15: Performance & Optimization

- [ ] Implement lazy loading for components
- [ ] Optimize bundle size
- [ ] Add service worker for caching
- [ ] Implement progressive web app features
- [ ] Optimize API calls and caching
- [ ] Add performance monitoring
- [ ] Implement error tracking
- [ ] Database query optimization

**Tests**

- [ ] Load times meet targets
- [ ] Bundle size optimized
- [ ] Caching works correctly
- [ ] PWA features function
- [ ] Error tracking captures issues

---

## Phase 16: Advanced Features

- [ ] Support for `DiagnosticReport` resources
- [ ] Add `DocumentReference` viewing
- [ ] Implement dark mode
- [ ] Add WCAG accessibility compliance
- [ ] Offline mode via IndexedDB
- [ ] Advanced chart filtering (date ranges, code selectors)
- [ ] Integration with Google Cloud FHIR Store
- [ ] Multi-language support

**Tests**

- [ ] Additional resource types display
- [ ] Dark mode toggles correctly
- [ ] Accessibility standards met
- [ ] Offline functionality works
- [ ] Advanced filters function

---

## Phase 17: UI & Design System Improvements

- [ ] Define design system elements (colors, fonts, spacing, buttons)
- [ ] Choose UI component system (e.g., Angular Material, Tailwind + shadcn)
- [ ] Apply global typography rules (headings, body, captions)
- [ ] Refactor existing components to align with chosen styles
- [ ] Create reusable button component
- [ ] Create reusable card/surface container
- [ ] Add consistent spacing/margins across layout
- [ ] Improve mobile responsiveness
- [ ] Add hover/focus/active styles
- [ ] Review contrast ratios for accessibility
- [ ] Add transitions for modal or expandable components
- [ ] Test keyboard navigation and tab order

**Tests**

- [ ] All components follow design system tokens
- [ ] Buttons show proper interaction states
- [ ] Components render correctly on mobile
- [ ] Typography consistent across app
- [ ] Color contrast passes WCAG AA
- [ ] Keyboard navigation works across primary flows

---

## 🧹 Maintenance & Quality

- [ ] Run all tests before each PR
- [ ] Follow code style with Prettier
- [ ] Maintain test coverage >90%
- [ ] Update PRD if scope changes
- [ ] Regular dependency updates
- [ ] Security vulnerability scanning
- [ ] Performance monitoring
- [ ] Documentation updates
