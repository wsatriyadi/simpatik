import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { LogoMark } from "../components/Logo";
import { buttonClass } from "../components/ui";

export default function NotFound() {
  const { user } = useAuth();
  const home = user?.role === "admin" ? "/admin" : user?.role === "kabid" ? "/kabid" : "/login";
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-paper px-6 text-center paper-grain">
      <LogoMark className="h-16 w-16" />
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600">404</p>
        <h1 className="mt-2 text-2xl font-extrabold text-ink">Halaman tidak ditemukan</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink/50">
          Tautan yang Anda buka mungkin sudah dipindahkan atau tidak tersedia untuk akun Anda.
        </p>
      </div>
      <Link to={home} className={buttonClass("primary", "md")}>
        <ArrowLeft className="h-4 w-4" />
        Kembali ke halaman utama
      </Link>
    </div>
  );
}
