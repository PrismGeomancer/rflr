// Raffle model: validation, entries, draws, receipts and backups. Records live in the browser and never represent blockchain transactions.
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export const COLORS = ["#FFE135", "#FF3D82", "#2563EB", "#22C55E", "#FF6B2B"];
export function base58(bytes) {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let s = "";
  while (n) {
    s = ALPHABET[Number(n % 58n)] + s;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    s = "1" + s;
  }
  return s;
}
export function validWallet(s) {
  if (
    typeof s !== "string" ||
    s.length < 32 ||
    s.length > 44 ||
    !/^([1-9A-HJ-NP-Za-km-z]+)$/.test(s)
  )
    return false;
  let n = 0n;
  for (const c of s) n = n * 58n + BigInt(ALPHABET.indexOf(c));
  let bytes = 0;
  while (n) {
    n >>= 8n;
    bytes++;
  }
  return bytes + (s.match(/^1*/)?.[0].length || 0) === 32;
}
export function exampleWallet(seed) {
  const b = new Uint8Array(32);
  let n = (seed + 1) * 7919;
  for (let i = 0; i < 32; i++) {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    b[i] = n >>> 24;
  }
  return base58(b);
}
export const shortWallet = (s) =>
  s ? `${s.slice(0, 4)}…${s.slice(-4)}` : "Not connected";
export const totalEntries = (r) =>
  r.seedEntries + r.allocations.reduce((n, a) => n + a.count, 0);
export const ownEntries = (r, w) =>
  w
    ? r.allocations
        .filter((a) => a.wallet === w)
        .reduce((n, a) => n + a.count, 0)
    : 0;
export const walletCount = (r) =>
  r.seedWallets + new Set(r.allocations.map((a) => a.wallet)).size;
export const odds = (own, total) => (total ? (100 * own) / total : 0);
export const roundSOL = (n) => Math.round(n * 1e9) / 1e9;
export function status(r, now = Date.now()) {
  if (r.receipt) return "completed";
  if (
    r.closedAt ||
    totalEntries(r) >= r.maxEntries ||
    (r.endCondition === "timer" && now >= r.endsAt)
  )
    return "ready";
  return "active";
}
export function remaining(r, now = Date.now()) {
  if (status(r, now) !== "active")
    return status(r, now) === "completed" ? "Draw complete" : "Ready to draw";
  if (r.endCondition === "soldout")
    return `${r.maxEntries - totalEntries(r)} spots left`;
  const seconds = Math.max(0, Math.ceil((r.endsAt - now) / 1000));
  const d = Math.floor(seconds / 86400),
    h = Math.floor((seconds % 86400) / 3600),
    m = Math.floor((seconds % 3600) / 60),
    s = seconds % 60;
  return d
    ? `${d}d ${h}h left`
    : h
      ? `${h}h ${m}m left`
      : m
        ? `${m}m ${s}s left`
        : `${s}s left`;
}
const showcaseActive = [
  ["RFL-5A1C20", "Degen Sunday Pot", "Weekly pool for the Sunday crowd. One wallet takes the whole prize.", 5, 0.05, 143, 91, 250, 9.5, "SOL Social"],
  ["RFL-5A2D41", "Builders’ Lunch Fund", "A pool for the people shipping on Solana this month.", 2.5, 0.025, 58, 37, 100, 5.2, "Solana Builders"],
  ["RFL-5A3E62", "Moon Club Mega Pool", "Our biggest community pool yet. Fixed prize, clear odds.", 10, 0.1, 212, 140, 400, 20.8, "Moon Club"],
  ["RFL-5A4F83", "Pocket Pool #12", "Small entry, eighty spots, one winner.", 1.5, 0.01, 47, 30, 80, 3.1, "Pocket Pools"],
  ["RFL-5A50A4", "Validator Night Draw", "Evening draw for stakers and friends.", 4, 0.02, 96, 61, 150, 14.4, "Validator Club"],
];
const showcasePast = [
  ["Friday Night SOL", 3, 0.05, 120, "SOL Social"],
  ["Genesis Pot", 5, 0.05, 164, "Moon Club"],
  ["Builders’ Brunch", 2, 0.025, 88, "Solana Builders"],
  ["Weekend Wallet Club", 8, 0.1, 205, "Wallet Club"],
  ["Pocket Pool #11", 1, 0.01, 77, "Pocket Pools"],
];
export function prizeLabel(r) {
  return r.prizeType === "NFT"
    ? "1 NFT"
    : `${Number(r.prizeAmount).toLocaleString("en-US")} ${r.prizeSymbol}`;
}
function showcaseBase(i, o) {
  return {
    prizeType: "SOL",
    prizeSymbol: "SOL",
    maxPerWallet: 25,
    endCondition: "timer",
    color: COLORS[i % 5],
    allocations: [],
    local: false,
    prizeState: "seeded-simulated",
    image: null,
    closedAt: null,
    receipt: null,
    ...o,
  };
}
// Pre-filled pools that make a fresh install look lived-in. Added once and then saved with the rest.
export function showcaseRaffles(now = Date.now()) {
  const active = showcaseActive.map((a, i) =>
    showcaseBase(i, {
      id: a[0], title: a[1], description: a[2], prizeAmount: a[3], entryPrice: a[4],
      seedEntries: a[5], seedWallets: a[6], maxEntries: a[7],
      endsAt: now + a[8] * 3600000, createdAt: now - 86400000,
      creator: exampleWallet(i + 800), creatorName: a[9], seed: i + 301,
    }),
  );
  const done = showcasePast.map((a, i) => {
    const r = showcaseBase(i + 2, {
      id: `RFL-5B${(i + 1).toString(16).toUpperCase()}${(0x1c + i * 0x21).toString(16).toUpperCase().padStart(3, "0")}`.slice(0, 10),
      title: a[0], description: "A completed community pool. The draw receipt has the full result.",
      prizeAmount: a[1], entryPrice: a[2], seedEntries: a[3], seedWallets: Math.floor(a[3] * 0.64),
      maxEntries: a[3], endsAt: now - (i + 1) * 86400000 * 2, createdAt: now - (i + 1) * 86400000 * 2 - 86400000,
      creator: exampleWallet(i + 900), creatorName: a[4], seed: i + 401,
    });
    r.receipt = makeReceipt(r, ((i * 29 + 17) % a[3]) + 1, r.endsAt);
    return r;
  });
  return [...active, ...done];
}
export function ensureShowcase(state, now = Date.now()) {
  const have = new Set(state.raffles.map((r) => r.id));
  const missing = showcaseRaffles(now).filter((r) => !have.has(r.id));
  return missing.length
    ? { ...state, raffles: [...state.raffles, ...missing] }
    : state;
}
export function initialState(now = Date.now()) {
  return ensureShowcase({ version: 1, seededAt: now, updatedAt: now, raffles: [] }, now);
}
function finite(n, min, max) {
  return typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
}
export function validateCreation(input, now = Date.now()) {
  const e = {};
  const title = String(input.title || "").trim(),
    description = String(input.description || "").trim();
  if (title.length < 3 || title.length > 70)
    e.title = "Use a title between 3 and 70 characters.";
  if (description.length < 10 || description.length > 600)
    e.description = "Describe the prize and rules in 10–600 characters.";
  if (input.prizeType !== "SOL") e.prizeType = "Raffles award SOL only.";
  const prizeAmount = Number(input.prizeAmount),
    entryPrice = Number(input.entryPrice),
    maxEntries = Number(input.maxEntries),
    maxPerWallet = Number(input.maxPerWallet);
  if (!finite(prizeAmount, 0.000000001, 1e12))
    e.prizeAmount = "Use a positive SOL prize amount, up to 1 trillion.";
  if (
    !finite(entryPrice, 0.000000001, 1000) ||
    Math.abs(entryPrice * 1e9 - Math.round(entryPrice * 1e9)) > 0.001
  )
    e.entryPrice = "Use 0.000000001–1,000 SOL with at most 9 decimal places.";
  if (!Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 100000)
    e.maxEntries = "Use a whole number from 1 to 100,000.";
  if (
    !Number.isInteger(maxPerWallet) ||
    maxPerWallet < 1 ||
    maxPerWallet > maxEntries
  )
    e.maxPerWallet = "Use a whole number from 1 up to the maximum entries.";
  const prizeSymbol = "SOL";
  if (!["timer", "soldout"].includes(input.endCondition))
    e.endCondition = "Choose a timer or sold-out ending.";
  const endsAt = Number(input.endsAt);
  if (
    input.endCondition === "timer" &&
    !finite(endsAt, now + 60000, now + 366 * 86400000)
  )
    e.endsAt =
      "Set a draw time at least one minute from now, within the next year.";
  if (!validWallet(input.creator))
    e.creator = "Connect your Solana wallet before creating.";
  if (
    input.image &&
    !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.image)
  )
    e.image = "Choose a PNG, JPG, or WebP image.";
  if (input.image && input.image.length > 410000)
    e.image = "Choose an image smaller than 300 KB.";
  return {
    errors: e,
    value: {
      title,
      description,
      prizeType: input.prizeType,
      prizeAmount,
      prizeSymbol,
      entryPrice,
      maxEntries,
      maxPerWallet,
      endCondition: input.endCondition,
      endsAt: input.endCondition === "timer" ? endsAt : null,
      creator: input.creator,
      image: input.image || null,
    },
  };
}
export function createRaffle(
  input,
  now = Date.now(),
  random = globalThis.crypto,
) {
  const { errors, value } = validateCreation(input, now);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const b = random.getRandomValues(new Uint8Array(3));
  return {
    ...value,
    id:
      "RFL-" +
      Array.from(b, (x) => x.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase(),
    createdAt: now,
    creatorName: null,
    seedEntries: 0,
    seedWallets: 0,
    seed: 0,
    allocations: [],
    local: true,
    prizeState: "seeded-simulated",
    color: COLORS[b[0] % 5],
    receipt: null,
    closedAt: null,
  };
}
export function entryError(r, w, q, now = Date.now()) {
  if (!validWallet(w)) return "Connect your Solana wallet to enter.";
  if (status(r, now) !== "active") return "Entry is closed for this raffle.";
  if (!Number.isInteger(q) || q < 1)
    return "Choose a positive whole number of entries.";
  const available = r.maxEntries - totalEntries(r),
    limit = r.maxPerWallet - ownEntries(r, w);
  if (q > available)
    return `Only ${available} spots remain. Choose fewer entries.`;
  if (q > limit)
    return `Your remaining wallet limit is ${limit}. Choose fewer entries.`;
  return null;
}
export function acceptEntry(r, w, q, now = Date.now()) {
  const error = entryError(r, w, q, now);
  if (error) throw new Error(error);
  return {
    ...r,
    allocations: [
      ...r.allocations,
      { wallet: w, count: q, at: now, cost: roundSOL(q * r.entryPrice) },
    ],
  };
}
export function winningWallet(r, entry) {
  if (entry <= r.seedEntries)
    return exampleWallet(r.seed * 1000 + ((entry - 1) % r.seedWallets));
  let n = r.seedEntries;
  for (const a of r.allocations) {
    n += a.count;
    if (entry <= n) return a.wallet;
  }
  throw new Error("Winning entry is outside the entrant set.");
}
export function uniformEntry(total, random = globalThis.crypto) {
  if (!Number.isInteger(total) || total < 1)
    throw new Error("There are no entries to draw.");
  const ceiling = Math.floor(4294967296 / total) * total;
  let n;
  do {
    n = random.getRandomValues(new Uint32Array(1))[0];
  } while (n >= ceiling);
  return (n % total) + 1;
}
export function makeReceipt(r, entry, at = Date.now()) {
  const total = totalEntries(r);
  if (!Number.isInteger(entry) || entry < 1 || entry > total)
    throw new Error("Invalid winning entry.");
  return {
    version: 1,
    mode: "SIMULATED",
    raffleId: r.id,
    winningWallet: winningWallet(r, entry),
    winningEntry: entry,
    totalEntries: total,
    drawTimestamp: at,
    randomness: "LOCAL RANDOMNESS · NOT ONCHAIN / VRF",
    settlement: "SIMULATED · NO PAYMENT SENT",
    reference: `SIM-${r.id.slice(4)}-${entry}-${at.toString(16).toUpperCase()}`,
    prize: prizeLabel(r),
  };
}
export function drawRaffle(r, w, now = Date.now(), random = globalThis.crypto) {
  if (r.creator !== w || !r.local)
    throw new Error("Only the locally connected creator can draw this raffle.");
  if (status(r, now) !== "ready")
    throw new Error("Close entries or wait for the draw condition.");
  if (!totalEntries(r))
    throw new Error("A draw needs at least one accepted entry.");
  return {
    ...r,
    receipt: makeReceipt(r, uniformEntry(totalEntries(r), random), now),
  };
}
export function closeRaffle(r, w, now = Date.now()) {
  if (r.creator !== w || !r.local)
    throw new Error("Only the creator can close this local raffle.");
  if (status(r, now) !== "active")
    throw new Error("Entries are already closed.");
  if (!totalEntries(r))
    throw new Error("Accept at least one entry before closing.");
  return { ...r, closedAt: now };
}
export function validateState(state) {
  if (
    !state ||
    state.version !== 1 ||
    !finite(state.seededAt, 0, 1e14) ||
    !finite(state.updatedAt, 0, 1e14) ||
    !Array.isArray(state.raffles) ||
    state.raffles.length > 250
  )
    throw new Error("Unsupported or malformed backup data.");
  const ids = new Set();
  for (const r of state.raffles) {
    if (!r || !/^RFL-[A-F0-9]{6}$/.test(r.id) || ids.has(r.id))
      throw new Error("Invalid or duplicate raffle ID.");
    ids.add(r.id);
    if (
      typeof r.title !== "string" ||
      r.title.length < 3 ||
      r.title.length > 70 ||
      typeof r.description !== "string" ||
      r.description.length > 600 ||
      !["SOL", "Token", "NFT"].includes(r.prizeType) ||
      !finite(r.prizeAmount, 1e-9, 1e12) ||
      (r.prizeType === "NFT" && r.prizeAmount !== 1) ||
      typeof r.prizeSymbol !== "string" ||
      !r.prizeSymbol ||
      r.prizeSymbol.length > 40 ||
      !finite(r.entryPrice, 1e-9, 1000) ||
      Math.abs(r.entryPrice * 1e9 - Math.round(r.entryPrice * 1e9)) > 0.001
    )
      throw new Error("Invalid raffle terms.");
    if (
      !validWallet(r.creator) ||
      typeof r.local !== "boolean" ||
      !COLORS.includes(r.color) ||
      r.prizeState !== "seeded-simulated" ||
      !Number.isInteger(r.seed) ||
      r.seed < 0 ||
      r.seed > 1e6 ||
      !(r.creatorName === null || typeof r.creatorName === "string") ||
      (r.creatorName && r.creatorName.length > 70)
    )
      throw new Error("Invalid creator or prize state.");
    if (
      !Number.isInteger(r.maxEntries) ||
      r.maxEntries < 1 ||
      r.maxEntries > 100000 ||
      !Number.isInteger(r.maxPerWallet) ||
      r.maxPerWallet < 1 ||
      r.maxPerWallet > r.maxEntries ||
      !Number.isInteger(r.seedEntries) ||
      r.seedEntries < 0 ||
      !Number.isInteger(r.seedWallets) ||
      r.seedWallets < 0 ||
      r.seedWallets > r.seedEntries ||
      (r.seedEntries > 0 && r.seedWallets < 1) ||
      (r.local && (r.seedEntries !== 0 || r.seedWallets !== 0)) ||
      !Array.isArray(r.allocations) ||
      r.allocations.length > 100000
    )
      throw new Error("Invalid entry counts.");
    if (
      !["timer", "soldout"].includes(r.endCondition) ||
      !finite(r.createdAt, 0, 1e14) ||
      (r.endCondition === "timer" && !finite(r.endsAt, r.createdAt, 1e14)) ||
      (r.endCondition === "soldout" && r.endsAt !== null) ||
      (r.closedAt !== null && !finite(r.closedAt, r.createdAt, 1e14))
    )
      throw new Error("Invalid raffle timing.");
    if (
      r.image !== null &&
      (typeof r.image !== "string" ||
        r.image.length > 410000 ||
        !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(r.image))
    )
      throw new Error("Invalid embedded image.");
    for (const a of r.allocations)
      if (
        !a ||
        !validWallet(a.wallet) ||
        !Number.isInteger(a.count) ||
        a.count < 1 ||
        a.count > r.maxPerWallet ||
        !finite(a.at, r.createdAt, 1e14) ||
        a.cost !== roundSOL(a.count * r.entryPrice)
      )
        throw new Error("Invalid entry record.");
    if (totalEntries(r) > r.maxEntries)
      throw new Error("Entries exceed raffle capacity.");
    for (const w of new Set(r.allocations.map((a) => a.wallet)))
      if (ownEntries(r, w) > r.maxPerWallet)
        throw new Error("Entries exceed wallet limit.");
    if (r.receipt) {
      const d = r.receipt;
      if (!finite(d.drawTimestamp, r.createdAt, 1e14))
        throw new Error("Invalid draw timestamp.");
      const expected = makeReceipt(r, d.winningEntry, d.drawTimestamp);
      if (JSON.stringify(expected) !== JSON.stringify(d))
        throw new Error("The draw receipt does not match its entrant set.");
    }
  }
  return state;
}
export async function digest(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
export async function exportBackup(state) {
  validateState(state);
  return {
    format: "RAFFLER-BACKUP",
    version: 1,
    checksum: await digest(state),
    data: state,
  };
}
export async function parseBackup(text) {
  if (text.length > 5000000)
    throw new Error("Backup must be smaller than 5 MB.");
  let b;
  try {
    b = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (
    b?.format !== "RAFFLER-BACKUP" ||
    b.version !== 1 ||
    typeof b.checksum !== "string"
  )
    throw new Error("Choose a RAFFLER version 1 backup.");
  if ((await digest(b.data)) !== b.checksum)
    throw new Error(
      "Backup checksum failed. The file has changed or is damaged.",
    );
  return validateState(b.data);
}
export function mergeBackups(current, incoming) {
  validateState(incoming);
  const map = new Map(current.raffles.map((r) => [r.id, r]));
  let added = 0,
    duplicates = 0;
  for (const r of incoming.raffles) {
    if (map.has(r.id)) {
      duplicates++;
      continue;
    }
    map.set(r.id, r);
    added++;
  }
  if (map.size > 250)
    throw new Error("Import would exceed the 250 raffle limit.");
  return {
    state: validateState({
      ...current,
      updatedAt: Date.now(),
      raffles: [...map.values()],
    }),
    added,
    duplicates,
  };
}
