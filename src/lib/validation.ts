/**
 * Shared server-side validation.
 *
 * These exist because the browser cannot be trusted to have checked anything.
 * The signup forms mark fields `required` and the client scripts run their own
 * checks, but both are trivially bypassed by posting to the route directly, so
 * every rule that matters is repeated here.
 */

/**
 * A pragmatic address check: one `@`, a non-empty local part, and a domain with
 * at least one dot and a 2+ character TLD.
 *
 * Deliberately not an attempt at RFC 5322. Full conformance accepts addresses
 * (`"a@b"`, `user@localhost`, quoted local parts) that no real Nigerian vendor
 * or rider would type and that would silently fail to receive mail, so the
 * check is tightened to what is actually deliverable.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function isValidEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const email = value.trim();
  if (!email || email.length > 255) return false;
  if (email.includes("..")) return false;

  const [local, domain, ...rest] = email.split("@");
  if (rest.length > 0) return false;
  if (!local || !domain) return false;

  const tld = domain.split(".").pop() ?? "";
  return tld.length >= 2 && /^[a-z]+$/i.test(tld);
}

/**
 * Lowercases and trims so the same address typed two ways compares and dedupes
 * consistently. The domain is lowercased; the local part is left alone because
 * it is case-sensitive per spec, and Nigerian mail providers treat it loosely
 * anyway.
 */
export function normalizeEmail(value: string): string {
  const email = value.trim();
  const at = email.lastIndexOf("@");
  if (at === -1) return email.toLowerCase();
  return `${email.slice(0, at)}@${email.slice(at + 1).toLowerCase()}`;
}

/**
 * Accepts Nigerian mobile numbers with or without the country code, spaces or
 * dashes: `0803...`, `+234803...`, `0803 123 4567`.
 */
export function isValidPhone(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const digits = value.replace(/[\s()-]/g, "");
  if (!/^\+?\d{10,15}$/.test(digits)) return false;
  return digits.length >= 10 && digits.length <= 15;
}

/** Trims a value to a string, returning null when nothing is left. */
export function optionalText(value: unknown, maxLength = 255): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, maxLength);
}

/** A required free-text field, trimmed and length-capped. */
export function requiredText(value: unknown, field: string, maxLength = 255): string {
  const s = optionalText(value, maxLength);
  if (!s) throw new ValidationError(`${field} is required.`);
  return s;
}

export class ValidationError extends Error {}

/** Coerces to a non-negative integer, for money and quantity columns. */
export function nonNegativeInt(value: unknown, fallback = 0): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Clamps an integer to an inclusive range. */
export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Validates a public id the client generated, e.g. `dish-1756312345678-k3f9qz`
 * or `rest-mama-t`. Ids are accepted as primary keys so an edit updates the same
 * row, but the shape is constrained so a caller cannot push arbitrary text into
 * a key column.
 */
export function readClientId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  return id;
}

/** Latitude/longitude to the fixed precision the numeric(9,6) columns use. */
export function toCoord(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < -180 || n > 180) return null;
  return n.toFixed(6);
}

/** Latitudes are only valid between the poles. */
export function toLat(value: unknown): string | null {
  const coord = toCoord(value);
  if (coord === null) return null;
  const n = Number(coord);
  return n >= -90 && n <= 90 ? coord : null;
}
