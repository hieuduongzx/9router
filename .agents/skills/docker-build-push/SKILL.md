---
name: docker-build-push
description: >
  Build and push the Router2k / 9router Docker image to Docker Hub as amritazx/9router
  via the GitHub Actions workflow (.github/workflows/publish-amritazx.yml), without
  requiring local Docker Desktop. Use whenever the user tags @.agents/skills/docker-build-push/,
  says "build and push", "docker push", "build lại và push", "/docker-build-push",
  or asks to publish a new image after upstream sync or UI/feature changes.
---

# Docker build & push (`amritazx/9router`) via GitHub Actions

Project: **Router2k** (repo package `9router-app`).  
Docker Hub image: **`amritazx/9router`**.  
GitHub repository: **`hieuduongzx/9router`** (branch `master`).  
Workflow file: **`.github/workflows/publish-amritazx.yml`**.  
Default host port: **20128**. VPS env file and data volume: **`/root/.9router/.env`** and **`/root/.9router` → `/app/data`**.

## Defaults (do not invent new names)

| Item | Value |
|------|--------|
| Image | `amritazx/9router` |
| Tags | `latest` + exact `version` from root `package.json` |
| CI Workflow | `.github/workflows/publish-amritazx.yml` (`Build & Push amritazx/9router`) |
| Dockerfile | repo root `Dockerfile` (CI automatically adapts `npm ci` → `npm@11 install` inside Alpine when `package-lock.json` is gitignored) |
| Platform | `linux/amd64` (built on GitHub `ubuntu-24.04` runner with Buildx GHA cache) |
| Do NOT use | `decolua/9router` (upstream only); do NOT edit `.github/workflows/docker-publish.yml` |

## Prerequisites (one-time setup, already configured)

1. GitHub CLI (`gh`) authenticated as `hieuduongzx` with `repo` and `workflow` scopes (`gh auth status`).
2. Repository Secrets on `hieuduongzx/9router` (`https://github.com/hieuduongzx/9router/settings/secrets/actions`):
   - `DOCKERHUB_USERNAME` = `amritazx`
   - `DOCKERHUB_TOKEN` = Docker Hub Personal Access Token for `amritazx` with **Read & Write** permissions.
3. Changes committed and pushed to `origin/master`.

## Steps (GitHub Actions — Primary)

### 1. Check git status & read version

```bash
git status --short --branch
node -p "require('./package.json').version"
```

Call the result `$VERSION` (example: `0.5.123`).

Ensure the commits you want published are already pushed to `origin/master`.

### 2. Trigger or monitor the workflow

- **Automatic trigger:** Any push to `origin/master` that touches non-markdown code automatically starts `Build & Push amritazx/9router` and publishes both `amritazx/9router:$VERSION` and `amritazx/9router:latest`.
- **Manual trigger (re-publish current `master` or push after markdown-only/secret changes):**

```bash
gh workflow run publish-amritazx.yml -R hieuduongzx/9router --ref master -f push_latest=true
```

Pass `-f push_latest=false` if you only want to publish `amritazx/9router:$VERSION` without moving `:latest`.

### 3. Watch the run until completion

Find the latest run ID and watch it:

```bash
gh run list -R hieuduongzx/9router --workflow "publish-amritazx.yml" --limit 3
gh run watch <RUN_ID> -R hieuduongzx/9router --exit-status
```

What the workflow runs automatically on `ubuntu-24.04`:
1. Reads `$VERSION` from root `package.json`.
2. Adapts `Dockerfile` in `$RUNNER_TEMP/Dockerfile` to use `npm@11` inside Alpine when `package-lock.json` is absent (avoids npm 10 `edgesOut` bug without touching repo `Dockerfile`).
3. Builds `amritazx/9router:$VERSION` and `amritazx/9router:latest` (`linux/amd64`) using Buildx GitHub Actions cache (`scope=amritazx-9router-amd64`).
4. Runs the built container and smoke-tests `http://127.0.0.1:20128/api/health`.
5. Logs into Docker Hub and pushes `amritazx/9router:$VERSION` (and `:latest` when `push_latest=true`).

If a run fails, inspect logs before retrying:

```bash
gh run view <RUN_ID> -R hieuduongzx/9router --log-failed
```

### 4. Verify published tags on Docker Hub

PowerShell:

```powershell
(Invoke-RestMethod "https://hub.docker.com/v2/repositories/amritazx/9router/tags?page_size=5").results | Select-Object name, last_updated | Format-Table -AutoSize
```

Bash:

```bash
curl -fsSL "https://hub.docker.com/v2/repositories/amritazx/9router/tags?page_size=5" | node -e "const d = JSON.parse(require('fs').readFileSync(0, 'utf8')); console.table(d.results.map(r => ({ name: r.name, last_updated: r.last_updated })));"
```

### 5. Confirm & provide VPS update command

Tell the user:

- Published tags: `amritazx/9router:latest` and `amritazx/9router:<version>`
- GitHub Actions run URL: `https://github.com/hieuduongzx/9router/actions/runs/<RUN_ID>`
- Canonical VPS pull/run command:

```bash
docker pull amritazx/9router:latest
docker rm -f 9router 2>/dev/null || true

docker run -d \
  -p 20128:20128 \
  --env-file /root/.9router/.env \
  -v "/root/.9router:/app/data" \
  -e DATA_DIR=/app/data \
  --name 9router \
  amritazx/9router:latest
```

This is the canonical VPS run command. Do not replace it with `$HOME/.9router` or omit `--env-file`; the VPS keeps its environment and persistent data together under `/root/.9router`.

## Optional: version bump before release

Only if the user asks to bump version:

1. Edit `"version"` in root `package.json` (and `cli/package.json` if keeping them in sync).
2. Commit and push to `origin/master` — GitHub Actions will automatically build, smoke-test, and push the new version tag + `latest`.

## Optional fallback: local Docker build & push

Only use if the user explicitly asks to build locally and a local Docker daemon is running (`docker info` works) and logged in as `amritazx`:

```powershell
$VERSION = (Get-Content package.json -Raw | ConvertFrom-Json).version
docker build -t "amritazx/9router:latest" -t "amritazx/9router:$VERSION" . ; if ($LASTEXITCODE -eq 0) { docker push amritazx/9router:latest; docker push "amritazx/9router:$VERSION" }
```

## Common failures

| Symptom | Fix |
|---------|-----|
| `DOCKERHUB_TOKEN secret is not set` | Add `DOCKERHUB_TOKEN` in `https://github.com/hieuduongzx/9router/settings/secrets/actions`, then re-run `gh workflow run publish-amritazx.yml` |
| `unauthorized: access token has insufficient scopes` | Regenerate Docker Hub Personal Access Token at `https://app.docker.com/settings/personal-access-tokens` with **Read & Write** permissions and update `DOCKERHUB_TOKEN` secret |
| `Health check failed` | Inspect container logs via `gh run view <RUN_ID> --log-failed`, fix the runtime/build error, commit & push again |
| `npm error Cannot read properties of null (reading 'edgesOut')` | Known npm 10 bug without `package-lock.json`; ensure workflow keeps `npm install -g npm@11` in the Alpine builder fallback |
| `gh` auth/permission error on workflow run | Run `gh auth status` and ensure token includes `repo` and `workflow` scopes |

## What NOT to do

- Do not push to `decolua/9router` unless the user explicitly asks.
- Do not edit upstream's `.github/workflows/docker-publish.yml` (keep fork publishing isolated in `.github/workflows/publish-amritazx.yml` so `upstream-sync` has no CI merge conflicts).
- Do not change the VPS `DATA_DIR`, `--env-file /root/.9router/.env`, or `/root/.9router:/app/data` conventions without asking.
- Do not skip the version tag (always push **both** `latest` and `$VERSION` unless the user explicitly requests otherwise).
- Do not rewrite git history as part of this skill.
