# BLOOM — Codebase handoff

Snapshot of the repository as of **12 Nov 2026** (`main` @ `c1050b1`), written for a product-planning project that will turn BLOOM into a multi-user app. It describes what exists in the code today, not what was planned. Live single-user deployment: https://summit.atys.dev.

---

## 1. Overview

BLOOM is a single-user practice dashboard built by one competitor (Aaron) for the CAFEC Malaysia Brewers Cup 2026 (27 Nov 2026, Parc Subang Jaya). It stores reusable pour-over **recipes** (with versions), logs practice **brews** that snapshot a recipe and record results, sensory scores and notes, and groups brews into **practice days** with an end-of-day conclusion. A dashboard shows a live countdown, bean budget and trend charts. A full-screen **rehearsal timer** runs the 6-minute competition clock with step cues. Data is kept in the browser (localStorage) and synced to one Google Sheet through a Google Apps Script web app, protected by a single shared token.

---

## 2. Stack

| Layer | What's used |
|---|---|
| Framework | React **18.3.1** (function components, hooks, context), Vite **5.4.21** + @vitejs/plugin-react **4.7.0** |
| Language | TypeScript **5.6.3** (`strict`, `noUnusedLocals`, target ES2022), no JS source files |
| Styling | Tailwind CSS **3.4.19** (PostCSS **8.5.32**, Autoprefixer **10.6.2**), plus one global stylesheet `src/index.css` |
| Animation | Framer Motion **11.18.2** |
| Charts | Recharts **2.15.4** |
| Dates | date-fns **4.4.0**, date-fns-tz **3.2.0**; all display times use `Asia/Kuala_Lumpur` |
| Routing | Custom ~30-line hash router (`src/lib/router.ts`), URLs like `#/brews/<id>` |
| State | One React context (`StoreProvider`), no external state library |
| Backend | Google Apps Script web app (`apps-script/Code.gs`) over one Google Sheet |
| Hosting | Vercel (static build from GitHub `aaron1999x/Brew-Recipe`, `main` auto-deploys); no `vercel.json` (hash routing needs no rewrites). `public/_redirects` exists for Netlify but isn't used on Vercel |
| Fonts | Bricolage Grotesque from Google Fonts (variable: opsz, wdth, wght), system font fallback |
| Tooling | `npm run build` = `tsc --noEmit && vite build`; no linter config, formatter config, tests or CI in the repo. Developed on Node 18.18 |

Versions are the installed versions (`npm ls`); `package.json` uses caret ranges (`typescript` uses `~`).

**Environment variables** (Vite, compiled into the client bundle at build time):

| Name | Purpose |
|---|---|
| `VITE_GAS_URL` | Apps Script web app `/exec` URL. If empty, the app runs in "Local only" mode |
| `VITE_GAS_TOKEN` | Shared secret sent on every request; must equal the `API_TOKEN` Script Property |

Server side: one Apps Script **Script Property**, `API_TOKEN`.

---

## 3. File structure

```
.
├── apps-script/Code.gs        Apps Script backend: doGet (list), doPost (upsert/delete), token check, LockService, last-write-wins
├── docs/
│   ├── SETUP.md               Run/deploy guide (Sheet, Script Property, Vercel)
│   └── screenshots/           7 PNGs used by README (demo data only)
├── public/
│   ├── rules.pdf              Official competition rules (shown on the Rules page)
│   ├── favicon.svg            Teal flower mark
│   └── _redirects             SPA fallback for Netlify (unused on Vercel)
├── src/
│   ├── main.tsx               React entry
│   ├── App.tsx                Providers, global nav (desktop bar + phone tab bar), route switch, "N" shortcut
│   ├── index.css              Tailwind layers, base styles, flip-card CSS, slider/date-input fixes, reduced-motion rules
│   ├── types.ts               All data types (Recipe, Brew, Step, PracticeDay, Settings, BeanEntry, …)
│   ├── data/
│   │   ├── api.ts             fetch wrappers for the Apps Script endpoints (GET list, POST op), 20 s timeout
│   │   └── store.tsx          StoreProvider: localStorage cache, optimistic writes, retry queue, LWW merge, import
│   ├── lib/
│   │   ├── calc.ts            Ratios, EY, ≥150 mL check, day numbering, auto titles, spec diffing, bean usage
│   │   ├── steps.ts           Brew-step helpers (kind, pour temps, derived bloom, totals, signatures)
│   │   ├── defaults.ts        Starter recipe, 5 champion templates, dropdown lists, default settings, sensory keys
│   │   ├── demo.ts            Demo data (1 recipe, 4 brews, 2 days)
│   │   ├── export.ts          JSON export, CSV export (brews), JSON import parsing
│   │   ├── router.ts          Hash router (useRoute, navigate)
│   │   └── time.ts            KL-timezone formatting/parsing helpers, m:ss helpers
│   ├── components/
│   │   ├── ui.tsx             UI kit: Card, Button, Field, inputs, Switch, Badge, Modal, Confirm, Toast, CountUp, Stat, Empty
│   │   ├── Header.tsx         Event header, flip-clock Countdown, CompactCountdown, SyncIndicator
│   │   ├── FlipClock.tsx      Split-flap FlipCard / FlipUnit
│   │   ├── charts.tsx         SensoryRadar, PourCurve, TempGauge, chart colour/axis tokens
│   │   ├── SpecEditor.tsx     Recipe/brew spec form: coffee, equipment, params, StepsEditor, WaterCalc, targets
│   │   ├── SpecView.tsx       Read-only spec with "changed vs recipe" highlighting
│   │   ├── Beans.tsx          Discard log modal, two-segment bean bar, discard list
│   │   ├── SettingsPanel.tsx  Settings modal + export/import/demo-data buttons
│   │   └── icons.tsx          Inline SVG line icons
│   └── pages/
│       ├── Dashboard.tsx      Practice stats, bean budget, key rules, 3 trend charts
│       ├── Recipes.tsx        Recipe list/cards, champion templates, recipe editor, versioning helpers
│       ├── Brews.tsx          New/edit brew form, brew detail, computed results panel
│       ├── Compare.tsx        2–3 brew comparison (radar overlay + diff table)
│       ├── Days.tsx           Practice-day timeline with auto-saving notes
│       ├── Timer.tsx          Rehearsal timer (prep/comp clocks, count-in, step cues, audio/vibration)
│       └── Rules.tsx          PDF viewer + key rules
├── index.html                 Shell, meta, Google Fonts link
├── tailwind.config.js         Design tokens (colours, fonts, shadows, radius)
├── vite.config.ts             React plugin; chunk-size warning raised to 1200 kB
├── tsconfig.json              Strict TS config (single project, includes src + vite config)
├── README.md                  Portfolio README (features, screenshots, original prompt)
└── .env.example               Blank template for the two env vars
```

Roughly 5,100 lines of TypeScript/TSX plus about 160 lines of Apps Script.

---

## 4. Features

Status key: **done** = implemented and exercised in a browser; **partial** = works with notable gaps; **not started**; **broken**.

| Feature | Status | Main files | Notes |
|---|---|---|---|
| Header + countdown | done | `Header.tsx`, `FlipClock.tsx`, `App.tsx` | Event title, venue, date and competitor (linked to a URL) are editable in Settings. Split-flap countdown (days/h/m/s) in the Overview header; compact text countdown in the sticky nav on every page. The full header shows only on Overview; other pages show a one-line summary |
| Sync status indicator | done | `Header.tsx` (`SyncIndicator`) | Saved / Syncing / Offline (+ queued count) / Local; click to force a pull |
| Settings | done | `SettingsPanel.tsx` | Header fields, event time, bean budget, default recipe, competitor link; data tools |
| Recipes: list/create/edit/duplicate/delete | done | `Recipes.tsx`, `SpecEditor.tsx` | Confirm on delete. Deleting a recipe leaves brews intact (they hold snapshots) |
| Recipe versioning | done | `Recipes.tsx` (`nextVersion`, `duplicateRecipe`) | Versions share a `lineageId`; "Save as vN" and "Promote to new recipe version" (from a brew). Version history list per lineage. No diff view *between* versions |
| Champion templates | done | `defaults.ts` | 5 hard-coded, read-only templates (Kasuya, Chad Wang, Winton, Medina, Sherry Hsu). Not stored in the Sheet; "Duplicate" creates an editable copy. Grind settings and drawdown windows are estimates |
| Brew steps (pours + swirl/stir/wait/other) | done | `steps.ts`, `SpecEditor.tsx` (`StepsEditor`) | Cumulative scale targets, optional rate, "+X g this pour" hint, per-pour temperature behind a "Vary temperature by pour" switch. Bloom grams/time are derived from the steps. Warning if the last pour ≠ brew water |
| Brew logging (new/edit/detail) | done | `Brews.tsx` | Snapshot + baseline of the recipe, "tweaks vs recipe" diff, auto title "Day N · Wed 11 Nov · 21:35" (editable), results, notes, flavour tags |
| Computed results | done | `calc.ts`, `Brews.tsx` (`ComputedPanel`) | Brew ratio, overall ratio (incl. bypass), EY = TDS × final ÷ dose, TDS/EY/drawdown vs targets, ≥150 mL badge (warn < 175 g) |
| Sensory sliders + radar | done | `Brews.tsx`, `charts.tsx` (`SensoryRadar`) | 8 attributes, 0–10 in 0.5 steps, live radar |
| Flavour tags | done | `Brews.tsx` (`FlavourTags`) | 11 presets + free text |
| Temperature gauge | done | `charts.tsx` (`TempGauge`) | Animated thermometer, 80–100 °C scale. The roast-level temperature hint was removed on purpose |
| Pour curve | done | `charts.tsx` (`PourCurve`) | Water vs time from pours, non-pour steps as markers, target drawdown lines, logged drawdown line |
| Dashboard charts | done | `Dashboard.tsx` | Grind vs drawdown scatter (target band), overall score over time, TDS vs EY control chart (target box). Grind is parsed as the first number in the grind string |
| Compare | done | `Compare.tsx` | Pick up to 3 brews (selection in URL), overlaid radar, side-by-side table with differing rows highlighted |
| Practice days | done | `Days.tsx` | Timeline by KL date; brews and discards per day; auto-saving conclusion + next-session plan; auto-growing text areas |
| Rehearsal timer | done | `Timer.tsx`, `FlipClock.tsx` | 6:00 competition clock (optional 3:00 prep), split-flap digits, 5 s count-in before the brew clock, next-step cue, kettle-switch cue, beeps (soft pip for non-pours), vibration, wake lock, "Drawdown done" → prefilled new brew, "Another extraction". Beeps depend on Web Audio being unlocked by a tap |
| Water calculator | done | `SpecEditor.tsx` (`WaterCalc`) | Aquacode concentrate (590 ppm stock) + distilled water per 1 L from the recipe's ppm. Read-only (follows the ppm field) |
| Bean budget | done | `calc.ts` (`beanUsage`), `Beans.tsx`, `Dashboard.tsx` | Budget − brew doses − logged discards. Discard log (grams, reason, time, note) is stored inside the Settings record |
| Rules page | done | `Rules.tsx`, `public/rules.pdf` | Inline `<object>` PDF viewer, open/download buttons, key-rules card (also on Overview). Inline PDF rendering depends on the browser (iOS shows limited inline support) |
| Export / import | partial | `export.ts`, `SettingsPanel.tsx`, `store.tsx` | JSON export of everything; CSV export covers **brews only** (no recipes, days or discards); JSON import merges by id and restamps `updatedAt` to now, so imported records always win |
| Demo data | done | `demo.ts` | "Load demo data" button. When a backend is configured, demo records are **also pushed to the Sheet** |
| Sync / offline | partial | `store.tsx`, `api.ts`, `Code.gs` | Works for one user on a few devices. See §5 and §8 for conflict and queue limitations |
| Keyboard shortcut N | done | `App.tsx` | Ignored while typing in inputs |
| Empty states, confirm-before-delete, toasts | done | `ui.tsx`, pages | |
| Responsive / phone layout | done | all | Bottom tab bar on phone; tested in headless Chrome at 390 px. iOS-specific fixes (date inputs, text areas) not yet verified on a device |
| Dark mode | not started | — | App is light-only (`color-scheme: light`). An earlier dark theme was replaced |
| Tests | not started | — | No unit, integration or e2e tests in the repo |

---

## 5. Data model

All types are in `src/types.ts`. IDs are client-generated strings: `<prefix>-<base36 time>-<random>` (`uid()` in `calc.ts`). Timestamps are ISO 8601 UTC strings; "local" dates (`PracticeDay.date`, `Settings.eventDateTime`) are Kuala Lumpur wall-clock strings.

### Common
`BaseEntity { id: string; updatedAt: string; deleted?: boolean }`

### Recipe (`recipes`)
| Field | Type | Notes |
|---|---|---|
| id, updatedAt, deleted | BaseEntity | |
| name | string | |
| lineageId | string | shared by all versions |
| version | number | 1, 2, 3… within a lineage |
| notes | string | |
| createdAt | string (ISO) | |
| champion | boolean? | true only for built-in templates (never stored) |
| tags | string[]? | e.g. `["Champion"]` |
| coffee | Coffee | name, origin, process, varietals, altitude, roaster, roastLevel (`'Light' \| 'Medium-light' \| 'Medium'`), roastDate (yyyy-MM-dd), agtron (number \| null)? |
| equipment | Equipment | dripper, paper, grinder, kettle, scale (strings) |
| params | BrewParams | doseG, brewWaterG, bypassG, tempC, varyTemp?, grindSetting (string), waterPpm, bloomG, bloomTimeS (derived from steps) |
| pourSchedule | Step[] | brew steps; name kept for compatibility |
| targets | Targets | drawdownMinS/MaxS, tdsMin/Max, eyMin/Max (numbers) |

**Step**: `timeS: number; kind?: 'pour'|'swirl'|'stir'|'wait'|'other'` (missing = pour); `targetWeightG: number` (cumulative scale weight, pours only); `rateGps?: number|null; tempC?: number|null` (pours, used when `varyTemp`); `durationS?: number|null; label?: string` (non-pour / "other"); `technique: string`.

### Brew (`brews`)
| Field | Type | Notes |
|---|---|---|
| id, updatedAt, deleted | BaseEntity | |
| recipeId | string | may point at a deleted recipe or a champion template id |
| dateTime | string (ISO) | |
| title, customTitle | string, boolean | when `customTitle` is false, the title shown is recomputed from the day number |
| spec | RecipeSpec | editable snapshot (coffee, equipment, params, pourSchedule, targets) |
| baseline | RecipeSpec | the recipe as it was when the brew was created; used for diffs |
| results | `{ drawdownS, beverageG, finalG, tdsPct }` | all `number \| null` |
| sensory | 8 numbers (0–10) | sweetness, acidity, brightness, body, clarity, balance, aftertaste, overall |
| flavours | string[] | |
| whatITweaked, feedback | string | |
| createdAt | string (ISO) | |

Each brew stores two full recipe specs, so a brew is roughly 2–4 KB of JSON.

### PracticeDay (`days`)
`id` (`day-<yyyy-MM-dd>`), `date` (yyyy-MM-dd, KL), `endOfDayConclusion`, `nextSessionPlan`, plus BaseEntity. Brews aren't linked; they're grouped by `dateKey(brew.dateTime)` at render time. Day numbers ("Day 3") are the brew's index among distinct brew dates, computed on the fly.

### Settings (`settings`, single record with id `"settings"`)
`title, venue, eventDateTime` (yyyy-MM-ddTHH:mm, KL), `competitor, competitorUrl?, beanBudgetG, defaultRecipeId | null, beanLog?: BeanEntry[]` (each entry: `{ id, dateTime, grams, reason, note }`), plus BaseEntity.

### Storage

**Browser (localStorage):**
- `brewlab:db:v1`: the whole DB including tombstones (`{ recipes, brews, days, settings }`). The key prefix predates the "Bloom" rename.
- `brewlab:queue:v1`: pending write operations `{ opId, action, entity, data }`.

**Google Sheet:** one tab per entity (`recipes`, `brews`, `days`, `settings`), created on first write. Columns:

| A `id` | B `updatedAt` | C `deleted` | D `title` | E `date` | F `overall` | G `json` |
|---|---|---|---|---|---|---|

Column G holds the full object as JSON and is the source of truth. D–F are human-readable copies written by the server (recipe name + version, brew title/date/overall, day conclusion excerpt, settings title/event). Columns A–B are formatted as plain text so ISO strings compare correctly.

### Sync algorithm (`src/data/store.tsx`)
1. **Startup:** state loads from the localStorage cache (or seeds the starter recipe + default settings), then `GET ?action=list` pulls every row of every tab.
2. **Merge:** per entity, per id, last-write-wins by string comparison of `updatedAt`. Records with a pending queued write are never overwritten by the pull. Settings merge as one whole object.
3. **Writes are optimistic:** applied to state immediately, stamped `updatedAt = now` (client clock), then queued. A newer op for the same entity/id replaces the older queued one.
4. **Flush:** ops are POSTed one at a time in order. On any failure the status turns "Offline" and flushing stops.
5. **Retries:** every 15 s while the queue is non-empty, on the browser `online` event, and when the tab becomes visible (which also triggers a full pull).
6. **Deletes** are soft: a tombstone (`deleted: true`) is written and synced; nothing is purged.
7. **Server-side LWW:** `doPost` ignores a write whose `updatedAt` is older than the stored row's.

---

## 6. Design system as built

Tokens live in **`tailwind.config.js`** (colours, fonts, shadows, radius), **`src/index.css`** (base styles, flip-card CSS variables, slider and date-input styling) and **`src/components/charts.tsx`** (chart colours: `SERIES`, `ACCENT`, `GRID`, `AXIS`, `tooltipStyle`). The visual direction is a clean, Apple-inspired light UI.

**Colours** (Tailwind names):

| Token | Value | Use |
|---|---|---|
| `mist-950` | `#F5F5F7` | page background, inset panels |
| `mist-900` / `mist-850` | `#FFFFFF` | cards |
| `mist-800` | `#EFEFF2` | hover fills, tracks, secondary buttons |
| `mist-700` | `#E5E5EA` | hairline borders/dividers |
| `mist-600` | `#D2D2D7` | input borders |
| `mist-500` | `#AEAEB2` | muted dots |
| `ink` / `ink-muted` / `ink-faint` | `#1D1D1F` / `#6E6E73` / `#86868B` | text |
| `accent` / `-soft` / `-deep` | `#007A87` / `#006D79` / `#00636E` | primary teal (matched to the CAFEC Flower dripper); 5.1:1 with white |
| `flag` / `-soft` / `-deep` | `#F08C00` / `#B25E00` / `#8F4A00` | "changed vs recipe", discards, kettle-switch cue |
| `ok` / `warn` / `bad` | `#248A3D` / `#B25E00` / `#D70015` | status |
| Chart series A/B/C | `#0094A3` / `#E8590C` / `#7048E8` | Compare overlays (checked for colour-blind separation on white) |
| Flip cards | `#1D1D1F` (default), accent, bad | CSS vars `--flip-bg/--flip-fg` in `index.css` |

**Fonts:** `display`, `sans` and `mono` all map to Bricolage Grotesque, then the system stack (-apple-system, SF Pro, Helvetica Neue, Arial). Numbers use `font-variant-numeric: tabular-nums` (`.num` / `.font-mono`). `.font-display` = weight 600, letter-spacing −0.02em.

**Type scale (as used):**
- 11–13 px: labels, captions.
- 15 px: body, inputs and buttons.
- `text-xl`: card titles.
- `text-4xl`/`5xl`: page titles.
- `32px`/`text-5xl`: Overview title.
- `text-3xl`/`4xl`: stats.
- 34/48 px: header countdown.
- 19vw/136 px: timer clock.
- 18vw/140 px: next-pour weight.

**Spacing and layout:** Tailwind default scale. Container `max-w-7xl` with `px-4 sm:px-6`; cards `p-5 sm:p-7`; grid gaps mostly `gap-5`. Sticky nav 56/64 px; phone tab bar 68 px fixed; sticky save bars sit above the tab bar.

**Radius:**
- Cards and modals: `rounded-3xl`.
- Inputs: `rounded-xl`.
- Inset panels: `rounded-2xl`.
- Buttons, badges, chips: `rounded-full`.
- Flip cards: 0.14em.

**Shadows:** `shadow-card` (`0 1px 2px rgba(0,0,0,.04), 0 8px 28px rgba(0,0,0,.05)`), `shadow-glow` (4 px teal ring).

**Motion:**
- Cards fade and slide in (Framer, 0.45 s, ease `[0.22, 1, 0.36, 1]`, staggered `delay`).
- Page transitions 0.25 s.
- `CountUp` numbers run for 1.1 s.
- Split-flap flips are 2 × 0.28 s.
- Recharts draw-in takes 0.8–1.6 s.
- The thermometer uses a spring.
- Toasts and modals slide in.
- `prefers-reduced-motion` is respected via `<MotionConfig reducedMotion="user">`, chart `isAnimationActive`, and a CSS override that collapses transitions.

**Reusable components** (`src/components/ui.tsx` unless noted):
- **Layout and text:** `Card` (title, action, delay), `PageTitle`, `Stat`, `CountUp`, `Empty`.
- **Buttons and badges:** `Button` (primary / outline / ghost / danger / quiet-danger; sm/md/lg), `Badge` (neutral / accent / ok / warn / bad / flag).
- **Form controls:** `Field` (label, hint, "changed" pill), `TextInput`, `NumberInput`, `Select`, `TextArea` (auto-grows), `Switch`.
- **Overlays:** `Modal` (bottom sheet on phone), `ConfirmProvider`/`useConfirm`, `ToastProvider`/`useToast`, `cx` class helper.
- **Elsewhere:**
  - `FlipCard`/`FlipUnit` (`FlipClock.tsx`)
  - `SensoryRadar`, `PourCurve`, `TempGauge` (`charts.tsx`)
  - `SpecEditor`, `StepsEditor`, `WaterCalc` (`SpecEditor.tsx`)
  - `SpecView`
  - `BeanLogModal`, `BeanBar`, `BeanLogList` (`Beans.tsx`)
  - `Countdown`, `CompactCountdown`, `SyncIndicator` (`Header.tsx`)
  - line icons (`icons.tsx`)

---

## 7. Backend (`apps-script/Code.gs`)

Deployed as a web app: **Execute as: Me, Who has access: Anyone**. Every response is `ContentService` JSON with HTTP 200; errors are signalled in the body, not the status code.

### `GET <exec URL>?action=list&token=<token>`
Response: `{ ok: true, data: { recipes: object[], brews: object[], days: object[], settings: object[] }, serverTime: string }`. The arrays are the parsed `json` column of every row, **including soft-deleted rows**; malformed rows are skipped. Any other `action` → `{ ok: false, error }`.

### `POST <exec URL>`
Sent as `Content-Type: text/plain;charset=utf-8` (a "simple" request, so no CORS preflight, which Apps Script can't answer). Body (JSON string):
```json
{ "action": "upsert" | "delete", "entity": "recipes" | "brews" | "days" | "settings", "data": { "id": "...", "updatedAt": "...", "...": "..." }, "token": "..." }
```
Behaviour: validates the token, takes `LockService.getScriptLock()` (waits up to 20 s), linearly scans column A for the id, then:
- If the stored `updatedAt` is newer: `{ ok: true, ignored: "stale", id }`.
- Otherwise it writes or appends the row and returns `{ ok: true, id, updatedAt }`.
- `delete` sets `data.deleted = true` and upserts (soft delete).
- Errors: `{ ok: false, error: "Unauthorized" | "Unknown entity: …" | "Missing data.id" | … }`.

A `setup()` function can be run manually to create tabs and format columns as text.

### Auth / token
- One shared secret: Script Property `API_TOKEN`, compared with plain string equality.
- The client sends it as a **URL query parameter** on GET (so it can appear in logs and history) and in the POST body.
- The token is compiled into the public JS bundle (`VITE_GAS_TOKEN`), so anyone who loads the site can read it and get full read/write access to the Sheet.
- A real token was committed to git history in the first commit (`e04cdea`, `.env.example`) and later removed from the file. It remains in history unless it has since been rotated.

### Known limits
- **Full read every time:** every load, and every tab-visibility change, reads all rows of all tabs (O(total data)).
- **Slow writes:** each write is O(rows) because of the linear id scan, and writes are serialised by a single script lock.
- **Apps Script quotas:** execution time, concurrent executions and daily triggers apply. Requests also take noticeable time (typically hundreds of ms to seconds, cold starts included).
- **Cell size:** Google Sheets limits a cell to 50,000 characters. Large objects (e.g. a long `beanLog` inside Settings) would eventually fail to save.
- **Single owner:** the script runs as the owner and the data lives in their Google Drive.
- **No API versioning:** no pagination, no schema validation and no rate limiting.

---

## 8. Known issues & tech debt

**Correctness / data**
- **Settings are one last-write-wins object.** `beanLog` (discards) lives inside it, so discards logged on two devices before either syncs will lose one device's changes.
- **A permanently failing write blocks the queue.** If the server keeps rejecting an op (bad token, oversized cell, unknown entity), the queue retries it every 15 s forever, nothing behind it is sent, and there's no dead-letter or "discard op" UI.
- **Client-clock LWW.** `updatedAt` comes from the device clock, so a device with a wrong clock can win or lose conflicts incorrectly.
- **Import always wins.** JSON import restamps every record with `updatedAt = now`, overwriting newer edits elsewhere.
- **Tombstones are never purged** from localStorage or the Sheet, so both grow forever.
- **"Load demo data" writes demo records to the real Sheet** when a backend is configured, and asks for no confirmation.
- **Auto titles shift.** Day numbers are recomputed from distinct brew dates, so deleting or back-dating a brew renumbers other brews' auto titles. The Sheet's `title` column keeps the title from the last save and can go stale.
- **Duplicated stored values.** `params.bloomG` and `bloomTimeS` are derived values that are also stored (kept in sync on edit). Older records saved before the Steps change may hold stale values until edited.
- **Legacy names.** `pourSchedule` (now means "steps") and the `brewlab:` localStorage prefix were kept for data compatibility.

**Security**
- The shared token is public (bundle + query string), and there are no user accounts (see §9).
- A real token is in git history (§7).

**Testing / tooling**
- No automated tests of any kind, no linter config, no CI. All verification so far was manual or headless-Chrome scripts that live outside the repo.
- No React error boundary: a render error blanks the whole app.

**Performance**
- A single JS chunk of about 843 kB (≈242 kB gzip), with no code splitting. Recharts and Framer Motion dominate it, and the build warning limit was raised to hide the warning.
- The rehearsal timer re-renders every animation frame via `requestAnimationFrame`.
- When the tab is backgrounded or the phone locks, browsers pause rAF, so cues and beeps are missed. The clock itself stays correct on return because it's based on `performance.now()`. The wake lock reduces but doesn't remove this risk.
- Every visibility change triggers a full GET of all data.

**Accessibility**
- `Modal` sets `aria-modal` but has no focus trap and doesn't restore focus on close.
- Toasts aren't in an `aria-live` region (the timer count-in is).
- Charts have no text or table alternative except the Compare table.
- The step type uses a native `<select>`. Sliders have labels.
- Colour contrast was checked for the accent and chart palettes; a full audit hasn't been done.

**Platform**
- iOS fixes (date-input overflow, auto-growing text areas) are implemented but not yet confirmed on a physical iPhone.
- Audio cues need a user tap to unlock Web Audio, which iOS requires.
- `navigator.vibrate` isn't supported on iOS Safari, so iPhones get no haptics.

**Content**
- Champion templates use estimated grind settings and drawdown windows.
- Several strings are hard-coded to this competition (key rules, 200 g budget default, KL timezone, CAFEC dripper and paper lists).

---

## 9. What would need to change for many users

This is my assessment. The current architecture is deliberately single-user, and most of the backend would need replacing rather than extending.

1. **Authentication.** There are no users today. You'd need real identity (email/OAuth, e.g. Google sign-in, Clerk, Supabase Auth or Firebase Auth) and server-verified sessions or JWTs. The shared `VITE_GAS_TOKEN` has to go: any secret shipped in a static bundle is public, so it can't stand in for per-user authorisation.
2. **Multi-tenancy.** Every record needs an owner (`userId`, and later perhaps `teamId` for coaches and teams). Every query and write must be scoped by it on the server. Settings would become per-user (with event details likely moving to an `events`/`competitions` entity, since today the competition is hard-coded into Settings and defaults). Champion templates would become shared, global, read-only content.
3. **Backend.** Google Apps Script + a Sheet doesn't suit many users. It runs as one owner, has execution and concurrency quotas, serialises writes behind one lock, reads the whole dataset per request, can't return real HTTP status codes, and the data lives in one person's Drive. A managed database with row-level security (e.g. Postgres via Supabase, or Firestore) or a small API server would replace it. The good news is that `src/data/api.ts` is the only network layer, so the swap is contained.
4. **Sync model.** The offline-first pattern (local cache, optimistic writes, queue) is worth keeping, but its weak points matter more at scale:
   - **Server time:** use server-assigned timestamps or versions, not the client clock.
   - **Per-field conflicts:** merge conflicts per field, or at least per entity, instead of whole-object LWW. Settings and `beanLog` in particular need it; `beanLog` should become its own entity.
   - **Failed writes:** a dead-letter path for rejected writes.
   - **Incremental pulls:** "changes since cursor" instead of downloading everything.
   - **Purge:** clean up tombstones.
5. **Security hardening.**
   - **Old token:** rotate the existing token now. Note it is in git history.
   - **Transport:** no secrets in URLs; standard CORS on a real API.
   - **Validation and abuse:** server-side schema validation (e.g. zod), rate limiting.
   - **Privacy:** per-user data export/delete for privacy compliance.
6. **Product assumptions to generalise.**
   - Timezone (fixed to Asia/Kuala_Lumpur).
   - Units (grams, °C).
   - Equipment lists (CAFEC drippers and papers).
   - Competition rules and the rules PDF.
   - The 200 g bean budget, the 6:00/3:00 timer lengths, the Aquacode 590 ppm water recipe.
   - English-only copy.
7. **Engineering foundations before growth.**
   - A test suite: unit tests for `calc.ts`, `steps.ts` and the merge logic first; e2e tests for the brew and timer flows.
   - CI on PRs, lint and format config, an error boundary, and error monitoring (e.g. Sentry).
   - Code splitting by route (charts and timer).
   - Accessibility fixes from §8.
   - A schema/version field on stored objects, so future migrations aren't ad hoc.

---

## 10. Screenshots checklist

Use **Settings → Load demo data** on a build *without* `VITE_GAS_URL`, so demo records don't reach the real Sheet. Desktop ≈1440 px wide, phone ≈390 px.

| # | Screen | Route | Device | What it shows |
|---|---|---|---|---|
| 1 | Overview | `#/` | desktop + phone | Flip-clock header, practice stats, bean bar with a discard, key rules, trend charts |
| 2 | Recipes list | `#/recipes` | desktop | Recipe cards with mini pour curves, version badges, champion templates |
| 3 | Recipe editor: Steps | `#/recipes/<id>` | desktop + phone | Steps editor with a swirl step, "+X g this pour", vary-temp switch, brew-water warning |
| 4 | Champion template | `#/recipes/champ-sherry-hsu` | desktop | Read-only view, varying temperatures |
| 5 | New brew | `#/brews/new` | phone | Setup, results, computed panel, sensory sliders + radar, flavour tags, sticky save bar |
| 6 | Brew detail | `#/brews/demo-brew-3` | desktop | Radar, results vs targets, pour curve, tweaks diff, full spec |
| 7 | Compare | `#/compare?ids=demo-brew-2,demo-brew-3,demo-brew-4` | desktop | Radar overlay A/B/C, diff table |
| 8 | Practice days | `#/days` | phone | Timeline, discard row, auto-grown notes |
| 9 | Timer: idle | `#/timer` | phone | Step list, start buttons |
| 10 | Timer: count-in | `#/timer` (after "Start brew") | phone | Teal 5→1 flip card |
| 11 | Timer: running | `#/timer` | phone | Next pour cue, and Sherry Hsu's "Switch kettle → 95°C" |
| 12 | Rules | `#/rules` | desktop | PDF viewer + key rules |
| 13 | Settings | ⚙ in nav | desktop | Settings modal, data tools, sync status |
| 14 | Log discard | Overview → "+ Log discard" | phone | Discard modal (bottom sheet) |
| 15 | Empty state | `#/` on a fresh browser profile | desktop | First-run empty state |

`docs/screenshots/` already contains #1 (desktop + phone), #2, #6, #7, #10 and an earlier version of #11. They predate the Steps feature (§4), so #3, #4, #11 (kettle cue) and #8 should be retaken.
