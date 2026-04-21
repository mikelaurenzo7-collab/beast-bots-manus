# Bot Boss

Bot Boss is the rewrite this idea actually wants.

The verdict after analyzing the current Beast Bots repo and its branches is straightforward:

- The design language is strong and worth keeping.
- The marketplace story is ahead of the runtime reality.
- The best branch is `origin/claude/production-ready-release-FFmki` because it is the one that deepens real integrations instead of broadening static inventory.
- The strongest product wedge is not an app store for 80 bots. It is one boss operator with a small number of real connectors and mission-shaped workflows.

This repo implements that wedge.

## What It Is

Bot Boss is a founder and operator control plane with:

- Curated real connectors: GitHub, Slack, Notion, Linear.
- An encrypted local vault for connector tokens, so operation does not depend on editing process env after boot.
- A live action console wired to actual provider APIs.
- A mission runner with three live workflows: Daily Operator Snapshot, Release Radar, and Decision Loop.
- A background scheduler for running saved mission payloads automatically and recording the output into history.
- An executive synthesis layer that turns mission traces into operator-ready readouts, using OpenAI when configured and a deterministic fallback when it is not.
- Persistent run history and audit trails for every mission and action executed through the UI.
- A cleaner, more honest product surface built around one orchestration agent instead of a crowded shelf.

## Why This Has A Better Chance

- Outcome-first beats catalog-first. Buyers want fewer tools that do more.
- Trust comes from real integrations and visible write actions, not dozens of thin wrappers.
- Mission-based workflows are easier to explain, sell, and expand.

## Running It

1. Copy `.env.example` to `.env` and set whichever connector tokens you want to activate.
2. Run `pnpm install`.
3. Run `pnpm dev`.
4. Open the local URL printed by the server.

## Supported Tokens

- `GITHUB_TOKEN`
- `SLACK_BOT_TOKEN`
- `NOTION_TOKEN`
- `LINEAR_API_KEY`

Optional but recommended:

- `OPENAI_MODEL` if you want to override the default synthesis model.
- `BOT_BOSS_VAULT_KEY` for encrypted in-app secret storage. Use a long random string, for example `openssl rand -hex 32`.
- `BOT_BOSS_DATA_DIR` if you want Bot Boss state stored somewhere other than `.bot-boss-data/`.

The app degrades cleanly when tokens are missing, but the live actions and mission runner only work against configured providers.

If you set provider env vars, Bot Boss will use them immediately. If you also set `BOT_BOSS_VAULT_KEY`, you can save or override connector tokens inside the app and Bot Boss will persist them encrypted at rest.

## Live Missions

- `Daily Operator Snapshot`: reads every configured connector and composes a concise operating brief.
- `Release Radar`: scans GitHub and Linear, then posts a launch brief into Slack.
- `Decision Loop`: turns a founder decision into a Linear issue, a Notion record, and a Slack broadcast.

## Schedules

- Save a schedule from the mission studio and Bot Boss will run that mission in the background.
- Choose simple interval runs or operator-style local-time runs like daily at `09:00` or weekdays at `08:30` in your own timezone.
- Each schedule keeps a failure streak and can auto-pause itself after repeated failed runs, so a broken Slack channel or bad token does not spam forever.
- Each scheduled run updates the next run window automatically and records a full audit entry in history.
- Scheduled mission payloads are stored in local state, so treat the app as operator tooling rather than a public multi-tenant service until auth and tenant isolation are added.

## Vault And History

- The connector vault lets you save GitHub, Slack, Notion, and Linear credentials inside the app instead of relying only on boot-time env vars.
- Saved connector secrets are encrypted at rest inside `.bot-boss-data/state.json` when `BOT_BOSS_VAULT_KEY` is configured.
- Every action and mission run is recorded in the run history timeline with payload, duration, and section-level outcomes.
- Mission runs also produce an executive readout and next moves. With `OPENAI_API_KEY`, Bot Boss uses OpenAI for the readout. Without it, Bot Boss falls back to a deterministic heuristic summary.