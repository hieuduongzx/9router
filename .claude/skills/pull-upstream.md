# Skill: Pull Upstream & Handle Conflicts

## Context
This repo is a **fork** of `https://github.com/decolua/9router.git`. The local branch is `master` which diverges from `upstream/master` (branding, UI customizations). Before any upstream merge, always check for new commits.

## Workflow

### 1. Check for upstream updates
```bash
git fetch upstream
git log --oneline master..upstream/master
```
If empty → nothing to do.

### 2. Preview the diff
```bash
git diff --stat master upstream/master
```
This tells you how many files changed and helps estimate conflict risk.

### 3. Merge
```bash
git merge upstream/master
```

### 4. Resolve conflicts — Decision Matrix
For **every** conflicted file, classify it as **Logic** or **UI/UX/Branding** and apply the rule:

| Category | Rule | Typical files |
|----------|------|---------------|
| **Logic / Feature / API** | Take **upstream** | `open-sse/**/*.js`, `src/app/api/**/*.js`, `src/mitm/**/*.js`, `src/lib/**/*.js`, `src/sse/**/*.js` |
| **Provider definitions / constants** | Take **upstream**, but preserve local extra providers/aliases | `src/shared/constants/providers.js`, `src/shared/constants/config.js` |
| **UI / UX / Branding / Sidebar** | Keep **local**, cherry-pick upstream features if useful | `src/shared/components/Sidebar.js`, `src/app/layout.js`, landing pages, CSS |
| **Package metadata** | Keep local `name`, take upstream `version` | `package.json` |
| **README / docs** | Keep local branding (9Router, endpoint 20129, screenshots), take upstream feature lists | `README.md`, `i18n/*.md` |
| **CLI tool cards** | Take upstream logic, keep local labels if they differ | `src/app/(dashboard)/dashboard/cli-tools/components/*.js` |
| **Media providers pages** | Merge carefully — upstream may refactor kind routing; keep local `audio` category | `src/app/(dashboard)/dashboard/media-providers/**/*.js` |

### 5. Post-merge checks
- **Search for conflict markers**: `grep -r "<<<<<<<" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" .
- **Verify no unmerged paths**: `git status`
- **Stage everything**: `git add -A`
- **Commit**: `git commit -m "Merge upstream/master (vX.Y.Z) — keep local UI/branding + take upstream features"`

### 6. Build / smoke test (optional)
```bash
# Windows
$env:NODE_ENV = "production"; npx next build --webpack
# If build fails due to webpack cache
npx rimraf .next
```

## Key Local Overrides to Preserve
- **App name**: `9router` (NOT `9router-app`)
- **Port / endpoint**: `20129` (NOT upstream's `20128`)
- **Sidebar media kinds**: `audio` (tts + stt + music combined) + individual embedding, image, imageToText, video
- **MITM Root CA CN**: `Api2K MITM Root CA` in some places, but follow upstream cert logic (SHA1 fingerprint check)
- **Branding references**: `Api2K` in CLI tool cards, `9Router` everywhere else

## Common Pitfalls
1. **providers.js**: Upstream adds new providers with `searchConfig`/`fetchConfig`. Do NOT drop them. Merge into local list.
2. **media-providers/[kind]/[id]/page.js**: Upstream may rename `kind` from `audio` back to `tts`. Keep `audio` in `VISIBLE_MEDIA_KINDS` but ensure `tts` is also handled in page logic.
3. **index.js exports**: Local may have extra component exports (e.g., `TabButton`). Keep them AND add upstream's new exports.
4. **usage.js**: Upstream may refactor a provider's quota logic. Take upstream unless it's specific to local data structures.

## One-liner check
```bash
git fetch upstream && git merge upstream/master || echo "CONFLICTS — run conflict resolution workflow"
```
