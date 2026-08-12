import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CodeChip } from '../components/CodeChip'
import { ItemRow } from '../components/ItemRow'
import { ZonePicker } from '../components/ZonePicker'
import { BackLink, Button, Field, RowAction, Screen, SectionLabel } from '../components/ui'
import { OUT_CODE } from '../data/defaults'
import { useInventory } from '../state/inventory'

type Panel = 'none' | 'edit' | 'delete'

/**
 * The reverse lookup: standing in front of box T2, what should be inside it.
 * The code becomes the masthead, because the code is what is written on the
 * box in your hand.
 */
export function ContainerScreen() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const {
    status,
    containers,
    items,
    containerByCode,
    zones,
    updateContainer,
    renameContainer,
    deleteContainer,
  } = useInventory()

  const container = containerByCode.get(code)

  const [panel, setPanel] = useState<Panel>('none')
  const [draftCode, setDraftCode] = useState('')
  const [draftLabel, setDraftLabel] = useState('')
  const [draftZone, setDraftZone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { live, gone } = useMemo(() => {
    const here = items.filter((item) => item.containerCode === code)
    return {
      live: here.filter((i) => i.status === 'have').sort((a, b) => a.name.localeCompare(b.name)),
      gone: here.filter((i) => i.status === 'gone').sort((a, b) => a.name.localeCompare(b.name)),
    }
  }, [items, code])

  if (status === 'ready' && !container && containers.length > 0) {
    return (
      <div className="min-h-dvh pt-safe pb-safe">
        <Screen>
          <div className="pt-2">
            <BackLink to="/" label="Search" />
          </div>
          <p className="mt-8 text-base text-ink">No container with the code {code}.</p>
        </Screen>
      </div>
    )
  }

  const zoneName = zones.find((z) => z.id === container?.zoneId)?.name
  const total = live.length + gone.length

  // OUT is where a deleted box's contents go, so it cannot itself be deleted.
  const canDelete = code !== OUT_CODE
  const reassignTo = containers.some((c) => c.code === OUT_CODE)
    ? OUT_CODE
    : (containers.find((c) => c.code !== code)?.code ?? '')

  function startEdit() {
    if (!container) return
    setDraftCode(container.code)
    setDraftLabel(container.label)
    setDraftZone(container.zoneId)
    setError(null)
    setPanel('edit')
  }

  async function saveEdit() {
    if (!container) return
    const nextCode = draftCode.trim().toUpperCase()

    if (!nextCode) return setError('A container needs a code.')
    if (!draftLabel.trim()) return setError('A container needs a label.')
    if (nextCode !== container.code && containers.some((c) => c.code === nextCode)) {
      return setError(`${nextCode} already exists.`)
    }

    setBusy(true)
    setError(null)
    try {
      if (draftLabel.trim() !== container.label || draftZone !== container.zoneId) {
        await updateContainer(container.code, {
          label: draftLabel.trim(),
          zoneId: draftZone,
        })
      }
      if (nextCode !== container.code) {
        // Every item inside moves with the code, so this has to happen last and
        // the screen has to follow the container to its new address.
        await renameContainer(container.code, nextCode)
        navigate(`/c/${encodeURIComponent(nextCode)}`, { replace: true })
      }
      setPanel('none')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That did not save.')
    } finally {
      setBusy(false)
    }
  }

  if (panel === 'edit' && container) {
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
          <h1 className="mt-3 mb-6 text-xl text-ink">Edit container {container.code}</h1>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              void saveEdit()
            }}
          >
            <Field
              label="Code"
              value={draftCode}
              onChange={(event) => setDraftCode(event.target.value.toUpperCase())}
              hint={
                total > 0
                  ? `Changing this moves ${total === 1 ? 'the 1 item' : `all ${total} items`} in here with it.`
                  : undefined
              }
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="font-mono tracking-[0.08em]"
            />
            <Field
              label="Label"
              value={draftLabel}
              onChange={(event) => setDraftLabel(event.target.value)}
            />
            <ZonePicker value={draftZone} onChange={setDraftZone} />
            {error ? <p className="text-sm text-muted">{error}</p> : null}
            <div className="pt-1">
              <Button type="submit" variant="primary" disabled={busy}>
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

        <header className="mt-5 mb-8">
          {/* The chip is the heading, so it has to be one semantically too. The
              label is read as part of it rather than as a stray line after. */}
          <h1 aria-label={`Container ${code}${container ? `, ${container.label}` : ''}`}>
            <CodeChip code={code} size="lg" />
          </h1>
          <p aria-hidden="true" className="mt-4 text-lg text-ink">
            {container?.label ?? ' '}
          </p>
          {zoneName ? <p className="mt-0.5 text-sm text-muted">{zoneName}</p> : null}
        </header>

        {live.length > 0 ? (
          <section>
            <SectionLabel>{live.length === 1 ? '1 item' : `${live.length} items`}</SectionLabel>
            <ul>
              {live.map((item, index) => (
                <ItemRow key={item.id} item={item} trailing="none" index={index} />
              ))}
            </ul>
          </section>
        ) : (
          <p className="text-base text-muted">Nothing filed here yet.</p>
        )}

        {gone.length > 0 ? (
          <section className="mt-8">
            <div className="border-t border-rule pt-3">
              <SectionLabel>No longer have</SectionLabel>
            </div>
            <ul>
              {gone.map((item, index) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  trailing="none"
                  index={live.length + index}
                  dimmed
                />
              ))}
            </ul>
          </section>
        ) : null}

        {container ? (
          <>
            <section className="mt-12">
              <RowAction disabled={busy} onClick={startEdit}>
                Edit container
              </RowAction>
            </section>

            {canDelete ? (
              <section className="mt-10 border-t border-rule pt-5">
                {panel === 'delete' ? (
                  <div>
                    <p className="text-base text-ink">
                      Delete this container?
                      {total > 0
                        ? ` The ${total === 1 ? '1 item' : `${total} items`} in here move to ${reassignTo}.`
                        : ' It is empty.'}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <Button
                        disabled={busy || !reassignTo}
                        onClick={async () => {
                          setBusy(true)
                          setError(null)
                          try {
                            await deleteContainer(container.code, reassignTo)
                            navigate('/', { replace: true })
                          } catch (caught) {
                            setError(
                              caught instanceof Error
                                ? caught.message
                                : 'Could not delete the container.',
                            )
                            setBusy(false)
                          }
                        }}
                      >
                        {busy ? 'Deleting…' : 'Delete'}
                      </Button>
                      <Button variant="plain" onClick={() => setPanel('none')}>
                        Cancel
                      </Button>
                    </div>
                    {error ? <p className="mt-4 text-sm text-muted">{error}</p> : null}
                  </div>
                ) : (
                  <button
                    disabled={busy}
                    onClick={() => setPanel('delete')}
                    className="min-h-[44px] text-base text-muted"
                  >
                    Delete container
                  </button>
                )}
              </section>
            ) : null}
          </>
        ) : null}
      </Screen>
    </div>
  )
}
