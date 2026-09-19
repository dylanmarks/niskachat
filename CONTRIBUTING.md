# Contributing to NiskaChat

Thank you for helping improve NiskaChat. The project is a reference application
for healthcare interoperability, so changes should be technically clear and
careful about what they claim.

## Before opening an issue

- Search the existing issues first.
- Never include protected health information, access tokens, API keys, or
  screenshots from a real clinical system.
- Use the clinical feedback issue form for questions about workflow or resource
  semantics. Clinical feedback is not a substitute for implementation review
  against the applicable FHIR or SMART specification.

## Development setup

```bash
git clone https://github.com/YOUR-USERNAME/niskachat.git
cd niskachat
npm install
cp .env.example .env
npm run start:dev
```

Node.js 22 is the supported runtime.

## Making a change

1. Create a focused branch from `main`.
2. Add or update tests for observable behavior.
3. Keep FHIR resources valid: application-only metadata must not be inserted as
   ad hoc underscore-prefixed properties. Use standard elements, a documented
   extension, or a separate application model.
4. When changing SMART behavior, state which launch context and specification
   version were tested.
5. Use synthetic or fully de-identified fixtures.
6. Run the checks below before opening a pull request.

```bash
npm run lint:all
npm run test:ci
npm run test:backend
npm run build
```

## Pull requests

Keep pull requests small enough to review. Include:

- the problem and the chosen approach;
- interoperability assumptions and relevant resource profiles;
- tests performed, including the FHIR server or SMART sandbox when applicable;
- screenshots for user-interface changes; and
- limitations or follow-up work.

The project uses Conventional Commits, for example:

```text
feat(tasks): add FHIR version-aware comment updates
fix(smart): preserve issuer context during launch
docs: clarify clinical safety boundary
```

Avoid claims such as “FHIR compliant,” “HIPAA compliant,” or “production ready”
unless the pull request provides a precise scope and verifiable evidence. Prefer
specific language such as “serializes a FHIR R4 Task with `meta.versionId`” or
“tested against the SMART Health IT R4 sandbox.”
