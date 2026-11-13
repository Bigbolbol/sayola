"use client";

import Link from "next/link";
import { Card, EXPLORER, Header, Stat, usd } from "@/components/ui";
import { useSayola } from "@/components/useSayola";

const ROLES = [
  {
    href: "/ngo",
    title: "NGO dashboard",
    body: "Fund aid payments, see which agents will run short before payday, and audit every cash-out.",
  },
  {
    href: "/agent",
    title: "Agent (Arabic)",
    body: "Take float from the vault, then pay out cash with two-party confirmation by SMS code or card + PIN.",
  },
  {
    href: "/recipient",
    title: "Recipient (Arabic)",
    body: "See the balance in Syrian pounds, book a cash-out so the cash is waiting, raise a dispute privately.",
  },
  {
    href: "/invest",
    title: "Vault investor",
    body: "Join the musharakah pool that funds agents' cash, and earn a share of real cash-out fees.",
  },
];

export default function Home() {
  const { state } = useSayola();
  const cashedOut = state?.payments.filter((p) => p.status === "CashedOut" || p.status === "Resolved") ?? [];
  const pending = state?.payments.filter((p) => p.status === "Funded" || p.status === "Booked") ?? [];

  return (
    <>
      <Header contractId={state?.contractId} />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-10">
        <section className="space-y-4">
          <p className="text-sm font-medium text-emerald-700">Stellar testnet prototype</p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight text-stone-900">
            Aid and remittances reach Syria in seconds. Sayola makes sure the cash is there too.
          </h1>
          <p className="max-w-3xl text-lg text-stone-600">
            Booked cash-out with on-chain proof of delivery, funded by a halal liquidity vault that turns
            families&apos; idle savings into the cash agents need before every payday.
          </p>
        </section>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Payments funded" value={state ? state.payments.length : "…"} />
          <Stat label="Cashed out (proof on-chain)" value={state ? cashedOut.length : "…"} />
          <Stat label="Waiting for cash-out" value={state ? usd(pending.reduce((s, p) => s + p.amount, 0)) : "…"} />
          <Stat
            label="Vault share value"
            value={state ? state.vault.shareValue.toFixed(6) : "…"}
            hint={state ? `${usd(state.vault.feesEarned)} fees earned` : undefined}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {ROLES.map((r) => (
            <Link key={r.href} href={r.href} className="group">
              <Card className="h-full transition group-hover:border-emerald-400">
                <h3 className="text-lg font-semibold text-stone-900">{r.title} →</h3>
                <p className="mt-1 text-sm text-stone-600">{r.body}</p>
              </Card>
            </Link>
          ))}
        </div>

        <Card title="Verify it yourself">
          <ul className="space-y-2 text-sm">
            <li>
              Contract:{" "}
              {state && (
                <a className="font-mono text-emerald-800 underline" href={`${EXPLORER}/contract/${state.contractId}`} target="_blank" rel="noreferrer">
                  {state.contractId}
                </a>
              )}
            </li>
            <li>
              Mock USDC (Stellar asset contract):{" "}
              {state && (
                <a className="font-mono text-emerald-800 underline" href={`${EXPLORER}/contract/${state.tokenId}`} target="_blank" rel="noreferrer">
                  {state.tokenId}
                </a>
              )}
            </li>
            <li className="text-stone-600">
              Every action in this app is a real testnet transaction. Fees are paid by the operator account, so agents
              and recipients never hold XLM. Names and phone numbers are fictional and never stored on-chain.
            </li>
          </ul>
        </Card>
      </main>
    </>
  );
}
