import { CONFIG } from "./config.js";
import { validWallet } from "./core.js";
import { getWallets } from "./vendor/wallet-standard.js";
export function validateRPC(url, network) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new Error("Enter a complete HTTPS RPC URL.");
  }
  if (u.username || u.password || u.hash || u.search)
    throw new Error(
      "Use a public RPC endpoint without credentials, query keys, or fragments.",
    );
  if (
    u.protocol !== "https:" &&
    !(u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname))
  )
    throw new Error("Use HTTPS, or localhost for development.");
  if (!["mainnet-beta", "devnet", "testnet"].includes(network))
    throw new Error("Choose a Solana network.");
  return u.href;
}
export class PhantomWallet {
  constructor({
    host = globalThis.window,
    fetcher = (url, options) => globalThis.fetch(url, options),
    changed = () => {},
    settings = { rpcUrl: CONFIG.rpcUrl, network: CONFIG.network },
    timeout = CONFIG.walletTimeout,
  } = {}) {
    this.host = host;
    this.fetcher = fetcher;
    this.changed = changed;
    this.settings = settings;
    this.timeout = timeout;
    this.address = null;
    this.balance = null;
    this.balanceState = "idle";
    this.balanceAt = null;
    this.balanceError = null;
    this.provider = null;
    this.allowSession = false;
    this.generation = 0;
    this.balanceGeneration = 0;
    this.balanceAbort = null;
    this.connecting = false;
    this.rpcTimeout = CONFIG.rpcTimeout;
  }
  detect() {
    const p = this.host?.phantom?.solana || this.host?.solana;
    return p?.isPhantom ? p : null;
  }
  attach() {
    const p = this.detect();
    if (!p) return null;
    if (this.provider === p) return p;
    this.provider = p;
    p.on?.("connect", (key) => {
      if (this.provider !== p) return;
      if (this.allowSession && p.isConnected)
        this.setAddress((key || p.publicKey)?.toString());
    });
    p.on?.("disconnect", () => {
      if (this.provider !== p) return;
      this.allowSession = false;
      this.generation++;
      this.setAddress(null);
    });
    p.on?.("accountChanged", (key) => {
      if (this.provider !== p) return;
      this.generation++;
      if (this.allowSession && p.isConnected && key)
        this.setAddress(key.toString());
      else {
        this.allowSession = false;
        this.setAddress(null);
      }
    });
    return p;
  }
  setAddress(address) {
    address = validWallet(address) ? address : null;
    if (address === this.address) return;
    this.address = address;
    this.balance = null;
    this.balanceAt = null;
    this.balanceState = "idle";
    this.balanceAbort?.abort();
    this.balanceGeneration++;
    this.changed();
    if (address) void this.refreshBalance();
  }
  async connect(trusted = false) {
    const p = this.attach();
    if (!p)
      throw new Error(
        "No compatible wallet is available. Install a Solana wallet or open this site in its in-app browser.",
      );
    if (this.connecting)
      throw new Error("A wallet connection request is already open.");
    this.connecting = true;
    this.allowSession = true;
    const generation = ++this.generation;
    this.changed();
    let timer;
    try {
      const response = await Promise.race([
        p.connect(trusted ? { onlyIfTrusted: true } : undefined),
        new Promise((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  "Wallet connection timed out. Close the wallet prompt, then try again.",
                ),
              ),
            this.timeout,
          );
        }),
      ]);
      if (generation !== this.generation)
        throw new Error("Wallet account changed during connection. Try again.");
      if (!p.isConnected || !validWallet(response?.publicKey?.toString()))
        throw new Error(
          "The wallet did not return a connected Solana account.",
        );
      this.setAddress(response.publicKey.toString());
      return this.address;
    } catch (e) {
      if (generation === this.generation) {
        this.allowSession = false;
        this.setAddress(null);
      }
      if (e?.code === 4001)
        throw new Error(
          "Connection was declined. Your raffle input is still here.",
        );
      throw e;
    } finally {
      clearTimeout(timer);
      this.connecting = false;
      this.changed();
    }
  }
  async reconnect() {
    if (this.detect())
      try {
        await this.connect(true);
      } catch {
        /* Trusted reconnect never opens a prompt; disconnected is a normal state. */
      }
  }
  connected() {
    return Boolean(
      this.address &&
        this.provider?.isConnected &&
        this.provider.publicKey?.toString() === this.address &&
        this.allowSession,
    );
  }
  require() {
    if (!this.connected())
      throw new Error(
        "Your wallet disconnected or changed. Reconnect and try again.",
      );
    return this.address;
  }
  async disconnect() {
    this.allowSession = false;
    this.generation++;
    this.setAddress(null);
    try {
      await this.provider?.disconnect();
    } finally {
      this.changed();
    }
  }
  async refreshBalance() {
    if (!this.address) return;
    const address = this.address,
      version = ++this.balanceGeneration;
    this.balanceAbort?.abort();
    const controller = new AbortController();
    this.balanceAbort = controller;
    const timer = setTimeout(() => controller.abort(), this.rpcTimeout);
    this.balanceState = "loading";
    this.balance = null;
    this.balanceError = null;
    this.changed();
    try {
      const url = validateRPC(this.settings.rpcUrl, this.settings.network);
      const response = await this.fetcher(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getBalance",
          params: [address, { commitment: "confirmed" }],
        }),
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "RPC rate limited. Try later or choose another endpoint."
            : `RPC returned HTTP ${response.status}.`,
        );
      const data = await response.json();
      const n = data?.result?.value;
      if (data.error || !Number.isSafeInteger(n) || n < 0)
        throw new Error(
          "RPC balance is unavailable. Choose another endpoint or try later.",
        );
      if (version === this.balanceGeneration && address === this.address) {
        this.balance = n / 1e9;
        this.balanceState = "ready";
        this.balanceAt = Date.now();
      }
    } catch (e) {
      if (version === this.balanceGeneration && address === this.address) {
        this.balanceState = "error";
        this.balanceError =
          e.name === "AbortError"
            ? "RPC timed out. Try again or choose another endpoint."
            : e.message;
      }
    } finally {
      clearTimeout(timer);
      if (version === this.balanceGeneration) this.changed();
    }
  }
}

// Wallet Standard covers any registering Solana wallet; Phantom's legacy
// injection remains a fallback for older installations.
export class SolanaWallet extends PhantomWallet {
  constructor(options = {}) {
    super(options);
    this.registry =
      options.registry ||
      (this.host === globalThis.window && this.host?.addEventListener
        ? getWallets()
        : null);
    this.adapters = new Map();
    this.selected = null;
    this.name = "";
    this.lastName = "";
    try {
      this.lastName =
        this.host?.localStorage?.getItem("raffler:wallet-choice") || "";
    } catch {}
    this.registry?.on("register", () => {
      this.changed();
      if (!this.connecting && !this.address && this.lastName)
        void this.reconnect();
    });
    this.registry?.on("unregister", (...removed) => {
      if (removed.some((w) => this.selected?.wallet === w)) {
        this.allowSession = false;
        this.generation++;
        this.setAddress(null);
        this.selected = null;
        this.provider = null;
      }
      this.changed();
    });
  }
  available() {
    const list = (this.registry?.get() || [])
      .filter(
        (w) =>
          w.chains?.some((c) => c.startsWith("solana:")) &&
          typeof w.features?.["standard:connect"]?.connect === "function" &&
          typeof w.features?.["standard:events"]?.on === "function",
      )
      .map((w, i) => ({
        id: `standard:${w.name}:${i}`,
        name: w.name,
        wallet: w,
        standard: true,
      }));
    const p = super.detect();
    if (p && !list.some((w) => w.name.toLowerCase() === "phantom"))
      list.push({
        id: "legacy:phantom",
        name: "Phantom",
        provider: p,
        standard: false,
      });
    return list;
  }
  async select(id) {
    if (this.connecting)
      throw new Error("Wait for the current connection request to finish.");
    const item = this.available().find((w) => w.id === id);
    if (!item)
      throw new Error(
        "This wallet is no longer available. Refresh the wallet list.",
      );
    if (
      this.selected?.wallet !== item.wallet ||
      this.selected?.provider !== item.provider
    ) {
      if (this.connected()) await this.disconnect();
      this.provider = null;
      this.selected = item;
      this.name = item.name;
    }
    return this.connect();
  }
  detect() {
    if (!this.selected) return super.detect();
    if (!this.selected.standard) return this.selected.provider;
    const w = this.selected.wallet;
    if (!this.adapters.has(w)) this.adapters.set(w, standardAdapter(w));
    return this.adapters.get(w);
  }
  async connect(trusted = false) {
    if (!this.selected) {
      const list = this.available();
      const choice = list.find((w) => w.name === this.lastName) || list[0];
      if (choice) {
        this.selected = choice;
        this.name = choice.name;
      }
    }
    const address = await super.connect(trusted);
    this.lastName = this.name || "Phantom";
    try {
      this.host?.localStorage?.setItem("raffler:wallet-choice", this.lastName);
    } catch {}
    return address;
  }
  async reconnect() {
    const choice = this.available().find((w) => w.name === this.lastName);
    if (choice?.standard) {
      const account = solanaAccount(choice.wallet.accounts);
      // Authorized provider accounts, never the saved choice, establish state.
      if (!account) return;
      this.selected = choice;
      this.name = choice.name;
      const adapter = this.detect();
      adapter.activate();
      this.attach();
      this.allowSession = true;
      this.setAddress(account.address);
    } else {
      if (choice) {
        this.selected = choice;
        this.name = choice.name;
      }
      if (super.detect()) await super.reconnect();
    }
  }
}
function solanaAccount(accounts = []) {
  return accounts.find(
    (a) =>
      validWallet(a.address) && a.chains?.some((c) => c.startsWith("solana:")),
  );
}
function standardAdapter(w) {
  let active = false;
  const listeners = new Map();
  const adapter = {
    get isConnected() {
      return active && Boolean(solanaAccount(w.accounts));
    },
    get publicKey() {
      const a = solanaAccount(w.accounts);
      return a ? { toString: () => a.address } : null;
    },
    activate() {
      active = true;
    },
    on(name, callback) {
      listeners.set(name, callback);
    },
    async connect(options) {
      const result = await w.features["standard:connect"].connect({
        silent: Boolean(options?.onlyIfTrusted),
      });
      const account = solanaAccount(result.accounts);
      if (!account)
        throw new Error("This wallet returned no authorized Solana account.");
      active = true;
      return { publicKey: { toString: () => account.address } };
    },
    async disconnect() {
      active = false;
      listeners.get("disconnect")?.();
      await w.features["standard:disconnect"]?.disconnect();
    },
  };
  w.features["standard:events"].on("change", (properties) => {
    if (!active || !properties.accounts) return;
    const account = solanaAccount(properties.accounts);
    if (account)
      listeners.get("accountChanged")?.({ toString: () => account.address });
    else {
      active = false;
      listeners.get("disconnect")?.();
    }
  });
  return adapter;
}
