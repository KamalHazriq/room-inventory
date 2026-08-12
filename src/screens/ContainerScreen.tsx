import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { CodeChip } from '../components/CodeChip'
import { ItemRow } from '../components/ItemRow'
import { BackLink, Screen, SectionLabel } from '../components/ui'
import { useInventory } from '../state/inventory'

/**
 * The reverse lookup: standing in front of box T2, what should be inside it.
 * The code becomes the masthead, because the code is what is written on the
 * box in your hand.
 */
export function ContainerScreen() {
  const { code = '' } = useParams()
  const { status, containers, items, containerByCode, zones } = useInventory()
  const container = containerByCode.get(code)

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

  return (
    <div className="min-h-dvh pt-safe pb-safe">
      <Screen>
        <div className="pt-2">
          <BackLink to="/" label="Search" />
        </div>

        <header className="mt-5 mb-8">
          <CodeChip code={code} size="lg" />
          <p className="mt-4 text-lg text-ink">{container?.label ?? ' '}</p>
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
          <section className={live.length > 0 ? 'mt-8' : 'mt-8'}>
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
      </Screen>
    </div>
  )
}
