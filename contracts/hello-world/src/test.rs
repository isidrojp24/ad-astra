#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    vec, map, String, Env,
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
    let contract_id = env.register(KitaLedger, ());
    let contract = KitaLedgerClient::new(&env, &contract_id);

    let id = contract.create_invoice(
        &worker,
        &client,
        &70_000_000i128, // 7 XLM
        &String::from_str(&env, "Logo design - May 2026"),
    );

    assert_eq!(id, 1);
    let invoice = contract.get_invoice(&id);
    assert_eq!(invoice.amount_xlm, 70_000_000);
    assert_eq!(invoice.status, InvoiceStatus::Pending);
}

#[test]
fn test_set_allocations_and_pay_invoice() {
    let (env, worker, client) = setup();
    let contract_id = env.register(KitaLedger, ());
    let contract = KitaLedgerClient::new(&env, &contract_id);

    // Worker sets their allocation split
    let allocations = vec![
        &env,
        Allocation { label: String::from_str(&env, "SSS"), percent: 10 },
        Allocation { label: String::from_str(&env, "PhilHealth"), percent: 5 },
        Allocation { label: String::from_str(&env, "PagIBIG"), percent: 5 },
        Allocation { label: String::from_str(&env, "Bills"), percent: 20 },
        Allocation { label: String::from_str(&env, "Savings"), percent: 60 },
    ];
    contract.set_allocations(&worker, &allocations);

    // Worker creates invoice
    let id = contract.create_invoice(
        &worker,
        &client,
        &100_000_000i128, // 10 XLM
        &String::from_str(&env, "Web dev project"),
    );

    // Client pays it
    contract.pay_invoice(&client, &id);

    // Check buckets
    let buckets = contract.get_buckets(&worker);
    assert_eq!(buckets.get(String::from_str(&env, "SSS")).unwrap(), 10_000_000);
    assert_eq!(buckets.get(String::from_str(&env, "PhilHealth")).unwrap(), 5_000_000);
    assert_eq!(buckets.get(String::from_str(&env, "Savings")).unwrap(), 60_000_000);
}

#[test]
fn test_allocations_must_sum_to_100() {
    let (env, worker, _) = setup();
    let contract_id = env.register(KitaLedger, ());
    let contract = KitaLedgerClient::new(&env, &contract_id);

    let bad_allocations = vec![
        &env,
        Allocation { label: String::from_str(&env, "SSS"), percent: 10 },
        Allocation { label: String::from_str(&env, "Savings"), percent: 50 },
        // total = 60, should panic
    ];

    let result = std::panic::catch_unwind(|| {
        contract.set_allocations(&worker, &bad_allocations);
    });
    assert!(result.is_err());
}

#[test]
fn test_withdraw_from_bucket() {
    let (env, worker, client) = setup();
    let contract_id = env.register(KitaLedger, ());
    let contract = KitaLedgerClient::new(&env, &contract_id);

    let allocations = vec![
        &env,
        Allocation { label: String::from_str(&env, "Savings"), percent: 100 },
    ];
    contract.set_allocations(&worker, &allocations);

    contract.create_invoice(
        &worker, &client, &50_000_000i128,
        &String::from_str(&env, "Invoice #1"),
    );
    contract.pay_invoice(&client, &1u64);

    contract.withdraw_from_bucket(
        &worker,
        &String::from_str(&env, "Savings"),
        &20_000_000i128,
    );

    let buckets = contract.get_buckets(&worker);
    assert_eq!(buckets.get(String::from_str(&env, "Savings")).unwrap(), 30_000_000);
}