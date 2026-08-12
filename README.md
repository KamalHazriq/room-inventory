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

One addition beyond the four screens: the container picker on **Add item** has
a **New container…** row, so a new box can be filed without re-running the seed
script. It is a small inline form, not a fifth screen.
