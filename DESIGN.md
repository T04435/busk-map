---
name: Busk Map
description: An agent that finds the street pitches whose crowd matches your music.
colors:
  paper: "#f2eee6"
  paper-card: "#fbf9f5"
  bluestone: "#141c21"
  signal-orange: "#ff5a1f"
  signal-orange-night: "#ff6a2b"
  signal-text: "#b13a00"
  muted-ink: "#56606a"
  hairline: "#cfc7b8"
  field-edge: "#7a7266"
  night: "#0f1416"
  night-card: "#182025"
  night-ink: "#f2ede4"
  honey: "#ffcf3a"
  qloo-purple: "#8C8CC8"
  qloo-ink: "#5b5ba3"
  zone-pink: "#e0337a"
  destructive: "#b0152f"
  taste-3: "#f28644"
  taste-4: "#dd6322"
  taste-5: "#7f2d0c"
typography:
  display:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "72px"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "0.005em"
  title:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "0.01em"
  body:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: "0.06em"
rounded:
  none: "0px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.signal-orange}"
    textColor: "{colors.bluestone}"
    rounded: "{rounded.none}"
    height: "44px"
  button-outline:
    backgroundColor: "{colors.paper-card}"
    textColor: "{colors.bluestone}"
    rounded: "{rounded.none}"
    height: "44px"
  card:
    backgroundColor: "{colors.paper-card}"
    textColor: "{colors.bluestone}"
    rounded: "{rounded.none}"
    padding: "24px"
  input:
    backgroundColor: "{colors.paper-card}"
    textColor: "{colors.bluestone}"
    rounded: "{rounded.none}"
    height: "44px"
---

# Design System: Busk Map

## Overview

**Honeycomb.** One idea, the hex cell, carries the whole system: ranks, scores, counts, the logo mark, the taste map, the loader. The surfaces dress like a street poster: paper by day and night by night, signal orange as the single accent, a 2px rule and a hard offset poster shadow instead of soft depth, and display caps you can read from across the street. Busk Map is a tool a busker checks on the move (Operate), so the poster attitude lives in precise details while scanability leads. Anti-references: soft SaaS cards, gradients, rounded pills, decorative emoji.

## Colors

### Primary
- **Signal orange** (#ff5a1f by day, #ff6a2b at night): the one accent. It's for the primary action, the selected or top item, the pitch ring, and the taste cells. It is never used for body text; text in the accent tone uses **signal text** (#b13a00) for contrast.

### Secondary
- **Qloo purple** (#8C8CC8 brand bar, #5b5ba3 for text): only where Qloo is named or its data shows (the Brain page, Qloo calls, the Qloo wordmark).

### Neutral
- **Paper** (#f2eee6) ground with **paper card** (#fbf9f5) surfaces; **bluestone** (#141c21) ink, rules and the night header; **muted ink** (#56606a) for secondary text; a **hairline** (#cfc7b8) for quiet dividers.
- Night: **night** (#0f1416) ground, **night card** (#182025), **night ink** (#f2ede4).

### Named Rules
- **Orange cells only on maps.** Taste draws only the orange steps 3–5 (night step 3 is #db5e1e), over a street base map, with hatched pink honeycomb cells for no-busking zones.
- **Pinned night.** Any surface that is dark whatever the OS theme carries `data-theme="dark"` (or `.bm-night`), so every token, including the focus ring, uses its night value.

## Typography

**Big Shoulders Display** (800, uppercase) for titles and numbers; **Atkinson Hyperlegible Next** for reading; **JetBrains Mono** (uppercase, tracked) for labels, meta and data.

### Hierarchy
- Hero 52–72px / title 40px: display, uppercase, tight leading.
- Body 16/24 in Atkinson; muted 14/20 for secondary lines.
- Labels and eyebrows: mono 12/16, 700, uppercase, 0.06em tracking.

### Named Rules
- **Names are never cut.** Pitch and song names wrap (balanced) rather than truncate; the time goes on its own line.

## Layout

Phone first at 390px, then 768 and 1440. The page content is at most about 1280px wide. Under 720px the header nav moves to a bottom bar (only when there are two or more features). Touch targets are 48px. Rhythm is on a 4px grid.

## Elevation & Depth

Flat with structural poster shadows: a hard offset (4–8px, no blur) in bluestone or signal orange marks the selected or primary card. There are no soft drop shadows and no gradients.

## Shapes

Square corners everywhere (radius 0). The hexagon is the only non-rectangular form: ranks, scores (PercentCell), counts, the logo mark, map cells and the funnel links (a half-hex pointing right).

## Components

### Buttons
Square, 44px; primary is signal orange with bluestone text and a 2px rule; outline and ghost variants are neutral. Focus is one 2px outline in `--ring` with a 2px offset.

### Cards / Containers
Paper card, 2px rule border, 16–24px padding; the selected card gets the offset orange shadow.

### Inputs / Fields
Square, 2px field edge; on focus the border turns `--ring` and one ring is added.

### Navigation
A bluestone header pinned night with the lockup logo; nav items are mono caps, and the current item is an orange block. Features only (Busks, Repertoire).

### HexCell
The signature component: a hexagon holding a number, icon or initials, in tones primary, muted, dashed (pending or empty) and error.

## Do's and Don'ts

### Do:
- Use the design system's Icon set (24 grid, 2px stroke) for every arrow, chevron, check and cross.
- Label estimates, test data and gaps honestly.
- Keep one focus ring.

### Don't:
- Use text glyphs (▸ → ✓) as icons.
- Truncate a pitch or song name.
- Add rounded corners, gradients or soft shadows.
- Confirm a pitch is legal.
