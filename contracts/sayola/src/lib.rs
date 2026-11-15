#![no_std]

//! Sayola: booked cash-out with proof of delivery, funded by a halal liquidity vault.
//!
//! Escrow side: an NGO funds a payment for a recipient. Any registered agent can
//! complete the cash-out, which requires authorization from both the agent and
//! the recipient. The cash-out fee is split between the agent, the vault and the
//! platform.
//!
//! Vault side: investors hold shares in a partnership pool (musharakah). The pool
//! supplies agents' cash float as partnership capital, never as a loan: agents
//! return the capital and the fee is split by a fixed ratio. Share value rises with
//! fee income and falls with losses not covered by agent collateral.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error,
    token::TokenClient, Address, BytesN, ContractExecutable, Env,
};

const BPS: i128 = 10_000;
const AGENT_FEE_BPS: i128 = 4_000;
const VAULT_FEE_BPS: i128 = 5_000;
/// Share value is reported with 7 decimals, matching Stellar asset precision.
const SHARE_VALUE_SCALE: i128 = 10_000_000;
/// Token amounts use 7 decimals.
const TOKEN_UNIT: i128 = 10_000_000;
/// Exchange rates are local currency units per USD with 2 decimals (133.00 = 13_300).
const RATE_SCALE: i128 = 100;

const DAY_IN_LEDGERS: u32 = 17_280;
const TTL_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const TTL_EXTEND_TO: u32 = 60 * DAY_IN_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidAmount = 1,
    PaymentNotFound = 2,
    InvalidStatus = 3,
    AgentNotFound = 4,
    AgentInactive = 5,
    FloatLimitExceeded = 6,
    InsufficientLiquidity = 7,
    Expired = 8,
    NotExpired = 9,
    WrongAgent = 10,
    AmountMismatch = 11,
    DisputeWindowClosed = 12,
    InsufficientShares = 13,
    NoticePeriodActive = 14,
    NoPendingWithdrawal = 15,
    Paused = 16,
    InsufficientCollateral = 17,
    LocalAmountMismatch = 18,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PaymentStatus {
    Funded,
    Booked,
    CashedOut,
    Disputed,
    Resolved,
    Expired,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Payment {
    pub ngo: Address,
    pub recipient: Address,
    pub amount: i128,
    pub fee: i128,
    pub expires_at: u64,
    pub status: PaymentStatus,
    pub agent: Option<Address>,
    pub window_end: u64,
    pub cashed_out_at: u64,
    pub disputed_amount: i128,
    /// Whole units of local currency handed over at cash-out (0 until then).
    pub local_amount: i128,
    /// Licensed partner's published rate applied at cash-out, scaled by `RATE_SCALE`.
    pub local_rate: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Agent {
    pub limit: i128,
    pub float_out: i128,
    pub collateral: i128,
    pub active: bool,
    pub cashouts: u32,
    pub disputes_upheld: u32,
}

#[contracttype]
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct VaultState {
    pub total_shares: i128,
    pub idle: i128,
    pub float_out: i128,
    pub fees_earned: i128,
    pub losses: i128,
}

#[contracttype]
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct Position {
    pub shares: i128,
    pub pending_shares: i128,
    pub unlock_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub admin: Address,
    pub token: Address,
    pub platform: Address,
    pub dispute_window: u64,
    pub notice_period: u64,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Config,
    Paused,
    Vault,
    NextPaymentId,
    Payment(u64),
    Agent(Address),
    Position(Address),
}

#[contractevent]
pub struct Funded {
    #[topic]
    pub id: u64,
    pub ngo: Address,
    pub recipient: Address,
    pub amount: i128,
    pub fee: i128,
}

#[contractevent]
pub struct Booked {
    #[topic]
    pub id: u64,
    pub agent: Address,
    pub window_end: u64,
}

#[contractevent]
pub struct CashedOut {
    #[topic]
    pub id: u64,
    pub agent: Address,
    pub amount: i128,
    pub agent_fee: i128,
    pub vault_fee: i128,
    pub platform_fee: i128,
    pub float_returned: i128,
    pub local_amount: i128,
    pub local_rate: i128,
}

#[contractevent]
pub struct Disputed {
    #[topic]
    pub id: u64,
    pub amount: i128,
}

#[contractevent]
pub struct Resolved {
    #[topic]
    pub id: u64,
    pub upheld: bool,
    pub from_collateral: i128,
    pub from_vault: i128,
}

#[contractevent]
pub struct PaymentExpired {
    #[topic]
    pub id: u64,
    pub refunded: i128,
}

#[contractevent]
pub struct Deposited {
    #[topic]
    pub investor: Address,
    pub assets: i128,
    pub shares: i128,
}

#[contractevent]
pub struct WithdrawRequested {
    #[topic]
    pub investor: Address,
    pub shares: i128,
    pub unlock_at: u64,
}

#[contractevent]
pub struct Withdrawn {
    #[topic]
    pub investor: Address,
    pub shares: i128,
    pub assets: i128,
}

#[contractevent]
pub struct FloatTaken {
    #[topic]
    pub agent: Address,
    pub amount: i128,
}

#[contractevent]
pub struct FloatReturned {
    #[topic]
    pub agent: Address,
    pub amount: i128,
}

#[contractevent]
pub struct CollateralPosted {
    #[topic]
    pub agent: Address,
    pub amount: i128,
}

#[contract]
pub struct Sayola;

#[contractimpl]
impl Sayola {
    pub fn __constructor(
        env: Env,
        admin: Address,
        token: Address,
        platform: Address,
        dispute_window: u64,
        notice_period: u64,
    ) {
        let config = Config {
            admin,
            token,
            platform,
            dispute_window,
            notice_period,
        };
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().set(&DataKey::Vault, &VaultState::default());
        env.storage().instance().set(&DataKey::NextPaymentId, &0u64);
        env.storage().instance().set(&DataKey::Paused, &false);
    }

    // ---------------------------------------------------------------- admin

    pub fn set_paused(env: Env, paused: bool) {
        let config = read_config(&env);
        config.admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &paused);
        bump_instance(&env);
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let config = read_config(&env);
        config.admin.require_auth();
        env.deployer()
            .update_current_contract(ContractExecutable::Wasm(new_wasm_hash));
    }

    /// Registers an agent or updates the float limit and active flag of an existing one.
    pub fn set_agent(env: Env, agent: Address, limit: i128, active: bool) {
        let config = read_config(&env);
        config.admin.require_auth();
        require_non_negative(&env, limit);
        let record = read_agent_opt(&env, &agent).unwrap_or(Agent {
            limit: 0,
            float_out: 0,
            collateral: 0,
            active: true,
            cashouts: 0,
            disputes_upheld: 0,
        });
        write_agent(
            &env,
            &agent,
            &Agent {
                limit,
                active,
                ..record
            },
        );
    }

    // --------------------------------------------------------------- escrow

    pub fn fund(
        env: Env,
        ngo: Address,
        recipient: Address,
        amount: i128,
        fee: i128,
        expires_at: u64,
    ) -> u64 {
        ngo.require_auth();
        require_not_paused(&env);
        require_positive(&env, amount);
        require_non_negative(&env, fee);
        if expires_at <= env.ledger().timestamp() {
            panic_with_error!(&env, Error::Expired);
        }
        let config = read_config(&env);
        let total = checked_add(&env, amount, fee);
        token(&env, &config).transfer(&ngo, &env.current_contract_address(), &total);

        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextPaymentId)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::NextPaymentId, &(id + 1));
        write_payment(
            &env,
            id,
            &Payment {
                ngo: ngo.clone(),
                recipient: recipient.clone(),
                amount,
                fee,
                expires_at,
                status: PaymentStatus::Funded,
                agent: None,
                window_end: 0,
                cashed_out_at: 0,
                disputed_amount: 0,
                local_amount: 0,
                local_rate: 0,
            },
        );
        Funded {
            id,
            ngo,
            recipient,
            amount,
            fee,
        }
        .publish(&env);
        id
    }

    /// The recipient reserves a cash-out with an agent, who commits cash until `window_end`.
    pub fn book(env: Env, id: u64, agent: Address, window_end: u64) {
        let mut payment = read_payment(&env, id);
        payment.recipient.require_auth();
        agent.require_auth();
        require_active_agent(&env, &agent);
        let now = env.ledger().timestamp();
        if now >= payment.expires_at {
            panic_with_error!(&env, Error::Expired);
        }
        let rebooking = payment.status == PaymentStatus::Booked && now > payment.window_end;
        if payment.status != PaymentStatus::Funded && !rebooking {
            panic_with_error!(&env, Error::InvalidStatus);
        }
        if window_end <= now {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        payment.status = PaymentStatus::Booked;
        payment.agent = Some(agent.clone());
        payment.window_end = window_end;
        write_payment(&env, id, &payment);
        Booked {
            id,
            agent,
            window_end,
        }
        .publish(&env);
    }

    /// Completes a cash-out. Both the agent and the recipient must authorize the
    /// exact amount, the local cash handed over and the exchange rate applied.
    /// `local_amount` must equal `amount` at `local_rate`, within one unit for rounding.
    pub fn confirm(env: Env, id: u64, agent: Address, amount: i128, local_amount: i128, local_rate: i128) {
        require_not_paused(&env);
        let mut payment = read_payment(&env, id);
        agent.require_auth();
        payment.recipient.require_auth();
        let now = env.ledger().timestamp();
        if now >= payment.expires_at {
            panic_with_error!(&env, Error::Expired);
        }
        match payment.status {
            PaymentStatus::Funded => {}
            PaymentStatus::Booked => {
                let booked_agent = payment.agent.clone().unwrap();
                if booked_agent != agent && now <= payment.window_end {
                    panic_with_error!(&env, Error::WrongAgent);
                }
            }
            _ => panic_with_error!(&env, Error::InvalidStatus),
        }
        if amount != payment.amount {
            panic_with_error!(&env, Error::AmountMismatch);
        }
        if local_rate <= 0 || local_amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        let expected_local = mul_div(&env, amount, local_rate, TOKEN_UNIT * RATE_SCALE);
        if (local_amount - expected_local).abs() > 1 {
            panic_with_error!(&env, Error::LocalAmountMismatch);
        }

        let mut agent_rec = read_agent(&env, &agent);
        if !agent_rec.active {
            panic_with_error!(&env, Error::AgentInactive);
        }
        let mut vault = read_vault(&env);

        // Cash the agent paid out returns their partnership float to the vault first.
        let float_returned = if agent_rec.float_out < amount {
            agent_rec.float_out
        } else {
            amount
        };
        agent_rec.float_out -= float_returned;
        vault.float_out = checked_sub(&env, vault.float_out, float_returned);
        vault.idle = checked_add(&env, vault.idle, float_returned);

        let agent_fee = mul_bps(&env, payment.fee, AGENT_FEE_BPS);
        let vault_fee = mul_bps(&env, payment.fee, VAULT_FEE_BPS);
        let platform_fee = checked_sub(&env, checked_sub(&env, payment.fee, agent_fee), vault_fee);
        vault.idle = checked_add(&env, vault.idle, vault_fee);
        vault.fees_earned = checked_add(&env, vault.fees_earned, vault_fee);
        agent_rec.cashouts += 1;

        payment.status = PaymentStatus::CashedOut;
        payment.agent = Some(agent.clone());
        payment.cashed_out_at = now;
        payment.local_amount = local_amount;
        payment.local_rate = local_rate;

        write_payment(&env, id, &payment);
        write_agent(&env, &agent, &agent_rec);
        write_vault(&env, &vault);

        let config = read_config(&env);
        let token = token(&env, &config);
        let to_agent = checked_add(&env, amount - float_returned, agent_fee);
        if to_agent > 0 {
            token.transfer(&env.current_contract_address(), &agent, &to_agent);
        }
        if platform_fee > 0 {
            token.transfer(&env.current_contract_address(), &config.platform, &platform_fee);
        }

        CashedOut {
            id,
            agent,
            amount,
            agent_fee,
            vault_fee,
            platform_fee,
            float_returned,
            local_amount,
            local_rate,
        }
        .publish(&env);
    }

    /// The recipient reports receiving less cash than confirmed.
    pub fn dispute(env: Env, id: u64, missing_amount: i128) {
        let mut payment = read_payment(&env, id);
        payment.recipient.require_auth();
        if payment.status != PaymentStatus::CashedOut {
            panic_with_error!(&env, Error::InvalidStatus);
        }
        let config = read_config(&env);
        let deadline = payment.cashed_out_at.saturating_add(config.dispute_window);
        if env.ledger().timestamp() > deadline {
            panic_with_error!(&env, Error::DisputeWindowClosed);
        }
        if missing_amount <= 0 || missing_amount > payment.amount {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        payment.status = PaymentStatus::Disputed;
        payment.disputed_amount = missing_amount;
        write_payment(&env, id, &payment);
        Disputed {
            id,
            amount: missing_amount,
        }
        .publish(&env);
    }

    /// Admin decides a dispute. If upheld, the recipient is made whole from the
    /// agent's collateral first and the vault second.
    pub fn resolve(env: Env, id: u64, upheld: bool) {
        let config = read_config(&env);
        config.admin.require_auth();
        let mut payment = read_payment(&env, id);
        if payment.status != PaymentStatus::Disputed {
            panic_with_error!(&env, Error::InvalidStatus);
        }
        let mut from_collateral = 0;
        let mut from_vault = 0;
        if upheld {
            let agent = payment.agent.clone().unwrap();
            let mut agent_rec = read_agent(&env, &agent);
            let owed = payment.disputed_amount;
            from_collateral = if agent_rec.collateral < owed {
                agent_rec.collateral
            } else {
                owed
            };
            agent_rec.collateral -= from_collateral;
            agent_rec.disputes_upheld += 1;
            write_agent(&env, &agent, &agent_rec);

            let shortfall = owed - from_collateral;
            if shortfall > 0 {
                let mut vault = read_vault(&env);
                from_vault = if vault.idle < shortfall {
                    vault.idle
                } else {
                    shortfall
                };
                vault.idle -= from_vault;
                vault.losses = checked_add(&env, vault.losses, from_vault);
                write_vault(&env, &vault);
            }
            let total = from_collateral + from_vault;
            if total > 0 {
                token(&env, &config).transfer(
                    &env.current_contract_address(),
                    &payment.recipient,
                    &total,
                );
            }
        }
        payment.status = PaymentStatus::Resolved;
        write_payment(&env, id, &payment);
        Resolved {
            id,
            upheld,
            from_collateral,
            from_vault,
        }
        .publish(&env);
    }

    /// Returns an uncollected payment and its fee to the NGO after expiry. Callable by anyone.
    pub fn expire(env: Env, id: u64) {
        let mut payment = read_payment(&env, id);
        if payment.status != PaymentStatus::Funded && payment.status != PaymentStatus::Booked {
            panic_with_error!(&env, Error::InvalidStatus);
        }
        if env.ledger().timestamp() < payment.expires_at {
            panic_with_error!(&env, Error::NotExpired);
        }
        let refunded = checked_add(&env, payment.amount, payment.fee);
        payment.status = PaymentStatus::Expired;
        write_payment(&env, id, &payment);
        let config = read_config(&env);
        token(&env, &config).transfer(&env.current_contract_address(), &payment.ngo, &refunded);
        PaymentExpired { id, refunded }.publish(&env);
    }

    // ---------------------------------------------------------------- vault

    pub fn deposit(env: Env, investor: Address, assets: i128) -> i128 {
        investor.require_auth();
        require_not_paused(&env);
        require_positive(&env, assets);
        let mut vault = read_vault(&env);
        let total_assets = checked_add(&env, vault.idle, vault.float_out);
        let shares = if vault.total_shares == 0 || total_assets == 0 {
            assets
        } else {
            mul_div(&env, assets, vault.total_shares, total_assets)
        };
        if shares <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        let config = read_config(&env);
        token(&env, &config).transfer(&investor, &env.current_contract_address(), &assets);

        vault.idle = checked_add(&env, vault.idle, assets);
        vault.total_shares = checked_add(&env, vault.total_shares, shares);
        write_vault(&env, &vault);
        let mut position = read_position(&env, &investor);
        position.shares = checked_add(&env, position.shares, shares);
        write_position(&env, &investor, &position);
        Deposited {
            investor,
            assets,
            shares,
        }
        .publish(&env);
        shares
    }

    /// Starts the notice period for withdrawing `shares`. Pending shares keep sharing profit and loss.
    pub fn request_withdraw(env: Env, investor: Address, shares: i128) {
        investor.require_auth();
        require_positive(&env, shares);
        let mut position = read_position(&env, &investor);
        let available = position.shares - position.pending_shares;
        if shares > available {
            panic_with_error!(&env, Error::InsufficientShares);
        }
        let config = read_config(&env);
        position.pending_shares = checked_add(&env, position.pending_shares, shares);
        position.unlock_at = env.ledger().timestamp().saturating_add(config.notice_period);
        write_position(&env, &investor, &position);
        WithdrawRequested {
            investor,
            shares: position.pending_shares,
            unlock_at: position.unlock_at,
        }
        .publish(&env);
    }

    /// Pays out pending shares after the notice period, only from idle funds.
    /// Float already with agents is never recalled, so withdrawals are last in line.
    pub fn claim(env: Env, investor: Address) -> i128 {
        investor.require_auth();
        let mut position = read_position(&env, &investor);
        if position.pending_shares == 0 {
            panic_with_error!(&env, Error::NoPendingWithdrawal);
        }
        if env.ledger().timestamp() < position.unlock_at {
            panic_with_error!(&env, Error::NoticePeriodActive);
        }
        let mut vault = read_vault(&env);
        let shares = position.pending_shares;
        let total_assets = checked_add(&env, vault.idle, vault.float_out);
        let assets = mul_div(&env, shares, total_assets, vault.total_shares);
        if assets > vault.idle {
            panic_with_error!(&env, Error::InsufficientLiquidity);
        }
        vault.idle -= assets;
        vault.total_shares -= shares;
        position.shares -= shares;
        position.pending_shares = 0;
        position.unlock_at = 0;
        write_vault(&env, &vault);
        write_position(&env, &investor, &position);
        let config = read_config(&env);
        if assets > 0 {
            token(&env, &config).transfer(&env.current_contract_address(), &investor, &assets);
        }
        Withdrawn {
            investor,
            shares,
            assets,
        }
        .publish(&env);
        assets
    }

    pub fn post_collateral(env: Env, agent: Address, amount: i128) {
        agent.require_auth();
        require_positive(&env, amount);
        let mut agent_rec = read_agent(&env, &agent);
        let config = read_config(&env);
        token(&env, &config).transfer(&agent, &env.current_contract_address(), &amount);
        agent_rec.collateral = checked_add(&env, agent_rec.collateral, amount);
        write_agent(&env, &agent, &agent_rec);
        CollateralPosted { agent, amount }.publish(&env);
    }

    /// Agent takes partnership capital from the vault to stock cash, up to their limit.
    pub fn take_float(env: Env, agent: Address, amount: i128) {
        agent.require_auth();
        require_not_paused(&env);
        require_positive(&env, amount);
        let mut agent_rec = require_active_agent(&env, &agent);
        let new_float = checked_add(&env, agent_rec.float_out, amount);
        if new_float > agent_rec.limit {
            panic_with_error!(&env, Error::FloatLimitExceeded);
        }
        let mut vault = read_vault(&env);
        if amount > vault.idle {
            panic_with_error!(&env, Error::InsufficientLiquidity);
        }
        vault.idle -= amount;
        vault.float_out = checked_add(&env, vault.float_out, amount);
        agent_rec.float_out = new_float;
        write_vault(&env, &vault);
        write_agent(&env, &agent, &agent_rec);
        let config = read_config(&env);
        token(&env, &config).transfer(&env.current_contract_address(), &agent, &amount);
        FloatTaken { agent, amount }.publish(&env);
    }

    /// Agent returns unused partnership capital to the vault.
    pub fn return_float(env: Env, agent: Address, amount: i128) {
        agent.require_auth();
        require_positive(&env, amount);
        let mut agent_rec = read_agent(&env, &agent);
        if amount > agent_rec.float_out {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        let config = read_config(&env);
        token(&env, &config).transfer(&agent, &env.current_contract_address(), &amount);
        let mut vault = read_vault(&env);
        vault.float_out -= amount;
        vault.idle = checked_add(&env, vault.idle, amount);
        agent_rec.float_out -= amount;
        write_vault(&env, &vault);
        write_agent(&env, &agent, &agent_rec);
        FloatReturned { agent, amount }.publish(&env);
    }

    // ---------------------------------------------------------------- views

    pub fn config(env: Env) -> Config {
        read_config(&env)
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    pub fn payment_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::NextPaymentId)
            .unwrap_or(0)
    }

    pub fn get_payment(env: Env, id: u64) -> Payment {
        read_payment(&env, id)
    }

    pub fn get_agent(env: Env, agent: Address) -> Agent {
        read_agent(&env, &agent)
    }

    pub fn get_position(env: Env, investor: Address) -> Position {
        read_position(&env, &investor)
    }

    pub fn vault(env: Env) -> VaultState {
        read_vault(&env)
    }

    /// Value of one share in token units, scaled by 10^7.
    pub fn share_value(env: Env) -> i128 {
        let vault = read_vault(&env);
        if vault.total_shares == 0 {
            return SHARE_VALUE_SCALE;
        }
        let total_assets = checked_add(&env, vault.idle, vault.float_out);
        mul_div(&env, total_assets, SHARE_VALUE_SCALE, vault.total_shares)
    }
}

// ------------------------------------------------------------------ helpers

fn token(env: &Env, config: &Config) -> TokenClient<'static> {
    TokenClient::new(env, &config.token)
}

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn read_config(env: &Env) -> Config {
    env.storage().instance().get(&DataKey::Config).unwrap()
}

fn require_not_paused(env: &Env) {
    let paused: bool = env
        .storage()
        .instance()
        .get(&DataKey::Paused)
        .unwrap_or(false);
    if paused {
        panic_with_error!(env, Error::Paused);
    }
}

fn read_vault(env: &Env) -> VaultState {
    env.storage()
        .instance()
        .get(&DataKey::Vault)
        .unwrap_or_default()
}

fn write_vault(env: &Env, vault: &VaultState) {
    env.storage().instance().set(&DataKey::Vault, vault);
    bump_instance(env);
}

fn read_payment(env: &Env, id: u64) -> Payment {
    env.storage()
        .persistent()
        .get(&DataKey::Payment(id))
        .unwrap_or_else(|| panic_with_error!(env, Error::PaymentNotFound))
}

fn write_payment(env: &Env, id: u64, payment: &Payment) {
    let key = DataKey::Payment(id);
    env.storage().persistent().set(&key, payment);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    bump_instance(env);
}

fn read_agent_opt(env: &Env, agent: &Address) -> Option<Agent> {
    env.storage()
        .persistent()
        .get(&DataKey::Agent(agent.clone()))
}

fn read_agent(env: &Env, agent: &Address) -> Agent {
    read_agent_opt(env, agent).unwrap_or_else(|| panic_with_error!(env, Error::AgentNotFound))
}

fn require_active_agent(env: &Env, agent: &Address) -> Agent {
    let record = read_agent(env, agent);
    if !record.active {
        panic_with_error!(env, Error::AgentInactive);
    }
    record
}

fn write_agent(env: &Env, agent: &Address, record: &Agent) {
    let key = DataKey::Agent(agent.clone());
    env.storage().persistent().set(&key, record);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    bump_instance(env);
}

fn read_position(env: &Env, investor: &Address) -> Position {
    env.storage()
        .persistent()
        .get(&DataKey::Position(investor.clone()))
        .unwrap_or_default()
}

fn write_position(env: &Env, investor: &Address, position: &Position) {
    let key = DataKey::Position(investor.clone());
    env.storage().persistent().set(&key, position);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    bump_instance(env);
}

fn require_positive(env: &Env, amount: i128) {
    if amount <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
}

fn require_non_negative(env: &Env, amount: i128) {
    if amount < 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
}

fn checked_add(env: &Env, a: i128, b: i128) -> i128 {
    a.checked_add(b)
        .unwrap_or_else(|| panic_with_error!(env, Error::InvalidAmount))
}

fn checked_sub(env: &Env, a: i128, b: i128) -> i128 {
    a.checked_sub(b)
        .unwrap_or_else(|| panic_with_error!(env, Error::InvalidAmount))
}

fn mul_div(env: &Env, a: i128, b: i128, denominator: i128) -> i128 {
    a.checked_mul(b)
        .and_then(|product| product.checked_div(denominator))
        .unwrap_or_else(|| panic_with_error!(env, Error::InvalidAmount))
}

fn mul_bps(env: &Env, amount: i128, bps: i128) -> i128 {
    mul_div(env, amount, bps, BPS)
}

mod test;
