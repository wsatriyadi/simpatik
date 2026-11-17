export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const isForm = options.body instanceof FormData;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined && !isForm) headers["Content-Type"] = "application/json";

  const response = await fetch(`/api${path}`, {
    method: options.method || (options.body !== undefined ? "POST" : "GET"),
    headers,
    credentials: "same-origin",
    body:
      options.body === undefined
        ? undefined
        : isForm
          ? (options.body as FormData)
          : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent("simpatik:unauthorized"));
  }

  let payload: Record<string, unknown> = {};
  const type = response.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }
  }

  if (!response.ok) {
    const message =
      typeof payload.error === "string" ? payload.error : "Terjadi kesalahan. Silakan coba lagi.";
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export async function downloadFile(path: string, fallbackName = "laporan"): Promise<void> {
  const response = await fetch(`/api${path}`, { credentials: "same-origin" });
  if (!response.ok) {
    let message = "Berkas gagal diunduh.";
    try {
      const data = await response.json();
      if (typeof data.error === "string") message = data.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, response.status);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/i);
  const filename = match?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
