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
| **Phase 13** | ⏳ PENDING   | Code Quality & Technical Debt Resolution    | 0/12 ⏳  | -         |
| **Phase 14** | ⏳ PENDING   | Material Design System Implementation       | 0/12 ⏳  | -         |
| **Phase 15** | ⏳ PENDING   | Chat UI with Pre-Set Topics                 | 0/0 ⏳   | -         |
| **Phase 16** | ⏳ PENDING   | Enhanced Security & Compliance              | 0/0 ⏳   | -         |
| **Phase 17** | ⏳ PENDING   | Performance & Optimization                  | 0/0 ⏳   | -         |
| **Phase 18** | ⏳ PENDING   | Advanced Features                           | 0/0 ⏳   | -         |

**Overall Test Status**: 138 frontend + 40 backend = **178 tests passing** 🎯

## 📋 **Priority Rationale**

**Phase 13 (Code Quality)** was moved from Phase 18 to immediate priority because:

- **Technical Debt Impact**: 20+ TypeScript `any` types and ESLint violations slow development
- **Foundation for Future Work**: Material Design (Phase 14) requires clean, type-safe code
- **Risk Mitigation**: Floating promises and unsafe operations introduce production bugs
- **Developer Experience**: Proper types and error handling improve maintainability

The sequence **Code Quality → Material Design → Chat Topics** creates a solid foundation for advanced features.

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

## ✅ Phase 10: LLM Provider System Implementation

**Goal**: Implement a robust, single-provider LLM system using Claude Haiku

**Tasks**

- [x] Create `/llm` API endpoint accepting FHIR Bundle input
- [x] Implement clinical data extraction from FHIR Bundle
- [x] Add enhanced fallback summary with clinical formatting
- [x] Implement Claude Haiku provider with secure API key management
- [x] Create pluggable provider system with base provider interface
- [x] Add environment variable controls for LLM enable/disable
- [x] Implement provider factory for centralized management
- [x] Add comprehensive provider testing and status monitoring

**Tests**

- [x] API validates FHIR Bundle input correctly
- [x] Enhanced fallback summary includes patient demographics with age calculation
- [x] Conditions displayed with codes, onset dates, and verification status
- [x] Observations include clinical interpretation (BP ranges, etc.)
- [x] Medications show dosage, frequency, and prescriber information
- [x] Handles missing/invalid data gracefully
- [x] LLM timeout and error handling works correctly
- [x] Claude Haiku provider authentication and response generation works
- [x] Provider factory correctly manages single provider
- [x] Status monitoring provides accurate provider health information

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
- [x] **NEW**: Implement Claude Haiku as primary LLM provider
- [x] **NEW**: Add secure API key management with environment variables
- [x] **NEW**: Create pluggable provider system with single provider support
- [x] **NEW**: Add comprehensive provider testing and status monitoring
- [x] **NEW**: Remove local Llama provider and related dependencies

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

## Phase 13: Code Quality & Technical Debt Resolution

**Goal**: Systematically improve code quality, type safety, and maintainability across the application

### 1. ESLint Configuration & Rule Enforcement (High Priority)

- [x] Audit current ESLint configuration and identify rules set to "warn"
- [x] Configure comprehensive ESLint rules with TypeScript strict checking
- [ ] Fix all existing violations for `@typescript-eslint/no-unsafe-assignment`
- [ ] Fix all existing violations for `@typescript-eslint/no-unsafe-member-access`
- [ ] Fix all existing violations for `@typescript-eslint/no-unsafe-call`
- [ ] Fix all existing violations for `@typescript-eslint/no-unsafe-return`
- [ ] Fix all existing violations for `@typescript-eslint/no-explicit-any`
- [ ] Fix all existing violations for `@typescript-eslint/no-floating-promises`
- [ ] Upgrade rules from "warn" to "error" systematically after fixes
- [ ] Update ESLint configuration to enforce stricter TypeScript rules

### 2. TypeScript Type Safety Improvements (High Priority)

- [ ] Replace `any` types in FHIR service with proper FHIR resource interfaces (20+ instances in FhirClientService)
- [ ] Remove unsafe type assertions (`as any`) in mapping functions (8+ instances in FileUploadComponent)
- [ ] Add proper type guards for FHIR resource validation
- [ ] Strengthen component interfaces with required vs optional properties
- [ ] Add generic type parameters where appropriate
- [ ] Implement proper typing for Observable streams
- [ ] Add return type annotations for all public methods
- [ ] Create union types for FHIR resource variants

### 3. Error Handling & Async Operations (High Priority)

- [ ] Add proper error handling to all async operations in components (replace 'any' in catch blocks with proper error interfaces)
- [ ] Fix floating promises by adding `.catch()` or `await` keywords
- [ ] Implement proper error boundaries and user feedback mechanisms
- [ ] Add timeout handling for HTTP requests
- [x] Create centralized error handling service (logger.ts service implemented)
- [ ] Add retry logic for failed API calls
- [ ] Implement proper loading states with error recovery
- [ ] Add user-friendly error messages for common failure scenarios

**Tests**

- [ ] All ESLint rules pass without warnings or errors
- [ ] No `any` types remain in production code
- [ ] All async operations have proper error handling
- [ ] All floating promises are properly handled
- [ ] Type guards properly validate FHIR resources
- [ ] Error boundaries catch and handle component failures

---

## Phase 14: WCAG Compliance Enforcement

**Goal**: Ensure the NiskaChat app meets WCAG 2.1 AA accessibility standards through automated checks and a full UI audit. Prevent regressions with pre-commit enforcement.

---

### 1. Accessibility Audit of UI Components

- [x] Review all UI components for WCAG 2.1 AA compliance
- [x] Verify color contrast meets minimum 4.5:1 (normal text) or 3:1 (large text)
- [x] Ensure keyboard navigation is functional for all interactive elements
- [x] Verify proper use of ARIA roles and labels
- [x] Test core flows with screen reader (VoiceOver or NVDA)
- [x] Add skip navigation link if missing
- [x] Ensure all buttons, icons, and inputs have accessible names (via `aria-label`, `alt`, or `label` tags)

---

### 2. Add Automated WCAG Checks

- [x] Install and configure `pa11y` for automated accessibility tests
  ```bash
  npm install --save-dev pa11y
  ```

---

## Phase 15: Material Design System Implementation

**Goal**: Apply Angular Material and a consistent design system across the app to improve UI consistency, accessibility, responsiveness, and maintainability.

### Foundation & Setup

- [ ] Install Angular Material using `ng add @angular/material`
- [ ] Create `src/themes/theme.scss` with Angular Material custom theme
- [ ] Define design tokens in SCSS:
  - [ ] Color palette (primary, secondary, background, surface, error, etc.)
  - [ ] Typography (font family, weights, sizes for headings, body, captions)
  - [ ] Spacing (margin, padding scales)
  - [ ] Elevation (z-index and box-shadow layers)
- [ ] Configure Angular Material theme in main styles
- [ ] Add dark theme support structure (optional)
- [ ] Apply global typography rules consistently across the app

### Component Refactoring

- [ ] Refactor buttons to use Angular Material:
  - [ ] `<button mat-button>` for text buttons
  - [ ] `<button mat-raised-button>` for primary actions
  - [ ] `<button mat-fab>` for floating action buttons
- [ ] Refactor cards to use `<mat-card>` with proper structure
- [ ] Refactor forms to use Angular Material form controls:
  - [ ] `<mat-form-field>` for input containers
  - [ ] `<mat-input>` for text inputs
  - [ ] `<mat-select>` for dropdowns
  - [ ] `<mat-checkbox>` for checkboxes
- [ ] Refactor navigation elements:
  - [ ] `<mat-toolbar>` for app header
  - [ ] `<mat-sidenav>` for navigation drawer (if needed)
  - [ ] `<mat-menu>` for context menus
- [ ] Replace custom CSS with Angular Material utility classes
- [ ] Update existing components to use Material classes:
  - [ ] Chat component styling
  - [ ] Patient summary component
  - [ ] Conditions list component
  - [ ] Observations chart component
  - [ ] Medications list component
  - [ ] File upload component

**Tests**

- [ ] All components use Angular Material primitives and design tokens
- [ ] Buttons show correct visual states (hover, focus, disabled)
- [ ] Cards use proper Material Design structure and spacing
- [ ] Forms use Material form controls with proper validation
- [ ] App renders correctly on mobile devices (responsive design)
- [ ] Typography and spacing are consistent across all views
- [ ] Color contrast passes WCAG AA compliance testing
- [ ] Keyboard navigation works for all primary user flows
- [ ] Material animations and transitions work smoothly
- [ ] Shared components follow design system guidelines
- [ ] Theme system allows for customization and dark mode support
- [ ] Screen reader accessibility tested and functional

---

## Phase 16: Chat with Pre-Set Topics

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

## Phase 17: Enhanced Security & Compliance

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

## Phase 18: Performance & Optimization

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

## Phase 19: Advanced Features

- [ ] Support for `DiagnosticReport` resources
- [ ] Support for `AllergyIntolerance` resources
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

## Phase x: Deployment & Integration

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

## 🧹 Maintenance & Quality

- [ ] Run all tests before each PR
- [ ] Follow code style with Prettier
- [ ] Maintain test coverage >90%
- [ ] Update PRD if scope changes
- [ ] Regular dependency updates
- [ ] Security vulnerability scanning
- [ ] Performance monitoring
- [ ] Documentation updates
