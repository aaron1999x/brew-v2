# Design brief: [App] (working name)

For: the designer · From: Aaron · 12 Nov 2026

This brief lists what the design system needs to contain so it can be turned straight into code (CSS custom properties and components) by the build team. Please read sections 1–2 for context, then deliver sections 3–8.

---

## 1. The product in one paragraph

A mobile-first web app (installable to the phone's home screen) for serious home coffee brewers. People keep their brew recipes, track every version as they dial in a new coffee, brew with a step-by-step guided timer, log how each cup tasted (sliders and a radar chart), and share recipes with friends. A **Verified** section lists recipes from brewers our moderators have verified. Later: community features (explore, follow, upvote) and a competition prep mode.

**Positioning:** *the brew journal where recipes evolve: every version, every brew and what changed.*

## 2. Who uses it and where

| | |
|---|---|
| **Main user** | Serious home brewer, 20–40, owns a scale, gooseneck kettle and good grinder. Detail-oriented, enjoys numbers, shares on Instagram and chat |
| **Where** | At a brew bar or kitchen counter, phone propped up or held in one hand, often early morning, sometimes low light, sometimes bright window light |
| **During brewing** | Hands busy (kettle in one hand). The guided timer must be **readable at arm's length (~60–80 cm) at a glance**: big digits, the next pour's target weight and time obvious, minimal clutter |
| **After brewing** | Sitting with the cup, scoring taste on sliders and writing notes. Calm, focused, more reading than glancing |
| **Feel we want** | Precise and crafted, warm rather than clinical, confident with numbers. Not a generic fitness-app look, not a coffee-shop cliché (no beans-and-steam illustrations everywhere) |

Brand name is still a placeholder; see section 9.

---

## 3. Brand direction (light touch)

- 2–3 mood directions with keywords and a sample screen each, for Aaron to pick one.
- Logo / wordmark (a simple placeholder wordmark is fine until the name is final).
- App icon: 1024 px master, plus maskable version (safe zone for circular crops). We'll export 512, 192 and favicon sizes.

## 4. Foundations, delivered as design tokens

Please build these as **Figma Variables** (or Tokens Studio) with two modes, **Light** and **Dark**, and export as JSON. Names should describe purpose (semantic), not appearance: `color.text.primary`, not `color.gray.900`.

| Token group | What we need |
|---|---|
| **Colour: primitives** | The raw palette (neutrals, brand accent, status hues) |
| **Colour: semantic** | Background, surface (2–3 levels), text (primary, secondary, muted, on-accent), border (subtle, strong), accent (default, hover, pressed), focus ring, status (success, warning, danger, info), **"changed" highlight** (used to mark fields that changed between recipe versions), selection, overlay/scrim |
| **Colour: charts** | 3 series colours for overlaying up to 3 brews on a radar chart (must be told apart by people with colour-blindness), grid and axis colours, a target-range band colour |
| **Typography** | Font family/families (must have a web licence; variable fonts preferred; **tabular numerals required** for timers and data). Type scale with size, line height, weight, letter spacing for: display, h1–h3, body, body-small, label, caption, **numeric-large** (stats), **timer** (very large digits) |
| **Spacing** | Scale on a 4 px base (e.g. 4, 8, 12, 16, 20, 24, 32, 40, 48, 64) |
| **Radius** | Small, medium, large, full (pill) |
| **Elevation** | 2–3 shadow levels for light mode, and how elevation shows in dark mode (usually lighter surfaces rather than shadows) |
| **Borders** | Widths (hairline, default, focus) |
| **Motion** | Durations (fast, normal, slow) and easing curves; what each component does when the user has **reduced motion** turned on |
| **Breakpoints** | Phone (base, designed at 390 px), tablet (≥ 768 px), desktop (≥ 1024 px) |
| **Icons** | One icon set (open-source licence preferred, e.g. Lucide or Phosphor), sizes and stroke weight |

## 5. Components, with every state

For each component: variants, and the states **default, hover, pressed, focus-visible, disabled**, plus **loading, error, selected** where they apply. Light and dark.

| Group | Components |
|---|---|
| **Actions** | Button (primary, secondary, ghost, destructive; sizes S/M/L), icon button, **centre Brew button** in the tab bar |
| **Inputs** | Text field, **number field with unit suffix** (g, °C/°F, ml, s), textarea (auto-grow), select, **search/autocomplete combobox** (for picking gear), **time input m:ss**, **slider 0–10 in 0.5 steps** (for taste scores), switch, checkbox, radio, segmented control |
| **Selection** | Filter chips, flavour tag chips (selectable + "add your own") |
| **Badges** | Verified badge, visibility (private / public / hidden), version label (v1, v2…), sync status (saved / waiting to sync / offline), "changed" pill |
| **Cards & lists** | Recipe card (name, author + verified badge, method, key numbers, version, counts), brew card (date, recipe, overall score, mini radar), stat tile, list row, notice item (read / unread) |
| **Navigation** | Bottom tab bar (5 items, centre action), top bar (with back, title, actions, notices bell + unread badge), desktop top bar / left rail, version switcher |
| **Overlays** | Bottom sheet (phone), modal dialog (desktop), confirm dialog (incl. destructive), toast, sign-up prompt sheet |
| **Feedback** | Empty state (icon/illustration slot, title, text, action), skeleton loading, offline banner, form error summary (top of form) + inline field error |
| **Recipe-specific** | **Steps editor row** (step type: pour, wait, swirl, stir, press, other; time; target weight; optional temperature and technique; reorder; delete), key-numbers strip (dose, water, ratio, temp, grind, expected volume), **version compare row** (old → new with "changed" highlight), credit line ("Copied from @user's recipe") |
| **Profile** | Profile header (photo, name, handle, verified badge, experience level, bio, favourite gear, stats row) |

## 6. Key screens

Phone at **390 px** unless noted. **Light and dark** for the ones marked ◑.

1. Home (new user with "Finish your profile" card, and returning user)
2. Recipe page ◑: owner view and logged-out visitor view; also one **desktop** layout
3. Recipe editor including the steps editor
4. **Guided timer** ◑: prep, count-in (5-4-3-2-1), running with next-step cue, paused, finished ("Drawdown done")
5. Brew log form (results, sliders + live radar, flavour tags, notes)
6. Brew detail
7. Version compare
8. Verified tab
9. Profile (own and someone else's)
10. Sign up, log in, one onboarding step
11. Three empty states and the offline banner in context

Wireframe level is fine for 6–11 if time is tight; 2, 4 and 5 need full fidelity.

## 7. Charts

- **Radar chart** with 8 axes (sweetness, acidity, brightness, body, clarity, balance, aftertaste, overall), scale 0–10. Single brew and up to 3 overlaid. Overlays must be distinguishable **without relying on colour alone** (e.g. line style or markers plus a legend).
- **Pour curve**: water weight (g) over time (s), with markers for non-pour steps (swirl, wait) and an optional target drawdown band.
- (Nice to have) Line chart for overall score over time, and a scatter chart with a target box (TDS vs extraction).

## 8. Accessibility requirements (must pass)

Target: **WCAG 2.2 AA** in both light and dark modes.

| Rule | Requirement |
|---|---|
| Text contrast | ≥ 4.5:1 for body text; ≥ 3:1 for large text (≥ 24 px, or ≥ 18.66 px bold) |
| Non-text contrast | ≥ 3:1 for icons, input borders, focus rings, chart lines and slider tracks against their background |
| Focus | A clearly visible focus style on every interactive element; never hidden behind sticky bars or sheets |
| Target size | WCAG minimum is 24 × 24 px; **we want 44 × 44 px for all primary controls** (brew bar use, one hand) |
| Colour alone | Never the only way to show meaning (status, changed fields, chart series) |
| Motion | Every animation has a reduced-motion alternative |
| Text resize | Layouts hold up at 200% text size |
| Timer | Digits readable at arm's length; current vs next step distinguishable at a glance |

## 9. Handoff format

- **Figma file** with: Variables (Light/Dark modes), components with variants and states, the screens above, and a cover page explaining naming.
- **Token export** (JSON) from Figma Variables or Tokens Studio.
- A short notes page: font licence, icon set and licence, any rules not obvious from the file.
- If Figma isn't available: a PDF spec with every token value (hex, px) and component state is acceptable.

**Not needed:** marketing website, detailed illustrations, native iOS/Android specs, animation prototypes beyond the motion tokens.

## 10. Open items for the designer and Aaron

- **Product name** (affects logo and icon). Until then, use a placeholder wordmark.
- Any brand colours Aaron wants to keep or avoid.
