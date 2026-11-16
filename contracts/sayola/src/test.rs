#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

const UNIT: i128 = 10_000_000;
const DISPUTE_WINDOW: u64 = 3_600;
const NOTICE: u64 = 600;
/// 133.00 pounds per USD.
const RATE: i128 = 13_300;

fn local(amount: i128) -> i128 {
    amount * RATE / (UNIT * 100)
}

fn err(e: Error) -> soroban_sdk::Error {
    soroban_sdk::Error::from_contract_error(e as u32)
}

struct Setup<'a> {
    env: Env,
    client: SayolaClient<'a>,
    token: TokenClient<'a>,
    admin: Address,
    platform: Address,
    ngo: Address,
    recipient: Address,
    agent: Address,
    investor: Address,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.timestamp = 1_000);

    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let token = TokenClient::new(&env, &sac.address());
    let minter = StellarAssetClient::new(&env, &sac.address());

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let ngo = Address::generate(&env);
    let recipient = Address::generate(&env);
    let agent = Address::generate(&env);
    let investor = Address::generate(&env);

    minter.mint(&ngo, &(10_000 * UNIT));
    minter.mint(&investor, &(10_000 * UNIT));
    minter.mint(&agent, &(1_000 * UNIT));

    let contract_id = env.register(
        Sayola,
        (
            admin.clone(),
            sac.address(),
            platform.clone(),
            DISPUTE_WINDOW,
            NOTICE,
        ),
    );
    let client = SayolaClient::new(&env, &contract_id);
    client.set_agent(&agent, &(500 * UNIT), &(1_000 * UNIT), &(1_000 * UNIT), &true);

    Setup {
        env,
        client,
        token,
        admin,
        platform,
        ngo,
        recipient,
        agent,
        investor,
    }
}

#[test]
fn full_cashout_with_float_and_fee_split() {
    let s = setup();
    s.client.deposit(&s.investor, &(1_000 * UNIT));
    assert_eq!(s.client.share_value(), UNIT);

    s.client.take_float(&s.agent, &(300 * UNIT));
    assert_eq!(s.client.vault().float_out, 300 * UNIT);

    let id = s
        .client
        .fund(&s.ngo, &s.recipient, &(100 * UNIT), &(2 * UNIT), &10_000);
    s.client.book(&id, &s.agent, &5_000);
    assert_eq!(s.client.get_payment(&id).status, PaymentStatus::Booked);

    let agent_before = s.token.balance(&s.agent);
    s.client.confirm(&id, &s.agent, &(100 * UNIT), &local(100 * UNIT), &RATE);

    let payment = s.client.get_payment(&id);
    assert_eq!(payment.status, PaymentStatus::CashedOut);

    // 100 USDC of the agent's float is returned to the vault; the agent keeps only its 40% fee.
    let agent_rec = s.client.get_agent(&s.agent);
    assert_eq!(agent_rec.float_out, 200 * UNIT);
    assert_eq!(agent_rec.cashouts, 1);
    assert_eq!(s.token.balance(&s.agent) - agent_before, 8_000_000);
    assert_eq!(s.token.balance(&s.platform), 2_000_000);

    // Vault keeps its 50% fee share, so share value rises by 1 USDC / 1,000 shares.
    let vault = s.client.vault();
    assert_eq!(vault.fees_earned, UNIT);
    assert_eq!(vault.idle + vault.float_out, 1_001 * UNIT);
    assert_eq!(s.client.share_value(), 10_010_000);
}

#[test]
fn cashout_without_float_pays_agent_principal() {
    let s = setup();
    let id = s
        .client
        .fund(&s.ngo, &s.recipient, &(50 * UNIT), &UNIT, &10_000);
    let before = s.token.balance(&s.agent);
    s.client.confirm(&id, &s.agent, &(50 * UNIT), &local(50 * UNIT), &RATE);
    assert_eq!(s.token.balance(&s.agent) - before, 50 * UNIT + 4_000_000);
    assert_eq!(s.client.get_payment(&id).status, PaymentStatus::CashedOut);
}

#[test]
fn confirm_requires_agent_and_recipient_auth() {
    let s = setup();
    let id = s
        .client
        .fund(&s.ngo, &s.recipient, &(10 * UNIT), &0, &10_000);
    s.client.confirm(&id, &s.agent, &(10 * UNIT), &local(10 * UNIT), &RATE);
    let auths = s.env.auths();
    let signers: soroban_sdk::Vec<Address> = {
        let mut v = soroban_sdk::Vec::new(&s.env);
        for (addr, _) in auths.iter() {
            v.push_back(addr.clone());
        }
        v
    };
    assert!(signers.contains(&s.agent));
    assert!(signers.contains(&s.recipient));
}

#[test]
fn wrong_amount_is_rejected() {
    let s = setup();
    let id = s
        .client
        .fund(&s.ngo, &s.recipient, &(10 * UNIT), &0, &10_000);
    let result = s.client.try_confirm(&id, &s.agent, &(9 * UNIT), &local(9 * UNIT), &RATE);
    assert_eq!(result, Err(Ok(err(Error::AmountMismatch))));
}

#[test]
fn cashout_records_local_amount_and_rate() {
    let s = setup();
    let id = s
        .client
        .fund(&s.ngo, &s.recipient, &(100 * UNIT), &0, &10_000);
    s.client.confirm(&id, &s.agent, &(100 * UNIT), &13_300, &RATE);
    let payment = s.client.get_payment(&id);
    assert_eq!(payment.local_amount, 13_300);
    assert_eq!(payment.local_rate, RATE);
}

#[test]
fn local_amount_must_match_rate() {
    let s = setup();
    let id = s
        .client
        .fund(&s.ngo, &s.recipient, &(100 * UNIT), &0, &10_000);
    let short = s.client.try_confirm(&id, &s.agent, &(100 * UNIT), &12_250, &RATE);
    assert_eq!(short, Err(Ok(err(Error::LocalAmountMismatch))));
    let no_rate = s.client.try_confirm(&id, &s.agent, &(100 * UNIT), &13_300, &0);
    assert_eq!(no_rate, Err(Ok(err(Error::InvalidAmount))));
    // Rounding by one pound is accepted.
    s.client.confirm(&id, &s.agent, &(100 * UNIT), &13_301, &RATE);
}

#[test]
fn booked_payment_cannot_be_taken_by_another_agent_during_window() {
    let s = setup();
    let other = Address::generate(&s.env);
    s.client.set_agent(&other, &(100 * UNIT), &(100 * UNIT), &(100 * UNIT), &true);
    let id = s
        .client
        .fund(&s.ngo, &s.recipient, &(10 * UNIT), &0, &10_000);
    s.client.book(&id, &s.agent, &5_000);
    let result = s.client.try_confirm(&id, &other, &(10 * UNIT), &local(10 * UNIT), &RATE);
    assert_eq!(result, Err(Ok(err(Error::WrongAgent))));
}

#[test]
fn upheld_dispute_slashes_collateral_then_vault() {
    let s = setup();
    s.client.deposit(&s.investor, &(1_000 * UNIT));
    s.client.post_collateral(&s.agent, &(20 * UNIT));

    let id = s
        .client
        .fund(&s.ngo, &s.recipient, &(100 * UNIT), &0, &10_000);
    s.client.confirm(&id, &s.agent, &(100 * UNIT), &local(100 * UNIT), &RATE);
    s.client.dispute(&id, &(30 * UNIT));
    assert_eq!(s.client.get_payment(&id).status, PaymentStatus::Disputed);

    let before = s.token.balance(&s.recipient);
    s.client.resolve(&id, &true);
    assert_eq!(s.token.balance(&s.recipient) - before, 30 * UNIT);

    let agent_rec = s.client.get_agent(&s.agent);
    assert_eq!(agent_rec.collateral, 0);
    assert_eq!(agent_rec.disputes_upheld, 1);
    let vault = s.client.vault();
    assert_eq!(vault.losses, 10 * UNIT);
    assert_eq!(vault.idle, 990 * UNIT);
    assert_eq!(s.client.get_payment(&id).status, PaymentStatus::Resolved);
}

#[test]
fn dispute_after_window_is_rejected() {
    let s = setup();
    let id = s
        .client
        .fund(&s.ngo, &s.recipient, &(10 * UNIT), &0, &100_000);
    s.client.confirm(&id, &s.agent, &(10 * UNIT), &local(10 * UNIT), &RATE);
    s.env
        .ledger()
        .with_mut(|l| l.timestamp += DISPUTE_WINDOW + 1);
    let result = s.client.try_dispute(&id, &UNIT);
    assert_eq!(result, Err(Ok(err(Error::DisputeWindowClosed))));
}

#[test]
fn expired_payment_refunds_ngo() {
    let s = setup();
    let before = s.token.balance(&s.ngo);
    let id = s
        .client
        .fund(&s.ngo, &s.recipient, &(10 * UNIT), &UNIT, &2_000);
    assert_eq!(s.client.try_expire(&id), Err(Ok(err(Error::NotExpired))));
    s.env.ledger().with_mut(|l| l.timestamp = 2_000);
    s.client.expire(&id);
    assert_eq!(s.token.balance(&s.ngo), before);
    assert_eq!(s.client.get_payment(&id).status, PaymentStatus::Expired);
}

#[test]
fn withdrawal_waits_for_notice_and_idle_funds() {
    let s = setup();
    s.client.deposit(&s.investor, &(500 * UNIT));
    s.client.take_float(&s.agent, &(400 * UNIT));

    s.client.request_withdraw(&s.investor, &(300 * UNIT));
    assert_eq!(
        s.client.try_claim(&s.investor),
        Err(Ok(err(Error::NoticePeriodActive)))
    );

    s.env.ledger().with_mut(|l| l.timestamp += NOTICE);
    // Only 100 USDC is idle: float with agents is never recalled, so the investor waits.
    assert_eq!(
        s.client.try_claim(&s.investor),
        Err(Ok(err(Error::InsufficientLiquidity)))
    );

    s.client.return_float(&s.agent, &(200 * UNIT));
    let before = s.token.balance(&s.investor);
    let paid = s.client.claim(&s.investor);
    assert_eq!(paid, 300 * UNIT);
    assert_eq!(s.token.balance(&s.investor) - before, 300 * UNIT);
    assert_eq!(s.client.get_position(&s.investor).shares, 200 * UNIT);
}

#[test]
fn later_depositor_gets_fewer_shares_after_profit() {
    let s = setup();
    s.client.deposit(&s.investor, &(1_000 * UNIT));
    let id = s
        .client
        .fund(&s.ngo, &s.recipient, &(100 * UNIT), &(20 * UNIT), &10_000);
    s.client.confirm(&id, &s.agent, &(100 * UNIT), &local(100 * UNIT), &RATE);
    // Vault earned 10 USDC, so 1,010 USDC backs 1,000 shares.
    let late = Address::generate(&s.env);
    StellarAssetClient::new(&s.env, &s.token.address).mint(&late, &(101 * UNIT));
    let shares = s.client.deposit(&late, &(101 * UNIT));
    assert_eq!(shares, 100 * UNIT);
}

#[test]
fn float_limit_is_enforced() {
    let s = setup();
    s.client.deposit(&s.investor, &(1_000 * UNIT));
    let result = s.client.try_take_float(&s.agent, &(501 * UNIT));
    assert_eq!(result, Err(Ok(err(Error::FloatLimitExceeded))));
}

const DAY: u64 = 86_400;

fn set_daily_caps(s: &Setup, float_cap: i128, cashout_cap: i128) {
    s.client
        .set_agent(&s.agent, &(500 * UNIT), &float_cap, &cashout_cap, &true);
}

#[test]
fn booking_reserves_daily_cashout_cap() {
    let s = setup();
    set_daily_caps(&s, 1_000 * UNIT, 100 * UNIT);
    let booked = s
        .client
        .fund(&s.ngo, &s.recipient, &(60 * UNIT), &0, &10_000);
    let second = s
        .client
        .fund(&s.ngo, &s.recipient, &(50 * UNIT), &0, &10_000);
    s.client.book(&booked, &s.agent, &5_000);

    assert_eq!(
        s.client.try_book(&second, &s.agent, &5_000),
        Err(Ok(err(Error::DailyCapExceeded)))
    );
    let walk_in = s.client.try_confirm(&second, &s.agent, &(50 * UNIT), &local(50 * UNIT), &RATE);
    assert_eq!(walk_in, Err(Ok(err(Error::DailyCapExceeded))));

    s.client
        .confirm(&booked, &s.agent, &(60 * UNIT), &local(60 * UNIT), &RATE);
    let day = s.client.today();
    assert_eq!(
        s.client.get_agent_day(&s.agent, &day).cashout_committed,
        60 * UNIT
    );
}

#[test]
fn booked_recipient_is_served_when_cap_is_full() {
    let s = setup();
    set_daily_caps(&s, 1_000 * UNIT, 100 * UNIT);
    let id = s
        .client
        .fund(&s.ngo, &s.recipient, &(100 * UNIT), &0, &10_000);
    s.client.book(&id, &s.agent, &5_000);
    s.client.confirm(&id, &s.agent, &(100 * UNIT), &local(100 * UNIT), &RATE);
    assert_eq!(s.client.get_payment(&id).status, PaymentStatus::CashedOut);
}

#[test]
fn booking_for_another_day_moves_to_that_days_cap() {
    let s = setup();
    set_daily_caps(&s, 1_000 * UNIT, 100 * UNIT);
    let id = s
        .client
        .fund(&s.ngo, &s.recipient, &(100 * UNIT), &0, &(10 * DAY));
    let tomorrow_window = 1_000 + DAY;
    s.client.book(&id, &s.agent, &tomorrow_window);
    let today = s.client.today();
    assert_eq!(s.client.get_agent_day(&s.agent, &today).cashout_committed, 0);
    assert_eq!(
        s.client.get_agent_day(&s.agent, &(today + 1)).cashout_committed,
        100 * UNIT
    );

    // Collecting a day early counts against today and frees tomorrow.
    s.client.confirm(&id, &s.agent, &(100 * UNIT), &local(100 * UNIT), &RATE);
    assert_eq!(
        s.client.get_agent_day(&s.agent, &today).cashout_committed,
        100 * UNIT
    );
    assert_eq!(s.client.get_agent_day(&s.agent, &(today + 1)).cashout_committed, 0);
}

#[test]
fn expiry_releases_booking_reservation() {
    let s = setup();
    set_daily_caps(&s, 1_000 * UNIT, 100 * UNIT);
    let id = s
        .client
        .fund(&s.ngo, &s.recipient, &(100 * UNIT), &0, &2_000);
    s.client.book(&id, &s.agent, &1_500);
    s.env.ledger().with_mut(|l| l.timestamp = 2_000);
    s.client.expire(&id);
    let today = s.client.today();
    assert_eq!(s.client.get_agent_day(&s.agent, &today).cashout_committed, 0);
}

#[test]
fn daily_float_cap_cannot_be_reset_by_returning_float() {
    let s = setup();
    set_daily_caps(&s, 300 * UNIT, 1_000 * UNIT);
    s.client.deposit(&s.investor, &(1_000 * UNIT));
    s.client.take_float(&s.agent, &(300 * UNIT));
    s.client.return_float(&s.agent, &(300 * UNIT));
    assert_eq!(
        s.client.try_take_float(&s.agent, &UNIT),
        Err(Ok(err(Error::DailyCapExceeded)))
    );

    s.env.ledger().with_mut(|l| l.timestamp += DAY);
    s.client.take_float(&s.agent, &(300 * UNIT));
    assert_eq!(s.client.get_agent(&s.agent).float_out, 300 * UNIT);
}

#[test]
fn paused_contract_blocks_new_activity() {
    let s = setup();
    s.client.set_paused(&true);
    let result = s.client.try_deposit(&s.investor, &UNIT);
    assert_eq!(result, Err(Ok(err(Error::Paused))));
    let _ = &s.admin;
}
