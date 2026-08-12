import { useState } from 'react'
import { NOT_FILED_ZONE } from '../data/defaults'
import { useInventory } from '../state/inventory'
import { Button, Field, Select } from './ui'

const NEW_VALUE = '__new_zone__'

type Mode = 'pick' | 'create' | 'rename' | 'delete'

/**
 * Choose a zone, and manage the list without leaving the screen.
 *
 * Zones change about twice a year, so they get an inline panel on the container
 * form rather than a screen of their own. The app stays at four screens.
 */
export function ZonePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (zoneId: string) => void
}) {
  const { zones, addZone, updateZone, deleteZone, containerCountFor } = useInventory()
  const [mode, setMode] = useState<Mode>('pick')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = zones.find((z) => z.id === value)
  const affected = selected ? containerCountFor(selected.id) : 0
  // Everything else falls back here, so it has to survive.
  const canDelete = Boolean(selected) && value !== NOT_FILED_ZONE && zones.length > 1
  const fallback =
    zones.find((z) => z.id === NOT_FILED_ZONE) ?? zones.find((z) => z.id !== value)

  function close() {
    setMode('pick')
    setDraft('')
    setError(null)
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      close()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That did not save.')
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'create' || mode === 'rename') {
    const creating = mode === 'create'
    return (
      <div className="rounded-ui border border-rule p-4">
        <div className="mb-3 text-sm text-muted">{creating ? 'New zone' : 'Rename zone'}</div>
        <div className="space-y-3">
          <Field
            label="Name"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Under-bed"
            autoFocus
          />
          {error ? <p className="text-sm text-muted">{error}</p> : null}
          <div className="flex gap-2">
            <Button
              variant="primary"
              disabled={busy || draft.trim() === ''}
              onClick={() =>
                void run(async () => {
                  if (creating) {
                    const created = await addZone({ name: draft.trim() })
                    onChange(created.id)
                  } else if (selected) {
                    await updateZone(selected.id, { name: draft.trim() })
                  }
                })
              }
            >
              {busy ? 'Saving…' : creating ? 'Add zone' : 'Save name'}
            </Button>
            <Button variant="plain" onClick={close}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'delete' && selected) {
    return (
      <div className="rounded-ui border border-rule p-4">
        <p className="text-base text-ink">
          Delete the {selected.name} zone?
          {affected > 0
            ? ` Its ${affected === 1 ? '1 container moves' : `${affected} containers move`} to ${fallback?.name ?? 'another zone'}.`
            : ' It has no containers.'}
        </p>
        {error ? <p className="mt-3 text-sm text-muted">{error}</p> : null}
        <div className="mt-4 flex gap-2">
          <Button
            disabled={busy || !fallback}
            onClick={() =>
              void run(async () => {
                if (!fallback) return
                await deleteZone(selected.id, fallback.id)
                onChange(fallback.id)
              })
            }
          >
            {busy ? 'Deleting…' : 'Delete'}
          </Button>
          <Button variant="plain" onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Select
        label="Zone"
        value={value}
        onChange={(next) => {
          if (next === NEW_VALUE) {
            setDraft('')
            setMode('create')
            return
          }
          onChange(next)
        }}
      >
        {zones.map((zone) => (
          <option key={zone.id} value={zone.id}>
            {zone.name}
          </option>
        ))}
        <option value={NEW_VALUE}>New zone…</option>
      </Select>

      {selected ? (
        <div className="mt-1 flex gap-4">
          <button
            type="button"
            onClick={() => {
              setDraft(selected.name)
              setMode('rename')
            }}
            className="min-h-[44px] text-sm text-muted"
          >
            Rename zone
          </button>
          {canDelete ? (
            <button
              type="button"
              onClick={() => setMode('delete')}
              className="min-h-[44px] text-sm text-muted"
            >
              Delete zone
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
