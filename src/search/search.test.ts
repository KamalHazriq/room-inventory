import { describe, expect, it } from 'vitest'
import {
  GONE_THRESHOLD,
  likelyDuplicates,
  searchItems,
  withinEditDistance,
} from './search'
import type { Item, ItemStatus } from '../data/types'

let nextId = 0

function item(
  name: string,
  overrides: Partial<Omit<Item, 'name'>> = {},
): Item {
  return {
    id: `i${nextId++}`,
    name,
    aliases: [],
    containerCode: 'T1',
    status: 'have' as ItemStatus,
    qty: 1,
    notes: '',
    createdAt: 0,
    lastSeenAt: 0,
    ...overrides,
  }
}

const names = (result: { live: Item[] }) => result.live.map((i) => i.name)

describe('searchItems', () => {
  it('returns nothing for an empty or whitespace query', () => {
    const items = [item('HDMI cable 2m')]
    expect(searchItems(items, '')).toEqual({ live: [], gone: [] })
    expect(searchItems(items, '   ')).toEqual({ live: [], gone: [] })
  })

  it('matches a substring of the name, case insensitively', () => {
    const items = [item('HDMI cable 2m'), item('Scissors')]
    expect(names(searchItems(items, 'hdmi'))).toEqual(['HDMI cable 2m'])
    expect(names(searchItems(items, 'HDMI'))).toEqual(['HDMI cable 2m'])
    expect(names(searchItems(items, 'able'))).toEqual(['HDMI cable 2m'])
  })

  it('matches aliases, container code and notes', () => {
    const items = [
      item('Anker 65W charger', { aliases: ['brick', 'power adapter'] }),
      item('Scissors', { containerCode: 'D-1' }),
      item('Blu-tack', { notes: 'behind the poster' }),
    ]
    expect(names(searchItems(items, 'brick'))).toEqual(['Anker 65W charger'])
    expect(names(searchItems(items, 'd-1'))).toEqual(['Scissors'])
    expect(names(searchItems(items, 'poster'))).toEqual(['Blu-tack'])
  })

  describe('multi-word queries', () => {
    // The defect this suite exists for: matching the query as one contiguous
    // string meant two natural words in the wrong order found nothing.
    const items = [
      item('Anker 65W charger'),
      item('Black gel pens'),
      item('USB-C to USB-C cable 1m'),
      item('Micro USB cable'),
      item('Scissors'),
    ]

    it('matches words separately, in any order', () => {
      expect(names(searchItems(items, 'anker charger'))).toEqual(['Anker 65W charger'])
      expect(names(searchItems(items, 'charger anker'))).toEqual(['Anker 65W charger'])
      expect(names(searchItems(items, 'black pens'))).toEqual(['Black gel pens'])
      expect(names(searchItems(items, 'pens black'))).toEqual(['Black gel pens'])
    })

    it('requires every word to land somewhere', () => {
      expect(names(searchItems(items, 'anker scissors'))).toEqual([])
      expect(names(searchItems(items, 'black gel unicorn'))).toEqual([])
    })

    it('finds every cable, not just the contiguously named one', () => {
      expect(names(searchItems(items, 'usb cable')).sort()).toEqual([
        'Micro USB cable',
        'USB-C to USB-C cable 1m',
      ])
    })

    it('collapses repeated whitespace', () => {
      expect(names(searchItems(items, '  anker    charger '))).toEqual(['Anker 65W charger'])
    })

    it('lets a word land on a different field from its neighbour', () => {
      const mixed = [item('Ethernet cable 3m', { notes: 'for the router' })]
      expect(names(searchItems(mixed, 'ethernet router'))).toEqual(['Ethernet cable 3m'])
    })
  })

  describe('ranking', () => {
    it('puts name matches above alias, code and notes matches', () => {
      const items = [
        item('Blu-tack', { notes: 'cable tidy' }),
        item('Zip ties', { aliases: ['cable tie'] }),
        item('HDMI cable 2m'),
      ]
      expect(names(searchItems(items, 'cable'))).toEqual([
        'HDMI cable 2m',
        'Zip ties',
        'Blu-tack',
      ])
    })

    it('puts a name that starts with the query first', () => {
      const items = [item('Micro USB cable'), item('USB-C hub')]
      expect(names(searchItems(items, 'usb'))).toEqual(['USB-C hub', 'Micro USB cable'])
    })

    it('ranks a contiguous phrase in the name above scattered words', () => {
      const items = [
        item('USB cable spares', { notes: '' }),
        item('Cable for the USB hub'),
      ]
      expect(names(searchItems(items, 'usb cable'))[0]).toBe('USB cable spares')
    })

    it('breaks ties alphabetically', () => {
      const items = [item('Cable B'), item('Cable A')]
      expect(names(searchItems(items, 'cable'))).toEqual(['Cable A', 'Cable B'])
    })
  })

  describe('gone items', () => {
    const gone = (name: string) => item(name, { status: 'gone' })

    it('excludes gone items from normal results', () => {
      const items = [item('AA batteries'), gone('AAA batteries')]
      const result = searchItems(items, 'batteries')
      expect(names(result)).toEqual(['AA batteries'])
    })

    it('surfaces matching gone items when there are few live results', () => {
      const items = [gone('AA batteries'), gone('Thermal paste')]
      const result = searchItems(items, 'batteries')
      expect(result.live).toEqual([])
      expect(result.gone.map((i) => i.name)).toEqual(['AA batteries'])
    })

    it('hides gone items once there are enough live results', () => {
      const items = [
        item('Cable A'),
        item('Cable B'),
        item('Cable C'),
        gone('Cable D'),
      ]
      const result = searchItems(items, 'cable')
      expect(result.live).toHaveLength(GONE_THRESHOLD)
      expect(result.gone).toEqual([])
    })

    it('still shows gone items at one below the threshold', () => {
      const items = [item('Cable A'), item('Cable B'), gone('Cable D')]
      const result = searchItems(items, 'cable')
      expect(result.live).toHaveLength(GONE_THRESHOLD - 1)
      expect(result.gone.map((i) => i.name)).toEqual(['Cable D'])
    })
  })
})

describe('withinEditDistance', () => {
  it('accepts identical strings', () => {
    expect(withinEditDistance('hdmi', 'hdmi', 1)).toBe(true)
  })

  it('counts an adjacent transposition as one edit', () => {
    // Thumbs swap letters far more often than they substitute them, so this
    // has to fit inside the budget a four-letter word gets.
    expect(withinEditDistance('hdmi', 'hmdi', 1)).toBe(true)
    expect(withinEditDistance('cable', 'cabel', 1)).toBe(true)
  })

  it('does not treat a non-adjacent swap as one edit', () => {
    expect(withinEditDistance('abcd', 'dbca', 1)).toBe(false)
  })

  it('counts insertions, deletions and substitutions', () => {
    expect(withinEditDistance('cable', 'cabl', 1)).toBe(true)
    expect(withinEditDistance('cable', 'cablee', 1)).toBe(true)
    expect(withinEditDistance('cable', 'coble', 1)).toBe(true)
    expect(withinEditDistance('cable', 'cobie', 1)).toBe(false)
  })

  it('rejects on length difference alone', () => {
    expect(withinEditDistance('a', 'abcdef', 2)).toBe(false)
  })
})

describe('typo tolerance', () => {
  const items = [
    item('HDMI cable 2m'),
    item('Precision screwdriver set'),
    item('Anker 65W charger', { aliases: ['power adapter'] }),
    item('Scissors'),
  ]

  it('finds a word with a transposed pair', () => {
    expect(names(searchItems(items, 'hmdi'))).toEqual(['HDMI cable 2m'])
    expect(names(searchItems(items, 'screwdrivre'))).toEqual(['Precision screwdriver set'])
  })

  it('finds a word with one wrong letter', () => {
    expect(names(searchItems(items, 'scissers'))).toEqual(['Scissors'])
    expect(names(searchItems(items, 'chargar'))).toEqual(['Anker 65W charger'])
  })

  it('tolerates a typo in an alias', () => {
    expect(names(searchItems(items, 'adaptor'))).toEqual(['Anker 65W charger'])
  })

  it('never lets a fuzzy hit outrank an exact one', () => {
    const pair = [item('Cablr organiser'), item('HDMI cable 2m')]
    expect(names(searchItems(pair, 'cable'))[0]).toBe('HDMI cable 2m')
  })

  it('leaves short words alone, where a typo is just a different word', () => {
    const short = [item('Cat toy'), item('Car charger')]
    expect(names(searchItems(short, 'cat'))).toEqual(['Cat toy'])
  })

  it('still finds nothing when the query is not a typo of anything', () => {
    expect(names(searchItems(items, 'trombone'))).toEqual([])
  })

  it('does not treat a near miss as a duplicate when adding', () => {
    // Fuzzy is for finding things, not for blocking a genuinely new item.
    expect(likelyDuplicates(items, 'Scissers')).toEqual([])
  })
})

describe('likelyDuplicates', () => {
  const items = [
    item('HDMI cable 2m', { containerCode: 'T2' }),
    item('Ethernet cable 3m'),
    item('Scissors', { notes: 'hdmi' }),
    item('Old HDMI cable', { status: 'gone' }),
  ]

  it('ignores names too short to mean anything', () => {
    expect(likelyDuplicates(items, 'hd')).toEqual([])
    expect(likelyDuplicates(items, '')).toEqual([])
  })

  it('finds an existing item with the same words in its name', () => {
    expect(likelyDuplicates(items, 'HDMI cable').map((i) => i.name)).toEqual([
      'HDMI cable 2m',
    ])
  })

  it('does not treat a notes match as a duplicate', () => {
    expect(likelyDuplicates(items, 'hdmi').map((i) => i.name)).toEqual(['HDMI cable 2m'])
  })

  it('ignores items already marked gone', () => {
    expect(likelyDuplicates(items, 'Old HDMI cable')).toEqual([])
  })

  it('caps how many it returns', () => {
    const many = ['Cable A', 'Cable B', 'Cable C', 'Cable D'].map((n) => item(n))
    expect(likelyDuplicates(many, 'cable', 2)).toHaveLength(2)
  })
})
