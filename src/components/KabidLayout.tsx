import { Link, Outlet, useLocation } from "react-router-dom";
import { BarChart3, ClipboardCheck, Home, UserRound } from "lucide-react";
import { AppLogo } from "./Logo";
import { useAuth } from "../contexts/AuthContext";
import { Avatar } from "./ui";
import { classNames } from "../lib/format";

const NAV = [
  { label: "Beranda", to: "/kabid", icon: Home, end: true },
  { label: "Penilaian", to: "/kabid/penilaian", icon: ClipboardCheck },
  { label: "Rekap", to: "/kabid/rekap", icon: BarChart3 },
  { label: "Akun", to: "/kabid/akun", icon: UserRound },
];

export default function KabidLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  function isActive(to: string) {
    if (to === "/kabid") return pathname === "/kabid";
    if (to === "/kabid/penilaian") {
      return (
        pathname === to ||
        pathname.startsWith("/kabid/unit") ||
        pathname.startsWith("/kabid/pegawai") ||
        pathname.startsWith("/kabid/form")
      );
    }
    return pathname === to || pathname.startsWith(`${to}/`);
  }

  return (
    <div className="min-h-dvh bg-[#f3f0e8] paper-grain">
      <div className="pointer-events-none fixed inset-0 -z-0 bg-gradient-to-b from-brand-50/40 via-transparent to-transparent" />
      <header className="sticky top-0 z-30 border-b border-line/70 bg-[#f3f0e8]/88 backdrop-blur-md">
        <div className="mx-auto flex h-[62px] w-full max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-5 lg:h-[70px] lg:px-8">
          <Link to="/kabid" className="focus-ring shrink-0 rounded-lg">
            <AppLogo compact />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigasi utama Kabid">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={classNames(
                    "relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12px] font-bold transition",
                    active
                      ? "bg-white text-brand-900 shadow-sm"
                      : "text-ink/50 hover:bg-white/60 hover:text-brand-800",
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={active ? 2.2 : 1.9} />
                  {item.label}
                  {active ? (
                    <span className="absolute inset-x-3 -bottom-[11px] h-[2px] rounded-full bg-gold-500" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5">
            <span className="hidden rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-brand-700 sm:inline-flex lg:hidden">
              PWA Kabid
            </span>
            <Link
              to="/kabid/akun"
              aria-label="Pengaturan akun"
              className="flex items-center gap-2.5 rounded-xl transition hover:bg-white/60 lg:px-2 lg:py-1.5"
            >
              <div className="hidden text-right lg:block">
                <p className="max-w-[220px] truncate text-[11px] font-bold leading-tight text-ink">
                  {user?.nama || "Kabid"}
                </p>
                <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-ink/35">
                  Kabid · {user?.nip || "—"}
                </p>
              </div>
              <Avatar name={user?.nama || "Kabid"} size="sm" />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[1320px] px-4 pb-32 pt-4 sm:px-5 lg:px-8 lg:pb-12 lg:pt-7">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[560px] -translate-x-1/2 border-t border-line bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 shadow-[0_-8px_30px_-18px_rgba(21,32,30,0.35)] backdrop-blur-md sm:bottom-4 sm:rounded-2xl sm:border sm:px-3 sm:shadow-lift lg:hidden">
        <div className="grid grid-cols-4">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={classNames(
                  "group flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 transition",
                  active ? "text-brand-800" : "text-ink/40 hover:text-brand-700",
                )}
              >
                <span
                  className={classNames(
                    "flex h-8 w-12 items-center justify-center rounded-xl transition",
                    active ? "bg-brand-800 text-white shadow-sm" : "bg-transparent",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.9} />
                </span>
                <span
                  className={classNames(
                    "text-[10px] font-bold",
                    active ? "text-brand-800" : "text-ink/40",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
