# Phase 0: Discovery

Status: **signed off 12 Nov 2026** (personas, positioning, verdicts) · Working name: *[App]* (placeholder)

---

## 1. Problem statement

Serious home brewers change their recipe almost every brew while dialling in a coffee. They keep the history in notebooks, notes apps or hand-built Notion templates, which are manual and slow at the brew bar. Versions blur together and it's hard to see which change made the cup better. When they find a recipe worth sharing, there's no easy way to hand it to a friend with the full context (coffee, gear, water, steps) so the friend can actually reproduce it.

Existing apps split the job in two. **Timer/recipe apps** replay a recipe but treat it as a static card. **Logging apps** record everything but don't show you what's improving. Nobody makes *the evolution of a recipe* the core object.

---

## 2. Personas (signed off)

| # | Persona | Who | Priority |
|---|---|---|---|
| P1 | **The Dial-in Home Brewer** | Brews pour-over daily with a scale, a gooseneck kettle and a good hand grinder. Buys 1–3 specialty bags a month and dials in each one. Already keeps notes (Notion, notes app, notebook). Shares recipes with a few brewer friends over chat. | **Primary: Phase 1 is designed for them** |
| P2 | **The Competition Brewer** | Training for a Brewers Cup (the founder is one). Brews dozens of practice cups a week against a fixed spec, and cares about time limits, serving volume, TDS/EY and rehearsal. | Secondary: early adopter and credibility; fully served in Phase 3 |
| P3 | **The Café Barista** | Dials in new bags for the bar's filter menu and passes recipes to colleagues. Brews on shared equipment. | Tertiary: served by P1's features; team features much later |
| P4 | **The Recipe Follower** | Newer to pour-over. Copies recipes from champions, roasters and friends, and wants to know "will this work with my gear?" | Phase 2: the main *consumer* of public recipes |

### P1 in detail
- **Goals:** get a new bag tasting great within a few brews; repeat their best cup; remember what worked for a roast level or origin.
- **Frustrations:** logging is slow and fiddly with wet hands; can't see what changed between v3 and v5; grind numbers don't transfer to friends' grinders; notes scattered across apps.
- **Context:** phone on the brew bar, one hand free, 3–6 minutes per brew, often early morning.
- **Today:** notes app or a Notion template (described by a user as "very manual"), sometimes a timer app alongside.

---

## 3. Jobs-to-be-done

| # | When… | I want to… | So I can… | Persona | Phase |
|---|---|---|---|---|---|
| J1 | I open a new bag | start from my best recipe for a similar coffee and gear | reach a good cup in fewer brews and less coffee | P1 P3 | 1 |
| J2 | I'm brewing | follow my steps with clear cues and no fiddling | brew consistently without memorising the schedule | P1 P2 | 1 |
| J3 | I've just tasted the cup | log the result and what I changed in under 30 seconds | build a history without it feeling like admin | P1 P2 P3 | 1 |
| J4 | A change made the cup better | save it as the next version of the recipe | keep the improvement and see the trail of what worked | P1 P2 | 1 |
| J5 | A friend asks "what's your recipe?" | send a link with the full context, and let them save, copy or brew it | have them reproduce it without a back-and-forth | P1 → P4 | 1 |
| J6 | I want something new to brew | find recipes for my coffee or brewer that others have dialled in and brewed | trust a recipe before I spend beans on it | P4 P1 | 2 |
| J7 | I'm training for a competition | rehearse under event time limits and rule checks | arrive with a recipe and routine I trust | P2 | 3 |

---

## 4. Competitor scan

Checked 12 Nov 2026, mostly from App Store listings and reviews. Store listings describe features, not quality, so treat "does badly" as signals to test in interviews, not facts.

| Product | Type | Does well | Does badly / gap |
|---|---|---|---|
| **Beanconqueror** | Deep brew/bean logger (iOS, Android) | Free, no ads, open source. Tracks beans, grinders, water, preparation tools, Bluetooth scales and flow profiling. Roasters offer one-click bean import | Very feature-dense. One reviewer found it comprehensive but not helpful for getting consistent brews. Built around logging, not a recipe that improves over time |
| **Filtru** | Guided timer + recipes + shop (iOS) | Polished guided brewing, scale support, Live Activities and widgets, champion and community recipes | Pro subscription with aggressive upsell complaints. Reviewers report rigid step editing (can't edit pour weights or add/delete steps) |
| **Timer.Coffee** | Timer + recipes + diary + community | 27 brew methods, create and share recipes, brew diary with manual entries, curated collections, custom grind per recipe | The diary logs sessions; nothing in the listing suggests version history or diffs |
| **Brew Timer** | Timer + community recipes (iOS, Android) | Many methods, custom recipes, sharing to the community | Recipe card + timer; no dial-in loop |
| **Single Origin** | Timer + brew log | Steps include waits and actions like swirling. Imports Fellow brew.link and xBloom share links. 500+ community recipes (paid) | Community behind a paywall |
| **BrewSmart** | Ratio calc + coach + log | Share links open as a web page if the friend doesn't have the app; recipe/journal image cards | Shows that "share by link" and "share card" are **already table stakes**, not differentiators |
| **Tasting Grounds** | Social brew journal ("Untappd for coffee") | Log and rate brews with tasting notes, see what friends drink, roaster catalogue | A reviewer says the global activity feed feels sparse: **direct evidence of the cold-start risk** for community features |
| **Acaia Brewguide** | Recipe DB tied to a smart scale | Roaster and user recipes, QR/link sharing | Users report recipes are hard to browse and discover |
| **Notion / notes apps** | DIY | Fully flexible, free, already in use | Manual, slow at the brew bar, no timer, no structure, no sharing with context |
| **Grinder converters** (Honest Coffee Guide, Bean Coffee) | Reference tools | Crowdsourced grind-setting tables and cross-grinder conversion | Approximate. Manufacturers measure differently (burr gap vs burr movement), so precise conversion isn't possible |

### What the scan tells us
1. **Guided timer + recipe + share link is commodity.** We need it (Phase 1 core), but it can't be why people switch.
2. **No app checked treats a recipe as a versioned object with a visible "what changed" trail.** That's the open gap, and it matches the Notion pain.
3. **Community apps struggle with empty feeds.** Community features need a seeding plan, not just features.
4. **Most competitors are native iOS-first.** A mobile-first web app/PWA works on any phone and makes share links open anywhere (decided: PWA).
5. **Grinder conversion is someone else's hard problem.** Store grind so a future conversion or link-out can use it.

---

## 5. Differentiator verdicts (signed off)

| Hypothesis | Verdict | Reasoning |
|---|---|---|
| **Recipes as living, versioned objects** | **Keep: primary wedge (Phase 1)** | Open gap in the scan, matches the Notion pain, works for one user with zero community. The "good vs bad" value is **private** (dialling in). The public value is the **trail**: "v6, dialled in over 18 brews". |
| **Brew logs as proof** | **Keep: community wedge.** "I brewed this" starts in Phase 1; public brew counts and tasting notes on recipes grow in Phase 2 | Stronger trust signal than likes; no competitor centres it. |
| **Gear-aware recipes** | **Defer filtering and conversion. Keep structured gear in Phase 1** | No reliable conversion data. Brewer, filter and kettle are portable; filtering by brewer is cheap later. Grind stored as grinder + setting text + optional microns; **drawdown time shown as the portable target**. |
| **One place from daily brewing to competition** | **Keep: long-term moat (Phase 3)** | Niche but credible; Phase 1 data model must allow time limits and rule checks later. |

---

## 6. Positioning (one sentence)

> **For serious home brewers who dial in every bag, [App] is the brew journal where recipes evolve: every version, every brew and what changed, ready to share when it's right. Unlike timer apps that replay a static recipe, or loggers that record everything without showing progress.**

Short form for a landing page: **"Your recipes, dialled in."**

---

## 7. Success path (passion project → product)

| Stage | Who | Pass when… |
|---|---|---|
| **Gate 1: Friends alpha** (Phase 1 MVP) | Aaron + 8–12 brewer friends | ≥ 6 of them log ≥ 2 brews/week for 4 straight weeks, and at least half have stopped using their old notes for brewing |
| **Gate 2: Open beta** (Phase 1 polished + Phase 2 start) | ~100 users via the Malaysian/SEA community | 4-week retention ≥ 30%; ≥ 20% of active users have a public recipe; recipe links are being opened by non-users |
| **Gate 3: Community** (Phase 2) | 1,000+ | People brew recipes they didn't write ("I brewed this" ≥ 1 per public recipe on average) |
| **Gate 4: Product** | — | Only now design monetisation. Nothing in Phases 1–3 should block it |

---

## 8. Interview guide: CAFEC Cup, 27 Nov

Aim for 5–10 conversations of about 5 minutes. Ask about the past, not hypotheticals. Write notes straight after each one.

1. Walk me through the last time you dialled in a new bag. How many brews did it take?
2. Where do you keep your recipes and notes today? Show me if you can.
3. What's annoying about that? What did you try before and stop using?
4. When you changed something between brews, how did you remember what you changed?
5. When did you last share a recipe with someone? How did you send it, and did they manage to reproduce it?
6. How do you handle grind settings when a friend uses a different grinder?
7. Have you ever brewed someone else's recipe from an app or Instagram? Did you trust it? Why or why not?
8. (Competitors only) How are you preparing for today? What tools are you juggling?

**Listen for:** how much they currently log; whether "what changed" comes up unprompted; how they share (chat, screenshot, Instagram); names of apps they've given up on.

---

## Sources
- Beanconqueror on the App Store: https://apps.apple.com/app/id1445297158
- Filtru on the App Store (US, AU, RU): https://apps.apple.com/us/app/1150921819 · https://apps.apple.com/au/app/filtru-coffee/id1150921819 · https://apps.apple.com/ru/app/filtru-coffee/id1150921819?l=en
- Filtru review summary, AppsHunter: https://appshunter.io/ios/topics/pour-over-coffee-app
- Timer.Coffee on the App Store: https://apps.apple.com/rs/app/timer-coffee/id6449322787
- Brew Timer / Filtru comparison, Homegrounds: https://www.homegrounds.co/best-coffee-apps/
- Single Origin on the App Store: https://apps.apple.com/bb/app/single-origin-coffee-timer/id1480168613
- BrewSmart on the App Store: https://apps.apple.com/app/id6745852921
- Tasting Grounds on the App Store / Apptail reviews: https://apps.apple.com/us/app/id1526958511 · https://apptail.io/app/tasting-grounds-coffee-brews-cpvc/united-states
- Acaia Brewguide reviews: https://apps.apple.com/us/app/brewguide/id1449417468?l=pt-BR
- Honest Coffee Guide grind chart: https://honestcoffeeguide.com/espresso-grind-size
- Bean Coffee grinder converter: https://beeancoffee.com/grinder-setting-converter/
- Grinder conversion limitations (r/AeroPress): https://lr.eu.psf.lt/r/AeroPress/comments/1j846e8/update_on_crowdsourced_grinder_conversion_tool
