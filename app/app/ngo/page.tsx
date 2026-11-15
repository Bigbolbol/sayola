"use client";

import { useState } from "react";
import { Button, Card, Header, Loading, Stat, StatusBadge, TxNotice, usd } from "@/components/ui";
import { useSayola } from "@/components/useSayola";
import { AREAS, RATES, RECIPIENTS, person, type RoleKey } from "@/lib/people";

export default function NgoPage() {
  const { state, loadError, busy, last, act } = useSayola();
  const [recipient, setRecipient] = useState<RoleKey>("recipient-1");
  const [amount, setAmount] = useState(378);

  if (!state) {
    return (
      <>
        <Header />
        <Loading error={loadError} />
      </>
    );
  }

  const pending = state.payments.filter((p) => p.status === "Funded" || p.status === "Booked");
  const delivered = state.payments.filter((p) => p.status === "CashedOut" || p.status === "Resolved");
  const disputes = state.payments.filter((p) => p.status === "Disputed");

  const forecast = AREAS.map((area) => {
    const demand = pending
      .filter((p) => person(p.recipientKey)?.area === area)
      .reduce((s, p) => s + p.amount, 0);
    const agents = state.agents.filter((a) => person(a.key)?.area === area);
    const cash = agents.reduce((s, a) => s + a.floatOut, 0);
    const shortfall = Math.max(0, demand - cash);
    const agent = agents[0];
    const headroom = agent ? Math.max(0, agent.limit - agent.floatOut) : 0;
    const topUp = Math.min(shortfall, headroom, state.vault.idle);
    return { area, demand, cash, shortfall, agent, topUp };
  });

  return (
    <>
      <Header contractId={state.contractId} />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold">Relief NGO dashboard</h1>
          <p className="text-sm text-stone-600">
            Multipurpose cash grants, delivered as cash in hand with on-chain proof. The NGO pays a 2% cash-out fee;
            recipients pay nothing.
          </p>
        </div>

        <TxNotice busy={busy} last={last} />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="NGO wallet" value={usd(state.ngoBalance)} />
          <Stat label="Delivered as cash" value={delivered.length} hint={usd(delivered.reduce((s, p) => s + p.amount, 0))} />
          <Stat label="Waiting for cash-out" value={pending.length} hint={usd(pending.reduce((s, p) => s + p.amount, 0))} />
          <Stat label="Open disputes" value={disputes.length} />
        </div>

        <Card title="Payday forecast: will agents have enough cash?">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-stone-500">
                <tr>
                  <th className="py-2">Area</th>
                  <th>Scheduled cash-outs</th>
                  <th>Cash positioned at agents</th>
                  <th>Shortfall</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {forecast.map((f) => (
                  <tr key={f.area} className="border-t border-stone-100">
                    <td className="py-2 font-medium">{f.area}</td>
                    <td>{usd(f.demand)}</td>
                    <td>{usd(f.cash)}</td>
                    <td className={f.shortfall > 0 ? "font-semibold text-rose-700" : "text-emerald-700"}>
                      {f.shortfall > 0 ? usd(f.shortfall) : "Covered"}
                    </td>
                    <td className="text-right">
                      {f.agent && f.topUp > 0 && (
                        <Button
                          disabled={!!busy}
                          onClick={() =>
                            act({ action: "takeFloat", agent: f.agent!.key, amount: Math.ceil(f.topUp) }, "pre-position cash")
                          }
                        >
                          Pre-position {usd(Math.ceil(f.topUp), 0)} from vault
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-stone-500">
            Demand comes from funded payments not yet collected. Float is partnership capital from the vault that agents
            hold as cash.
          </p>
        </Card>

        <Card title="Exchange rate: what a $100 grant becomes">
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            {[
              { label: "Central Bank official", rate: RATES.official, note: "Government and bank transactions" },
              { label: "Licensed partner (example)", rate: RATES.partner, note: "Paid to recipients at handover" },
              { label: "Street market", rate: RATES.street, note: "What a dollar costs in practice" },
            ].map((r) => (
              <div
                key={r.label}
                className={`rounded-xl border p-3 ${r.rate === RATES.partner ? "border-emerald-600 bg-emerald-50" : "border-stone-200"}`}
              >
                <div className="text-stone-500">{r.label}</div>
                <div className="text-lg font-semibold">{r.rate} SYP / USD</div>
                <div className="font-medium">{Math.round(100 * r.rate).toLocaleString("en-US")} SYP</div>
                <div className="text-xs text-stone-500">{r.note}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-500">
            New Syrian pounds, 14 Nov 2026. Payouts are in pounds at the partner&apos;s published rate; Sayola never sets
            the rate. Next phase: the rate and pounds paid are recorded on-chain with each cash-out.
          </p>
        </Card>

        <Card title="Fund a payment">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <div className="mb-1 text-stone-500">Recipient</div>
              <select
                className="rounded-xl border border-stone-300 px-3 py-2"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value as RoleKey)}
              >
                {RECIPIENTS.map((r) => (
                  <option key={r} value={r}>
                    {person(r)?.name} ({person(r)?.area})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <div className="mb-1 text-stone-500">Amount (USD)</div>
              <input
                type="number"
                min={1}
                className="w-32 rounded-xl border border-stone-300 px-3 py-2"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </label>
            <Button disabled={!!busy || amount <= 0} onClick={() => act({ action: "fund", recipient, amount }, "fund payment")}>
              Fund {usd(amount)} + {usd(amount * 0.02)} fee
            </Button>
          </div>
        </Card>

        <Card title="Payments">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-stone-500">
                <tr>
                  <th className="py-2">#</th>
                  <th>Recipient</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Agent</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...state.payments].reverse().map((p) => (
                  <tr key={p.id} className="border-t border-stone-100">
                    <td className="py-2 font-mono">{p.id}</td>
                    <td>
                      {person(p.recipientKey)?.name ?? p.recipientKey}{" "}
                      <span className="text-stone-400">· {person(p.recipientKey)?.area}</span>
                    </td>
                    <td>{usd(p.amount)}</td>
                    <td>
                      <StatusBadge status={p.status} />
                      {p.status === "Disputed" && (
                        <span className="ml-2 text-xs text-rose-700">says {usd(p.disputedAmount)} missing</span>
                      )}
                    </td>
                    <td>{p.agentKey ? person(p.agentKey)?.name : "—"}</td>
                    <td className="space-x-2 text-right">
                      {p.status === "Disputed" && (
                        <>
                          <Button variant="danger" disabled={!!busy} onClick={() => act({ action: "resolve", id: p.id, upheld: true }, "uphold dispute")}>
                            Uphold
                          </Button>
                          <Button variant="secondary" disabled={!!busy} onClick={() => act({ action: "resolve", id: p.id, upheld: false }, "reject dispute")}>
                            Reject
                          </Button>
                        </>
                      )}
                      {(p.status === "Funded" || p.status === "Booked") && state.now >= p.expiresAt && (
                        <Button variant="secondary" disabled={!!busy} onClick={() => act({ action: "expire", id: p.id }, "refund expired")}>
                          Refund
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </>
  );
}
