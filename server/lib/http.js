export class HttpError extends Error {
  constructor(status, message, extra = null) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function badRequest(message) {
  return new HttpError(400, message);
}

export function notFound(message = "Data tidak ditemukan.") {
  return new HttpError(404, message);
}

export function forbidden(message = "Anda tidak memiliki akses ke data ini.") {
  return new HttpError(403, message);
}

export function cleanText(value, max = 500) {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/\u00a0/g, " ").trim();
  if (!text) return null;
  return text.slice(0, max);
}

export function requireText(value, message, max = 500) {
  const text = cleanText(value, max);
  if (!text) throw badRequest(message);
  return text;
}

export function toInt(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
