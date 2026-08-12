import { Link } from 'react-router-dom'
import { CodeChip } from './CodeChip'
import type { Item } from '../data/types'

interface ItemRowProps {
  item: Item
  /** `chip` on search results, `none` inside a container view. */
  trailing?: 'chip' | 'none'
  /** Applied to `gone` items, which stay tappable so they can be reinstated. */
  dimmed?: boolean
  /** Index into the 20ms result stagger. */
  index?: number
}

/**
 * The name and the chip are separate tap targets: the row opens the item, the
 * chip opens the container. Nesting one link inside the other would be invalid
 * markup and would make "tapping a code chip anywhere" impossible here.
 */
export function ItemRow({ item, trailing = 'chip', dimmed = false, index = 0 }: ItemRowProps) {
  return (
    <li
      className="rise-in flex items-center border-b border-rule"
      style={{ animationDelay: `${Math.min(index, 12) * 20}ms` }}
    >
      <Link
        to={`/i/${item.id}`}
        className={`min-w-0 flex-1 py-3 pr-3 transition-opacity active:opacity-60 ${
          dimmed ? 'opacity-55' : ''
        }`}
      >
        <span className="block truncate text-lg text-ink">{item.name}</span>
      </Link>

      {item.qty > 1 ? (
        <span className={`mr-3 font-mono text-sm text-muted ${dimmed ? 'opacity-55' : ''}`}>
          &times;{item.qty}
        </span>
      ) : null}

      {trailing === 'chip' ? (
        <Link
          to={`/c/${encodeURIComponent(item.containerCode)}`}
          aria-label={`Open container ${item.containerCode}`}
          className={`flex min-h-[44px] items-center pl-2 transition-opacity active:opacity-60 ${
            dimmed ? 'opacity-55' : ''
          }`}
        >
          <CodeChip code={item.containerCode} />
        </Link>
      ) : null}
    </li>
  )
}
