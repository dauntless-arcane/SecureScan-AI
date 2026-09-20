# SecureScanAI

GitHub URL → clone → Semgrep → findings → AI-generated fix (OpenRouter) → isolated verification → Semgrep re-scan → VERIFIED / FAILED.

## Demo (Docker)

### Prerequisites

- Docker Desktop (that's it — no Node, Python, Semgrep, or Git needed on the host)

### Setup

1. Clone this repository.
2. Copy the example env file and add your OpenRouter API key:
   ```
   cp .env.example .env
   ```
   Edit `.env` and set `OPENROUTER_API_KEY` (and optionally `OPENROUTER_MODEL`, default `openai/gpt-4o-mini`).
3. Build and start everything:
   ```
   docker compose up --build
   ```
4. Open the frontend at [http://localhost:3000](http://localhost:3000).

The backend API is reachable directly at `http://localhost:4000` (health check at `/health`).

### Stopping

```
docker compose down
```

### Notes

- The OpenRouter API key stays backend-only — it's read from the environment at runtime and is never baked into an image or sent to the frontend.
- Cloned repositories are scanned in an ephemeral workspace inside the backend container and deleted immediately after each scan and each verification run; nothing persists across runs.
- If you change `VITE_API_BASE_URL` in `.env` (e.g. because you mapped the backend to a different host port), you must rebuild the frontend image for it to take effect, since it's baked in at build time: `docker compose up --build`.
