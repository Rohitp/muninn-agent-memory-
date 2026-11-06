// Best effort. Replaces values matching known key patterns and named assignments.
const PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{16,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{16,}/g,
  /\bAKIA[0-9A-Z]{12,}/g,
  /\bxox[a-z]-[A-Za-z0-9-]{10,}/g,
  /\b[rs]k_(live|test)_[A-Za-z0-9]{10,}/g,
  /\bAIza[0-9A-Za-z_-]{20,}/g,
  /\bnpm_[A-Za-z0-9]{20,}/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_.-]+/g,
  /\b(token|password|passwd|secret|api[_-]?key|authorization|bearer|credential)s?\b\s*[=:]?\s*["']?[A-Za-z0-9_\-./+]{8,}["']?/gi,
  /[\w.+-]+@[\w-]+\.[\w.]+/g,
];
export const redact = (t: string): string => PATTERNS.reduce((a, r) => a.replace(r, "[REDACTED]"), t);
