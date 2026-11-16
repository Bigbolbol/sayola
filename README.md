# Sayola · سيولة

**Aid and remittances reach Syria in seconds. Sayola makes sure the cash is there too, funded by halal income from families' savings.**

**The problem.** Since 2026, aid in Syria must be paid out in Syrian pounds, and the UN's 2026 response plan warns that cash-out liquidity needs close monitoring because supplies of the new banknotes are uncertain ([HNRP 2026](https://humanitarianaction.info/plan/1518/document/syria-humanitarian-needs-and-response-plan-2026/article/27-cash-voucher-assistance-overview-and-multipurpose-cash-section-5)). Families make wasted trips when agents run out of notes, can be paid less than promised, and nobody can prove what exchange rate they received. The official rate (122.5) and the street rate (149.5) differ by about 22% ([LiraScope](https://lirascope.syria-cloud.sy/en/gap)). Paying aid in pounds cut its value by up to 25% and delayed it by weeks in 2026 ([ACAPS, via ReliefWeb](https://reliefweb.int/attachments/70b14499-38bd-4e30-80a9-3437f01cfdc9/3.8%20Syria%202026%20SDR_KG-Final.pdf)).

**The insight.** Syria's two shortages cancel each other out. Families on aid hold digital dollars but need pounds. Their neighbours hold pounds but can't find dollars. Sayola is designed to run on licensed money transfer providers, such as Digibank's liquidity points, so their agents can match the two on the same street, with proof of every handover.

In practice: a mother in Idlib is owed $100 of aid, but her agent's drawer is empty; two streets away, a grocer has a drawer full of pounds he would rather not keep. Sayola puts his pounds in her hand and pays him a share of the fee. *(Neighbour-to-neighbour swaps are Phase 2; today the vault is funded with digital dollars.)*

What Sayola does today:

- **Booked cash-out with proof of delivery.** The family books a time, the agent sets the cash aside, and the money is released only when both of them confirm the exact pounds handed over.
- **A community liquidity vault.** Savers fund agents' cash as partners, not lenders, and share in the fees.
- **Payday planning that keeps shops safe.** Each agent has a daily cash ceiling, so paydays are spread across days and shops instead of filling one drawer.

## Quick start: who are you?

| You are | Start here |
|---|---|
| **An NGO or humanitarian partner** | [How a payment reaches a family](#how-a-payment-reaches-a-family), then [Fees and exchange rate](#fees-and-exchange-rate) and [Physical safety](#physical-safety) |
| **A saver or community investor** | [Community liquidity and halal partnership](#community-liquidity-and-halal-partnership) |
| **A developer** | [Run it locally](#run-it-locally), then [Contract](#contract) |
| **An auditor or judge** | [Verify it yourself](#verify-it-yourself-stellar-testnet), then [Threat model](#threat-model) |

---

# Part 1 · Why and what

*For NGOs, licensed partners, savers and anyone deciding whether Sayola should exist. No code in this part.*

## How a payment reaches a family

1. **The NGO funds a payment** for a registered family. The money is held in escrow on Stellar, not by Sayola.
2. **The family books a cash-out** with a nearby agent for a two-hour window. The agent's cash is reserved for them, so they don't make a wasted trip.
3. **The agent hands over pounds.** The family confirms with a code sent by SMS, or with a printed card and PIN if they have no phone. The agent confirms too. Both confirm the same amount of pounds and the same rate, and only then is the payment released.
4. **If cash was missing**, the family can report it privately within 24 hours. The agent never sees who reported. Upheld reports are paid back from the agent's deposit first, then from the vault.
5. **If nobody collects**, the payment returns to the NGO after it expires.

Families never pay fees, never need crypto, and never hold the network's token: an operator account pays every network fee.

## Fees and exchange rate

**Fees.** The NGO pays a 2% service fee per payment, on top of the grant. The fee is split three ways at the moment of cash-out:

| Share | Goes to | Why |
|---|---|---|
| 40% | The licensed agent network | The work and the agent's own capital |
| 50% | The community liquidity vault | The savers' capital that stocked the drawer |
| 10% | Sayola | Management fee |

**Exchange rate.** Payouts are in Syrian pounds at the licensed partner's published rate at the moment of handover: a spot exchange, completed hand to hand. Sayola never sets a rate. The demo uses an illustrative partner rate of 133 pounds per dollar, between the official 122.5 and the street 149.5 (14 Nov 2026). The agent and the family both confirm the pounds handed over and the rate, and the system checks they match the dollar amount before storing them with the payment. A $378 grant becomes 50,274 pounds at 133, and that is what is recorded.

Total cost to the NGO is the 2% fee plus the partner's published rate, both visible on every payment.

## The mobile app

A Next.js web app, built mobile-first, with four views. The agent and recipient views are in Arabic.

- **NGO** (`/ngo`): fund payments, see the payday forecast and how many days a payday will take at agents' daily ceilings, pre-position cash with one click, track payments, resolve disputes.
- **Agent** (`/agent`): cash on hand, how much more cash can be paid out and taken today, the booking queue, scan a QR code or type a payment number, confirm with SMS code or card and PIN.
- **Recipient** (`/recipient`): balance in new Syrian pounds, book a nearby agent (agents who are full that day are marked), QR code, a simulated phone inbox, private dispute.
- **Investor** (`/invest`): position, share value, deposit, withdrawal with notice.

## Community liquidity and halal partnership

**Syria's aid can be financed by Syria's own neighbourhoods.** Today, households with savings watch them lose value while the agent down the street runs out of cash for families on aid. Sayola's vault joins the two: savers supply the cash that agents hand out, and in return they share in the fee every time a family is paid. Their savings stay in the neighbourhood, working, instead of sitting idle.

- **Today:** savers deposit digital dollars (USDC) into the vault, and agents draw on it to stock their drawers.
- **Phase 2:** neighbours holding pounds swap them at the agent's counter at the same published rate, refilling the drawer locally, and can join the vault themselves. Idle pounds become the cash supply of their own community's aid.

**Why it is a partnership, not a loan.** The vault is a *musharakah* (partnership) in a cash-delivery business:

- Savers provide capital. The licensed agent network provides its own capital and the work. They share the fee 50 to 40, and Sayola's 10% is a management fee.
- Savers share real profit and real loss through the value of their shares. **No return is promised or guaranteed.** When agents are busy, shares rise; if the partnership suffers a loss, shares fall.
- Income comes only from cash-out service fees, never from a charge for the use of money. Agents never pay for how much cash they draw or for how long.
- Withdrawals need notice and are paid only from cash not currently with agents, so a family's cash is never recalled from a drawer.
- An agent's own deposit covers losses from negligence or misconduct, such as short-paying a family. Losses with no one at fault are shared by the partners in proportion to their capital.
- Currency exchange happens on the spot, hand to hand, at the moment of cash-out.

A Shariah adviser must review the terms before any real launch.

## Physical safety

The network is secure, but cash is physical. Stellar is public, so anyone can see when an agent takes cash from the vault, how much, and when a booking window ends. An agent's account isn't labelled with a name or address, but every family who collects there learns it. **Sayola assumes the neighbourhood can tell when a shop is stocked**, and designs for three people at risk:

| Who | Risk | What Sayola does |
|---|---|---|
| **The agent** | A drawer stocked for payday becomes a robbery target. | Each agent has a **daily ceiling on cash drawn from the vault** and a **daily ceiling on cash paid out**, both enforced by the contract and set by the licensed partner to match each shop's security (a safe and a guard earn a higher ceiling than a kiosk drawer). Returning cash and drawing it again does not reset the day. |
| **The family** | A crowd leaving one shop with cash on payday can be followed. | Bookings count against the agent's ceiling for that day, so a large payday is **spread over several days and several agents**. The NGO dashboard shows how many days a payday will take, so NGOs fund in groups. No names, phone numbers or locations go on-chain. |
| **Cash in transit** | Carrying large sums from the licensed partner to the shop. | Cash is drawn in daily slices sized to that day's bookings rather than in one payday lump. |

The ceilings shrink the prize, not the signal: someone watching the chain can still see that a shop holds cash today. Hiding that signal is a research item on the roadmap.

**Who pays if a shop is robbed?** Today a robbery with no one at fault is a partnership loss, shared by the agent network and the savers in the vault. That is fair under *musharakah*, but neighbours' savings shouldn't absorb street crime. Sayola proposes **takaful** (cooperative mutual protection) for Phase 2: agents and the vault each contribute a small slice of every fee as a donation into a shared fund, which compensates robbery and cash-in-transit losses. The fee split in this prototype is unchanged until that fund and its terms are reviewed.

## Regulatory resilience

Sayola depends on USDC and on licensed partners. If either changes, the system is designed to wind down safely or move rather than freeze:

| Trigger | What happens |
|---|---|
| **USDC's issuer freezes the Sayola contract or specific accounts** | Funds held by a frozen account cannot move; the contract can't override the issuer. Sayola pauses new payments, and remaining families are paid from other channels. The contract works with any Stellar asset, so a new deployment can use another one (such as EURC, or a token issued by the licensed partner's anchor). |
| **Syria's Central Bank restricts stablecoins** | Sayola pauses new payments and deposits. While paused, expired payments still refund to NGOs, savers can still withdraw idle funds after notice, agents can still return cash, and disputes can still be raised and resolved. The partner can then continue on a locally approved asset with a new deployment. |
| **The licensed partner loses its licence** | Its agents are switched off, so they can't take bookings or pay out. Open payments either expire back to the NGO or are paid by another licensed partner's agents. |

Sayola deliberately has no switch to change the asset under live payments: swapping the money mid-payment is riskier than a clean wind-down and a fresh start.

Open legal questions being verified: whether licensed exchange companies may sell dollars to individuals for savings, how Syria classifies USDC, and the Central Bank's exact trading band.

## Humanitarian impact

Sayola does not claim figures it hasn't measured. It targets problems already documented in 2026: aid losing up to 25% of its value and arriving weeks late when paid in pounds ([ACAPS](https://reliefweb.int/attachments/70b14499-38bd-4e30-80a9-3437f01cfdc9/3.8%20Syria%202026%20SDR_KG-Final.pdf)), a 22% gap between official and street rates ([LiraScope](https://lirascope.syria-cloud.sy/en/gap)), and uncertain banknote supply ([HNRP 2026](https://humanitarianaction.info/plan/1518/document/syria-humanitarian-needs-and-response-plan-2026/article/27-cash-voucher-assistance-overview-and-multipurpose-cash-section-5)).

For every payment, Sayola makes these verifiable by anyone:

- **That the family was paid**, confirmed by both the family and the agent.
- **How many pounds they received and at what rate**, signed by both.
- **What it cost the NGO**: the 2% fee and the rate, nothing hidden.
- **Whether cash was missing**, through a private report and a public outcome.
- **That cash was booked for them**, so a booked family is never turned away because the agent hit its daily ceiling.

A pilot with a licensed partner is how actual savings and trip counts will be measured.

## Roadmap

**Phase 1 (this prototype):** booked cash-out, two-party proof of delivery including the pounds paid and the exchange rate, payday forecast, community liquidity vault, per-agent daily cash ceilings.

**Phase 2: community liquidity.**
- Grants fixed in pounds, as the Cash Working Group sets them: the family gets a fixed amount in pounds and leftover USDC returns to the NGO.
- Freelancers and families receiving remittances save in USDC and join the vault; client payments carry an invoice reference as proof of income.
- Neighbours with pounds swap them for USDC at the agent at the same published rate, refilling the agent's drawer locally. Swapped USDC stays inside Sayola (vault, cash-out, supplier payments) to prevent arbitrage, with monthly limits per verified person.
- Takaful fund for robbery and cash in transit, with an on-chain write-off for stolen cash.

**Phase 3: fewer cash-outs.** Importers pay foreign suppliers in USDC directly, in line with Central Bank rules that keep domestic payments in pounds.

**Infrastructure:** licensed partner via SEP-10/SEP-24 anchor integration, Stellar Disbursement Platform integration, passkey wallets, real SMS and USSD for basic phones, reserve fund, research into hiding per-shop cash signals on-chain, OpenZeppelin SEP-56 vault migration, Shariah review and audit.

---

# Part 2 · How it works

*For developers, system auditors and judges.*

## Verify it yourself (Stellar testnet)

| | |
|---|---|
| Sayola contract | [`CCXMGYH3TPTRGKNZXMIVJMKQNGF2WUJ4MGQQOZUMMGZ7N7QMONJH45V5`](https://stellar.expert/explorer/testnet/contract/CCXMGYH3TPTRGKNZXMIVJMKQNGF2WUJ4MGQQOZUMMGZ7N7QMONJH45V5) |
| Mock USDC (Stellar Asset Contract) | [`CCZ43FOCOWOT3ATKR7JJPC7ZNLXDE4JCHPKPGJL5NGRMNXVOFZLOEB5B`](https://stellar.expert/explorer/testnet/contract/CCZ43FOCOWOT3ATKR7JJPC7ZNLXDE4JCHPKPGJL5NGRMNXVOFZLOEB5B) |
| Mock USDC classic asset | `USDC:GC7K3CLY6TBSFYWBQBKVGG73UMSDVMKZMNWSDL2J5TOKBAUZMZGJAGEA` |
| Sample booked, two-party cash-out | [`6a4eca31…0aba`](https://stellar.expert/explorer/testnet/tx/6a4eca3169d368d3f02c4ccaadd58173175a4fd4e338fa1fbf350cd2813ea0bd): $378 paid as 50,274 pounds at 133 per dollar; agent and recipient both authorized the amount and rate; fee split to agent, vault and platform. Booked in [`1ba21c0a…0aba`](https://stellar.expert/explorer/testnet/tx/1ba21c0acd7104fee306e951f41070e80bcc40dc674dcf2401c66263cf360aba), which reserved the amount against the agent's daily ceiling |
| Live app | [sayola-drab.vercel.app](https://sayola-drab.vercel.app) ([`stellar.toml`](https://sayola-drab.vercel.app/.well-known/stellar.toml)) |
| Demo video | _added after recording_ |

All demo account addresses are in [`deployments/testnet.json`](deployments/testnet.json). If testnet has been reset, run `./scripts/deploy.sh` to recreate everything.

## Architecture

```
NGO ── fund(amount + 2% fee) ──► Sayola contract (escrow)
                                      │
Recipient + Agent ── book() ──────────┤  agent commits cash; amount reserved
                                      │  against the agent's daily cash-out cap
Agent pays cash ─ SMS code / PIN ─► confirm()  needs BOTH signatures
                                      │
           ┌──────────────────────────┼─────────────────────────┐
           ▼                          ▼                         ▼
   agent's vault float          fee 40% agent network   fee 50% vault
   returned first               10% platform            (share value ↑)

Investors ── deposit() ──► vault ── take_float() ──► agents stock cash
                                    (total limit + daily float cap)
```

## Contract

`contracts/sayola`, Soroban (Rust).

| Function | Who signs | What it does |
|---|---|---|
| `fund` | NGO | Escrows amount + fee for a recipient |
| `book` | recipient + agent | Reserves a cash-out window with a specific agent and reserves the amount against the agent's daily cash-out cap for the day the window ends |
| `confirm` | **agent + recipient** | Releases funds for the exact amount; records the pounds paid and the exchange rate (both signed, checked against each other); returns the agent's float to the vault; splits the fee. Walk-ins, and bookings collected on a different day, count against today's cap |
| `dispute` / `resolve` | recipient / admin | Private claim of missing cash; upheld claims slash agent collateral, then the vault |
| `expire` | anyone | Refunds uncollected payments to the NGO and releases any booking reservation |
| `deposit` / `request_withdraw` / `claim` | investor | Vault shares, notice period, last-in-line withdrawals |
| `set_agent` | admin | Registers an agent with a total float `limit`, `daily_float_cap`, `daily_cashout_cap` and active flag |
| `post_collateral` / `take_float` / `return_float` | agent | Collateral and partnership float. `take_float` is bounded by the total limit and the daily float cap; returning float does not restore the day's allowance |
| `get_agent_day` / `today` | anyone | An agent's cap usage for a local day (UTC+3) and the current day index |
| `set_paused` | admin | Emergency stop: blocks `fund`, `confirm`, `deposit` and `take_float`. `expire`, `request_withdraw`/`claim`, `return_float` and `dispute`/`resolve` keep working, so funds can always be wound down |
| `upgrade` | admin | Replaces the contract code while keeping its ID and data |

The token is fixed at construction and can be any Stellar Asset Contract. There is deliberately no function to change it.

## On-chain vs off-chain

| On-chain | Off-chain (server only) |
|---|---|
| Amounts, statuses, timestamps, pseudonymous addresses | Names, phone numbers, PINs |
| Agent limits, daily caps and usage, float, collateral, dispute outcomes | Location of agents and recipients |
| Vault shares, share value, fees, losses | SMS codes (stateless HMAC, 5-minute windows) |

What the public events reveal matters for physical safety: `FloatTaken` publishes the agent address and amount, `Booked` publishes the agent and window end, and `CashedOut` publishes the agent and amounts. The [threat model](#threat-model) assumes these can be linked to a shop.

## Transaction flow

The server builds each transaction with the Stellar SDK, collects authorization signatures from every party the contract requires (agent and recipient for `book` and `confirm`, NGO for `fund`, investor for vault actions), and submits it from the operator account, which pays the fee. Agents and recipients never hold XLM.

## Threat model

| Threat | Who is hurt | Mitigation | Enforced by |
|---|---|---|---|
| Agent skims cash | Family | Two-party confirmation of pounds and rate, private dispute, collateral slashed first | Contract |
| Fake recipients | NGO | NGO registration and per-payment caps | NGO (off-chain) |
| Stolen card | Family | PIN required | Server |
| SIM swap | Family | PIN or physical presence | Server |
| Coerced confirmation | Family | Private dispute channel; agent never sees the reporter | Contract + server |
| Server key compromise | Everyone | Testnet only; per-agent float limits and daily caps bound the loss; pause | Contract |
| Robbery of a stocked drawer | Agent, savers | Daily float cap, daily cash-out cap, total float limit; residual loss shared under *musharakah*; takaful on roadmap | Contract (caps) |
| Family followed after payday | Family | Bookings reserve daily capacity, so payday spreads across days and agents; no names or locations on-chain | Contract + NGO dashboard |
| Cash in transit | Agent | Float drawn in daily slices; takaful on roadmap | Contract (caps) + operations |
| Chain watchers link an agent address to a shop | Agent | Assumed public; caps bound the prize; hiding the signal is a research item | Design assumption |
| Cap evasion by returning and redrawing float | Savers | Returned float does not restore the day's allowance | Contract |
| USDC issuer freeze or stablecoin ban | Everyone | Pause; refunds, withdrawals and float returns keep working while paused; redeploy on another asset | Contract + operations |

Every state change calls `require_auth`; cash-out requires both agent and recipient authorization in one transaction. The contract uses checked arithmetic, explicit contract errors, TTL extension on persistent storage, and events for every state change.

**Demo limitations:** agent and recipient keys are custodial on the server for this prototype, and the action API is open so judges can try it. Production path: passkey smart wallets for agents (Smart Account Kit), recipient keys held by the licensed partner, real SMS delivery, KYC by the NGO and the licensed partner. The prototype has no on-chain write-off for robbed float yet.

## Run it locally

Prerequisites: Rust with the `wasm32v1-none` target, [Stellar CLI](https://developers.stellar.org/docs/tools/cli), Node 20+.

```sh
./scripts/deploy.sh            # creates testnet accounts, mock USDC, deploys and seeds the contract, writes app/.env.local
cd app && npm install
npm run dev                    # http://localhost:3000
```

`deploy.sh` registers two agents with a $1,500 daily float cap and a $2,000 daily cash-out cap.

Contract tests:

```sh
cargo test                     # 19 tests: fee split, two-party auth, recorded rate, disputes, withdrawals, expiry, limits, daily caps, pause
```

To run the app against the already-deployed contract instead, copy `app/.env.example` to `app/.env.local` and fill in the secrets for the demo accounts.

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
