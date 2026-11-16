import type { RoleKey } from "./people";

export type PaymentStatus = "Funded" | "Booked" | "CashedOut" | "Disputed" | "Resolved" | "Expired";

export interface PaymentView {
  id: number;
  recipientKey: string;
  amount: number;
  fee: number;
  expiresAt: number;
  status: PaymentStatus;
  agentKey: string | null;
  windowEnd: number;
  cashedOutAt: number;
  disputedAmount: number;
  /** Pounds handed over, recorded on-chain at cash-out (0 before). */
  localAmount: number;
  /** Pounds per USD applied at cash-out (0 before). */
  localRate: number;
}

export interface DayUsageView {
  /** Local day index (UTC+3), as returned by the contract's `today`. */
  day: number;
  floatTaken: number;
  cashoutCommitted: number;
}

export interface AgentView {
  key: RoleKey;
  address: string;
  limit: number;
  dailyFloatCap: number;
  dailyCashoutCap: number;
  /** Cap usage for today and the next two local days, today first. */
  days: DayUsageView[];
  floatOut: number;
  collateral: number;
  active: boolean;
  cashouts: number;
  disputesUpheld: number;
  balance: number;
}

export interface SayolaState {
  contractId: string;
  tokenId: string;
  addresses: Record<RoleKey, string>;
  vault: {
    idle: number;
    floatOut: number;
    totalShares: number;
    feesEarned: number;
    losses: number;
    shareValue: number;
  };
  config: { disputeWindow: number; noticePeriod: number };
  payments: PaymentView[];
  agents: AgentView[];
  investor: {
    shares: number;
    pendingShares: number;
    unlockAt: number;
    balance: number;
    value: number;
  };
  ngoBalance: number;
  recipientBalances: Record<string, number>;
  now: number;
}

export type Action =
  | { action: "fund"; recipient: RoleKey; amount: number }
  | { action: "book"; id: number; agent: RoleKey }
  | { action: "confirm"; id: number; agent: RoleKey; code?: string; pin?: string }
  | { action: "dispute"; id: number; missing: number }
  | { action: "resolve"; id: number; upheld: boolean }
  | { action: "expire"; id: number }
  | { action: "deposit"; amount: number }
  | { action: "requestWithdraw"; shares: number }
  | { action: "claim" }
  | { action: "takeFloat"; agent: RoleKey; amount: number }
  | { action: "returnFloat"; agent: RoleKey; amount: number };
