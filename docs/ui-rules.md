# UI rules

The checklist the `ui-reviewer` subagent reads screenshots against (see `.claude/agents/ui-reviewer.md`). Add a rule when a review finds something new; keep each one checkable by looking at a screenshot.

1. **Follow the prototype's layout** (`aaron1999x/Brew-Recipe`) for screens it also has: same order, same grouping, same wording. List any difference in `docs/progress.md`.
2. **No card inside a card; one heading per card.** A chart or list inside a card has no frame and no second title of its own.
3. **Cards in the same row share the same top and the same height.**
4. **No orphan tiles or lone fields on a row**, unless it is the last item. Three tiles fill one row; four fields fill a row of four.
5. **One chip size, one field height, one button size per role.** Hot/Warm/Cool and flavour chips are the same component and height; inputs share the field height; the Save buttons at the top and at the end of a form match in size and style.
6. **A title and its badges sit on one line** (recipe name and version chip, as on the recipe page).
7. **Hints are one short line** and never make one field taller than its neighbours in the row.
8. **Text and numbers never wrap mid-value; labels never break.** Only a muted sub-line may wrap.
9. **Charts get enough room:** a radar is at least 320 px wide on desktop, with no frame and no visible title of its own inside a card.
10. **Wide layout by default** (the recipe page's width, two columns when the page container is wide enough (about 56rem)). Narrow only for auth (28rem) and settings (40rem). The timer screens are a centred phone-width column.
11. **Nothing scrolls sideways** at 390 px or 1280 px, and nothing is cut off at the edge.
12. **Targets and states are never colour alone**: an icon and words go with every In range / Below / Above and every error.
13. **Every page uses `PageShell`; layouts respond to their container.** The shell sets the width (wide by default, narrow for auth and settings, timer for the timer screens), a unit test fails for a page outside it, and card grids and tile rows switch columns with container queries so a narrow container stacks them instead of overflowing. Tiles never cut off or overflow their text.
