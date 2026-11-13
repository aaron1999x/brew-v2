# Phase 4 amendments: charts, data fetching, feedback states

Status: **signed off 13 Nov 2026** · Supersedes `phase-4-system-design.md` §1 (Charts row) and §14 decision 3. Everything else in Phase 4 stands.

---

## 1. Charts: Recharts (replaces hand-built SVG)

| Item | Decision |
|---|---|
| Library | **Recharts v3** (SVG, React 19 compatible) |
| Charts in Phase 1 | Taste radar (single + up to 3 overlaid), pour curve; trend charts (Could have) use the same library |
| Bundle | Loaded **only on pages that show charts** (recipe, brew log, brew detail, compare) via `next/dynamic`, so Home, the brew picker and the guided timer stay light |
| Theming | All colours, fonts and strokes come from design tokens (`--color-chart-series-a`, `--color-chart-grid` …); no hard-coded colours |
| Accessibility | Recharts' built-in keyboard/screen-reader layer kept on; **every chart also has a text alternative**: a visually hidden data table, or a visible table toggle. Overlaid brews differ by line style and markers as well as colour |
| Motion | Chart animations off when the user prefers reduced motion |
| Prototype reuse | `components/charts.tsx` (`SensoryRadar`, `PourCurve`) used **as a pattern**: same chart types and data shaping, rebuilt with tokens and accessibility added |

## 2. Data fetching: TanStack Query

**Worth it: yes.** It handles server data (anything that comes from Supabase): caching, loading and error states, retries, refetching, mutations and optimistic updates. Without it, every screen would hand-roll the same `isLoading / error / data` logic.

**What it isn't for:** UI state (open sheets, form inputs, timer state). That stays in React state, forms and the URL. No separate global state library (Redux, Zustand) is needed.

| Item | Decision |
|---|---|
| Library | `@tanstack/react-query` v5 + devtools in development |
| Where | All **client-side** reads and writes to Supabase. Public pages (profile, recipe) are fetched in **server components** for SEO, then handed to TanStack Query on the client (hydration) so there's no second loading state |
| Query keys | One factory file: `['recipes','mine',filters]`, `['recipe',handle,slug]`, `['recipe-version',id]`, `['brews','mine',filters]`, `['brew',id]`, `['profile',handle]`, `['verified',method]`, `['notices']`, `['gear']`, `['settings']` |
| Defaults | `staleTime` 30 s; queries retry twice on network/5xx errors, never on 4xx; refetch on window focus for own data; `networkMode: 'offlineFirst'` |
| Offline reading | Query cache for own recipes, versions, gear and settings **persisted to IndexedDB** (`@tanstack/react-query-persist-client` + an async IndexedDB persister), so the app opens with data offline |
| Offline writes | **Brews keep the dedicated outbox** from Phase 4 §9 (device-generated IDs, conflict check, "Needs attention" list). TanStack Query reads the outbox state to show "waiting to sync" badges. Other writes need a connection |
| Mutations | One hook per action (`useCreateRecipe`, `useCreateVersion`, `usePublishRecipe`, `useCopyRecipe`, `useSaveRecipe`, `useSaveBrew`, `useReport` …), each invalidating the right query keys on success |
| Optimistic updates | Save/unsave recipe, mark notices read, archive/restore, brew save (local first). On failure: roll back and show an error toast |

This **simplifies the offline design**: IndexedDB via Dexie is now used only for the brew outbox and brew drafts. Cached reads come from the persisted TanStack Query cache.

## 3. Loading, success and error states (standard for every screen)

| Situation | What the user sees | Accessibility |
|---|---|---|
| **First load of a screen** | Skeleton shaped like the content (cards, rows), no full-page spinner. After 10 s: "Still loading…" with Retry | Container has `aria-busy="true"`; one polite announcement "Loading recipes" |
| **Background refresh** | Nothing blocks; existing content stays | None |
| **Button action in progress** | Button keeps its width, shows a spinner and a verb ("Saving…"), and is disabled to stop double submits | `aria-busy`, `aria-disabled`; label change is read out |
| **Success, same screen** | Toast: "Saved as v4", "Recipe copied to your recipes". Undo on reversible actions (archive, unsave, delete brew) | Toast region `role="status"`, polite; stays ≥ 5 s and pauses on hover/focus |
| **Success, navigates** | Destination shows the result (new recipe page); a short toast confirms | Focus moves to the new page heading |
| **Form validation error** | Error summary at the top + inline message under each field | Summary gets focus; each field has `aria-invalid` and `aria-describedby` |
| **Action failed (server/network)** | Error toast with a clear message and **Retry**; the user's input is never lost | `role="alert"` |
| **Screen failed to load** | Error panel in place of content: what happened, Retry, link Home | Panel heading gets focus |
| **Offline** | "Offline" banner; brews save locally with a "Waiting to sync" badge; actions that need a connection explain why instead of failing | Banner announced once |
| **Not found / not available** | Shared "not available" page (same for private, hidden or missing) | — |
| **Unexpected crash** | Route-level error boundary (`error.tsx`) with Retry; global boundary as last resort; reported to Sentry | Focus on the message |

### Error codes → messages
RPCs and triggers raise named errors (Phase 4 schema). One map turns them into plain messages:

| Code | Message |
|---|---|
| `email_not_verified` | "Verify your email before making recipes public." + Resend email |
| `publish_limit` | "New accounts can publish 5 recipes a day. Try again tomorrow." |
| `version_locked` | "This version has brews, so your changes will be saved as a new version." (shown before saving where possible) |
| `recipe_not_available` | "This recipe isn't available any more." |
| `handle_reserved` / `handle_recently_used` | "That handle isn't available. Try another." |
| `moderator_only` / `admin_only` | "You don't have permission to do that." |
| `not_authenticated` / expired session | "Please log in again." Work in progress is kept |
| Network error | "Couldn't reach the server. Check your connection and try again." |
| Anything else | "Something went wrong. Try again." (details sent to Sentry) |

### Libraries for feedback UI
- **Toasts:** Sonner, styled with design tokens (accessible live regions built in, saves building our own).
- **Skeletons, error panels, banners:** small components in our design system.

## 4. Updated stack rows

| Layer | Choice |
|---|---|
| Charts | **Recharts v3**, lazy-loaded, token-themed, with text alternatives |
| Server data | **TanStack Query v5**, cache persisted to IndexedDB |
| Offline writes | Dedicated brew outbox in IndexedDB (Dexie) |
| Toasts | **Sonner** |
| UI state | React state, forms, URL; no global state library |
