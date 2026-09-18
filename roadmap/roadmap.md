# NiskaChat Roadmap — Findings & Improvement Plan

_Based on code review of `src/app/**` and `backend/**`, Sept 2026._

## Priority 1 — Showcase features

### 1. Streaming chat responses (SSE) ⭐ _biggest wow factor_

- **What:** Chat currently blocks until the full LLM response arrives (`src/app/components/chat/chat.component.ts:171` → `POST /api/llm`), showing a spinner for 10–30s. Streaming renders tokens as they arrive.
- **How:**
  - Add `generateResponseStream(prompt, options)` to `backend/providers/baseProvider.js`; implement per provider (OpenRouter, Ollama, Claude, Gemini all stream natively).
  - Add an SSE endpoint in `backend/routes/llm.js` piping provider chunks to the client.
  - Frontend: append chunks incrementally to the loading bubble; run the markdown/sanitize pipeline once on final assembly.
  - Keep `POST /api/llm` as fallback for providers without stream support.
- **Effort:** Medium-high. **Impact:** Transforms the product demo.

### 2. Task & CarePlan persistence

- **What:** Tasks live in an in-memory Map (`backend/routes/tasks.js:6-7`) — lost on restart; frontend state is session-only (`task-management.service.ts`).
- **How:** Persist real FHIR `Task`/`CarePlan` resources through the SMART proxy (`backend/routes/proxy.js`); simpler path is file/SQLite storage keyed by patient reference + localStorage caching.
- **Effort:** Medium. **Impact:** Turns a demo into a usable clinical tool.

### 3. Longitudinal patient timeline view

- **What:** One chronological timeline merging Condition onsets, Observations, MedicationRequests, Immunizations, Procedures — a "patient story" view above the tabbed record lists.
- **How:** New `patient-timeline` component fed by `FhirClientService.buildComprehensiveFhirBundle()`; group by date, filter by resource type.
- **Effort:** Medium. **Impact:** High visual/clinical value; great screenshot material.

## Priority 2 — Reliability & correctness

### 4. Deduplicate JSON-repair logic

- The same brace-counting/array-repair JSON parsing exists in **three places**: `backend/routes/llm.js` (`parseClinicalChatResponse`), `chat.component.ts:359-478` (`sanitizeResponse`), and `chat.component.ts:717-959` (`tryParseJsonResponse`). Extract one shared parser; backend authoritative, frontend thin fallback only. Remove the leftover `console.log('CHAT DEBUG'...)` at `chat.component.ts:280`.

### 5. Backend test coverage gaps

- `backend/routes/tasks.js` has no `tasks.test.js` despite comment/versioning logic with optimistic concurrency (`If-Match`). Add Jest coverage for create/comment/get/version-conflict paths.

### 6. Chat context window risk

- `chat.component.ts:554-558` sends the last 10 raw messages (including long markdown responses) as `conversationHistory`; combined with compressed bundles this can blow context limits on small local Ollama models. Trim history server-side per provider context budget.

## Priority 3 — Polish

### 7. Chat message HTML-concatenation sanitization

- `sanitizeResponse` (`chat.component.ts:436-450`) builds HTML via regex string concatenation before DOMPurify. Works, but brittle; consider a small markdown library with a DOMPurify hook instead.

### 8. Debug/console cleanup

- Stray `console.log('CHAT DEBUG'...)` (`chat.component.ts:280`) bypasses the logger; remove and rely on `logger.debug`.

## Priority 4 — Engineering Excellence & GitHub Showcase

### 9. Rich PR Test & Coverage Summaries (GitHub Actions Step Summary)

- **What:** Pull requests automatically summarize Jest (backend) + Karma (frontend) coverage and test outcomes directly into the `$GITHUB_STEP_SUMMARY` markdown dashboard and PR status check.
- **How:** Add coverage summary extraction script in `.github/workflows/validate-code.yml` and publish formatted markdown tables.
- **Effort:** Low-Medium. **Impact:** Direct proof of modern CI/CD presentation and quality gate enforcement.

### 10. Automated Release Governance (Release Please / Conventional Changelog)

- **What:** Leverage repository's existing `@commitlint/config-conventional` setup to automate semantic version bumps, CHANGELOG generation, and GitHub Releases.
- **Effort:** Low. **Impact:** Demonstrates professional open-source release management.

### 11. Enterprise Security Scanning & Dependency Governance

- **What:** Integrate CodeQL AST security analysis (`codeql.yml`), GitHub Secret Scanning alerts, and Dependabot with grouped updates (`.github/dependabot.yml`).
- **Effort:** Low. **Impact:** Essential compliance and supply chain posture for healthcare/clinical software.

### 12. Community & Repository Health Infrastructure

- **What:** Add GitHub issue forms (`.github/ISSUE_TEMPLATE/*.yml`) for bugs, features, and clinical feedback, alongside a clinical-aware `.github/PULL_REQUEST_TEMPLATE.md`.
- **Effort:** Low. **Impact:** Standardizes contribution workflows and projects engineering maturity.
