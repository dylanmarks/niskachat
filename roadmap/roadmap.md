# NiskaChat roadmap

This roadmap separates working reference features from the work required for a
reliable real-world integration. It is ordered by interoperability value rather
than demo novelty.

## Current reference features

- Browser-based SMART on FHIR launch through `fhirclient`.
- Local FHIR R4 bundle exploration and resource-specific views.
- Observation trend charts.
- Optional model chat and summaries with a first-use provider/data-flow disclosure.
- Single-provider requests with no cross-provider retries.
- Evidence-reference validation and display-only model suggestions; user-created
  tasks stay in the in-memory demo store.
- Automated frontend, backend, formatting, and static-analysis checks.

## Next: one production-shaped SMART path

The repository currently contains a browser SMART flow and a separate backend
SMART/proxy prototype. Choose one documented architecture, remove the other, and
test the chosen path against multiple R4 sandboxes.

- Derive authorization and token endpoints from SMART configuration discovery.
- Keep the experimental proxy issuer allow-list current and document the SSRF
  boundary for server-side discovery.
- Cover EHR launch, standalone launch, patient context, token expiry, refresh,
  logout, and denied-consent behavior.
- Add a conformance matrix naming the SMART versions, scopes, and servers tested.

## Next: durable FHIR workflow integration

- Replace the in-memory Task store with a repository interface.
- Implement a FHIR-server adapter that preserves `meta.versionId`, ETags, and
  OperationOutcome errors.
- Persist CarePlan and Task resources only after explicit user confirmation.
- Add profile validation fixtures and terminology-aware coding examples.
- Define provenance and audit-event behavior without putting application-only
  properties into FHIR resources.

## Next: trustworthy clinical-data handling

Implemented for the current demo path: selected-provider disclosure, no
cross-provider retry, payload-free application logging, structured output
validation, exact source-reference filtering, no model-created FHIR resources,
and an explicit user action before a demo task is created. These checks do not
validate clinical truth or vendor data handling.

- Add provider-specific retention and data-processing documentation.
- Add semantic/source-support evaluation fixtures, not only resource-reference
  membership checks.
- Add a versioned evaluation set and report limitations by population and data
  quality; do not call this clinical validation without suitable evidence.
- Test payload-free logs and no-retry behavior as an end-to-end regression.
- Document intended users, intended population, input quality, model/version,
  evidence basis, known unknowns, and independent review in the app itself.

## Engineering debt

- Split the large chat component into transport, parsing, presentation, and task
  proposal responsibilities.
- Reduce the existing TypeScript lint-warning baseline; new changes should not
  add warnings.
- Add route tests for streaming disconnects, malformed provider events, and
  maximum request sizes; basic prompt and reference bounds are now enforced.
- Replace the deprecated Angular HTTP testing module and add accessibility tests
  to CI.
- Tighten production bundle budgets and document the `fhirclient` CommonJS
  optimization trade-off.

## Longer-term interoperability examples

- Patient timeline assembled from heterogeneous FHIR resources.
- CapabilityStatement-driven feature availability.
- Bulk-data or paginated history ingestion for longitudinal records.
- Canadian implementation-guide examples alongside the existing generic R4
  fixtures.
