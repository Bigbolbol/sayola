import "server-only";
import { contract, Keypair } from "@stellar/stellar-sdk";
import { PEOPLE, type RoleKey } from "@/lib/people";

export const RPC_URL = process.env.SAYOLA_RPC_URL ?? "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
export const CONTRACT_ID = required("SAYOLA_CONTRACT_ID");
export const TOKEN_ID = required("SAYOLA_TOKEN_ID");

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

function envKey(role: RoleKey): string {
  return `SAYOLA_SECRET_${role.toUpperCase().replace(/-/g, "_")}`;
}

const keypairs = new Map<RoleKey, Keypair>();

export function keypair(role: RoleKey): Keypair {
  let kp = keypairs.get(role);
  if (!kp) {
    kp = Keypair.fromSecret(required(envKey(role)));
    keypairs.set(role, kp);
  }
  return kp;
}

export function address(role: RoleKey): string {
  return keypair(role).publicKey();
}

export function roleOf(addr: string): RoleKey | undefined {
  return PEOPLE.find((p) => address(p.key) === addr)?.key;
}

type AnyClient = contract.Client & Record<string, (...args: unknown[]) => Promise<contract.AssembledTransaction<unknown>>>;

const clients = new Map<string, Promise<AnyClient>>();

/** Every transaction is submitted and paid for by the operator account (fee sponsorship). */
function client(contractId: string): Promise<AnyClient> {
  let c = clients.get(contractId);
  if (!c) {
    const operator = keypair("admin");
    c = contract.Client.from({
      contractId,
      rpcUrl: RPC_URL,
      networkPassphrase: NETWORK_PASSPHRASE,
      publicKey: operator.publicKey(),
      ...contract.basicNodeSigner(operator, NETWORK_PASSPHRASE),
    }) as Promise<AnyClient>;
    clients.set(contractId, c);
  }
  return c;
}

export async function read<T>(method: string, args: Record<string, unknown> = {}, contractId = CONTRACT_ID): Promise<T> {
  const c = await client(contractId);
  const tx = await c[method](args);
  return tx.result as T;
}

/**
 * Simulates, collects authorization signatures from each party the contract
 * requires (agent, recipient, NGO, investor), then signs and submits as the operator.
 */
export async function invoke(method: string, args: Record<string, unknown>, signers: RoleKey[]): Promise<string> {
  const c = await client(CONTRACT_ID);
  const tx = await c[method](args);
  const needed = tx.needsNonInvokerSigningBy();
  for (const role of signers) {
    const kp = keypair(role);
    if (!needed.includes(kp.publicKey())) continue;
    await tx.signAuthEntries({
      address: kp.publicKey(),
      signAuthEntry: contract.basicNodeSigner(kp, NETWORK_PASSPHRASE).signAuthEntry,
    });
  }
  const sent = await tx.signAndSend();
  const hash = sent.sendTransactionResponse?.hash ?? sent.getTransactionResponse?.txHash;
  if (!hash) throw new Error("Transaction submitted without a hash");
  return hash;
}

export async function tokenBalance(role: RoleKey): Promise<bigint> {
  return read<bigint>("balance", { id: address(role) }, TOKEN_ID);
}
