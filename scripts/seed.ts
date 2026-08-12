/**
 * Bulk-loads the inventory from a CSV, so 150 items can be typed into a
 * spreadsheet instead of tapped into a phone.
 *
 *   npm run seed:dry                  parse and validate, touch nothing
 *   npm run seed                      write sample-data.csv to Firestore
 *   npm run seed -- my-stuff.csv      write another file
 *
 * Flags:
 *   --dry-run                         print the plan and exit
 *   --create-missing-containers       allow codes not in src/data/defaults.ts
 *   --replace-items                   delete every existing item first
 *
 * Credentials: Firestore rules are locked to one UID, so this runs with admin
 * credentials rather than as that user. See the README for the two-minute
 * service-account step.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cert, getApps, initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { parseItemsCsv } from '../src/data/csv'
import { DEFAULT_CONTAINERS, DEFAULT_ZONES } from '../src/data/defaults'

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--')))
const csvPath = args.find((a) => !a.startsWith('--')) ?? 'sample-data.csv'

const dryRun = flags.has('--dry-run')
const createMissing = flags.has('--create-missing-containers')
const replaceItems = flags.has('--replace-items')

/** Reads .env so `npm run seed` works straight after filling it in. */
function loadDotEnv(): void {
  let text: string
  try {
    text = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
  } catch {
    return
  }
  for (const line of text.split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!match) continue
    const value = match[2].trim().replace(/^["']|["']$/g, '')
    if (process.env[match[1]] === undefined) process.env[match[1]] = value
  }
}

function fail(message: string): never {
  console.error(`\n${message}\n`)
  process.exit(1)
}

async function main(): Promise<void> {
  loadDotEnv()

  const source = resolve(process.cwd(), csvPath)
  let text: string
  try {
    text = readFileSync(source, 'utf8')
  } catch {
    fail(`Could not read ${source}`)
  }

  const { items, issues } = parseItemsCsv(text)

  console.log(`\nRead ${csvPath}`)
  console.log(`  ${items.length} item${items.length === 1 ? '' : 's'}`)
  const goneCount = items.filter((i) => i.status === 'gone').length
  if (goneCount > 0) console.log(`  ${goneCount} marked gone`)

  if (issues.length > 0) {
    console.log(`\n${issues.length} issue${issues.length === 1 ? '' : 's'}:`)
    for (const issue of issues) console.log(`  line ${issue.line}: ${issue.message}`)
  }

  if (items.length === 0) fail('Nothing to write.')

  // Every code the CSV refers to has to correspond to a real container.
  const knownCodes = new Set(DEFAULT_CONTAINERS.map((c) => c.code))
  const usedCodes = new Set(items.map((i) => i.containerCode))
  const unknown = [...usedCodes].filter((code) => !knownCodes.has(code)).sort()

  if (unknown.length > 0 && !createMissing) {
    fail(
      [
        `These container codes are not in src/data/defaults.ts: ${unknown.join(', ')}`,
        '',
        'That is usually a typo in the CSV. If the boxes are real, either add',
        'them to DEFAULT_CONTAINERS or re-run with --create-missing-containers',
        'to file them under "Not filed".',
      ].join('\n'),
    )
  }

  const containersToWrite = [
    ...DEFAULT_CONTAINERS,
    ...unknown.map((code, i) => ({
      code,
      zoneId: 'not-filed',
      label: code,
      order: 200 + i,
    })),
  ]

  console.log(`\nZones:      ${DEFAULT_ZONES.length}`)
  console.log(`Containers: ${containersToWrite.length}`)
  if (unknown.length > 0) console.log(`  including new: ${unknown.join(', ')}`)

  if (dryRun) {
    console.log('\nDry run. Nothing was written.\n')
    return
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID ?? undefined
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS

  if (!projectId) {
    fail(
      'No project id. Set VITE_FIREBASE_PROJECT_ID in .env (or FIREBASE_PROJECT_ID in the environment).',
    )
  }

  if (getApps().length === 0) {
    if (serviceAccountPath) {
      const key = JSON.parse(readFileSync(resolve(serviceAccountPath), 'utf8'))
      initializeApp({ credential: cert(key), projectId })
    } else {
      // Falls back to `gcloud auth application-default login` credentials.
      initializeApp({ credential: applicationDefault(), projectId })
    }
  }

  const db = getFirestore()
  console.log(`\nWriting to project ${projectId}`)

  if (replaceItems) {
    const existing = await db.collection('items').get()
    console.log(`Deleting ${existing.size} existing item${existing.size === 1 ? '' : 's'}`)
    for (const chunk of chunked(existing.docs, 400)) {
      const batch = db.batch()
      for (const doc of chunk) batch.delete(doc.ref)
      await batch.commit()
    }
  }

  // Zones and containers: create if absent, never overwrite. A label edited in
  // the console should survive a reseed.
  let createdZones = 0
  for (const zone of DEFAULT_ZONES) {
    const ref = db.collection('zones').doc(zone.id)
    if ((await ref.get()).exists) continue
    await ref.set({ name: zone.name, order: zone.order })
    createdZones++
  }

  let createdContainers = 0
  for (const container of containersToWrite) {
    // The code IS the document id.
    const ref = db.collection('containers').doc(container.code)
    if ((await ref.get()).exists) continue
    await ref.set({
      zoneId: container.zoneId,
      label: container.label,
      order: container.order,
    })
    createdContainers++
  }

  // Skip names that already exist, so re-running after adding rows to the
  // spreadsheet tops up rather than duplicating.
  const existingItems = await db.collection('items').get()
  const existingNames = new Set(
    existingItems.docs.map((d) => String(d.data().name ?? '').trim().toLowerCase()),
  )

  const toWrite = items.filter((item) => !existingNames.has(item.name.trim().toLowerCase()))
  const skipped = items.length - toWrite.length

  const now = Timestamp.now()
  for (const chunk of chunked(toWrite, 400)) {
    const batch = db.batch()
    for (const item of chunk) {
      batch.set(db.collection('items').doc(), {
        name: item.name,
        aliases: item.aliases,
        containerCode: item.containerCode,
        status: item.status ?? 'have',
        qty: item.qty,
        notes: item.notes,
        createdAt: now,
        lastSeenAt: now,
      })
    }
    await batch.commit()
  }

  console.log(`\nDone.`)
  console.log(`  zones created:      ${createdZones}`)
  console.log(`  containers created: ${createdContainers}`)
  console.log(`  items written:      ${toWrite.length}`)
  if (skipped > 0) {
    console.log(`  items skipped:      ${skipped} (a record with that name already exists)`)
  }
  console.log('')
}

function chunked<T>(list: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

main().catch((error) => {
  console.error('\nSeed failed:', error instanceof Error ? error.message : error, '\n')
  process.exit(1)
})
