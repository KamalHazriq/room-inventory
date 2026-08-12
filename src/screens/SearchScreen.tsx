import { useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CodeChip } from '../components/CodeChip'
import { ItemRow } from '../components/ItemRow'
import { ThemeToggle } from '../components/ThemeToggle'
import { Screen, SectionLabel } from '../components/ui'
import { OUT_CODE } from '../data/defaults'
import { searchItems } from '../search/search'
import { useInventory } from '../state/inventory'

export function SearchScreen() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const inputRef = useRef<HTMLInputElement>(null)
  const { status, error, items, containers, liveCountFor, reload } = useInventory()

  // Autofocus on desktop only. On a phone an instant keyboard covers half the
  // screen before you have decided what you are looking for.
  useEffect(() => {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      inputRef.current?.focus()
    }
  }, [])

  const results = useMemo(() => searchItems(items, query), [items, query])

  function setQuery(next: string) {
    // replace, so typing does not fill the back stack one letter at a time.
    setParams(next ? { q: next } : {}, { replace: true })
  }

  const showContainers = query.trim() === ''
  const nothingFound =
    !showContainers && results.live.length === 0 && results.gone.length === 0

  return (
    <div className="min-h-dvh pb-28">
      <div className="sticky top-0 z-10 bg-bg pt-safe">
        <Screen>
          <header className="flex items-center justify-between pt-3 pb-1">
            <span className="text-sm text-muted">Room inventory</span>
            <ThemeToggle />
          </header>
          <div className="pb-3">
            <input
              ref={inputRef}
              type="search"
              inputMode="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              aria-label="Search items"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="min-h-[44px] w-full rounded-ui border border-rule bg-surface px-3.5 py-2.5 text-ink placeholder:text-muted"
            />
          </div>
        </Screen>
      </div>

      <Screen>
        {status === 'error' ? (
          <div className="py-8">
            <p className="text-base text-ink">Could not load the inventory.</p>
            <p className="mt-2 text-sm text-muted">{error}</p>
            <button
              onClick={() => void reload()}
              className="mt-4 min-h-[44px] text-base text-accent"
            >
              Try again
            </button>
          </div>
        ) : null}

        {status === 'ready' && showContainers ? (
          containers.length === 0 ? (
            <div className="py-8">
              <p className="text-base text-ink">No containers yet.</p>
              <p className="mt-2 text-sm text-muted">
                Run <span className="font-mono">npm run seed</span> to create the zones and
                boxes from sample-data.csv.
              </p>
            </div>
          ) : (
            <section className="pt-1">
              <SectionLabel>Containers</SectionLabel>
              <ul>
                {containers.map((container, index) => (
                  <li
                    key={container.code}
                    // OUT sits apart as well as last: a gap says "different"
                    // without needing a badge to say it.
                    className={container.code === OUT_CODE ? 'mt-6 block' : undefined}
                  >
                    <Link
                      to={`/c/${encodeURIComponent(container.code)}`}
                      className="rise-in flex min-h-[44px] items-center gap-3 border-b border-rule py-3 transition-opacity active:opacity-60"
                      style={{ animationDelay: `${Math.min(index, 12) * 20}ms` }}
                    >
                      <CodeChip code={container.code} />
                      <span className="flex-1 truncate text-base text-ink">
                        {container.label}
                      </span>
                      <span className="font-mono text-sm text-muted">
                        {liveCountFor(container.code)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        ) : null}

        {status === 'ready' && !showContainers ? (
          <section className="pt-1">
            {results.live.length > 0 ? (
              <ul>
                {results.live.map((item, index) => (
                  <ItemRow key={item.id} item={item} index={index} />
                ))}
              </ul>
            ) : null}

            {results.gone.length > 0 ? (
              <div className={results.live.length > 0 ? 'mt-8' : 'mt-4'}>
                <div className="border-t border-rule pt-3">
                  <SectionLabel>No longer have</SectionLabel>
                </div>
                <ul>
                  {results.gone.map((item, index) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      index={results.live.length + index}
                      dimmed
                    />
                  ))}
                </ul>
              </div>
            ) : null}

            {nothingFound ? (
              <div className="pt-6">
                {/* The message is the action. */}
                <Link
                  to={`/add?name=${encodeURIComponent(query.trim())}`}
                  className="inline-block min-h-[44px] py-2 text-lg text-ink"
                >
                  No match for &ldquo;{query.trim()}&rdquo;.{' '}
                  <span className="text-accent">Add it?</span>
                </Link>
              </div>
            ) : null}
          </section>
        ) : null}
      </Screen>

      <div className="pointer-events-none fixed inset-x-0 bottom-safe z-20">
        <div className="mx-auto flex w-full max-w-[560px] justify-end px-5">
          <Link
            to="/add"
            className="pointer-events-auto inline-flex min-h-[44px] items-center rounded-ui border border-accent bg-accent px-5 text-base text-bg transition-opacity active:opacity-70"
          >
            Add item
          </Link>
        </div>
      </div>
    </div>
  )
}
