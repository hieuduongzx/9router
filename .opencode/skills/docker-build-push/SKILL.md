---
name: docker-build-push
description: >
  Build and push the 9router Docker image to Docker Hub as amritazx/9router.
  Use when the user says "build and push", "docker push", "build lại và push",
  or asks to publish a new image after UI/feature changes.
---

# Docker build & push (amritazx/9router)

Project: **9router** (repo package `9router-app`).  
Docker Hub image: **`amritazx/9router`**.  
Default host port: **20128**. VPS env file and data volume: **`/root/.9router/.env`** and **`/root/.9router` → `/app/data`**.

## Defaults (do not invent new names)

| Item | Value |
|------|--------|
| Image | `amritazx/9router` |
| Tags | `latest` + exact `version` from root `package.json` |
| Dockerfile | repo root `Dockerfile` |
| Platform | host default (`linux/amd64` on this Windows Docker Desktop setup) unless user asks multi-arch |
| Do NOT use | `decolua/9router` for this user's push (upstream only) |

## Prerequisites

1. Docker Desktop / daemon running (`docker info` works).
2. Logged in to Docker Hub as the owner of `amritazx`:
   ```bash
   docker login
   ```
3. Working directory = **repo root** (`package.json` + `Dockerfile` present).

## Steps (always)

### 1. Read version

```powershell
# PowerShell
(Get-Content package.json -Raw | ConvertFrom-Json).version
```

```bash
# bash
node -p "require('./package.json').version"
```

Call the result `$VERSION` (example: `0.5.35`).

### 2. Build

From repo root:

```bash
docker build -t amritazx/9router:latest -t amritazx/9router:$VERSION .
```

PowerShell example:

```powershell
$VERSION = (Get-Content package.json -Raw | ConvertFrom-Json).version
docker build -t "amritazx/9router:latest" -t "amritazx/9router:$VERSION" .
```

- Build can take **several minutes** (Next.js production build inside image). Use a long timeout (10–20+ min).
- On failure: fix the error, re-run build. Do not push a failed build.

### 3. Push both tags

```bash
docker push amritazx/9router:latest
docker push amritazx/9router:$VERSION
```

PowerShell:

```powershell
docker push amritazx/9router:latest
docker push "amritazx/9router:$VERSION"
```

### 4. Confirm

```bash
docker images amritazx/9router
```

Tell the user:

- Image: `amritazx/9router:latest` and `amritazx/9router:<version>`
- Pull/run on VPS:

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

1. Edit root `package.json` `"version"`.
2. Rebuild + push with the **new** version tag.
3. Do not force-overwrite history; normal push is fine.

## Common failures

| Symptom | Fix |
|---------|-----|
| `Cannot connect to Docker daemon` | Start Docker Desktop, retry |
| `denied` / `unauthorized` on push | `docker login` as `amritazx` |
| Build fails on missing export / compile | Fix app build first (`npm run build` locally if helpful), then rebuild image |
| Port / name conflict on run | `docker rm -f 9router` then re-run |
| Disk full | `docker system prune` (confirm with user first if destructive) |

## What NOT to do

- Do not push to `decolua/9router` unless the user explicitly asks.
- Do not change the VPS `DATA_DIR`, env-file, or volume path conventions without asking.
- Do not skip the version tag (always push **both** `latest` and `$VERSION`).
- Do not rewrite git history as part of this skill.

## Quick one-liner (PowerShell, repo root)

```powershell
$VERSION = (Get-Content package.json -Raw | ConvertFrom-Json).version
docker build -t "amritazx/9router:latest" -t "amritazx/9router:$VERSION" . ; if ($LASTEXITCODE -eq 0) { docker push amritazx/9router:latest; docker push "amritazx/9router:$VERSION" }
```
