/**
 * `gone` and delete are different things and must stay different.
 *
 * `gone` means the record was right and the object is no longer here: used up,
 * given away, binned, broken. The record is kept on purpose, because "you had
 * four and used the last one" answers "do I already own this" far better than
 * an empty result does. Delete means the record itself was a mistake.
 */
export type ItemStatus = 'have' | 'gone'

export interface Zone {
  id: string
  name: string
  order: number
}

export interface Container {
  /** The doc id IS the code: "T2", "W-A", "D-1", "OUT". */
  code: string
  zoneId: string
  label: string
  order: number
}

export interface Item {
  id: string
  name: string
  /** Other words I might reach for: ["charger", "brick"]. */
  aliases: string[]
  containerCode: string
  status: ItemStatus
  qty: number
  notes: string
  createdAt: number
  lastSeenAt: number
}

/** Everything the app holds in memory. Fetched once on open. */
export interface Snapshot {
  zones: Zone[]
  containers: Container[]
  items: Item[]
}

export type NewItem = Pick<
  Item,
  'name' | 'aliases' | 'containerCode' | 'qty' | 'notes'
> &
  Partial<Pick<Item, 'status'>>

export type ItemPatch = Partial<
  Pick<
    Item,
    'name' | 'aliases' | 'containerCode' | 'status' | 'qty' | 'notes' | 'lastSeenAt'
  >
>

export type NewContainer = Pick<Container, 'code' | 'zoneId' | 'label'> &
  Partial<Pick<Container, 'order'>>

export type ContainerPatch = Partial<Pick<Container, 'label' | 'zoneId' | 'order'>>

/**
 * The one seam between the app and its storage. `local` and `firebase` both
 * implement this, so swapping them is an env change rather than a rewrite.
 */
export interface Repo {
  load(): Promise<Snapshot>
  addItem(input: NewItem): Promise<Item>
  updateItem(id: string, patch: ItemPatch): Promise<void>
  deleteItem(id: string): Promise<void>
  addContainer(input: NewContainer): Promise<Container>
  updateContainer(code: string, patch: ContainerPatch): Promise<void>
  /**
   * The code is the document id, so changing it means writing a new container,
   * repointing every item inside it, and deleting the old one.
   */
  renameContainer(from: string, to: string): Promise<void>
  /** Items in the deleted container move to `reassignTo` rather than orphaning. */
  deleteContainer(code: string, reassignTo: string): Promise<void>
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out'; error?: string }
  | { status: 'unauthorised'; email: string | null; uid: string }
  | { status: 'ready'; uid: string }

export interface AuthApi {
  observe(listener: (state: AuthState) => void): () => void
  signIn(): Promise<void>
  signOut(): Promise<void>
  /**
   * Called when a read is rejected by the Firestore rules. Someone signing in
   * with their own Google account creates a valid auth record, so "signed in"
   * and "allowed" are not the same question, and the difference has to reach
   * the UI rather than hang on a spinner.
   */
  reportUnauthorised(): void
}
