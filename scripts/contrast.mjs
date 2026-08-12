/**
 * WCAG contrast audit of the six tokens, in both schemes.
 *
 * The tokens in PROMPT.md are law, so this reports rather than enforces. If a
 * pair fails, that is a conflict to raise, not something to quietly repaint.
 *
 *   node scripts/contrast.mjs
 */

const LIGHT = {
  bg: '#F6F7F5',
  surface: '#FFFFFF',
  ink: '#17191A',
  muted: '#71767B',
  rule: '#E2E5E1',
  accent: '#2F5D50',
}

const DARK = {
  bg: '#0F1211',
  surface: '#171B1A',
  ink: '#ECEFEC',
  muted: '#8A918D',
  rule: '#262B29',
  accent: '#6FBFA5',
}

const channel = (c) => {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Text pairs only. Hairline dividers are deliberately excluded: WCAG 1.4.11
 * covers UI components and meaningful graphics, and a decorative separator
 * between two list rows is neither. The brief asks for them to be quiet.
 */
const PAIRS = [
  ['ink on bg', 'ink', 'bg', 'item names, body copy'],
  ['ink on surface', 'ink', 'surface', 'text inside inputs'],
  ['muted on bg', 'muted', 'bg', 'labels, counts, timestamps'],
  ['muted on surface', 'muted', 'surface', 'placeholder text'],
  ['accent on bg', 'accent', 'bg', 'the code chip'],
  ['accent on surface', 'accent', 'surface', 'the chip over an input'],
  ['bg on accent', 'bg', 'accent', 'text on the primary button'],
]

const AA_NORMAL = 4.5

let failures = 0

for (const [scheme, tokens] of [
  ['light', LIGHT],
  ['dark', DARK],
]) {
  console.log(`\n  ${scheme}`)
  for (const [name, a, b, use] of PAIRS) {
    const ratio = contrast(tokens[a], tokens[b])
    const ok = ratio >= AA_NORMAL
    if (!ok) failures++
    console.log(
      `    ${ok ? 'pass' : 'FAIL'}  ${ratio.toFixed(2).padStart(5)}:1   ${name.padEnd(18)} ${use}`,
    )
  }
}

console.log('')
if (failures === 0) {
  console.log('  All text pairs meet WCAG AA (4.5:1).\n')
} else {
  console.log(`  ${failures} pair(s) below AA. These are token conflicts — raise them,`)
  console.log('  do not repaint them. See the Accessibility section of the README.\n')
}
