import { AGENTS, RATE_SCALE, RECIPIENTS, SYP_PER_USD, person, type RoleKey } from "@/lib/people";
import { verifyCode } from "@/lib/server/otp";
import { address, invoke, read, roleOf } from "@/lib/server/stellar";
import type { Action } from "@/lib/types";

const UNIT = 10_000_000;
const FEE_RATE = 0.02;

function units(usd: number): bigint {
  if (!Number.isFinite(usd) || usd <= 0) throw new Error("Amount must be positive");
  return BigInt(Math.round(usd * UNIT));
}

function agentRole(value: unknown): RoleKey {
  if (!AGENTS.includes(value as RoleKey)) throw new Error("Unknown agent");
  return value as RoleKey;
}

async function recipientOf(id: number): Promise<RoleKey> {
  const payment = await read<{ recipient: string }>("get_payment", { id: BigInt(id) });
  const role = roleOf(payment.recipient);
  if (!role) throw new Error("Unknown recipient");
  return role;
}

async function run(body: Action): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  switch (body.action) {
    case "fund": {
      if (!RECIPIENTS.includes(body.recipient)) throw new Error("Unknown recipient");
      const amount = units(body.amount);
      const fee = BigInt(Math.round(body.amount * FEE_RATE * UNIT));
      return invoke(
        "fund",
        {
          ngo: address("ngo"),
          recipient: address(body.recipient),
          amount,
          fee,
          expires_at: BigInt(now + 30 * 86_400),
        },
        ["ngo"],
      );
    }
    case "book": {
      const agent = agentRole(body.agent);
      const recipient = await recipientOf(body.id);
      return invoke(
        "book",
        { id: BigInt(body.id), agent: address(agent), window_end: BigInt(now + 2 * 3_600) },
        [recipient, agent],
      );
    }
    case "confirm": {
      const agent = agentRole(body.agent);
      const recipient = await recipientOf(body.id);
      const pinOk = body.pin !== undefined && body.pin === person(recipient)?.pin;
      const codeOk = body.code !== undefined && verifyCode(`pay:${body.id}`, body.code.trim());
      if (!pinOk && !codeOk) throw new Error("Wrong code or PIN");
      const payment = await read<{ amount: bigint }>("get_payment", { id: BigInt(body.id) });
      const localRate = BigInt(Math.round(SYP_PER_USD * RATE_SCALE));
      const localAmount = (payment.amount * localRate) / BigInt(UNIT * RATE_SCALE);
      return invoke(
        "confirm",
        {
          id: BigInt(body.id),
          agent: address(agent),
          amount: payment.amount,
          local_amount: localAmount,
          local_rate: localRate,
        },
        [agent, recipient],
      );
    }
    case "dispute": {
      const recipient = await recipientOf(body.id);
      return invoke("dispute", { id: BigInt(body.id), missing_amount: units(body.missing) }, [recipient]);
    }
    case "resolve":
      return invoke("resolve", { id: BigInt(body.id), upheld: Boolean(body.upheld) }, ["admin"]);
    case "expire":
      return invoke("expire", { id: BigInt(body.id) }, []);
    case "deposit":
      return invoke("deposit", { investor: address("investor"), assets: units(body.amount) }, ["investor"]);
    case "requestWithdraw":
      return invoke(
        "request_withdraw",
        { investor: address("investor"), shares: units(body.shares) },
        ["investor"],
      );
    case "claim":
      return invoke("claim", { investor: address("investor") }, ["investor"]);
    case "takeFloat": {
      const agent = agentRole(body.agent);
      return invoke("take_float", { agent: address(agent), amount: units(body.amount) }, [agent]);
    }
    case "returnFloat": {
      const agent = agentRole(body.agent);
      return invoke("return_float", { agent: address(agent), amount: units(body.amount) }, [agent]);
    }
    default:
      throw new Error("Unknown action");
  }
}

function friendly(message: string): string {
  const match = message.match(/Error\(Contract, #(\d+)\)/);
  if (!match) return message.split("\n")[0].slice(0, 200);
  const names: Record<string, string> = {
    "1": "Invalid amount",
    "3": "Payment is not in the right state for this",
    "5": "Agent is inactive",
    "6": "Agent float limit exceeded",
    "7": "Not enough idle funds in the vault yet",
    "8": "Payment has expired",
    "9": "Payment has not expired yet",
    "10": "Booked with a different agent",
    "11": "Amount does not match the payment",
    "12": "Dispute window has closed",
    "13": "Not enough shares",
    "14": "Notice period still running",
    "15": "No pending withdrawal",
    "16": "Contract is paused",
    "17": "Not enough agent collateral",
    "18": "Pounds paid do not match the amount at this rate",
    "19":
      "هذا الوكيل وصل إلى حدّه اليومي من النقد. جرّب وكيلاً آخر أو يوماً آخر. · This agent has reached its daily cash cap; try another agent or another day.",
  };
  return names[match[1]] ?? `Contract error #${match[1]}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Action;
    const hash = await run(body);
    return Response.json({ hash });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: friendly(message) }, { status: 400 });
  }
}
