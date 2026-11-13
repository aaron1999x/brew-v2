# [App] — project rules for Claude Code

Mobile-first PWA for serious home coffee brewers. Recipes evolve through versions; brews log findings against one version.

## Where things are (`docs/`)

Read only the docs a task needs, and only the sections you need. Don't paste whole docs into the conversation.

| File | Use it for |
|---|---|
| `docs/progress.md` | **Start here every session**: what's built, deviations, what's next |
| `docs/phase-5-roadmap.md` | Milestone scope and acceptance criteria (M0–M15); invite-only SQL §4 |
| `docs/phase-4-system-design.md` | Architecture, data model, Phase 1 SQL §4, auth §6, storage §7, privacy §8, offline §9, export/delete §10 (stale parts listed at the top of the file) |
| `docs/phase-4-amendments.md` | Recharts, TanStack Query, loading/success/error standard, error-code map |
| `docs/phase-2-ia-flows.md` | Sitemap, URL rules, who-can-do-what, flows F1–F11, empty states, edge cases |
| `docs/phase-1-product-definition.md` | Phase 1 feature scope (Must/Should/Could/Won't), metrics, risks |
| `docs/phase-0-discovery.md` | Personas, jobs-to-be-done, positioning |
| `docs/product-context.md` | Original product vision and product insights from real use |
| `docs/release-and-versioning.md` | Commits, releases, environments, workflow files |
| `docs/claude-code-workflow.md` | Session routine and subagents (its §2 docs layout is outdated; ignore it) |
| `docs/designer-brief.md` | Component list, key screens, accessibility rules for the UI |
| `docs/designer-brief-token-samples.md` | Token naming and placeholder values |
| `docs/decision-log.md` | Decisions with reasons; newest wins when docs disagree |
| `docs/prototype-handoff.md` | Old single-user prototype: reference only; reuse only what the docs name (calc, steps, timer logic) |

When a milestone prompt and a doc disagree, the prompt wins; between docs, the newer entry in `decision-log.md` wins.

## Stack

Next.js App Router · TypeScript strict · CSS Modules + CSS custom properties · Supabase (Postgres/Auth/Storage, RLS) · TanStack Query v5 · Zod · Sonner · Recharts v3 (chart pages only) · Serwist · Vitest · Playwright · pgTAP.

## Environment

- **No Docker, no local Supabase.** The development database is the **staging** project (`.env.local`).
- Database scripts always run `scripts/assert-staging.mjs` first. Never point anything at production; production changes only through a release.
- pgTAP tests run with `psql` against staging inside `begin … rollback`; CI also runs them on a throwaway database.
- Supabase keys: publishable key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) in the browser; secret key (`SUPABASE_SECRET_KEY`) on the server only. Never use legacy anon/service_role keys.

## Commands

- `npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `npm run lint:tokens` · `npm run test` · `npm run test:e2e`
- `npm run db:push` (migrations → staging) · `npm run db:types` · `npm run db:test`
- `gh pr create`, `gh run watch` for PRs and CI

## Rules

1. Plan first for any change touching more than 2–3 files; wait for approval.
2. Security: row-level security is the boundary. Every new table gets RLS + pgTAP tests. Brews are owner-only, always. Secret-key client only in server code (`server-only`).
3. Database changes = new migration files only; never edit applied migrations. Push to staging, then regenerate types.
4. Multi-step writes go through Postgres RPC functions; raise named errors and add them to `src/lib/errors/messages.ts`.
5. Styling: semantic tokens only (`var(--color-…)`, `var(--space-…)`). No hex/rgb/hsl or px font sizes outside `src/styles/tokens.css`.
6. Every screen follows the loading / success / error standard in `docs/phase-4-amendments.md` §3.
7. Accessibility: WCAG 2.2 AA. Labels, visible focus, 44×44 px primary targets, no colour-only meaning, reduced motion, chart text alternatives. axe must pass.
8. Store metric values only (g, °C, seconds); convert for display with the units helpers.
9. Server data via TanStack Query hooks with keys from `src/lib/query/keys.ts`; UI state stays local. No global state library.
10. Commits and PR titles: Conventional Commits (`feat(scope): …`). Never edit `CHANGELOG.md` or `package.json` version.
11. Tests: unit tests for logic, pgTAP for policies, Playwright (iPhone project) for flows. Don't finish a stage with failing checks.
12. Use the `test-runner` subagent for checks and the `reviewer` subagent at the end of a milestone.
13. End every milestone by updating `docs/progress.md`. Don't rename, move or reformat the planning docs; when a doc is wrong, note it in `docs/progress.md` instead.

## Product rules worth remembering

- A recipe version locks once a brew references it; changes then create a new version.
- Private, hidden and missing recipes show the same "not available" page.
- Public recipes publish instantly; moderation happens after posting. Verified status is granted by moderators only.
- Invite-only sign-up while `app_config.invite_only = true`.
