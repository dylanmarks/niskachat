# Clinical AI data flow and safety contract

NiskaChat is a synthetic-data reference application for learning SMART on FHIR
and clinical AI integration patterns. This document describes what the current
code does and what it does not establish.

## Request and data flow

1. The browser obtains FHIR records through the browser SMART client or loads an
   example bundle. AI requests use a compressed representation of that context,
   the current question, recent chat turns, and source references in the bundle.
2. Before an AI request, the app displays the selected provider, model, and
   endpoint. Sending a chat message or requesting a summary triggers the call
   without a separate confirmation dialog. The UI does not de-identify data;
   this demo is intended for synthetic records only.
3. The backend sends the request only to `LLM_PROVIDER`. If that provider is
   unavailable or fails, the request fails; the backend does not send it to a
   second provider. The status endpoint exposes the selected endpoint origin,
   not provider contract, retention, or residency guarantees.
4. `ollama` identifies an Ollama-compatible endpoint. It does not prove that
   inference is local: `OLLAMA_BASE_URL` may point to another host.

Use bundled synthetic records for demonstrations. Do not use identifiable
health data unless the data owner has separately approved the model provider,
endpoint, deployment, contract, consent, retention, and governance.

## Output contract

- Chat and AI summaries must return the structured response format in the
  prompt. Invalid or unstructured output is not displayed as a clinical answer.
- The backend keeps only source references that exactly match references
  supplied from the FHIR bundle. This confirms resource identity, not whether the
  model's statement is clinically correct or whether the cited resource supports
  the statement.
- Suggested actions are optional, low-confidence workflow proposals. Model
  urgency is discarded. Model-generated CarePlan and Task resources are ignored.
- A user must review a suggestion and explicitly create a separate in-memory
  demo task. The task is not written back to an EHR.
- The UI labels output as AI-generated, identifies validated source references,
  and reminds users to review the source record. It does not diagnose, prescribe,
  order, or validate clinical appropriateness.

## Logging and SMART proxy boundaries

The application avoids logging prompts, responses, task text, bearer tokens,
FHIR request URLs, and provider error bodies. Infrastructure, browser extensions,
model providers, and configured Ollama hosts have separate logging and retention
boundaries that this repository cannot control.

The backend SMART/FHIR proxy is an experimental path and is not wired into the
Angular client. It accepts only exact issuer URLs listed in
`SMART_ALLOWED_ISSUERS`; the default is the SMART Health IT sandbox. Proxy
requests do not follow redirects, preventing bearer credentials from being
forwarded to a redirected host. This allow-list is a proof-of-concept boundary,
not a substitute for deployment-specific network controls.

## What remains outside this proof of concept

The app does not implement authenticated workforce identity, role or tenant
authorization, durable audit, retention/deletion workflows, production session
storage, incident response, backups, vendor agreements, privacy impact analysis,
clinical performance evaluation, or regulatory clearance. Those require the
actual organization, intended use, deployment, vendors, and jurisdiction. The
repository should not be represented as compliant or clinically validated.

For a clinical AI function, document the intended users and population, data
quality requirements, algorithm and evaluation evidence, known limitations, and
how a clinician independently reviews the basis for an output. See the
[roadmap](../roadmap/roadmap.md) for remaining engineering work.
