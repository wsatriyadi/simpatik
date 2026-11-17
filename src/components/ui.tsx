import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import { avatarColor, classNames, initials, type Tone } from "../lib/format";

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "gold"
  | "dark";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-800 text-white shadow-sm hover:bg-brand-700 active:bg-brand-900 disabled:bg-brand-800/50",
  secondary:
    "bg-brand-50 text-brand-800 border border-brand-100 hover:bg-brand-100 hover:border-brand-200",
  outline:
    "bg-white text-ink border border-line hover:border-brand-200 hover:bg-brand-50/50 shadow-sm",
  ghost: "text-ink/65 hover:bg-ink/5 hover:text-ink",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800",
  gold: "bg-gold-400 text-brand-950 shadow-sm hover:bg-gold-300 active:bg-gold-500",
  dark: "bg-brand-950 text-white shadow-sm hover:bg-brand-900",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 rounded-lg px-2.5 text-xs gap-1.5",
  md: "h-10 rounded-xl px-4 text-sm gap-2",
  lg: "h-11 rounded-xl px-5 text-sm gap-2",
  icon: "h-9 w-9 rounded-lg",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className = "",
) {
  return classNames(
    "inline-flex select-none items-center justify-center font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
    buttonVariants[variant],
    buttonSizes[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {children}
    </button>
  );
});

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />;
}

/* ------------------------------------------------------------------ */
/* Badges & status                                                     */
/* ------------------------------------------------------------------ */
const toneStyles: Record<Tone, string> = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  red: "border-red-200 bg-red-50 text-red-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  blue: "border-sky-200 bg-sky-50 text-sky-700",
  slate: "border-stone-200 bg-stone-50 text-stone-600",
  gold: "border-gold-200 bg-gold-50 text-gold-800",
  dark: "border-brand-800 bg-brand-900 text-brand-50",
  brand: "border-brand-200 bg-brand-50 text-brand-700",
};

const dotStyles: Record<Tone, string> = {
  green: "bg-emerald-500",
  red: "bg-red-500",
  amber: "bg-amber-500",
  blue: "bg-sky-500",
  slate: "bg-stone-400",
  gold: "bg-gold-500",
  dark: "bg-brand-200",
  brand: "bg-brand-500",
};

export function Badge({
  tone = "slate",
  children,
  dot = false,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={classNames(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5",
        toneStyles[tone],
        className,
      )}
    >
      {dot ? <span className={classNames("h-1.5 w-1.5 rounded-full", dotStyles[tone])} /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({
  meta,
  dot = true,
  className,
}: {
  meta: { label: string; tone: Tone };
  dot?: boolean;
  className?: string;
}) {
  return (
    <Badge tone={meta.tone} dot={dot} className={className}>
      {meta.label}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/* Avatars                                                             */
/* ------------------------------------------------------------------ */
const avatarSizes = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
  hero: "h-24 w-24 text-2xl",
};

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof avatarSizes;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        className={classNames(
          "shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm",
          avatarSizes[size],
          className,
        )}
      />
    );
  }
  return (
    <span
      className={classNames(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-white",
        avatarColor(name),
        avatarSizes[size],
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */
const barColors: Record<Tone, string> = {
  green: "bg-emerald-500",
  red: "bg-red-500",
  amber: "bg-amber-500",
  blue: "bg-sky-500",
  slate: "bg-stone-400",
  gold: "bg-gold-400",
  dark: "bg-brand-800",
  brand: "bg-brand-600",
};

export function ProgressBar({
  value,
  tone = "brand",
  size = "md",
  className,
}: {
  value: number;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const height = size === "sm" ? "h-1.5" : size === "lg" ? "h-2.5" : "h-2";
  return (
    <div className={classNames("w-full overflow-hidden rounded-full bg-ink/[0.06]", height, className)}>
      <div
        className={classNames("h-full rounded-full transition-all duration-500", barColors[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function ringColor(pct: number) {
  if (pct >= 90) return "#1f8a70";
  if (pct >= 75) return "#0e7490";
  if (pct >= 60) return "#d1a545";
  return "#dc5b52";
}

export function RingProgress({
  value,
  size = 116,
  stroke = 10,
  color,
  trackColor = "#ece9e1",
  children,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  children?: ReactNode;
  className?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={classNames("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color || ringColor(pct)}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (pct / 100) * circumference}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cards & headers                                                     */
/* ------------------------------------------------------------------ */
export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return <Tag className={classNames("card", className)}>{children}</Tag>;
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={className}>
      {title || action ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line/80 px-5 py-4">
          <div>
            {title ? <h2 className="text-sm font-bold text-ink">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-xs leading-relaxed text-ink/50">{subtitle}</p> : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </div>
      ) : null}
      <div className={classNames("p-5", bodyClassName)}>{children}</div>
    </Card>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={classNames("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-600">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-[26px] font-extrabold leading-tight text-ink sm:text-[30px]">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink/55">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={classNames("card relative overflow-hidden p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-ink/45">
            {label}
          </p>
          <p className="tabular mt-1.5 text-[28px] font-extrabold leading-none text-ink">{value}</p>
          {hint ? <p className="mt-2 text-[11px] leading-relaxed text-ink/45">{hint}</p> : null}
        </div>
        {Icon ? (
          <span
            className={classNames(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
              toneStyles[tone],
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function InfoBanner({
  tone = "brand",
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={classNames(
        "flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        toneStyles[tone],
        className,
      )}
    >
      {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0" /> : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold leading-snug">{title}</p> : null}
        {children ? <div className="mt-0.5 text-xs leading-relaxed opacity-80">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form controls                                                       */
/* ------------------------------------------------------------------ */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label ? (
        <label htmlFor={htmlFor} className="field-label">
          {label}
          {required ? <span className="ml-0.5 text-red-500">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p> : null}
      {!error && hint ? <p className="mt-1.5 text-[11px] leading-relaxed text-ink/45">{hint}</p> : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leading?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leading, ...props },
  ref,
) {
  if (leading) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink/30">
          {leading}
        </span>
        <input ref={ref} className={classNames("input-base pl-9", className)} {...props} />
      </div>
    );
  }
  return <input ref={ref} className={classNames("input-base", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={classNames("input-base appearance-none pr-9", className)} {...props}>
        {children}
      </select>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={classNames("input-base min-h-[90px] resize-y", className)} {...props} />;
  },
);

export function SearchInput({
  value,
  onChange,
  placeholder = "Cari…",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={classNames("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="input-base py-2 pl-9 pr-8 text-[13px]"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink/30 hover:bg-ink/5 hover:text-ink/60"
          aria-label="Hapus pencarian"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
  description,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={classNames(
        "flex items-start gap-3",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className,
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={classNames(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
          checked ? "border-brand-700 bg-brand-700" : "border-stone-300 bg-stone-200",
        )}
      >
        <span
          className={classNames(
            "absolute left-0.5 top-0.5 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
          style={{ height: 18, width: 18 }}
        />
      </button>
      {label || description ? (
        <span className="min-w-0">
          {label ? <span className="block text-sm font-semibold text-ink">{label}</span> : null}
          {description ? <span className="mt-0.5 block text-xs leading-relaxed text-ink/50">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={classNames("flex cursor-pointer items-start gap-2.5 rounded-lg p-1.5 transition hover:bg-brand-50/50", disabled && "cursor-not-allowed opacity-50")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-700 accent-brand-700 focus:ring-brand-500"
      />
      <span className="min-w-0 text-sm leading-snug text-ink">
        {label}
        {description ? <span className="mt-0.5 block text-xs text-ink/45">{description}</span> : null}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-brand-950/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={classNames(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/40 bg-white shadow-lift animate-fade-up sm:rounded-2xl",
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-bold text-ink">
              {title}
            </h2>
            {description ? <p className="mt-1 text-xs leading-relaxed text-ink/50">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink/40 transition hover:bg-ink/5 hover:text-ink"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-[#fbfaf7] px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Ya, lanjutkan",
  cancelLabel = "Batal",
  tone = "danger",
  loading,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */
export function FilterPill({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "border-brand-800 bg-brand-800 text-white shadow-sm"
          : "border-line bg-white text-ink/60 hover:border-brand-200 hover:text-brand-800",
      )}
    >
      {children}
      {count !== undefined ? (
        <span
          className={classNames(
            "rounded-full px-1.5 py-0.5 text-[10px] leading-none",
            active ? "bg-white/15 text-white" : "bg-ink/[0.06] text-ink/50",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={classNames("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {Icon ? (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-100 bg-brand-50 text-brand-500">
          <Icon className="h-6 w-6" />
        </span>
      ) : null}
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink/50">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="text-xs text-ink/45">
        Menampilkan <span className="font-semibold text-ink/70">{start}–{end}</span> dari{" "}
        <span className="font-semibold text-ink/70">{total}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink/60 transition hover:border-brand-200 hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[70px] text-center text-xs font-semibold text-ink/60">
          {page} / {pages}
        </span>
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink/60 transition hover:border-brand-200 hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Halaman berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-3 w-32 rounded bg-ink/10" />
        <div className="h-8 w-72 max-w-full rounded-lg bg-ink/10" />
        <div className="h-3 w-96 max-w-full rounded bg-ink/[0.06]" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl border border-line bg-white" />
        ))}
      </div>
      <div className="h-80 rounded-2xl border border-line bg-white" />
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  forbidden = false,
}: {
  message: string;
  onRetry?: () => void;
  forbidden?: boolean;
}) {
  return (
    <div className="card mx-auto flex max-w-md flex-col items-center px-6 py-10 text-center">
      <span
        className={classNames(
          "mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border",
          forbidden ? "border-amber-200 bg-amber-50 text-amber-600" : "border-red-200 bg-red-50 text-red-600",
        )}
      >
        <AlertTriangle className="h-6 w-6" />
      </span>
      <h2 className="text-base font-bold">{forbidden ? "Akses ditolak" : "Data gagal dimuat"}</h2>
      <p className="mt-1 text-xs leading-relaxed text-ink/50">{message}</p>
      {onRetry ? (
        <Button onClick={onRetry} variant="outline" size="sm" className="mt-4">
          Coba lagi
        </Button>
      ) : null}
    </div>
  );
}

export function HelpNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-brand-50/60 px-3 py-2.5 text-[11px] leading-relaxed text-brand-800/75">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={classNames("overflow-x-auto scroll-thin", className)}>{children}</div>;
}
