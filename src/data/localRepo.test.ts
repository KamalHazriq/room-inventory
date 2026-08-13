import { beforeEach, describe, expect, it } from 'vitest'

/** localRepo reads storage lazily, so a stub installed before import is enough. */
class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string) {
    return this.store.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.store.set(key, value)
  }
  removeItem(key: string) {
    this.store.delete(key)
  }
  clear() {
    this.store.clear()
  }
}

const storage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', { value: storage, writable: true })

const { localRepo } = await import('./localRepo')
const { OUT_CODE, NOT_FILED_ZONE: OUT_ZONE } = await import('./defaults')

beforeEach(() => {
  storage.clear()
})

describe('localRepo', () => {
  it('seeds from sample-data.csv on first read', async () => {
    const snapshot = await localRepo.load()
    expect(snapshot.items.length).toBeGreaterThanOrEqual(15)
    expect(snapshot.containers.some((c) => c.code === OUT_CODE)).toBe(true)
    expect(snapshot.zones.length).toBeGreaterThan(0)
  })

  it('persists an added item across loads', async () => {
    const created = await localRepo.addItem({
      name: 'Test widget',
      aliases: ['widget'],
      containerCode: 'T1',
      qty: 1,
      notes: '',
    })
    const snapshot = await localRepo.load()
    expect(snapshot.items.find((i) => i.id === created.id)?.name).toBe('Test widget')
  })

  it('marks an item gone without deleting it', async () => {
    const { items } = await localRepo.load()
    const target = items[0]
    await localRepo.updateItem(target.id, { status: 'gone' })

    const after = await localRepo.load()
    expect(after.items.find((i) => i.id === target.id)?.status).toBe('gone')
    expect(after.items).toHaveLength(items.length)
  })

  describe('containers', () => {
    it('rejects a duplicate code', async () => {
      await expect(
        localRepo.addContainer({ code: 'T1', label: 'Clash', zoneId: 'trolley' }),
      ).rejects.toThrow(/already exists/i)
    })

    it('uppercases a new code', async () => {
      const created = await localRepo.addContainer({
        code: 't9',
        label: 'Trolley tier 9',
        zoneId: 'trolley',
      })
      expect(created.code).toBe('T9')
    })

    it('edits label and zone without touching contents', async () => {
      const before = await localRepo.load()
      await localRepo.updateContainer('T1', { label: 'Top tier', zoneId: 'desk' })

      const after = await localRepo.load()
      const container = after.containers.find((c) => c.code === 'T1')
      expect(container).toMatchObject({ label: 'Top tier', zoneId: 'desk' })
      expect(after.items.filter((i) => i.containerCode === 'T1')).toHaveLength(
        before.items.filter((i) => i.containerCode === 'T1').length,
      )
    })

    it('renaming a code carries every item inside it', async () => {
      const before = await localRepo.load()
      const contents = before.items.filter((i) => i.containerCode === 'T1')
      expect(contents.length).toBeGreaterThan(0)

      await localRepo.renameContainer('T1', 'T9')

      const after = await localRepo.load()
      expect(after.containers.some((c) => c.code === 'T1')).toBe(false)
      expect(after.containers.some((c) => c.code === 'T9')).toBe(true)
      expect(after.items.filter((i) => i.containerCode === 'T1')).toEqual([])
      expect(after.items.filter((i) => i.containerCode === 'T9')).toHaveLength(contents.length)
    })

    it('refuses to rename onto an existing code', async () => {
      await expect(localRepo.renameContainer('T1', 'T2')).rejects.toThrow(/already exists/i)
      const after = await localRepo.load()
      expect(after.containers.some((c) => c.code === 'T1')).toBe(true)
    })

    it('deleting a container moves its contents rather than orphaning them', async () => {
      const before = await localRepo.load()
      const contents = before.items.filter((i) => i.containerCode === 'T1')
      const outBefore = before.items.filter((i) => i.containerCode === OUT_CODE).length

      await localRepo.deleteContainer('T1', OUT_CODE)

      const after = await localRepo.load()
      expect(after.containers.some((c) => c.code === 'T1')).toBe(false)
      // Nothing is lost, only refiled.
      expect(after.items).toHaveLength(before.items.length)
      expect(after.items.filter((i) => i.containerCode === OUT_CODE)).toHaveLength(
        outBefore + contents.length,
      )
    })

    it('refuses to delete into a container that does not exist', async () => {
      await expect(localRepo.deleteContainer('T1', 'NOPE')).rejects.toThrow(/NOPE/)
      const after = await localRepo.load()
      expect(after.containers.some((c) => c.code === 'T1')).toBe(true)
    })
  })

  describe('zones', () => {
    it('derives a readable id from the name', async () => {
      const created = await localRepo.addZone({ name: 'Behind the door' })
      expect(created.id).toBe('behind-the-door')
    })

    it('does not collide when two zones share a name', async () => {
      const first = await localRepo.addZone({ name: 'Shelf' })
      const second = await localRepo.addZone({ name: 'Shelf' })
      expect(second.id).not.toBe(first.id)
      expect(second.id).toBe('shelf-2')
    })

    it('rejects a blank name', async () => {
      await expect(localRepo.addZone({ name: '  ' })).rejects.toThrow(/name/i)
    })

    it('renames a zone without disturbing its containers', async () => {
      const before = await localRepo.load()
      const inTrolley = before.containers.filter((c) => c.zoneId === 'trolley').length
      await localRepo.updateZone('trolley', { name: 'The trolley' })

      const after = await localRepo.load()
      expect(after.zones.find((z) => z.id === 'trolley')?.name).toBe('The trolley')
      expect(after.containers.filter((c) => c.zoneId === 'trolley')).toHaveLength(inTrolley)
    })

    it('deleting a zone refiles its containers rather than orphaning them', async () => {
      const before = await localRepo.load()
      const moving = before.containers.filter((c) => c.zoneId === 'trolley').length
      const notFiledBefore = before.containers.filter((c) => c.zoneId === OUT_ZONE).length
      expect(moving).toBeGreaterThan(0)

      await localRepo.deleteZone('trolley', OUT_ZONE)

      const after = await localRepo.load()
      expect(after.zones.some((z) => z.id === 'trolley')).toBe(false)
      expect(after.containers).toHaveLength(before.containers.length)
      expect(after.containers.filter((c) => c.zoneId === OUT_ZONE)).toHaveLength(
        notFiledBefore + moving,
      )
    })

    it('refuses to delete the zone everything else falls back to', async () => {
      await expect(localRepo.deleteZone(OUT_ZONE, 'trolley')).rejects.toThrow(/cannot be deleted/i)
    })

    it('refuses to delete into a zone that does not exist', async () => {
      await expect(localRepo.deleteZone('trolley', 'nope')).rejects.toThrow(/nope/)
      const after = await localRepo.load()
      expect(after.zones.some((z) => z.id === 'trolley')).toBe(true)
    })
  })
})
