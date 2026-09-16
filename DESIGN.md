---
name: Switchboard AI
description: Canopy glass. A dark forest-floor workbench of mostly opaque smoked-glass panes lit through one opening in the canopy, with white primaries, a single mint accent for the action that spends money, and earth for warmth.
colors:
  ground: "#0e0c0a"
  ground-2: "#1a1613"
  ground-top: "#0a1410"
  ground-foot: "#120e0b"
  canopy: "#040908"
  ink: "#ffffff"
  ink-2: "rgba(255, 255, 255, 0.82)"
  dim: "rgba(255, 255, 255, 0.64)"
  line: "rgba(255, 255, 255, 0.10)"
  line-2: "rgba(255, 255, 255, 0.06)"
  paper: "rgba(255, 255, 255, 0.06)"
  paper-2: "rgba(255, 255, 255, 0.10)"
  paper-3: "rgba(255, 255, 255, 0.16)"
  glass: "rgba(26, 22, 19, 0.74)"
  glass-strong: "rgba(36, 31, 27, 0.82)"
  glass-dark: "rgba(16, 13, 11, 0.90)"
  popup: "rgba(26, 22, 19, 0.96)"
  light: "#eafff5"
  accent: "#86ecbf"
  accent-2: "#a9f3d3"
  ember: "#5fd9a3"
  ember-deep: "#1f5a3e"
  ember-dark: "#0f2a1e"
  earth: "#b5885f"
  earth-2: "#d9b48c"
  ok: "#86ecbf"
  err: "#ff7b7b"
  warn: "#ffc857"
  ask: "#c9b8ff"
  info: "#8fd3ff"
typography:
  display:
    fontFamily: "Urbanist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(48px, 7.6vw, 118px)"
    fontWeight: 700
    lineHeight: 0.94
    letterSpacing: "-0.035em"
  wordmark-footer:
    fontFamily: "Urbanist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(64px, 15vw, 260px)"
    fontWeight: 700
    lineHeight: 0.85
    letterSpacing: "-0.05em"
  headline-lg:
    fontFamily: "Urbanist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(36px, 5vw, 64px)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Urbanist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(36px, 4vw, 48px)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title-caption:
    fontFamily: "Urbanist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(30px, 3.3vw, 46px)"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.03em"
  title-lg:
    fontFamily: "Urbanist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "34px"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Urbanist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: "26px"
    letterSpacing: "-0.025em"
  lead:
    fontFamily: "Urbanist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: "32px"
    letterSpacing: "normal"
  body:
    fontFamily: "Urbanist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "normal"
  small:
    fontFamily: "Urbanist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
    letterSpacing: "normal"
  label:
    fontFamily: "Urbanist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: "16px"
    letterSpacing: "normal"
  readout:
    fontFamily: "Urbanist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "max(1em, 28px)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  data:
    fontFamily: "ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "20px"
rounded:
  key: "6px"
  tag: "8px"
  chip-sm: "10px"
  chip: "12px"
  control: "14px"
  field: "16px"
  popup: "18px"
  card: "20px"
  card-lg: "22px"
  panel: "24px"
  panel-lg: "26px"
  dialog: "28px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "7": "28px"
  "8": "32px"
  "10": "40px"
  "12": "48px"
  "16": "64px"
  "20": "80px"
  "24": "96px"
  "28": "112px"
  "32": "128px"
  "40": "160px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "44px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "#eefff7"
    textColor: "{colors.ground}"
  button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ground}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "44px"
  button-accent-hover:
    backgroundColor: "{colors.accent-2}"
    textColor: "{colors.ground}"
  button-accent-disabled:
    backgroundColor: "rgba(134, 236, 191, 0.10)"
    textColor: "{colors.accent}"
  button-glass:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "44px"
  button-glass-hover:
    backgroundColor: "rgba(255, 255, 255, 0.14)"
    textColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "rgba(255, 255, 255, 0.08)"
    textColor: "{colors.ink}"
  button-danger:
    backgroundColor: "rgba(255, 123, 123, 0.14)"
    textColor: "{colors.err}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "44px"
  button-xs:
    rounded: "{rounded.chip-sm}"
    padding: "0 10px"
    height: "30px"
  button-sm:
    rounded: "{rounded.chip}"
    padding: "0 12px"
    height: "36px"
    typography: "{typography.small}"
  button-lg:
    rounded: "{rounded.field}"
    padding: "0 24px"
    height: "54px"
  field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0 18px"
    height: "48px"
    typography: "{typography.body}"
  field-area:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card-lg}"
    padding: "14px 18px"
  field-prompt:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.dialog}"
    padding: "14px 64px 56px 18px"
  field-sm:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "0 12px"
    height: "36px"
    typography: "{typography.small}"
  chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.chip}"
    padding: "0 14px"
    height: "36px"
    typography: "{typography.small}"
  chip-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
  chip-sm:
    rounded: "{rounded.chip-sm}"
    padding: "0 11px"
    height: "30px"
  select-trigger:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
    typography: "{typography.body}"
  tag:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.tag}"
    padding: "0 9px"
    height: "26px"
    typography: "{typography.label}"
  tag-lg:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.tag}"
    padding: "0 10px"
    height: "28px"
    typography: "{typography.label}"
  tag-accent:
    backgroundColor: "rgba(134, 236, 191, 0.16)"
    textColor: "{colors.accent-2}"
  tag-earth:
    backgroundColor: "rgba(181, 136, 95, 0.22)"
    textColor: "{colors.earth-2}"
  tag-ask:
    backgroundColor: "rgba(201, 184, 255, 0.16)"
    textColor: "{colors.ask}"
  tag-code:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.tag}"
    padding: "0 10px"
    height: "28px"
    typography: "{typography.data}"
  key:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.key}"
    padding: "0 6px"
    height: "22px"
    typography: "{typography.label}"
  glass-panel:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "24px"
  glass-strong:
    backgroundColor: "{colors.glass-strong}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "28px"
  glass-dark:
    backgroundColor: "{colors.glass-dark}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "24px"
  glass-inner:
    backgroundColor: "rgba(255, 255, 255, 0.05)"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px"
  header-pill:
    backgroundColor: "{colors.glass-strong}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "4px"
  bay-jack:
    backgroundColor: "{colors.ground-2}"
    rounded: "{rounded.pill}"
    size: "26px"
  bay-jack-lit:
    backgroundColor: "{colors.ground-2}"
    textColor: "{colors.accent}"
    rounded: "{rounded.pill}"
    size: "26px"
  bay-jack-ask:
    backgroundColor: "{colors.ground-2}"
    textColor: "{colors.ask}"
    rounded: "{rounded.pill}"
    size: "26px"
  stage-tick:
    backgroundColor: "rgba(255, 255, 255, 0.24)"
    rounded: "{rounded.pill}"
    width: "3px"
    height: "12px"
  stage-tick-active:
    backgroundColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    width: "3px"
    height: "24px"
  dialog:
    backgroundColor: "{colors.ground-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.dialog}"
    padding: "28px"
    typography: "{typography.body}"
  popup:
    backgroundColor: "{colors.popup}"
    textColor: "{colors.ink}"
    rounded: "{rounded.popup}"
    padding: "8px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.field}"
    padding: "0 14px"
    height: "48px"
  nav-item-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
  avatar:
    backgroundColor: "{colors.earth}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "44px"
    typography: "{typography.small}"
  toast:
    backgroundColor: "rgba(255, 255, 255, 0.94)"
    textColor: "{colors.ground}"
    rounded: "{rounded.field}"
    padding: "12px 16px"
    typography: "{typography.small}"
---

# Design System: Switchboard AI

## Overview

**Creative North Star: "The Lit Clearing"**

Switchboard AI is a per-user AI workbench whose whole point is that every model call is visible, priced and gated. The world makes that literal: a dark forest floor seen from under the canopy, one cool mint light breaking through an opening at the top of the frame, and the work laid out on dark, mostly opaque panes of smoked glass in front of it. Nothing is painted onto the ground; every surface sits above it, edged by a crisp 1px light line and a hairline top highlight, so the eye reads layers, not fills. The light behind the panels is the only saturated thing in the room; the panels themselves are brown-black at 74 to 90% opacity and do not blur what is behind them.

Density is that of a professional tool, not a brochure: 15px body on a 24px line, 44px controls, 48px fields, tables with 52px rows and tabular figures. Hierarchy is carried by weight and size in a single family (Urbanist), never by a second face or by caps and tracking. The primary action is solid white; the one action that spends money is solid mint; every other control is glass. State reads as a coloured dot beside a word, or as a tinted tag, in five fixed hues tuned for the dark ground, and earth/tan carries the little warmth the room needs: the avatar and the provider tags. The landing shows the product the same way the session does: real panes with labelled sample data, one at a time on a stage, captioned by a title, one sentence and a few tags rather than paragraphs; the request's route is patched under the hero prompt as six jacks on one cord, and the stack is a ruled spec sheet of terms, sentences and tags.

Three earlier registers were rejected and stay rejected: the terminal-multiplexer look ("good but basic and hard to grasp"), the pastel aurora glass ("somewhat better but too playful"), and this world's own first palette, orange ember, replaced on request with "green forest-ish colours, like mint and brown". The brief that holds is "better glassmorphism, more defined and more professional": darker, crisper edges, fewer colours, AAA contrast, snappy motion.

**Key Characteristics:**
- One committed dark theme. There is no light mode and no toggle; `color-scheme: dark` is the only scheme.
- A fixed, static `z-0` ground drawn as a scene (a CSS light field, an optional raster, an SVG of mint haze, nine light shafts and dust, dark canopy lobes at the top corners, a sun core, vignette and grain) under a `relative z-[1]` page; "hero" intensity on the welcome page, dimmed to "app" intensity inside the session.
- Panels are dark and defined, not frosted: `glass` at 74% opacity, 1px white/12% edge, an inset 1px top highlight and one deep soft shadow. Backdrop blur exists only on the surfaces that float over moving content: the two landing header pills, the phone tab bar, dialogs and popups.
- White is the primary; mint #86ecbf is reserved for spending (Generate, Send, "Add key") and for small live marks (the patch cord in the mark tile, the Live chip, the lit jacks and trail of the hero's patch bay, the usage meter, citation tags, focus rings). Earth #b5885f is the warm secondary for the avatar and provider tags.
- Urbanist for everything, from the `clamp(48px, 7.6vw, 118px)` hero headline and the white/9% footer wordmark to the tabular readouts; monospace appears only for code, ids and key caps.
- Motion is spring-based (`motion`, stiffness 420 / damping 34 for entrances, 300 / 34 for the stage swap) and moves only transform and opacity; the one authored loop is the hero's patch bay (9s, CSS). Every animation and spring is stilled under `prefers-reduced-motion`, and the bay rests with the signal held at Approval.

## Colors

A warm brown-black ground that cools toward the light at the top and warms at the foot, white ink at three opacities chosen for AAA contrast, translucent white "paper" for controls, brown-black panel fills at four opacities, one mint light with a forest ramp behind it and a near-white core, an earth pair for warmth, and five state hues.

### Primary
- **Mint Light** (`accent`): the light source brought to the foreground. Solid fill only on the action that spends money (the Generate and Send tiles, "Add key"); otherwise marks smaller than a word: the patch cord inside the mark tile, the last word of the hero headline, the lit jack rings and dots, the trail (55%) and the glow of the hero's patch bay, the dialog title icon, the caret, selection, focus outline, and the usage-meter gradient. Never a section background, never body text.
- **Mint Highlight** (`accent-2`): the hover state of the mint button, the text colour of `tag-accent` (citations, the "AI" tag in the wordmark), markdown links and `.ink-accent`; the middle stop of the light shafts.
- **Light Core** (`light`): the white-mint at the centre of the light. The top stop of the ground's light shafts, the signal pulse that runs down the mark's cord, the 3px signal that runs the patch bay's cord, and (with 92% white) the sun core. It is a highlight, never a fill or text.
- **Moss, Forest, Forest Dark** (`ember`, `ember-deep`, `ember-dark`): the ramp behind the light. Moss and forest are the stops of the ground's light field; forest is the icon colour inside the active white nav pill. They are ground material, not UI colour. (The token names keep the prior world's `ember` prefix; the values are green.)

### Secondary
- **Earth** (`earth`): the warm counterweight. The avatar disc (a radial from `#e9cfae` through earth to `#5e4128`) and its shadow; the `tag-earth` fill for "your key" provider tags; at 20% (12% in the app) the faint glow low in the ground's field.
- **Tan** (`earth-2`): the text colour of earth tags and the light stop of the gallery cover gradient.

### Neutral
- **Ground** (`ground`): the page background under everything, and the text colour on white and mint fills (`btn-primary`, active chips, active nav, toasts).
- **Ground Top / Ground Foot** (`ground-top`, `ground-foot`): the ends of the ground's vertical gradient: green-black under the light, warm black at the foot, passing through `ground` at 62%. Ground material only.
- **Canopy** (`canopy`): the cool near-black of the leaf masses silhouetted against the light: eight radial lobes from the two top corners at 85 to 98%, dimmed to 60% in the app. Ground material only; never a panel fill.
- **Ground 2** (`ground-2`): the opaque fill of dialogs (`glass-solid`), shadcn popovers, the sidebar fold knob, the jacks in the mark and in the hero's patch bay, and the cover well while images load.
- **Ink** (`ink`): primary text, headings, icons at rest, the active stage tick.
- **Ink 2** (`ink-2`, white/82%): secondary text, chip and nav labels at rest, ghost-button text, the second line of the greeting, hero, caption and section subs, the spec sheet's sentences.
- **Dim** (`dim`, white/64%): tertiary text: section labels ("Windows", "Others", "Sources"), the "Sample data" legends, the "In flight…" caption under the wave, placeholders, timestamps, table headers, the facts line under the hero. The floor for text on the ground.
- **Line / Line 2** (`line` white/10%, `line-2` white/6%): dividers; `line` for section rules, the spec sheet's top rule and its nine row rules, the footer rule and table header rules, `line-2` between table rows; the hairline above the patch bay is white/8%.
- **Paper / Paper 2 / Paper 3** (`paper` white/6%, `paper-2` white/10%, `paper-3` white/16%): translucent fills for glass controls, tags and key caps; `paper-3` is the ceiling for a resting fill.
- **Glass / Glass Strong / Glass Dark / Popup** (`glass` 74%, `glass-strong` 82%, `glass-dark` 90%, `popup` 96%): the brown-black panel fills. `glass` is every pane; `glass-strong` the header pills, the phone tab bar and the signed-in session card; `glass-dark` the hero prompt panel, the MCP command tile, the user's transcript bubbles and `tone="ink"` panes; `popup` selects and menus.

### State
- **OK** (`ok`, the same mint as `accent`): completed jobs, ready documents, "Live", "OK" calls.
- **Error** (`err`): failed jobs, error rows (`tr[data-tone="err"]` tints the row at 8%), the danger button, destructive hover on "Sign out".
- **Warn** (`warn`): pending jobs (hollow dot), "Your key" tags, locked providers.
- **Ask** (`ask`): the agent asking for approval; the "Needs approval" tag and the ask ring on a tool frame or pane; on the landing, the Approval jack, its glow and the "Approve?" readout while the patch bay's signal holds there, and the "needs approval" tag on the spec sheet's Agent row.
- **Info** (`info`): generating jobs (pulsing dot), running counts, trace-id tags.

### Named Rules
**The One Light Rule.** Mint is a light, not a colour. It appears once per screen as a solid fill (the money action) and otherwise only as marks smaller than a word: dots, icons, rings, meters, tags, one headline word. If a second mint fill appears on a screen, one of them is wrong.

**The White Primary Rule.** The default action is solid white with ground text. Glass controls surround it; mint never competes with it except for the single spending action.

**The Earth-for-Warmth Rule.** Earth is the only warm hue in the room and it stays small: the avatar, provider tags and the faint glow at the foot of the ground. It is never a button, a panel or text on the ground.

**The Ground Material Rule.** `ground-top`, `ground-foot`, `canopy`, `light` and the `ember` ramp exist to draw the scene behind the panels. They are never used as a panel fill, a control colour or text.

**The Dot-and-Word Rule.** Status is an 8px dot in the state colour with a 4px halo at 20%, followed by the word in the same colour at 600 weight. Pending is hollow, generating pulses, cancelled is dim. Tags carry the same hues at 16% fill for labels that are not statuses.

**The Lit Jack Rule.** A stop the signal has reached is lit, not recoloured: its ring and dot mix from white/30% toward the jack colour by `--lit`, its label from white/70% and its readout from white/54% toward white, and the light spills as a 4px ring at 14% and a 22px glow at 50%. Mint is the lit colour; the ask violet replaces it only while a stop waits on a human.

## Typography

**Display Font:** Urbanist (with ui-sans-serif, system-ui)
**Body Font:** Urbanist (same family)
**Label/Mono Font:** ui-monospace / SF Mono / Menlo / Consolas, for code, ids, `kbd` key caps and the `.data` / `.field-data` classes only

**Character:** One geometric humanist family carries every role, from the two-line hero headline and the footer wordmark that runs off the viewport to 12px labels and tabular cost readouts. Hierarchy comes from weight (400 body, 500 small, 600 controls, 700 headings and labels) and negative tracking that tightens as size grows (-0.025em at heading size, -0.03em on section and caption titles, -0.035em at display, -0.05em on the footer wordmark). Headings balance (`text-wrap: balance`), paragraphs wrap pretty.

### Hierarchy
- **Display** (700, `clamp(48px, 7.6vw, 118px)`, 0.94, -0.035em): the hero headline only, white, two lines ("Every AI call," / "visible."), each word sliding up from a clip; the last word in mint.
- **Footer wordmark** (700, `clamp(64px, 15vw, 260px)`, 0.85, -0.05em, white/9%): "Switchboard" as a decorative ground line at the foot of the landing, `aria-hidden`, clipped by the footer.
- **Headline L** (700, `clamp(36px, 5vw, 64px)`, 1.02, -0.03em): landing section headings ("What runs here.", "Under the hood.", "Run it yourself.").
- **Headline** (700, 36px to 48px, -0.025em): page headings inside the session (`PageHeading`) and the Generate greeting (second line in `ink-2`).
- **Caption title** (700, `clamp(30px, 3.3vw, 46px)`, 1.04, -0.03em, max 16ch): the five theatre captions ("A queue, not a spinner."). Sits between Headline L and Title L; it is the largest text that is not a section heading.
- **Title L** (700, 28px/34px): the empty-transcript greeting ("What's on your mind?"). **Title** (700, 18px/26px): pane titles, the signed-in session card, the spec sheet's terms (`dt`, 18px/28px, -0.025em); dialog titles step up to 22px/28px with a mint icon.
- **Lead** (400, 18px/32px, `ink-2`): section subs, theatre captions and the sign-in copy, capped at 34 to 44ch. The hero sub alone steps to 22px/36px from `sm` and is capped at 34ch.
- **Body** (400, 15px/24px): everything else; prose measures are capped at 60ch under headings, 64ch on the spec sheet's sentences (`ink-2`) and 68ch in the assistant transcript.
- **Small** (500 to 600, 14px/20px): chips, small buttons, statuses, table cells, legends, the "In flight…" caption. The patch bay steps below it: stop labels at 13px/600 on a 16px line (11px on phones) and readouts at 12px/600 tabular, both white-mixed by `--lit` rather than set in `ink-2` or `dim`.
- **Label** (700, 12px/16px, `dim`, sentence case): section labels inside glass ("Windows", "Recent", "Sources", "Providers"), the "Sample data" mark on the hero panel, tags, key caps. Never uppercase, never letter-spaced.
- **Readout** (700, `max(1em, 28px)`, 1, -0.02em, tabular): `.led`, the totals on Traces. `.num-tab` gives tabular figures at 600 for inline money, counts and step indices.

### Named Rules
**The One Family Rule.** Urbanist is the only display, body and label face. Monospace is reserved for literal data (ids, code, key caps, the MCP command, tool ids inside spec-sheet tags at 11.5px/500); it is never used for labels, readouts or hierarchy.

**The No Eyebrow Rule.** Section labels are 12px bold sentence-case in `dim`. There are no uppercase, tracked-out kickers anywhere in the shipped build, and none should be added. A small label under a jack (the patch bay) or a bold term beside a row (the spec sheet) names the thing it sits with; nothing small sits above a larger heading.

**The Caption Rule.** On the landing a feature is described by a caption title, one sentence of Lead and a row of tags; a spec-sheet row is a Title term, one sentence of Body and a row of tags. There are no paragraphs beside the panes; the pane itself is the explanation.

**The Tabular Money Rule.** Any number that sits in a column or updates live (cost, tokens, latency, spend) is set with tabular figures (`.num-tab`, `.tbl`, `.led`).

## Layout

The page is a `relative z-[1]` layer over a fixed `z-0` ground. Inside the session the shell is a floating glass sidebar 260px wide, inset 20px on top, left and bottom from `lg` up, with the content column offset by 300px; the `[` key (or the fold knob on the sidebar's right edge) folds it to an 84px icon rail with a 124px offset, remembered in `localStorage`. Below `lg` the sidebar becomes a strong-glass pill tab bar fixed 16px from the bottom edges (64px tall; the active tab expands into a white pill with its label). A sticky top row holds the Live chip, the Welcome chip and the 44px avatar. Gutters are 20px on phones, 32px from `lg` in the app and 40px from `lg` on the landing.

Windows compose as glass panes on a CSS grid: Generate is the prompt card beside a Queue pane, Gallery a 2/3/4-column tile grid, Traces stacks totals then tables. Inside a pane the header row is 24px horizontal padding with 20px top, the body 24px sides and bottom with 16px under the header; the `tight` variant drops to 20px/16px and `flush` panes let rows draw their own 12px gutters. Spacing steps are Tailwind's 4px scale, used mostly at 4, 8, 12, 16, 20, 24, 28, 32.

The landing is one column that opens as two from `lg`, in six beats separated by 112px on phones and 160px from `lg` (`pt-28` / `lg:pt-40`); every beat's content is capped at 1440px and centred (`mx-auto w-full max-w-[1440px]`), so on wider screens the gutters grow and the page does not:

- **Header:** three floating pills in a row (`px-5 py-4`, 40px gutters from `lg`, the row capped at 1440px), in normal flow on phones and `sticky top-0` from `md`.
- **Hero:** fills the viewport from `lg` (`min-height: calc(100dvh - 80px)`, content vertically centred), a grid of `11fr / 10fr` with a 56px gap (40px at `lg`); the headline column is capped at 720px, the hero panel at 880px. Inside the panel the patch bay sits under a white/8% hairline 28px below the controls row (36px from `sm`) with 24px above the jacks (28px from `sm`); its six stops are always six equal columns.
- **Theatre:** heading block capped at 640px, then a grid of `5fr / 7fr` with an 80px column gap from `lg` (32px below the heading at `lg`, 64px below). The caption column has 48px of padding top and bottom so the first and last captions line up with the stage before and after it sticks; each caption is a 78vh band with its text centred. The stage is sticky, `min(800px, 100dvh - 6rem)` tall, and its `top` is `(100dvh - stage) / 2` so it sits centred in the viewport. Below `lg` the captions stack 80px apart and each is followed by its pane 32px under the tags.
- **Spec sheet:** heading block capped at 640px, then a `<dl>` 48px below (64px from `lg`) ruled top by `line`, nine rows each ruled below with 24px vertical padding (28px from `lg`); from `lg` a row is `200px / 1fr` with a 40px column gap (term left, sentence and tags right), below it the term stacks over the text with a 12px gap. Tags wrap with a 6px gap 12px under the sentence.
- **Session:** a block capped at 1240px and left-aligned with the other sections, `7fr / 6fr` from `lg` with a 64px gap (48px below), the copy capped at 40ch beside the sign-in pane.
- **Footer:** a `line` rule with 32px above the row that holds the mark and wordmark on the left and the small buttons on the right (How it works, Under the hood, Repository, Top, Try the demo), then the display wordmark 40px below, pulled 0.18em past the bottom edge and clipped.

Breakpoints in use: `sm` 640px (larger hero panel paddings, 13px bay labels and all six bay readouts, the Welcome chip), `md` 768px (the nav pill, the sticky header), `lg` 1024px (sidebar replaces the tab bar, two-column landing sections and spec-sheet rows, the sticky stage).

## Elevation & Depth

Depth is material, but the material is dark and nearly opaque: panels sit over the ground at 74 to 96% and let only the light's colour, not its detail, through. Layering reads from three cues, in this order: the 1px light edge (white/12% at rest, white/14% on dark and solid panels, white/22% on hover), the inset 1px top highlight (white/12%), and one deep, soft drop shadow that sits well below the pane. Backdrop blur (18px at 1.2 saturation on `glass-blur`, 16px on `.popup`) is a property of the few floating surfaces, not of cards. The hero panel, which sits closest to the light, grades its edge from top to bottom (white/35% top, 14% sides, 6% bottom) and carries a brighter top highlight (28%), so it reads as lit from above. There are no hard offset shadows, no borders darker than the fill, and no drop shadows on text. The one lit glow on the landing is the patch bay's: a lit jack spills a 4px ring at 14% and a 22px glow at 50% of its colour, and the signal carries a 5px mint drop-shadow; that is light on a cord, not elevation.

### Shadow Vocabulary
- **Glass** (`box-shadow: 0 30px 80px -30px rgba(0,0,0,0.75), 0 2px 8px -2px rgba(0,0,0,0.4)`): every `.glass` pane at rest, plus the inset top highlight.
- **Lift** (`box-shadow: 0 40px 90px -30px rgba(0,0,0,0.85), 0 4px 12px -4px rgba(0,0,0,0.5)`): dialogs (`glass-solid`), popups and toasts.
- **Hero panel** (`box-shadow: 0 40px 90px -30px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.28)`): the hero prompt panel.
- **Jack glow** (`box-shadow: 0 0 0 calc(var(--lit) * 4px) color-mix(in srgb, var(--jack-on) 14%, transparent), 0 0 calc(var(--lit) * 22px) color-mix(in srgb, var(--jack-on) 50%, transparent)`): a patch-bay jack, growing from nothing as `--lit` rises; `--jack-on` is mint, or the ask violet on Approval while it waits. The signal itself carries `filter: drop-shadow(0 0 5px rgba(134,236,191,0.9))`.
- **Pill** (`box-shadow: 0 12px 30px -12px rgba(0,0,0,0.7)`): the active white nav pill in the sidebar and tab bar.
- **Knob** (`box-shadow: 0 6px 16px -6px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.12)`): the 26px sidebar fold knob.
- **Glow** (`box-shadow: 0 0 70px -10px rgba(134,236,191,0.4)`): the mint accent button only.
- **Primary lift** (`box-shadow: 0 14px 34px -14px rgba(255,255,255,0.45)`): the white primary button.
- **Active pane** (`box-shadow: 0 24px 60px -24px rgba(134,236,191,0.35)` with a 1px mint/30% ring): a `tone="active"` pane, such as the retrieval tester while it holds a result.
- **Earth** (`box-shadow: 0 8px 20px -10px rgba(181,136,95,0.7)`): under the avatar.

### Named Rules
**The Edge-First Rule.** A pane is defined by its 1px light edge and top highlight before its shadow. If a surface needs a heavier shadow to separate from its neighbour, raise its fill by one glass step instead.

**The Blur-Only-Over-Motion Rule.** Cards do not blur. `glass-blur` belongs to surfaces that float over scrolling or changing content: the two landing header pills, the phone tab bar, dialogs and popups. A resting card that needs more separation goes darker (`glass-strong`, `glass-dark`), never blurrier.

**The Dark Glass Rule.** Default panels are `glass` (74%). `glass-dark` (90%) is for surfaces that must read as a distinct object: the hero prompt panel, the MCP command tile, the user's transcript bubbles and `tone="ink"` panes. Do not mix both on adjacent siblings.

**The Lit-From-Above Rule.** Only the surface directly under the light (the hero panel) grades its edge brighter at the top than at the bottom. Panes in the session keep the uniform 12 to 14% edge.

## Shapes

Corners are large and defined, never bubbly: the radius scales with the element. Key caps 6px, tags 8px, small chips 10px, chips and small buttons 12px, buttons 14px, fields and the `lg` button 16px, popups 18px, inner cards and image wells 20px, command tiles and textareas 22px, panels 24px (the `.glass` default), the hero panel 26px, dialogs and the prompt textarea 28px. Pills (`999px`) are reserved for the landing header's logo and nav pills, the tab bar, tab lists, select triggers, the avatar, the Live chip, the patch bay's jacks, the sidebar fold knob and the stage ticks. The mark tile is a 30%-radius square holding an S-shaped patch cord between two jacks. Transcript bubbles are 24px with one 8px corner toward their speaker. Borders are always 1px translucent white; a dashed white/20% border marks drop zones and empty states. Panel fills are opaque enough that the ground shows only as colour. The stage's tick marks are 3px-wide pills that grow from 12px to 24px when active; the patch bay's jacks are 26px rings (1.5px stroke, a 12px dot inside) on one cord that sags 9px between stops, drawn in pixels for the measured width so the dashes never drift off the jacks.

## Components

Controls are glass rectangles with a light edge; the one you should press is white, the one that costs money is mint. Everything hovers by brightening its fill and rising 1px, and focuses with a 2px mint outline offset 2px.

### Buttons
- **Shape:** defined rounded rectangle (14px; 12px at `btn-sm`, 10px at `btn-xs`, 16px at `btn-lg`; `btn-round` for pills). 44px tall, 18px side padding, 15px/600 text, 18px icons. Sizes: xs 30px, sm 36px, lg 54px; `btn-icon` makes a square.
- **Primary:** solid white, ground text, the Primary lift shadow; hover cools to `#eefff7`. "Try the demo" / "Open session" (header, hero at `lg`, footer), "Back to session", "Approve", "Upload".
- **Accent:** solid mint, ground text, the mint Glow. Only Generate, Send and Add key. Disabled accent is a mint outline (40%) on a 10% mint fill with mint text, not faded, so the money action stays legible while empty.
- **Glass:** white/6% fill, white/16% edge; the default secondary ("See how it works", the footer links, "Deny"). **Ghost:** transparent, `ink-2` text, white/8% on hover, no lift; icon buttons in panes and the dialog close. **Danger:** error tint at 14% with error text. **Link:** mint underlined text.
- **Hover / Focus:** fill to white/14%, edge to white/20%, `translateY(-1px)` over 150ms; active returns to 0; disabled is 40% opacity. Focus is the global 2px mint outline.

### Chips
- **Style:** 36px glass toggles (30px `chip-sm`), 12px radius, `ink-2` 14px/600 text, 16px icon. Used for Image/Text, Enhance prompt, Size & seed, the landing nav (small, borderless and transparent inside the blur pill), the Live and Welcome chips, and as tab triggers inside a pill `TabsList` (white/6% fill, white/12% edge, 4px padding).
- **State:** active (`data-active`, `aria-pressed`, `data-state="active"`) is solid white with ground text; hover is white/12% with white text.
- **Tags:** 26px `tag` (12px/700, 8px radius, white/10% fill); the theatre's mechanism chips are the 28px `tag-lg` variant with 10px side padding, in the neutral tint only. The spec sheet uses the same 28px tag in four forms: neutral for facts, `tag-earth` for the provider names (OpenAI, Anthropic, Google), `tag-ask` for "needs approval", and a `font-data` 11.5px/500 form for tool ids (`search_documents`, `generate_image`).

### Cards / Containers
- **Corner Style:** 24px (`.glass` default); 20px for `.glass-inner` sub-cards, image wells and generation rows; 26px for the hero panel.
- **Background:** `glass` 74% (`glass-strong` 82%, `glass-dark` 90%, `glass-solid` opaque `ground-2`); `.glass-inner` white/5% with a white/9% edge for cards inside cards (usage meter, agent bubbles, trace cards, empty states, icon wells).
- **Shadow Strategy:** the Glass shadow plus inset top highlight; `.lift` adds the hover rise (2px over 180ms) and a brighter edge on gallery tiles.
- **Border:** 1px white/12%; white/14% on dark and solid; graded 35/14/6% on the hero panel; hover white/22%.
- **Internal Padding:** 24px (Pane header 24/20, body 24/16/24); tight 20/16; the prompt card 24 to 32px; the hero panel 24 to 36px; the signed-in session card 28px.
- **Pane tones:** `active` adds a mint ring at 30% and the Active pane glow, `ask` a violet ring at 40%, `err` an error ring at 40%, `ink` switches to `glass-dark`.
- **Signature layouts:** the Queue pane (flush 20px-radius rows with a 48px cover thumbnail, new rows slide in over 420ms), the transcript (user bubble `glass-dark` right-aligned at 78% max, agent bubble `glass-inner` beside a 30px mark tile, tool calls as 18px-radius white/8% frames), the ledger (`.tbl`: 40px dim bold header, 52px rows, hover rows tint white/5% with 12px end radii; stacked `glass-inner` cards on phones). The landing's five sample panes (Queue, Test retrieval, Conversation, Calls, Connect Claude Code) are these same components with a dim "Sample data" legend.

### Inputs / Fields
- **Style:** 48px tall, 16px radius, white/6% fill, 1px white/12% edge, inset top highlight, 15px text with `dim` placeholder, mint caret. `field-area` is a 22px-radius textarea; the prompt textarea is transparent at 28px with the Image/Text chips and the mint send tile inside its bottom edge; `field-sm` is 36px/12px; `field-data` switches to monospace.
- **Focus:** edge to mint/70% with a 4px mint ring at 18%, fill to white/9%.
- **Error / Disabled:** invalid gets an error edge and a 4px error ring at 16%; disabled drops to `dim` text on white/3%.
- **Selects:** pill triggers (44px, 36px small) in the same glass with a `dim` chevron; open state white/12% with a white/30% edge; the popup is `.popup` (96% brown-black, 16px blur, 18px radius, Lift shadow) with 40px items at 12px radius that highlight to solid white.

### Navigation
- **Sidebar (lg+):** glass pane, 34px mark tile plus wordmark, "Windows" label, six 48px links at 15px/600 in `ink-2` with 18px icons and a key cap on hover; the active link is a solid white pill (16px radius) with ground text, a forest-green icon and the Pill shadow. A 26px `ground-2` fold knob sits on the pane's right edge 30px from the top (white/16% edge, the Knob shadow; hovers to white and scales 1.08; its chevron turns 180deg over 220ms when collapsed). "Others" holds providers, keys and sign out (sign out hovers to error). The usage meter sits at the bottom as an inner card with a mint gradient bar (`accent-2` to `accent`); collapsed, the rail shows icons only, a hairline above "Others" and a compact meter.
- **Tab bar (below lg):** a `glass-strong glass-blur` pill fixed to the bottom; icons only, the active tab expands into a white pill with its label.
- **Landing header:** three floating pills. Left, the logo pill: `glass glass-strong glass-blur` at full radius, 4px padding with 16px on the right, holding a 30px mark tile and the 18px wordmark. Centre (from `md`), the nav pill: the same glass at 4px padding holding four borderless small chips ("How it works", "Under the hood", "Sign in" / "Session", "Repository"). Right, a white `btn-sm` ("Try the demo", or "Back to session" when signed in). From `md` the row is sticky at the top and slides up out of view (`translateY(-120%)`, 300ms on the standard curve) once the visitor has scrolled past 120px and is moving down by more than 4px; it returns on the first 4px of upward scroll or whenever the page is back within 120px of the top. On phones it is in normal flow and simply scrolls away.

### Dialogs
`glass-solid`: opaque `ground-2` with a white/14% edge, the Lift shadow, 28px radius and 28px padding, over a black/65% overlay. Enter and exit over 180ms with opacity and a 0.96 scale; the content stays mounted through the exit (`useLastDefined`). Title 22px/700 with a mint icon; description 14px in `ink-2`; a ghost icon close at top right.

### The Mark Tile (signature)
A 26 to 56px glass square at 30% radius (white/8% fill, white/16% edge, an 18% top highlight and a small soft shadow, no blur) holding the mark: one patch cord bent into an S between two jacks, drawn in a 32-unit box. The cord is a 2.4-unit mint stroke with round caps; the jacks are 2.6-radius discs filled `ground-2` with a 1.7-unit white stroke. It carries `data-live` whenever a generation or stream is running (the prompt form while loading, the chat while opening, the auth gate) and then a `light`-coloured signal dash runs down the cord once every 1.4s on `cubic-bezier(0.45, 0, 0.2, 1)`; the signal is hidden under reduced motion. The wordmark beside it is "Switchboard" in 700 tight tracking with a half-size `tag-accent` "AI" tag.

### The Ground (signature)
`.ember` is fixed, full-bleed, pointer-transparent and static: a drawn scene, layered back to front, that never repaints while the page scrolls.

1. **The field** (CSS on `.ember`): a radial of the light at top centre (`accent-2` at 34% through `ember` and `#2f8a60` to `#184e38`, fading out by 76% of a 66 x 52% ellipse), a faint earth glow low and left (`earth` at 20%, a 90 x 30% ellipse at 36% / 108%), and the vertical gradient from `ground-top` through `#0d100d` and `ground` (62%) to `ground-foot`.
2. **The raster** (`.photo`, optional): `client/public/art/ground.jpg` at 90%, cover-fit from the top centre, detected at runtime; when present the drawn scene drops to 55% so the two do not double. The directory currently holds no image.
3. **The scene** (`.scene`): an inline 1600 x 1000 SVG sliced to the viewport from the top centre (`xMidYMin slice`) so the light stays above the headline at every size. A fractal-noise mint haze (frequency 0.0019 x 0.0034, three octaves, blurred 26) masked to the upper half by a radial fade; nine light shafts fanning from an apex 300 units above the frame to feet across the floor (18 to 84 units wide, 38 to 95% opacity), filled top to bottom `light` 90% through `accent-2` 20% to `accent` 0% and blurred 11; and eighteen `#c8ffe6` dust discs at two depths, the eight soft ones blurred 2.5. Filter regions are pinned in user space inside the frame because Chrome drops a filter whose surface outgrows its texture limit.
4. **The canopy** (`.canopy`): eight `canopy`-coloured radial lobes from both top corners (98% at the corners, 85 to 96% for the smaller masses at 24%, 35% and 9% / 26% and their mirrors), the foliage silhouetted against the light and biting into the haze and the outer shafts.
5. **The sun** (`.sun`): a 44vw disc (max 640px) at `top: -18vh`, a radial from `light` at 90% through `accent-2` 62% and `accent` 36% to `ember-deep` 5%, gone by 68%.
6. **Vignette** (`::before`): an 84 x 74% ellipse at 50% / 36% clearing to `ground` at 50% and 86%, plus a bottom fade from 58%.
7. **Grain** (`::after`): a 160px fractal-noise tile at 9% in overlay.

`data-intensity="hero"` on the welcome page shows the scene as drawn. `"app"` inside the session flattens the field (light at 14%, earth at 12%, `#0b110e` to `#100d0a`), dims the scene to 42%, the canopy to 60%, the raster to 45%, and pulls the sun to 30% at `-32vh`, so the panels stay readable.

### The Hero Panel (signature)
A `glass-dark` panel (26px radius, graded edge white/35% top, 14% sides, 6% bottom, the Hero panel shadow, 24px padding rising to 36px from `sm`) showing a prompt at 19px/32px (26px from `sm`) with a blinking caret, a "Sample data" label in `dim` at 12px/700 pinned to its top-right corner, then a controls row: a `glass-inner` image chip, the 12-bar waveform captioned "In flight…" in `dim`, and a white arrow tile (52px at 16px radius, 64px at 18px from `sm`). Under the controls, below a white/8% hairline, the patch bay. The pointer tilts the panel up to 3deg on X and 5deg on Y on a soft spring (60/18); still under reduced motion. Nothing floats around or behind the panel.

### The Patch Bay (signature)
The request's route, patched under the prompt: six jacks on one cord, labelled Prompt, Queue, Worker, Approval, Trace, Result. The group is `role="group"` "How a request moves". A 26px-tall SVG holds the cord through the jack centres (mid-column of six equal columns, sagging 9px between stops; `cordPath` builds it in pixels from the measured width). Three paths share that geometry: the wire (white/14%, 2px), the trail (mint/55%, 2px, growing behind the signal) and the signal (a 3px `light` dash, 5% of the path, with a 5px mint drop-shadow). Under each jack, the stop's label (13px/600, 11px on phones) and its readout (12px/600 tabular: "image", "high · #1", "FLUX.1", "Approve?" then "approved", "$0.002 · 6.3 s", "1024 × 1024"); below `sm` only the Approval readout shows. Each stop owns `--lit` (0..1) and Approval also `--ask`; the jack ring and dot, the label and the readout all `color-mix` from their rest colour toward the lit one, so one keyframe per stop drives everything. At rest a jack is `ground-2` with a white/30% ring and dot, the label white/70%, the readout white/54%; lit, the ring and dot are mint with the Jack glow and the text is white. Approval's readout is two layers swapped by opacity ("Approve?" in `ask` while `--ask` is 1, "approved" as `--lit − --ask`), with one stable line ("waits for approval") for assistive tech.

This is the landing's authored moment: one 9s CSS loop on `cubic-bezier(0.4, 0, 0.2, 1)` per segment. The signal appears at 3% and leaves Prompt, docks at Queue (11%), Worker (19%) and Approval (28%), holds there until 50% with the jack in the ask violet (`--jack-on` mixes `ask` over mint by `--ask`) and "Approve?" showing, then runs on to Trace (58%) and Result (66%), holds lit to 88% and fades by 96%; each stop lights 1% after the signal arrives and every stop goes dark from 88 to 96%. Under `prefers-reduced-motion` nothing animates: the signal is hidden, the trail is drawn to Approval (60%), stops 1 to 4 are lit (`data-rest`) and Approval holds in the ask colour, so the still frame shows a request waiting on a human.

### The Theatre and the Stage (signature)
The landing's feature section shows one real pane at a time. Under "What runs here." and one Lead sentence, a `5fr / 7fr` grid from `lg`: on the left five captions, each a Caption title (max 16ch), one Lead sentence (max 34ch) and a row of `tag-lg` chips, centred in a 78vh band; on the right the stage, sticky and centred in the viewport (`min(800px, 100dvh - 6rem)` tall), holding the five sample panes (Queue, Test retrieval, Conversation, Calls, Connect Claude Code) stacked absolutely. The caption crossing the middle tenth of the viewport (an `IntersectionObserver` with -45% margins top and bottom) owns the stage; above the first or below the last, the nearest end owns it, so jumping back to the top never leaves the last pane up. Inactive panes are `inert` and hidden from assistive tech. The stage computes one scale for all five panes from the tallest (`min(1, stage / tallest)`, exposed as `data-scale` on `[data-testid=stage]`) and translates each pane to sit centred, so the stage keeps one width while it swaps and short laptop viewports see whole panes; it measures when the stage box resizes and after fonts load, never when a pane's content changes (expanding a row or folding a tool call does not rescale the stage), and a second observer refits only if a grown pane's foot would leave the viewport. Panes stay hidden until measured. Five tick marks sit 40px left of the stage, vertically centred: 3px-wide pills, 12px tall at white/24% at rest (white/60% on hover), 24px tall and solid white when active, animating height and colour over 200ms, each inside a 24px hit target; pressing one scrolls its caption to the centre (instantly under reduced motion). Below `lg` the stage is not mounted after hydration; each caption is followed by its pane, stacked 80px apart. The server renders both branches so the page is whole without JavaScript.

### The Spec Sheet (signature)
"Under the hood." (`#stack`, in the nav pill and the footer): a Headline L and one Lead sentence, then a `<dl>` ruled top by `line` with nine rows ruled below, each a Title term on the left (Included models, Your own key, Retrieval, Agent, Queue, Ledger, MCP, Evals, Stack) and, on the right, one Body sentence in `ink-2` capped at 64ch and a wrapped row of 28px tags. Facts only; the Stack row is tags alone. Neutral tags carry names and figures, `tag-earth` marks the provider a key belongs to, `tag-ask` marks the one tool that waits for a human, and tool ids sit in monospace. One `Reveal` lifts the heading and one lifts the whole sheet (60ms later); rows do not stagger.

### Motion
Entrances use `Reveal` / `Stagger` (spring: stiffness 420, damping 34, mass 0.8; 14px rise, opacity only, no scale; 50ms stagger after a 30ms lead; `inView` variants fire once at -80px). The hero words use a firmer spring (380/32/0.8), each sliding up 110% from behind a clip 45ms apart; the sub and actions follow at 350 to 450ms, the fact line fades in at 600ms, the hero panel rises 18px at 300ms. The stage swaps panes on a slower, heavier spring (300/34/0.9): the incoming pane comes to opacity 1 at rest, the outgoing one leaves at opacity 0, 28px up if it is earlier in the order or 28px down if later, and 0.985 scale; `initial={false}` so the first pane is simply there. The landing header hides and returns with a 300ms transform on `cubic-bezier(0.2, 0.8, 0.2, 1)`. The stage sets each pane's fit transform from a `ResizeObserver` without animating. The patch bay is the one authored loop: `bay-signal`, `bay-trail` and `bay-stop-1` to `-6` share a 9s `--bay-loop` on `cubic-bezier(0.4, 0, 0.2, 1)` and animate `stroke-dashoffset`, `stroke-dasharray` and the registered `@property` numbers `--lit` and `--ask`, which the jacks, labels and readouts mix their colours from. Other named keyframes: `reveal-row` (new queue rows, 420ms), `shimmer` (skeletons, 1.8s), `pulse-soft` (live dots, the caret at 1.2s), `wave` (12 bars, 1.1s), `mark-signal` (the cord pulse, 1.4s). Transitions are 150ms for buttons and the fold knob, 200ms for chips, fields and stage ticks, 180ms for lift and dialogs, 150ms for popups, all on `cubic-bezier(0.2, 0.8, 0.2, 1)` or ease-out; only transform and opacity move (ticks also move height). Under `prefers-reduced-motion` every CSS animation and transition collapses to 0.01ms, the springs render their final state (`initial={false}` or `duration: 0`), the cord signal is hidden, the patch bay rests with stops 1 to 4 lit and Approval in the ask colour, tick jumps scroll instantly and the pointer tilt is gated off.

## Do's and Don'ts

### Do:
- **Do** build every new surface as a `.glass` pane (or `Pane`) over the ground; never paint an opaque panel colour outside `glass-solid` dialogs.
- **Do** keep one solid mint fill per screen, on the action that spends money, and use white for the primary action everywhere else.
- **Do** express status as a dot and a word (`.status` / `Mark`) or a 16% tinted tag in the five state hues; the text is the same colour as the dot.
- **Do** set money, tokens and latency in tabular Urbanist (`.num-tab`, `.led`, `.tbl`); readouts are 700 weight at 28px or larger.
- **Do** scale the radius with the element: 14px controls, 16px fields, 20px inner cards, 24px panels, 28px dialogs.
- **Do** show the product with its own panes and labelled sample data; a landing caption is a title, one sentence and tags, and a spec row is a term, one sentence and tags.
- **Do** wrap entrances in `Reveal` / `Stagger`, animate only transform and opacity, and gate pointer motion on `useReducedMotion`. An authored loop (the patch bay) is CSS on registered custom properties with a designed rest state, not a spring.

### Don't:
- **Don't** add a light theme, a theme toggle or a second colour scheme; the world is one dark clearing.
- **Don't** introduce a second typeface, uppercase tracked labels or eyebrows; hierarchy is weight and size in Urbanist only.
- **Don't** use mint as a background, a text colour for prose, or on a control that does not spend money; don't use earth on anything but the avatar, provider tags and the ground's foot glow.
- **Don't** use the ground materials (`ground-top`, `ground-foot`, `canopy`, `light`, the `ember` ramp) on panels, controls or text.
- **Don't** put backdrop blur on cards; blur is for the landing header pills, the phone tab bar, dialogs and popups only.
- **Don't** use hard, offset or coloured drop shadows other than the mint Glow on the accent button, the Active pane glow, the earth shadow under the avatar and the tinted ring on a toned pane; depth is the 1px light edge and the soft Glass shadow.
- **Don't** return to the rejected registers: no terminal chrome (monospace UI, box-drawing, tmux-style frames), no pastel aurora fills or playful gradients on panels, no orange or coral; no bento of tiles with paragraphs on the landing.
- **Don't** animate the ground; it is static so that nothing behind the panels repaints.
