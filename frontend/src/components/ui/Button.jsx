import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

const variantStyles = {
  primary:
    "bg-[var(--praxis-accent)] text-[var(--praxis-on-accent)] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[var(--praxis-focus-ring)] disabled:opacity-40",
  secondary:
    "bg-[var(--praxis-bg-panel-raised)] border border-[var(--praxis-line-subtle)] text-[var(--praxis-text-primary)] hover:bg-[var(--praxis-bg-elevated)] focus-visible:ring-2 focus-visible:ring-[var(--praxis-focus-ring)] disabled:opacity-40",
  ghost:
    "bg-transparent text-[var(--praxis-text-secondary)] hover:bg-[var(--praxis-hover)] hover:text-[var(--praxis-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--praxis-focus-ring)] disabled:opacity-40",
  danger:
    "bg-[var(--praxis-danger-soft)] border border-[var(--praxis-danger)]/35 text-[var(--praxis-danger)] hover:bg-[var(--praxis-danger)]/20 focus-visible:ring-2 focus-visible:ring-[var(--praxis-danger)]/50 disabled:opacity-40",
  record:
    "bg-[var(--praxis-record)] text-[var(--praxis-on-record)] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[var(--praxis-record)]/50 disabled:opacity-40",
};

const sizeStyles = {
  sm: "h-8 px-3 text-[12px]",
  md: "h-9 px-3.5 text-[13px]",
  lg: "h-10 px-4 text-[14px]",
};

const Button = forwardRef(function Button(
  { variant = "secondary", size = "md", loading, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--praxis-radius-sm)]",
        "font-medium tracking-tight transition-[background-color,color,border-color,opacity,transform,box-shadow] duration-[var(--praxis-duration-quick)] ease-[var(--praxis-ease-out)] active:scale-[0.97] disabled:active:scale-100",
        "focus-visible:outline-none",
        variantStyles[variant],
        sizeStyles[size],
        loading && "cursor-wait",
        className,
      )}
      {...props}
    >
      {loading ? (
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : null}
      {children}
    </button>
  );
});

export { Button };
