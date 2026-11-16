import "server-only";
import { AGENTS, RATE_SCALE, RECIPIENTS, type RoleKey } from "@/lib/people";
import type { AgentView, PaymentView, SayolaState } from "@/lib/types";
import { CONTRACT_ID, TOKEN_ID, address, read, roleOf, tokenBalance } from "./stellar";

const UNIT = 10_000_000;

function usd(v: unknown): number {
  return Number(v ?? 0) / UNIT;
}

function tag(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "tag" in v) return String((v as { tag: unknown }).tag);
  return String(v);
}

interface RawPayment {
  ngo: string;
  recipient: string;
  amount: bigint;
  fee: bigint;
  expires_at: bigint;
  status: unknown;
  agent?: string;
  window_end: bigint;
  cashed_out_at: bigint;
  disputed_amount: bigint;
  local_amount: bigint;
  local_rate: bigint;
}

interface RawAgent {
  limit: bigint;
  daily_float_cap: bigint;
  daily_cashout_cap: bigint;
  float_out: bigint;
  collateral: bigint;
  active: boolean;
  cashouts: number;
  disputes_upheld: number;
}

interface RawDayUsage {
  float_taken: bigint;
  cashout_committed: bigint;
}

const FORECAST_DAYS = 3;

export async function loadState(): Promise<SayolaState> {
  const [count, vault, shareValue, config, position, investorBalance, ngoBalance, today] = await Promise.all([
    read<bigint>("payment_count"),
    read<Record<string, bigint>>("vault"),
    read<bigint>("share_value"),
    read<Record<string, unknown>>("config"),
    read<Record<string, bigint>>("get_position", { investor: address("investor") }),
    tokenBalance("investor"),
    tokenBalance("ngo"),
    read<bigint>("today"),
  ]);
  const days = Array.from({ length: FORECAST_DAYS }, (_, i) => BigInt(today) + BigInt(i));

  const ids = Array.from({ length: Number(count) }, (_, i) => i);
  const [rawPayments, agents, recipientBalances] = await Promise.all([
    Promise.all(ids.map((id) => read<RawPayment>("get_payment", { id: BigInt(id) }))),
    Promise.all(
      AGENTS.map(async (key): Promise<AgentView> => {
        const [a, balance, usage] = await Promise.all([
          read<RawAgent>("get_agent", { agent: address(key) }),
          tokenBalance(key),
          Promise.all(days.map((day) => read<RawDayUsage>("get_agent_day", { agent: address(key), day }))),
        ]);
        return {
          key,
          address: address(key),
          limit: usd(a.limit),
          dailyFloatCap: usd(a.daily_float_cap),
          dailyCashoutCap: usd(a.daily_cashout_cap),
          days: usage.map((u, i) => ({
            day: Number(days[i]),
            floatTaken: usd(u.float_taken),
            cashoutCommitted: usd(u.cashout_committed),
          })),
          floatOut: usd(a.float_out),
          collateral: usd(a.collateral),
          active: a.active,
          cashouts: Number(a.cashouts),
          disputesUpheld: Number(a.disputes_upheld),
          balance: usd(balance),
        };
      }),
    ),
    Promise.all(RECIPIENTS.map(async (key) => [key, usd(await tokenBalance(key))] as const)),
  ]);

  const payments: PaymentView[] = rawPayments.map((p, id) => ({
    id,
    recipientKey: roleOf(p.recipient) ?? p.recipient,
    amount: usd(p.amount),
    fee: usd(p.fee),
    expiresAt: Number(p.expires_at),
    status: tag(p.status) as PaymentView["status"],
    agentKey: p.agent ? (roleOf(p.agent) ?? p.agent) : null,
    windowEnd: Number(p.window_end),
    cashedOutAt: Number(p.cashed_out_at),
    disputedAmount: usd(p.disputed_amount),
    localAmount: Number(p.local_amount ?? 0),
    localRate: Number(p.local_rate ?? 0) / RATE_SCALE,
  }));

  const totalShares = usd(vault.total_shares);
  const value = usd(shareValue);
  return {
    contractId: CONTRACT_ID,
    tokenId: TOKEN_ID,
    addresses: Object.fromEntries(
      (["admin", "platform", "ngo", "investor", ...AGENTS, ...RECIPIENTS] as RoleKey[]).map((k) => [k, address(k)]),
    ) as Record<RoleKey, string>,
    vault: {
      idle: usd(vault.idle),
      floatOut: usd(vault.float_out),
      totalShares,
      feesEarned: usd(vault.fees_earned),
      losses: usd(vault.losses),
      shareValue: value,
    },
    config: {
      disputeWindow: Number(config.dispute_window),
      noticePeriod: Number(config.notice_period),
    },
    payments,
    agents,
    investor: {
      shares: usd(position.shares),
      pendingShares: usd(position.pending_shares),
      unlockAt: Number(position.unlock_at),
      balance: usd(investorBalance),
      value: usd(position.shares) * value,
    },
    ngoBalance: usd(ngoBalance),
    recipientBalances: Object.fromEntries(recipientBalances),
    now: Math.floor(Date.now() / 1000),
  };
}
