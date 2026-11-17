import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  Info,
  MousePointerClick,
  Search,
  Users,
} from "lucide-react";
import { useApi, useDocumentTitle, useMediaQuery } from "../../lib/hooks";
import {
  ASSESSMENT_META,
  FORM_META,
  classNames,
  formatDate,
} from "../../lib/format";
import type {
  AssessmentStatus,
  FormEmployee,
  FormStatus,
  Item,
  Period,
  Stats,
  Unit,
} from "../../lib/types";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  FilterPill,
  SearchInput,
  StatusBadge,
  ProgressBar,
} from "../../components/ui";
import { EmployeeAssessment } from "../../components/kabid/EmployeeAssessment";

interface UnitResponse {
  period: Period | null;
  unit: Unit;
  form:
    | (Stats & {
        id: number;
        status: FormStatus;
        tanggal_pemeriksaan: string | null;
        can_fill?: boolean;
      })
    | null;
  stats: Stats;
  employees: FormEmployee[];
  items: Item[];
  can_fill: boolean;
  sementara: boolean;
}

type Filter = "all" | AssessmentStatus;

const FILTER_LABEL: Record<Filter, string> = {
  all: "Semua",
  belum: "Belum Dinilai",
  patuh: "Patuh",
  tidak_patuh: "Tidak Patuh",
  tidak_diperiksa: "Tidak Diperiksa",
};

export default function KabidUnit() {
  const { unitId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { data, loading, error, status, reload } = useApi<UnitResponse>(
    unitId ? `/kabid/units/${unitId}` : null,
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [visible, setVisible] = useState(40);
  useDocumentTitle(data?.unit.nama || "Unit Kerja");

  const selectedId = Number(searchParams.get("pegawai")) || null;

  useEffect(() => {
    setVisible(40);
  }, [query, filter]);

  useEffect(() => {
    if (!isDesktop || !data || selectedId) return;
    const first =
      data.employees.find((employee) => employee.status === "belum") ||
      data.employees[0];
    if (!first) return;
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("pegawai", String(first.id));
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }, [data, isDesktop, selectedId, setSearchParams]);

  const employees = data?.employees || [];
  const counts = useMemo(() => {
    const base: Record<Filter, number> = {
      all: employees.length,
      belum: 0,
      patuh: 0,
      tidak_patuh: 0,
      tidak_diperiksa: 0,
    };
    employees.forEach((employee) => {
      base[employee.status] += 1;
    });
    return base;
  }, [employees]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchQuery =
        !q ||
        employee.nama.toLowerCase().includes(q) ||
        (employee.nip || "").includes(q);
      const matchFilter = filter === "all" || employee.status === filter;
      return matchQuery && matchFilter;
    });
  }, [employees, query, filter]);

  const selectEmployee = (id: number) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("pegawai", String(id));
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  };

  if (loading && !data) {
    return (
      <div className="space-y-3 pt-2">
        <div className="h-4 w-28 animate-pulse rounded bg-ink/10" />
        <div className="h-32 animate-pulse rounded-2xl border border-line bg-white" />
        <div className="h-11 animate-pulse rounded-xl bg-white" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl border border-line bg-white" />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={reload} forbidden={status === 403} />;
  if (!data) return null;

  if (!data.period || !data.form) {
    return (
      <div className="space-y-4 pt-2">
        <Link to="/kabid" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink/45">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali
        </Link>
        <div className="card">
          <EmptyState
            icon={ClipboardList}
            title="Formulir belum tersedia"
            description="Unit ini belum memiliki formulir pada periode berjalan."
          />
        </div>
      </div>
    );
  }

  const { unit, form, stats } = data;
  const locked = !data.can_fill;

  const employeeCard = (employee: FormEmployee, desktop: boolean) => {
    const meta = ASSESSMENT_META[employee.status];
    const note =
      employee.status === "tidak_diperiksa"
        ? `Tidak diperiksa · ${employee.alasan || "tanpa alasan"}`
        : employee.violated?.length
          ? employee.violated.join(" · ")
          : employee.keterangan || null;
    const active = desktop && selectedId === employee.id;

    return (
      <Link
        key={employee.id}
        to={`/kabid/pegawai/${employee.id}`}
        onClick={(event) => {
          if (!desktop) return;
          event.preventDefault();
          selectEmployee(employee.id);
        }}
        aria-current={active ? "true" : undefined}
        className={classNames(
          "flex w-full min-w-0 items-center gap-3 rounded-2xl border bg-white px-3.5 py-3 shadow-soft transition active:scale-[0.995] lg:px-3 lg:py-2.5 lg:shadow-none",
          active
            ? "border-brand-500 bg-brand-50/70 ring-1 ring-brand-500/20"
            : "border-line hover:border-brand-200 hover:bg-brand-50/30",
        )}
      >
        <Avatar
          name={employee.nama}
          src={employee.foto_path ? `/api/photos/${employee.employee_id}` : null}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[12px] font-bold leading-snug text-ink">
            {employee.nama}
          </p>
          <p className="mt-0.5 text-[9px] text-ink/35">
            <span className="block truncate">
              {employee.nip || "Tanpa NIP"}
              {employee.jabatan ? ` · ${employee.jabatan}` : ""}
            </span>
          </p>
          {note ? (
            <p
              className={classNames(
                "mt-1 truncate text-[9px] font-medium",
                employee.status === "tidak_patuh"
                  ? "text-red-600/80"
                  : employee.status === "tidak_diperiksa"
                    ? "text-amber-700/80"
                    : "text-ink/35",
              )}
            >
              {note}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge meta={meta} />
          {desktop ? (
            <ArrowRight
              className={classNames("h-3.5 w-3.5", active ? "text-brand-500" : "text-ink/20")}
            />
          ) : (
            <ArrowRight className="h-3.5 w-3.5 text-ink/20" />
          )}
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      <div className="mx-auto flex w-full max-w-[560px] md:max-w-[760px] items-center justify-between gap-3 lg:max-w-none">
        <Link to="/kabid" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink/45">
          <ArrowLeft className="h-3.5 w-3.5" /> Beranda
        </Link>
        <Link
          to={`/kabid/form/${form.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[10px] font-bold text-brand-700 shadow-sm"
        >
          Ringkasan formulir <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="mx-auto w-full max-w-[560px] md:max-w-[760px] overflow-hidden rounded-2xl border border-line bg-white shadow-soft lg:max-w-none">
        <div className="border-b border-line/70 bg-gradient-to-br from-brand-50/80 to-white px-4 py-4 lg:flex lg:items-center lg:justify-between lg:gap-8 lg:px-6 lg:py-5">
          <div className="flex items-start justify-between gap-3 lg:min-w-0 lg:flex-1">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-brand-600">
                  {data.period.label}
                </p>
                {data.sementara ? <Badge tone="gold">Sementara</Badge> : null}
              </div>
              <h1 className="mt-1 text-[19px] font-extrabold leading-tight text-ink lg:text-[24px]">
                {unit.nama}
              </h1>
              <p className="mt-1 text-[10px] text-ink/40 lg:text-[11px]">
                {stats.total} pegawai · {stats.diperiksa} diperiksa · {stats.belum} belum dinilai
              </p>
            </div>
            <div className="lg:hidden">
              <StatusBadge meta={FORM_META[form.status]} />
            </div>
          </div>
          <div className="mt-4 lg:mt-0 lg:w-[340px] lg:shrink-0">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink/30">
                Progres pengisian
              </span>
              <span className="tabular text-[11px] font-extrabold text-ink/60">
                {stats.answered_pct}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ProgressBar
                value={stats.answered_pct}
                tone={stats.answered === stats.total ? "green" : "brand"}
                size="lg"
              />
              <span className="hidden w-14 text-right text-[10px] font-bold text-emerald-700 lg:block">
                {stats.pct}% patuh
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[9px] text-ink/40">
              <span>
                {stats.answered}/{stats.total} pegawai berstatus
              </span>
              <span className="lg:hidden">
                Kepatuhan <span className="font-bold text-emerald-700">{stats.pct}%</span>
              </span>
              <span className="hidden lg:inline">
                {stats.patuh} patuh · {stats.tidak_patuh} tidak patuh
              </span>
            </div>
            <div className="mt-3 hidden lg:flex lg:items-center lg:justify-between">
              <StatusBadge meta={FORM_META[form.status]} />
              <span className="text-[9px] text-ink/30">Diperbarui otomatis saat menyimpan</span>
            </div>
          </div>
        </div>
        {locked ? (
          <div className="flex items-center gap-2 bg-amber-50 px-4 py-2.5 text-[10px] font-medium text-amber-800 lg:px-6">
            <Info className="h-3.5 w-3.5" /> Formulir hanya dapat dilihat. Periode mungkin sudah ditutup.
          </div>
        ) : null}
      </div>

      <div className="mx-auto grid w-full max-w-[560px] md:max-w-[760px] items-start gap-4 lg:max-w-none lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[370px_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col rounded-2xl border border-line bg-white shadow-soft lg:sticky lg:top-[88px] lg:max-h-[calc(100dvh-110px)] lg:overflow-hidden">
          <div className="border-b border-line/70 p-3">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Cari nama atau NIP pegawai…"
            />
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {(Object.keys(FILTER_LABEL) as Filter[]).map((value) => (
                <FilterPill
                  key={value}
                  active={filter === value}
                  onClick={() => setFilter(value)}
                  count={counts[value]}
                >
                  {FILTER_LABEL[value]}
                </FilterPill>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink/35">
                {filtered.length} pegawai
              </p>
              <p className="hidden shrink-0 whitespace-nowrap text-[9px] text-ink/30 xl:block">
                <MousePointerClick className="mr-1 inline h-3 w-3" />
                Pilih untuk menilai
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 lg:overflow-y-auto lg:scroll-thin">
            {filtered.length ? (
              <div className="grid gap-2 p-3 md:grid-cols-2 lg:grid-cols-1 lg:p-2">
                {filtered.slice(0, visible).map((employee) => employeeCard(employee, isDesktop))}
              </div>
            ) : (
              <div className="p-3">
                <EmptyState
                  icon={query ? Search : Users}
                  title={query ? "Pegawai tidak ditemukan" : "Tidak ada pegawai pada saringan ini"}
                  description={
                    query
                      ? "Coba kata kunci lain atau hapus saringan status."
                      : "Ubah saringan status untuk melihat pegawai lainnya."
                  }
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setQuery("");
                        setFilter("all");
                      }}
                    >
                      Reset saringan
                    </Button>
                  }
                />
              </div>
            )}
          </div>

          {filtered.length > visible ? (
            <div className="border-t border-line/70 p-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setVisible((value) => value + 50)}
              >
                Tampilkan lebih banyak ({filtered.length - visible} lagi)
              </Button>
            </div>
          ) : null}
        </div>

        <div className="hidden min-w-0 lg:block">
          {selectedId ? (
            <EmployeeAssessment
              key={selectedId}
              employeeId={selectedId}
              embedded
              onSaved={reload}
              onNext={(nextId) => {
                selectEmployee(nextId);
                if (form.status === "selesai") void reload();
              }}
              onFinish={() => navigate(`/kabid/form/${form.id}`)}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-16 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <ClipboardList className="h-6 w-6" />
              </span>
              <p className="mt-4 text-sm font-extrabold text-ink">Pilih pegawai untuk menilai</p>
              <p className="mx-auto mt-1 max-w-[300px] text-[11px] leading-relaxed text-ink/40">
                Daftar pegawai berada di panel kiri. Pilih satu pegawai untuk menampilkan checklist
                di panel ini tanpa berpindah halaman.
              </p>
            </div>
          )}
        </div>
      </div>

      {form.status === "selesai" ? (
        <div className="mx-auto flex w-full max-w-[560px] md:max-w-[760px] items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[10px] leading-relaxed text-emerald-800 lg:max-w-none">
          <CheckCircleIcon />
          <div>
            Formulir sudah ditandai selesai
            {form.tanggal_pemeriksaan ? ` pada ${formatDate(form.tanggal_pemeriksaan, "medium")}` : ""}.
            Bila ada perubahan, buka pegawai dan simpan ulang — status formulir kembali menjadi
            Sedang Diisi.
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.236 4.451-1.58-1.58a.75.75 0 00-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.461z" clipRule="evenodd" />
    </svg>
  );
}
