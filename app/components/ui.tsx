"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { PaymentStatus } from "@/lib/types";
import type { TxResult } from "./useSayola";

export const EXPLORER = "https://stellar.expert/explorer/testnet";

export function usd(n: number, digits = 2): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function short(addr: string): string {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function Card({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-stone-200 bg-white p-5 shadow-sm ${className}`}>
      {title && <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">{title}</h2>}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl bg-stone-50 p-3">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-stone-900">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-stone-500">{hint}</div>}
    </div>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  type?: "button" | "submit";
}) {
  const styles = {
    primary: "bg-emerald-700 text-white hover:bg-emerald-800",
    secondary: "bg-stone-100 text-stone-800 hover:bg-stone-200",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}

const STATUS_STYLE: Record<PaymentStatus, string> = {
  Funded: "bg-sky-100 text-sky-800",
  Booked: "bg-amber-100 text-amber-800",
  CashedOut: "bg-emerald-100 text-emerald-800",
  Disputed: "bg-rose-100 text-rose-800",
  Resolved: "bg-stone-200 text-stone-700",
  Expired: "bg-stone-100 text-stone-500",
};

const STATUS_AR: Record<PaymentStatus, string> = {
  Funded: "بانتظار الاستلام",
  Booked: "محجوز",
  CashedOut: "تم الاستلام",
  Disputed: "اعتراض قيد المراجعة",
  Resolved: "تمت المعالجة",
  Expired: "منتهي الصلاحية",
};

export function StatusBadge({ status, arabic = false }: { status: PaymentStatus; arabic?: boolean }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
      {arabic ? STATUS_AR[status] : status === "CashedOut" ? "Cashed out" : status}
    </span>
  );
}

export function TxNotice({ busy, last, arabic = false }: { busy: string | null; last: TxResult | null; arabic?: boolean }) {
  if (busy) {
    return (
      <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {arabic ? "جارٍ التنفيذ على شبكة ستيلار…" : `Submitting to Stellar testnet: ${busy}…`}
      </div>
    );
  }
  if (!last) return null;
  if (last.error) {
    return <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900">{last.error}</div>;
  }
  return (
    <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      {arabic ? "تم التنفيذ. " : "Confirmed on Stellar testnet. "}
      <a className="font-medium underline" href={`${EXPLORER}/tx/${last.hash}`} target="_blank" rel="noreferrer">
        {arabic ? "عرض المعاملة" : "View transaction"} ↗
      </a>
    </div>
  );
}

export function Loading({ error }: { error: string | null }) {
  return (
    <div className="p-10 text-center text-sm text-stone-500">
      {error ? `Could not load contract state: ${error}` : "Reading contract state from Stellar testnet…"}
    </div>
  );
}

const NAV = [
  { href: "/ngo", label: "NGO" },
  { href: "/agent", label: "Agent" },
  { href: "/recipient", label: "Recipient" },
  { href: "/invest", label: "Investor" },
];

export function Header({ contractId }: { contractId?: string }) {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-emerald-800">Sayola</span>
          <span className="font-arabic text-sm text-stone-500">سيولة</span>
        </Link>
        <nav className="flex gap-1 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-lg px-3 py-1.5 text-stone-700 hover:bg-stone-100">
              {n.label}
            </Link>
          ))}
        </nav>
        {contractId && (
          <a
            href={`${EXPLORER}/contract/${contractId}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-stone-100 px-2.5 py-1 font-mono text-xs text-stone-600 hover:bg-stone-200"
          >
            testnet · {short(contractId)} ↗
          </a>
        )}
      </div>
    </header>
  );
}
