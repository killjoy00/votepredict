# Minnesota Legislator Vote Predictor

VotePredict is an exploratory web app that searches official Minnesota bills and asks an OpenAI model to estimate how the current House and Senate roster might vote. It is designed for scenario exploration—not as a poll, whip count, election tool, or statement by any legislator.

## What it does

- Searches the Minnesota Revisor's official bill service (or OpenStates when configured) and loads the latest official text for Revisor results.
- Loads all 134 House and 67 Senate seats from official legislative sources, with a verified in-repo fallback.
- Estimates caucus support and notable individual exceptions with an OpenAI Responses API structured output.
- Calculates chamber totals from the same member-level predictions shown in the UI.
- Shows uncertain calls separately from predicted abstentions and explains the methodology.

## Local setup

Requirements: Node.js 22.12 or newer and npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Set `OPENAI_API_KEY` in `.env.local` to enable predictions. Bill search and the roster work without OpenStates credentials.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | For predictions | Server-side OpenAI API credential. |
| `OPENAI_MODEL` | No | Model override; defaults to `gpt-5.4-mini`. |
| `OPEN_STATES_API_KEY` | No | Uses OpenStates before official-source fallbacks. |
| `MN_OPENSTATES_SESSION` | No | OpenStates session slug; defaults to `2025-2026`. |
| `MN_LEGISLATURE_SESSION` | No | Revisor session code; defaults to `0942025` (94th Legislature). |
| `PUBLIC_SITE_URL` | No | Additional canonical origin allowed to submit predictions. |

Never expose `OPENAI_API_KEY` through a `VITE_` variable or commit a real `.env` file.

## Commands

```bash
npm run check        # typecheck, tests, and production build
npm test             # Node test suite
npm run data:update  # regenerate and validate the official roster snapshot
npm run dev          # Vercel local development server
```

The roster updater intentionally fails unless it finds plausible full-chamber counts and unique IDs/districts. Review and commit the generated `src/data/legislators.ts` diff.

## API

| Route | Method | Description |
| --- | --- | --- |
| `/api/legislators` | GET | Roster plus source and freshness metadata; optional `chamber=house|senate`. |
| `/api/bills?q=...` | GET | Up to 20 Minnesota bill results. |
| `/api/bill-text?url=...` | GET | Extracted context from an allow-listed official Revisor bill URL. |
| `/api/predict` | POST JSON | AI estimate for a bill description. |

The prediction route accepts descriptions up to 12,000 characters, requires same-origin JSON requests in browsers, and has a best-effort per-instance rate limit of five requests per ten minutes per client IP. For a high-traffic public deployment, also configure durable rate limiting or a spend limit at the platform/API-account layer.

## Data and prediction limitations

- The checked-in roster is a session snapshot and may lag resignations, appointments, or special elections if both live sources are unavailable.
- The model is given bill text, sponsors/topics, caucus membership, chamber, and district. It is not trained here on a verified roll-call dataset and does not know private whip counts.
- Member exceptions are accepted only when they match a real roster ID or exact normalized name. Other model-proposed names are ignored.
- “Likely passes” requires predicted yes votes to reach a majority in both chambers. Uncertain votes do not count as yes.

## Deployment

The repository is configured for Vercel. Add the server-side environment variables to the Vercel project, deploy, and verify the `/api` routes. Pull requests receive preview deployments through the existing GitHub integration.

CI runs the same `npm run check` command used locally and rejects high/critical production dependency advisories.
