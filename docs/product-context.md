# Product context: coffee recipe community app (working name TBD)

## What this is

A home for coffee enthusiasts to log, refine, share and discover brew recipes. Users create a profile, keep their own recipes (private or public), track every version as they dial in, and explore what the community brews. Over time it grows into the place to find coffee events, news and equipment, and to prepare for brewing competitions with a dedicated prep mode and rehearsal timer.

It grew out of a personal prototype I built while preparing for a brewers competition. The prototype proved the recipe-logging and rehearsal ideas for one person; this project designs the real, multi-user product from scratch.

## Who it's for

Coffee enthusiasts: people who brew at home seriously, café baristas, and competition brewers. Discovery should refine this into clear personas and decide who matters most for the first release.

## The problem

- Most people write recipes down by hand, in notes apps or not at all. Recipes get lost, versions blur together, and it's hard to see what actually changed between a good cup and a bad one.
- There's no good place to share a recipe _with its context_ (gear, coffee, water, technique) so someone else can actually reproduce it.
- Competition brewers juggle notes, timers and rule sheets separately when preparing.

## Product vision and sequencing (my direction)

**Phase 1: Accounts, profiles and recipe logging (the foundation)**

- Login and registration are required.
- **Profile:** display name, photo, bio/description, coffee experience ("mastery"), favourite equipment, and stats on their contributions (recipes published, versions, brews logged, and similar).
- **My equipment:** users set up their gear list once (brewers, filters, grinders, kettles, scales, water) and it preloads when they create a recipe.
- **Recipes:** create, edit and version recipes with full context (coffee, roast, gear, dose, water, temperature, grind, pour schedule, bypass, notes).
- **Visibility:** each recipe is private or public, set by the user.
- **Brew logs:** log each brew against a recipe, with results, tasting notes and what changed, and promote a good brew to a new recipe version.
- **Guided brew timer:** any recipe can be brewed with a step-by-step timer that shows each pour (time, target weight, temperature, technique) with cues before each step. When the brew finishes, it opens a pre-filled brew log. Pour schedules must be stored as structured steps so the timer can read them.
- The profile should feel like a social media profile for coffee lovers.

**Phase 2: Community**

- Explore and search public recipes (by coffee, origin, process, brewer, roast level, gear).
- Interact with recipes and people (to be decided: follow, like, save, comment, fork/remix with credit).

**Phase 3: Competition prep mode** (once the core is solid)

- Users set up a competition: its format, rules, time limits and approved equipment.
- It reuses the same recipe and brew-log features, so training recipes live alongside their normal ones.
- **Competition rehearsal:** extends the Phase 1 guided brew timer with the event's prep and brew time limits, rule checks (such as minimum serving volume) and a log of each rehearsal run.
- This covers what my prototype already did for one person.

**Later (order to be decided):** coffee events, news, an equipment directory, and a bean library ("My coffees": add a bag once with roaster, origin, process, roast level, roast date and bag weight, pick it when brewing, and see days since roast and grams remaining).

## Recommended additions (to evaluate in Product definition)

**Phase 1**

- **Units and regional settings:** g/oz, °C/°F, date and time formats, built in from the start.
- **Account essentials:** password reset, account deletion and data export (expected by users and required by privacy laws such as Malaysia's PDPA).

**Phase 2**

- **"I brewed this":** users log brews against someone else's public recipe; recipes show how many people brewed them and their tasting notes.
- **Fork/remix with credit:** copy a public recipe into your own, adapt it, and keep a link to the original.
- **Shareable recipe card:** an image or link designed for Instagram and other social sharing.

**Deliberately out of scope for now:** direct messages/chat, marketplace, AI dial-in suggestions (revisit once there's enough brew data), Bluetooth scale integration, grinder-conversion database.

## What makes it different (hypotheses to test in Discovery)

- **Recipes as living, versioned objects:** every change is tracked, and you can see exactly what changed between versions, instead of a static recipe card.
- **Gear-aware recipes:** recipes carry their equipment from your saved gear list, so others can filter by gear they own and reproduce results.
- **Brew logs as proof:** a public recipe can show how it was dialled in and how it tastes, not just its numbers.
- **One place from everyday brewing to competition:** the same recipes power daily brewing and competition prep.
  These need a proper competitor scan before we commit to any of them.

## Product insights from real use (design for these)

- **Coffees vary a lot.** Roast level often turns out different from the label and changes the whole recipe (temperature, grind, filter). Capture roast level, roast date and optional colour readings, and give guidance per roast level.
- **Grind settings aren't portable.** The same number on the same grinder model differs between users (zero point), and settings never transfer between grinder models. Drawdown time is the real control. Grinder calibration, per-grinder settings and cross-grinder conversion are real needs, especially for shared recipes.
- **Volume, ratio and retention confuse people.** Users mix up water poured with coffee served. Show the expected final volume (water − retention + bypass) and warn about rules such as minimum serving volumes.
- **Taste changes as coffee cools.** Tasting temperature or time should be part of a tasting note.
- **Advanced techniques are common:** bypass before or after brewing, cutting the brew early, staged temperatures, multiple extractions, blended grind sizes. The data model must allow these without making the simple case complicated.
- **Water matters.** Mineral content (ppm) affects taste; a water calculator for mineral concentrates is useful.
- **People learn from champions.** Well-known competition recipes are popular starting points.

## Prototype features to re-evaluate (see HANDOFF.md)

Recipe templates and versioning · brew logging with diffs against the recipe · flavour sliders + radar chart · TDS/extraction chart · grind-vs-drawdown trends · compare brews · practice-day conclusions · rehearsal timer with pour cues · bean inventory · water calculator · rules viewer · export.

## Business

Free for now. Monetisation comes later; don't design anything that blocks it, but don't build for it yet.

## Priorities

Make it work well first. Reliability, speed and a great core logging experience matter more than feature count.

## Brand and design

Not decided yet. A design system will be created in the design phase. Keep the name as a placeholder until then.

## Technical direction

- **Backend: Supabase**, chosen because it's the simplest option for now: Postgres, auth (registration and login), row-level security for private/public recipes, and storage for profile and recipe photos.
- The prototype used Google Apps Script, which doesn't suit this product. Don't carry it forward.
- I'm a front-end developer and will build with Claude Code. I prefer complete, copy-paste-ready outputs.
- Accessibility matters (WCAG 2.2 AA). Mobile-first, since people use it at the brew bar.

## Open questions

- Community interactions: which of follow, like, save, comment and fork/remix are in Phase 2, and which come later?
- Events and news: curated by us, submitted by users, or pulled from outside sources? How is it moderated?
- Moderation and reporting for public recipes, profiles and comments.
- Web app, installable PWA or native mobile app first?
- Who is the first audience to launch to (for example, the Malaysian specialty coffee community)?
