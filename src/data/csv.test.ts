import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseCsv, parseItemsCsv } from './csv'
import { DEFAULT_CONTAINERS } from './defaults'

const HEADER = 'name,aliases,containerCode,status,qty,notes'

describe('parseCsv', () => {
  it('splits plain rows', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('keeps commas inside quoted fields', () => {
    // Aliases are one comma-separated column, so this is the whole reason the
    // parser cannot just split on commas.
    expect(parseCsv('name,aliases\nCharger,"brick,power adapter"')).toEqual([
      ['name', 'aliases'],
      ['Charger', 'brick,power adapter'],
    ])
  })

  it('unescapes doubled quotes', () => {
    expect(parseCsv('a\n"He said ""hi"""')).toEqual([['a'], ['He said "hi"']])
  })

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('strips a byte order mark', () => {
    // Excel writes one, and it would otherwise become part of the first header.
    expect(parseCsv('﻿name,aliases')).toEqual([['name', 'aliases']])
  })

  it('keeps newlines inside quoted fields', () => {
    expect(parseCsv('a\n"line one\nline two"')).toEqual([['a'], ['line one\nline two']])
  })

  it('drops entirely blank rows', () => {
    expect(parseCsv('a,b\n\n1,2\n\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('parseItemsCsv', () => {
  it('reports an empty file rather than throwing', () => {
    const { items, issues } = parseItemsCsv('')
    expect(items).toEqual([])
    expect(issues).toHaveLength(1)
  })

  it('rejects a header without the two required columns', () => {
    const { items, issues } = parseItemsCsv('nombre,caja\nCable,T1')
    expect(items).toEqual([])
    expect(issues[0].message).toContain('name and containerCode')
  })

  it('reads a full row', () => {
    const { items } = parseItemsCsv(
      `${HEADER}\nHDMI cable 2m,"hdmi,monitor cable",T2,have,2,Spare`,
    )
    expect(items[0]).toEqual({
      name: 'HDMI cable 2m',
      aliases: ['hdmi', 'monitor cable'],
      containerCode: 'T2',
      status: 'have',
      qty: 2,
      notes: 'Spare',
    })
  })

  it('defaults a blank status to have and a blank qty to 1', () => {
    const { items, issues } = parseItemsCsv(`${HEADER}\nScissors,,D-1,,,`)
    expect(items[0].status).toBe('have')
    expect(items[0].qty).toBe(1)
    expect(issues).toEqual([])
  })

  it('reads gone status', () => {
    const { items } = parseItemsCsv(`${HEADER}\nAA batteries,,T1,gone,4,`)
    expect(items[0].status).toBe('gone')
  })

  it('falls back to have on an unrecognised status, and says so', () => {
    const { items, issues } = parseItemsCsv(`${HEADER}\nThing,,T1,lost,1,`)
    expect(items[0].status).toBe('have')
    expect(issues[0].message).toContain('not have or gone')
  })

  it('falls back to qty 1 on a non-number, and says so', () => {
    const { items, issues } = parseItemsCsv(`${HEADER}\nThing,,T1,have,lots,`)
    expect(items[0].qty).toBe(1)
    expect(issues[0].message).toContain('not a number')
  })

  it('uppercases container codes', () => {
    const { items } = parseItemsCsv(`${HEADER}\nThing,,w-a,have,1,`)
    expect(items[0].containerCode).toBe('W-A')
  })

  it('accepts semicolons and pipes as alias separators', () => {
    const { items } = parseItemsCsv(`${HEADER}\nThing,a;b|c,T1,have,1,`)
    expect(items[0].aliases).toEqual(['a', 'b', 'c'])
  })

  it('skips a row with no name or no container, and reports the line', () => {
    const { items, issues } = parseItemsCsv(`${HEADER}\n,,T1,have,1,\nOrphan,,,have,1,`)
    expect(items).toEqual([])
    expect(issues.map((i) => i.line)).toEqual([2, 3])
  })

  it('tolerates columns in a different order', () => {
    const { items } = parseItemsCsv('containerCode,name\nT3,Spare keycaps')
    expect(items[0]).toMatchObject({ name: 'Spare keycaps', containerCode: 'T3' })
  })
})

describe('sample-data.csv', () => {
  const text = readFileSync(resolve(__dirname, '../../sample-data.csv'), 'utf8')
  const { items, issues } = parseItemsCsv(text)

  it('parses without issues', () => {
    expect(issues).toEqual([])
    expect(items.length).toBeGreaterThanOrEqual(15)
  })

  it('only uses container codes that exist', () => {
    const known = new Set(DEFAULT_CONTAINERS.map((c) => c.code))
    const unknown = items.map((i) => i.containerCode).filter((code) => !known.has(code))
    expect(unknown).toEqual([])
  })

  it('shows both states and the OUT container working', () => {
    expect(items.filter((i) => i.status === 'gone')).toHaveLength(2)
    expect(items.filter((i) => i.containerCode === 'OUT')).toHaveLength(1)
  })
})
