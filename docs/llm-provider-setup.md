# LLM provider setup

LLM features are optional. Without a configured provider, NiskaChat continues to
display FHIR data and uses a small deterministic fallback for patient summaries.

## Data boundary

The backend sends a compressed representation of the current clinical record,
the user's question, and recent conversation history to the selected provider.
Do not use identifiable clinical data unless your organization has reviewed the
provider, contracts, consent, retention behavior, access controls, and applicable
legal requirements.

An API key in `.env` keeps the credential out of browser code; it does not make a
cloud model appropriate for regulated clinical data. Ollama can keep inference on
a machine you control, but the surrounding host, logs, model, and operational
controls still require review.

## Configure a provider

Copy the example configuration and select one provider:

```bash
cp .env.example .env
```

### Ollama

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b
```

### OpenRouter

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=replace-me
OPENROUTER_MODEL=anthropic/claude-3.5-haiku
```

### Anthropic

```env
LLM_PROVIDER=claude-haiku
ANTHROPIC_API_KEY=replace-me
CLAUDE_MODEL=claude-3-haiku-20240307
```

### Gemini

```env
LLM_PROVIDER=gemini-vertex
GEMINI_API_KEY=replace-me
GEMINI_MODEL=gemini-2.5-pro
```

Model identifiers and availability change over time. Override the defaults with
an identifier currently supported by your account and provider.

## Verify configuration

Start the backend, then inspect provider status:

```bash
npm run start:backend
curl http://localhost:3000/api/llm/status
```

Run the provider smoke test only with synthetic input:

```bash
npm run test-providers
```

Only `LLM_PROVIDER` is used. If it is unavailable or fails, the request fails;
clinical context is never retried through another provider. `/api/llm/status`
reports the selected model, endpoint origin, availability, and whether it is an
external service or an Ollama-compatible endpoint. Endpoint origin is a routing
label, not a data-residency or contract guarantee. The chat and patient-summary
flows display that destination before sending clinical context. The user's send
or summary action triggers the call without a separate confirmation dialog.

## Operational notes

- Never commit `.env` files or keys.
- Use distinct keys per environment and rotate them regularly.
- Review provider logging and retention settings.
- Treat generated content as untrusted output requiring clinician review.
- No prompt, response, task text, token, FHIR request URL, or provider error body
  should be written to application logs. Add log-capture regression tests when
  introducing new request or error-handling paths.
- FHIR source-reference validation checks that a reference was present in the
  supplied bundle. It does not validate the clinical meaning of the answer.
- The browser may still contain identifiable data; this project does not
  de-identify data and does not certify any provider for regulated use.
