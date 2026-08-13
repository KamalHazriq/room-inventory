# room-inventory

A personal room inventory PWA. One room, a storage trolley, labelled boxes. It
answers two questions in under five seconds on an iPhone:

1. Do I already own this, or do I need to buy it?
2. I own it, but where did I put it?

Vite + React + TypeScript, Tailwind, Firebase (Firestore + Google sign-in),
installable PWA, deployed to GitHub Pages.

- [PROMPT.md](PROMPT.md) — the brief. Where it and anything else disagree, it wins.
- [BUILD-ORDER.md](BUILD-ORDER.md) — what to build before Firebase exists.
- [DESIGN-CHECK.md](DESIGN-CHECK.md) — how the UI is kept from drifting generic.

---

## Run it now, without Firebase

```bash
npm install
npm run dev:local
```

Opens on `http://localhost:5173/room-inventory/` with the inventory from
[sample-data.csv](sample-data.csv) in `localStorage` and auth stubbed as signed
in. Every screen and every action works. Reset it by clearing the site's
`localStorage`.

**Local mode has no access control at all.** `vite.config.ts` throws if you try
to run `npm run build` with `VITE_DATA_MODE=local`, because a local-mode bundle
on GitHub Pages would make the whole inventory world-readable.

## Run it against Firebase

```bash
cp .env.example .env      # then fill it in, see below
npm run dev
```

---

## Firebase setup

### 1. Create the project

[console.firebase.google.com](https://console.firebase.google.com) → **Add
project**. Analytics is not needed.

- **Build → Firestore Database → Create database.** Production mode. Pick a
  region near you; it cannot be changed later.
- **Build → Authentication → Get started → Google.** Enable it, set a support
  email, save. Google is the only provider this app uses.
- **Project settings → General → Your apps → Web (`</>`).** Register the app.
  Copy the `firebaseConfig` values into `.env`.

### 2. Environment variables

Copy `.env.example` to `.env`. `.env` is gitignored.

| Variable | Where it comes from |
| --- | --- |
| `VITE_DATA_MODE` | `firebase` (default) or `local` |
| `VITE_FIREBASE_API_KEY` | Project settings → General → Your apps |
| `VITE_FIREBASE_AUTH_DOMAIN` | same |
| `VITE_FIREBASE_PROJECT_ID` | same |
| `VITE_FIREBASE_STORAGE_BUCKET` | same |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | same |
| `VITE_FIREBASE_APP_ID` | same |
| `VITE_ALLOWED_UID` | your UID, see below |

**None of these are secrets.** The Firebase web API key is a project
identifier, not a credential, and it ships in the JavaScript bundle no matter
where you put it. The Firestore rules are the lock.

`VITE_ALLOWED_UID` is presentation only: it is what makes a signed-in stranger
see "this account does not have access" instead of a dead screen. It is not
access control. If you leave it blank the app still behaves correctly — it
falls back to detecting the rules rejection — it just takes one round trip
longer to say so.

### 3. Find your UID

1. Run the app and sign in with Google once. This creates the auth record.
2. Firebase console → **Authentication → Users**.
3. Copy the value in the **User UID** column.

Paste it in two places: `VITE_ALLOWED_UID` in `.env`, and the rules below.

### 4. Firestore rules

In [firestore.rules](firestore.rules), and in the console under **Firestore
Database → Rules**. Replace `PASTE_YOUR_UID_HERE`, then **Publish**.

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isOwner() {
      return request.auth != null
          && request.auth.uid == 'PASTE_YOUR_UID_HERE';
    }

    match /zones/{zoneId} {
      allow read, write: if isOwner();
    }

    match /containers/{code} {
      allow read, write: if isOwner();
    }

    match /items/{itemId} {
      allow read, write: if isOwner();
    }

    // Anything not named above is denied outright.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

This is the entire security model. The URL is public; the data is not. Anyone
who finds the URL gets a sign-in screen, and if they sign in with their own
Google account they get an access-denied screen, because these rules run on
Google's servers and reject every read. There is deliberately no password
screen, no secret env var, and no client-side check standing in for this.

### 5. Authorized domains

**Authentication → Settings → Authorized domains → Add domain.**

Add `kamalhazriq.github.io`.

`localhost` is there by default, so sign-in works locally and fails in
production if you skip this. The failure message is unmistakable — the app
surfaces "this domain is not in the Firebase authorized domains list" rather
than a generic error.

---

## Loading the inventory from a spreadsheet

`scripts/seed.ts` reads a CSV of `name,aliases,containerCode,status,qty,notes`
and bulk-writes it, so 150 items can be typed into a spreadsheet instead of
tapped into a phone. It also creates the zones and containers, including `OUT`,
if they do not exist.

```bash
npm run seed:dry                 # parse and validate, write nothing
npm run seed                     # write sample-data.csv
npm run seed -- my-stuff.csv     # write your own file
```

Flags: `--create-missing-containers` allows codes that are not in
`src/data/defaults.ts` (they land in the "Not filed" zone), and
`--replace-items` clears the items collection first. Without the first flag an
unrecognised code is a hard stop, because it is usually a typo rather than a
new box.

Re-running is safe: zones and containers are only created if absent, and items
whose name already exists are skipped rather than duplicated.

Blank `status` defaults to `have`, blank `qty` to `1`. Aliases live in one
comma-separated column, so quote them: `"charger,brick"`. Semicolons and pipes
work too.

### Rehearse it against the emulator

Worth doing before pointing a 150-row spreadsheet at real data. No Google
account, no credentials, nothing to undo:

```bash
npx firebase-tools emulators:start --only firestore --project demo-room-inventory
# in another terminal
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-room-inventory npm run seed
```

The script detects `FIRESTORE_EMULATOR_HOST` and skips credentials entirely,
since the emulator authenticates nobody.

**Credentials.** The rules are locked to your UID, so the script runs with
admin credentials instead of as that user. Either:

- **Project settings → Service accounts → Generate new private key**, then
  `export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json`. Keep that file out
  of the repo — it *is* a real credential, unlike anything in `.env`.
- Or `gcloud auth application-default login`, if you have the gcloud CLI.

The project id is read from `.env`, so nothing else needs setting.

---

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds and deploys on every push to `main`, and
on demand from the Actions tab.

1. **Settings → Pages → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → New repository secret**, one
   per `VITE_*` variable in the table above.
3. Push to `main`.

The site lands at `https://kamalhazriq.github.io/room-inventory/`.

A free GitHub account can only serve Pages from a **public** repository. The
code being public is fine — the Firestore rules are what protect the data — but
if the repo itself needs to stay private, see Cloudflare below.

Four things about Pages that break a PWA silently, all already handled:

- `base` is `/room-inventory/` in `vite.config.ts`, and the router uses a
  matching basename.
- The manifest's `start_url` and `scope` use that same path, or iOS installs
  the app to the wrong scope.
- `dist/404.html` is written as a copy of `index.html` at build time, so
  refreshing on `/c/T2` does not 404. Pages has no rewrite support.
- `kamalhazriq.github.io` must be in Firebase's authorized domains.

### Cloudflare Pages, the alternative

Connect the repo at Cloudflare Pages, build command `npm run build`, output
directory `dist`. No base-path problem (set `base` back to `/`), it deploys
from a **private** repo on the free plan, and SPA rewrites are native so the
`404.html` copy is unnecessary. Cloudflare Access on the free tier can put an
email one-time-code wall in front of the whole site, which is a second lock in
front of the Firebase one. If you use Access, set a long session duration — a
re-auth redirect inside an installed PWA is irritating.

---

## Installing on the iPhone

Safari → Share → **Add to Home Screen**.

An installed PWA has storage separate from Safari, so you will sign in again
the first time you open it from the Home Screen. That is expected, not a bug.
After that, `browserLocalPersistence` keeps the session across app restarts.

Sign-in uses `signInWithPopup` rather than `signInWithRedirect`, because
redirect flows have been unreliable inside installed iOS PWAs thanks to Safari
storage partitioning.

---

## Design

The tokens, type and chip design in [PROMPT.md](PROMPT.md) are the design
system; there is no second one. Six colours per scheme, Instrument Sans for UI,
IBM Plex Mono for codes, quantities and timestamps.

The six tokens are wired into the Tailwind theme in `src/index.css`, which also
does this:

```css
@theme {
  --color-*: initial;
}
```

That wipes Tailwind's default colour namespace. `bg-gray-100`, `text-blue-500`,
even `bg-white`, do not merely go unused — they do not compile. The palette
cannot leak by accident.

```bash
npm run design-check              # the DESIGN-CHECK.md checklist, as a script
npm run design-check -- --build   # also proves the banned utilities don't compile
```

It runs [impeccable](https://github.com/pbakaus/impeccable)'s detectors too
(installed as a devDependency).

---

## Checks

```bash
npm test          # search ranking, CSV parsing, container and zone moves, time
npm run typecheck
npm run design-check
npm run contrast  # WCAG audit of the tokens, both schemes
```

`.github/workflows/checks.yml` runs all of these on every pull request and on
every branch push; `deploy.yml` runs them again on main before deploying, so a
direct push to main is gated too. Both also assert that a local-mode production
build is **refused** — that bundle has no access control, and it must never
reach Pages.

The tests concentrate on the parts with real logic and real edge cases: the
search ranking, the CSV reader, and the container operations that have to carry
their contents with them. Search in particular earned its suite — an early
version matched the query as one contiguous string, so `anker charger` found
nothing at all while "Anker 65W charger" sat in the box.

## How search matches

Every word in the query has to land somewhere on the item — name, aliases,
container code or notes — in any order, and the item is ranked by its weakest
word. A contiguous run of the whole query in the name still wins outright, so
typing the start of a name puts it top.

That means `anker charger`, `charger anker` and `black pens` all work.

If a word matches nothing exactly, it gets one more chance against the name and
alias words, within a small edit budget — so `hmdi` finds HDMI and `scissers`
finds Scissors. Two rules keep that from becoming noise:

- A fuzzy hit sits **below every exact tier**, so a typo can never displace
  something the query genuinely matched.
- Words shorter than four characters are never fuzzy-matched, because at that
  length a typo is indistinguishable from a different word — `cat` and `car`
  are one edit apart.

Swapping two adjacent letters counts as **one** edit, not two. That is the
whole reason the feature works: transposition is what thumbs actually do, and
under plain Levenshtein `hmdi` is two edits from `hdmi` and would fall outside
the budget a four-letter word gets.

Duplicate detection on Add item deliberately ignores fuzzy matches. Finding
something is one question; refusing to let you add something is another.

## Offline

Firestore's IndexedDB cache is on, so the app opens with the last known
inventory when there is no signal, and edits made in a dead spot queue and sync
when there is one again. The search screen says `Offline — changes will sync`
while that is the case.

One thing worth knowing about the implementation: a Firestore write promise does
not settle until the server acknowledges it, so offline it stays pending
forever. `settleOrQueue` in `src/data/firebaseRepo.ts` gives the server a moment
to object — a rules rejection arrives fast and still surfaces — then lets the
interface move on, since the write is already in the local cache and the
outbound queue by then.

## Accessibility

Every screen has an `<h1>`, focus moves to the top of the screen on navigation,
and the search result count is announced to screen readers as you type. The
container screen's heading carries an `aria-label` so it reads as "Container T2,
Trolley tier 2" rather than as two letters.

**One open conflict, not fixed on purpose.** `npm run contrast` audits both
schemes against WCAG AA:

```
light
  FAIL   4.27:1   muted on bg    labels, counts, timestamps
```

`--muted` `#71767B` on `--bg` `#F6F7F5` is **4.27:1**, just under the 4.5:1 that
AA asks for normal text. Everything else passes in both schemes, comfortably —
the chip is 6.97:1 and body text is 16.42:1.

DESIGN-CHECK.md says tokens are law and conflicts get reported rather than
acted on, so the token is untouched. If you want it fixed, darkening `--muted`
by 3% to `#6E7277` reaches 4.51:1 and is imperceptible next to the current
value. Your call — one line in `src/index.css`.

Hairline dividers are excluded from the audit rather than failing it. WCAG's
non-text contrast rule covers UI components and meaningful graphics; a
decorative separator between two rows is neither, and the brief asks for them
to be quiet.

## Desktop keyboard

The phone is the point, but bulk entry happens at a desk.

| key | |
| --- | --- |
| `/` | jump to the search field from anywhere on the search screen |
| `Enter` | open the top result |
| `Escape` | clear the query |

The search field also autofocuses on desktop, and deliberately does not on a
phone, where an instant keyboard covers half the screen.

## Updates

The service worker uses `registerType: 'prompt'`, not `autoUpdate`. When a new
version has downloaded, a quiet "New version ready. Reload" appears; ignoring it
is a valid choice. The app never replaces itself while you are halfway through
adding an item.

## Bundle

The Firebase SDK is most of the JavaScript here, and it loads in three pieces
rather than one:

| chunk | gzip | when |
| --- | --- | --- |
| app shell | 84 KB | first paint |
| firebase auth | 35 KB | to render the sign-in gate |
| firestore | 98 KB | only once you are signed in |

`src/data/index.ts` imports both data implementations dynamically, and
`src/data/firebase.ts` deliberately imports neither `firebase/auth` nor
`firebase/firestore` — a shared import there would collapse the last two rows
back into one chunk that has to arrive before anything paints.

---

## Things left undone, deliberately

Waiting on the Firebase console:

- [ ] Firebase project created, Firestore and Google sign-in enabled
- [ ] `.env` filled in
- [ ] Your UID pasted into `firestore.rules` and published
- [ ] `kamalhazriq.github.io` added to Firebase authorized domains
- [ ] Pages enabled on this repo, Actions secrets set

Not built, per the brief: photos, voice, barcodes, categories, prices, sharing,
dashboards, move history, a separate "checked out" flag, and any client-side
gate pretending to be security.

## Beyond the four screens

Two additions, both agreed rather than assumed, and neither is a fifth screen:

**Containers are fully editable.** The picker on Add item has a **New
container…** row. The container screen has **Edit container** (code, label,
zone) and **Delete container**. Renaming a code rewrites every item inside it in
one batch, because the code *is* the document id. Deleting a container refiles
its contents into `OUT` rather than orphaning them, and says so before you
confirm. `OUT` itself cannot be deleted, since it is where everything else
lands.

**Add item warns about duplicates.** Typing a name that closely matches
something you already own shows a quiet line — "You may already have this: HDMI
cable 2m in T2" — tappable straight through to the item. Name matches only; a
word buried in someone's notes is not a duplicate.

**Zones are editable too.** The zone control on any container form adds, renames
and deletes zones inline — no screen of its own, since zones change about twice
a year. Deleting a zone moves its containers to "Not filed", which is why "Not
filed" itself cannot be deleted. Zone ids are derived from the name
(`Behind the door` → `behind-the-door`) so a document is legible in the console,
with a numeric suffix if two zones ever share a name.

The seed script still creates the starting zones and containers from
`src/data/defaults.ts`.
