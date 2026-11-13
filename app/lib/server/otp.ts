import "server-only";
import { createHmac } from "node:crypto";

const WINDOW_MS = 5 * 60 * 1000;
const SECRET = process.env.SAYOLA_OTP_SECRET ?? process.env.SAYOLA_SECRET_ADMIN ?? "dev";

/** Stateless one-time code: valid for the current and previous 5-minute window. */
function codeFor(subject: string, window: number): string {
  const digest = createHmac("sha256", SECRET).update(`${subject}:${window}`).digest();
  return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

export function currentCode(subject: string): string {
  return codeFor(subject, Math.floor(Date.now() / WINDOW_MS));
}

export function verifyCode(subject: string, code: string): boolean {
  const now = Math.floor(Date.now() / WINDOW_MS);
  return code === codeFor(subject, now) || code === codeFor(subject, now - 1);
}
