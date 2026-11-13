import "server-only";
import { AGENTS, RECIPIENTS, type RoleKey } from "@/lib/people";
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
}

interface RawAgent {
  limit: bigint;
  float_out: bigint;
  collateral: bigint;
  active: boolean;
  cashouts: number;
  disputes_upheld: number;
}

export async function loadState(): Promise<SayolaState> {
  const [count, vault, shareValue, config, position, investorBalance, ngoBalance] = await Promise.all([
    read<bigint>("payment_count"),
    read<Record<string, bigint>>("vault"),
    read<bigint>("share_value"),
    read<Record<string, unknown>>("config"),
    read<Record<string, bigint>>("get_position", { investor: address("investor") }),
    tokenBalance("investor"),
    tokenBalance("ngo"),
  ]);

  const ids = Array.from({ length: Number(count) }, (_, i) => i);
  const [rawPayments, agents, recipientBalances] = await Promise.all([
    Promise.all(ids.map((id) => read<RawPayment>("get_payment", { id: BigInt(id) }))),
    Promise.all(
      AGENTS.map(async (key): Promise<AgentView> => {
        const [a, balance] = await Promise.all([
          read<RawAgent>("get_agent", { agent: address(key) }),
          tokenBalance(key),
        ]);
        return {
          key,
          address: address(key),
          limit: usd(a.limit),
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
