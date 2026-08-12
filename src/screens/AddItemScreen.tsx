import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CodeChip } from '../components/CodeChip'
import { ContainerPicker } from '../components/ContainerPicker'
import { BackLink, Button, Field, Screen, TextArea } from '../components/ui'
import { OUT_CODE } from '../data/defaults'
import { likelyDuplicates } from '../search/search'
import { readLastContainer, writeLastContainer } from '../state/lastContainer'
import { useInventory } from '../state/inventory'

export function AddItemScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { containers, items, addItem } = useInventory()

  const defaultContainer = useMemo(() => {
    const last = readLastContainer()
    if (last && containers.some((c) => c.code === last)) return last
    // Never default to OUT: it is where things end up, not where they live.
    return containers.find((c) => c.code !== OUT_CODE)?.code ?? containers[0]?.code ?? ''
  }, [containers])

  const [name, setName] = useState(params.get('name') ?? '')
  const [aliases, setAliases] = useState('')
  const [containerCode, setContainerCode] = useState(defaultContainer)

  // On a cold open the inventory has not arrived yet, so the initial state above
  // is an empty string. The select would then display its first option while
  // holding no value, leaving Save disabled and the picker looking chosen.
  useEffect(() => {
    if (!containerCode && defaultContainer) setContainerCode(defaultContainer)
  }, [containerCode, defaultContainer])

  const [qty, setQty] = useState('1')
  const [notes, setNotes] = useState('')
  // 90% of adds are name plus container, so the rest starts out of the way.
  const [showMore, setShowMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave = name.trim().length > 0 && containerCode !== ''

  // "Do I already own this" is the question the whole app exists to answer, and
  // the moment before adding a second one is the last chance to ask it.
  const duplicates = useMemo(() => likelyDuplicates(items, name), [items, name])

  async function save() {
    if (!canSave || saving) return
    setSaving(true)
    setError(null)
    try {
      const parsedQty = Number(qty)
      await addItem({
        name: name.trim(),
        aliases: aliases
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        containerCode,
        qty: Number.isFinite(parsedQty) && parsedQty > 0 ? Math.round(parsedQty) : 1,
        notes: notes.trim(),
      })
      writeLastContainer(containerCode)
      // Straight back to search, field cleared.
      navigate('/', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the item.')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-dvh pt-safe pb-safe">
      <Screen>
        <div className="pt-2">
          <BackLink to="/" label="Search" />
        </div>

        <h1 className="mt-3 mb-6 text-xl text-ink">Add item</h1>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <Field
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="HDMI cable 2m"
            autoFocus={name === ''}
            enterKeyHint="next"
          />

          {duplicates.length > 0 ? (
            <div className="-mt-2">
              <p className="text-sm text-muted">
                {duplicates.length === 1 ? 'You may already have this:' : 'You may already have:'}
              </p>
              <ul className="mt-1">
                {duplicates.map((duplicate) => (
                  <li key={duplicate.id}>
                    <Link
                      to={`/i/${duplicate.id}`}
                      className="flex min-h-[44px] items-center gap-3 py-1.5 transition-opacity active:opacity-60"
                    >
                      <span className="min-w-0 flex-1 truncate text-base text-ink">
                        {duplicate.name}
                      </span>
                      {duplicate.qty > 1 ? (
                        <span className="font-mono text-sm text-muted">
                          &times;{duplicate.qty}
                        </span>
                      ) : null}
                      <CodeChip code={duplicate.containerCode} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Field
            label="Aliases"
            value={aliases}
            onChange={(event) => setAliases(event.target.value)}
            placeholder="hdmi, monitor cable"
            hint="Comma separated. Other words you might search for."
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />

          <ContainerPicker value={containerCode} onChange={setContainerCode} />

          {showMore ? (
            <div className="space-y-5">
              <Field
                label="Quantity"
                type="number"
                inputMode="numeric"
                min={1}
                value={qty}
                onChange={(event) => setQty(event.target.value)}
                className="font-mono"
              />
              <TextArea label="Notes" value={notes} onChange={setNotes} />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowMore(true)}
              className="flex min-h-[44px] items-center gap-2 text-base text-muted"
            >
              More
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
                <path
                  d="M1 1l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}

          {error ? <p className="text-sm text-muted">{error}</p> : null}

          <div className="pt-1">
            <Button type="submit" variant="primary" disabled={!canSave || saving}>
              {saving ? 'Saving…' : 'Save item'}
            </Button>
          </div>
        </form>
      </Screen>
    </div>
  )
}
