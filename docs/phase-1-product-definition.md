# Phase 1: Product definition

Status: **signed off 12 Nov 2026; moderation model updated 12 Nov 2026 (no pre-approval, Verified profiles)** · Scope covers **product Phase 1** (accounts, profiles, equipment, recipes, brewing, logging) only.

Visibility: **private or public only** (no unlisted). Public recipes go live instantly. Share links work for public recipes only. If a public recipe is made private again, others' copies keep the credit (name only) and their "I brewed this" logs stay with a "recipe no longer public" note.

---

## 1. Core loop

```
Set up gear once → Create recipe (pulls gear) → Brew with guided timer → Taste → Log findings (sliders, radar, results)
      → Decide the tweak → Save as next version → Brew again … → Share when it's right
```

**Key model decision (from Aaron):** a **recipe version is the guide**, and a **brew log is the findings** from brewing that exact version. A brew doesn't carry its own edited copy of the recipe. Any tweak becomes the **next version** of the recipe. "What changed" is shown **between versions**, not between a brew and its recipe.

Consequences:
- Each brew points at one specific recipe version.
- **A version is locked once a brew has been logged against it** (editing it would rewrite history). Changes after that create a new version.
- Typos can still be fixed in fields that don't affect brewing (name, notes) without a new version.
- A brew log has a **"Next time I'll change…"** field. **"Create next version"** from a brew opens the editor with that note alongside.

---

## 2. MoSCoW scope

Legend for **Proven**: ✅ = built and used in the prototype · ◐ = partly (single-user, or different form) · — = new.

### Must have

| Area | Feature | Notes | Proven |
|---|---|---|---|
| **Accounts** | Register, log in, log out, email verification, password reset | Supabase Auth | — |
| | Delete account | Removes personal data; public recipes others copied keep the credit as "deleted user" | — |
| | Download my data (JSON) | One-way export of everything the user owns | ◐ |
| | Units and regional settings | °C/°F, g/oz, date/time format, timezone (auto-detected). Data stored in metric; converted for display | — |
| **Profile** | Display name, unique handle (for profile URLs), photo, bio, experience level (user-chosen), favourite gear (picked from their gear) | Public profile page | — |
| | Profile stats | Recipes, public recipes, versions, brews logged, "brewed by others" count | — |
| | Public profile page | Shows public recipes and stats; works for logged-out visitors. **Verified badge** for verified profiles | — |
| | Saved recipes | Shown as a section of the user's own Profile | — |
| **My equipment** | Gear list by category: brewer, filter, grinder, kettle, scale, water, other | Pick from a seeded list of common gear (autocomplete) **or** type free text | — |
| | Gear preloads into new recipes | User can override per recipe with another item or free text | — |
| **Recipes** | Create, edit, duplicate, archive/delete | Delete leaves brews and copies intact | ✅ |
| | Full context | Coffee (name, roaster, origin, process, varietal, roast level, roast date, optional colour reading), equipment, dose, brew water, bypass (before/after), temperature (incl. per-step temperature), grind (grinder + setting text + optional microns), water ppm, targets (drawdown range, TDS range, EY range), notes | ✅ |
| | Structured steps | Step types: pour, wait, swirl, stir, press, other. Each has time; pours have cumulative target weight and optional rate/temperature; others have duration/label; all have technique text | ✅ (press is new) |
| | Brew methods | **All common non-espresso methods** (pour-over, immersion, hybrid such as Switch, Clever, AeroPress, French press, siphon, cold brew). Method picked from a list or typed as free text | ◐ |
| | Calculated values | Ratio, overall ratio incl. bypass, expected final volume (water − retention + bypass), step "+X g this pour" | ✅ |
| **Versioning** | Save as next version; version history per recipe | | ✅ |
| | Compare any two versions | Changed fields highlighted | — |
| **Visibility** | Each recipe is private or public | Applies to the whole recipe and its versions. **Public goes live instantly** (no approval). Email must be verified to publish | — |
| **Verified recipes** | **Verified tab**: all public recipes from verified profiles, newest first, filter by brew method | Read-only list; no search in Phase 1. Grows into Explore in Phase 2 | — |
| **Guided brew timer** | Step-by-step brewing from any recipe version | Big visual countdown, next-step cue with time/weight/temperature/technique, 3–5 s count-in, wake lock, optional sound and vibration | ✅ |
| | Finish opens a pre-filled brew log | | ✅ |
| **Brew log** | Log a brew against a recipe version (with or without the timer) | Date/time defaults to now. Brew logs are always private | ✅ |
| | Results | Drawdown time, beverage weight, TDS | ✅ |
| | Extraction calculation | EY = TDS × beverage weight ÷ dose; shown against the recipe's targets | ✅ |
| | Taste sliders + radar | 8 attributes (sweetness, acidity, brightness, body, clarity, balance, aftertaste, overall), 0–10 in 0.5 steps, live radar | ✅ |
| | Flavour tags | Presets + free text | ✅ |
| | Tasting temperature or time | When the cup was tasted (hot / warm / cool, or minutes after brewing) | — |
| | Notes + "Next time I'll change…" | | ✅ |
| | Create next version from a brew | | ✅ |
| | Brew history per recipe and per version | | ✅ |
| **Sharing** | Share link to a public recipe | Opens in any browser for logged-out visitors, with a link preview (title, method, key numbers) | — |
| | Copy a recipe with credit ("fork") | Copy lands in the user's own recipes, private by default, permanently linked to the original author and version | — |
| | Save someone's recipe | Bookmark list (in Profile) | — |
| | "I brewed this" | Log a brew against someone else's public recipe; their recipe shows the count | — |
| **Moderation** | Roles: **member, verified, moderator, admin** | Verified status granted and removed only by moderators; role changes by admin only | — |
| | Report a recipe or profile | Logged-in users only | — |
| | Moderator tools | Reports list; hide / restore content (with a reason shown to the owner); suspend / unsuspend account; grant / remove verified | — |
| | Publish limit for new accounts | Accounts younger than 7 days can make at most 5 recipes public per day | — |
| **Notifications** | In-app notices list (bell) | "You've been verified", "A moderator hid your recipe" (with reason), "@user copied your recipe", "@user brewed your recipe". **No push, no email** except account emails (verification, password reset) | — |
| **Offline** | Own recipes, timer and brew logging work offline and sync later | Creating/editing recipes, profiles, sharing and other people's recipes need a connection | ◐ |
| **Platform** | Mobile-first, installable PWA | | ◐ |
| | Light and dark themes | | ◐ |
| | WCAG 2.2 AA | | ◐ |

### Should have

| Feature | Notes | Proven |
|---|---|---|
| Compare 2–3 brews | Radar overlay + side-by-side table | ✅ |
| Print / save recipe as PDF | Print-friendly recipe page | — |
| Sign in with Google | In addition to email | — |
| Find a user by handle | So friends can find each other without a full explore page | — |
| Pour curve on recipe and brew pages | Water vs time from steps | ✅ |

### Could have

| Feature | Notes | Proven |
|---|---|---|
| Recipe trend charts | Grind vs drawdown, overall score over time, TDS vs EY chart | ✅ |
| Water calculator | Mineral concentrate + distilled water from target ppm; concentrate configurable | ✅ (hard-coded to one product) |
| Roast-level guidance | Hints per roast level (temperature, grind direction) | — |

### Won't have in Phase 1 (planned later)

| Feature | Phase |
|---|---|
| Explore and search public recipes (Verified becomes a section of Explore) | 2 |
| Follow, upvote, comments | 2 (2a follow + upvote, 2b comments) |
| Other people's tasting notes shown on public recipes | 2 |
| Shareable image card for Instagram | 2 |
| Competition prep: competitions, rules, time limits, rehearsal mode, practice days, bean budget, rules viewer | 3 |
| Bean library ("My coffees", days since roast, grams remaining) | Later |
| Events, news, equipment directory | Later |

---

## 3. Out of scope (not planned)

Recipe import of any kind · unlisted visibility · pre-approval of recipes · champion/starter templates · espresso · Bluetooth scales · grinder-setting conversion · AI dial-in suggestions · direct messages · marketplace · native apps · push notifications · email notifications (beyond account emails) · teams/cafés · monetisation (nothing built may block it).

---

## 4. Success metrics

**Gate 1 (friends alpha)** is the pass/fail test: ≥ 6 of 8–12 friends log ≥ 2 brews/week for 4 straight weeks, and at least half stop using their old notes for brewing.

| Metric | Target at Gate 1 | Why |
|---|---|---|
| Brews logged per active user per week | ≥ 2 | Habit |
| Recipes with ≥ 2 versions | ≥ 50% of recipes with 3+ brews | Proves the versioning wedge is used |
| Brews started from the guided timer | ≥ 50% | Timer earns its place |
| Time from finishing tasting to saved log | Median ≤ 2 min | Logging doesn't feel like admin |
| Recipes shared, copied or "brewed by others" | ≥ 1 per active user over 4 weeks | Sharing loop works |
| Sync failures / lost brews | 0 lost brews | Trust |
| Accessibility | No WCAG 2.2 AA failures in automated checks on core screens | Quality bar |

---

## 5. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Phase 1 scope is large** | High | Gate 1 slips | Split into small milestones in Phase 5; Could-haves cut first; Should-haves second |
| iOS timer audio unreliable in installed PWAs | Medium | Missed cues | Visual-first cues; Home Screen check on the prototype; native as fallback |
| Offline sync conflicts or lost brews | Medium | Users stop trusting the app | Locked versions + append-only brews; recipe editing online only; server timestamps; tests on sync logic |
| Brew methods too varied for one step model | Medium | Awkward recipes for some methods | Generic step types + free-text method + "other" step; validate with 5 methods in testing |
| **Spam or abuse without pre-approval** | Medium | Bad content on public pages | Email verification to publish; publish limit for new accounts; report button; hide and suspend tools; private recipes and brews never exposed |
| Verified tab thin at launch | Medium | Little to browse on day one | Aaron and partner verify a handful of respected brewers before the alpha and ask them to publish 2–3 recipes each |
| Grind numbers misread on shared recipes | High | Friends can't reproduce | Grinder name shown with every setting; drawdown target shown prominently |
| Privacy/legal gaps before open beta | Medium | Compliance issue | Delete account + download data in Phase 1; legal check before Gate 2 (OQ11) |

---

## 6. Notes carried to later phases

- **Phase 3 (design):** Verified badge; notices bell; status badges for private / public / hidden.
- **Phase 4 (system design):** recipe → versions (immutable once brewed) → brews; gear stored on a recipe as both a reference to the user's gear item and a name snapshot; roles and verified status in a table users can't edit; notifications table; publish-rate limit enforced on the server; data model must accept competitions, rehearsal runs and coffee bags later without changes to recipes or brews.
