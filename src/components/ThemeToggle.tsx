import { useTheme } from '../theme/ThemeProvider'

function Sun() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M8 1v1.75M8 13.25V15M15 8h-1.75M2.75 8H1M12.95 3.05l-1.24 1.24M4.29 11.71l-1.24 1.24M12.95 12.95l-1.24-1.24M4.29 4.29L3.05 3.05"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  )
}

function Moon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13.5 9.7A5.8 5.8 0 0 1 6.3 2.5a5.8 5.8 0 1 0 7.2 7.2Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** The one piece of motion besides the result stagger: a cross-fade. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="-mr-2.5 grid h-11 w-11 place-items-center text-muted"
    >
      <span className="relative grid h-4 w-4 place-items-center">
        <span
          className="absolute transition-opacity duration-200"
          style={{ opacity: theme === 'dark' ? 0 : 1 }}
        >
          <Sun />
        </span>
        <span
          className="absolute transition-opacity duration-200"
          style={{ opacity: theme === 'dark' ? 1 : 0 }}
        >
          <Moon />
        </span>
      </span>
    </button>
  )
}
