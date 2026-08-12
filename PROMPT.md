# Room Inventory PWA — build brief

Paste this whole file to Claude Code as the first message.

---

Build a personal room inventory PWA. Read this whole brief before writing any code, then build it in one pass.

## The problem it solves

I have one room with a storage trolley and labelled boxes. Two questions come up constantly:

1. "Do I already own this, or do I need to buy it?"
2. "I own it, but where did I put it?"

Everything in this app exists to answer those two questions in under five seconds on an iPhone. Nothing else.

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- Firebase Firestore for data, Firebase Auth with Google sign-in for the single user
- Installable PWA (manifest + service worker), deployed to GitHub Pages via GitHub Actions
- No object storage, no image uploads, no server of my own

Firebase config comes from env vars. Ship a `.env.example` and never hardcode keys.

## Data model

Three Firestore collections. Roughly 50 to 200 items total, so optimise for simplicity, not scale.

```
zones/{id}
  name: string            // "Trolley", "Wardrobe", "Desk", "Under-bed"
  order: number

containers/{code}         // doc id IS the code: "T2", "W-A", "D-1"
  zoneId: string
  label: string           // "Trolley tier 2"
  order: number

items/{id}
  name: string
  aliases: string[]       // alternate words I might search: ["charger", "brick"]
  containerCode: string
  status: 'have' | 'gone' // default 'have'
  qty: number             // default 1
  notes: string
  createdAt: timestamp
  lastSeenAt: timestamp
```

Seed one special container: code `OUT`, label "Out of storage", in a zone called "Not filed". Moving an item there is how I record having taken something out and not put it back yet. It is an ordinary container, so no special code path is needed.

**`status: 'gone'` and Delete are different things and must stay different.** `gone` means the record was correct and the thing no longer exists: used up, given away, thrown out, broken. Delete means the record itself was a mistake. Keeping `gone` items is the whole point, because "you had four of these and used the last one" is a much better answer to "do I already own this" than an empty result.

Do not use `qty: 0` to mean gone. Most items have a meaningless qty of 1 and I am not going to decrement anything.

Search strategy: on app open, fetch all items and all containers once into React state. Filter entirely client side. At 200 items this is instant and gives better fuzzy matching than any server query. Do not paginate. Do not build server-side search.

The match should be case-insensitive substring across `name`, `aliases`, `containerCode` and `notes`, with matches on `name` ranked first.

Items with `status: 'gone'` are excluded from normal results. When a query returns fewer than three live results, show matching `gone` items below a hairline rule, dimmed, under the heading "No longer have". They are not tappable-to-nowhere: tapping still opens item detail so I can mark it back.

Firestore security rules: lock every collection to a single hardcoded UID. Print the rules and tell me where to paste my UID.

## Screens

Four, single column, no nav bar. An auth gate sits in front of all of them, described under Deployment and auth below.

**1. Search (home)**
- Search field pinned at the top, autofocused on desktop but NOT on mobile (an instant keyboard is annoying)
- Live results as I type
- Each result row: item name, and the container code chip right-aligned
- Empty query state: show the containers list instead, so the screen is never blank
- No results state: the message doubles as the add action, e.g. "No match for 'hdmi'. Add it?"
- Add button anchored bottom-right, thumb-reachable

**2. Add item**
- Fields: name, aliases (comma separated, one input), container (picker), qty, notes
- Container picker defaults to the last container I used in this session
- Qty and notes are collapsed behind a "More" toggle, since 90% of adds are name + container
- One save action, then straight back to search with the field cleared

**3. Container view**
- Reached by tapping a code chip anywhere
- Header: the code as a large display element, the label beneath it
- Below: every item in this container
- This is the reverse lookup. I am standing there holding box T2 and want to know what should be inside it. Make that read well.
- On the empty-query home screen, sort `OUT` to the bottom of the containers list and show its count. A non-zero count there is a nudge to put things away.

**4. Item detail**
- Name, aliases, container, qty, notes
- Actions: Move (changes container), Edit, Delete with confirm
- A "Confirm it's here" action that stamps `lastSeenAt`
- "Mark as gone" and, on a gone item, "Have it again". Both are one tap with no confirm dialog, because both are trivially reversible
- Delete stays visually separate from "Mark as gone" so I do not hit the wrong one. Gone is the everyday action, delete is the rare one
- Show `lastSeenAt` as relative time, quietly

## Design direction

Minimalist, premium, sleek. Light and dark mode, following system preference with a manual override persisted to `localStorage`. Follow these tokens exactly, do not substitute your own palette.

**Colour, light**
```
--bg:      #F6F7F5
--surface: #FFFFFF
--ink:     #17191A
--muted:   #71767B
--rule:    #E2E5E1
--accent:  #2F5D50
```

**Colour, dark**
```
--bg:      #0F1211
--surface: #171B1A
--ink:     #ECEFEC
--muted:   #8A918D
--rule:    #262B29
--accent:  #6FBFA5
```

**Type**
- UI and body: Instrument Sans (Google Fonts). Do not use Inter.
- Container codes, quantities, timestamps: IBM Plex Mono
- Set a real type scale. Item names sit at a comfortable reading size with normal weight, not bold. Let hierarchy come from spacing and colour, not from weight escalation.

**Signature element: the code chip.** The container code is the one loud thing in this interface. Render it as uppercase IBM Plex Mono, letterspaced, inside a hairline box with a small radius, accent-coloured. It should read like a label written on masking tape and stuck to a box, because that is exactly what its physical counterpart is. On the container screen, the same code scales up to become the page's masthead.

Everything else stays quiet: hairline dividers instead of card borders, generous vertical rhythm, one accent colour used only on the chip and the primary action. No shadows, no gradients, no glassmorphism, no coloured category badges.

**Layout:** single column, max-width around 560px, centred. Comfortable tap targets, minimum 44px. Bottom padding that clears the iPhone home indicator via `env(safe-area-inset-bottom)`.

**Motion:** almost none. Results fade in with a 20ms stagger, the theme toggle cross-fades. Respect `prefers-reduced-motion`. Resist adding anything else.

**Copy:** plain, active voice, sentence case. Buttons say what happens: "Save item", not "Submit". Empty states are invitations to act, not apologies.

Avoid the current AI-design defaults. Specifically: no cream background with a serif display face and terracotta accent, no near-black with acid green, no broadsheet hairline-grid look. The tokens above are the brief, build to them.

## iOS specifics

I use an iPhone and will install this to the Home Screen from Safari.

- Web app manifest with `display: standalone`, correct `theme-color` for both colour schemes, and all required icon sizes
- Service worker that caches the app shell so it opens instantly, with a network-first strategy for Firestore
- No `getUserMedia`, no Web Speech API, no push notifications
- Test that the layout survives the standalone status bar and the home indicator

## Deployment and auth

I am the only user. The URL will be public, the data must not be.

**The security model, so you build to it and do not over-engineer:** anyone who finds the URL loads the page and hits a Google sign-in screen. They cannot read a single document, because Firestore rules are enforced server side by Google. The Firebase API key in the bundle is a project identifier, not a credential, and does not need hiding. The rules are the lock. Do not add a homemade password screen, an env-var "secret", or any client-side check as a substitute.

**Auth implementation**
- Firebase Auth, Google provider only
- Use `signInWithPopup`, not `signInWithRedirect`. Redirect flows have been unreliable inside installed iOS PWAs because of Safari storage partitioning
- Set `browserLocalPersistence` so I sign in once and the session survives app restarts
- An installed PWA has storage separate from Safari, so expect to sign in again the first time I open it from the Home Screen. That is normal, not a bug to work around

**Three auth states, all of which need real UI, not spinners**
1. Signed out: a quiet centred sign-in screen, one button, no marketing copy
2. Signed in and authorised: the app
3. Signed in but NOT the allowed UID: a plain "This account does not have access" screen with a sign-out button. Someone else can create an auth record by signing in with their own Google account, and the rules will reject them. Do not let that case render as an infinite loading state

**Firestore rules:** lock all collections to one hardcoded UID. Print the rules in the README with an obvious `PASTE_YOUR_UID_HERE` placeholder, and tell me how to find my UID in the Firebase console.

**GitHub Pages specifics.** These break the PWA silently if wrong, so get them right:
- Set Vite `base` to `/<repo-name>/` and give the router a matching basename
- Manifest `start_url` and `scope` must match that same base path, or the app will not install correctly
- Copy `index.html` to `404.html` at build time so deep links and refreshes do not 404, since Pages has no rewrite support
- Add `<username>.github.io` to Firebase Authentication, Settings, Authorized domains. Sign-in will work locally and fail in production if this is missed
- Ship a GitHub Actions workflow that builds and deploys on push to main, reading the Firebase config from repo secrets
- Note in the README that a free GitHub account can only serve Pages from a public repo

**Also document the Cloudflare Pages alternative** in the README, in about five lines: no base path problem, works from a private repo, native SPA rewrites, and Cloudflare Access on the free tier can put an email OTP wall in front of the whole site. If I use Access, set a long session duration, because a re-auth redirect inside an installed PWA is irritating.

## Do not build

Genuinely leave these out. I will ask if I want them.

- Photos or any image upload
- Voice input
- Barcode scanning
- Categories, tags, or a taxonomy
- Purchase dates, prices, warranties, lending tracking
- Multi-user support or sharing
- Dashboards, charts, or statistics
- Dark mode as a third "auto/light/dark" carousel. Two states plus system default is enough.
- A move history or audit log. `containerCode` plus `lastSeenAt` is enough.
- A separate "checked out" or "in use" boolean. That is what the `OUT` container is for. Two fields that can disagree with each other is worse than one.
- Email/password auth, multiple sign-in providers, account settings, or any user management. One Google account, one UID in the rules.
- Any client-side gate that pretends to be security. The Firestore rules are the only access control.

## Deliverables

1. The working app
2. `README.md` with: Firebase project setup, the Firestore rules with the UID placeholder and how to find my UID, authorized domains, env vars, local dev, the GitHub Pages deploy, and the short Cloudflare Pages alternative
3. A `.github/workflows/deploy.yml` that builds and deploys to GitHub Pages on push to main
4. A `scripts/seed.ts` that reads a CSV of `name,aliases,containerCode,status,qty,notes` and bulk-writes to Firestore, so I can enter 150 items in a spreadsheet instead of tapping them into a phone. It should also create the zones and containers, including `OUT`, if they do not exist. Blank `status` defaults to `have`
5. A `sample-data.csv` with about 15 realistic rows covering cables, adapters, stationery and spare parts, using container codes T1, T2, T3, W-A and D-1. Include one row sitting in `OUT` and two rows with `status: gone`, so I can see both states working immediately

Before you start coding, show me your file structure and confirm the design tokens you will use. Then build the whole thing.
