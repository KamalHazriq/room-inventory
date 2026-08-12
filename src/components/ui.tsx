import { Link } from 'react-router-dom'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

/** Single column, centred, comfortable to read at arm's length. */
export function Screen({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[560px] px-5">{children}</div>
}

type Variant = 'primary' | 'quiet' | 'plain'

const VARIANTS: Record<Variant, string> = {
  // The accent appears here and on the chip. Nowhere else.
  primary: 'bg-accent text-bg border border-accent',
  quiet: 'bg-surface text-ink border border-rule',
  plain: 'text-muted border border-transparent',
}

export function Button({
  variant = 'quiet',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex min-h-[44px] items-center justify-center rounded-ui px-4 text-base transition-opacity active:opacity-70 disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

/** A full-width row action, as used down the item detail screen. */
export function RowAction({
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`flex min-h-[44px] w-full items-center justify-between border-b border-rule py-3 text-left text-base text-ink transition-opacity active:opacity-60 disabled:opacity-40 ${className}`}
      {...props}
    />
  )
}

export function Field({
  label,
  hint,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      <input
        className={`min-h-[44px] w-full rounded-ui border border-rule bg-surface px-3 py-2.5 text-ink placeholder:text-muted ${className}`}
        {...props}
      />
      {hint ? <span className="mt-1.5 block text-sm text-muted">{hint}</span> : null}
    </label>
  )
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-none rounded-ui border border-rule bg-surface px-3 py-2.5 text-ink placeholder:text-muted"
      />
    </label>
  )
}

function ChevronDown() {
  return (
    <svg
      className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-muted"
      width="10"
      height="6"
      viewBox="0 0 10 6"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1 1l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Native select, so iOS provides its own wheel picker and a real tap target. */
export function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-[44px] w-full appearance-none rounded-ui border border-rule bg-surface py-2.5 pr-10 pl-3 text-ink"
        >
          {children}
        </select>
        <ChevronDown />
      </div>
    </label>
  )
}

function Chevron() {
  return (
    <svg width="7" height="12" viewBox="0 0 7 12" fill="none" aria-hidden="true">
      <path
        d="M6 1 1 6l5 5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="-ml-1 inline-flex min-h-[44px] items-center gap-2 pr-2 pl-1 text-base text-muted transition-opacity active:opacity-60"
    >
      <Chevron />
      {label}
    </Link>
  )
}

/** Section labels: quiet, and never the reason something reads as a heading. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="mb-1 text-sm text-muted">{children}</h2>
}

/** Reads a value back on the item screen. Label above, value below. */
export function ReadRow({
  label,
  children,
  mono = false,
}: {
  label: string
  children: ReactNode
  mono?: boolean
}) {
  return (
    <div className="border-b border-rule py-3">
      <div className="text-sm text-muted">{label}</div>
      <div className={`mt-0.5 text-ink ${mono ? 'font-mono text-base' : ''}`}>{children}</div>
    </div>
  )
}
