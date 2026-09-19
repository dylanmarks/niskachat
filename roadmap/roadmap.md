# NiskaChat roadmap

This roadmap separates working reference features from the work required for a
reliable real-world integration. It is ordered by interoperability value rather
than demo novelty.

## Current reference features

- Browser-based SMART on FHIR launch through `fhirclient`.
- Local FHIR R4 bundle exploration and resource-specific views.
- Observation trend charts.
- Optional cloud or local-model chat with server-sent event streaming.
- Session-isolated, in-memory FHIR Task notes with weak ETag concurrency.
- Automated frontend, backend, formatting, and static-analysis checks.

## Next: one production-shaped SMART path

The repository currently contains a browser SMART flow and a separate backend
SMART/proxy prototype. Choose one documented architecture, remove the other, and
test the chosen path against multiple R4 sandboxes.

- Derive authorization and token endpoints from SMART configuration discovery.
- Validate issuer URLs and document the SSRF boundary for server-side discovery.
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

- Make model egress visible in the UI before clinical context is sent.
- Add provider-specific retention/configuration guidance and an explicit
  no-fallback option for deployments with strict data boundaries.
- Redact patient content from operational logs and add regression tests for it.
- Replace heuristic model-output repair with schema-constrained output and one
  authoritative validator.
- Treat model-generated CarePlan and Task content as proposals, with provenance
  and human acceptance states.

## Engineering debt

- Split the large chat component into transport, parsing, presentation, and task
  proposal responsibilities.
- Reduce the existing TypeScript lint-warning baseline; new changes should not
  add warnings.
- Add route tests for streaming disconnects, malformed provider events, and
  maximum request sizes.
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
