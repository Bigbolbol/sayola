# Sayola · سيولة

**Aid and remittances reach Syria in seconds. Sayola makes sure the cash is there too, funded by halal income from families' savings.**

Sayola extends Stellar for the last mile of cash assistance and remittances in Syria:

- **Booked cash-out with proof of delivery.** An NGO funds a payment for a recipient in a Soroban contract. The recipient can book a cash-out so an agent commits cash in advance. Funds are released only when **both the agent and the recipient authorize the exact amount** handed over, by SMS code or printed card + PIN. The recipient can dispute privately afterwards; upheld disputes are paid from the agent's collateral.
- **A halal liquidity vault.** Savers join a *musharakah* (partnership) pool that supplies agents' cash float as partnership capital, not loans. The vault earns 50% of each cash-out fee; share value rises with fees and falls with losses. Withdrawals need notice and are paid only from idle funds, so cash already with agents is never recalled.
- **Payday forecast.** Funded-but-uncollected payments show where cash demand will land; the NGO can pre-position vault float with the agents who would otherwise run dry.

No personal data goes on-chain. Agents and recipients never hold XLM: an operator account sponsors every transaction fee.

---

## Verify it yourself (Stellar testnet)

| | |
|---|---|
| Sayola contract | [`CAR2NSAMCORUJSYMZCRBLLTGCNURYJLFQHAQLXT7QAJYAJTJ4TKEJIIE`](https://stellar.expert/explorer/testnet/contract/CAR2NSAMCORUJSYMZCRBLLTGCNURYJLFQHAQLXT7QAJYAJTJ4TKEJIIE) |
| Mock USDC (Stellar Asset Contract) | [`CCKGWUX3FHO477VHFJ7TRZRCLAGNLMFZKHE33IY37HCFG3MZKRDFCQU2`](https://stellar.expert/explorer/testnet/contract/CCKGWUX3FHO477VHFJ7TRZRCLAGNLMFZKHE33IY37HCFG3MZKRDFCQU2) |
| Mock USDC classic asset | `USDC:GCG2N4RHA6OX62WYIUP4FMAVCCAEISJRRWNYT4OZKVNVJXIFLXN6NJY5` |
| Sample two-party cash-out | [`984fdfdc…2e6a`](https://stellar.expert/explorer/testnet/tx/984fdfdc46a770ea5ca66b9cc7d0ef973603ae93f3017ea0de82ac4b9ab72e6a) (agent and recipient both authorized; fee split to agent, vault and platform) |
| Live app | [sayola-drab.vercel.app](https://sayola-drab.vercel.app) ([`stellar.toml`](https://sayola-drab.vercel.app/.well-known/stellar.toml)) |
| Demo video | _added after recording_ |

All demo account addresses are in [`deployments/testnet.json`](deployments/testnet.json). If testnet has been reset, run `./scripts/deploy.sh` to recreate everything.

---

## How it works

```
NGO ── fund(amount + 2% fee) ──► Sayola contract (escrow)
                                      │
Recipient + Agent ── book() ──────────┤  agent commits cash
                                      │
Agent pays cash ─ SMS code / PIN ─► confirm()  needs BOTH signatures
                                      │
           ┌──────────────────────────┼─────────────────────────┐
           ▼                          ▼                         ▼
   agent's vault float          fee 40% agent           fee 50% vault
   returned first               10% platform            (share value ↑)

Investors ── deposit() ──► vault ── take_float() ──► agents stock cash
```

### Contract (`contracts/sayola`)

| Function | Who signs | What it does |
|---|---|---|
| `fund` | NGO | Escrows amount + fee for a recipient |
| `book` | recipient + agent | Reserves a cash-out window with a specific agent |
| `confirm` | **agent + recipient** | Releases funds for the exact amount; returns the agent's float to the vault; splits the fee |
| `dispute` / `resolve` | recipient / admin | Private claim of missing cash; upheld claims slash agent collateral, then the vault |
| `expire` | anyone | Refunds uncollected payments to the NGO |
| `deposit` / `request_withdraw` / `claim` | investor | Vault shares, notice period, last-in-line withdrawals |
| `set_agent` / `post_collateral` / `take_float` / `return_float` | admin / agent | Agent onboarding and partnership float |
| `set_paused` | admin | Emergency stop |

### On-chain vs off-chain

| On-chain | Off-chain (server only) |
|---|---|
| Amounts, statuses, timestamps, pseudonymous addresses | Names, phone numbers, PINs |
| Agent limits, float, collateral, dispute outcomes | Location of agents and recipients |
| Vault shares, share value, fees, losses | SMS codes (stateless HMAC, 5-minute windows) |

### App (`app/`)

Next.js + TypeScript + Tailwind, mobile-first. Four views:

- **NGO** (`/ngo`): fund payments, payday forecast with one-click pre-positioning, payment status, dispute resolution.
- **Agent** (`/agent`, Arabic): float and limit, booking queue, scan QR or enter payment number, confirm with SMS code or card + PIN, take or return float.
- **Recipient** (`/recipient`, Arabic): balance in new Syrian pounds at the official rate, book an agent, QR code, simulated phone inbox, private dispute.
- **Investor** (`/invest`): position, share value, deposit, notice-period withdrawal.

The server builds each transaction with the Stellar SDK, collects authorization signatures from every party the contract requires, and submits it from the operator account, which pays the fee.

---

## Run it locally

Prerequisites: Rust with the `wasm32v1-none` target, [Stellar CLI](https://developers.stellar.org/docs/tools/cli), Node 20+.

```sh
./scripts/deploy.sh            # creates testnet accounts, mock USDC, deploys and seeds the contract, writes app/.env.local
cd app && npm install
npm run dev                    # http://localhost:3000
```

Contract tests:

```sh
cargo test                     # 12 tests: fee split, two-party auth, disputes, withdrawals, expiry, limits, pause
```

To run the app against the already-deployed contract instead, copy `app/.env.example` to `app/.env.local` and fill in the secrets for the demo accounts.

---

## Security and trust

- Every state change calls `require_auth`; cash-out requires both agent and recipient authorization in one transaction.
- Checked arithmetic, explicit contract errors, TTL extension on persistent storage, events for every state change, pause switch.
- Per-agent float limits and collateral; upheld disputes slash collateral before the vault.
- Threats considered: agent skimming (two-party confirmation, dispute, slashing), fake recipients (NGO registration and per-payment caps), stolen card (PIN required), SIM swap (PIN or physical presence), coerced confirmation (private dispute channel), server key compromise (testnet only, per-agent limits, pause).
- **Demo limitations:** agent and recipient keys are custodial on the server for this prototype, and the action API is open so judges can try it. Production path: passkey smart wallets for agents (Smart Account Kit), recipient keys held by the licensed partner, real SMS delivery, KYC by the NGO and the licensed partner.

## Why this is halal

The vault is a partnership (*musharakah*): investors share real profit and loss through the share value, and no return is guaranteed. Income comes only from cash-out service fees. Float is partnership capital, never a loan, so agents never pay for the amount or duration of float. Losses fall on agent collateral first. Currency exchange happens spot, when cash is handed over. A Shariah adviser should review the terms before any real launch.

## Roadmap

Licensed Syrian cash-out partner via SEP-10/SEP-24 anchor integration, Stellar Disbursement Platform integration, passkey wallets, real SMS and USSD for basic phones, payout beneficiaries and allowances for vault positions, reserve fund, takaful for cash in transit, OpenZeppelin SEP-56 vault migration and audit.

## Repository layout

```
contracts/sayola/   Soroban contract and tests (Rust)
app/                Next.js web app
scripts/deploy.sh   Testnet deploy and seed
deployments/        Deployed contract and account addresses
docs/               Implementation plan
```

## License

[MIT](LICENSE)
