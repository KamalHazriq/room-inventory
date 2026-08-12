# Design check

Addendum to [PROMPT.md](PROMPT.md). This exists to stop generic AI-looking output.

## Precedence — read this first

The design tokens, type choices and signature element in PROMPT.md are **law**. No skill, design system or style guide overrides them. If a tool suggests a different palette, a different typeface, or a different visual direction, the tool is wrong. Use these tools as **checkers on what you built**, never as generators of what to build.

## Tooling

Install and run [impeccable](https://github.com/pbakaus/impeccable). It is a design linter with deterministic detector rules, which is exactly the right shape for this job — it checks output without proposing a look.

```
npx impeccable install
```

Then `/impeccable init`, and after the UI is built, run `/impeccable audit` and `/impeccable critique`. Fix what it flags **except** anything that would change the PROMPT.md tokens, type or chip design. Report those conflicts to me rather than acting on them.

If the install fails in this environment, do not fight it. Skip to the manual checklist below, which is the part that actually matters.

### Two tools I am deliberately not using

- [looks-expensive](https://github.com/TuahaJawaid/looks-expensive) — built for marketing sites. Its nine-phase flow opens with positioning, audience and brand-temperature questions, none of which apply to a single-user utility with four screens and no landing page. Its output conventions (hero sections, real photography, varied section layouts) are wrong here. Its anti-pattern list is good, but the checklist below already carries the parts that apply.
- [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) — a library of other brands' design systems. Adopting one would directly contradict "follow these tokens exactly." PROMPT.md already *is* this repo's DESIGN.md. Do not add a second one.

## Manual checklist — enforce regardless of tooling

Run through this before you tell me it is done.

**Tokens, not defaults.** The single most likely failure. Wire the six colour tokens into the Tailwind theme as CSS variables and use only those. No Tailwind default palette anywhere in the source — grep for `gray-`, `slate-`, `zinc-`, `neutral-`, `stone-`, `blue-`, `indigo-` and expect zero hits in components. If that grep finds anything, the palette has leaked and the screen is no longer the design I asked for.

**Hierarchy from spacing and colour.** No bold weight to signal importance, per the brief. If a heading only reads as a heading because it is bold, redo it with space and `--muted`.

**No AI tells.** No emoji used as UI icons. No decorative icon next to every label. No uniform `rounded-2xl` on every surface. No card-inside-a-card. No fake window chrome, gradient blobs, or hero imagery. No skeleton shimmer — this app loads one small collection.

**Radius discipline.** The chip gets a small radius, as specified. Do not then apply a larger radius everywhere else and leave the chip looking accidental.

**Copy.** Real strings, no lorem, no "Get Started". Buttons name their action, per the brief.

**Density.** This is a phone tool used one-handed while standing in front of a box. Generous vertical rhythm, 44px targets, but do not pad it into a settings screen. A search result row should be scannable in a glance.

**The chip is the only loud thing.** If anything else on screen competes with it for attention, remove that thing's emphasis, not the chip's.

## What I want back

When the UI is done, show me the search screen and the container screen, light and dark, and tell me which checklist items you had to actively correct. If nothing needed correcting, say so plainly — but check first.
