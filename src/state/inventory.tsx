import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { repo } from '../data'
import { compareContainers } from '../data/defaults'
import type {
  Container,
  Item,
  ItemPatch,
  NewContainer,
  NewItem,
  Snapshot,
  Zone,
} from '../data/types'

type Status = 'loading' | 'ready' | 'error'

interface InventoryValue {
  status: Status
  error: string | null
  zones: Zone[]
  /** Display order, with OUT last. */
  containers: Container[]
  items: Item[]
  containerByCode: Map<string, Container>
  liveCountFor: (code: string) => number
  reload: () => Promise<void>
  addItem: (input: NewItem) => Promise<Item>
  updateItem: (id: string, patch: ItemPatch) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  addContainer: (input: NewContainer) => Promise<Container>
}

const InventoryContext = createContext<InventoryValue | null>(null)

const EMPTY: Snapshot = { zones: [], containers: [], items: [] }

/**
 * Everything is fetched once on open and filtered in memory afterwards. At 50
 * to 200 items that is instant, and it makes search forgiving in a way a
 * server query would not be.
 */
export function InventoryProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      setSnapshot(await repo.load())
      setStatus('ready')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the inventory.')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const addItem = useCallback(async (input: NewItem) => {
    const created = await repo.addItem(input)
    setSnapshot((s) => ({ ...s, items: [...s.items, created] }))
    return created
  }, [])

  const updateItem = useCallback(async (id: string, patch: ItemPatch) => {
    await repo.updateItem(id, patch)
    setSnapshot((s) => ({
      ...s,
      items: s.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }))
  }, [])

  const deleteItem = useCallback(async (id: string) => {
    await repo.deleteItem(id)
    setSnapshot((s) => ({ ...s, items: s.items.filter((item) => item.id !== id) }))
  }, [])

  const addContainer = useCallback(async (input: NewContainer) => {
    const created = await repo.addContainer(input)
    setSnapshot((s) => ({ ...s, containers: [...s.containers, created] }))
    return created
  }, [])

  const containers = useMemo(
    () => [...snapshot.containers].sort(compareContainers),
    [snapshot.containers],
  )

  const containerByCode = useMemo(
    () => new Map(containers.map((c) => [c.code, c])),
    [containers],
  )

  // Counts are of live items only: a box's count should be what is in it now.
  const liveCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of snapshot.items) {
      if (item.status !== 'have') continue
      counts.set(item.containerCode, (counts.get(item.containerCode) ?? 0) + 1)
    }
    return counts
  }, [snapshot.items])

  const liveCountFor = useCallback((code: string) => liveCounts.get(code) ?? 0, [liveCounts])

  const value = useMemo<InventoryValue>(
    () => ({
      status,
      error,
      zones: snapshot.zones,
      containers,
      items: snapshot.items,
      containerByCode,
      liveCountFor,
      reload,
      addItem,
      updateItem,
      deleteItem,
      addContainer,
    }),
    [
      status,
      error,
      snapshot.zones,
      snapshot.items,
      containers,
      containerByCode,
      liveCountFor,
      reload,
      addItem,
      updateItem,
      deleteItem,
      addContainer,
    ],
  )

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}

export function useInventory(): InventoryValue {
  const value = useContext(InventoryContext)
  if (!value) throw new Error('useInventory must be used inside InventoryProvider')
  return value
}
