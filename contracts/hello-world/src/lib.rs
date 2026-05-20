#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, Map, String, Vec, Symbol,
};

// ─── Data Types ────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Invoice(u64),           // invoice_id -> Invoice
    UserInvoices(Address),  // address -> Vec<u64>
    Allocations(Address),   // address -> Vec<Allocation>
    Buckets(Address),       // address -> Map<String, i128>
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
    pub amount_xlm: i128,       // in stroops (1 XLM = 10_000_000 stroops)
    pub description: String,
    pub status: InvoiceStatus,
    pub created_at: u64,
    pub paid_at: u64,           // 0 if unpaid
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Allocation {
    pub label: String,          // e.g. "SSS", "PhilHealth", "Savings"
    pub percent: u32,           // 0–100, all must sum to 100
}

// ─── Contract ──────────────────────────────────────────────────

#[contract]
pub struct KitaLedger;

#[contractimpl]
impl KitaLedger {

    // ── Invoice Functions ─────────────────────────────────────

    /// Worker creates an invoice for a client
    pub fn create_invoice(
        env: Env,
        worker: Address,
        client: Address,
        amount_xlm: i128,
        description: String,
    ) -> u64 {
        worker.require_auth();

        // Get and increment counter
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
            amount_xlm,
            description,
            status: InvoiceStatus::Pending,
            created_at: env.ledger().timestamp(),
            paid_at: 0,
        };

        // Save invoice
        env.storage()
            .persistent()
            .set(&DataKey::Invoice(id), &invoice);

        // Track invoice under worker's list
        let mut user_invoices: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::UserInvoices(worker.clone()))
            .unwrap_or(Vec::new(&env));
        user_invoices.push_back(id);
        env.storage()
            .persistent()
            .set(&DataKey::UserInvoices(worker), &user_invoices);

        // Update counter
        env.storage()
            .instance()
            .set(&DataKey::InvoiceCounter, &id);

        env.events().publish(
            (symbol_short!("INVOICE"), symbol_short!("CREATED")),
            id,
        );

        id
    }

    /// Mark an invoice as paid and distribute funds to worker's buckets
    /// Called by client after XLM transfer is done on-chain
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

        // Update status
        invoice.status = InvoiceStatus::Paid;
        invoice.paid_at = env.ledger().timestamp();
        env.storage()
            .persistent()
            .set(&DataKey::Invoice(invoice_id), &invoice);

        // Distribute to worker's allocation buckets
        Self::distribute_to_buckets(&env, invoice.worker.clone(), invoice.amount_xlm);

        env.events().publish(
            (symbol_short!("INVOICE"), symbol_short!("PAID")),
            invoice_id,
        );
    }

    /// Worker cancels a pending invoice
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

    /// Get a single invoice by ID
    pub fn get_invoice(env: Env, invoice_id: u64) -> Invoice {
        env.storage()
            .persistent()
            .get(&DataKey::Invoice(invoice_id))
            .expect("Invoice not found")
    }

    /// Get all invoice IDs for a worker
    pub fn get_worker_invoices(env: Env, worker: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::UserInvoices(worker))
            .unwrap_or(Vec::new(&env))
    }

    // ── Allocation Functions ──────────────────────────────────

    /// Set allocation weights for a worker (must sum to 100)
    /// Example: [("SSS", 10), ("PhilHealth", 5), ("PagIBIG", 5), ("Bills", 20), ("Savings", 60)]
    pub fn set_allocations(env: Env, worker: Address, allocations: Vec<Allocation>) {
        worker.require_auth();

        // Validate all percentages sum to 100
        let total: u32 = allocations.iter().map(|a| a.percent).sum();
        assert!(total == 100, "Allocations must sum to 100%");

        env.storage()
            .persistent()
            .set(&DataKey::Allocations(worker), &allocations);
    }

    /// Get a worker's current allocation settings
    pub fn get_allocations(env: Env, worker: Address) -> Vec<Allocation> {
        env.storage()
            .persistent()
            .get(&DataKey::Allocations(worker))
            .unwrap_or(Vec::new(&env))
    }

    // ── Budget Bucket Functions ───────────────────────────────

    /// Get the current balance of each allocation bucket for a worker
    pub fn get_buckets(env: Env, worker: Address) -> Map<String, i128> {
        env.storage()
            .persistent()
            .get(&DataKey::Buckets(worker))
            .unwrap_or(Map::new(&env))
    }

    /// Worker withdraws from a specific bucket (tracks on-chain, actual transfer done via SDK)
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

        buckets.set(bucket_label.clone(), current - amount);
        env.storage()
            .persistent()
            .set(&DataKey::Buckets(worker), &buckets);

        env.events().publish(
            (symbol_short!("BUCKET"), symbol_short!("WITHDRAW")),
            amount,
        );
    }

    // ── Internal Helpers ──────────────────────────────────────

    fn distribute_to_buckets(env: &Env, worker: Address, total_amount: i128) {
        let allocations: Vec<Allocation> = env
            .storage()
            .persistent()
            .get(&DataKey::Allocations(worker.clone()))
            .unwrap_or(Vec::new(env));

        // If no allocations set, everything goes to a default "Wallet" bucket
        if allocations.is_empty() {
            let mut buckets: Map<String, i128> = env
                .storage()
                .persistent()
                .get(&DataKey::Buckets(worker.clone()))
                .unwrap_or(Map::new(env));
            let wallet_key = String::from_str(env, "Wallet");
            let current = buckets.get(wallet_key.clone()).unwrap_or(0);
            buckets.set(wallet_key, current + total_amount);
            env.storage()
                .persistent()
                .set(&DataKey::Buckets(worker), &buckets);
            return;
        }

        let mut buckets: Map<String, i128> = env
            .storage()
            .persistent()
            .get(&DataKey::Buckets(worker.clone()))
            .unwrap_or(Map::new(env));

        let mut distributed: i128 = 0;
        let last_index = allocations.len() - 1;

        for (i, alloc) in allocations.iter().enumerate() {
            let slice = if i as u32 == last_index {
                // Last bucket gets the remainder to avoid rounding dust
                total_amount - distributed
            } else {
                (total_amount * alloc.percent as i128) / 100
            };

            let current = buckets.get(alloc.label.clone()).unwrap_or(0);
            buckets.set(alloc.label, current + slice);
            distributed += slice;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Buckets(worker), &buckets);
    }
}