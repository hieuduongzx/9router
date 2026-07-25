---
name: Router2k
description: A local AI routing gateway rebuilt as a schematic instrument, not a consumer dashboard.
colors:
  ink: "#09090b"
  paper: "#ffffff"
  paper-dim: "#fafafa"
  hairline: "#e4e4e7"
  hairline-dark: "#27272a"
  text-muted: "#71717a"
  accent-tokens: "#7c3aed"
  accent-requests: "#f59e0b"
  accent-cost: "#16a34a"
  accent-danger: "#dc2626"
  accent-info: "#2563eb"
typography:
  mono:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace"
    fontWeight: 500
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.08em"
rounded:
  none: "0px"
  sm: "3px"
  md: "4px"
spacing:
  card-padding: "24px"
  grid-gap: "1px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
  card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "{spacing.card-padding}"
---

# Design System: Router2k

## Overview

**Creative North Star: "The Bench Instrument"**

Router2k stops looking like a SaaS product and starts looking like a piece of lab/bench equipment for routing traffic: a schematic readout, not a marketing surface. Every screen reads like inspecting a log or a spec sheet — numbers and status are the content; chrome recedes to hairlines and brackets. The system borrows from Swiss grid typography, terminal output, and print crop-marks: flat fields, monospace numerals, `//` comment-style section labels, `[NN]` bracket indices instead of bullets or icons-as-decoration.

Confirmed rejections: no drop shadows, no gradients, no glassmorphism/blur chrome, no rounded-pill buttons, no colorful icon-tile decoration for its own sake, no card elevation on hover. Color is reserved for small 1–2ch data-role chips (tokens/cost/requests/status) and the single ink/primary accent — never for backgrounds or brand decoration.

**Key Characteristics:**
- Flat surfaces, 1px hairline borders everywhere, radius ≤4px (buttons/inputs only; containers are square)
- Monospace (IBM Plex Mono) for all headings, nav labels, stat numbers, table data, buttons; Inter for body paragraphs and descriptions only
- `//` prefixed uppercase tracked section labels; `[01]` bracket step indices in flows
- Crop-mark corner brackets as the one signature ornament, used sparingly on hero/featured containers
- Near-monochrome ink/paper palette; the only saturated color is the primary (ink-black in light, off-white in dark) and small semantic data chips

## Colors

Near-monochrome ground with data-role color reserved for small chips and the primary action only.

### Primary
- **Ink** (`#09090b` light-mode primary / `#fafafa` dark-mode primary): the one "brand" color — primary buttons, active nav indicator, links, focus ring source. Flat, no gradient, no hover-lighten beyond a single tonal step.

### Neutral
- **Paper** (`#ffffff`): base background, light mode.
- **Paper Dim** (`#fafafa`): sidebar / secondary surface, light mode.
- **Hairline** (`#e4e4e7` light / `#27272a` dark): the only border color in the system; 1px everywhere, never 2px, never colored.
- **Text Muted** (`#71717a` light / `#a1a1aa` dark): secondary text, labels, timestamps.
- **Ink Dark** (`#09090b` dark-mode base / `#0f0f12` surface): dark mode ground.

### Named Rules
**The One Accent Rule.** Only the primary (ink/off-white) carries brand weight. Every other color on screen is a semantic data-role chip (see below) at ≤16px, never a background fill.

**Data-role chips** (4×4–6×6px flat squares or 1.5px dot, next to a stat label — not a rounded icon tile):
- **Tokens** — violet `#7c3aed`
- **Requests / runs** — amber `#f59e0b`
- **Cost / spend** — green `#16a34a`
- **Errors / danger** — red `#dc2626`
- **Info / neutral metric** — blue `#2563eb`
- **Status: completed** — existing success green pill; **failed** — existing danger red pill; both keep current pill shape (rounded, bordered, uppercase mono label) since it is already close to this language.

## Typography

**Display/Heading Font:** IBM Plex Mono (with ui-monospace, SFMono-Regular fallback)
**Body Font:** Inter (with system-ui fallback) — unchanged, already loaded via `next/font`.
**Label/Mono Font:** IBM Plex Mono — same family as headings; this system has no separate label face.

**Character:** Monospace carries all structure and data (it reads as instrumentation); Inter is reserved for sentences a human reads start-to-end (descriptions, help text, empty states) so paragraphs stay comfortable instead of turning the whole UI into a terminal.

### Hierarchy
- **Display** (600, 20–24px, tight leading, mono): page title (`Header` h1), landing hero headline.
- **Headline** (600, 15–16px, mono): card/section titles.
- **Label** (600, 11px, mono, `0.08em` tracking, uppercase): `// SECTION LABEL` eyebrows, table column headers, nav group titles, stat tile captions (`MONTHLY USAGE`, `TOTAL TOKENS`).
- **Body** (400, 14px, 1.5 leading, sans/Inter): descriptions, helper text, empty states, modal copy.
- **Data** (600, 20–36px, mono, tabular-nums): the big number in a stat tile (`$0.21`, `4.3M`, `106`) — this is the largest text on any screen, always mono, always tabular-nums.

### Named Rules
**The Mono-Structure Rule.** If a piece of text is UI chrome, a label, a number, code, or an identifier, it is mono. If it is a sentence written for a human to read for meaning, it is Inter. Never mix — a card title in Inter or a paragraph in mono both break the system.

## Layout

Swiss/schematic grid: dashboard stat rows are 3 equal hairline-bordered columns sharing 1px seams (grid-gap: 1px of border color, not a spacing gap — tiles visually fuse into one ruled table). Section labels (`// USAGE SUMMARY`) sit above each grid with a thin rule trailing off to the right. Content max-width follows existing container widths (no new breakpoint system); density stays close to current spacing scale (`p-6` card padding, `gap-6` section rhythm) — this is a skin/token change, not a re-layout, except where a page's structure must change to match a reference (e.g. stat-tile rows, request tables).

Sidebar stays fixed-width icon+label rail (existing 256px), now paper-dim background, hairline right border, no shadow.

## Elevation & Depth

Flat by default and always — this system has no shadow vocabulary. Depth is conveyed by hairline borders and by the crop-mark corner-bracket ornament on emphasized containers, never by `box-shadow`, blur, or z-lift on hover. `--shadow-*` tokens in `globals.css` are retained only for legacy components not yet migrated and must resolve to `none`/transparent for the new primitives.

### Named Rules
**The Flat-By-Default Rule.** No surface gains a shadow on hover, focus, or elevation. Interactive feedback is a border-color or background-tint change only.

## Shapes

Two-tier radius, applied narrowly:
- **Containers** (Card, Sidebar, Header, table, code block): `radius: 0`, square corners, 1px hairline border.
- **Interactive controls** (Button, Input, Badge/chip, Select): `radius: 3–4px` — enough to read as a control, never a pill.
- **Crop-mark ornament**: 8–10px L-shaped corner brackets (border-top+border-left / border-top+border-right / etc.), 1px, hairline color, offset ~6px outside or inside the corner of a featured card — the system's one decorative device, reserved for hero/featured containers (landing hero frame, dashboard "Get Started" panel, pilot/reference cards), not applied to every card.

## Components

### Buttons
- **Shape:** `radius: 3px` (`--radius-sm`), never pill.
- **Primary:** ink background / paper text (light), paper background / ink text (dark); flat, no gradient; `h-9 px-4`, mono label, uppercase optional for short verbs (`UPGRADE`, `COPY`).
- **Hover/Focus:** background steps one tone (ink → `zinc-800`), 1px focus ring in muted ink, no shadow growth.
- **Secondary/Outline/Ghost:** hairline border, transparent/paper background, text-main; hover = hairline bg tint (`surface-2`).
- **Danger:** same shape, red text/border outline by default, solid red only for destructive-confirm actions.

### Chips (data-role badges)
- Small flat square or dot (4–6px) + mono uppercase label, 10–11px, `0.06em` tracking — used for stat-tile captions and table status/mode cells. Not a filled rounded pill except for the existing status pills (`COMPLETED`/`FAILED`), which keep their current rounded-bordered shape since that already reads like a terminal status tag.

### Cards / Containers
- **Corner Style:** `radius: 0`.
- **Background:** paper (light) / ink-surface `#0f0f12` (dark).
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1px hairline, all sides.
- **Internal Padding:** `24px` (`p-6`) standard, `16px` (`p-4`) for dense table/list rows.
- **Signature layout:** 3-up stat-tile rows share borders edge-to-edge (no gap) so they read as one ruled table, not three floating cards.

### Inputs / Fields
- **Style:** hairline border, `radius: 3px`, paper/transparent background, mono value text, Inter placeholder.
- **Focus:** border color shifts to ink/primary, no glow ring beyond a 1px outline.
- **Error/Disabled:** red hairline border + red mono hint text; disabled = 50% opacity, no fill change.

### Navigation (Sidebar)
- Flat paper-dim rail, hairline right border, no active-pill background — active item gets a 2px left ink bar + ink text, inactive = muted text. Group labels are mono `// LABEL` style at 10–11px tracked uppercase, replacing the current plain uppercase sans labels.

### Code / terminal blocks
- Signature component: black (`#000`/`#0a0a0a`) background regardless of theme, mono text, small "Copy" button top-right (hairline border, not filled) — matches the reference `$ npm i -g ...` blocks exactly; this is the one place true black-on-white-elsewhere is correct.

### Crop-mark frame
- Signature component: 4 absolutely-positioned 8–10px L-brackets at a container's corners, 1px hairline, used to mark "this is the featured/primary panel" (landing hero, dashboard get-started panel) — never on every card.

## Do's and Don'ts

### Do:
- **Do** set every number/stat/label/nav-item/button in IBM Plex Mono; keep Inter only for prose sentences.
- **Do** keep every border 1px and the system's only border color (hairline token, themed).
- **Do** use `// SECTION LABEL` eyebrows above every major section, and `[01] [02] [03]` bracket indices for ordered steps instead of bullets or numbered circles.
- **Do** keep stat-tile grids edge-fused (shared 1px borders, zero gap) rather than gapped card grids.
- **Do** preserve all existing routes, copy meaning, and data — this is a visual system replacement, not a feature or IA change.

### Don't:
- **Don't** add box-shadow, gradient, or blur/glass to any new or restyled surface.
- **Don't** round any container corner — radius belongs to controls (button/input/chip) only, at 3–4px max.
- **Don't** invent billing/credit/plan copy or numbers that don't exist in this codebase's real data, even though the reference screenshots show a plans/billing page — Router2k has no such feature yet (see PRODUCT.md).
- **Don't** use Material Symbols icon tiles as colorful decoration; where an icon is kept, render it as a small flat mono-bordered square, not a soft colored rounded tile.
- **Don't** rename `Router2k` to anything else without the user confirming again — brand name stays as-is, only tagline/microcopy may tighten to fit the terminal voice.
