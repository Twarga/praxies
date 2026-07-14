import { cn } from "../../lib/cn.js";

/**
 * The Praxis Loop: one continuous practice path that forms a P and returns
 * around itself. Geometry stays fixed; themes only change the two colors.
 */
export function PraxisLogo({ className, size = 24, title }) {
  const labelled = Boolean(title);

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role={labelled ? "img" : undefined}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
    >
      <path
        d="M49 59 C60 59 67 52 67 42.5 C67 32 59 25 48 25 C36 25 29 34 29 46 V72 C29 78 26 82 22 79 C10 70 6 56 9 42 C13 21 31 8 52 9 C73 10 90 26 92 47 C94 66 84 82 70 89"
        fill="none"
        stroke="var(--praxis-logo-mark, var(--praxis-text-primary))"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="70" cy="89" r="5.25" fill="var(--praxis-logo-accent, var(--praxis-accent))" />
    </svg>
  );
}
