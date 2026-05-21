#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::Address as _,
    vec, String, Env,
};

fn setup() -> (Env, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let worker = Address::generate(&env);
    let client = Address::generate(&env);
    (env, worker, client)
}

#[test]
fn test_create_and_get_invoice() {
    let (env, worker, client) = setup();
    let contract_id = env.register(Kwagee, ());
    let contract = KwageeClient::new(&env, &contract_id);

    let id = contract.create_invoice(
        &worker,
        &client,
        &70_000_000i128,
        &String::from_str(&env, "Logo design - May 2026"),
    );

    assert_eq!(id, 1);
    let invoice = contract.get_invoice(&id);
    assert_eq!(invoice.amount_usdc, 70_000_000);
    assert_eq!(invoice.status, InvoiceStatus::Pending);
}

#[test]
fn test_set_allocations_and_pay_invoice() {
    let (env, worker, client) = setup();
    let contract_id = env.register(Kwagee, ());
    let contract = KwageeClient::new(&env, &contract_id);

    // Set fixed budget to 10 USDC
    contract.set_fixed_budget(&worker, &100_000_000i128);

    let allocations = vec![
        &env,
        Allocation { label: String::from_str(&env, "SSS"), percent: 10 },
        Allocation { label: String::from_str(&env, "PhilHealth"), percent: 5 },
        Allocation { label: String::from_str(&env, "PagIBIG"), percent: 5 },
        Allocation { label: String::from_str(&env, "Bills"), percent: 20 },
        Allocation { label: String::from_str(&env, "Budget"), percent: 60 },
    ];
    contract.set_allocations(&worker, &allocations);

    let id = contract.create_invoice(
        &worker,
        &client,
        &100_000_000i128,
        &String::from_str(&env, "Web dev project"),
    );

    contract.pay_invoice(&client, &id);

    let buckets = contract.get_buckets(&worker);
    assert_eq!(buckets.get(String::from_str(&env, "SSS")).unwrap(), 10_000_000);
    assert_eq!(buckets.get(String::from_str(&env, "PhilHealth")).unwrap(), 5_000_000);
}

#[test]
#[should_panic(expected = "Allocations must sum to 100%")]
fn test_allocations_must_sum_to_100() {
    let (env, worker, _) = setup();
    let contract_id = env.register(Kwagee, ());
    let contract = KwageeClient::new(&env, &contract_id);

    let bad_allocations = vec![
        &env,
        Allocation { label: String::from_str(&env, "SSS"), percent: 10 },
        Allocation { label: String::from_str(&env, "Savings"), percent: 50 },
    ];

    contract.set_allocations(&worker, &bad_allocations);
}

#[test]
fn test_fixed_budget_split() {
    let (env, worker, client) = setup();
    let contract_id = env.register(Kwagee, ());
    let contract = KwageeClient::new(&env, &contract_id);

    // Worker sets fixed budget of 20 USDC
    contract.set_fixed_budget(&worker, &200_000_000i128);

    let allocations = vec![
        &env,
        Allocation { label: String::from_str(&env, "SSS"), percent: 10 },
        Allocation { label: String::from_str(&env, "PhilHealth"), percent: 5 },
        Allocation { label: String::from_str(&env, "PagIBIG"), percent: 5 },
        Allocation { label: String::from_str(&env, "Bills"), percent: 20 },
        Allocation { label: String::from_str(&env, "Budget"), percent: 60 },
    ];
    contract.set_allocations(&worker, &allocations);

    // Client pays 100 USDC
    contract.create_invoice(
        &worker, &client, &1_000_000_000i128,
        &String::from_str(&env, "100 USDC project"),
    );
    contract.pay_invoice(&client, &1u64);

    let buckets = contract.get_buckets(&worker);

    // Savings should get 80 USDC (remainder)
    assert_eq!(buckets.get(String::from_str(&env, "Savings")).unwrap(), 800_000_000);
    // SSS should get 10% of 20 USDC = 2 USDC
    assert_eq!(buckets.get(String::from_str(&env, "SSS")).unwrap(), 20_000_000);
    // PhilHealth = 5% of 20 USDC = 1 USDC
    assert_eq!(buckets.get(String::from_str(&env, "PhilHealth")).unwrap(), 10_000_000);
}

#[test]
fn test_withdraw_from_bucket() {
    let (env, worker, client) = setup();
    let contract_id = env.register(Kwagee, ());
    let contract = KwageeClient::new(&env, &contract_id);

    contract.set_fixed_budget(&worker, &500_000_000i128);

    let allocations = vec![
        &env,
        Allocation { label: String::from_str(&env, "Savings"), percent: 100 },
    ];
    contract.set_allocations(&worker, &allocations);

    contract.create_invoice(
        &worker, &client, &500_000_000i128,
        &String::from_str(&env, "Invoice #1"),
    );
    contract.pay_invoice(&client, &1u64);

    contract.withdraw_from_bucket(
        &worker,
        &String::from_str(&env, "Savings"),
        &200_000_000i128,
    );

    let buckets = contract.get_buckets(&worker);
    assert_eq!(buckets.get(String::from_str(&env, "Savings")).unwrap(), 300_000_000);
}