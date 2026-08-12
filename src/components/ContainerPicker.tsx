import { useState } from 'react'
import { useInventory } from '../state/inventory'
import { Button, Field, Select } from './ui'

const NEW_VALUE = '__new__'

/**
 * Native select, so iOS gives its own wheel picker and the control is already
 * a comfortable tap target. Choosing "New container" reveals a small inline
 * form rather than opening a fifth screen.
 */
export function ContainerPicker({
  value,
  onChange,
  label = 'Container',
}: {
  value: string
  onChange: (code: string) => void
  label?: string
}) {
  const { containers, zones, addContainer } = useInventory()
  const [creating, setCreating] = useState(false)
  const [code, setCode] = useState('')
  const [containerLabel, setContainerLabel] = useState('')
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? ''

  async function createContainer() {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return setError('Give the container a code, like T4.')
    if (containers.some((c) => c.code === trimmed)) {
      return setError(`${trimmed} already exists.`)
    }
    if (!containerLabel.trim()) return setError('Give it a label, like "Trolley tier 4".')

    setSaving(true)
    setError(null)
    try {
      const created = await addContainer({
        code: trimmed,
        label: containerLabel.trim(),
        zoneId: zoneId || zones[0]?.id || 'not-filed',
      })
      onChange(created.code)
      setCreating(false)
      setCode('')
      setContainerLabel('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add the container.')
    } finally {
      setSaving(false)
    }
  }

  if (creating) {
    return (
      <div className="rounded-ui border border-rule p-4">
        <div className="mb-3 text-sm text-muted">New container</div>
        <div className="space-y-3">
          <Field
            label="Code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="T4"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="font-mono tracking-[0.08em]"
          />
          <Field
            label="Label"
            value={containerLabel}
            onChange={(event) => setContainerLabel(event.target.value)}
            placeholder="Trolley tier 4"
          />
          <Select label="Zone" value={zoneId} onChange={setZoneId}>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </Select>
          {error ? <p className="text-sm text-muted">{error}</p> : null}
          <div className="flex gap-2">
            <Button variant="primary" onClick={createContainer} disabled={saving}>
              {saving ? 'Adding…' : 'Add container'}
            </Button>
            <Button
              variant="plain"
              onClick={() => {
                setCreating(false)
                setError(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Select
      label={label}
      value={value}
      onChange={(next) => {
        if (next === NEW_VALUE) {
          setCreating(true)
          return
        }
        onChange(next)
      }}
    >
      {containers.map((container) => (
        <option key={container.code} value={container.code}>
          {container.code} — {container.label}
          {zoneName(container.zoneId) ? ` (${zoneName(container.zoneId)})` : ''}
        </option>
      ))}
      <option value={NEW_VALUE}>New container…</option>
    </Select>
  )
}
