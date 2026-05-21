#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, Map, String, Vec,
};
 mod tests;
// ─── Data Types ────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Invoice(u64),
    UserInvoices(Address),
    Allocations(Address),
    Buckets(Address),
    FixedBudget(Address),
    InvoiceCounter,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum InvoiceStatus {
    Pending,
    Paid,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Invoice {
    pub id: u64,
    pub worker: Address,
    pub client: Address,
    pub amount_usdc: i128,
    pub description: String,
    pub status: InvoiceStatus,
    pub created_at: u64,
    pub paid_at: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Allocation {
    pub label: String,
    pub percent: u32,
}

// ─── Contract ──────────────────────────────────────────────────

#[contract]
pub struct Kwagee;

#[contractimpl]
impl Kwagee {

    // ── Invoice Functions ─────────────────────────────────────

    pub fn create_invoice(
        env: Env,
        worker: Address,
        client: Address,
        amount_usdc: i128,
        description: String,
    ) -> u64 {
        worker.require_auth();

        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::InvoiceCounter)
            .unwrap_or(0u64)
            + 1;

        let invoice = Invoice {
            id,
            worker: worker.clone(),
            client,
            amount_usdc,
            description,
            status: InvoiceStatus::Pending,
            created_at: env.ledger().timestamp(),
            paid_at: 0,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Invoice(id), &invoice);

        let mut user_invoices: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::UserInvoices(worker.clone()))
            .unwrap_or(Vec::new(&env));
        user_invoices.push_back(id);
        env.storage()
            .persistent()
            .set(&DataKey::UserInvoices(worker), &user_invoices);

        env.storage()
            .instance()
            .set(&DataKey::InvoiceCounter, &id);

        env.events().publish(
            (symbol_short!("INVOICE"), symbol_short!("CREATED")),
            id,
        );

        id
    }

    pub fn pay_invoice(env: Env, client: Address, invoice_id: u64) {
        client.require_auth();

        let mut invoice: Invoice = env
            .storage()
            .persistent()
            .get(&DataKey::Invoice(invoice_id))
            .expect("Invoice not found");

        assert!(
            invoice.status == InvoiceStatus::Pending,
            "Invoice is not pending"
        );
        assert!(invoice.client == client, "Only the client can pay this invoice");

        invoice.status = InvoiceStatus::Paid;
        invoice.paid_at = env.ledger().timestamp();
        env.storage()
            .persistent()
            .set(&DataKey::Invoice(invoice_id), &invoice);

        Self::distribute_payment(&env, invoice.worker.clone(), invoice.amount_usdc);

        env.events().publish(
            (symbol_short!("INVOICE"), symbol_short!("PAID")),
            invoice_id,
        );
    }

    pub fn cancel_invoice(env: Env, worker: Address, invoice_id: u64) {
        worker.require_auth();

        let mut invoice: Invoice = env
            .storage()
            .persistent()
            .get(&DataKey::Invoice(invoice_id))
            .expect("Invoice not found");

        assert!(invoice.worker == worker, "Not your invoice");
        assert!(
            invoice.status == InvoiceStatus::Pending,
            "Only pending invoices can be cancelled"
        );

        invoice.status = InvoiceStatus::Cancelled;
        env.storage()
            .persistent()
            .set(&DataKey::Invoice(invoice_id), &invoice);
    }

    pub fn get_invoice(env: Env, invoice_id: u64) -> Invoice {
        env.storage()
            .persistent()
            .get(&DataKey::Invoice(invoice_id))
            .expect("Invoice not found")
    }

    pub fn get_worker_invoices(env: Env, worker: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::UserInvoices(worker))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_client_invoices(env: Env, client: Address) -> Vec<u64> {
    let counter: u64 = env
        .storage()
        .instance()
        .get(&DataKey::InvoiceCounter)
        .unwrap_or(0u64);

    let mut client_invoices: Vec<u64> = Vec::new(&env);

    for id in 1..=counter {
        if let Some(invoice) = env
            .storage()
            .persistent()
            .get::<DataKey, Invoice>(&DataKey::Invoice(id))
        {
            if invoice.client == client {
                client_invoices.push_back(id);
            }
        }
    }

    client_invoices
}
    // ── Fixed Budget Functions ────────────────────────────────

    pub fn set_fixed_budget(env: Env, worker: Address, amount: i128) {
        worker.require_auth();
        assert!(amount > 0, "Fixed budget must be greater than 0");
        env.storage()
            .persistent()
            .set(&DataKey::FixedBudget(worker), &amount);
    }

    pub fn get_fixed_budget(env: Env, worker: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::FixedBudget(worker))
            .unwrap_or(0)
    }

    // ── Allocation Functions ──────────────────────────────────

    pub fn set_allocations(env: Env, worker: Address, allocations: Vec<Allocation>) {
        worker.require_auth();

        let total: u32 = allocations.iter().map(|a| a.percent).sum();
        assert!(total == 100, "Allocations must sum to 100%");

        env.storage()
            .persistent()
            .set(&DataKey::Allocations(worker), &allocations);
    }

    pub fn get_allocations(env: Env, worker: Address) -> Vec<Allocation> {
        env.storage()
            .persistent()
            .get(&DataKey::Allocations(worker))
            .unwrap_or(Vec::new(&env))
    }

    // ── Bucket Functions ──────────────────────────────────────

    pub fn get_buckets(env: Env, worker: Address) -> Map<String, i128> {
        env.storage()
            .persistent()
            .get(&DataKey::Buckets(worker))
            .unwrap_or(Map::new(&env))
    }

    pub fn withdraw_from_bucket(
        env: Env,
        worker: Address,
        bucket_label: String,
        amount: i128,
    ) {
        worker.require_auth();

        let mut buckets: Map<String, i128> = env
            .storage()
            .persistent()
            .get(&DataKey::Buckets(worker.clone()))
            .unwrap_or(Map::new(&env));

        let current = buckets.get(bucket_label.clone()).unwrap_or(0);
        assert!(current >= amount, "Insufficient bucket balance");

        buckets.set(bucket_label, current - amount);
        env.storage()
            .persistent()
            .set(&DataKey::Buckets(worker), &buckets);
    }

    // ── Internal ──────────────────────────────────────────────

    fn distribute_payment(env: &Env, worker: Address, total_amount: i128) {
        let fixed_budget: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::FixedBudget(worker.clone()))
            .unwrap_or(0);

        let mut buckets: Map<String, i128> = env
            .storage()
            .persistent()
            .get(&DataKey::Buckets(worker.clone()))
            .unwrap_or(Map::new(env));

        let budget_amount = if fixed_budget > 0 {
            fixed_budget.min(total_amount)
        } else {
            total_amount
        };

        let savings_amount = total_amount - budget_amount;
        if savings_amount > 0 {
            let savings_key = String::from_str(env, "Savings");
            let current = buckets.get(savings_key.clone()).unwrap_or(0);
            buckets.set(savings_key, current + savings_amount);
        }

        let allocations: Vec<Allocation> = env
            .storage()
            .persistent()
            .get(&DataKey::Allocations(worker.clone()))
            .unwrap_or(Vec::new(env));

        if allocations.is_empty() {
            let budget_key = String::from_str(env, "Budget");
            let current = buckets.get(budget_key.clone()).unwrap_or(0);
            buckets.set(budget_key, current + budget_amount);
        } else {
            let mut distributed: i128 = 0;
            let last_index = allocations.len() - 1;

            for (i, alloc) in allocations.iter().enumerate() {
                let slice = if i as u32 == last_index {
                    budget_amount - distributed
                } else {
                    (budget_amount * alloc.percent as i128) / 100
                };

                let current = buckets.get(alloc.label.clone()).unwrap_or(0);
                buckets.set(alloc.label, current + slice);
                distributed += slice;
            }
        }

        env.storage()
            .persistent()
            .set(&DataKey::Buckets(worker), &buckets);
    }
}