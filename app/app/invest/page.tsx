"use client";

import { useState } from "react";
import { Button, Card, Header, Loading, Stat, TxNotice, usd } from "@/components/ui";
import { useSayola } from "@/components/useSayola";

export default function InvestPage() {
  const { state, loadError, busy, last, act } = useSayola();
  const [deposit, setDeposit] = useState(1000);
  const [withdraw, setWithdraw] = useState(500);

  if (!state) {
    return (
      <>
        <Header />
        <Loading error={loadError} />
      </>
    );
  }

  const { vault, investor } = state;
  const totalAssets = vault.idle + vault.floatOut;
  const utilisation = totalAssets > 0 ? vault.floatOut / totalAssets : 0;
  const unlockIn = Math.max(0, investor.unlockAt - state.now);
  const available = investor.shares - investor.pendingShares;

  return (
    <>
      <Header contractId={state.contractId} />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold">Liquidity vault</h1>
          <p className="text-sm text-stone-600">
            Omar, working in Germany, holds a position meant as a monthly income source for his parents in Idlib. The
            vault funds agents&apos; cash as partnership capital and earns 50% of every cash-out fee.
          </p>
        </div>

        <TxNotice busy={busy} last={last} />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Your position" value={usd(investor.value)} hint={`${investor.shares.toLocaleString()} shares`} />
          <Stat label="Share value" value={vault.shareValue.toFixed(6)} hint="started at 1.000000" />
          <Stat label="Vault fees earned" value={usd(vault.feesEarned)} hint={`losses ${usd(vault.losses)}`} />
          <Stat label="Cash at agents" value={`${Math.round(utilisation * 100)}%`} hint={`${usd(vault.floatOut, 0)} of ${usd(totalAssets, 0)}`} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Deposit">
            <p className="mb-3 text-sm text-stone-600">Wallet: {usd(investor.balance)} mock USDC</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                className="w-32 rounded-xl border border-stone-300 px-3 py-2"
                value={deposit}
                onChange={(e) => setDeposit(Number(e.target.value))}
              />
              <Button disabled={!!busy || deposit <= 0} onClick={() => act({ action: "deposit", amount: deposit }, "deposit")}>
                Deposit {usd(deposit, 0)}
              </Button>
            </div>
          </Card>

          <Card title="Withdraw (last in line)">
            <p className="mb-3 text-sm text-stone-600">
              Notice period {Math.round(state.config.noticePeriod / 60)} min on testnet (30 days in production). Paid only
              from idle funds: cash already with agents is never recalled.
            </p>
            {investor.pendingShares > 0 ? (
              <div className="space-y-2 text-sm">
                <p>
                  Pending: {investor.pendingShares.toLocaleString()} shares (≈ {usd(investor.pendingShares * vault.shareValue)})
                </p>
                <Button disabled={!!busy || unlockIn > 0} onClick={() => act({ action: "claim" }, "claim withdrawal")}>
                  {unlockIn > 0 ? `Unlocks in ${Math.ceil(unlockIn / 60)} min` : "Claim now"}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  className="w-32 rounded-xl border border-stone-300 px-3 py-2"
                  value={withdraw}
                  onChange={(e) => setWithdraw(Number(e.target.value))}
                />
                <Button
                  variant="secondary"
                  disabled={!!busy || withdraw <= 0 || withdraw > available}
                  onClick={() => act({ action: "requestWithdraw", shares: withdraw }, "request withdrawal")}
                >
                  Request {withdraw.toLocaleString()} shares
                </Button>
              </div>
            )}
          </Card>
        </div>

        <Card title="Why this is halal">
          <ul className="list-disc space-y-1 pl-5 text-sm text-stone-700">
            <li>Musharakah: investors share real profit and loss through the share value. No return is guaranteed.</li>
            <li>Income is only service fees for cash-out. Agents never pay for the amount or duration of float.</li>
            <li>Float is partnership capital, not a loan. Agents return it as they pay out cash.</li>
            <li>Losses fall on the agent&apos;s collateral first (negligence), then on the pool.</li>
            <li>Currency exchange happens spot, at the moment cash is handed over.</li>
          </ul>
        </Card>
      </main>
    </>
  );
}
