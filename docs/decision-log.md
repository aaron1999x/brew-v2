# Decision Log & Open Questions

Running record across all planning phases. Newest entries at the bottom of each table.

## Decision Log

| Date | Phase | Decision | Reason | Alternatives rejected |
|---|---|---|---|---|
| 2026-11-12 | 0 | Primary persona for the first release is the **Dial-in Home Brewer** (P1) | Largest group with a real, frequent pain (dialling in every bag); Phase 1 must be valuable with zero community | Competition brewer first (too small a market; served in Phase 3); café barista first (shared-device and team needs add scope) |
| 2026-11-12 | 0 | **Launch to the founder's brewer friends, then the Malaysian/SEA community; build for global use from day one** (units, timezones, English) | Founder has direct access; global-ready avoids a rewrite of the prototype's hard-coded KL/CAFEC assumptions | Malaysia-only build |
| 2026-11-12 | 0 | Project goal: **passion project first, with stage gates towards a real product** (Discovery §7) | Founder's stated intent | Business-first; portfolio-only |
| 2026-11-12 | 0 | **Primary wedge: recipes as versioned objects with a visible "what changed" trail** | Open gap in the competitor scan; matches the Notion pain; works for a single user | Guided timer as the wedge (commodity); share links/cards (table stakes) |
| 2026-11-12 | 0 | **Defer gear-aware filtering and grinder conversion.** Structured gear in Phase 1; grind = grinder + setting text + optional microns; drawdown time as the portable target | No reliable conversion data | Conversion database; unstructured gear |
| 2026-11-12 | 0 | **Brew logs as proof** is the community wedge | Strong trust signal no competitor centres | Likes/followers-first model (empty-feed risk) |
| 2026-11-12 | 0 | **Personas P1–P4 signed off** | Sign-off | — |
| 2026-11-12 | 0 | **Build model: Claude Code builds; Aaron plans, reviews, tests, decides.** Session-sized milestones with hand-checkable acceptance criteria and automated tests | Review time is the bottleneck; prototype had no tests | Big-bang prompts; coding-hours estimates |
| 2026-11-12 | 0 | **Platform: mobile-first PWA.** Visual timer cues first, audio/vibration extras, Wake Lock | Any phone, links open anywhere, one codebase | Native first (stays a fallback) |
| 2026-11-12 | 0 | **Credit always shown and automatic.** Copies link to the original author | Trust | No credit |
| 2026-11-12 | 0 | **No recipe import.** Export = share link + print/PDF page. "Download my data" (JSON) stays as an account essential | Import too complex; data download expected under PDPA | Third-party or JSON import |
| 2026-11-12 | 0 | **Phase 1 includes save, copy-with-credit and "I brewed this".** Schema ready for Phase 2 social features | Helps friends reproduce each other's recipes without a feed | All social features in Phase 1; all in Phase 2 |
| 2026-11-12 | 0 | ~~Roles: member, trusted, moderator, admin; review queue for members' public recipes~~ **Superseded by the Phase 2 moderation decision below.** Moderators: Aaron and his partner (unchanged) | — | — |
| 2026-11-12 | 0 | **Claude Code on Pro:** Sonnet default; `/model opusplan` per milestone; Opus only for schema/RLS and sync. One milestone per session, `/clear`, short CLAUDE.md | Anthropic guidance; shared Pro limits | Opus for everything; Haiku |
| 2026-11-12 | 0 | **Events and news parked** | Later stage | — |
| 2026-11-12 | 0 | **Four differentiator verdicts signed off; positioning line accepted** | Sign-off | — |
| 2026-11-12 | 0 | **Phase 2 interaction order:** 2a = follow + **upvote only**; 2b = comments | Downvotes discourage new contributors, invite pile-ons and don't say why | Up + down votes; comments first |
| 2026-11-12 | 0 | **Phase 0 closed** | All deliverables signed off | — |
| 2026-11-12 | 1 | **Full brew log as in the prototype:** 8 taste sliders + radar, results, extraction calc, flavour tags, notes | Aaron: tasting and slider scoring happen after the brew | Minimal quick log with details collapsed |
| 2026-11-12 | 1 | **A recipe version is the guide; a brew log is the findings.** Brews point at one version; no brew-vs-recipe diff. Tweaks become the next version. **Versions lock once a brew references them** (name/notes still editable) | Aaron's model. Simpler data, honest history | Prototype's snapshot + baseline per brew |
| 2026-11-12 | 1 | **Competition practice is its own phase (Phase 3)** | Aaron: they belong to competition prep | Pulling any into Phase 1 |
| 2026-11-12 | 1 | **All common non-espresso brew methods**, free text as fallback for method and gear. Profile gear preloads into recipes | Aaron's direction | Pour-over only; catalogue-only gear |
| 2026-11-12 | 1 | **Profile in Phase 1:** photo, bio, handle, experience level, favourite gear, stats, public recipes; no followers | Social-profile feel without an audience | Followers in Phase 1 |
| 2026-11-12 | 1 | **Two visibilities only: private and public. No "unlisted".** Share links only for public recipes | Aaron: not needed | Unlisted links |
| 2026-11-12 | 1 | **A public recipe made private again:** others' copies keep credit (name only); "I brewed this" logs stay with a "recipe no longer public" note | Others' data shouldn't disappear | Breaking others' copies and brews |
| 2026-11-12 | 1 | **Claude Code workflow** (see `claude-code-workflow.md`) | Milestone work is sequential | Orchestrator with many subagents; agent teams |
| 2026-11-12 | 1 | **Building in Claude Code's VS Code extension**; planning in this project | Diffs in the editor; local testing | Desktop app; web as main; CLI |
| 2026-11-12 | 1 | **Timer: no separate spike.** Aaron confirms the prototype timer works well on iPhone; M4 ports its logic | Already proven | Throwaway spike |
| 2026-11-12 | 1 | **Phase 1 signed off and closed** | Sign-off | — |
| 2026-11-12 | 2 | Tabs, Home as "my brew bar", minimal sign-up with skippable onboarding, one brew flow with two entries, `/@handle` URLs, visitor permissions incl. brewing without an account | Aaron agreed | See `phase-2-ia-flows.md` |
| 2026-11-12 | 2 | Brew logs private; public pages show counts only. Creating/editing recipes needs a connection; brewing and logging work offline. Email verification required to publish. Fixed recipe slugs; private recipes look like "not found". Brew log savable with only the overall score | Aaron agreed | — |
| 2026-11-12 | 2 | **Moderation model (Aaron):** community public recipes **publish instantly, no approval**. Roles: **member · verified · moderator · admin**. **Verified** status granted only by moderators; badge on profile and recipe cards. Moderation after posting: report → hide / suspend. No champion or starter templates | Less to build, less moderation work; curated content without pre-approval | Review queue for members; champion templates |
| 2026-11-12 | 2 | **New accounts (< 7 days) limited to 5 public recipes per day** | Stops spam bursts without pre-approval | No limit |
| 2026-11-12 | 2 | **Verified tab** replaces Saved in the tab bar (Saved moves into Profile); becomes Explore in Phase 2 | Gives new users something to brew on day one | Verified inside Profile or Home; no discovery in Phase 1 |
| 2026-11-12 | 2 | **All public recipes from verified profiles appear in Verified automatically** | Moderators verify people, not recipes | Verified brewers choose per recipe |
| 2026-11-12 | 2 | **Notifications: in-app only** plus account emails. **No push** | PWA; push adds setup for little value | Push; email notifications |
| 2026-11-12 | 2 | **Phase 2 signed off and closed** | Sign-off | — |
| 2026-11-12 | 3 | **Design system comes from Aaron's designer**, using `designer-brief.md` + `designer-brief-token-samples.md`. Claude's Phase 3 work: turn the designer's output into CSS custom properties, check contrast and target sizes, write component specs | Aaron has a designer | Claude designs the system alone |
| 2026-11-13 | 3 | **Order confirmed:** Phases 4 and 5 now; Phase 3 when designs arrive; then Phase 6 | Phases 4–5 don't depend on visuals | Waiting for the designer |
| 2026-11-13 | 4 | **Next.js (App Router) + TypeScript on Vercel Hobby, Singapore** | Server-rendered public pages for link previews and SEO; performance; prototype was React + TS | Vite + React SPA with a separate preview function |
| 2026-11-13 | 4 | **Supabase Free, Singapore. No paid services for now.** Nightly GitHub Actions backup + keep-alive | Aaron: not paying for anything yet | Supabase Pro from the alpha |
| 2026-11-13 | 4 | **Aaron's existing domain (subdomain) for now**; site URL in one env var; ideally switch to the final domain before the friends alpha | Easy switch later; installed PWAs and unsynced data are tied to the domain | Hard-coded domain |
| 2026-11-13 | 4 | **No third-party analytics.** Gate 1 metrics from our own data + events table; Sentry for errors | Privacy, no cookie banner | Product analytics tools |
| 2026-11-13 | 4 | **Email confirmation required before first sign-in** (changes Phase 2 F1). Google sign-ups pick a handle in onboarding | Supabase auto-confirms when confirmation is off | Signed in immediately with a "verify" banner |
| 2026-11-13 | 4 | **CSS custom properties + CSS Modules** | Tokens as single source of truth | Tailwind |
| 2026-11-13 | 4 | **Recharts v3**, lazy-loaded, token-themed, text alternatives | Aaron: saves time; prototype used it | Hand-built SVG |
| 2026-11-13 | 4 | **TanStack Query v5** + persisted cache; dedicated brew outbox; **Sonner** toasts; no global state library | Standard loading/error/success handling | Hand-rolled fetching; Redux/Zustand |
| 2026-11-13 | 4 | **Standard loading, success and error states** + error-code-to-message map | Aaron's requirement | Ad hoc per screen |
| 2026-11-13 | 4 | **Data model and Phase 1 SQL schema**; later phases additive | Supports all phases without rewrites | Prototype's snapshot-per-brew model |
| 2026-11-13 | 4 | **Phase 4 signed off and closed** | Sign-off | — |
| 2026-11-13 | 5 | **Invite-only friends alpha** (allowlist + `invite_only` config flag); reports and moderator screens built in M8, before sign-ups open | Friends get the app sooner; nobody unknown can post in the meantime | Full moderation before the alpha |
| 2026-11-13 | 5 | **No fixed dates; core loop first** (M3 recipes → M4 timer and log → M5 offline); Could-haves cut first, then Should-haves | Quality over deadlines for a passion project | Date-driven plan |
| 2026-11-13 | 5 | **iPhone is the primary test device** (Safari and Home Screen app) | Friends mostly use iPhone | Android or desktop first |
| 2026-11-13 | 5 | **CAFEC interviews dropped**; feedback comes from the friends alpha | Aaron: meaningful feedback comes from a working app | Pre-build interviews |
| 2026-11-13 | 5 | **Product name decided late**; name in `src/config/site.ts`, logo/icons in `public/brand/` | Renaming stays a one-file change | Naming before building |
| 2026-11-13 | 5 | **Milestones M0–M9 for product Phase 1**, Gate 1 after M7, Gate 2 after M8; M10–M15 outlined; later phases get their own planning round (see `phase-5-roadmap.md`) | Session-sized, testable milestones | One large MVP build |
| 2026-11-13 | 5 | **Releases and changelog** (see `release-and-versioning.md`): Conventional Commits enforced; **release-please** Release PR; merging it bumps the version, updates `CHANGELOG.md`, tags, creates a GitHub Release, runs production migrations and deploys production. **Staging** = `main` + second free Supabase project; **production** = `production` branch moved only on release. SemVer `0.x` until open beta = `1.0.0`. Version in Settings → About and `/status`; Sentry release per version; "What's new" page in M7. Set up in M0 | Aaron: proper versioning and a changelog of what shipped. Shipping as a deliberate step keeps changelog, version, migrations and deploy in sync | Hand-written changelog; Changesets; semantic-release; deploying every push to production |
| 2026-11-13 | 5 | **Phase 5 signed off and closed** (`phase-5-roadmap.md` + `release-and-versioning.md`) | Sign-off | — |
| 2026-11-13 | 6 | **M0 build prompt written ahead of Phase 3** (`prompts/m0-foundation.md`), since M0 needs no design system; it uses placeholder tokens. Remaining prompts (M1–M8) follow once Phase 3 is done | Lets the build start while the designer works | Waiting for Phase 3 before any prompt |
| 2026-11-13 | 6 | **No Docker on Aaron's machine.** Development database = the **staging** Supabase project. Migrations pushed to staging with the Supabase CLI; types generated from staging; pgTAP RLS tests run with `psql` against staging inside `begin … rollback`; CI also runs them on a throwaway database on GitHub's runner. A guard script blocks any database script aimed at production. Gear catalogue moved from seed data into a migration (production needs it). Supersedes the local-Supabase setup in `phase-4-system-design.md` §12 | Aaron doesn't want Docker. Staging is a sandbox, production changes only through releases, and rolled-back tests leave no data | Docker + local Supabase (original plan); Supabase's experimental native runtime |
| 2026-11-13 | M0 | **`recipe_counters` rows created by an `after insert` trigger on `recipes`** (`recipes_after_insert`, security definer). `create_recipe` no longer inserts the row itself; `copy_recipe` uses `on conflict do nothing`. Shipped as migration `…_fix_recipe_counters.sql` after the verbatim §4 schema | The original `create_recipe` (security invoker) failed for every normal member: `recipe_counters` has no insert policy. Reproduced in a rolled-back test before fixing; covered by pgTAP | Making `create_recipe` security definer (bypasses the recipe insert policy checks); adding an insert policy on `recipe_counters` (lets clients write public counts) |
| 2026-11-13 | M0 | **Database connections go through the Supabase session pooler** (local scripts, CI and release workflows), with the password passed via `PGPASSWORD` or a secret, never on the command line. Supabase CLI **pinned**; hosted commands use `--remote` / `--yes` or `--db-url` (Supabase CLI 3.x defaults to the local database) | The direct database host is IPv6-only; Aaron's network and GitHub's runners have no IPv6. The CLI 3.x defaults changed, so `release.yml` from `release-and-versioning.md` §4 can't run as written | Direct host connections; unpinned `version: latest` CLI |

## Open Questions

| # | Question | Raised | Needed by | Owner |
|---|---|---|---|---|
| OQ11 | Legal check before public launch: terms of service, privacy policy (PDPA/GDPR, cross-border transfer to Singapore) | 2026-11-12 | M8 (before Gate 2) | Aaron |
| OQ18 | Product name (logo, app icon, final domain); domain switch is cheapest before the alpha | 2026-11-12 | Any time; ideally before Gate 1 | Aaron |
| OQ20 | When to move Supabase to Pro: at the 500 MB limit, when real users depend on it, or never while free | 2026-11-13 | Before Gate 2 | Aaron |
| OQ22 | Designer's delivery (tokens + components + key screens) to start Phase 3 | 2026-11-13 | Before M1 | Aaron / designer |

### Resolved
OQ1 hours · OQ2 CAFEC interviews (dropped) · OQ3 platform (PWA) · OQ4 credit · OQ5 import/export · OQ6 upvote only · OQ7 moderators Aaron + partner · OQ8 events/news parked · OQ9 Claude plan/models · OQ10 positioning and verdicts · OQ12 no unlisted · OQ13 un-publishing keeps others' copies and brews · OQ14 Phase 1 scope signed off · OQ15 Verified tab · OQ16 Verified is automatic · OQ17 notifications in-app only · OQ19 order confirmed · OQ21 Phase 5 signed off