import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CodeChip } from '../components/CodeChip'
import { ContainerPicker } from '../components/ContainerPicker'
import {
  BackLink,
  Button,
  Field,
  ReadRow,
  RowAction,
  Screen,
  TextArea,
} from '../components/ui'
import { relativeTime } from '../lib/time'
import { writeLastContainer } from '../state/lastContainer'
import { useInventory } from '../state/inventory'

type Panel = 'none' | 'move' | 'edit' | 'delete'

export function ItemScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { status, items, containerByCode, updateItem, deleteItem } = useInventory()
  const item = items.find((i) => i.id === id)

  const [panel, setPanel] = useState<Panel>('none')
  const [moveTo, setMoveTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [draftName, setDraftName] = useState('')
  const [draftAliases, setDraftAliases] = useState('')
  const [draftQty, setDraftQty] = useState('1')
  const [draftNotes, setDraftNotes] = useState('')

  if (status === 'loading') return <div className="min-h-dvh bg-bg" />

  if (!item) {
    return (
      <div className="min-h-dvh pt-safe pb-safe">
        <Screen>
          <div className="pt-2">
            <BackLink to="/" label="Search" />
          </div>
          <p className="mt-8 text-base text-ink">That item is no longer here.</p>
        </Screen>
      </div>
    )
  }

  const container = containerByCode.get(item.containerCode)
  const isGone = item.status === 'gone'

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That did not save.')
    } finally {
      setBusy(false)
    }
  }

  function startEdit() {
    if (!item) return
    setDraftName(item.name)
    setDraftAliases(item.aliases.join(', '))
    setDraftQty(String(item.qty))
    setDraftNotes(item.notes)
    setPanel('edit')
  }

  if (panel === 'edit') {
    return (
      <div className="min-h-dvh pt-safe pb-safe">
        <Screen>
          <div className="pt-2">
            <button
              onClick={() => setPanel('none')}
              className="-ml-1 min-h-[44px] pl-1 text-base text-muted"
            >
              Cancel
            </button>
          </div>
          <h1 className="mt-3 mb-6 text-xl text-ink">Edit item</h1>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              const parsed = Number(draftQty)
              void run(async () => {
                await updateItem(item.id, {
                  name: draftName.trim(),
                  aliases: draftAliases
                    .split(',')
                    .map((a) => a.trim())
                    .filter(Boolean),
                  qty: Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 1,
                  notes: draftNotes.trim(),
                })
                setPanel('none')
              })
            }}
          >
            <Field
              label="Name"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
            />
            <Field
              label="Aliases"
              value={draftAliases}
              onChange={(event) => setDraftAliases(event.target.value)}
              hint="Comma separated."
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <Field
              label="Quantity"
              type="number"
              inputMode="numeric"
              min={1}
              value={draftQty}
              onChange={(event) => setDraftQty(event.target.value)}
              className="font-mono"
            />
            <TextArea label="Notes" value={draftNotes} onChange={setDraftNotes} />
            {error ? <p className="text-sm text-muted">{error}</p> : null}
            <div className="pt-1">
              <Button
                type="submit"
                variant="primary"
                disabled={busy || draftName.trim() === ''}
              >
                {busy ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </Screen>
      </div>
    )
  }

  return (
    <div className="min-h-dvh pt-safe pb-safe">
      <Screen>
        <div className="pt-2">
          <BackLink to="/" label="Search" />
        </div>

        <header className="mt-3 mb-6">
          <h1 className="text-xl text-ink">{item.name}</h1>
          <div className="mt-3 flex items-center gap-3">
            <Link
              to={`/c/${encodeURIComponent(item.containerCode)}`}
              aria-label={`Open container ${item.containerCode}`}
              className="inline-flex min-h-[44px] items-center transition-opacity active:opacity-60"
            >
              <CodeChip code={item.containerCode} />
            </Link>
            <span className="text-sm text-muted">{container?.label ?? 'Unknown container'}</span>
          </div>
          {isGone ? <p className="mt-1 text-sm text-muted">No longer have this.</p> : null}
        </header>

        <section className="mb-8">
          {item.aliases.length > 0 ? (
            <ReadRow label="Aliases">{item.aliases.join(', ')}</ReadRow>
          ) : null}
          <ReadRow label="Quantity" mono>
            {item.qty}
          </ReadRow>
          {item.notes ? <ReadRow label="Notes">{item.notes}</ReadRow> : null}
          <ReadRow label="Last seen" mono>
            {relativeTime(item.lastSeenAt)}
          </ReadRow>
        </section>

        {panel === 'move' ? (
          <section className="mb-8 space-y-4">
            <ContainerPicker value={moveTo} onChange={setMoveTo} label="Move to" />
            <div className="flex gap-2">
              <Button
                variant="primary"
                disabled={busy || moveTo === item.containerCode}
                onClick={() =>
                  void run(async () => {
                    await updateItem(item.id, {
                      containerCode: moveTo,
                      lastSeenAt: Date.now(),
                    })
                    writeLastContainer(moveTo)
                    setPanel('none')
                  })
                }
              >
                {busy ? 'Moving…' : 'Move item'}
              </Button>
              <Button variant="plain" onClick={() => setPanel('none')}>
                Cancel
              </Button>
            </div>
          </section>
        ) : (
          <section className="mb-10">
            <RowAction
              disabled={busy}
              onClick={() => void run(() => updateItem(item.id, { lastSeenAt: Date.now() }))}
            >
              Confirm it&rsquo;s here
            </RowAction>

            <RowAction
              disabled={busy}
              onClick={() => {
                setMoveTo(item.containerCode)
                setPanel('move')
              }}
            >
              Move
            </RowAction>

            <RowAction disabled={busy} onClick={startEdit}>
              Edit
            </RowAction>

            {/* Both directions are one tap with no confirm, because both are
                trivially reversible. */}
            <RowAction
              disabled={busy}
              onClick={() =>
                void run(() =>
                  updateItem(item.id, { status: isGone ? 'have' : 'gone', lastSeenAt: Date.now() }),
                )
              }
            >
              {isGone ? 'Have it again' : 'Mark as gone'}
            </RowAction>
          </section>
        )}

        {error ? <p className="mb-6 text-sm text-muted">{error}</p> : null}

        {/* Delete is the rare action and sits apart from the everyday one, with
            a confirm step, so the two are never hit by mistake. */}
        <section className="mt-14 border-t border-rule pt-5">
          {panel === 'delete' ? (
            <div>
              <p className="text-base text-ink">
                Delete this record? Use &ldquo;Mark as gone&rdquo; instead if you had it and
                it is finished.
              </p>
              <div className="mt-4 flex gap-2">
                <Button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await deleteItem(item.id)
                      navigate('/', { replace: true })
                    })
                  }
                >
                  {busy ? 'Deleting…' : 'Delete'}
                </Button>
                <Button variant="plain" onClick={() => setPanel('none')}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              disabled={busy}
              onClick={() => setPanel('delete')}
              className="min-h-[44px] text-base text-muted"
            >
              Delete
            </button>
          )}
        </section>
      </Screen>
    </div>
  )
}
