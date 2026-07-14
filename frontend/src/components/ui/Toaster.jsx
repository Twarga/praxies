import { Toaster as Sonner } from "sonner";
export function Toaster() { return <Sonner theme="dark" position="bottom-right" toastOptions={{ classNames: { toast: "!border-[var(--praxis-line-strong)] !bg-[var(--praxis-bg-panel)] !text-[var(--praxis-text-primary)]" } }}/>; }
