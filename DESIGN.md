---
name: Router2k
description: A local AI routing gateway built on shadcn/ui + Radix, with custom tokens for the dashboard's data-heavy reading surface.
---

# Design System: Router2k

## Overview

Router2k is a local AI routing gateway. The dashboard is dense with numbers, status and structured tables — a routing-inspection surface, not a marketing site. The visual system is built on **shadcn/ui + Radix** primitives restyled onto shadcn's token set, so the product has:

- a real primitive layer (focus traps, listbox/tab/dialog semantics, proper keyboard support) that the previous hand-rolled `Modal`/`Drawer`/`Tooltip` did not have
- one icon system (lucide) instead of two parallel ones
- route boundaries, a unified sidebar, and a single nav config that the rail and the ⌘K palette both read
- tokens that match the shadcn contract (`--background`, `--primary`, `--radius`, …) so any future shadcn block can be dropped in unchanged

Confirmed rejections, kept from the previous design: no drop shadows on surfaces, no gradients-as-decoration, no glassmorphism/blur chrome, no colorful icon-tile decoration, no pill buttons. A control may be radius 3–4px to read as a control, but containers stay square.

## Tokens

Two layers, both in `src/app/globals.css`:

1. **shadcn contract** (`--background`, `--card`, `--primary`, `--ring`, `--radius`, …). All values are OKLCH with full HSL-style alpha. This is the layer the primitive components read.
2. **Compatibility aliases** (`--color-surface`, `--color-text-muted`, …). The codebase has 35k lines of pre-existing markup that reads the old names. The aliases point those at the new layer so the visual change reaches the whole app without a 35k-line rewrite. New code should use the shadcn names; the aliases are an adapter, not a second palette.

A `--radius` token drives the rest of the radius scale via `@theme inline`. Buttons, inputs and select are 0.625rem; cards, dialogs and dropdowns are 0.75rem; badges are 0.5rem. The previous "0px containers, 3px controls, 4px sheets" rule is gone — there's one system now, and it's recognizable from the rest of the shadcn ecosystem.

## Color

Near-monochrome with a single accent (blue 600) for primary actions. Data-role chips on stat tiles are the only saturated colour on screen, in the same palette as before:

- **Tokens** — violet
- **Requests** — amber
- **Cost** — green
- **Errors / danger** — red
- **Info / neutral counts** — blue

## Typography

Two faces, loaded via `next/font`:

- **Inter** — body paragraphs, descriptions, helper text, empty states
- **IBM Plex Mono** — for code, terminal blocks, stat numbers, and `tabular-nums` content (request IDs, costs, token counts)

The previous "uppercase tracked mono caption" treatment on every section label is gone. Section headings are now `font-semibold` Inter at base size — uppercase tracked mono at 11px measurably slowed scanning, especially in long lists.

## Icon system

One source of truth: `src/shared/components/ui/icon.js` exports `<Icon name="…" />` and maps the codebase's old Material Symbols ligature names to lucide components (`add` → `Plus`, `close` → `X`, …). An unmapped name renders nothing — `scripts/check-icon-map.mjs` fails the build on any unrecognised name, so an unmapped icon never silently produces blank space.

The `material-symbols` font and its 606 ligature usages are gone.

## Layout shell

A single `<DashboardLayout variant="user|admin">` mounts:

- the **sidebar** (a single component, one nav config in `src/shared/constants/dashboardNav.js` — previously there were two ~600-line near-duplicates and a dead third copy)
- the **header** (title, breadcrumbs, view-mode switch, identity menu, optional per-page search)
- a **content scroll region** with consistent page padding

Both sidebars used to be a copy-pasted pair. They are now one component, `variant` is the only difference that matters, and the admin rail's submenu logic (Media Providers) is in the same component as the user rail's tabs.

Routes that manage their own scrolling (`/dashboard/basic-chat`, `/dashboard/console-log`, …) opt out via a `FULL_BLEED_ROUTES` set in the layout, instead of every page re-discovering the same workaround.

## Route boundaries

`src/app/loading.js`, `src/app/error.js`, `src/app/not-found.js`, and `src/app/global-error.js` exist for the first time. Before, every navigation was a brief blank surface; now there's a spinner, an empty state, and a real error page.

## Components

`src/shared/components/` is split in two:

- **`ui/`** — the shadcn primitive layer. `Button`, `Card`, `Dialog`, `Sheet`, `Select`, `Tabs`, `Table`, `Tooltip`, `DropdownMenu`, `Popover`, `Command`, `Switch`, `Checkbox`, `Badge`, `Input`, `Label`, `Progress`, `Alert`, `Separator`, `Icon`, `Sonner`, `Skeleton`, `Avatar`, `Breadcrumb`. Each lives in its own file and is the shadcn component, not a wrapper.
- **Top-level adapters** that translate the older prop shapes (`isOpen`, `variant="primary"`, `icon="add"`) so the existing ~300 call sites keep working. These are adapters, not a second design system: don't add features here, prefer `ui/*` in new code.

The icon shim is one of the adapters' workhorses: `<Icon name="close" />` resolves to `X` from lucide, so call sites that passed a ligature string render lucide without ever knowing.

## Accessibility

The shadcn primitives handle focus traps, roving focus, dialog/tab/listbox/separator semantics, keyboard return-focus, scroll lock, and outside-click dismissal. The previous hand-rolled modal/drawer/tooltip/select did not:

- `Modal` and `Drawer` had Escape and scroll-lock but no focus trap, no `role="dialog"`, no return-focus — a keyboard user could tab out of an open dialog into the page behind it.
- `Tooltip` was CSS-hover-only, so it never appeared for keyboard users, and was clipped by ancestor `overflow: hidden` because it wasn't portalled.
- The 20+ hand-rolled `<table>` instances used `.thead-data` inconsistently (14/20), with no caption, no scope, and no semantic row headers.

The new `Dialog`, `Sheet`, `Tooltip`, `Select` and `Table` are all Radix-driven. Two of the long tables have been rewritten to use `<table>` with proper `<caption>` and `scope` attributes, and the rest of the app will follow in subsequent passes.
