# Sayola · سيولة

**Aid and remittances reach Syria in seconds. Sayola makes sure the cash is there too, funded by halal income from families' savings.**

**The problem.** Since 2026, aid in Syria must be paid out in Syrian pounds, and the UN's 2026 response plan warns that cash-out liquidity needs close monitoring because supplies of the new banknotes are uncertain ([HNRP 2026](https://humanitarianaction.info/plan/1518/document/syria-humanitarian-needs-and-response-plan-2026/article/27-cash-voucher-assistance-overview-and-multipurpose-cash-section-5)). Families make wasted trips when agents run out of notes, can be paid less than promised, and nobody can prove what exchange rate they received. The official rate (122.5) and the street rate (149.5) differ by about 22% ([LiraScope](https://lirascope.syria-cloud.sy/en/gap)); in 2020 the official rate cost aid agencies about [51 cents of every aid dollar](https://www.csis.org/analysis/how-assad-regime-systematically-diverts-tens-millions-aid) spent in-country.

**The insight.** Syria's two shortages cancel each other out. Families on aid hold digital dollars but need pounds. Their neighbours hold pounds but can't find dollars. Sayola is designed to run on licensed money transfer providers, such as Digibank's liquidity points, so their agents can match the two on the same street, with proof of every handover.

Sayola extends Stellar for the last mile of cash assistance and remittances in Syria:

- **Booked cash-out with proof of delivery.** An NGO funds a payment for a recipient in a Soroban contract. The recipient can book a cash-out so an agent commits cash in advance. Funds are released only when **both the agent and the recipient authorize the exact amount** handed over, by SMS code or printed card + PIN. The recipient can dispute privately afterwards; upheld disputes are paid from the agent's collateral.
- **A halal liquidity vault.** Savers join a *musharakah* (partnership) pool that supplies agents' cash float as partnership capital, not loans. The vault earns 50% of each cash-out fee; share value rises with fees and falls with losses. Withdrawals need notice and are paid only from idle funds, so cash already with agents is never recalled.
- **Payday forecast.** Funded-but-uncollected payments show where cash demand will land; the NGO can pre-position vault float with the agents who would otherwise run dry.

No personal data goes on-chain. Agents and recipients never hold XLM: an operator account sponsors every transaction fee.

---

## Verify it yourself (Stellar testnet)

| | |
|---|---|
| Sayola contract | [`CCSEMW4VV2USRNDYLDUEJ6NFRZWMSCTJPC75TJUEAE6QXZAGHTYUQQYN`](https://stellar.expert/explorer/testnet/contract/CCSEMW4VV2USRNDYLDUEJ6NFRZWMSCTJPC75TJUEAE6QXZAGHTYUQQYN) |
| Mock USDC (Stellar Asset Contract) | [`CCULDR7RSHC5SHL6NU7K5KOKG2VW5CE5U7HFBYJO4OMSUIVNX5R4AYNE`](https://stellar.expert/explorer/testnet/contract/CCULDR7RSHC5SHL6NU7K5KOKG2VW5CE5U7HFBYJO4OMSUIVNX5R4AYNE) |
| Mock USDC classic asset | `USDC:GBT2MPOEZDUVSSXUCQEYCTSNFPYOGKO4YJLZCC7A6A6E4JSAQH2DUHTU` |
| Sample two-party cash-out | [`5a534081…7e0b`](https://stellar.expert/explorer/testnet/tx/5a534081c9a320bcf072d9fa35e840c34ce552f4deea7fd023a3ab22b7127e0b): $378 paid as 50,274 pounds at 133 per dollar; agent and recipient both authorized the amount and rate; fee split to agent, vault and platform |
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
   agent's vault float          fee 40% agent network   fee 50% vault
   returned first               10% platform            (share value ↑)

Investors ── deposit() ──► vault ── take_float() ──► agents stock cash
```

### Contract (`contracts/sayola`)

| Function | Who signs | What it does |
|---|---|---|
| `fund` | NGO | Escrows amount + fee for a recipient |
| `book` | recipient + agent | Reserves a cash-out window with a specific agent |
| `confirm` | **agent + recipient** | Releases funds for the exact amount; records the pounds paid and the exchange rate (both signed, checked against each other); returns the agent's float to the vault; splits the fee |
| `dispute` / `resolve` | recipient / admin | Private claim of missing cash; upheld claims slash agent collateral, then the vault |
| `expire` | anyone | Refunds uncollected payments to the NGO |
| `deposit` / `request_withdraw` / `claim` | investor | Vault shares, notice period, last-in-line withdrawals |
| `set_agent` / `post_collateral` / `take_float` / `return_float` | admin / agent | Agent onboarding and partnership float |
| `set_paused` | admin | Emergency stop |
| `upgrade` | admin | Replaces the contract code while keeping its ID and data |

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
- **Recipient** (`/recipient`, Arabic): balance in new Syrian pounds at the partner's rate, book an agent, QR code, simulated phone inbox, private dispute.
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
cargo test                     # 14 tests: fee split, two-party auth, recorded rate, disputes, withdrawals, expiry, limits, pause
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

## Exchange rate

Payouts are in Syrian pounds at the licensed partner's published rate at the moment of handover (a spot exchange). Sayola never sets a rate. The app shows an illustrative partner rate of 133 pounds per dollar, between the official 122.5 and the street 149.5 (14 Nov 2026). Both the agent and the recipient sign the pounds handed over and the rate; the contract checks they match the dollar amount and stores them with the payment and in the `CashedOut` event. Total cost to the NGO is the 2% service fee plus the partner's published rate, both visible per payment.

## Roadmap

**Phase 1 (this prototype):** booked cash-out, two-party proof of delivery including the pounds paid and the exchange rate, payday forecast, halal liquidity vault.

**Phase 2: community liquidity.**
- Grants fixed in pounds, as the Cash Working Group sets them: the recipient gets a fixed amount in pounds and leftover USDC returns to the NGO.
- Freelancers and families receiving remittances save in USDC and join the vault; client payments carry an invoice reference as proof of income.
- Neighbours with pounds swap them for USDC at the agent at the same published rate, refilling the agent's drawer locally. Swapped USDC stays inside Sayola (vault, cash-out, supplier payments) to prevent arbitrage, with monthly limits per verified person.

**Phase 3: fewer cash-outs.** Importers pay foreign suppliers in USDC directly, in line with Central Bank rules that keep domestic payments in pounds.

**Infrastructure:** licensed partner via SEP-10/SEP-24 anchor integration, Stellar Disbursement Platform integration, passkey wallets, real SMS and USSD for basic phones, reserve fund, takaful for cash in transit, OpenZeppelin SEP-56 vault migration, Shariah review and audit.

Open legal questions being verified: whether licensed exchange companies may sell dollars to individuals for savings, how Syria classifies USDC, and the Central Bank's exact trading band.

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
