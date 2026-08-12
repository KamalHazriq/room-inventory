# Build order

Addendum to [PROMPT.md](PROMPT.md). Read both before writing code. Where the two disagree, PROMPT.md wins.

## Ask first

I am on a phone. Before you write any code, ask me everything ambiguous **in one batch** — a numbered list I can answer in a single message. Do not drip-feed one question at a time. Then show the file structure and confirm the design tokens, as the brief asks, and build.

## Build now, without me

I have not created the Firebase project yet, so anything needing my console access cannot be finished. Build everything else, complete and working:

- All four screens, the design tokens, the code chip, light and dark
- The full client-side search, the name-first ranking, the "No longer have" section
- Every CRUD path: add, edit, move, delete, mark gone, have it again, confirm it's here
- PWA manifest and service worker
- `scripts/seed.ts` and `sample-data.csv`
- `.github/workflows/deploy.yml` and `.env.example`
- README, including the Firestore rules with the UID placeholder

## Make it runnable without Firebase

Put all data access behind one module — `src/data/repo.ts` or similar — with two implementations chosen by `VITE_DATA_MODE`:

- `local` — in-memory, seeded from `sample-data.csv`, persisted to `localStorage`. Auth stubbed as signed in.
- `firebase` — the real thing from the brief.

Same interface both sides, so switching later is an env change rather than a rewrite. Default to `firebase`.

**Safety rail:** `local` mode has no access control at all. Make a production build *fail loudly* when `VITE_DATA_MODE=local` — a thrown error in `vite.config.ts`, not a console warning. If local mode ever reaches GitHub Pages, the data is world-readable and the entire security model in the brief is gone.

## Blocked on me — do not fake these

Put them in the README as a checklist and leave them undone:

- Firebase project created, Firestore and Google sign-in enabled
- `.env` values, and my UID pasted into the rules
- `KamalHazriq.github.io` added to Firebase authorized domains
- Pages enabled on this repo, and the Actions secrets set
