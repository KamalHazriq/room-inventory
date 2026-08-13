/**
 * The signature element, and the only loud thing in the interface.
 *
 * Uppercase mono, letterspaced, inside a hairline box with a small radius, in
 * the accent colour — because its physical counterpart is a label written on
 * masking tape and stuck to a box. On the container screen the same chip
 * scales up to become the masthead.
 */
export function CodeChip({ code, size = 'sm' }: { code: string; size?: 'sm' | 'lg' }) {
  const base =
    'inline-flex items-center border border-accent font-mono uppercase leading-none text-accent'

  // Letterspacing adds a trailing gap after the last glyph, so the right
  // padding is trimmed to keep the box optically centred.
  const scale =
    size === 'lg'
      ? 'rounded-[5px] pl-4 pr-[11px] py-3 text-masthead tracking-[0.1em]'
      : 'rounded-chip pl-[7px] pr-[4px] py-[3px] text-sm tracking-[0.12em]'

  return <span className={`${base} ${scale}`}>{code}</span>
}
