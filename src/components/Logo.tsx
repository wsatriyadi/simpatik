import { classNames } from "../lib/format";

export function LogoMark({
  className,
  tone = "color",
}: {
  className?: string;
  tone?: "color" | "light";
}) {
  const shield = tone === "light" ? "#ffffff" : "#1e554e";
  const shirt = tone === "light" ? "#1e554e" : "#f7f5f0";
  return (
    <svg
      viewBox="0 0 48 48"
      className={classNames("shrink-0", className)}
      role="img"
      aria-label="Logo SIMPATIK"
    >
      <path
        d="M24 3.2 42.2 10v12.4c0 11.1-7.4 19.8-18.2 24.6C13.2 42.2 5.8 33.5 5.8 22.4V10L24 3.2Z"
        fill={shield}
      />
      <path
        d="M17.2 17.4l4.6 2.5L24 16l2.2 3.9 4.6-2.5v7.5c0 5.6-3.1 9.2-6.8 11-3.7-1.8-6.8-5.4-6.8-11v-7.5Z"
        fill={shirt}
      />
      <path
        d="M20.6 25.6l2.4 2.5 4.6-5.3"
        stroke="#d1a545"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function AppLogo({
  tone = "color",
  compact = false,
  subtitle = true,
}: {
  tone?: "color" | "light";
  compact?: boolean;
  subtitle?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark tone={tone} className={compact ? "h-9 w-9" : "h-10 w-10"} />
      <div className="min-w-0">
        <div
          className={classNames(
            "text-[17px] font-extrabold leading-none tracking-[0.06em]",
            tone === "light" ? "text-white" : "text-brand-900",
          )}
        >
          SIMPATIK
        </div>
        {subtitle ? (
          <div
            className={classNames(
              "mt-1 truncate text-[9px] font-semibold uppercase tracking-[0.14em]",
              tone === "light" ? "text-brand-200/80" : "text-brand-600/70",
            )}
          >
            Monitoring Pakaian Dinas ASN
          </div>
        ) : null}
      </div>
    </div>
  );
}
