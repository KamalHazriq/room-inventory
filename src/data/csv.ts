import type { ItemStatus, NewItem } from './types'

/**
 * Minimal RFC 4180 reader. Aliases live in one comma-separated column, so the
 * field has to be quoted in the file and the parser has to honour the quotes
 * rather than splitting the line naively.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let i = 0

  // Excel writes a BOM; it would otherwise end up inside the first header name.
  if (text.charCodeAt(0) === 0xfeff) i = 1

  for (; i < text.length; i++) {
    const ch = text[i]

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\r') {
      // handled by the \n branch
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

export interface CsvIssue {
  line: number
  message: string
}

export interface CsvResult {
  items: NewItem[]
  issues: CsvIssue[]
}

/** Aliases are comma separated, but a spreadsheet may have used ; or | instead. */
function parseAliases(raw: string): string[] {
  return raw
    .split(/[,;|]/)
    .map((a) => a.trim())
    .filter(Boolean)
}

const HEADERS = ['name', 'aliases', 'containerCode', 'status', 'qty', 'notes'] as const

/**
 * Reads `name,aliases,containerCode,status,qty,notes`. A blank status defaults
 * to `have`; a blank qty defaults to 1. Bad rows are reported rather than
 * silently dropped, so a typo in a 150-row spreadsheet is visible.
 */
export function parseItemsCsv(text: string): CsvResult {
  const rows = parseCsv(text)
  const issues: CsvIssue[] = []
  const items: NewItem[] = []

  if (rows.length === 0) return { items, issues: [{ line: 0, message: 'File is empty.' }] }

  const header = rows[0].map((h) => h.trim().toLowerCase())
  const index = new Map<string, number>()
  for (const key of HEADERS) {
    const at = header.indexOf(key.toLowerCase())
    if (at !== -1) index.set(key, at)
  }

  if (!index.has('name') || !index.has('containerCode')) {
    return {
      items,
      issues: [
        {
          line: 1,
          message: `Header must include at least name and containerCode. Found: ${header.join(', ')}`,
        },
      ],
    }
  }

  const cell = (row: string[], key: (typeof HEADERS)[number]) => {
    const at = index.get(key)
    return at === undefined ? '' : (row[at] ?? '').trim()
  }

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const line = r + 1
    const name = cell(row, 'name')
    const containerCode = cell(row, 'containerCode').toUpperCase()

    if (!name) {
      issues.push({ line, message: 'Skipped: no name.' })
      continue
    }
    if (!containerCode) {
      issues.push({ line, message: `Skipped "${name}": no containerCode.` })
      continue
    }

    const rawStatus = cell(row, 'status').toLowerCase()
    let status: ItemStatus = 'have'
    if (rawStatus === 'gone') {
      status = 'gone'
    } else if (rawStatus && rawStatus !== 'have') {
      issues.push({
        line,
        message: `"${name}": status "${rawStatus}" is not have or gone, using have.`,
      })
    }

    const rawQty = cell(row, 'qty')
    let qty = 1
    if (rawQty) {
      const parsed = Number(rawQty)
      if (Number.isFinite(parsed) && parsed > 0) {
        qty = Math.round(parsed)
      } else {
        issues.push({ line, message: `"${name}": qty "${rawQty}" is not a number, using 1.` })
      }
    }

    items.push({
      name,
      aliases: parseAliases(cell(row, 'aliases')),
      containerCode,
      status,
      qty,
      notes: cell(row, 'notes'),
    })
  }

  return { items, issues }
}
