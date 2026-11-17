import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Building2,
  CalendarDays,
  FileSpreadsheet,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Upload,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { AppLogo } from "./Logo";
import { Avatar } from "./ui";
import { classNames, formatDate } from "../lib/format";

type NavItem =
  | { type: "item"; label: string; to: string; icon: LucideIcon; end?: boolean }
  | { type: "divider"; label: string };

const NAV: NavItem[] = [
  { type: "item", label: "Dasbor Pemantauan", to: "/admin", icon: LayoutDashboard, end: true },
  { type: "item", label: "Rekap Gabungan", to: "/admin/recap", icon: BarChart3 },
  { type: "divider", label: "Data induk" },
  { type: "item", label: "Unit Kerja", to: "/admin/units", icon: Building2 },
  { type: "item", label: "Pegawai", to: "/admin/employees", icon: Users },
  { type: "item", label: "Impor Pegawai", to: "/admin/import", icon: Upload },
  { type: "item", label: "Akun & Penugasan", to: "/admin/users", icon: ShieldCheck },
  { type: "item", label: "Item Periksa", to: "/admin/items", icon: ListChecks },
  { type: "divider", label: "Lainnya" },
  { type: "item", label: "Pengaturan Akun", to: "/admin/settings", icon: Settings },
];

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pb-4 pt-5">
        <Link to="/admin" onClick={onNavigate} className="focus-ring rounded-lg">
          <AppLogo tone="light" />
        </Link>
        {onNavigate ? (
          <button
            type="button"
            onClick={onNavigate}
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Tutup menu"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-100/70">
          Web Admin
        </span>
        <span className="ml-auto text-[9px] font-medium text-brand-200/40">Fase 1</span>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 scroll-thin">
        {NAV.map((item, idx) => {
          if (item.type === "divider") {
            return (
              <div
                key={`divider-${idx}`}
                className="mb-1.5 mt-5 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-brand-200/35 first:mt-1"
              >
                {item.label}
              </div>
            );
          }
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                classNames(
                  "group relative mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition",
                  isActive
                    ? "bg-white/[0.10] text-white shadow-inset"
                    : "text-brand-100/60 hover:bg-white/[0.05] hover:text-white",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={classNames(
                      "absolute left-0 h-5 w-[3px] rounded-r-full bg-gold-400 transition-opacity",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <Icon
                    className={classNames(
                      "h-[18px] w-[18px] transition",
                      isActive ? "text-gold-300" : "text-brand-200/45 group-hover:text-brand-100/80",
                    )}
                    strokeWidth={1.9}
                  />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <Link
          to="/admin/settings"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.05]"
        >
          <Avatar name={user?.nama || "Admin"} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{user?.nama}</p>
            <p className="truncate text-[10px] text-brand-200/50">
              {user?.jabatan || "Administrator"}
            </p>
          </div>
          <Settings className="h-4 w-4 text-brand-200/35" />
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[12px] font-semibold text-brand-200/50 transition hover:bg-white/[0.05] hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </button>
        <p className="px-3 pt-2 text-[9px] font-medium tracking-[0.1em] text-brand-200/25">
          SIMPATIK v1.0.0 · RSJ SAMBANG LIHUM
        </p>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-dvh bg-paper">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-brand-900/40 bg-brand-950 brand-pattern lg:flex">
        <SidebarBody />
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div
            className="absolute inset-0 bg-brand-950/60 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-[286px] max-w-[86vw] border-r border-brand-900 bg-brand-950 brand-pattern shadow-lift">
            <SidebarBody onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/85 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-ink/60 shadow-sm lg:hidden"
                aria-label="Buka menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink/35">
                  Ruang kerja
                </p>
                <p className="truncate text-sm font-bold text-ink">Web Admin</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden items-center gap-2 rounded-lg border border-line/80 bg-white/60 px-3 py-1.5 text-[11px] font-medium text-ink/50 md:flex">
                <CalendarDays className="h-3.5 w-3.5 text-brand-500" />
                {formatDate(new Date().toISOString(), "long")}
              </div>
              <Link
                to="/admin/settings"
                className="flex items-center gap-2.5 rounded-full border border-line bg-white py-1 pl-1 pr-1 sm:pr-3 shadow-sm transition hover:border-brand-200"
              >
                <Avatar name={user?.nama || "Admin"} size="sm" />
                <span className="hidden max-w-[150px] truncate text-xs font-bold text-ink sm:block">
                  {user?.nama}
                </span>
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
