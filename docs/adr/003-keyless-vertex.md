# 003: Gemini without an API key

- **Date:** 31 October 2026
- **Status:** Accepted

**Problem.** A long-lived API key can end up in a commit, a log line, a client bundle or a demo recording.

**Choice.** Call Gemini through Vertex AI with the official `@google/genai` SDK (`vertexai: true`). Credentials come from Application Default Credentials: on Cloud Run that is the service's own service account, which holds only `roles/aiplatform.user`, and on a laptop it is `gcloud auth application-default login`. Model, project and location are plain configuration.

For an account without Vertex billing, `AI_PROVIDER=developer` switches to the Gemini Developer API, with the key mounted from Secret Manager. Tests use `AI_PROVIDER=fixture`, which the configuration loader rejects in production.

**Trade-offs.** Vertex AI usage is billed per token. Token caps, request limits, a response cache and a Cloud Billing budget alert keep the cost of a demo small. They don't guarantee zero cost, and the README says so.
