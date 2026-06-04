import kwageeLogo from '../kwagee_logo.png';
import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  ArrowUpRight, 
  Coins, 
  PiggyBank, 
  ShieldAlert, 
  CheckCircle, 
  RefreshCw, 
  Users, 
  Zap, 
  ChevronRight, 
  Sparkles, 
  LogOut,
  Send,
  History,
  Lock,
  ArrowDownLeft,
  Calculator,
  Heart,
  Home,
  Plus,
  Trash2,
  Edit2,
  Check
} from 'lucide-react';

import { 
  isConnected, 
  getNetwork, 
  signTransaction,
  requestAccess
} from '@stellar/freighter-api';

import { 
  Keypair, 
  Contract, 
  TransactionBuilder, 
  Networks, 
  BASE_FEE, 
  nativeToScVal, 
  scValToNative, 
  Address, 
  xdr, 
  rpc, 
  Operation, 
  Asset,
  Account,
  Horizon,
  assembleTransaction
} from '@stellar/stellar-sdk';

const CONTRACT_ID = "CDQFBGQJKBREW5NCQDWV277PHCFI4WYVYGW26FHOZ4JBTO5PSRGQ4FVO";

function App() {
  // Wallet Address State
  const [walletAddress, setWalletAddress] = useState('');
  const [isEditingWallet, setIsEditingWallet] = useState(false);
  const [walletInputVal, setWalletInputVal] = useState('');
  const [landingError, setLandingError] = useState('');
  const [isSandboxMode, setIsSandboxMode] = useState(false);
  
  // Network Selection
  const [network, setNetwork] = useState('testnet'); // Default to testnet
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState('');

  // App Tabs States: 'savings' | 'budgeting' | 'transfer'
  const [activeTab, setActiveTab] = useState('savings');
  
  // Base Live Balances
  const [balances, setBalances] = useState({
    xlm: 0,
    usdc: 0,
    php: 0,
  });

  // Real-time payments history fetched from Horizon
  const [transactions, setTransactions] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Budget Allocator states
  const [budgetAmount, setBudgetAmount] = useState(0); // Chosen amount to budget in USDC
  
  // Micro-allocation Percentages of the budgeted amount (Must sum to 100%)
  const [allocations, setAllocations] = useState([
    { id: 'sss', label: 'SSS', pct: 15, color: '#ff9f1c', iconName: 'ShieldAlert', isCustom: false },
    { id: 'philhealth', label: 'Philhealth', pct: 10, color: '#00f5d4', iconName: 'Heart', isCustom: false },
    { id: 'pagibig', label: 'Pag-IBIG', pct: 10, color: '#3a86ff', iconName: 'Home', isCustom: false },
    { id: 'tax', label: 'Income Tax Return', pct: 15, color: '#ff0055', iconName: 'Zap', isCustom: false },
    { id: 'bills', label: 'Bills & Utilities', pct: 20, color: '#9d4edd', iconName: 'RefreshCw', isCustom: false },
    { id: 'spendable', label: 'Spendable Cash', pct: 30, color: '#ff007f', iconName: 'Coins', isCustom: false }
  ]);

  // Map iconName to standard Lucide React components
  const iconMap = {
    ShieldAlert,
    Heart,
    Home,
    Zap,
    RefreshCw,
    Coins,
    Sparkles
  };

  const customColors = ['#00b4d8', '#ff70a6', '#ff9770', '#ffd670', '#80ffdb', '#e0aaff', '#9d4edd'];

  // State for adding/editing custom allocations
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAllocName, setNewAllocName] = useState('');
  const [newAllocPct, setNewAllocPct] = useState(10);

  // Transfer Form States
  const [transferRecipient, setTransferRecipient] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferAsset, setTransferAsset] = useState('XLM');
  const [isSimulatingTransfer, setIsSimulatingTransfer] = useState(false);
  const [transferLogs, setTransferLogs] = useState([]);
  const [showTransferSuccess, setShowTransferSuccess] = useState(false);
  const [lastTxHash, setLastTxHash] = useState('');

  // On-Chain Buckets (Soroban) State
  const [contractBuckets, setContractBuckets] = useState(null);
  const [isFetchingContractData, setIsFetchingContractData] = useState(false);
  
  // Syncing State
  const [isSyncingAllocations, setIsSyncingAllocations] = useState(false);
  const [syncLogs, setSyncLogs] = useState([]);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [syncTxHash, setSyncTxHash] = useState('');

  // Soroban Invoicing States
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [invoiceLogs, setInvoiceLogs] = useState([]);
  const [invoiceClientAddress, setInvoiceClientAddress] = useState('');
  const [invoiceAmountUsdc, setInvoiceAmountUsdc] = useState('');
  const [invoiceDescription, setInvoiceDescription] = useState('');
  const [invoiceIdToPay, setInvoiceIdToPay] = useState('');
  const [isPayingInvoice, setIsPayingInvoice] = useState(false);
  const [payInvoiceLogs, setPayInvoiceLogs] = useState([]);
  const [workerInvoices, setWorkerInvoices] = useState([]);
  const [clientInvoices, setClientInvoices] = useState([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [invoiceFeedTab, setInvoiceFeedTab] = useState('incoming'); // 'incoming' | 'sent'

  // Withdraw Bucket States
  const [withdrawingBucket, setWithdrawingBucket] = useState(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawLogs, setWithdrawLogs] = useState([]);


  const [reloadCounter, setReloadCounter] = useState(0);
  const triggerReloadData = () => setReloadCounter(prev => prev + 1);

  // Helper to resolve Soroban Enum Variant names
  const resolveStatus = (statusObj) => {
    if (!statusObj) return 'Unpaid';
    if (typeof statusObj === 'string') {
      const s = statusObj.toLowerCase();
      if (s === '0' || s === 'unpaid') return 'Unpaid';
      if (s === '1' || s === 'pending') return 'Pending';
      if (s === '2' || s === 'paid') return 'Paid';
      return statusObj;
    }
    if (statusObj.name) return statusObj.name;
    if (typeof statusObj === 'object') {
      return Object.keys(statusObj)[0] || 'Unpaid';
    }
    const n = Number(statusObj);
    if (n === 0) return 'Unpaid';
    if (n === 1) return 'Pending';
    if (n === 2) return 'Paid';
    return String(statusObj);
  };

  // Get status display config: color, label, bg
  const getStatusConfig = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'paid') return {
      label: 'Paid', color: '#00e676', bg: 'rgba(0,230,118,0.12)',
      border: 'rgba(0,230,118,0.25)', borderLeft: '#00e676', cardBg: 'rgba(0,230,118,0.04)',
    };
    if (s === 'pending') return {
      label: 'Pending', color: '#ff9f1c', bg: 'rgba(255,159,28,0.12)',
      border: 'rgba(255,159,28,0.25)', borderLeft: '#ff9f1c', cardBg: 'rgba(255,159,28,0.03)',
    };
    return {
      label: 'Unpaid', color: '#ff3d5a', bg: 'rgba(255,61,90,0.12)',
      border: 'rgba(255,61,90,0.25)', borderLeft: '#ff3d5a', cardBg: 'rgba(255,61,90,0.03)',
    };
  };

  // Helper to submit a transaction using Freighter
  const sendTransactionWithFreighter = async (operation, setLogs) => {
    const cleanAddress = walletAddress.trim();
    if (!cleanAddress) throw new Error("Wallet not connected");

    setLogs([
      { text: "⏳ Initiating on-chain transaction request...", type: "info" },
      { text: `🔑 Account address: ${cleanAddress.slice(0, 6)}...${cleanAddress.slice(-6)}`, type: "stellar" }
    ]);

    // Query Freighter's active network setting dynamically to align our build phase
    let activeNetwork = network;
    try {
      const netRes = await getNetwork();
      if (netRes && !netRes.error && netRes.network) {
        const netLower = netRes.network.toLowerCase();
        activeNetwork = (netLower === 'public' || netLower === 'mainnet') ? 'mainnet' : 'testnet';
        if (activeNetwork !== network) {
          setNetwork(activeNetwork);
        }
      }
    } catch (e) {
      console.warn("Could not retrieve Freighter network:", e);
    }

    const rpcUrl = activeNetwork === 'mainnet'
      ? 'https://soroban-rpc.stellar.org'
      : 'https://soroban-testnet.stellar.org';
    const server = new rpc.Server(rpcUrl);
    const passphrase = activeNetwork === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

    setLogs(prev => [...prev, { text: `🛰️ Fetching current account sequence from Horizon (${activeNetwork.toUpperCase()})...`, type: "info" }]);
    
    const horizonUrl = activeNetwork === 'mainnet'
      ? `https://horizon.stellar.org/accounts/${cleanAddress}`
      : `https://horizon-testnet.stellar.org/accounts/${cleanAddress}`;
      
    const accountRes = await fetch(horizonUrl);
    if (!accountRes.ok) {
      throw new Error("Could not load account sequence. Make sure the account is funded on-chain.");
    }
    const accountData = await accountRes.json();
    const account = new Account(cleanAddress, accountData.sequence);

    setLogs(prev => [...prev, { text: "📜 Building transaction envelope...", type: "info" }]);
    
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: passphrase,
    })
      .addOperation(operation)
      .setTimeout(180)
      .build();

    setLogs(prev => [...prev, { text: "🔧 Running Soroban simulation to determine resource fees...", type: "info" }]);
    const simRes = await server.simulateTransaction(tx);
    
    if (simRes.error) {
      throw new Error(`Simulation failed: ${simRes.error}`);
    }
    if (simRes.result?.error) {
      throw new Error(`Simulation failed in smart contract: ${JSON.stringify(simRes.result.error)}`);
    }

    setLogs(prev => [...prev, { text: "💰 Assembling transaction with simulation resource fees...", type: "info" }]);

    // Assemble directly from the SAME tx object used for simulation.
    // Do NOT rebuild from scratch — that would produce a duplicate sequence number.
    const rebuiltTx = rpc.assembleTransaction(tx, simRes).build();

    const rebuiltXdr = rebuiltTx.toEnvelope().toXDR("base64");
    
    setLogs(prev => [...prev, { text: "🖊️ Cryptographically signing transaction via Freighter...", type: "stellar" }]);
    
    let signedTxXdr;
    try {
      const signRes = await signTransaction(rebuiltXdr, {
        networkPassphrase: passphrase
      });
      // Freighter API v2+ returns the signed XDR string directly;
      // older versions returned { signedTxXdr: "..." } — handle both shapes.
      if (typeof signRes === 'string') {
        signedTxXdr = signRes;
      } else if (signRes && typeof signRes === 'object') {
        if (signRes.error) {
          throw new Error(`Signing failed: ${signRes.error.message || JSON.stringify(signRes.error)}`);
        }
        signedTxXdr = signRes.signedTxXdr || signRes.result || signRes;
      } else {
        throw new Error("Unexpected response shape from Freighter signTransaction");
      }
      if (!signedTxXdr || typeof signedTxXdr !== 'string') {
        throw new Error("Freighter returned an empty or invalid signed XDR. Did you reject the transaction?");
      }
    } catch (err) {
      // Re-throw with a clearer message if it's a user rejection
      const msg = err.message || String(err);
      if (msg.toLowerCase().includes('user') || msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('cancel')) {
        throw new Error("Transaction cancelled: User rejected the Freighter signing request.");
      }
      throw err;
    }

    setLogs(prev => [...prev, { text: "🚀 Submitting signed XDR to Soroban RPC node...", type: "stellar" }]);

    let submitRes;
    try {
      submitRes = await server.sendTransaction(
        TransactionBuilder.fromXDR(signedTxXdr, passphrase)
      );
    } catch (submitErr) {
      throw new Error(`Failed to submit transaction to RPC: ${submitErr.message || JSON.stringify(submitErr)}`);
    }

    if (!submitRes) {
      throw new Error("Transaction submission returned no response from RPC node.");
    }

    if (submitRes.status === "ERROR" || submitRes.status === "FAILED") {
      const errDetail = submitRes.errorResultXdr
        ? ` XDR: ${submitRes.errorResultXdr}`
        : (submitRes.errorResult ? ` ${JSON.stringify(submitRes.errorResult)}` : '');
      throw new Error(`Transaction submission failed on RPC (status: ${submitRes.status}).${errDetail}`);
    }

    const txHash = submitRes.hash;
    setLogs(prev => [...prev, { text: `⏳ Waiting for ledger confirmation... TX: ${txHash.slice(0,8)}...`, type: "info" }]);

    let getTxRes;
    let attempts = 0;
    while (attempts < 30) {
      await new Promise(r => setTimeout(r, 2000));
      getTxRes = await server.getTransaction(txHash);
      if (getTxRes.status !== "NOT_FOUND") {
        break;
      }
      attempts++;
    }

    if (getTxRes.status === "SUCCESS") {
      setLogs(prev => [...prev, { text: "🎉 LEDGER CONFIRMED! Success.", type: "success" }]);
      return txHash;
    } else {
      throw new Error(`Transaction failed with status: ${getTxRes.status}. Error: ${JSON.stringify(getTxRes.resultXdr)}`);
    }
  };

  // Sync allocations to Soroban smart contract
  const handleSyncAllocations = async () => {
    if (isSandboxMode) return;
    if (totalAllocationPct !== 100) {
      alert("Allocations must sum to 100% to sync.");
      return;
    }

    setIsSyncingAllocations(true);
    setSyncLogs([]);
    setShowSyncSuccess(false);

    try {
      const contract = new Contract(CONTRACT_ID);
      const allocationsScVal = xdr.ScVal.scvVec(
        allocations.map(a => 
          xdr.ScVal.scvMap([
            new xdr.ScMapEntry({
              key: nativeToScVal("label", { type: "symbol" }),
              val: nativeToScVal(a.label, { type: "string" }),
            }),
            new xdr.ScMapEntry({
              key: nativeToScVal("percent", { type: "symbol" }),
              val: nativeToScVal(a.pct, { type: "u32" }),
            }),
          ])
        )
      );

      const op = contract.call(
        "set_allocations",
        new Address(walletAddress).toScVal(),
        allocationsScVal
      );

      const txHash = await sendTransactionWithFreighter(op, setSyncLogs);
      setSyncTxHash(txHash);
      setShowSyncSuccess(true);
      
      triggerReloadData();
    } catch (err) {
      console.error("Sync Allocations Error:", err);
      setSyncLogs(prev => [...prev, { text: `❌ Error: ${err.message || JSON.stringify(err)}`, type: "error" }]);
    } finally {
      setIsSyncingAllocations(false);
    }
  };

  // Withdraw bucket balances
  const handleWithdrawSubmit = async (bucketLabel, amount) => {
    if (isSandboxMode) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    setIsWithdrawing(true);
    setWithdrawLogs([]);

    try {
      const contract = new Contract(CONTRACT_ID);
      const op = contract.call(
        "withdraw_from_bucket",
        new Address(walletAddress).toScVal(),
        nativeToScVal(bucketLabel, { type: "string" }),
        nativeToScVal(Math.round(amt * 10_000_000), { type: "i128" })
      );

      await sendTransactionWithFreighter(op, setWithdrawLogs);
      
      setWithdrawAmount('');
      setWithdrawingBucket(null);

      triggerReloadData();
    } catch (err) {
      console.error("Withdraw Bucket Error:", err);
      setWithdrawLogs(prev => [...prev, { text: `❌ Error: ${err.message || JSON.stringify(err)}`, type: "error" }]);
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Create on-chain invoice
  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (isSandboxMode) return;
    const clientAddr = invoiceClientAddress.trim();
    const amt = parseFloat(invoiceAmountUsdc);
    const desc = invoiceDescription.trim() || "Freelance Work - Kwagee Project";

    if (!clientAddr || isNaN(amt) || amt <= 0) {
      alert("Please fill in recipient address and a valid amount.");
      return;
    }

    setIsCreatingInvoice(true);
    setInvoiceLogs([]);

    try {
      const contract = new Contract(CONTRACT_ID);
      const op = contract.call(
        "create_invoice",
        new Address(walletAddress).toScVal(),
        new Address(clientAddr).toScVal(),
        nativeToScVal(Math.round(amt * 10_000_000), { type: "i128" }),
        nativeToScVal(desc, { type: "string" })
      );

      await sendTransactionWithFreighter(op, setInvoiceLogs);
      
      setInvoiceClientAddress('');
      setInvoiceAmountUsdc('');
      setInvoiceDescription('');

      triggerReloadData();
    } catch (err) {
      console.error("Create Invoice Error:", err);
      setInvoiceLogs(prev => [...prev, { text: `❌ Error: ${err.message || JSON.stringify(err)}`, type: "error" }]);
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  // Send a native XLM payment via Horizon (not Soroban RPC — no simulation needed)
  const sendNativeXlmPayment = async (destinationAddress, amountXlm, setLogs) => {
    const cleanAddress = walletAddress.trim();
    if (!cleanAddress) throw new Error("Wallet not connected");

    let activeNetwork = network;
    try {
      const netRes = await getNetwork();
      if (netRes && !netRes.error && netRes.network) {
        const netLower = netRes.network.toLowerCase();
        activeNetwork = (netLower === 'public' || netLower === 'mainnet') ? 'mainnet' : 'testnet';
      }
    } catch (e) {}

    const passphrase = activeNetwork === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
    const horizonBase = activeNetwork === 'mainnet'
      ? 'https://horizon.stellar.org'
      : 'https://horizon-testnet.stellar.org';

    setLogs(prev => [...prev, {
      text: `💸 Sending ${amountXlm} XLM to worker ${destinationAddress.slice(0,6)}...${destinationAddress.slice(-6)}`,
      type: "info"
    }]);

    // Fetch current sequence number
    const accRes = await fetch(`${horizonBase}/accounts/${cleanAddress}`);
    if (!accRes.ok) throw new Error("Could not load account for XLM payment.");
    const accData = await accRes.json();
    const account = new Account(cleanAddress, accData.sequence);

    const tx = new TransactionBuilder(account, {
      fee: String(Math.max(Number(BASE_FEE), 1000)),
      networkPassphrase: passphrase,
    })
      .addOperation(
        Operation.payment({
          destination: destinationAddress,
          asset: Asset.native(),
          amount: amountXlm.toFixed(7),
        })
      )
      .setTimeout(180)
      .build();

    const txXdr = tx.toEnvelope().toXDR("base64");

    setLogs(prev => [...prev, { text: "🖊️ Signing XLM payment via Freighter...", type: "stellar" }]);

    let signedXdr;
    const signRes = await signTransaction(txXdr, { networkPassphrase: passphrase });
    if (typeof signRes === 'string') {
      signedXdr = signRes;
    } else if (signRes?.signedTxXdr) {
      signedXdr = signRes.signedTxXdr;
    } else if (signRes?.error) {
      throw new Error(`Signing failed: ${signRes.error.message || JSON.stringify(signRes.error)}`);
    } else {
      throw new Error("Unexpected Freighter response. Did you reject the transaction?");
    }

    setLogs(prev => [...prev, { text: "🚀 Submitting XLM payment to Stellar network...", type: "stellar" }]);

    const submitRes = await fetch(`${horizonBase}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `tx=${encodeURIComponent(signedXdr)}`,
    });
    const submitData = await submitRes.json();

    if (!submitRes.ok || submitData.status === 'ERROR') {
      const detail = submitData.extras?.result_codes
        ? JSON.stringify(submitData.extras.result_codes)
        : (submitData.detail || submitData.title || JSON.stringify(submitData));
      throw new Error(`XLM payment failed: ${detail}`);
    }

    setLogs(prev => [...prev, {
      text: `✅ XLM payment confirmed! Hash: ${submitData.hash?.slice(0,10)}...`,
      type: "success"
    }]);

    return submitData.hash;
  };

  // Pay invoice — sends real XLM to the worker, then marks invoice as paid on-chain
  const handlePayInvoice = async (invoiceId) => {
    if (isSandboxMode) return;
    if (!invoiceId) return;

    setIsPayingInvoice(true);
    setPayInvoiceLogs([]);

    try {
      // Resolve active network
      let activeNetwork = network;
      try {
        const netRes = await getNetwork();
        if (netRes && !netRes.error && netRes.network) {
          const netLower = netRes.network.toLowerCase();
          activeNetwork = (netLower === 'public' || netLower === 'mainnet') ? 'mainnet' : 'testnet';
          if (activeNetwork !== network) setNetwork(activeNetwork);
        }
      } catch (e) {}

      const rpcUrl = activeNetwork === 'mainnet'
        ? 'https://soroban-rpc.stellar.org'
        : 'https://soroban-testnet.stellar.org';
      const passphrase = activeNetwork === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
      const rpcServer = new rpc.Server(rpcUrl);
      const cleanAddress = walletAddress.trim();

      setPayInvoiceLogs([{
        text: `🔍 Fetching invoice #${invoiceId} details from chain...`,
        type: "info"
      }]);

      // Step 0: Fetch invoice details to get worker address and amount
      const dummyAccount = new Account(cleanAddress, "0");
      const contract = new Contract(CONTRACT_ID);

      const detailTx = new TransactionBuilder(dummyAccount, {
        fee: BASE_FEE,
        networkPassphrase: passphrase,
      })
        .addOperation(
          contract.call("get_invoice", nativeToScVal(BigInt(invoiceId), { type: "u64" }))
        )
        .setTimeout(180)
        .build();

      const detailSim = await rpcServer.simulateTransaction(detailTx);
      if (detailSim.error || !detailSim.result?.retval) {
        throw new Error(`Could not fetch invoice #${invoiceId}: ${detailSim.error || 'no return value'}`);
      }

      const invoiceData = scValToNative(detailSim.result.retval);
      const amountRaw = BigInt(invoiceData.amount_usdc);
      const amountXlm = Number(amountRaw) / 10_000_000; // treat stored amount as XLM units
      const workerAddress = invoiceData.worker;

      if (!workerAddress || workerAddress.length < 30) {
        throw new Error("Could not resolve worker address from invoice.");
      }

      setPayInvoiceLogs(prev => [...prev, {
        text: `📋 Invoice #${invoiceId}: ${amountXlm} XLM → worker ${workerAddress.slice(0,6)}...${workerAddress.slice(-6)}`,
        type: "stellar"
      }]);

      // Step 1: Send native XLM directly to the worker via Horizon
      setPayInvoiceLogs(prev => [...prev, {
        text: `💸 Step 1/2: Sending ${amountXlm} XLM to worker...`,
        type: "info"
      }]);

      await sendNativeXlmPayment(workerAddress, amountXlm, setPayInvoiceLogs);

      // Step 2: Mark the invoice as paid on the Soroban contract
      setPayInvoiceLogs(prev => [...prev, {
        text: `📝 Step 2/2: Recording payment on smart contract...`,
        type: "info"
      }]);

      const kwageeContract = new Contract(CONTRACT_ID);
      const payOp = kwageeContract.call(
        "pay_invoice",
        new Address(walletAddress).toScVal(),
        nativeToScVal(BigInt(invoiceId), { type: "u64" })
      );

      await sendTransactionWithFreighter(payOp, setPayInvoiceLogs);

      setPayInvoiceLogs(prev => [...prev, {
        text: `🎉 Invoice #${invoiceId} paid! ${amountXlm} XLM deducted from your wallet.`,
        type: "success"
      }]);

      // Optimistically deduct XLM from displayed balance immediately
      setBalances(prev => ({
        ...prev,
        xlm: Math.max(0, prev.xlm - amountXlm),
        php: (prev.usdc > 0 ? prev.usdc * 57 : Math.max(0, prev.xlm - amountXlm) * 0.11 * 57)
      }));

      setPayInvoiceLogs(prev => [...prev, {
        text: `💳 Wallet balance updated: -${amountXlm} XLM deducted.`,
        type: "stellar"
      }]);

      setInvoiceIdToPay('');

      // Re-fetch after delay to reconcile with Horizon's confirmed state
      setTimeout(() => triggerReloadData(), 4000);
      triggerReloadData();
    } catch (err) {
      console.error("Pay Invoice Error:", err);
      setPayInvoiceLogs(prev => [...prev, { text: `❌ Error: ${err.message || JSON.stringify(err)}`, type: "error" }]);
    } finally {
      setIsPayingInvoice(false);
    }
  };

  // Fetch smart invoices list
  const fetchInvoices = async () => {
    const cleanAddress = walletAddress.trim();
    if (!cleanAddress || cleanAddress.length < 30 || isSandboxMode) return;

    setIsLoadingInvoices(true);
    
    const rpcUrl = network === 'mainnet'
      ? 'https://soroban-rpc.stellar.org'
      : 'https://soroban-testnet.stellar.org';
    const server = new rpc.Server(rpcUrl);
    const contract = new Contract(CONTRACT_ID);
    const passphrase = network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

    try {
      const dummyAccount = new Account(cleanAddress, "0");

      const tx = new TransactionBuilder(dummyAccount, {
        fee: BASE_FEE,
        networkPassphrase: passphrase,
      })
        .addOperation(
          contract.call("get_worker_invoices", new Address(cleanAddress).toScVal())
        )
        .setTimeout(180)
        .build();

      const simRes = await server.simulateTransaction(tx);
      if (!simRes.error && simRes.result?.retval) {
        const invoiceIds = scValToNative(simRes.result.retval);
        if (Array.isArray(invoiceIds) && invoiceIds.length > 0) {
          const detailsPromises = invoiceIds.map(async (id) => {
            try {
              const detailTx = new TransactionBuilder(dummyAccount, {
                fee: BASE_FEE,
                networkPassphrase: passphrase,
              })
                .addOperation(
                  contract.call("get_invoice", nativeToScVal(BigInt(id), { type: "u64" }))
                )
                .setTimeout(180)
                .build();

              const detailSim = await server.simulateTransaction(detailTx);
              if (!detailSim.error && detailSim.result?.retval) {
                const invoiceData = scValToNative(detailSim.result.retval);
                return {
                  id: Number(invoiceData.id),
                  worker: invoiceData.worker,
                  client: invoiceData.client,
                  amountUsdc: Number(BigInt(invoiceData.amount_usdc)) / 10000000,
                  description: invoiceData.description,
                  status: resolveStatus(invoiceData.status),
                  createdAt: Number(invoiceData.created_at) * 1000,
                  paidAt: Number(invoiceData.paid_at) * 1000
                };
              }
            } catch (e) {
              console.error(`Error fetching invoice details for ${id}:`, e);
            }
            return null;
          });

          const resolvedInvoices = await Promise.all(detailsPromises);
          setWorkerInvoices(resolvedInvoices.filter(i => i !== null).sort((a, b) => b.id - a.id));
        } else {
          setWorkerInvoices([]);
        }
      } else {
        setWorkerInvoices([]);
      }
    } catch (err) {
      console.error("Error fetching worker invoices:", err);
      setWorkerInvoices([]);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  const fetchClientInvoices = async () => {
    const cleanAddress = walletAddress.trim();
    if (!cleanAddress || cleanAddress.length < 30 || isSandboxMode) return;

    setIsLoadingInvoices(true);

    const rpcUrl = network === 'mainnet'
      ? 'https://soroban-rpc.stellar.org'
      : 'https://soroban-testnet.stellar.org';
    const server = new rpc.Server(rpcUrl);
    const contract = new Contract(CONTRACT_ID);
    const passphrase = network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

    try {
      const dummyAccount = new Account(cleanAddress, "0");

      const tx = new TransactionBuilder(dummyAccount, {
        fee: BASE_FEE,
        networkPassphrase: passphrase,
      })
        .addOperation(
          contract.call("get_client_invoices", new Address(cleanAddress).toScVal())
        )
        .setTimeout(180)
        .build();

      const simRes = await server.simulateTransaction(tx);
      if (!simRes.error && simRes.result?.retval) {
        const invoiceIds = scValToNative(simRes.result.retval);
        if (Array.isArray(invoiceIds) && invoiceIds.length > 0) {
          const detailsPromises = invoiceIds.map(async (id) => {
            try {
              const detailTx = new TransactionBuilder(dummyAccount, {
                fee: BASE_FEE,
                networkPassphrase: passphrase,
              })
                .addOperation(
                  contract.call("get_invoice", nativeToScVal(BigInt(id), { type: "u64" }))
                )
                .setTimeout(180)
                .build();

              const detailSim = await server.simulateTransaction(detailTx);
              if (!detailSim.error && detailSim.result?.retval) {
                const invoiceData = scValToNative(detailSim.result.retval);
                return {
                  id: Number(invoiceData.id),
                  worker: invoiceData.worker,
                  client: invoiceData.client,
                  amountUsdc: Number(BigInt(invoiceData.amount_usdc)) / 10000000,
                  description: invoiceData.description,
                  status: resolveStatus(invoiceData.status),
                  createdAt: Number(invoiceData.created_at) * 1000,
                  paidAt: Number(invoiceData.paid_at) * 1000
                };
              }
            } catch (e) {
              console.error(`Error fetching client invoice details for ${id}:`, e);
            }
            return null;
          });

          const resolvedInvoices = await Promise.all(detailsPromises);
          setClientInvoices(resolvedInvoices.filter(i => i !== null).sort((a, b) => b.id - a.id));
        } else {
          setClientInvoices([]);
        }
      } else {
        setClientInvoices([]);
      }
    } catch (err) {
      console.error("Error fetching client invoices:", err);
      setClientInvoices([]);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  // Fetch Live Balance from Stellar Horizon Ledger
  useEffect(() => {
    const fetchBalance = async () => {
      const cleanAddress = walletAddress.trim();
      if (!cleanAddress || cleanAddress.length < 30 || isSandboxMode) return;
      
      setIsLoadingBalance(true);
      setBalanceError('');
      
      const horizonUrl = network === 'mainnet' 
        ? `https://horizon.stellar.org/accounts/${cleanAddress}`
        : `https://horizon-testnet.stellar.org/accounts/${cleanAddress}`;

      try {
        const response = await fetch(horizonUrl);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Account not created/funded on ${network.toUpperCase()} yet.`);
          }
          throw new Error('Could not fetch account from Horizon server.');
        }
        
        const data = await response.json();
        
        let xlmBalance = 0;
        let usdcBalance = 0;

        if (data.balances && Array.isArray(data.balances)) {
          data.balances.forEach(b => {
            if (b.asset_type === 'native') {
              xlmBalance = parseFloat(b.balance);
            } else if (b.asset_code === 'USDC') {
              usdcBalance = parseFloat(b.balance);
            }
          });
        }

        setBalances({
          xlm: xlmBalance,
          usdc: usdcBalance,
          php: usdcBalance > 0 ? usdcBalance * 57 : xlmBalance * 0.11 * 57
        });

        setBudgetAmount(prev => {
          if (prev === 0 && usdcBalance > 0) {
            return Math.round(usdcBalance * 0.4);
          }
          return prev;
        });

      } catch (err) {
        setBalanceError(err.message);
        setBalances({
          xlm: 0,
          usdc: 0,
          php: 0
        });
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalance();
  }, [walletAddress, network, isSandboxMode, reloadCounter]);

  // Fetch Soroban Smart Contract allocations and buckets
  useEffect(() => {
    const fetchContractData = async () => {
      const cleanAddress = walletAddress.trim();
      if (!cleanAddress || cleanAddress.length < 30 || isSandboxMode) return;

      setIsFetchingContractData(true);
      
      const rpcUrl = network === 'mainnet'
        ? 'https://soroban-rpc.stellar.org'
        : 'https://soroban-testnet.stellar.org';
        
      const server = new rpc.Server(rpcUrl);
      const contract = new Contract(CONTRACT_ID);

      try {
        const dummyAccount = new Account(cleanAddress, "0");

        // 1. Fetch Allocations
        const allocationsTx = new TransactionBuilder(dummyAccount, {
          fee: BASE_FEE,
          networkPassphrase: network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET,
        })
          .addOperation(
            contract.call("get_allocations", new Address(cleanAddress).toScVal())
          )
          .setTimeout(180)
          .build();

        const allocSim = await server.simulateTransaction(allocationsTx);
        if (!allocSim.error && allocSim.result?.retval) {
          const nativeAllocations = scValToNative(allocSim.result.retval);
          if (Array.isArray(nativeAllocations) && nativeAllocations.length > 0) {
            const mappedAllocations = nativeAllocations.map((a, idx) => {
              const label = a.label;
              const pct = Number(a.percent);
              
              const standardItems = {
                'SSS': { color: '#ff9f1c', iconName: 'ShieldAlert' },
                'Philhealth': { color: '#00f5d4', iconName: 'Heart' },
                'Pag-IBIG': { color: '#3a86ff', iconName: 'Home' },
                'Income Tax Return': { color: '#ff0055', iconName: 'Zap' },
                'Bills & Utilities': { color: '#9d4edd', iconName: 'RefreshCw' },
                'Spendable Cash': { color: '#ff007f', iconName: 'Coins' }
              };
              
              const standard = standardItems[label];
              return {
                id: standard ? label.toLowerCase().replace(/[^a-z]/g, '') : `custom_${idx}_${Date.now()}`,
                label,
                pct,
                color: standard ? standard.color : customColors[idx % customColors.length],
                iconName: standard ? standard.iconName : 'Coins',
                isCustom: !standard
              };
            });
            setAllocations(mappedAllocations);
          }
        }

        // 2. Fetch Bucket Balances
        const bucketsTx = new TransactionBuilder(dummyAccount, {
          fee: BASE_FEE,
          networkPassphrase: network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET,
        })
          .addOperation(
            contract.call("get_buckets", new Address(cleanAddress).toScVal())
          )
          .setTimeout(180)
          .build();

        const bucketsSim = await server.simulateTransaction(bucketsTx);
        if (!bucketsSim.error && bucketsSim.result?.retval) {
          const nativeBuckets = scValToNative(bucketsSim.result.retval);
          const parsedBuckets = {};
          if (nativeBuckets && typeof nativeBuckets === 'object') {
            if (nativeBuckets instanceof Map) {
              nativeBuckets.forEach((val, key) => {
                parsedBuckets[key] = Number(val) / 10000000;
              });
            } else {
              Object.keys(nativeBuckets).forEach(k => {
                parsedBuckets[k] = Number(nativeBuckets[k]) / 10000000;
              });
            }
          }
          setContractBuckets(parsedBuckets);
        } else {
          setContractBuckets({});
        }

      } catch (err) {
        console.error("Error fetching Soroban data:", err);
      } finally {
        setIsFetchingContractData(false);
      }
    };

    fetchContractData();
  }, [walletAddress, network, isSandboxMode, reloadCounter]);

  // Fetch Live Chronological Transaction Payments Feed
  useEffect(() => {
    const fetchHistory = async () => {
      const cleanAddress = walletAddress.trim();
      if (!cleanAddress || cleanAddress.length < 30 || isSandboxMode) return;

      setIsLoadingHistory(true);
      const horizonUrl = network === 'mainnet'
        ? `https://horizon.stellar.org/accounts/${cleanAddress}/payments?limit=10&order=desc`
        : `https://horizon-testnet.stellar.org/accounts/${cleanAddress}/payments?limit=10&order=desc`;

      try {
        const response = await fetch(horizonUrl);
        if (response.ok) {
          const data = await response.json();
          if (data._embedded && Array.isArray(data._embedded.records)) {
            setTransactions(data._embedded.records);
          } else {
            setTransactions([]);
          }
        } else {
          setTransactions([]);
        }
      } catch (e) {
        console.error("Failed to fetch payments history:", e);
        setTransactions([]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [walletAddress, network, reloadCounter]);

  // Fetch smart invoices list
  useEffect(() => {
    fetchInvoices();
    fetchClientInvoices();
  }, [walletAddress, network, isSandboxMode, reloadCounter]);

  // Clamp budgetAmount in sandbox mode when balances.usdc changes
  useEffect(() => {
    if (isSandboxMode && budgetAmount > balances.usdc) {
      setBudgetAmount(balances.usdc);
    }
  }, [balances.usdc, isSandboxMode, budgetAmount]);

  // Calculate sum of micro-allocations
  const totalAllocationPct = allocations.reduce((sum, item) => sum + item.pct, 0);

  // Auto-balance Allocations to equal 100%
  const handleAutoBalance = () => {
    const total = allocations.reduce((sum, item) => sum + item.pct, 0);
    if (total === 0) {
      const equalShare = Math.floor(100 / allocations.length);
      const updated = allocations.map((item, idx) => ({
        ...item,
        pct: idx === allocations.length - 1 ? 100 - equalShare * (allocations.length - 1) : equalShare
      }));
      setAllocations(updated);
    } else {
      let runningSum = 0;
      const updated = allocations.map((item, idx) => {
        if (idx === allocations.length - 1) {
          return {
            ...item,
            pct: Math.max(0, 100 - runningSum)
          };
        }
        const scaled = Math.round((item.pct / total) * 100);
        runningSum += scaled;
        return {
          ...item,
          pct: scaled
        };
      });
      setAllocations(updated);
    }
  };

  // Update a single micro-allocation percentage
  const handleAllocationChange = (id, value) => {
    const val = parseInt(value, 10) || 0;
    setAllocations(prev => prev.map(item => item.id === id ? { ...item, pct: val } : item));
  };

  // Trigger transfer (simulated or real depending on sandbox state)
  const handleTransferSubmit = (e) => {
    e.preventDefault();
    const cleanRecipient = transferRecipient.trim();
    if (!cleanRecipient || !transferAmount || Number(transferAmount) <= 0) return;
    
    const amount = Number(transferAmount);
    if (transferAsset === 'USDC' && amount > balances.usdc) {
      alert("Insufficient USDC balance.");
      return;
    }
    if (transferAsset === 'XLM' && amount > balances.xlm) {
      alert("Insufficient XLM balance.");
      return;
    }

    if (isSandboxMode) {
      setIsSimulatingTransfer(true);
      setTransferLogs([]);

      const logs = [
        { text: '⏳ Initiating Stellar Sandbox Wallet request...', type: 'info' },
        { text: `🔑 Connection detected for Sandbox Wallet`, type: 'stellar' },
        { text: `🛰️ Resolving destination trustlines for ${transferAsset}...`, type: 'info' },
        { text: '📜 Constructing Stellar transaction sequence object...', type: 'info' },
        { text: `💸 Operation: Payment of ${amount} ${transferAsset} to ${cleanRecipient.slice(0, 6)}...${cleanRecipient.slice(-6)}`, type: 'info' },
        { text: '🎉 LEDGER CONFIRMED! Sequence verified.', type: 'success' },
        { text: `💰 Debit transaction processed successfully!`, type: 'success' }
      ];

      let currentLogIndex = 0;
      const interval = setInterval(() => {
        if (currentLogIndex < logs.length) {
          setTransferLogs(prev => [...prev, logs[currentLogIndex]]);
          currentLogIndex++;
        } else {
          clearInterval(interval);
          setIsSimulatingTransfer(false);
          
          const hash = Math.random().toString(16).substring(2, 10) + '8f4b00de' + Math.random().toString(16).substring(2, 10) + 'e';
          setLastTxHash(hash);

          // Deduct from local balances
          setBalances(prev => {
            const newUsdc = transferAsset === 'USDC' ? Math.max(0, prev.usdc - amount) : prev.usdc;
            const newXlm = transferAsset === 'XLM' ? Math.max(0, prev.xlm - amount) : prev.xlm;
            return {
              xlm: newXlm,
              usdc: newUsdc,
              php: newUsdc > 0 ? newUsdc * 57 : newXlm * 0.11 * 57
            };
          });

          // Add a mock transaction record to the history stream at the top
          const newRecord = {
            id: Math.random().toString(),
            type: 'payment',
            amount: amount.toFixed(7),
            asset_type: transferAsset === 'XLM' ? 'native' : 'credit_alphanum4',
            asset_code: transferAsset === 'USDC' ? 'USDC' : undefined,
            from: walletAddress,
            to: cleanRecipient,
            created_at: new Date().toISOString(),
            transaction_hash: hash
          };
          setTransactions(prev => [newRecord, ...prev]);

          // Reset transfer input fields
          setTransferAmount('');
          setTransferRecipient('');
          setShowTransferSuccess(true);
        }
      }, 450);
    } else {
      // Real mode: Build, sign, and submit via Horizon and Freighter
      setIsSimulatingTransfer(true);
      setTransferLogs([
        { text: '⏳ Initiating Stellar Freighter Wallet request...', type: 'info' },
        { text: `🔑 Connection detected for: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-6)}`, type: 'stellar' },
        { text: '🛰️ Aligning network settings with Freighter configuration...', type: 'info' }
      ]);

      (async () => {
        try {
          // Query Freighter's active network setting dynamically to align our build phase
          let activeNetwork = network;
          try {
            const netRes = await getNetwork();
            if (netRes && !netRes.error && netRes.network) {
              activeNetwork = netRes.network.toLowerCase() === 'public' ? 'mainnet' : 'testnet';
              if (activeNetwork !== network) {
                setNetwork(activeNetwork);
              }
            }
          } catch (e) {
            console.warn("Could not retrieve Freighter network:", e);
          }

          setTransferLogs(prev => [
            ...prev,
            { text: `🛰️ Connecting to Horizon ${activeNetwork.toUpperCase()} ledger...`, type: 'info' }
          ]);

          const horizonUrl = activeNetwork === 'mainnet'
            ? 'https://horizon.stellar.org'
            : 'https://horizon-testnet.stellar.org';
          const server = new Horizon.Server(horizonUrl);
          const passphrase = activeNetwork === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

          setTransferLogs(prev => [...prev, { text: '🛰️ Fetching current account sequence from Horizon...', type: 'info' }]);
          const account = await server.loadAccount(walletAddress);

          setTransferLogs(prev => [...prev, { text: `🛰️ Resolving destination trustlines for ${transferAsset}...`, type: 'info' }]);
          
          const issuer = activeNetwork === 'mainnet'
            ? 'GB38ZRP7HVN77WCM7TR2QEI6AQSF2PJPEHUGEB474TRW5O3W27QI2EPE'
            : 'GBBD47IF6LWK7P7KTUWFGISYZUX5OLKRI7IGTZT2BKEC72GWISPF2TOW';

          const asset = transferAsset === 'XLM'
            ? Asset.native()
            : new Asset('USDC', issuer);

          setTransferLogs(prev => [...prev, { text: '📜 Constructing Stellar transaction sequence object...', type: 'info' }]);
          const tx = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: passphrase,
          })
            .addOperation(
              Operation.payment({
                destination: cleanRecipient,
                asset: asset,
                amount: amount.toString()
              })
            )
            .setTimeout(180)
            .build();

          const txXdr = tx.toEnvelope().toXDR('base64');

          setTransferLogs(prev => [...prev, { text: '🖊️ Requesting cryptographic signature via Freighter...', type: 'stellar' }]);
          const signRes = await signTransaction(txXdr, {
            networkPassphrase: passphrase
          });

          if (signRes.error) {
            throw new Error(`Signing failed: ${signRes.error.message || JSON.stringify(signRes.error)}`);
          }
          const signedTxXdr = typeof signRes === 'string' ? signRes : (signRes.signedTxXdr || signRes.result || signRes);

          setTransferLogs(prev => [...prev, { text: '🚀 Submitting signed transaction XDR payload to Stellar Horizon node...', type: 'stellar' }]);
          const response = await server.submitTransaction(
            TransactionBuilder.fromXDR(signedTxXdr, passphrase)
          );

          setTransferLogs(prev => [...prev, { text: '🎉 LEDGER CONFIRMED! Sequence verified.', type: 'success' }]);
          setLastTxHash(response.hash);

          // Reset transfer input fields
          setTransferAmount('');
          setTransferRecipient('');
          setShowTransferSuccess(true);

          // Force-refresh balances
          triggerReloadData();
        } catch (err) {
          console.error("Transfer error:", err);
          setTransferLogs(prev => [...prev, { text: `❌ Error: ${err.message || JSON.stringify(err)}`, type: 'error' }]);
        } finally {
          setIsSimulatingTransfer(false);
        }
      })();
    }
  };

  // Handle landing connection submit (manual fallback)
  const handleConnectSubmit = (e) => {
    e.preventDefault();
    const addr = walletInputVal.trim();
    if (!addr) {
      setLandingError('Please enter a Stellar public address.');
      return;
    }
    try {
      Keypair.fromPublicKey(addr);
    } catch (err) {
      setLandingError('Invalid Stellar address. Public keys must be 56 characters and cryptographically valid.');
      return;
    }
    setLandingError('');
    setWalletAddress(addr);
  };

  // Handle connection via Freighter Wallet extension
  const handleConnectFreighter = async () => {
    setLandingError('');
    try {
      const conn = await isConnected();
      if (!conn || !conn.isConnected) {
        setLandingError('Freighter wallet extension not detected. Please install Freighter.');
        return;
      }
      
      // Request access (prompts user for permission automatically)
      const accessRes = await requestAccess();
      if (!accessRes || accessRes.error || !accessRes.address) {
        const errorMsg = accessRes?.error?.message || accessRes?.error || 'Access request denied. Please check your Freighter extension.';
        setLandingError(typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg);
        return;
      }
      
      const address = accessRes.address;
      
      // Query freighter's active network setting and sync it
      try {
        const netRes = await getNetwork();
        if (netRes && !netRes.error && netRes.network) {
          setNetwork(netRes.network.toLowerCase() === 'public' ? 'mainnet' : 'testnet');
        }
      } catch (netErr) {
        console.warn("Failed to retrieve network setting from Freighter:", netErr);
      }

      setLandingError('');
      setWalletAddress(address);
      setWalletInputVal(address);
    } catch (err) {
      setLandingError(err.message || 'Failed to connect via Freighter.');
    }
  };

  // Handle sandbox launch with simulated data and editable controls
  const handleSandboxLaunch = () => {
    setLandingError('');
    setIsSandboxMode(true);
    setWalletAddress('SANDBOX_WALLET');
    setBalances({
      xlm: 1250.50,
      usdc: 850.00,
      php: 850.00 * 57
    });
    setBudgetAmount(350.00);
    setTransactions([
      {
        id: 'sb_tx_1',
        type: 'payment',
        amount: '125.0000000',
        asset_type: 'credit_alphanum4',
        asset_code: 'USDC',
        from: 'GCSANDBOXRECIPIENT11234567890',
        to: 'SANDBOX_WALLET',
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
        transaction_hash: '5f9b8c7d6a5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c'
      },
      {
        id: 'sb_tx_2',
        type: 'payment',
        amount: '45.0000000',
        asset_type: 'native',
        from: 'SANDBOX_WALLET',
        to: 'GCSANDBOXRECIPIENT22345678901',
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
        transaction_hash: 'e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8'
      },
      {
        id: 'sb_tx_3',
        type: 'create_account',
        starting_balance: '1000.0000000',
        funder: 'GCSANDBOXSPONSOR99999999999',
        account: 'SANDBOX_WALLET',
        created_at: new Date(Date.now() - 3600000 * 48).toISOString(), // 2 days ago
        transaction_hash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'
      }
    ]);
  };

  // Connect Account Layout
  if (!walletAddress) {
    return (
      <div className="landing-container">
        <div className="landing-card">
          <div className="landing-brand">
            <div className="landing-logo-container" style={{ background: 'transparent', boxShadow: 'none' }}>
              <img src={kwageeLogo} alt="Kwagee Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <h1 className="landing-title">Kwagee</h1>
            <div className="landing-subtitle">On-Chain Self-Budgeting</div>
          </div>
          
          <p className="landing-description">
            Kwagee bridges Stellar's high-speed payment rails with automated, smart split-budgeting for global remote freelancers. Route your remote stablecoin payroll instantly to savings, taxes, bills, and welfare.
          </p>

          <form onSubmit={handleConnectSubmit} className="landing-form">
            <div className="landing-input-group">
              <input 
                type="text"
                placeholder="Paste your Stellar Public Address (starts with G)"
                value={walletInputVal}
                onChange={(e) => setWalletInputVal(e.target.value)}
                className="landing-input"
              />
              <select
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
                className="landing-select"
              >
                <option value="testnet">Testnet</option>
                <option value="mainnet">Mainnet</option>
              </select>
            </div>

            {landingError && (
              <div className="validation-warning" style={{ width: '100%', justifyContent: 'center', marginBottom: '10px' }}>
                <ShieldAlert size={16} />
                <span>{landingError}</span>
              </div>
            )}

            <button type="submit" className="landing-btn-submit" style={{ marginBottom: '12px', background: 'linear-gradient(135deg, var(--purple-dim), var(--primary-glow))' }}>
              <Send size={18} />
              <span>Access with Public Address</span>
            </button>

            <button type="button" onClick={handleConnectFreighter} className="landing-btn-submit">
              <Wallet size={18} />
              <span>Connect Freighter Wallet</span>
            </button>
          </form>

          <div className="landing-divider">OR</div>

          <div className="landing-sandbox-box" onClick={handleSandboxLaunch}>
            <div className="landing-sandbox-title">
              <Sparkles size={16} />
              <span>Launch with Sandbox Wallet</span>
            </div>
            <p className="landing-sandbox-desc">
              Instantly launch a local visual sandbox profile to test out and custom configure the budgeting allocator.
            </p>
          </div>
        </div>
      </div>
    );   



    
  }

  // Active Tab Rendering Logic
  return (
    <div className="app-container">
      {/* HEADER SECTION */}
      <header className="app-header">
        <div className="logo-section">
          <div className="logo-icon-container" style={{ background: 'transparent', boxShadow: 'none' }}>
            <img src={kwageeLogo} alt="Kwagee Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div className="logo-text">Kwagee</div>
            <div className="logo-sub">Owl You Need!</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Network Selection Selector */}
          {!isSandboxMode && (
            <select 
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              style={{
                background: 'rgba(157, 78, 221, 0.12)',
                border: '1px solid var(--border-light)',
                color: 'var(--purple-light)',
                borderRadius: '12px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 700,
                fontFamily: 'var(--font-outfit)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="testnet" style={{ background: '#0b071a' }}>Testnet</option>
              <option value="mainnet" style={{ background: '#0b071a' }}>Mainnet</option>
            </select>
          )}

          {isSandboxMode ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div 
                className="wallet-badge" 
                style={{
                  cursor: 'default',
                  borderColor: 'rgba(157, 78, 221, 0.4)',
                  background: 'linear-gradient(135deg, rgba(157, 78, 221, 0.15) 0%, rgba(10, 6, 22, 0.6) 100%)',
                  boxShadow: '0 0 10px rgba(157, 78, 221, 0.2)'
                }}
              >
                <div className="wallet-dot" style={{ backgroundColor: '#9d4edd', boxShadow: '0 0 8px #9d4edd' }}></div>
                <span className="wallet-address" style={{ color: 'var(--purple-light)', fontWeight: 800 }}>
                  SANDBOX MODE ACTIVE
                </span>
              </div>
              
              <button 
                onClick={() => {
                  setWalletAddress('');
                  setWalletInputVal('');
                  setBalances({ xlm: 0, usdc: 0, php: 0 });
                  setTransactions([]);
                  setBudgetAmount(0);
                  setIsSandboxMode(false);
                }}
                title="Exit Sandbox"
                style={{
                  background: 'rgba(255, 0, 85, 0.1)',
                  border: '1px solid rgba(255, 0, 85, 0.25)',
                  color: '#ff0055',
                  borderRadius: '12px',
                  width: '34px',
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 0, 85, 0.2)';
                  e.currentTarget.style.borderColor = '#ff0055';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 0, 85, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 0, 85, 0.25)';
                }}
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : isEditingWallet ? (
            <div className="wallet-badge-edit" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="text"
                value={walletInputVal}
                onChange={(e) => setWalletInputVal(e.target.value)}
                onBlur={() => {
                  const addr = walletInputVal.trim();
                  if (addr) {
                    try {
                      Keypair.fromPublicKey(addr);
                      setWalletAddress(addr);
                    } catch (err) {
                      alert('Invalid Stellar address. Public keys must be 56 characters and cryptographically valid.');
                    }
                  }
                  setIsEditingWallet(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const addr = walletInputVal.trim();
                    if (addr) {
                      try {
                        Keypair.fromPublicKey(addr);
                        setWalletAddress(addr);
                      } catch (err) {
                        alert('Invalid Stellar address. Public keys must be 56 characters and cryptographically valid.');
                      }
                    }
                    setIsEditingWallet(false);
                  }
                }}
                placeholder="Paste G... address"
                className="form-input"
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  width: '180px',
                  background: 'rgba(10, 6, 22, 0.8)',
                  border: '1px solid var(--primary-glow)',
                  color: '#fff',
                  borderRadius: '8px',
                }}
                autoFocus
              />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div 
                className="wallet-badge" 
                onClick={() => { 
                  setIsEditingWallet(true); 
                  setWalletInputVal(walletAddress); 
                }} 
                title="Click to edit public address"
              >
                <div className="wallet-dot" style={{ backgroundColor: isLoadingBalance ? '#a020f0' : (balanceError ? '#ff9f1c' : '#00f5d4') }}></div>
                <span className="wallet-address">
                  Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-6)}
                </span>
              </div>
              
              <button 
                onClick={() => {
                  setWalletAddress('');
                  setWalletInputVal('');
                  setBalances({ xlm: 0, usdc: 0, php: 0 });
                  setTransactions([]);
                  setBudgetAmount(0);
                  setIsSandboxMode(false);
                }}
                title="Disconnect Wallet"
                style={{
                  background: 'rgba(255, 0, 85, 0.1)',
                  border: '1px solid rgba(255, 0, 85, 0.25)',
                  color: '#ff0055',
                  borderRadius: '12px',
                  width: '34px',
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 0, 85, 0.2)';
                  e.currentTarget.style.borderColor = '#ff0055';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 0, 85, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 0, 85, 0.25)';
                }}
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* THREE TABS NAV SELECTOR */}
      <div style={{
        display: 'flex',
        background: 'var(--panel-bg)',
        border: '1px solid var(--border-light)',
        padding: '4px',
        borderRadius: '18px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
      }}>
        <button 
          onClick={() => setActiveTab('savings')}
          style={{
            flex: 1,
            background: activeTab === 'savings' ? 'linear-gradient(135deg, var(--purple-dim), var(--primary-glow))' : 'transparent',
            border: 'none',
            color: activeTab === 'savings' ? '#fff' : 'var(--text-secondary)',
            padding: '12px',
            borderRadius: '14px',
            fontFamily: 'var(--font-outfit)',
            fontWeight: 700,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'var(--transition-smooth)'
          }}
        >
          <Lock size={16} />
          <span>🏦 Savings Vault</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('budgeting')}
          style={{
            flex: 1,
            background: activeTab === 'budgeting' ? 'linear-gradient(135deg, var(--purple-dim), var(--primary-glow))' : 'transparent',
            border: 'none',
            color: activeTab === 'budgeting' ? '#fff' : 'var(--text-secondary)',
            padding: '12px',
            borderRadius: '14px',
            fontFamily: 'var(--font-outfit)',
            fontWeight: 700,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'var(--transition-smooth)'
          }}
        >
          <PiggyBank size={16} />
          <span>🧾 Budget Allocator</span>
        </button>

        <button 
          onClick={() => setActiveTab('transfer')}
          style={{
            flex: 1,
            background: activeTab === 'transfer' ? 'linear-gradient(135deg, var(--purple-dim), var(--primary-glow))' : 'transparent',
            border: 'none',
            color: activeTab === 'transfer' ? '#fff' : 'var(--text-secondary)',
            padding: '12px',
            borderRadius: '14px',
            fontFamily: 'var(--font-outfit)',
            fontWeight: 700,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'var(--transition-smooth)'
          }}
        >
          <Send size={16} />
          <span>💸 Transfer & History</span>
        </button>
      </div>

      {/* DASHBOARD CONTENT BODY */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: activeTab === 'transfer' ? '1fr 1.2fr' : '1.3fr 1fr' }}>
        
        {/* ==================== TAB 1: SAVINGS VAULT ==================== */}
        {activeTab === 'savings' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="panel-title">
                <Lock size={22} style={{ color: 'var(--success-color)' }} />
                <span>Secure Personal Savings Vault {isSandboxMode ? '(Direct Sandbox Balance)' : '(Direct Address Balance)'}</span>
              </div>

              {!isSandboxMode && balanceError && (
                <div className="validation-warning" style={{ border: '1px solid rgba(255, 159, 28, 0.3)' }}>
                  <ShieldAlert size={16} />
                  <span style={{ fontSize: '11px' }}>{balanceError}</span>
                  {network === 'testnet' && (
                    <button 
                      onClick={async () => {
                        setIsLoadingBalance(true);
                        try {
                          const res = await fetch(`https://friendbot.stellar.org/?addr=${walletAddress.trim()}`);
                          if (res.ok) {
                            setWalletAddress(prev => prev + ' ');
                            setTimeout(() => {
                              setWalletAddress(prev => prev.trim());
                            }, 50);
                          }
                        } catch (e) {
                          setBalanceError('Friendbot connection failed.');
                        } finally {
                          setIsLoadingBalance(false);
                        }
                      }}
                      style={{
                        marginLeft: 'auto',
                        background: 'var(--success-color)',
                        border: 'none',
                        color: '#06040d',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 800
                      }}
                    >
                      {isLoadingBalance ? 'Funding...' : 'Fund 10,000 XLM'}
                    </button>
                  )}
                </div>
              )}

              <div style={{
                background: 'rgba(10, 6, 22, 0.5)',
                border: '1px solid var(--border-light)',
                borderRadius: '24px',
                padding: '40px 24px',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-40px',
                  right: '-40px',
                  width: '160px',
                  height: '160px',
                  background: 'radial-gradient(circle, rgba(0, 245, 212, 0.08) 0%, transparent 70%)',
                  pointerEvents: 'none'
                }}></div>

                <div style={{
                  width: '64px',
                  height: '64px',
                  background: 'rgba(0, 245, 212, 0.08)',
                  border: '1px solid rgba(0, 245, 212, 0.25)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  color: 'var(--success-color)',
                  boxShadow: '0 0 15px rgba(0, 245, 212, 0.15)'
                }}>
                  <Lock size={32} />
                </div>

                <h3 style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '1px' }}>
                  Aggregate Account Balance
                </h3>
                <h1 style={{ fontSize: '48px', fontWeight: 800, color: '#fff', margin: '8px 0 4px' }}>
                  ${balances.usdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                </h1>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--success-color)' }}>
                  ₱{balances.php.toLocaleString(undefined, { maximumFractionDigits: 0 })} PHP Value
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-dim)', marginTop: '8px' }}>
                  {balances.xlm.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM (Native Asset)
                </div>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '16px',
                padding: '20px',
                fontSize: '13px',
                lineHeight: '1.6',
                color: 'var(--text-secondary)'
              }}>
                <strong style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <ShieldAlert size={16} className="text-success-color" />
                  Untouchable Base Rule
                </strong>
                The aggregate balance displayed above corresponds strictly to your {isSandboxMode ? 'customized sandbox wallet balances' : 'live, on-chain public address holdings'}. The Kwagee dashboard treats this core value as safe and untouched from daily spend obligations until you explicitly choose to allocate an amount to budget.
              </div>
            </div>

            {/* On-Chain Split Buckets (Soroban) */}
            {!isSandboxMode && (
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <PiggyBank size={22} style={{ color: 'var(--purple-light)' }} />
                    <span>On-Chain Split Buckets (Soroban Contract)</span>
                  </div>
                  {isFetchingContractData && <RefreshCw size={14} className="animate-spin text-purple-light" />}
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  Your current allocated balances held securely within the Soroban self-budgeting smart contract. You can withdraw from any bucket back to your main wallet address at any time.
                </p>

                {contractBuckets === null ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
                    <span>Querying smart contract buckets...</span>
                  </div>
                ) : Object.keys(contractBuckets).length === 0 ? (
                  <div style={{
                    padding: '30px',
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.01)',
                    borderRadius: '16px',
                    border: '1px dashed var(--border-light)',
                    color: 'var(--text-dim)'
                  }}>
                    No active bucket allocations found on-chain. Sync your allocations in the <strong>Budget Allocator</strong> tab to initialize your smart contract buckets.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {Object.entries(contractBuckets).map(([label, amt]) => {
                      const standardColors = {
                        'SSS': '#ff9f1c',
                        'Philhealth': '#00f5d4',
                        'Pag-IBIG': '#3a86ff',
                        'Income Tax Return': '#ff0055',
                        'Bills & Utilities': '#9d4edd',
                        'Spendable Cash': '#ff007f'
                      };
                      const color = standardColors[label] || '#9d4edd';
                      const amtPhp = amt * 57;

                      return (
                        <div key={label} style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid var(--border-light)',
                          borderRadius: '16px',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          position: 'relative'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color }}></div>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{label}</span>
                            </div>
                            <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>USDC Allocated</span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <div>
                              <div style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>
                                ${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--success-color)', fontWeight: 600 }}>
                                ₱{amtPhp.toLocaleString(undefined, { maximumFractionDigits: 0 })} PHP
                              </div>
                            </div>

                            {withdrawingBucket === label ? (
                              <div style={{
                                background: 'rgba(10, 6, 22, 0.95)',
                                border: '1px solid var(--primary-glow)',
                                borderRadius: '12px',
                                padding: '8px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                justifyContent: 'center',
                                zIndex: 10
                              }}>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#fff', textAlign: 'center' }}>Withdraw amount from {label}</div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <input 
                                    type="number"
                                    step="any"
                                    placeholder="Amount USDC"
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    style={{
                                      flex: 1,
                                      background: 'rgba(255,255,255,0.05)',
                                      border: '1px solid var(--border-light)',
                                      color: '#fff',
                                      borderRadius: '6px',
                                      padding: '4px 8px',
                                      fontSize: '11px',
                                      outline: 'none',
                                      fontFamily: 'var(--font-outfit)'
                                    }}
                                  />
                                  <button
                                    onClick={() => handleWithdrawSubmit(label, withdrawAmount)}
                                    disabled={isWithdrawing}
                                    style={{
                                      background: 'var(--purple-light)',
                                      border: 'none',
                                      color: '#fff',
                                      borderRadius: '6px',
                                      padding: '4px 10px',
                                      fontSize: '10px',
                                      fontWeight: 800,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {isWithdrawing ? '...' : 'OK'}
                                  </button>
                                </div>
                                <button
                                  onClick={() => {
                                    setWithdrawingBucket(null);
                                    setWithdrawAmount('');
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    fontSize: '9px',
                                    cursor: 'pointer',
                                    textDecoration: 'underline'
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setWithdrawingBucket(label);
                                  setWithdrawAmount('');
                                }}
                                disabled={amt <= 0}
                                style={{
                                  background: amt > 0 ? 'rgba(157, 78, 221, 0.12)' : 'rgba(255,255,255,0.01)',
                                  border: `1px solid ${amt > 0 ? 'rgba(157, 78, 221, 0.25)' : 'rgba(255,255,255,0.03)'}`,
                                  color: amt > 0 ? 'var(--purple-light)' : 'var(--text-dim)',
                                  borderRadius: '8px',
                                  padding: '4px 10px',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  cursor: amt > 0 ? 'pointer' : 'default',
                                  transition: 'all 0.2s ease',
                                  fontFamily: 'var(--font-outfit)'
                                }}
                                onMouseEnter={(e) => {
                                  if (amt > 0) {
                                    e.currentTarget.style.background = 'rgba(157, 78, 221, 0.2)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (amt > 0) {
                                    e.currentTarget.style.background = 'rgba(157, 78, 221, 0.12)';
                                  }
                                }}
                              >
                                Withdraw
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Withdraw log panel */}
                {withdrawLogs.length > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--purple-light)', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Soroban RPC Withdraw Console</span>
                      {isWithdrawing && <RefreshCw size={8} className="animate-spin" />}
                    </div>
                    
                    <div className="stellar-live-logger" style={{ maxHeight: '120px' }}>
                      {withdrawLogs.map((log, index) => (
                        <div key={index} className={`log-entry ${log.type}`}>
                          <ChevronRight size={10} style={{ marginTop: '3px', flexShrink: 0 }} />
                          <span>{log.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

            {isSandboxMode ? (
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="panel-title">
                  <Sparkles size={20} className="text-purple-accent" />
                  <span>Sandbox Wallet Editor</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Configure your local simulated sandbox balances. All figures will instantly reflect across your vault calculations, budget allocations, and visual transfer limitations.
                  </p>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>
                      Simulated USDC Balance (USD)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <input 
                        type="number"
                        min="0"
                        step="any"
                        value={balances.usdc}
                        onChange={(e) => {
                          const newUsdc = Math.max(0, parseFloat(e.target.value) || 0);
                          setBalances(prev => ({
                            ...prev,
                            usdc: newUsdc,
                            php: newUsdc * 57
                          }));
                        }}
                        className="form-input"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border-light)',
                          color: '#fff',
                          borderRadius: '12px',
                          padding: '10px 14px',
                          fontSize: '14px',
                          fontWeight: 700,
                          fontFamily: 'var(--font-outfit)',
                          flex: 1
                        }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--purple-light)' }}>USDC</span>
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>
                      Simulated XLM Balance
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <input 
                        type="number"
                        min="0"
                        step="any"
                        value={balances.xlm}
                        onChange={(e) => {
                          const newXlm = Math.max(0, parseFloat(e.target.value) || 0);
                          setBalances(prev => ({
                            ...prev,
                            xlm: newXlm
                          }));
                        }}
                        className="form-input"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border-light)',
                          color: '#fff',
                          borderRadius: '12px',
                          padding: '10px 14px',
                          fontSize: '14px',
                          fontWeight: 700,
                          fontFamily: 'var(--font-outfit)',
                          flex: 1
                        }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--success-color)' }}>XLM</span>
                    </div>
                  </div>

                  <div style={{ 
                    background: 'rgba(157, 78, 221, 0.05)', 
                    border: '1px solid rgba(157, 78, 221, 0.15)', 
                    padding: '12px', 
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    marginTop: '6px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Simulated PHP Value:</span>
                      <span style={{ color: 'var(--success-color)', fontWeight: 700 }}>
                        ₱{(balances.usdc * 57).toLocaleString(undefined, { maximumFractionDigits: 0 })} PHP
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Off-Ramp Conversion Rate:</span>
                      <span>1 USDC ≈ 57.00 PHP</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="panel-title">
                  <Wallet size={20} className="text-purple-accent" />
                  <span>Stellar Address Information</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '14px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Connected Public Key
                    </span>
                    <div style={{ 
                      fontFamily: 'monospace', 
                      fontSize: '12px', 
                      color: '#fff', 
                      wordBreak: 'break-all', 
                      marginTop: '6px',
                      background: 'rgba(255,255,255,0.03)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      {walletAddress}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 8px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Horizon Ledger Node:</span>
                    <span style={{ color: 'var(--purple-light)', fontWeight: 600 }}>
                      {network === 'mainnet' ? 'Stellar Horizon (Mainnet)' : 'Stellar Horizon (Testnet)'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 8px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Off-Ramp Rate:</span>
                    <span style={{ color: 'var(--success-color)', fontWeight: 700 }}>
                      1 USDC ≈ 57.00 PHP
                    </span>
                  </div>

                  {network === 'testnet' && (
                    <button 
                      onClick={async () => {
                        setIsLoadingBalance(true);
                        try {
                          const res = await fetch(`https://friendbot.stellar.org/?addr=${walletAddress.trim()}`);
                          if (res.ok) {
                            alert("Account successfully funded with 10,000 testnet XLM!");
                            // Trigger reload by slightly changing state
                            setWalletAddress(prev => prev + ' ');
                            setTimeout(() => setWalletAddress(prev => prev.trim()), 50);
                          } else {
                            alert("Friendbot rate limited or failed. Try again in a minute.");
                          }
                        } catch (e) {
                          alert("Friendbot funding failed.");
                        } finally {
                          setIsLoadingBalance(false);
                        }
                      }}
                      disabled={isLoadingBalance}
                      className="btn-primary"
                      style={{ marginTop: '10px' }}
                    >
                      <RefreshCw size={14} className={isLoadingBalance ? "animate-spin" : ""} />
                      <span>{isLoadingBalance ? "Requesting..." : "Get 10,000 Testnet XLM (Friendbot)"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ==================== TAB 2: BUDGET ALLOCATOR ==================== */}
        {activeTab === 'budgeting' && (
          <>
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="panel-title">
                <PiggyBank size={22} className="text-purple-accent" />
                <span>Allocate Balance to Smart Splits</span>
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Input the specific amount of your actual USDC wallet balance you wish to budget. The remainder will remain strictly isolated as untouched Savings.
              </p>

              {/* Set budget amount controller */}
              <div style={{
                background: 'rgba(10, 6, 22, 0.4)',
                border: '1px solid var(--border-light)',
                borderRadius: '18px',
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                flexWrap: 'wrap'
              }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                    Choose Budget Amount (USDC)
                  </label>
                  <input 
                    type="range"
                    min="0"
                    max={isSandboxMode ? balances.usdc : (balances.usdc > 0 ? Math.max(balances.usdc, budgetAmount) : 1000)}
                    value={budgetAmount}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBudgetAmount(isSandboxMode ? Math.min(val, balances.usdc) : val);
                    }}
                    style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', outline: 'none', borderRadius: '3px', cursor: 'pointer' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="number"
                    min="0"
                    max={isSandboxMode ? balances.usdc : undefined}
                    value={budgetAmount}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBudgetAmount(isSandboxMode ? Math.min(val, balances.usdc) : val);
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-light)',
                      color: '#fff',
                      borderRadius: '8px',
                      padding: '8px',
                      width: '90px',
                      fontSize: '14px',
                      fontWeight: 700,
                      textAlign: 'center',
                      fontFamily: 'var(--font-outfit)'
                    }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--purple-light)' }}>USDC</span>
                </div>
              </div>

              {isSandboxMode && balances.usdc === 0 && (
                <div className="validation-warning" style={{ border: '1px solid rgba(157, 78, 221, 0.3)', background: 'rgba(157, 78, 221, 0.05)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} style={{ color: 'var(--purple-light)' }} />
                  <span>Your Sandbox USDC balance is <strong>$0</strong>. Go to the 🏦 <strong>Savings Vault</strong> tab to set your sandbox funds.</span>
                </div>
              )}

              {/* Side-by-Side Bucket Displays */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{
                  background: 'linear-gradient(135deg, rgba(0, 245, 212, 0.05) 0%, rgba(10, 6, 22, 0.6) 100%)',
                  border: '1px solid rgba(0, 245, 212, 0.2)',
                  borderRadius: '16px',
                  padding: '16px',
                  position: 'relative'
                }}>
                  <div style={{ position: 'absolute', top: '12px', right: '12px', color: 'var(--success-color)' }}>
                    <Lock size={16} />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                    🏦 Savings Bucket
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#fff', margin: '4px 0' }}>
                    ${Math.max(0, balances.usdc - budgetAmount).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--success-color)', fontWeight: 600 }}>
                    ₱{(Math.max(0, balances.usdc - budgetAmount) * 57).toLocaleString(undefined, { maximumFractionDigits: 0 })} PHP
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>
                    Strictly Untouchable
                  </div>
                </div>

                <div style={{
                  background: 'linear-gradient(135deg, rgba(157, 78, 221, 0.08) 0%, rgba(10, 6, 22, 0.6) 100%)',
                  border: '1px solid rgba(157, 78, 221, 0.25)',
                  borderRadius: '16px',
                  padding: '16px',
                  position: 'relative'
                }}>
                  <div style={{ position: 'absolute', top: '12px', right: '12px', color: 'var(--purple-accent)' }}>
                    <Zap size={16} />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                    🧾 Budgets Bucket
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#fff', margin: '4px 0' }}>
                    ${budgetAmount.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--purple-light)', fontWeight: 600 }}>
                    ₱{(budgetAmount * 57).toLocaleString(undefined, { maximumFractionDigits: 0 })} PHP
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>
                    Active Allocated Portion
                  </div>
                </div>
              </div>

              {/* Sliders Panel */}
              <div className="sliders-panel" style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--purple-light)', marginBottom: '4px' }}>
                  Micro-Allocations Split (Obligations)
                </div>

                {allocations.map((item) => {
                  const IconComp = iconMap[item.iconName] || Coins;
                  return (
                    <div key={item.id} className={`slider-group ${item.id}`}>
                      <div className="slider-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="slider-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                          <IconComp size={16} style={{ color: item.color, flexShrink: 0 }} />
                          {editingId === item.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                style={{
                                  padding: '2px 6px',
                                  fontSize: '12px',
                                  background: 'rgba(10, 6, 22, 0.8)',
                                  border: '1px solid var(--purple-light)',
                                  color: '#fff',
                                  borderRadius: '6px',
                                  width: '140px',
                                  outline: 'none',
                                  fontFamily: 'var(--font-outfit)'
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    if (editingName.trim()) {
                                      setAllocations(prev => prev.map(a => a.id === item.id ? { ...a, label: editingName.trim() } : a));
                                      setEditingId(null);
                                    }
                                  }
                                }}
                                autoFocus
                              />
                              <button
                                onClick={() => {
                                  if (editingName.trim()) {
                                    setAllocations(prev => prev.map(a => a.id === item.id ? { ...a, label: editingName.trim() } : a));
                                    setEditingId(null);
                                  }
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--success-color)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  padding: '2px'
                                }}
                              >
                                <Check size={14} />
                              </button>
                            </div>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{item.label}</span>
                              {item.isCustom && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
                                  <button
                                    onClick={() => {
                                      setEditingId(item.id);
                                      setEditingName(item.label);
                                    }}
                                    title="Rename"
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: 'var(--text-dim)',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      padding: '2px',
                                      transition: 'color 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
                                  >
                                    <Edit2 size={11} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setAllocations(prev => prev.filter(a => a.id !== item.id));
                                    }}
                                    title="Delete"
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: 'var(--text-dim)',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      padding: '2px',
                                      transition: 'color 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = '#ff0055'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                        <span className="slider-pct" style={{ color: item.color, fontWeight: 700, minWidth: '40px', textAlign: 'right' }}>
                          {item.pct}%
                        </span>
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="100"
                        value={item.pct}
                        className="custom-range"
                        onChange={(e) => handleAllocationChange(item.id, e.target.value)}
                      />
                    </div>
                  );
                })}

                {/* Add Custom Allocation Form / Button */}
                {!showAddForm ? (
                  <button
                    onClick={() => {
                      setShowAddForm(true);
                      setNewAllocName('');
                      setNewAllocPct(10);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(157, 78, 221, 0.1)',
                      border: '1px dashed rgba(157, 78, 221, 0.3)',
                      color: 'var(--purple-light)',
                      padding: '8px 14px',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      marginTop: '12px',
                      width: '100%',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      fontFamily: 'var(--font-outfit)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(157, 78, 221, 0.2)';
                      e.currentTarget.style.borderColor = 'rgba(157, 78, 221, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(157, 78, 221, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(157, 78, 221, 0.3)';
                    }}
                  >
                    <Plus size={14} />
                    <span>Add Custom Allocation</span>
                  </button>
                ) : (
                  <div style={{
                    background: 'rgba(10, 6, 22, 0.5)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '12px',
                    padding: '12px',
                    marginTop: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--purple-light)' }}>
                      New Custom Allocation
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        placeholder="Allocation Name (e.g. Vacation)"
                        value={newAllocName}
                        onChange={(e) => setNewAllocName(e.target.value)}
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border-light)',
                          color: '#fff',
                          borderRadius: '8px',
                          padding: '6px 10px',
                          fontSize: '12px',
                          flex: 2,
                          minWidth: '130px',
                          outline: 'none',
                          fontFamily: 'var(--font-outfit)'
                        }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: '80px' }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="%"
                          value={newAllocPct}
                          onChange={(e) => setNewAllocPct(Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--border-light)',
                            color: '#fff',
                            borderRadius: '8px',
                            padding: '6px',
                            fontSize: '12px',
                            width: '45px',
                            textAlign: 'center',
                            outline: 'none',
                            fontFamily: 'var(--font-outfit)'
                          }}
                        />
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>%</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setShowAddForm(false)}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'var(--text-secondary)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-outfit)'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          const name = newAllocName.trim();
                          if (!name) {
                            alert('Please enter a name for the custom allocation.');
                            return;
                          }
                          const color = customColors[allocations.length % customColors.length];
                          const newAlloc = {
                            id: 'custom_' + Date.now(),
                            label: name,
                            pct: newAllocPct,
                            color: color,
                            iconName: 'Coins',
                            isCustom: true
                          };
                          setAllocations(prev => [...prev, newAlloc]);
                          setShowAddForm(false);
                        }}
                        style={{
                          background: 'var(--purple-light)',
                          border: 'none',
                          color: '#fff',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-outfit)'
                        }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}

                {/* Validation Indicator */}
                {totalAllocationPct !== 100 ? (
                  <div className="validation-warning" style={{ marginTop: '10px' }}>
                    <ShieldAlert size={16} />
                    <span>Allocations sum to <strong>{totalAllocationPct}%</strong>. Must equal 100%.</span>
                    <button 
                      onClick={handleAutoBalance}
                      style={{
                        marginLeft: 'auto',
                        background: 'rgba(255, 159, 28, 0.2)',
                        border: 'none',
                        color: 'var(--warning-color)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 700,
                        fontFamily: 'var(--font-outfit)'
                      }}
                    >
                      Auto-Balance
                    </button>
                  </div>
                ) : (
                  <div className="validation-ok" style={{ marginTop: '10px' }}>
                    <CheckCircle size={16} />
                    <span>Micro-allocation rules balanced perfectly! (100%)</span>
                  </div>
                )}

                {/* Sync to Soroban Smart Contract */}
                {!isSandboxMode && totalAllocationPct === 100 && (
                  <div style={{
                    marginTop: '20px',
                    padding: '20px',
                    background: 'linear-gradient(135deg, rgba(157, 78, 221, 0.05) 0%, rgba(10, 6, 22, 0.4) 100%)',
                    border: '1px solid rgba(157, 78, 221, 0.2)',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sparkles size={14} style={{ color: 'var(--purple-light)' }} />
                        <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#fff' }}>Soroban Contract Sync</span>
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Contract Ready</span>
                    </div>

                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                      Sync your micro-allocation percentages to the self-budgeting smart contract. Your next stablecoin salary receipt will be automatically split on-chain.
                    </p>

                    <button
                      onClick={handleSyncAllocations}
                      disabled={isSyncingAllocations}
                      className="btn-primary"
                      style={{
                        background: 'linear-gradient(135deg, #a020f0 0%, #9d4edd 100%)',
                        border: '1px solid rgba(157, 78, 221, 0.4)',
                        boxShadow: '0 0 15px rgba(157, 78, 221, 0.3)',
                        padding: '10px',
                        fontWeight: 800,
                        fontSize: '12px',
                        margin: 0
                      }}
                    >
                      <RefreshCw size={14} className={isSyncingAllocations ? "animate-spin" : ""} />
                      <span>{isSyncingAllocations ? 'Syncing to Soroban...' : 'Sync Allocations to Soroban Contract'}</span>
                    </button>

                    {/* Sync Success Display */}
                    {showSyncSuccess && (
                      <div style={{
                        background: 'rgba(0, 245, 212, 0.08)',
                        border: '1px solid rgba(0, 245, 212, 0.25)',
                        borderRadius: '12px',
                        padding: '10px',
                        fontSize: '10px',
                        color: 'var(--success-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle size={12} />
                          <span>On-Chain Sync Successful!</span>
                        </div>
                        <div style={{ wordBreak: 'break-all', fontFamily: 'monospace', opacity: 0.8 }}>
                          Tx: {syncTxHash}
                        </div>
                      </div>
                    )}

                    {/* Sync logs console */}
                    {syncLogs.length > 0 && (
                      <div>
                        <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--purple-light)', marginBottom: '6px' }}>
                          Stellar Ledger Sync Logs
                        </div>
                        <div className="stellar-live-logger" style={{ maxHeight: '120px' }}>
                          {syncLogs.map((log, index) => (
                            <div key={index} className={`log-entry ${log.type}`}>
                              <ChevronRight size={10} style={{ marginTop: '3px', flexShrink: 0 }} />
                              <span>{log.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Concentric Rings Visualizer */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="panel-title">
                <Calculator size={20} className="text-purple-accent" />
                <span>Micro-Split Rings Model</span>
              </div>

              <div className="allocation-chart-panel" style={{ border: 'none', background: 'transparent', padding: 0 }}>
                <div className="chart-visual" style={{ width: '200px', height: '200px' }}>
                  <svg width="100%" height="100%" viewBox="0 0 160 160">
                    {/* Dynamic Concentric Rings */}
                    {allocations.slice(0, 8).map((item, index) => {
                      const maxRings = Math.max(allocations.slice(0, 8).length, 6);
                      const ringWidth = Math.min(8, 48 / maxRings);
                      const r = 72 - index * (ringWidth + 2.2);
                      const circ = 2 * Math.PI * r;
                      const strokeDashoffset = circ - (circ * Math.max(0, Math.min(100, item.pct))) / 100;
                      return (
                        <g key={item.id}>
                          {/* Background ring for track */}
                          <circle 
                            cx="80" 
                            cy="80" 
                            r={r} 
                            fill="none" 
                            stroke="rgba(255,255,255,0.02)" 
                            strokeWidth={ringWidth} 
                          />
                          {/* Active ring */}
                          <circle 
                            cx="80" 
                            cy="80" 
                            r={r} 
                            fill="none" 
                            stroke={item.color} 
                            strokeWidth={ringWidth} 
                            strokeDasharray={circ}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            transform="rotate(-90 80 80)"
                            style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
                          />
                        </g>
                      );
                    })}
                  </svg>
 
                  <div className="chart-center-info">
                    <div className="chart-center-val">${budgetAmount}</div>
                    <div className="chart-center-lbl">Active Budget</div>
                  </div>
                </div>
 
                <div className="chart-details-list">
                  {allocations.map((item) => {
                    const valUsd = (budgetAmount * item.pct) / 100;
                    const valPhp = valUsd * 57;
                    return (
                      <div key={item.id} className="chart-detail-item">
                        <span className="chart-detail-label">
                          <div className="color-indicator" style={{ backgroundColor: item.color }}></div>
                          {item.label} ({item.pct}%)
                        </span>
                        <div className="chart-detail-values">
                          <span className="chart-detail-val-usd">${valUsd.toFixed(2)} USDC</span>
                          <span className="chart-detail-val-php">₱{valPhp.toLocaleString(undefined, {maximumFractionDigits: 0})} PHP</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ==================== TAB 3: TRANSFER & HISTORY ==================== */}
        {activeTab === 'transfer' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* XLM / USDC Transfer Form */}
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="panel-title">
                <Send size={22} className="text-purple-accent" />
                <span>Submit Stellar Transfer</span>
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Transfer XLM or USDC instantly to any Stellar address. Supports simulated cryptographic Freighter signature pipelines.
              </p>

              <form onSubmit={handleTransferSubmit} className="invoice-form" style={{ margin: 0 }}>
                <div className="form-group">
                  <label>Recipient Public Address</label>
                  <input 
                    type="text" 
                    value={transferRecipient}
                    onChange={(e) => setTransferRecipient(e.target.value)}
                    placeholder="e.g. GB28... or GC2W..."
                    className="form-input"
                    style={{ fontFamily: 'monospace', fontSize: '12px' }}
                    required
                  />
                </div>

                <div className="input-row">
                  <div className="form-group">
                    <label>Select Asset</label>
                    <select
                      value={transferAsset}
                      onChange={(e) => setTransferAsset(e.target.value)}
                      className="form-input"
                      style={{ background: 'rgba(10, 6, 22, 0.6)', cursor: 'pointer' }}
                    >
                      <option value="XLM">XLM (Stellar Native)</option>
                      <option value="USDC">USDC (Stablecoin)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Amount</label>
                    <input 
                      type="number"
                      step="any"
                      min="0.0001"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="Amount to send"
                      className="form-input"
                      required
                    />
                  </div>
                </div>

                <button type="submit" disabled={isSimulatingTransfer} className="btn-primary" style={{ marginTop: '8px' }}>
                  <Send size={16} />
                  <span>{isSimulatingTransfer ? 'Simulating Freighter Request...' : `Send ${transferAsset}`}</span>
                </button>
              </form>

              {/* simulated logs panel */}
              {(isSimulatingTransfer || transferLogs.length > 0) && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--purple-light)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Stellar Ledger Node Console</span>
                    {isSimulatingTransfer && <RefreshCw size={10} className="animate-spin" />}
                  </div>
                  
                  <div className="stellar-live-logger" style={{ maxHeight: '200px' }}>
                    {transferLogs.map((log, index) => (
                      <div key={index} className={`log-entry ${log.type}`}>
                        <ChevronRight size={10} style={{ marginTop: '3px', flexShrink: 0 }} />
                        <span>{log.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Create Soroban Smart Invoice Form */}
            {!isSandboxMode && (
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="panel-title">
                  <Plus size={22} className="text-purple-accent" />
                  <span>Create Soroban Smart Invoice</span>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                  Bill your client directly through the self-budgeting smart contract. When paid, funds will be auto-split according to your on-chain allocations.
                </p>

                <form onSubmit={handleCreateInvoice} className="invoice-form" style={{ margin: 0 }}>
                  <div className="form-group">
                    <label>Client Stellar Address (Payer)</label>
                    <input 
                      type="text" 
                      value={invoiceClientAddress}
                      onChange={(e) => setInvoiceClientAddress(e.target.value)}
                      placeholder="e.g. GB28... or GC2W..."
                      className="form-input"
                      style={{ fontFamily: 'monospace', fontSize: '12px' }}
                      required
                    />
                  </div>

                  <div className="input-row">
                    <div className="form-group">
                      <label>Amount (USDC)</label>
                      <input 
                        type="number"
                        step="any"
                        min="0.01"
                        value={invoiceAmountUsdc}
                        onChange={(e) => setInvoiceAmountUsdc(e.target.value)}
                        placeholder="e.g. 500"
                        className="form-input"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Description</label>
                      <input 
                        type="text" 
                        value={invoiceDescription}
                        onChange={(e) => setInvoiceDescription(e.target.value)}
                        placeholder="e.g. Monthly Retainer"
                        className="form-input"
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={isCreatingInvoice} className="btn-primary" style={{ marginTop: '8px' }}>
                    <Plus size={16} />
                    <span>{isCreatingInvoice ? 'Creating Invoice...' : 'Create Smart Invoice'}</span>
                  </button>
                </form>

                {/* Invoice Creation Logs */}
                {invoiceLogs.length > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--purple-light)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Invoice Creation Console</span>
                      {isCreatingInvoice && <RefreshCw size={10} className="animate-spin" />}
                    </div>
                    <div className="stellar-live-logger" style={{ maxHeight: '150px' }}>
                      {invoiceLogs.map((log, index) => (
                        <div key={index} className={`log-entry ${log.type}`}>
                          <ChevronRight size={10} style={{ marginTop: '3px', flexShrink: 0 }} />
                          <span>{log.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Pay & List Soroban Smart Invoices */}
            {!isSandboxMode && (
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Coins size={22} className="text-purple-accent" />
                    <span>Soroban Smart Invoices</span>
                  </div>
                  {isLoadingInvoices && <RefreshCw size={14} className="animate-spin text-purple-light" />}
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                  Manage, track, and pay active freelance smart contract invoices directly. Paying an invoice automatically splits the USDC amount among the worker's allocations.
                </p>

                {/* Quick Pay Invoice Form */}
                <div style={{
                  background: 'rgba(10, 6, 22, 0.4)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '16px',
                  padding: '16px'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--purple-light)', marginBottom: '8px' }}>
                    Quick Pay Invoice
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="number"
                      placeholder="Enter Invoice ID"
                      value={invoiceIdToPay}
                      onChange={(e) => setInvoiceIdToPay(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border-light)',
                        color: '#fff',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '13px',
                        outline: 'none',
                        fontFamily: 'var(--font-outfit)'
                      }}
                    />
                    <button
                      onClick={() => handlePayInvoice(invoiceIdToPay)}
                      disabled={isPayingInvoice || !invoiceIdToPay}
                      className="btn-primary"
                      style={{ padding: '8px 16px', fontSize: '12px', margin: 0 }}
                    >
                      {isPayingInvoice ? 'Paying...' : 'Pay Invoice'}
                    </button>
                  </div>

                  {payInvoiceLogs.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <div className="stellar-live-logger" style={{ maxHeight: '120px' }}>
                        {payInvoiceLogs.map((log, index) => (
                          <div key={index} className={`log-entry ${log.type}`}>
                            <ChevronRight size={10} style={{ marginTop: '3px', flexShrink: 0 }} />
                            <span>{log.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Invoice Feed Tabs */}
                <div>
                  {/* Tab Header */}
                  <div style={{
                    display: 'flex',
                    gap: '0',
                    marginBottom: '14px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '12px',
                    padding: '4px',
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}>
                    <button
                      onClick={() => setInvoiceFeedTab('incoming')}
                      style={{
                        flex: 1,
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-outfit)',
                        fontWeight: 800,
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        transition: 'all 0.2s',
                        background: invoiceFeedTab === 'incoming'
                          ? 'linear-gradient(135deg, rgba(0,245,212,0.18) 0%, rgba(0,196,167,0.10) 100%)'
                          : 'transparent',
                        color: invoiceFeedTab === 'incoming' ? '#00f5d4' : 'var(--text-dim)',
                        boxShadow: invoiceFeedTab === 'incoming' ? '0 0 12px rgba(0,245,212,0.15)' : 'none',
                        borderBottom: invoiceFeedTab === 'incoming' ? '2px solid #00f5d4' : '2px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <ArrowDownLeft size={13} />
                      Incoming
                      {clientInvoices.length > 0 && (
                        <span style={{
                          background: invoiceFeedTab === 'incoming' ? '#00f5d4' : 'rgba(255,255,255,0.15)',
                          color: invoiceFeedTab === 'incoming' ? '#06040d' : 'var(--text-secondary)',
                          borderRadius: '10px',
                          padding: '1px 6px',
                          fontSize: '10px',
                          fontWeight: 800,
                          minWidth: '18px',
                          textAlign: 'center'
                        }}>
                          {clientInvoices.filter(i => resolveStatus(i.status) === 'Unpaid').length || clientInvoices.length}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setInvoiceFeedTab('sent')}
                      style={{
                        flex: 1,
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-outfit)',
                        fontWeight: 800,
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        transition: 'all 0.2s',
                        background: invoiceFeedTab === 'sent'
                          ? 'linear-gradient(135deg, rgba(157,78,221,0.18) 0%, rgba(160,32,240,0.10) 100%)'
                          : 'transparent',
                        color: invoiceFeedTab === 'sent' ? 'var(--purple-light)' : 'var(--text-dim)',
                        boxShadow: invoiceFeedTab === 'sent' ? '0 0 12px rgba(157,78,221,0.15)' : 'none',
                        borderBottom: invoiceFeedTab === 'sent' ? '2px solid var(--purple-accent)' : '2px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <ArrowUpRight size={13} />
                      Sent / Billed
                      {workerInvoices.length > 0 && (
                        <span style={{
                          background: invoiceFeedTab === 'sent' ? 'var(--purple-accent)' : 'rgba(255,255,255,0.15)',
                          color: invoiceFeedTab === 'sent' ? '#fff' : 'var(--text-secondary)',
                          borderRadius: '10px',
                          padding: '1px 6px',
                          fontSize: '10px',
                          fontWeight: 800,
                          minWidth: '18px',
                          textAlign: 'center'
                        }}>
                          {workerInvoices.length}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* INCOMING (Client) Invoices Panel */}
                  {invoiceFeedTab === 'incoming' && (
                    <div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        marginBottom: '10px', paddingBottom: '8px',
                        borderBottom: '1px solid rgba(0,245,212,0.12)'
                      }}>
                        <div style={{
                          width: '6px', height: '6px', borderRadius: '50%',
                          background: '#00f5d4',
                          boxShadow: '0 0 6px #00f5d4'
                        }} />
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#00f5d4', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Invoices Assigned to You
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', marginLeft: 'auto' }}>
                          You are the payer
                        </span>
                      </div>
                      {clientInvoices.length === 0 ? (
                        <div style={{
                          padding: '28px 12px', textAlign: 'center',
                          background: 'rgba(0,245,212,0.02)',
                          borderRadius: '12px',
                          border: '1px dashed rgba(0,245,212,0.15)',
                          color: 'var(--text-dim)', fontSize: '12px'
                        }}>
                          <ArrowDownLeft size={24} style={{ color: 'rgba(0,245,212,0.25)', marginBottom: '8px' }} />
                          <div>No incoming invoices found.</div>
                          <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.7 }}>Invoices billed to your address will appear here.</div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                          {clientInvoices.map((inv) => {
                            const sc = getStatusConfig(inv.status);
                            const isUnpaid = sc.label === 'Unpaid';
                            const isPaid = sc.label === 'Paid';
                            const isPending = sc.label === 'Pending';
                            return (
                              <div key={inv.id} style={{
                                background: isUnpaid
                                  ? 'linear-gradient(135deg, rgba(0,245,212,0.04) 0%, rgba(10,6,22,0.7) 100%)'
                                  : sc.cardBg,
                                border: `1px solid ${isUnpaid ? 'rgba(0,245,212,0.2)' : sc.border}`,
                                borderLeft: `4px solid ${isUnpaid ? '#00f5d4' : sc.borderLeft}`,
                                borderRadius: '14px', padding: '14px',
                                display: 'flex', flexDirection: 'column', gap: '10px',
                                opacity: isPaid ? 0.7 : 1, transition: 'opacity 0.2s'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <span style={{
                                      fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em',
                                      color: isPaid ? 'var(--text-secondary)' : '#fff',
                                      textDecoration: isPaid ? 'line-through' : 'none'
                                    }}>INVOICE #{inv.id}</span>
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                                      padding: '3px 8px', borderRadius: '20px', fontSize: '9px', fontWeight: 800,
                                      background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                                      width: 'fit-content'
                                    }}>
                                      {isPaid && <CheckCircle size={8} />}
                                      {isPending && <RefreshCw size={8} />}
                                      {isUnpaid && <Zap size={8} />}
                                      {sc.label}
                                    </span>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '18px', fontWeight: 800, color: isPaid ? sc.color : '#fff' }}>
                                      ${inv.amountUsdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <div style={{ fontSize: '9px', color: '#00f5d4', fontWeight: 700 }}>USDC</div>
                                  </div>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                  {inv.description}
                                </div>
                                <div style={{
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  fontSize: '10px', color: 'var(--text-dim)',
                                  borderTop: `1px solid ${isUnpaid ? 'rgba(0,245,212,0.12)' : sc.border}`, paddingTop: '8px'
                                }}>
                                  <span style={{ fontFamily: 'monospace' }}>
                                    Worker: {inv.worker.slice(0,6)}...{inv.worker.slice(-6)}
                                  </span>
                                  {isUnpaid && (
                                    <button
                                      onClick={() => handlePayInvoice(inv.id)}
                                      disabled={isPayingInvoice}
                                      style={{
                                        background: 'linear-gradient(135deg, #00f5d4 0%, #00c4a7 100%)',
                                        border: 'none', color: '#06040d',
                                        padding: '7px 16px', borderRadius: '8px',
                                        fontWeight: 800, cursor: 'pointer', fontSize: '12px',
                                        fontFamily: 'var(--font-outfit)',
                                        display: 'flex', alignItems: 'center', gap: '5px',
                                        boxShadow: '0 2px 10px rgba(0,245,212,0.35)',
                                        opacity: isPayingInvoice ? 0.6 : 1
                                      }}
                                    >
                                      <Zap size={13} />
                                      Pay Now
                                    </button>
                                  )}
                                  {isPending && (
                                    <span style={{
                                      display: 'flex', alignItems: 'center', gap: '4px',
                                      fontSize: '10px', fontWeight: 700, color: sc.color,
                                      background: sc.bg, padding: '4px 10px', borderRadius: '6px'
                                    }}>
                                      <RefreshCw size={10} />
                                      Processing...
                                    </span>
                                  )}
                                  {isPaid && (
                                    <span style={{
                                      display: 'flex', alignItems: 'center', gap: '4px',
                                      fontSize: '10px', fontWeight: 700, color: sc.color,
                                      background: sc.bg, padding: '4px 10px', borderRadius: '6px'
                                    }}>
                                      <CheckCircle size={10} />
                                      Payment Sent
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SENT (Worker) Invoices Panel */}
                  {invoiceFeedTab === 'sent' && (
                    <div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        marginBottom: '10px', paddingBottom: '8px',
                        borderBottom: '1px solid rgba(157,78,221,0.15)'
                      }}>
                        <div style={{
                          width: '6px', height: '6px', borderRadius: '50%',
                          background: 'var(--purple-accent)',
                          boxShadow: '0 0 6px var(--purple-accent)'
                        }} />
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--purple-light)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Invoices You've Sent
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', marginLeft: 'auto' }}>
                          You are the worker
                        </span>
                      </div>
                      {workerInvoices.length === 0 ? (
                        <div style={{
                          padding: '28px 12px', textAlign: 'center',
                          background: 'rgba(157,78,221,0.02)',
                          borderRadius: '12px',
                          border: '1px dashed rgba(157,78,221,0.15)',
                          color: 'var(--text-dim)', fontSize: '12px'
                        }}>
                          <ArrowUpRight size={24} style={{ color: 'rgba(157,78,221,0.25)', marginBottom: '8px' }} />
                          <div>No sent invoices found.</div>
                          <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.7 }}>Invoices you create will appear here.</div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                          {workerInvoices.map((inv) => {
                            const sc = getStatusConfig(inv.status);
                            const isPaid = sc.label === 'Paid';
                            const isPending = sc.label === 'Pending';
                            const isUnpaid = sc.label === 'Unpaid';
                            return (
                              <div key={inv.id} style={{
                                background: 'linear-gradient(135deg, rgba(157,78,221,0.05) 0%, rgba(10,6,22,0.7) 100%)',
                                border: `1px solid rgba(157,78,221,0.2)`,
                                borderLeft: `4px solid var(--purple-accent)`,
                                borderRadius: '14px', padding: '14px',
                                display: 'flex', flexDirection: 'column', gap: '10px',
                                opacity: isPaid ? 0.7 : 1, transition: 'opacity 0.2s'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <span style={{
                                      fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em',
                                      color: isPaid ? 'var(--text-secondary)' : '#fff',
                                      textDecoration: isPaid ? 'line-through' : 'none'
                                    }}>INVOICE #{inv.id}</span>
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                                      padding: '3px 8px', borderRadius: '20px', fontSize: '9px', fontWeight: 800,
                                      background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                                      width: 'fit-content'
                                    }}>
                                      {isPaid && <CheckCircle size={8} />}
                                      {isPending && <RefreshCw size={8} />}
                                      {isUnpaid && <Zap size={8} />}
                                      {sc.label}
                                    </span>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '18px', fontWeight: 800, color: isPaid ? sc.color : '#fff' }}>
                                      ${inv.amountUsdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <div style={{ fontSize: '9px', color: 'var(--purple-light)', fontWeight: 700 }}>USDC</div>
                                  </div>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                  {inv.description}
                                </div>
                                <div style={{
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  fontSize: '10px', color: 'var(--text-dim)',
                                  borderTop: '1px solid rgba(157,78,221,0.15)', paddingTop: '8px'
                                }}>
                                  <span style={{ fontFamily: 'monospace' }}>
                                    Client: {inv.client.slice(0,6)}...{inv.client.slice(-6)}
                                  </span>
                                  {isPaid && (
                                    <span style={{
                                      display: 'flex', alignItems: 'center', gap: '4px',
                                      fontSize: '10px', fontWeight: 700, color: sc.color,
                                      background: sc.bg, padding: '4px 10px', borderRadius: '6px'
                                    }}>
                                      <CheckCircle size={10} />
                                      Payment Received
                                    </span>
                                  )}
                                  {isPending && (
                                    <span style={{
                                      display: 'flex', alignItems: 'center', gap: '4px',
                                      fontSize: '10px', fontWeight: 700, color: sc.color,
                                      background: sc.bg, padding: '4px 10px', borderRadius: '6px'
                                    }}>
                                      <RefreshCw size={10} />
                                      Awaiting Payment...
                                    </span>
                                  )}
                                  {isUnpaid && (
                                    <span style={{
                                      display: 'flex', alignItems: 'center', gap: '4px',
                                      fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)',
                                      background: 'rgba(255,255,255,0.04)', padding: '4px 10px', borderRadius: '6px',
                                      border: '1px solid rgba(255,255,255,0.06)'
                                    }}>
                                      <Zap size={10} />
                                      Pending Client
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Per-Account Transaction History from Horizon */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="panel-title">
                <History size={22} className="text-purple-accent" />
                <span>Horizon Payments Feed (Last 10)</span>
              </div>

              {isLoadingHistory ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '12px' }}>
                  <RefreshCw size={28} className="animate-spin text-purple-accent" />
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Querying Horizon ledger history...</span>
                </div>
              ) : transactions.length === 0 ? (
                <div style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.01)',
                  borderRadius: '16px',
                  border: '1px dashed var(--border-light)',
                  color: 'var(--text-secondary)'
                }}>
                  <History size={36} style={{ color: 'var(--text-dim)', margin: '0 auto 12px' }} />
                  <h4 style={{ color: '#fff', marginBottom: '4px' }}>No Transaction History</h4>
                  <p style={{ fontSize: '11px' }}>This account does not have any recent payment operations recorded on the {network.toUpperCase()} ledger.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '520px', paddingRight: '4px' }}>
                  {transactions.map((tx) => {
                    // Normalize transaction details depending on operation type
                    let isOutgoing = false;
                    let amountVal = 0;
                    let assetLabel = 'XLM';
                    let counterparty = '';
                    
                    if (tx.type === 'create_account') {
                      isOutgoing = tx.funder === walletAddress;
                      amountVal = parseFloat(tx.starting_balance) || 0;
                      assetLabel = 'XLM';
                      counterparty = isOutgoing ? tx.account : tx.funder;
                    } else if (tx.type === 'account_merge') {
                      isOutgoing = tx.account === walletAddress;
                      amountVal = parseFloat(tx.amount) || 0;
                      assetLabel = 'XLM';
                      counterparty = isOutgoing ? tx.into : tx.account;
                    } else {
                      // Standard payment, path_payment, etc.
                      isOutgoing = tx.from === walletAddress;
                      amountVal = parseFloat(tx.amount) || 0;
                      assetLabel = tx.asset_type === 'native' ? 'XLM' : (tx.asset_code || 'USDC');
                      counterparty = isOutgoing ? tx.to : tx.from;
                    }

                    const safeCounterparty = counterparty || '';
                    const displayCounterparty = safeCounterparty 
                      ? `${safeCounterparty.slice(0, 8)}...${safeCounterparty.slice(-8)}`
                      : 'Unknown Address';

                    const formattedDate = new Date(tx.created_at).toLocaleDateString() + ' ' + new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                      <div key={tx.id} style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                        borderLeft: `4px solid ${isOutgoing ? '#ff0055' : 'var(--success-color)'}`,
                        borderRadius: '14px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: isOutgoing ? 'rgba(255, 0, 85, 0.08)' : 'var(--success-bg)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isOutgoing ? '#ff0055' : 'var(--success-color)'
                            }}>
                              {isOutgoing ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                            </div>
                            <div>
                              <span style={{ fontSize: '12px', fontWeight: 800, color: '#fff', textTransform: 'uppercase' }}>
                                {tx.type === 'create_account'
                                  ? (isOutgoing ? 'Funded Account' : 'Account Created')
                                  : tx.type === 'account_merge'
                                    ? (isOutgoing ? 'Merged Account' : 'Account Merged')
                                    : (isOutgoing ? 'Sent Asset' : 'Received Asset')}
                              </span>
                              <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{formattedDate}</div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <span style={{ 
                              fontSize: '15px', 
                              fontWeight: 800, 
                              color: isOutgoing ? '#fff' : 'var(--success-color)' 
                            }}>
                              {isOutgoing ? '-' : '+'}{amountVal.toFixed(4)} {assetLabel}
                            </span>
                          </div>
                        </div>

                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          fontSize: '11px', 
                          background: 'rgba(0,0,0,0.15)',
                          padding: '6px 10px',
                          borderRadius: '8px'
                        }}>
                          <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                            {isOutgoing ? 'To: ' : 'From: '}{displayCounterparty}
                          </span>

                          {isSandboxMode ? (
                            <span style={{ color: 'var(--text-dim)', fontWeight: 700 }}>Sandbox Tx</span>
                          ) : (
                            <a 
                              href={`https://stellar.expert/explorer/${network === 'mainnet' ? 'public' : 'testnet'}/tx/${tx.transaction_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: 'var(--purple-accent)',
                                textDecoration: 'none',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px'
                              }}
                            >
                              <span>Explorer</span>
                              <ArrowUpRight size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>

      {/* TEAM CREDITS MODAL PANEL */}
      <footer className="team-credits-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Users size={18} className="text-purple-accent" />
          <span style={{ fontSize: '16px', fontWeight: 800 }}>Kwagee Builders Council</span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Leveraging Stellar's native financial rails to bring institutional payroll security entirely on-chain.
        </p>

        <div className="team-grid">
          <div className="team-member">
            <div className="team-member-name">Isidro, James Patrick</div>
            <div className="team-member-role">Stellar Integration Lead</div>
          </div>
          <div className="team-member">
            <div className="team-member-name">Hernandez, Harold Benedict</div>
            <div className="team-member-role">Project Manager</div>
          </div>
          <div className="team-member">
            <div className="team-member-name">Nuesca, Geena Mae</div>
            <div className="team-member-role">Frontend & UI Dev</div>
          </div>
          <div className="team-member">
            <div className="team-member-name">Tan, Migel</div>
            <div className="team-member-role">Product & Git Lead</div>
          </div>
          <div className="team-member">
            <div className="team-member-name">Villegas, Kezia Lorein</div>
            <div className="team-member-role">Smart Contract Lead</div>
          </div>
        </div>
      </footer>

      {/* SUCCESS OVERLAY FOR TRANSACTIONS */}
      {showTransferSuccess && (
        <div className="cascade-alert-overlay" style={{ borderColor: 'var(--success-color)' }}>
          <div className="cascade-title">
            <CheckCircle size={18} style={{ color: 'var(--success-color)' }} />
            <span>Stellar Transfer Complete!</span>
          </div>
          
          <div className="cascade-sub-text">
            Your asset transfer has been cryptographically signed and successfully validated on the Stellar blockchain network ledger.
          </div>

          <div style={{
            background: 'rgba(10, 6, 22, 0.5)',
            border: '1px solid var(--border-light)',
            borderRadius: '12px',
            padding: '12px',
            fontSize: '11px',
            textAlign: 'left'
          }}>
            <div style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
              Transaction Hash
            </div>
            <div style={{ 
              fontFamily: 'monospace', 
              color: '#fff', 
              wordBreak: 'break-all',
              background: 'rgba(255,255,255,0.03)',
              padding: '6px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              {lastTxHash}
            </div>
          </div>

          {isSandboxMode ? (
            <div style={{
              textAlign: 'center',
              padding: '12px',
              background: 'rgba(157, 78, 221, 0.1)',
              border: '1px solid rgba(157, 78, 221, 0.25)',
              borderRadius: '12px',
              color: 'var(--purple-light)',
              fontWeight: 700,
              fontSize: '13px'
            }}>
              Sandbox Transaction Recorded Visually
            </div>
          ) : (
            <a 
              href={`https://stellar.expert/explorer/${network === 'mainnet' ? 'public' : 'testnet'}/tx/${lastTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              style={{ textDecoration: 'none', padding: '10px' }}
            >
              <span>Verify on Stellar Expert</span>
              <ArrowUpRight size={14} />
            </a>
          )}

          <button 
            onClick={() => setShowTransferSuccess(false)}
            className="btn-close-overlay"
            style={{ width: '100%', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', padding: '10px', borderRadius: '12px', cursor: 'pointer', fontFamily: 'var(--font-outfit)', fontWeight: 700, fontSize: '13px' }}
          >
            Acknowledge & Continue
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
