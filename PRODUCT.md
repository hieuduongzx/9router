# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: individual developers / power users self-hosting Router2k (repo/package name `9router`, display brand `Router2k`) on their own machine as a local AI routing gateway — running the dashboard at `localhost:20128` to manage their own provider credentials, model routing, quotas, and spend.

[Inferred, user-confirmed direction] The product is evolving toward an OpenRouter-style positioning: "every model, one API," pay-as-you-go framing, per-request usage analytics — potentially diverging into a separately branded/monetized fork later. Treat this as the target mental model for the dashboard's data (usage, cost, models) even though hosted billing/plans/credits are not yet real features in this codebase — do not fabricate pricing tiers, credit balances, or plan copy that isn't backed by actual app data or config.

## Product Purpose

Router2k exposes one OpenAI-compatible endpoint (`/v1/*`) and routes traffic across 40+ upstream AI providers with format translation, model-combo fallback, multi-account fallback, OAuth/API-key credential management, token refresh, quota/usage tracking, and optional cloud sync. Success = a developer points any OpenAI/Anthropic-compatible client at it and gets reliable completions with visibility into cost and usage, without lock-in to one provider.

## Positioning

Local-first universal AI gateway: runs on the user's own machine (not a hosted multi-tenant SaaS), aggregates many providers/models behind one stable API and one set of credentials, with fallback/combo routing a single-provider client can't do. Distinct from OpenRouter in that it is self-hosted and credential-bring-your-own rather than a hosted paid relay — though its dashboard UX is deliberately modeling that category.

## Operating Context

- Desktop web dashboard (Next.js), served locally by the CLI launcher (`9router` npm package) which manages install/start/tray.
- Users interact via: a marketing/landing page, a login screen, and an authenticated dashboard with 20+ sections (Home, API Keys, Models, Usage, Activity, Providers, Combos, Quota, Token Saver, CLI Tools, Accounts/Users, Proxy Pools, Skills, Console Log, Translator, Account/Profile/Wallet/Security, Settings).
- Also used headlessly via CLI tools/IDE integrations (Claude Code, Codex, Copilot, etc.) that point at the local `/v1` endpoint — the dashboard is the control plane for that traffic.

## Capabilities and Constraints

- Real, current dashboard capabilities: API key management, model catalog/aliasing, per-request usage logs + cost/token charts, provider registry + OAuth/API-key credential management, request combos (fallback chains), quota limits, RTK token-saver stats, CLI tool config generators, proxy pools, MCP skills, admin user management.
- No real hosted billing, credit balances, or paid plan tiers exist yet in this codebase (a `settings/pricing` page and `PricingModal` exist but reflect model/token pricing display, not a monetized plan system) — undecided whether/when a real billing layer ships.
- Plain JavaScript (ESM) throughout, Tailwind v4 token-driven CSS (`src/app/globals.css`), ships light + dark themes.

## Brand Commitments

- Name shown in-product: **Router2k** (`APP_CONFIG.name`); npm/CLI package and repo are `9router`. Both names are real and coexist — do not silently unify them without asking again if it becomes ambiguous which one a given surface should show.
- User has approved changing name/tagline/copy where it reads better in the new visual language — this is not locked to existing landing copy.

## Evidence on Hand

- Live app screenshot (before state): current dashboard usage page, `9router-app` codebase.
- Reference screenshots supplied by user: a "Command Code" style dashboard (Studio home, profile/activity streak, Usage overview with charts + request table, Provider API page, Billing/Plans page) — used as the target visual world (see DESIGN.md), not as copyable product claims. Its billing/plan numbers ($1/$15/$100 tiers, "$10 in credits") are that product's real data, not Router2k's — must not be copied verbatim into Router2k's UI since Router2k has no such plan system.

## Product Principles

1. Local-first control plane, not a multi-tenant SaaS — copy and UI should read as "your gateway," not "our platform."
2. Cost/usage transparency is the core value prop — usage, spend, and per-request detail are the most important surfaces, not decoration.
3. Zero lock-in — every surface should reinforce "any model, any client, one API" rather than favor one provider's branding.
4. Power-user tool aesthetic is intentional, not a limitation — density, precision, and terminal/schematic visual language are a feature for this audience.

## Accessibility & Inclusion

No product-specific accessibility requirement established yet; maintain standard web a11y (contrast, focus states, keyboard nav) through the redesign since nothing in the brief overrides it.
