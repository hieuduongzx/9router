---
name: upstream-sync
description: >
  Safely synchronize this Router2k fork with decolua/9router master, preserve the fork's custom behavior and branding, resolve merge conflicts semantically, verify the merged application, commit, and push to the user's origin. Use whenever the user tags @.grok/skills/upstream-sync/, says the original 9router repository has updates, asks to sync or merge upstream, or asks to update their fork without losing custom changes.
---

# Sync Router2k with upstream 9router

Use this workflow for the Router2k fork in this repository.

| Item | Value |
|---|---|
| Upstream | `https://github.com/decolua/9router.git` |
| User fork | `https://github.com/hieuduongzx/9router.git` |
| Branch | `master` |
| Upstream remote | `upstream` |
| Fork remote | `origin` |

The objective is not a mechanical “take theirs” merge. Import upstream logic while preserving the fork's intentional product behavior.

## Fork invariants

Keep these unless the user explicitly asks to remove or redesign them:

- Router2k name, favicon, visual identity, and UI copy.
- Custom Home dashboard and its traffic, token, cost, cache, provider, and request summaries.
- Account authentication, admin/user roles, Profile, Accounts, persistent balances, account-owned API keys, and account-scoped usage.
- Administrator Activity view and request-detail behavior.
- Custom Web Search/Web Fetch logic and the Tinyfish provider.
- Local/self-hosted endpoints and the managed Cloud Endpoint.
- The complete removal of built-in Cloudflare Tunnel and Tailscale provisioning, APIs, startup services, settings, CLI controls, and UI controls.
- Existing local layout/design choices unless upstream logic requires a compatible UI addition.

Cloudflare Workers AI, Cloudflare proxy workers, and the managed Cloud Endpoint are independent features; do not remove them when enforcing the Tunnel invariant.

## Workflow

### 1. Inspect before changing anything

Run from the repository root:

```bash
git status --short --branch
git remote -v
```

Require the expected `origin`, `upstream`, and `master` topology. If `upstream` is missing, add it:

```bash
git remote add upstream https://github.com/decolua/9router.git
```

Do not discard, reset, clean, or silently stash uncommitted user work. Preserve it and choose a non-destructive integration path.

### 2. Fetch and review upstream

```bash
git fetch upstream master
git rev-list --left-right --count master...upstream/master
git log --left-right --cherry-pick --oneline --decorate master...upstream/master
```

Review incoming commit titles and changed files before merging. Identify overlap between upstream changes and local custom files. Pay particular attention to:

- `open-sse/` provider, executor, translator, and search logic.
- Dashboard Home, Header, Sidebar, Profile, Accounts, Activity, Usage, and API Keys.
- CLI tool endpoint selection.
- Provider registry and provider assets.
- Authentication, database migrations, settings, and request logging.
- `package.json`, `CHANGELOG.md`, and global CSS.

### 3. Merge without rewriting fork history

Use a merge commit, not a rebase or force-push:

```bash
git merge --no-commit --no-ff upstream/master
```

If there are no conflicts, still inspect auto-merged overlap before committing. Auto-merge can be syntactically valid while restoring removed features or weakening account isolation.

### 4. Resolve conflicts semantically

For every conflict, inspect the base, local side, upstream side, and surrounding code. Combine intent rather than choosing an entire side blindly.

Default decision rule:

1. Keep upstream bug fixes, protocol changes, provider updates, model updates, migrations, and performance improvements.
2. Preserve the fork invariants listed above.
3. Adapt upstream UI additions to Router2k branding and the current design system.
4. Delete obsolete paths rather than restoring compatibility shims for removed Tunnel/Tailscale behavior.
5. Keep provider registrations unique and deterministic.
6. Follow exported-symbol call sites when upstream changes an API; update every caller.

Recurring conflict guidance:

- **Provider registry:** accept upstream additions/removals, retain Tinyfish, and verify there are no duplicate IDs.
- **Grok Build / CLI tools:** accept new configuration logic and model capabilities; retain local/custom/cloud endpoint selection without Tunnel/Tailscale props; render Router2k in generated human-facing names.
- **Topology/Header/Sidebar:** accept upstream performance and behavior changes; retain Router2k branding, account navigation, balance display, and role boundaries.
- **Global CSS:** retain local palette/layout decisions while adding selectors required by upstream behavior.
- **Kimi or provider consolidation:** accept upstream canonical provider IDs, then migrate local registry references instead of keeping obsolete duplicate providers.

After resolving markers, stage only the resolved files and run:

```bash
git diff --cached --check
git status --short --branch
```

There must be no unresolved conflicts, unstaged resolution edits, or conflict markers.

### 5. Audit preserved behavior

Search active source and CLI code for accidentally restored remote-access behavior:

```text
Tunnel, Tailscale, cloudflared, tunnelEnabled, tunnelUrl,
tailscaleEnabled, tailscaleUrl, tunnelDashboardAccess
```

Allowed occurrences are limited to:

- The settings sanitizer that removes legacy persisted keys.
- Regression tests proving those keys are discarded.
- Historical changelog entries.
- Generic documentation about user-managed SSH/ngrok tunnels.
- Unrelated Cloudflare AI/worker functionality.

Also verify:

- Tinyfish and all upstream provider IDs are present once.
- Router2k remains visible in product-facing UI.
- Account ownership and admin boundaries remain enforced.
- Removed `/api/tunnel/**` routes are not recreated.
- `/api/settings` does not expose retired Tunnel/Tailscale keys.

### 6. Verify before committing

Run tests covering both incoming logic and fork-specific contracts. At minimum include:

```bash
npx vitest run --config tests/vitest.config.js \
  tests/unit/auth-accounts.test.js \
  tests/unit/dashboard-guard.test.js \
  tests/unit/db-sqlite-vs-lowdb.test.js \
  tests/unit/request-details-tab.test.js
```

Add every test file introduced or changed by upstream that covers provider, executor, translator, database, or CLI logic. Do not claim the full suite passed if it did not. If an upstream test is stale relative to upstream implementation, prove the mismatch, keep production logic intact, and report the exact failing file and reason.

Lint conflict surfaces and high-risk merged files. Existing unrelated warnings may remain, but merged files must have no lint errors.

Build the production image so Windows filesystem quirks do not hide Linux deployment failures:

```bash
node -p "require('./package.json').version"
docker build -t router2k:upstream-<version> .
```

The Next.js production compile and static-page generation must finish successfully.

### 7. Smoke-test the merged app

Open the running dashboard or start it if necessary. Exercise, as administrator:

- `/dashboard`
- `/dashboard/account`
- `/dashboard/activity`
- `/dashboard/api-keys`
- `/dashboard/settings`
- `/dashboard/cli-tools`
- `/dashboard/media-providers/web`

Confirm:

- Current upstream version is displayed.
- Router2k branding, balance, account menu, and custom pages remain.
- No page has runtime alerts or horizontal overflow at desktop and mobile widths.
- Tunnel/Tailscale text and controls are absent.
- Retired `/api/tunnel/**` routes return `404`.
- `/api/settings` contains no retired keys.

Smoke-test newly merged upstream behavior when it can be exercised locally. Never substitute source inspection for a runnable scenario when a scenario is available.

### 8. Commit and push the fork

Only after verification:

```bash
git commit -m "Merge upstream master v<version>"
git push origin master
```

The push must be a normal fast-forward update of the fork. Never use `--force`, rewrite history, push to `decolua/9router`, or push a merge that did not build.

## Completion report

Report concisely:

- Upstream commit/version range imported.
- Merge commit and pushed fork branch.
- Major upstream logic added.
- Local invariants preserved.
- Conflict files and semantic resolution choices.
- Test, lint, production-build, and browser-smoke evidence.
- Exact upstream-originated test drift or dependency advisories, if any.

Do not describe the sync as complete until the fork is pushed successfully.