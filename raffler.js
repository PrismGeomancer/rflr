(() => {
  // dist/config.js
  var CONFIG = Object.freeze({
    storageKey: 'raffler:v1',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    network: 'mainnet-beta',
    rpcTimeout: 1e4,
    walletTimeout: 6e4,
    maxImageBytes: 3e5,
    maxBackupBytes: 5e6,
    maxRaffles: 250,
    simulationDelay: 250,
  });

  // dist/core.js
  var ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  var COLORS = ['#FFE135', '#FF3D82', '#2563EB', '#22C55E', '#FF6B2B'];
  function base58(bytes) {
    let n = 0n;
    for (const b2 of bytes) n = n * 256n + BigInt(b2);
    let s2 = '';
    while (n) {
      s2 = ALPHABET[Number(n % 58n)] + s2;
      n /= 58n;
    }
    for (const b2 of bytes) {
      if (b2 !== 0) break;
      s2 = '1' + s2;
    }
    return s2;
  }
  function validWallet(s2) {
    if (
      typeof s2 !== 'string' ||
      s2.length < 32 ||
      s2.length > 44 ||
      !/^([1-9A-HJ-NP-Za-km-z]+)$/.test(s2)
    )
      return false;
    let n = 0n;
    for (const c2 of s2) n = n * 58n + BigInt(ALPHABET.indexOf(c2));
    let bytes = 0;
    while (n) {
      n >>= 8n;
      bytes++;
    }
    return bytes + (s2.match(/^1*/)?.[0].length || 0) === 32;
  }
  function exampleWallet(seed) {
    const b2 = new Uint8Array(32);
    let n = (seed + 1) * 7919;
    for (let i2 = 0; i2 < 32; i2++) {
      n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
      b2[i2] = n >>> 24;
    }
    return base58(b2);
  }
  var shortWallet = (s2) =>
    s2 ? `${s2.slice(0, 4)}\u2026${s2.slice(-4)}` : 'Not connected';
  var totalEntries = (r) =>
    r.seedEntries + r.allocations.reduce((n, a2) => n + a2.count, 0);
  var ownEntries = (r, w2) =>
    w2
      ? r.allocations
          .filter((a2) => a2.wallet === w2)
          .reduce((n, a2) => n + a2.count, 0)
      : 0;
  var walletCount = (r) =>
    r.seedWallets + new Set(r.allocations.map((a2) => a2.wallet)).size;
  var odds = (own, total) => (total ? (100 * own) / total : 0);
  var roundSOL = (n) => Math.round(n * 1e9) / 1e9;
  function status(r, now = Date.now()) {
    if (r.receipt) return 'completed';
    if (
      r.closedAt ||
      totalEntries(r) >= r.maxEntries ||
      (r.endCondition === 'timer' && now >= r.endsAt)
    )
      return 'ready';
    return 'active';
  }
  function remaining(r, now = Date.now()) {
    if (status(r, now) !== 'active')
      return status(r, now) === 'completed' ? 'Draw complete' : 'Ready to draw';
    if (r.endCondition === 'soldout')
      return `${r.maxEntries - totalEntries(r)} spots left`;
    const seconds = Math.max(0, Math.ceil((r.endsAt - now) / 1e3));
    const d2 = Math.floor(seconds / 86400),
      h2 = Math.floor((seconds % 86400) / 3600),
      m = Math.floor((seconds % 3600) / 60),
      s2 = seconds % 60;
    return d2
      ? `${d2}d ${h2}h left`
      : h2
        ? `${h2}h ${m}m left`
        : m
          ? `${m}m ${s2}s left`
          : `${s2}s left`;
  }
  var showcaseActive = [
    [
      'RFL-5A1C20',
      'Degen Sunday Pot',
      'Weekly pool for the Sunday crowd. One wallet takes the whole prize.',
      5,
      0.05,
      143,
      91,
      250,
      9.5,
      'SOL Social',
    ],
    [
      'RFL-5A2D41',
      'Builders\u2019 Lunch Fund',
      'A pool for the people shipping on Solana this month.',
      2.5,
      0.025,
      58,
      37,
      100,
      5.2,
      'Solana Builders',
    ],
    [
      'RFL-5A3E62',
      'Moon Club Mega Pool',
      'Our biggest community pool yet. Fixed prize, clear odds.',
      10,
      0.1,
      212,
      140,
      400,
      20.8,
      'Moon Club',
    ],
    [
      'RFL-5A4F83',
      'Pocket Pool #12',
      'Small entry, eighty spots, one winner.',
      1.5,
      0.01,
      47,
      30,
      80,
      3.1,
      'Pocket Pools',
    ],
    [
      'RFL-5A50A4',
      'Validator Night Draw',
      'Evening draw for stakers and friends.',
      4,
      0.02,
      96,
      61,
      150,
      14.4,
      'Validator Club',
    ],
  ];
  var showcasePast = [
    ['Friday Night SOL', 3, 0.05, 120, 'SOL Social'],
    ['Genesis Pot', 5, 0.05, 164, 'Moon Club'],
    ['Builders\u2019 Brunch', 2, 0.025, 88, 'Solana Builders'],
    ['Weekend Wallet Club', 8, 0.1, 205, 'Wallet Club'],
    ['Pocket Pool #11', 1, 0.01, 77, 'Pocket Pools'],
  ];
  function prizeLabel(r) {
    return r.prizeType === 'NFT'
      ? '1 NFT'
      : `${Number(r.prizeAmount).toLocaleString('en-US')} ${r.prizeSymbol}`;
  }
  function showcaseBase(i2, o) {
    return {
      prizeType: 'SOL',
      prizeSymbol: 'SOL',
      maxPerWallet: 25,
      endCondition: 'timer',
      color: COLORS[i2 % 5],
      allocations: [],
      local: false,
      prizeState: 'seeded-simulated',
      image: null,
      closedAt: null,
      receipt: null,
      ...o,
    };
  }
  function showcaseRaffles(now = Date.now()) {
    const active = showcaseActive.map((a2, i2) =>
      showcaseBase(i2, {
        id: a2[0],
        title: a2[1],
        description: a2[2],
        prizeAmount: a2[3],
        entryPrice: a2[4],
        seedEntries: a2[5],
        seedWallets: a2[6],
        maxEntries: a2[7],
        endsAt: now + a2[8] * 36e5,
        createdAt: now - 864e5,
        creator: exampleWallet(i2 + 800),
        creatorName: a2[9],
        seed: i2 + 301,
      }),
    );
    const done = showcasePast.map((a2, i2) => {
      const r = showcaseBase(i2 + 2, {
        id: `RFL-5B${(i2 + 1).toString(16).toUpperCase()}${(28 + i2 * 33).toString(16).toUpperCase().padStart(3, '0')}`.slice(
          0,
          10,
        ),
        title: a2[0],
        description:
          'A completed community pool. The draw receipt has the full result.',
        prizeAmount: a2[1],
        entryPrice: a2[2],
        seedEntries: a2[3],
        seedWallets: Math.floor(a2[3] * 0.64),
        maxEntries: a2[3],
        endsAt: now - (i2 + 1) * 864e5 * 2,
        createdAt: now - (i2 + 1) * 864e5 * 2 - 864e5,
        creator: exampleWallet(i2 + 900),
        creatorName: a2[4],
        seed: i2 + 401,
      });
      r.receipt = makeReceipt(r, ((i2 * 29 + 17) % a2[3]) + 1, r.endsAt);
      return r;
    });
    return [...active, ...done];
  }
  function ensureShowcase(state2, now = Date.now()) {
    const have = new Set(state2.raffles.map((r) => r.id));
    const missing = showcaseRaffles(now).filter((r) => !have.has(r.id));
    return missing.length
      ? { ...state2, raffles: [...state2.raffles, ...missing] }
      : state2;
  }
  function initialState(now = Date.now()) {
    return ensureShowcase(
      { version: 1, seededAt: now, updatedAt: now, raffles: [] },
      now,
    );
  }
  function finite(n, min, max) {
    return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  }
  function validateCreation(input, now = Date.now()) {
    const e = {};
    const title = String(input.title || '').trim(),
      description = String(input.description || '').trim();
    if (title.length < 3 || title.length > 70)
      e.title = 'Use a title between 3 and 70 characters.';
    if (description.length < 10 || description.length > 600)
      e.description = 'Describe the prize and rules in 10\u2013600 characters.';
    if (input.prizeType !== 'SOL') e.prizeType = 'Raffles award SOL only.';
    const prizeAmount = Number(input.prizeAmount),
      entryPrice = Number(input.entryPrice),
      maxEntries = Number(input.maxEntries),
      maxPerWallet = Number(input.maxPerWallet);
    if (!finite(prizeAmount, 1e-9, 1e12))
      e.prizeAmount = 'Use a positive SOL prize amount, up to 1 trillion.';
    if (
      !finite(entryPrice, 1e-9, 1e3) ||
      Math.abs(entryPrice * 1e9 - Math.round(entryPrice * 1e9)) > 1e-3
    )
      e.entryPrice =
        'Use 0.000000001\u20131,000 SOL with at most 9 decimal places.';
    if (!Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 1e5)
      e.maxEntries = 'Use a whole number from 1 to 100,000.';
    if (
      !Number.isInteger(maxPerWallet) ||
      maxPerWallet < 1 ||
      maxPerWallet > maxEntries
    )
      e.maxPerWallet = 'Use a whole number from 1 up to the maximum entries.';
    const prizeSymbol = 'SOL';
    if (!['timer', 'soldout'].includes(input.endCondition))
      e.endCondition = 'Choose a timer or sold-out ending.';
    const endsAt = Number(input.endsAt);
    if (
      input.endCondition === 'timer' &&
      !finite(endsAt, now + 6e4, now + 366 * 864e5)
    )
      e.endsAt =
        'Set a draw time at least one minute from now, within the next year.';
    if (!validWallet(input.creator))
      e.creator = 'Connect your Solana wallet before creating.';
    if (
      input.image &&
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.image)
    )
      e.image = 'Choose a PNG, JPG, or WebP image.';
    if (input.image && input.image.length > 41e4)
      e.image = 'Choose an image smaller than 300 KB.';
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
        endsAt: input.endCondition === 'timer' ? endsAt : null,
        creator: input.creator,
        image: input.image || null,
      },
    };
  }
  function createRaffle(input, now = Date.now(), random = globalThis.crypto) {
    const { errors, value } = validateCreation(input, now);
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
    const b2 = random.getRandomValues(new Uint8Array(3));
    return {
      ...value,
      id:
        'RFL-' +
        Array.from(b2, (x) => x.toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase(),
      createdAt: now,
      creatorName: null,
      seedEntries: 0,
      seedWallets: 0,
      seed: 0,
      allocations: [],
      local: true,
      prizeState: 'seeded-simulated',
      color: COLORS[b2[0] % 5],
      receipt: null,
      closedAt: null,
    };
  }
  function entryError(r, w2, q, now = Date.now()) {
    if (!validWallet(w2)) return 'Connect your Solana wallet to enter.';
    if (status(r, now) !== 'active') return 'Entry is closed for this raffle.';
    if (!Number.isInteger(q) || q < 1)
      return 'Choose a positive whole number of entries.';
    const available = r.maxEntries - totalEntries(r),
      limit = r.maxPerWallet - ownEntries(r, w2);
    if (q > available)
      return `Only ${available} spots remain. Choose fewer entries.`;
    if (q > limit)
      return `Your remaining wallet limit is ${limit}. Choose fewer entries.`;
    return null;
  }
  function acceptEntry(r, w2, q, now = Date.now()) {
    const error = entryError(r, w2, q, now);
    if (error) throw new Error(error);
    return {
      ...r,
      allocations: [
        ...r.allocations,
        { wallet: w2, count: q, at: now, cost: roundSOL(q * r.entryPrice) },
      ],
    };
  }
  function winningWallet(r, entry) {
    if (entry <= r.seedEntries)
      return exampleWallet(r.seed * 1e3 + ((entry - 1) % r.seedWallets));
    let n = r.seedEntries;
    for (const a2 of r.allocations) {
      n += a2.count;
      if (entry <= n) return a2.wallet;
    }
    throw new Error('Winning entry is outside the entrant set.');
  }
  function uniformEntry(total, random = globalThis.crypto) {
    if (!Number.isInteger(total) || total < 1)
      throw new Error('There are no entries to draw.');
    const ceiling = Math.floor(4294967296 / total) * total;
    let n;
    do {
      n = random.getRandomValues(new Uint32Array(1))[0];
    } while (n >= ceiling);
    return (n % total) + 1;
  }
  function makeReceipt(r, entry, at = Date.now()) {
    const total = totalEntries(r);
    if (!Number.isInteger(entry) || entry < 1 || entry > total)
      throw new Error('Invalid winning entry.');
    return {
      version: 1,
      mode: 'SIMULATED',
      raffleId: r.id,
      winningWallet: winningWallet(r, entry),
      winningEntry: entry,
      totalEntries: total,
      drawTimestamp: at,
      randomness: 'LOCAL RANDOMNESS \xB7 NOT ONCHAIN / VRF',
      settlement: 'SIMULATED \xB7 NO PAYMENT SENT',
      reference: `SIM-${r.id.slice(4)}-${entry}-${at.toString(16).toUpperCase()}`,
      prize: prizeLabel(r),
    };
  }
  function drawRaffle(r, w2, now = Date.now(), random = globalThis.crypto) {
    if (r.creator !== w2 || !r.local)
      throw new Error(
        'Only the locally connected creator can draw this raffle.',
      );
    if (status(r, now) !== 'ready')
      throw new Error('Close entries or wait for the draw condition.');
    if (!totalEntries(r))
      throw new Error('A draw needs at least one accepted entry.');
    return {
      ...r,
      receipt: makeReceipt(r, uniformEntry(totalEntries(r), random), now),
    };
  }
  function closeRaffle(r, w2, now = Date.now()) {
    if (r.creator !== w2 || !r.local)
      throw new Error('Only the creator can close this local raffle.');
    if (status(r, now) !== 'active')
      throw new Error('Entries are already closed.');
    if (!totalEntries(r))
      throw new Error('Accept at least one entry before closing.');
    return { ...r, closedAt: now };
  }
  function validateState(state2) {
    if (
      !state2 ||
      state2.version !== 1 ||
      !finite(state2.seededAt, 0, 1e14) ||
      !finite(state2.updatedAt, 0, 1e14) ||
      !Array.isArray(state2.raffles) ||
      state2.raffles.length > 250
    )
      throw new Error('Unsupported or malformed backup data.');
    const ids = /* @__PURE__ */ new Set();
    for (const r of state2.raffles) {
      if (!r || !/^RFL-[A-F0-9]{6}$/.test(r.id) || ids.has(r.id))
        throw new Error('Invalid or duplicate raffle ID.');
      ids.add(r.id);
      if (
        typeof r.title !== 'string' ||
        r.title.length < 3 ||
        r.title.length > 70 ||
        typeof r.description !== 'string' ||
        r.description.length > 600 ||
        !['SOL', 'Token', 'NFT'].includes(r.prizeType) ||
        !finite(r.prizeAmount, 1e-9, 1e12) ||
        (r.prizeType === 'NFT' && r.prizeAmount !== 1) ||
        typeof r.prizeSymbol !== 'string' ||
        !r.prizeSymbol ||
        r.prizeSymbol.length > 40 ||
        !finite(r.entryPrice, 1e-9, 1e3) ||
        Math.abs(r.entryPrice * 1e9 - Math.round(r.entryPrice * 1e9)) > 1e-3
      )
        throw new Error('Invalid raffle terms.');
      if (
        !validWallet(r.creator) ||
        typeof r.local !== 'boolean' ||
        !COLORS.includes(r.color) ||
        r.prizeState !== 'seeded-simulated' ||
        !Number.isInteger(r.seed) ||
        r.seed < 0 ||
        r.seed > 1e6 ||
        !(r.creatorName === null || typeof r.creatorName === 'string') ||
        (r.creatorName && r.creatorName.length > 70)
      )
        throw new Error('Invalid creator or prize state.');
      if (
        !Number.isInteger(r.maxEntries) ||
        r.maxEntries < 1 ||
        r.maxEntries > 1e5 ||
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
        r.allocations.length > 1e5
      )
        throw new Error('Invalid entry counts.');
      if (
        !['timer', 'soldout'].includes(r.endCondition) ||
        !finite(r.createdAt, 0, 1e14) ||
        (r.endCondition === 'timer' && !finite(r.endsAt, r.createdAt, 1e14)) ||
        (r.endCondition === 'soldout' && r.endsAt !== null) ||
        (r.closedAt !== null && !finite(r.closedAt, r.createdAt, 1e14))
      )
        throw new Error('Invalid raffle timing.');
      if (
        r.image !== null &&
        (typeof r.image !== 'string' ||
          r.image.length > 41e4 ||
          !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(r.image))
      )
        throw new Error('Invalid embedded image.');
      for (const a2 of r.allocations)
        if (
          !a2 ||
          !validWallet(a2.wallet) ||
          !Number.isInteger(a2.count) ||
          a2.count < 1 ||
          a2.count > r.maxPerWallet ||
          !finite(a2.at, r.createdAt, 1e14) ||
          a2.cost !== roundSOL(a2.count * r.entryPrice)
        )
          throw new Error('Invalid entry record.');
      if (totalEntries(r) > r.maxEntries)
        throw new Error('Entries exceed raffle capacity.');
      for (const w2 of new Set(r.allocations.map((a2) => a2.wallet)))
        if (ownEntries(r, w2) > r.maxPerWallet)
          throw new Error('Entries exceed wallet limit.');
      if (r.receipt) {
        const d2 = r.receipt;
        if (!finite(d2.drawTimestamp, r.createdAt, 1e14))
          throw new Error('Invalid draw timestamp.');
        const expected = makeReceipt(r, d2.winningEntry, d2.drawTimestamp);
        if (JSON.stringify(expected) !== JSON.stringify(d2))
          throw new Error('The draw receipt does not match its entrant set.');
      }
    }
    return state2;
  }
  async function digest(value) {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), (x) =>
      x.toString(16).padStart(2, '0'),
    ).join('');
  }
  async function exportBackup(state2) {
    validateState(state2);
    return {
      format: 'RAFFLER-BACKUP',
      version: 1,
      checksum: await digest(state2),
      data: state2,
    };
  }
  async function parseBackup(text) {
    if (text.length > 5e6) throw new Error('Backup must be smaller than 5 MB.');
    let b2;
    try {
      b2 = JSON.parse(text);
    } catch {
      throw new Error('This file is not valid JSON.');
    }
    if (
      b2?.format !== 'RAFFLER-BACKUP' ||
      b2.version !== 1 ||
      typeof b2.checksum !== 'string'
    )
      throw new Error('Choose a RAFFLER version 1 backup.');
    if ((await digest(b2.data)) !== b2.checksum)
      throw new Error(
        'Backup checksum failed. The file has changed or is damaged.',
      );
    return validateState(b2.data);
  }
  function mergeBackups(current, incoming) {
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
      throw new Error('Import would exceed the 250 raffle limit.');
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

  // dist/vendor/wallet-standard.js
  var w = function (e, t, r, n) {
    if (r === 'a' && !n)
      throw new TypeError('Private accessor was defined without a getter');
    if (typeof t == 'function' ? e !== t || !n : !t.has(e))
      throw new TypeError(
        'Cannot read private member from an object whose class did not declare it',
      );
    return r === 'm' ? n : r === 'a' ? n.call(e) : n ? n.value : t.get(e);
  };
  var p = function (e, t, r, n, o) {
    if (n === 'm') throw new TypeError('Private method is not writable');
    if (n === 'a' && !o)
      throw new TypeError('Private accessor was defined without a setter');
    if (typeof t == 'function' ? e !== t || !o : !t.has(e))
      throw new TypeError(
        'Cannot write private member to an object whose class did not declare it',
      );
    return (n === 'a' ? o.call(e, r) : o ? (o.value = r) : t.set(e, r), r);
  };
  var l;
  var i;
  var d = /* @__PURE__ */ new Set();
  function h(e) {
    ((s = void 0), d.add(e));
  }
  function g(e) {
    ((s = void 0), d.delete(e));
  }
  var a = {};
  function y() {
    if (
      i ||
      ((i = Object.freeze({ register: f, get: b, on: E })), typeof window > 'u')
    )
      return i;
    let e = Object.freeze({ register: f });
    try {
      window.addEventListener(
        'wallet-standard:register-wallet',
        ({ detail: t }) => t(e),
      );
    } catch (t) {
      console.error(
        `wallet-standard:register-wallet event listener could not be added
`,
        t,
      );
    }
    try {
      window.dispatchEvent(new c(e));
    } catch (t) {
      console.error(
        `wallet-standard:app-ready event could not be dispatched
`,
        t,
      );
    }
    return i;
  }
  function f(...e) {
    return (
      (e = e.filter((t) => !d.has(t))),
      e.length
        ? (e.forEach((t) => h(t)),
          a.register?.forEach((t) => u(() => t(...e))),
          function () {
            (e.forEach((r) => g(r)),
              a.unregister?.forEach((r) => u(() => r(...e))));
          })
        : () => {}
    );
  }
  var s;
  function b() {
    return (s || (s = [...d]), s);
  }
  function E(e, t) {
    return (
      a[e]?.push(t) || (a[e] = [t]),
      function () {
        a[e] = a[e]?.filter((n) => t !== n);
      }
    );
  }
  function u(e) {
    try {
      e();
    } catch (t) {
      console.error(t);
    }
  }
  var c = class extends Event {
    get detail() {
      return w(this, l, 'f');
    }
    get type() {
      return 'wallet-standard:app-ready';
    }
    constructor(t) {
      (super('wallet-standard:app-ready', {
        bubbles: false,
        cancelable: false,
        composed: false,
      }),
        l.set(this, void 0),
        p(this, l, t, 'f'));
    }
    preventDefault() {
      throw new Error('preventDefault cannot be called');
    }
    stopImmediatePropagation() {
      throw new Error('stopImmediatePropagation cannot be called');
    }
    stopPropagation() {
      throw new Error('stopPropagation cannot be called');
    }
  };
  l = /* @__PURE__ */ new WeakMap();

  // dist/wallet.js
  function validateRPC(url, network) {
    let u2;
    try {
      u2 = new URL(url);
    } catch {
      throw new Error('Enter a complete HTTPS RPC URL.');
    }
    if (u2.username || u2.password || u2.hash || u2.search)
      throw new Error(
        'Use a public RPC endpoint without credentials, query keys, or fragments.',
      );
    if (
      u2.protocol !== 'https:' &&
      !(
        u2.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(u2.hostname)
      )
    )
      throw new Error('Use HTTPS, or localhost for development.');
    if (!['mainnet-beta', 'devnet', 'testnet'].includes(network))
      throw new Error('Choose a Solana network.');
    return u2.href;
  }
  var PhantomWallet = class {
    constructor({
      host = globalThis.window,
      fetcher = (url, options) => globalThis.fetch(url, options),
      changed = () => {},
      settings: settings2 = { rpcUrl: CONFIG.rpcUrl, network: CONFIG.network },
      timeout = CONFIG.walletTimeout,
    } = {}) {
      this.host = host;
      this.fetcher = fetcher;
      this.changed = changed;
      this.settings = settings2;
      this.timeout = timeout;
      this.address = null;
      this.balance = null;
      this.balanceState = 'idle';
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
      const p2 = this.host?.phantom?.solana || this.host?.solana;
      return p2?.isPhantom ? p2 : null;
    }
    attach() {
      const p2 = this.detect();
      if (!p2) return null;
      if (this.provider === p2) return p2;
      this.provider = p2;
      p2.on?.('connect', (key) => {
        if (this.provider !== p2) return;
        if (this.allowSession && p2.isConnected)
          this.setAddress((key || p2.publicKey)?.toString());
      });
      p2.on?.('disconnect', () => {
        if (this.provider !== p2) return;
        this.allowSession = false;
        this.generation++;
        this.setAddress(null);
      });
      p2.on?.('accountChanged', (key) => {
        if (this.provider !== p2) return;
        this.generation++;
        if (this.allowSession && p2.isConnected && key)
          this.setAddress(key.toString());
        else {
          this.allowSession = false;
          this.setAddress(null);
        }
      });
      return p2;
    }
    setAddress(address) {
      address = validWallet(address) ? address : null;
      if (address === this.address) return;
      this.address = address;
      this.balance = null;
      this.balanceAt = null;
      this.balanceState = 'idle';
      this.balanceAbort?.abort();
      this.balanceGeneration++;
      this.changed();
      if (address) void this.refreshBalance();
    }
    async connect(trusted = false) {
      const p2 = this.attach();
      if (!p2)
        throw new Error(
          'No compatible wallet is available. Install a Solana wallet or open this site in its in-app browser.',
        );
      if (this.connecting)
        throw new Error('A wallet connection request is already open.');
      this.connecting = true;
      this.allowSession = true;
      const generation = ++this.generation;
      this.changed();
      let timer;
      try {
        const response = await Promise.race([
          p2.connect(trusted ? { onlyIfTrusted: true } : void 0),
          new Promise((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new Error(
                    'Wallet connection timed out. Close the wallet prompt, then try again.',
                  ),
                ),
              this.timeout,
            );
          }),
        ]);
        if (generation !== this.generation)
          throw new Error(
            'Wallet account changed during connection. Try again.',
          );
        if (!p2.isConnected || !validWallet(response?.publicKey?.toString()))
          throw new Error(
            'The wallet did not return a connected Solana account.',
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
            'Connection was declined. Your raffle input is still here.',
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
        } catch {}
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
          'Your wallet disconnected or changed. Reconnect and try again.',
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
      this.balanceState = 'loading';
      this.balance = null;
      this.balanceError = null;
      this.changed();
      try {
        const url = validateRPC(this.settings.rpcUrl, this.settings.network);
        const response = await this.fetcher(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getBalance',
            params: [address, { commitment: 'confirmed' }],
          }),
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(
            response.status === 429
              ? 'RPC rate limited. Try later or choose another endpoint.'
              : `RPC returned HTTP ${response.status}.`,
          );
        const data = await response.json();
        const n = data?.result?.value;
        if (data.error || !Number.isSafeInteger(n) || n < 0)
          throw new Error(
            'RPC balance is unavailable. Choose another endpoint or try later.',
          );
        if (version === this.balanceGeneration && address === this.address) {
          this.balance = n / 1e9;
          this.balanceState = 'ready';
          this.balanceAt = Date.now();
        }
      } catch (e) {
        if (version === this.balanceGeneration && address === this.address) {
          this.balanceState = 'error';
          this.balanceError =
            e.name === 'AbortError'
              ? 'RPC timed out. Try again or choose another endpoint.'
              : e.message;
        }
      } finally {
        clearTimeout(timer);
        if (version === this.balanceGeneration) this.changed();
      }
    }
  };
  var SolanaWallet = class extends PhantomWallet {
    constructor(options = {}) {
      super(options);
      this.registry =
        options.registry ||
        (this.host === globalThis.window && this.host?.addEventListener
          ? y()
          : null);
      this.adapters = /* @__PURE__ */ new Map();
      this.selected = null;
      this.name = '';
      this.lastName = '';
      try {
        this.lastName =
          this.host?.localStorage?.getItem('raffler:wallet-choice') || '';
      } catch {}
      this.registry?.on('register', () => {
        this.changed();
        if (!this.connecting && !this.address && this.lastName)
          void this.reconnect();
      });
      this.registry?.on('unregister', (...removed) => {
        if (removed.some((w2) => this.selected?.wallet === w2)) {
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
          (w2) =>
            w2.chains?.some((c2) => c2.startsWith('solana:')) &&
            typeof w2.features?.['standard:connect']?.connect === 'function' &&
            typeof w2.features?.['standard:events']?.on === 'function',
        )
        .map((w2, i2) => ({
          id: `standard:${w2.name}:${i2}`,
          name: w2.name,
          wallet: w2,
          standard: true,
        }));
      const p2 = super.detect();
      if (p2 && !list.some((w2) => w2.name.toLowerCase() === 'phantom'))
        list.push({
          id: 'legacy:phantom',
          name: 'Phantom',
          provider: p2,
          standard: false,
        });
      return list;
    }
    async select(id) {
      if (this.connecting)
        throw new Error('Wait for the current connection request to finish.');
      const item = this.available().find((w2) => w2.id === id);
      if (!item)
        throw new Error(
          'This wallet is no longer available. Refresh the wallet list.',
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
      const w2 = this.selected.wallet;
      if (!this.adapters.has(w2)) this.adapters.set(w2, standardAdapter(w2));
      return this.adapters.get(w2);
    }
    async connect(trusted = false) {
      if (!this.selected) {
        const list = this.available();
        const choice = list.find((w2) => w2.name === this.lastName) || list[0];
        if (choice) {
          this.selected = choice;
          this.name = choice.name;
        }
      }
      const address = await super.connect(trusted);
      this.lastName = this.name || 'Phantom';
      try {
        this.host?.localStorage?.setItem(
          'raffler:wallet-choice',
          this.lastName,
        );
      } catch {}
      return address;
    }
    async reconnect() {
      const choice = this.available().find((w2) => w2.name === this.lastName);
      if (choice?.standard) {
        const account = solanaAccount(choice.wallet.accounts);
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
  };
  function solanaAccount(accounts = []) {
    return accounts.find(
      (a2) =>
        validWallet(a2.address) &&
        a2.chains?.some((c2) => c2.startsWith('solana:')),
    );
  }
  function standardAdapter(w2) {
    let active = false;
    const listeners = /* @__PURE__ */ new Map();
    const adapter = {
      get isConnected() {
        return active && Boolean(solanaAccount(w2.accounts));
      },
      get publicKey() {
        const a2 = solanaAccount(w2.accounts);
        return a2 ? { toString: () => a2.address } : null;
      },
      activate() {
        active = true;
      },
      on(name, callback) {
        listeners.set(name, callback);
      },
      async connect(options) {
        const result = await w2.features['standard:connect'].connect({
          silent: Boolean(options?.onlyIfTrusted),
        });
        const account = solanaAccount(result.accounts);
        if (!account)
          throw new Error('This wallet returned no authorized Solana account.');
        active = true;
        return { publicKey: { toString: () => account.address } };
      },
      async disconnect() {
        active = false;
        listeners.get('disconnect')?.();
        await w2.features['standard:disconnect']?.disconnect();
      },
    };
    w2.features['standard:events'].on('change', (properties) => {
      if (!active || !properties.accounts) return;
      const account = solanaAccount(properties.accounts);
      if (account)
        listeners.get('accountChanged')?.({ toString: () => account.address });
      else {
        active = false;
        listeners.get('disconnect')?.();
      }
    });
    return adapter;
  }

  // dist/app.js
  var $ = (s2, root = document) => root.querySelector(s2);
  var $$ = (s2, root = document) => [...root.querySelectorAll(s2)];
  var esc = (s2) =>
    String(s2 ?? '').replace(
      /[&<>"']/g,
      (c2) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c2],
    );
  var num = (n) =>
    Number(n).toLocaleString('en-US', { maximumFractionDigits: 9 });
  var pct = (n) => `${n.toFixed(2)}%`;
  var date = (n) =>
    new Date(n).toLocaleString(void 0, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  var storageError = '';
  var damagedRaw = null;
  function load() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      if (raw) {
        try {
          return ensureShowcase(validateState(JSON.parse(raw)));
        } catch {
          damagedRaw = raw;
          storageError =
            'Saved browser data is damaged. Export it in RPC settings before resetting. New activity is kept in memory.';
        }
      }
    } catch {
      storageError =
        'Browser storage is unavailable. Export a backup to keep this session.';
    }
    return initialState();
  }
  var state = load();
  var settings = { rpcUrl: CONFIG.rpcUrl, network: CONFIG.network };
  try {
    const s2 = JSON.parse(localStorage.getItem('raffler:rpc'));
    if (s2) {
      validateRPC(s2.rpcUrl, s2.network);
      settings = s2;
    }
  } catch {}
  var modal = $('#modal');
  var content = $('#modal-content');
  var context = null;
  var returnContext = null;
  var filter = 'active';
  var query = '';
  var sort = 'featured';
  var quantity = 5;
  var createDraft = null;
  var createImage = null;
  var operation = null;
  var toastTimer;
  var activityPaused = false;
  var activityIndex = 0;
  var wallet = new SolanaWallet({ settings, changed: walletChanged });
  function toast(message) {
    $('#toast').textContent = message;
    $('#toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($('#toast').hidden = true), 6e3);
  }
  function latestState() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      if (raw && !damagedRaw) {
        const s2 = ensureShowcase(validateState(JSON.parse(raw)));
        if (s2.updatedAt > state.updatedAt) state = s2;
      }
    } catch {}
    return state;
  }
  function commit(update) {
    const base = latestState();
    state = validateState({
      ...update(base),
      updatedAt: Math.max(Date.now(), base.updatedAt + 1),
    });
    try {
      if (damagedRaw) throw new Error('Protected damaged data');
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
      storageError = '';
    } catch {
      storageError =
        'This session could not be saved. Export a backup from My entries before closing.';
    }
    renderGrid();
    renderPast();
    updatePhoneDemo();
    return state;
  }
  function updateRaffle(id, update) {
    commit((s2) => {
      if (!s2.raffles.some((r) => r.id === id))
        throw new Error('This raffle is no longer available in this browser.');
      return {
        ...s2,
        raffles: s2.raffles.map((r) => (r.id === id ? update(r) : r)),
      };
    });
  }
  var getRaffle = (id) => state.raffles.find((r) => r.id === id);
  function walletChanged() {
    $('#wallet-button').textContent = wallet.connecting
      ? 'Connecting\u2026'
      : wallet.connected()
        ? shortWallet(wallet.address)
        : 'Connect wallet';
    $('#wallet-button').disabled = wallet.connecting;
    renderGrid();
    updatePhoneDemo();
    if (context?.type === 'wallet') renderWallet();
    if (context?.type === 'detail') updateEntryQuote();
    if (context?.type === 'create')
      $('#creator-wallet')?.replaceChildren(
        document.createTextNode(
          wallet.address || 'Connect wallet to autofill your creator wallet',
        ),
      );
    if (context?.type === 'history') renderHistory(context.tab);
  }
  function show(type, data = {}) {
    context = { type, ...data };
    $('#modal-kicker').textContent =
      {
        detail: 'RAFFLE DETAILS',
        create: 'YOUR COMMUNITY. YOUR POOL.',
        wallet: 'SOLANA WALLETS',
        history: 'YOUR CORNER OF RAFFLER',
        receipt: 'DRAW RECEIPT',
        settings: 'SETTINGS',
        about: 'HOW DRAWS WORK',
        share: 'SHARE YOUR POOL',
      }[type] || 'RAFFLER';
    content.innerHTML = '';
    if (!modal.open) modal.showModal();
    modal.scrollTop = 0;
    renderContext();
  }
  function renderContext() {
    const { type, id, tab } = context;
    if (type === 'detail') renderDetail(id);
    else if (type === 'receipt') renderReceipt(id);
    else if (type === 'create') renderCreate();
    else if (type === 'wallet') renderWallet();
    else if (type === 'history') renderHistory(tab);
    else if (type === 'settings') renderSettings();
    else if (type === 'about') renderAbout();
    else if (type === 'share') renderShare(id);
  }
  function closeModal() {
    if (operation) {
      cancelOperation();
      return;
    }
    if (context?.type === 'create') captureDraft();
    modal.close();
    context = null;
    returnContext = null;
  }
  modal.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeModal();
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      const r = modal.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        closeModal();
    }
  });
  function renderGrid() {
    const now = Date.now();
    $('#active-count').textContent = state.raffles.filter(
      (r) => r.prizeType === 'SOL' && status(r, now) !== 'completed',
    ).length;
    let list = state.raffles
      .filter((r) => r.prizeType === 'SOL')
      .filter((r) =>
        filter === 'completed'
          ? status(r, now) === 'completed'
          : filter === 'ending'
            ? status(r, now) !== 'completed' &&
              (status(r, now) === 'ready' ||
                (r.endCondition === 'timer' && r.endsAt - now < 864e5) ||
                r.maxEntries - totalEntries(r) <= 10)
            : status(r, now) !== 'completed',
      );
    list = list.filter((r) =>
      `${r.title} ${prizeLabel(r)} ${r.prizeSymbol} ${r.id} ${r.creatorName || r.creator}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
    if (sort === 'price') list.sort((a2, b2) => a2.entryPrice - b2.entryPrice);
    else if (sort === 'entries')
      list.sort((a2, b2) => totalEntries(b2) - totalEntries(a2));
    else if (sort === 'ending' || filter === 'ending')
      list.sort(
        (a2, b2) =>
          (status(a2) === 'ready' ? 0 : a2.endsAt || Infinity) -
          (status(b2) === 'ready' ? 0 : b2.endsAt || Infinity),
      );
    else list.sort((a2, b2) => b2.createdAt - a2.createdAt);
    $('#raffle-grid').innerHTML = list.length
      ? list.map(card).join('')
      : state.raffles.length
        ? '<div class="empty"><h3>No pools found.</h3><p>Try another search or filter, or create a pool for your community.</p><button class="btn primary" data-action="clear-search">Reset search & filters</button></div>'
        : '<div class="empty"><h3>No raffles yet.</h3><p>Create the first pool for your community, or import a backup.</p><button class="btn primary" data-action="create">Create a raffle \uFF0B</button></div>';
  }
  function card(r) {
    const n = totalEntries(r),
      me = ownEntries(r, wallet.address),
      s2 = status(r),
      prize = prizeLabel(r);
    return `<article class="raffle-card" style="--card-color:${r.color}"><div class="card-prize">${r.image ? `<img class="card-project-image" src="${esc(r.image)}" alt="Project image for ${esc(r.title)}">` : ''}<div class="card-prize-top"><span class="tag">${r.prizeType.toUpperCase()} PRIZE</span><span class="card-id">${r.id}</span></div><div><div class="prize-value ${prize.length > 12 ? 'long' : ''}">${esc(prize)}</div><div class="prize-sub">${s2 === 'completed' ? 'RESULT RECORDED' : 'ONE WINNER. ALL YOURS.'}</div></div></div><div class="card-body"><h3>${esc(r.title)}</h3><div class="creator">by <span title="${r.creator}">${esc(r.creatorName || shortWallet(r.creator))}</span>${r.creator === wallet.address ? '<span class="vault">Your pool</span>' : ''}</div><div class="card-metrics"><div class="metric"><small>Entry price</small><strong>${num(r.entryPrice)} SOL</strong></div><div class="metric"><small>Total entries</small><strong>${num(n)}</strong></div><div class="metric"><small>Wallets</small><strong>${num(walletCount(r))}</strong></div></div><div class="capacity"><div class="capacity-meta"><span>${num(n)} / ${num(r.maxEntries)} spots</span><span>${Math.round((n / r.maxEntries) * 100)}% filled</span></div><div class="capacity-track"><span style="width:${(n / r.maxEntries) * 100}%"></span></div></div><div class="card-bottom"><span class="time-left ${s2 === 'ready' || r.endsAt - Date.now() < 72e5 ? 'urgent' : ''}" data-countdown="${r.id}">\u25F7 ${remaining(r)}</span><button class="btn ${s2 === 'completed' ? 'secondary' : 'primary'}" data-action="${s2 === 'completed' ? 'receipt' : 'detail'}" data-id="${r.id}">${s2 === 'completed' ? 'View receipt' : s2 === 'ready' ? 'View draw' : 'Take a shot'}</button></div><div class="card-user">Your entries: ${me} \xB7 Current odds: ${pct(odds(me, n))}</div></div></article>`;
  }
  function renderPast() {
    $('#past-list').innerHTML =
      state.raffles
        .filter((r) => r.receipt && r.prizeType === 'SOL')
        .sort((a2, b2) => b2.receipt.drawTimestamp - a2.receipt.drawTimestamp)
        .map(
          (r) =>
            `<button class="past-row" style="--row-color:${r.color}" data-action="receipt" data-id="${r.id}"><span class="past-icon">\u25CE</span><span><span class="past-title">${esc(r.title)}</span><span class="past-sub">${num(totalEntries(r))} entries \xB7 ${shortWallet(r.receipt.winningWallet)}</span></span><span class="past-value">${esc(prizeLabel(r))}<small>View receipt</small></span></button>`,
        )
        .join('') ||
      '<div class="empty"><h3>No receipts yet.</h3><p>Completed draws will appear here.</p></div>';
  }
  function renderDetail(id) {
    const r = getRaffle(id);
    if (!r || r.prizeType !== 'SOL') {
      content.innerHTML =
        '<h2 class="modal-title" id="modal-title">This pool isn\u2019t here.</h2><p>This raffle isn\u2019t saved in this browser. Ask its creator for a backup to import.</p>';
      return;
    }
    const n = totalEntries(r),
      s2 = status(r),
      mine = wallet.address === r.creator;
    content.innerHTML = `<h2 class="modal-title" id="modal-title">${esc(r.title)}</h2><p class="modal-description">${esc(r.description)}</p><div class="detail-prize" style="--card-color:${r.color}"><div><small>PRIZE</small><div class="detail-prize-value">${esc(prizeLabel(r))}</div></div><span class="tag">${s2 === 'active' ? 'OPEN' : s2 === 'ready' ? 'READY TO DRAW' : 'COMPLETED'}</span></div><div class="detail-grid"><div class="stat-box"><small>Total accepted entries</small><strong>${num(n)}</strong></div><div class="stat-box"><small>Unique wallets</small><strong>${num(walletCount(r))}</strong></div><div class="stat-box"><small>Your entries</small><strong id="detail-own">${ownEntries(r, wallet.address)}</strong></div><div class="stat-box"><small>Entry proceeds</small><strong>${num(roundSOL(n * r.entryPrice))} SOL</strong></div></div><div class="detail-meta"><span>${r.id}<br>Creator: <span title="${r.creator}">${shortWallet(r.creator)}</span></span><span data-countdown="${r.id}">${remaining(r)}</span></div><p class="field-hint">${r.maxPerWallet} entries maximum per wallet. ${r.endCondition === 'timer' ? `Draw eligible at ${date(r.endsAt)}, or when sold out.` : 'Draw eligible when all spots sell out.'} Prize stays fixed; entry proceeds are separate.</p>${s2 === 'active' ? `<div class="entry-panel"><h3>Take your shot.</h3><div class="entry-options" role="group" aria-label="Number of entries">${[1, 5, 10].map((q) => `<button class="quantity-btn ${quantity === q ? 'active' : ''}" data-action="quantity" data-quantity="${q}" aria-pressed="${quantity === q}">${q}</button>`).join('')}<label><span class="sr-only">Custom number of entries</span><input class="custom-quantity" type="number" id="custom-quantity" min="1" max="${r.maxEntries}" step="1" placeholder="Custom" value="${[1, 5, 10].includes(quantity) ? '' : quantity}"></label></div><div class="cost-row"><div><small>TOTAL \xB7 ${num(r.entryPrice)} SOL / ENTRY</small><strong id="entry-total"></strong></div><div><small>ESTIMATED ODDS AFTER ENTRY</small><strong id="entry-odds"></strong></div></div><p class="field-hint" id="entry-limit"></p><p class="error-inline" id="entry-error" role="status"></p><button class="btn primary" data-action="enter" data-id="${r.id}" id="enter-button">Enter raffle</button><p class="field-hint" style="margin-top:12px"></p></div>` : s2 === 'completed' ? `<div class="notice success">Winner: ${shortWallet(r.receipt.winningWallet)} \xB7 Entry #${r.receipt.winningEntry}</div><button class="btn primary" data-action="receipt" data-id="${r.id}">Inspect draw receipt</button>` : `<div class="notice">Entries are locked. ${mine ? 'You can draw the winner.' : 'Waiting for the creator to draw.'}</div>`}${mine ? `<div class="admin-panel"><h3>Creator controls</h3><p>You created this raffle.</p>${s2 === 'active' ? `<button class="btn secondary small" data-action="close-entries" data-id="${id}" ${n ? '' : 'disabled'}>Close entries early</button>` : s2 === 'ready' ? `<button class="btn primary" data-action="draw" data-id="${id}" ${n ? '' : 'disabled'}>Draw winner</button>` : '<p>Draw complete.</p>'}${!n ? '<p class="field-hint">Accept at least one entry before closing or drawing.</p>' : ''}<div class="dialog-actions"><button class="btn secondary small" data-action="entrants-csv" data-id="${id}" ${n ? '' : 'disabled'}>Download entrants (CSV)</button><button class="btn secondary small" data-action="duplicate" data-id="${id}">Duplicate</button><button class="btn secondary small" data-action="delete-raffle" data-id="${id}">Delete</button></div></div>` : ''}<div class="dialog-actions"><button class="btn secondary small" data-action="share" data-id="${id}">Share raffle</button><button class="btn secondary small" data-action="history">My entries</button></div>`;
    updateEntryQuote();
  }
  function updateEntryQuote() {
    if (context?.type !== 'detail') return;
    const r = getRaffle(context.id);
    if (!r || !$('#entry-total')) return;
    const n = totalEntries(r),
      me = ownEntries(r, wallet.address),
      valid = Number.isInteger(quantity) && quantity > 0;
    $('#entry-total').textContent = valid
      ? `${num(roundSOL(quantity * r.entryPrice))} SOL`
      : '\u2014';
    $('#entry-odds').textContent = valid
      ? pct(odds(me + quantity, n + quantity))
      : '\u2014';
    $('#detail-own').textContent = me;
    $('#entry-limit').textContent =
      `${r.maxEntries - n} spots left \xB7 Your wallet can add ${Math.max(0, r.maxPerWallet - me)} more entries.`;
    const err = wallet.connected()
      ? entryError(r, wallet.address, quantity)
      : !valid
        ? 'Choose a positive whole number of entries.'
        : null;
    $('#entry-error').textContent = err || '';
    $('#enter-button').disabled = Boolean(err) || wallet.connecting;
    $('#enter-button').textContent = wallet.connecting
      ? 'Connecting\u2026'
      : wallet.connected()
        ? 'Enter raffle'
        : 'Connect wallet to enter';
    $$('.quantity-btn', content).forEach((b2) => {
      const yes = Number(b2.dataset.quantity) === quantity;
      b2.classList.toggle('active', yes);
      b2.setAttribute('aria-pressed', String(yes));
    });
  }
  function captureDraft() {
    const f2 = $('#create-form');
    if (f2) createDraft = Object.fromEntries(new FormData(f2));
  }
  function defaultDraft() {
    const t = new Date(Date.now() + 864e5);
    return {
      title: '',
      description: '',
      prizeType: 'SOL',
      prizeAmount: '5',
      prizeSymbol: '',
      entryPrice: '.05',
      maxEntries: '250',
      maxPerWallet: '25',
      endCondition: 'timer',
      endsAt: new Date(t - t.getTimezoneOffset() * 6e4)
        .toISOString()
        .slice(0, 16),
    };
  }
  function renderCreate() {
    const d2 = createDraft || defaultDraft();
    content.innerHTML = `<h2 class="modal-title" id="modal-title">Make a pool.<br><span class="sticker yellow">Bring your people.</span></h2><p class="modal-description">Set the prize and the rules.</p><form id="create-form" novalidate><div class="form-grid"><label class="full">Raffle title<input name="title" maxlength="70" placeholder="The community pot" value="${esc(d2.title)}" required></label><label class="full">Description<textarea name="description" maxlength="600" placeholder="What\u2019s in the pool? What should your community know?" required>${esc(d2.description)}</textarea></label><input type="hidden" name="prizeType" value="SOL"><label>SOL prize amount<input name="prizeAmount" type="number" min="0.000000001" max="1000000000000" step="any" value="${esc(d2.prizeAmount)}" required></label><label>Entry price \xB7 SOL<input name="entryPrice" type="number" min="0.000000001" max="1000" step="any" value="${esc(d2.entryPrice)}" required></label><label>Maximum entries<input name="maxEntries" type="number" min="1" max="100000" step="1" value="${esc(d2.maxEntries)}" required></label><label>Maximum per wallet<input name="maxPerWallet" type="number" min="1" step="1" value="${esc(d2.maxPerWallet)}" required></label><label>End condition<select name="endCondition"><option value="timer" ${d2.endCondition === 'timer' ? 'selected' : ''}>Timer or sold out</option><option value="soldout" ${d2.endCondition === 'soldout' ? 'selected' : ''}>When sold out</option></select></label><label class="full" id="time-field" ${d2.endCondition === 'soldout' ? 'hidden' : ''}>Draw time<input name="endsAt" type="datetime-local" value="${esc(d2.endsAt)}"></label><label class="full">Project image \xB7 optional<input type="file" id="project-image" accept="image/png,image/jpeg,image/webp"><span class="field-hint">PNG, JPG, or WebP \xB7 up to 300 KB \xB7 embedded in your backup</span><span id="image-state">${createImage ? '<img class="image-preview" src="' + esc(createImage) + '" alt="Selected project image"><button type="button" class="text-button" data-action="remove-image">Remove image</button>' : ''}</span></label><div class="full"><span class="field">Creator wallet \xB7 connected address</span><code class="wallet-address" id="creator-wallet">${esc(wallet.address || 'Connect wallet to autofill your creator wallet')}</code><button class="btn secondary small" type="button" data-action="connect-inline">${wallet.connected() ? 'Manage wallet' : 'Connect wallet'}</button></div></div><div class="notice">Raffles are recorded in this browser. No SOL is deposited or paid out.</div><div id="create-errors" role="alert"></div><div class="dialog-actions"><button class="btn primary" type="submit">Create raffle</button><button class="btn secondary" type="button" data-action="close">Cancel</button></div></form>`;
    $('#create-form').addEventListener('submit', submitCreation);
    updatePrizeType();
  }
  function updatePrizeType() {
    const f2 = $('#create-form');
    if (f2)
      $('#time-field').hidden = f2.elements.endCondition.value === 'soldout';
  }
  async function submitCreation(e) {
    e.preventDefault();
    captureDraft();
    const input = {
      ...createDraft,
      endsAt: new Date(createDraft.endsAt).getTime(),
      creator: wallet.connected() ? wallet.address : null,
      image: createImage,
    };
    const { errors } = validateCreation(input);
    $$('[aria-invalid]', e.target).forEach((x) =>
      x.removeAttribute('aria-invalid'),
    );
    if (Object.keys(errors).length) {
      $('#create-errors').innerHTML =
        `<div class="notice error">${Object.values(errors).map(esc).join('<br>')}</div>`;
      for (const name of Object.keys(errors))
        e.target.elements[name]?.setAttribute('aria-invalid', 'true');
      e.target.elements[Object.keys(errors)[0]]?.focus();
      return;
    }
    if (state.raffles.length >= CONFIG.maxRaffles) {
      $('#create-errors').innerHTML =
        '<div class="notice error">This browser has reached its 250 raffle limit.</div>';
      return;
    }
    const creator = wallet.require();
    await runOperation(
      ['Validating prize', 'Creating raffle', 'Publishing raffle'],
      async () => {
        if (wallet.require() !== creator)
          throw new Error(
            'Your wallet changed. Review the creator address and try again.',
          );
        const r = createRaffle(input);
        if (state.raffles.some((x) => x.id === r.id))
          throw new Error('Raffle ID collision. Try again.');
        commit((s2) => ({ ...s2, raffles: [r, ...s2.raffles] }));
        createDraft = null;
        createImage = null;
        filter = 'active';
        setFilterButtons();
        show('detail', { id: r.id });
        toast(storageError || `${r.id} created.`);
      },
      () => show('create'),
      'Creating your pool.',
    );
  }
  async function connectInline() {
    if (context?.type === 'create') captureDraft();
    returnContext = context;
    show('wallet');
  }
  var walletApps = [
    { name: 'Phantom', url: 'https://phantom.com/download' },
    { name: 'Solflare', url: 'https://solflare.com' },
    { name: 'Backpack', url: 'https://backpack.app' },
    { name: 'Trust Wallet', url: 'https://trustwallet.com' },
    { name: 'Brave Wallet', url: 'https://brave.com/wallet' },
  ];
  function renderWallet() {
    const connected = wallet.connected(),
      available = wallet.available();
    const choices = available
      .map(
        (w2, i2) =>
          `<button class="wallet-choice" data-action="select-wallet" data-wallet-id="${esc(w2.id)}" ${wallet.connecting ? 'disabled' : ''}><span class="wallet-monogram" style="--wallet-color:${['#FFE135', '#FF3D82', '#2563EB', '#22C55E', '#FF6B2B'][i2 % 5]}">${esc(w2.name.slice(0, 1))}</span><span><strong>${esc(w2.name)}</strong><small>${wallet.connecting && wallet.name === w2.name ? 'Waiting for approval\u2026' : 'Detected \xB7 Solana'}</small></span><span class="tag">Connect</span></button>`,
      )
      .join('');
    content.innerHTML = `<h2 class="modal-title" id="modal-title">${connected ? 'Your wallet.' : 'Choose your wallet.'}</h2><p class="modal-description">${connected ? `${esc(wallet.name || 'Solana wallet')} connected. Your balance comes from the selected Solana RPC.` : 'Connect any installed wallet that supports Solana Wallet Standard.'}</p>${connected ? `<code class="wallet-address">${wallet.address}</code><div class="live-balance"><div class="balance-label">ACTUAL WALLET BALANCE \xB7 ${esc(settings.network.toUpperCase())}</div><strong>${wallet.balanceState === 'ready' ? num(wallet.balance) + ' SOL' : wallet.balanceState === 'loading' ? 'Checking\u2026' : 'Unavailable'}</strong><p class="field-hint">${wallet.balanceAt ? `Checked ${date(wallet.balanceAt)}. Your balance is separate from raffle activity.` : esc(wallet.balanceError || 'Checking your SOL balance\u2026')}</p></div><div class="balance-actions"><button class="btn secondary small" data-action="balance">Refresh balance</button><button class="text-button" data-action="settings">RPC settings</button></div><div class="dialog-actions"><button class="btn secondary" data-action="disconnect">Disconnect</button><button class="btn primary" data-action="wallet-back">${returnContext ? 'Back to raffle' : 'Done'}</button></div><details class="wallet-switch"><summary>Switch wallet</summary><div class="wallet-choices">${choices}</div></details>` : `<div class="wallet-choices">${choices || '<div class="notice">No compatible wallet detected. Install a Solana wallet, or open this site in your wallet\u2019s browser.</div>'}</div><button class="text-button" data-action="refresh-wallets">Refresh wallet list</button><details class="wallet-switch" ${available.length ? '' : 'open'}><summary>Get a wallet</summary><div class="wallet-choices">${walletApps.map((w2) => `<a class="wallet-choice" href="${w2.url}" target="_blank" rel="noopener noreferrer"><span class="wallet-monogram">${w2.name[0]}</span><span><strong>${w2.name}</strong><small>Visit official site</small></span><span aria-hidden="true">\u2197</span></a>`).join('')}</div></details><p class="field-hint" style="margin-top:18px">Connecting shares your public address only. No payment or signature is requested.</p>${returnContext ? '<div class="dialog-actions"><button class="btn secondary" data-action="wallet-back">Back to raffle</button></div>' : ''}`}`;
  }
  async function startEntry(id) {
    if (!wallet.connected()) {
      await connectInline();
      return;
    }
    const r = getRaffle(id),
      address = wallet.require(),
      error = entryError(r, address, quantity);
    if (error) throw new Error(error);
    context = { type: 'approval', id, q: quantity, address };
    $('#modal-kicker').textContent = 'CONFIRM ENTRY';
    content.innerHTML = `<h2 class="modal-title" id="modal-title">Ready to take a shot?</h2><p class="modal-description">${esc(r.title)}</p><div class="detail-grid"><div class="stat-box"><small>Your new entries</small><strong>${quantity}</strong></div><div class="stat-box"><small>Entry cost</small><strong>${num(roundSOL(quantity * r.entryPrice))} SOL</strong></div></div><code class="wallet-address">${address}</code><div class="notice">Your wallet isn\u2019t asked to sign or pay and no SOL moves.</div><div class="dialog-actions"><button class="btn primary" data-action="approve-entry">Confirm entry</button><button class="btn secondary" data-action="approval-back">Cancel</button></div>`;
  }
  async function approveEntry() {
    const { id, q, address } = context;
    await runOperation(
      ['Preparing entry', 'Confirming entry', 'Entries accepted'],
      async () => {
        if (wallet.require() !== address)
          throw new Error(
            'Your wallet changed. Review your entry and try again.',
          );
        updateRaffle(id, (r) => acceptEntry(r, address, q));
        show('detail', { id });
        toast(
          storageError || `${q} ${q === 1 ? 'entry' : 'entries'} accepted.`,
        );
      },
      () => show('detail', { id }),
      'Taking your shot.',
    );
  }
  var delay = (ms, signal) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(resolve, ms);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(t);
          reject(new Error('Cancelled'));
        },
        { once: true },
      );
    });
  async function runOperation(steps, finish, back, title) {
    if (operation) throw new Error('An action is already in progress.');
    const controller = new AbortController();
    operation = { controller, back };
    context = { type: 'progress' };
    $('#modal-kicker').textContent = 'ONE MOMENT';
    content.innerHTML = `<h2 class="modal-title" id="modal-title">${title}</h2><ol class="status-list" aria-live="polite">${steps.map((x, i2) => `<li data-stage="${i2}">${esc(x)}\u2026</li>`).join('')}</ol><div class="cancel-row"><button class="text-button" data-action="cancel-operation">Cancel</button></div>`;
    try {
      for (let i2 = 0; i2 < steps.length; i2++) {
        const li = $(`[data-stage="${i2}"]`);
        li.classList.add('current');
        await delay(
          matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 120
            : CONFIG.simulationDelay,
          controller.signal,
        );
        li.classList.remove('current');
        li.classList.add('done');
        li.textContent = '\u2713 ' + steps[i2];
      }
      if (controller.signal.aborted) return;
      await finish();
    } catch (e) {
      if (e.message !== 'Cancelled') {
        back();
        toast(e.message);
      }
    } finally {
      if (operation?.controller === controller) operation = null;
    }
  }
  function cancelOperation() {
    const op = operation;
    if (!op) return;
    op.controller.abort();
    operation = null;
    op.back();
    toast('Cancelled. Your input is still here.');
  }
  function confirmCloseEntries(id) {
    const r = getRaffle(id);
    context = { type: 'close-approval', id };
    content.innerHTML = `<h2 class="modal-title" id="modal-title">Lock this pool?</h2><p>${num(totalEntries(r))} accepted entries will form the entrant set. This closes entries early and enables the draw.</p><div class="notice">The app cannot reopen entries. Export a backup first if you want a recovery copy.</div><div class="dialog-actions"><button class="btn primary" data-action="confirm-close-entries" data-id="${id}">Close entries</button><button class="btn secondary" data-action="detail" data-id="${id}">Keep open</button></div>`;
  }
  async function startDraw(id) {
    const address = wallet.require();
    if (getRaffle(id).creator !== address)
      throw new Error('Reconnect the creator wallet to draw.');
    await runOperation(
      [
        'Locking entries',
        'Building entrant set',
        'Generating randomness',
        'Selecting entry',
        'Checking result',
        'Winner selected',
      ],
      async () => {
        if (wallet.require() !== address)
          throw new Error('Creator wallet changed. Reconnect and try again.');
        updateRaffle(id, (r) => drawRaffle(r, address));
        show('receipt', { id });
        toast(storageError || 'Winner selected. Receipt saved.');
      },
      () => show('detail', { id }),
      'Let the pool pick.',
    );
  }
  function renderReceipt(id) {
    const r = getRaffle(id),
      d2 = r?.receipt;
    if (!d2) throw new Error('This raffle has no draw receipt yet.');
    content.innerHTML = `<h2 class="modal-title" id="modal-title">${esc(r.title)}</h2><p class="modal-description">The full result.</p><div class="draw-result"><div class="eyebrow">WINNER</div><h3>${shortWallet(d2.winningWallet)}</h3><p class="winner-wallet">${d2.winningWallet}</p><p>ENTRY #${d2.winningEntry} \xB7 PRIZE ${esc(d2.prize)}</p></div><div class="receipt"><span class="tag simulated">NO ONCHAIN SETTLEMENT</span><dl>${[
      ['Raffle ID', d2.raffleId],
      ['Winning wallet', d2.winningWallet],
      ['Winning entry', '#' + d2.winningEntry],
      ['Total entries', num(d2.totalEntries)],
      ['Draw timestamp', new Date(d2.drawTimestamp).toISOString()],
      ['Randomness', 'Browser cryptographic randomness'],
      ['Settlement', 'None \xB7 no SOL is transferred'],
      ['Reference', d2.reference],
    ]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
      .join(
        '',
      )}</dl></div><div class="dialog-actions"><button class="btn primary" data-action="download-receipt" data-id="${id}">Download receipt</button><button class="btn secondary" data-action="copy-receipt" data-id="${id}">Copy receipt</button><button class="btn secondary" data-action="share-card" data-id="${id}">Download share card</button><button class="btn secondary" data-action="detail" data-id="${id}">Raffle details</button></div>`;
  }
  function renderHistory(tab = 'entries') {
    context = { type: 'history', tab };
    const w2 = wallet.connected() ? wallet.address : null,
      entered = w2
        ? state.raffles.filter(
            (r) => r.prizeType === 'SOL' && ownEntries(r, w2) > 0,
          )
        : [],
      created = w2
        ? state.raffles.filter((r) => r.prizeType === 'SOL' && r.creator === w2)
        : [],
      wins = entered.filter((r) => r.receipt?.winningWallet === w2),
      spent = entered.reduce(
        (n, r) =>
          n +
          r.allocations
            .filter((a2) => a2.wallet === w2)
            .reduce((a2, b2) => a2 + b2.cost, 0),
        0,
      ),
      wonSOL = wins
        .filter((r) => r.prizeType === 'SOL')
        .reduce((n, r) => n + r.prizeAmount, 0),
      list =
        tab === 'created'
          ? created
          : tab === 'wins'
            ? wins
            : tab === 'completed'
              ? entered.filter((r) => r.receipt && r.prizeType === 'SOL')
              : entered.filter((r) => !r.receipt);
    content.innerHTML = `<h2 class="modal-title" id="modal-title">Your shots. Your pools.</h2><p class="modal-description">${w2 ? shortWallet(w2) + ' \xB7 history in this browser' : 'Connect wallet to see history for your real wallet.'}</p>${storageError ? `<div class="notice error">${esc(storageError)}</div>` : ''}<div class="history-stats">${[
      ['Active raffles', entered.filter((r) => !r.receipt).length],
      [
        'Completed raffles',
        entered.filter((r) => r.receipt && r.prizeType === 'SOL').length,
      ],
      ['Wins', wins.length],
      ['SOL spent', num(roundSOL(spent))],
      ['SOL won', num(wonSOL)],
      ['Raffles created', created.length],
    ]
      .map(
        ([k, v]) =>
          `<div class="stat-box"><small>${k}</small><strong>${v}</strong></div>`,
      )
      .join(
        '',
      )}</div><p class="field-hint">Totals come from entries saved in this browser. Your wallet balance appears in the wallet dialog.</p><div class="history-tabs" role="group" aria-label="Personal history">${[
      ['entries', 'Active entries'],
      ['completed', 'Completed'],
      ['wins', 'Wins'],
      ['created', 'Created by you'],
    ]
      .map(
        ([k, l2]) =>
          `<button class="filter ${k === tab ? 'active' : ''}" data-action="history-tab" data-tab="${k}" aria-pressed="${k === tab}">${l2}</button>`,
      )
      .join(
        '',
      )}</div><div class="history-list">${list.length ? list.map((r) => `<button class="history-row" data-action="${r.receipt ? 'receipt' : 'detail'}" data-id="${r.id}"><span><strong>${esc(r.title)}</strong><small>${r.id} \xB7 ${ownEntries(r, w2)} of your entries</small></span><span>${esc(prizeLabel(r))}<small>${remaining(r)}</small></span></button>`).join('') : `<div class="empty"><h3>${w2 ? 'No ' + (tab === 'created' ? 'created raffles' : tab === 'wins' ? 'wins' : tab === 'completed' ? 'completed entries' : 'active entries') + ' yet.' : 'Your wallet, your history.'}</h3><p>${w2 ? 'Find a pool or create one to get started.' : 'Saved browser data is never treated as a wallet connection.'}</p><button class="btn primary" data-action="${w2 ? 'browse' : 'wallet'}">${w2 ? 'Explore raffles' : 'Connect wallet'}</button></div>`}</div><div class="dialog-actions"><button class="btn secondary" data-action="export">Export backup</button><label class="btn secondary file-action" tabindex="0">Import backup<input type="file" id="import-backup" accept="application/json,.json" aria-label="Import RAFFLER backup"></label><button class="btn secondary" data-action="create">Create raffle</button></div><div id="import-result" role="status"></div><p class="field-hint" style="margin-top:16px">Backups contain public addresses and raffle activity. Duplicate raffle IDs are kept as-is; imports never replace an existing raffle. Checksums detect damage, not authenticity.</p>`;
  }
  async function importBackup(file) {
    if (!file) return;
    try {
      if (file.size > CONFIG.maxBackupBytes)
        throw new Error('Backup must be smaller than 5 MB.');
      const incoming = await parseBackup(await file.text());
      for (const raffle of incoming.raffles) {
        if (raffle.image) {
          const image = new Image();
          image.src = raffle.image;
          try {
            await image.decode();
          } catch {
            throw new Error(
              `The image in ${raffle.id} is damaged. No data was imported.`,
            );
          }
        }
      }
      const merged = mergeBackups(latestState(), incoming);
      commit(() => merged.state);
      renderHistory(context?.tab);
      $('#import-result').innerHTML =
        `<div class="notice success">${merged.added} raffles imported. ${merged.duplicates} duplicate IDs skipped. ${storageError ? esc(storageError) : 'Existing records preserved.'}</div>`;
    } catch (e) {
      if ($('#import-result'))
        $('#import-result').innerHTML =
          `<div class="notice error">${esc(e.message)} No data was imported.</div>`;
      else toast(e.message);
    }
  }
  function download(data, name, type = 'application/json') {
    const blob =
        data instanceof Blob
          ? data
          : new Blob(
              [typeof data === 'string' ? data : JSON.stringify(data, null, 2)],
              { type },
            ),
      url = URL.createObjectURL(blob),
      a2 = document.createElement('a');
    a2.href = url;
    a2.download = name;
    document.body.append(a2);
    a2.click();
    a2.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1e4);
  }
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied to clipboard.');
    } catch {
      content.insertAdjacentHTML(
        'beforeend',
        `<label class="field" style="margin-top:20px">Copy manually<textarea readonly id="manual-copy">${esc(text)}</textarea></label>`,
      );
      $('#manual-copy').select();
      toast('Clipboard unavailable. Copy the text below.');
    }
  }
  function raffleURL(id) {
    const u2 = new URL(location.href);
    u2.hash = 'raffle=' + id;
    return u2.href;
  }
  function renderShare(id) {
    const r = getRaffle(id);
    content.innerHTML = `<h2 class="modal-title" id="modal-title">Bring your people.</h2><p class="modal-description">${esc(r.title)} \xB7 ${esc(prizeLabel(r))}</p><code class="wallet-address">${esc(raffleURL(id))}</code><div class="notice">This link opens the raffle in browsers that already have it. To share it with someone new, export a backup for them to import.</div><div class="dialog-actions"><button class="btn primary" data-action="copy-link" data-id="${id}">Copy raffle link</button><button class="btn secondary" data-action="share-card" data-id="${id}">Download share card</button><button class="btn secondary" data-action="export">Export backup</button><button class="btn secondary" data-action="detail" data-id="${id}">Back to raffle</button></div>`;
  }
  async function shareCard(id) {
    const r = getRaffle(id);
    await document.fonts.ready;
    const c2 = document.createElement('canvas');
    c2.width = 1200;
    c2.height = 630;
    const x = c2.getContext('2d');
    x.fillStyle = '#F4F0EA';
    x.fillRect(0, 0, 1200, 630);
    x.fillStyle = '#111';
    x.fillRect(43, 43, 1117, 547);
    x.fillStyle = r.color;
    x.fillRect(35, 35, 1117, 547);
    x.strokeStyle = '#111';
    x.lineWidth = 6;
    x.strokeRect(35, 35, 1117, 547);
    x.fillStyle = '#111';
    x.font = '900 37px Outfit';
    x.fillText('RAFFLER.', 75, 100);
    x.font = '700 19px monospace';
    x.fillText(r.id, 940, 100);
    x.font = '900 85px Outfit';
    x.fillText(prizeLabel(r), 75, 240, 1030);
    x.font = '800 42px Outfit';
    x.fillText(r.title, 75, 320, 1030);
    x.font = '600 25px DM Sans';
    x.fillText(
      r.receipt
        ? `Winner: ${shortWallet(r.receipt.winningWallet)} \xB7 Entry #${r.receipt.winningEntry}`
        : `${num(r.entryPrice)} SOL / entry \xB7 ${num(totalEntries(r))} entries`,
      75,
      390,
      1030,
    );
    x.fillStyle = '#111';
    x.fillRect(75, 457, 1037, 75);
    x.fillStyle = '#fff';
    x.font = '800 21px Outfit';
    x.fillText(
      'ONE POOL \xB7 ONE WINNER \xB7 EVERY ENTRY COUNTS',
      99,
      502,
      990,
    );
    const blob = await new Promise((resolve) =>
      c2.toBlob(resolve, 'image/png'),
    );
    if (!blob) throw new Error('Share card could not be generated. Try again.');
    download(blob, `${id}-share-card.png`, 'image/png');
    toast('Share card downloaded.');
  }
  function renderSettings() {
    content.innerHTML = `<h2 class="modal-title" id="modal-title">Your connection.</h2><p class="modal-description">Optional real balance reads. Raffles work when the RPC is unavailable.</p><form id="settings-form" class="settings-form"><label class="field">Solana RPC endpoint<input name="rpcUrl" type="url" value="${esc(settings.rpcUrl)}" required><span class="field-hint">Public HTTPS only. No secret API keys. Your public wallet address is sent here for balance reads.</span></label><label class="field">Network label<select name="network">${['mainnet-beta', 'devnet', 'testnet'].map((x) => `<option ${settings.network === x ? 'selected' : ''}>${x}</option>`).join('')}</select><span class="field-hint">Match the endpoint\u2019s network. This label does not change the endpoint\u2019s network.</span></label><div id="settings-error" role="alert"></div><div class="dialog-actions"><button class="btn primary" type="submit">Save RPC settings</button><button class="btn secondary" type="button" data-action="rpc-defaults">Restore defaults</button></div></form><hr class="modal-rule"><h3>Browser data</h3><p class="field-hint" style="margin-top:12px">${storageError ? esc(storageError) : 'Your raffles are saved in this browser.'}</p><div class="dialog-actions"><button class="btn secondary" data-action="export">Export backup</button>${damagedRaw ? '<button class="btn secondary" data-action="damaged-export">Export damaged data</button><button class="btn secondary" data-action="reset-damaged">Reset damaged data</button>' : ''}</div>`;
    $('#settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        const d2 = Object.fromEntries(new FormData(e.target));
        settings = {
          rpcUrl: validateRPC(d2.rpcUrl, d2.network),
          network: d2.network,
        };
        wallet.settings = settings;
        try {
          localStorage.setItem('raffler:rpc', JSON.stringify(settings));
        } catch {}
        void wallet.refreshBalance();
        toast('RPC settings applied.');
      } catch (e2) {
        $('#settings-error').innerHTML =
          `<div class="notice error">${esc(e2.message)}</div>`;
      }
    });
  }
  function renderAbout() {
    content.innerHTML =
      '<h2 class="modal-title" id="modal-title">Your wallet. Clear rules.</h2><p>Connect a Solana wallet, choose a pool, and see your cost and odds before entering.</p><div class="notice">RAFFLER records raffles, entries and draws in your browser. Your wallet shares its public address and balance only. No SOL is deposited, charged or paid out.</div><h3>Check every result</h3><p>The winner is picked with your browser\u2019s cryptographic randomness. Receipts record the winning wallet, entry, time, and reference. History stays on this device and can be backed up or moved with an export.</p><div class="dialog-actions"><button class="btn primary" data-action="browse">Explore pools</button></div>';
  }
  function updatePhoneDemo() {
    const r = state.raffles.find(
        (r2) => r2.prizeType === 'SOL' && status(r2) === 'active',
      ),
      done = state.raffles.find((r2) => r2.receipt && r2.prizeType === 'SOL'),
      detail = {
        wallet: wallet.connected()
          ? shortWallet(wallet.address)
          : 'Connect a Solana wallet',
      };
    if (r)
      Object.assign(detail, {
        title: r.title,
        prize: prizeLabel(r),
        price: num(r.entryPrice),
        capacity: num(r.maxEntries),
        entries: num(totalEntries(r)),
        cost: num(roundSOL(5 * r.entryPrice)),
        odds: pct(odds(5, totalEntries(r) + 5)),
        id: r.id,
      });
    if (done)
      Object.assign(detail, {
        completedId: done.id,
        winner: shortWallet(done.receipt.winningWallet),
        winningEntry: done.receipt.winningEntry,
        completedEntries: done.receipt.totalEntries,
        completedPrize: prizeLabel(done),
      });
    window.dispatchEvent(new CustomEvent('raffler:phone-data', { detail }));
  }
  function setFilterButtons() {
    $$('[data-filter]').forEach((b2) => {
      b2.classList.toggle('active', b2.dataset.filter === filter);
      b2.setAttribute('aria-pressed', String(b2.dataset.filter === filter));
    });
  }
  var activities = [
    'SOL pools. Clear entry prices. Odds you can see.',
    'Your wallet. Your entries. Your history.',
    'Set the prize. Choose the rules. Bring your people.',
    'One pool. One winner. Every detail in the receipt.',
    'Built around Solana wallets and community energy.',
  ];
  setInterval(() => {
    if (!activityPaused && !document.hidden) {
      activityIndex = (activityIndex + 1) % activities.length;
      $('#activity-text').textContent = activities[activityIndex];
    }
  }, 5500);
  var previousStatuses = '';
  setInterval(() => {
    if (document.hidden) return;
    const now = Date.now();
    $$('[data-countdown]').forEach((e) => {
      const r = getRaffle(e.dataset.countdown);
      if (r)
        e.textContent =
          (e.classList.contains('time-left') ? '\u25F7 ' : '') +
          remaining(r, now);
    });
    const current = state.raffles.map((r) => status(r, now)).join('|');
    if (current !== previousStatuses) {
      if (previousStatuses) {
        renderGrid();
        if (context?.type === 'detail') renderDetail(context.id);
      }
      previousStatuses = current;
    }
    if (context?.type === 'detail') updateEntryQuote();
  }, 1e3);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      renderGrid();
      if (context?.type === 'detail') renderDetail(context.id);
    }
  });
  window.addEventListener('storage', (e) => {
    if (e.key === CONFIG.storageKey && e.newValue && !operation) {
      try {
        state = ensureShowcase(validateState(JSON.parse(e.newValue)));
        renderGrid();
        renderPast();
        if (context?.type === 'detail') renderDetail(context.id);
        if (context?.type === 'history') renderHistory(context.tab);
      } catch {
        toast('Another tab saved unreadable data. This session was preserved.');
      }
    }
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'search') {
      query = e.target.value;
      renderGrid();
    }
    if (e.target.id === 'custom-quantity') {
      quantity = Number(e.target.value);
      updateEntryQuote();
    }
    if (e.target.closest('#create-form')) captureDraft();
  });
  document.addEventListener('change', async (e) => {
    if (e.target.id === 'sort') {
      sort = e.target.value;
      renderGrid();
    }
    if (e.target.name === 'prizeType' || e.target.name === 'endCondition') {
      updatePrizeType();
      captureDraft();
    }
    if (e.target.id === 'import-backup') await importBackup(e.target.files[0]);
    if (e.target.id === 'project-image') {
      const f2 = e.target.files[0];
      if (!f2) return;
      try {
        if (f2.size > CONFIG.maxImageBytes)
          throw new Error('Choose an image smaller than 300 KB.');
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(f2.type))
          throw new Error('Choose PNG, JPG, or WebP.');
        const image = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('Image could not be read.'));
          reader.readAsDataURL(f2);
        });
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = () =>
            reject(new Error('This image file is damaged. Choose another.'));
          img.src = image;
        });
        createImage = image;
        if ($('#image-state'))
          $('#image-state').innerHTML =
            `<img class="image-preview" src="${esc(image)}" alt="Selected project image"><button type="button" class="text-button" data-action="remove-image">Remove image</button>`;
      } catch (error) {
        toast(error.message);
        e.target.value = '';
      }
    }
  });
  document.addEventListener('keydown', (e) => {
    if (
      e.target.matches('.file-action') &&
      (e.key === 'Enter' || e.key === ' ')
    ) {
      e.preventDefault();
      $('input', e.target).click();
    }
  });
  document.addEventListener('click', async (e) => {
    const b2 = e.target.closest('[data-action],[data-filter],[data-step]');
    if (!b2 || b2.disabled) return;
    try {
      if (b2.dataset.filter) {
        filter = b2.dataset.filter;
        setFilterButtons();
        renderGrid();
        return;
      }
      const a2 = b2.dataset.action,
        id = b2.dataset.id;
      if (a2 === 'close') closeModal();
      else if (a2 === 'create') {
        if (context?.type === 'create') captureDraft();
        show('create');
      } else if (a2 === 'detail') show('detail', { id });
      else if (a2 === 'receipt') show('receipt', { id });
      else if (a2 === 'quantity') {
        quantity = Number(b2.dataset.quantity);
        if ($('#custom-quantity')) $('#custom-quantity').value = '';
        updateEntryQuote();
      } else if (a2 === 'enter') await startEntry(id);
      else if (a2 === 'approve-entry') await approveEntry();
      else if (a2 === 'approval-back') show('detail', { id: context.id });
      else if (a2 === 'wallet') {
        if (context?.type === 'create') captureDraft();
        returnContext = context;
        show('wallet');
      } else if (a2 === 'connect-inline') await connectInline();
      else if (a2 === 'connect' || a2 === 'select-wallet') {
        if (a2 === 'select-wallet') await wallet.select(b2.dataset.walletId);
        else await wallet.connect();
        toast('Wallet connected.');
        if (returnContext) {
          const c2 = returnContext;
          returnContext = null;
          show(c2.type, c2);
        } else renderWallet();
      } else if (a2 === 'refresh-wallets') {
        renderWallet();
      } else if (a2 === 'wallet-back') {
        if (returnContext) {
          const c2 = returnContext;
          returnContext = null;
          show(c2.type, c2);
        } else closeModal();
      } else if (a2 === 'disconnect') {
        await wallet.disconnect();
        renderWallet();
        toast('Wallet disconnected. Browser history preserved.');
      } else if (a2 === 'balance') await wallet.refreshBalance();
      else if (a2 === 'history') show('history');
      else if (a2 === 'history-tab') renderHistory(b2.dataset.tab);
      else if (a2 === 'about') show('about');
      else if (a2 === 'settings') show('settings');
      else if (a2 === 'share') show('share', { id });
      else if (a2 === 'copy-link') await copy(raffleURL(id));
      else if (a2 === 'share-card') await shareCard(id);
      else if (a2 === 'download-receipt') {
        download(getRaffle(id).receipt, `${id}-receipt.json`);
        toast('Draw receipt downloaded.');
      } else if (a2 === 'copy-receipt')
        await copy(JSON.stringify(getRaffle(id).receipt, null, 2));
      else if (a2 === 'export') {
        download(await exportBackup(state), 'raffler-backup.json');
        toast('Backup downloaded. Keep it somewhere safe.');
      } else if (a2 === 'damaged-export') {
        download(damagedRaw, 'raffler-damaged-data.json');
        toast('Damaged data downloaded.');
      } else if (a2 === 'reset-damaged')
        content.insertAdjacentHTML(
          'beforeend',
          '<div class="notice error">Export the damaged data first. Reset replaces it with the current session.<div class="dialog-actions"><button class="btn secondary" data-action="damaged-export">Download damaged data</button><button class="btn primary" data-action="confirm-reset">Reset browser data</button></div></div>',
        );
      else if (a2 === 'confirm-reset') {
        damagedRaw = null;
        commit((s2) => s2);
        renderSettings();
        toast(storageError || 'Current session saved.');
      } else if (a2 === 'rpc-defaults') {
        settings = { rpcUrl: CONFIG.rpcUrl, network: CONFIG.network };
        wallet.settings = settings;
        try {
          localStorage.removeItem('raffler:rpc');
        } catch {}
        void wallet.refreshBalance();
        renderSettings();
        toast('Default RPC restored.');
      } else if (a2 === 'cancel-operation') cancelOperation();
      else if (a2 === 'close-entries') confirmCloseEntries(id);
      else if (a2 === 'entrants-csv') {
        const r = getRaffle(id);
        download(
          'wallet,entries,cost_sol,time\n' +
            r.allocations
              .map(
                (x) =>
                  `${x.wallet},${x.count},${x.cost},${new Date(x.at).toISOString()}`,
              )
              .join('\n') +
            '\n',
          `${id}-entrants.csv`,
          'text/csv',
        );
        toast('Entrants downloaded.');
      } else if (a2 === 'duplicate') {
        const r = getRaffle(id);
        createDraft = {
          title: r.title,
          description: r.description,
          prizeType: 'SOL',
          prizeAmount: String(r.prizeAmount),
          entryPrice: String(r.entryPrice),
          maxEntries: String(r.maxEntries),
          maxPerWallet: String(r.maxPerWallet),
          endCondition: r.endCondition,
          endsAt: defaultDraft().endsAt,
        };
        createImage = r.image;
        show('create');
      } else if (a2 === 'delete-raffle') {
        context = { type: 'delete-approval', id };
        content.innerHTML = `<h2 class="modal-title" id="modal-title">Delete this raffle?</h2><p>${esc(getRaffle(id).title)} and its entries will be removed from this browser. Export a backup first if you may need it again.</p><div class="dialog-actions"><button class="btn primary" data-action="confirm-delete" data-id="${id}">Delete raffle</button><button class="btn secondary" data-action="detail" data-id="${id}">Keep it</button></div>`;
      } else if (a2 === 'confirm-delete') {
        const r = getRaffle(id);
        if (r.creator !== wallet.require())
          throw new Error('Connect the creator wallet to delete this raffle.');
        commit((st) => ({
          ...st,
          raffles: st.raffles.filter((x) => x.id !== id),
        }));
        closeModal();
        toast('Raffle deleted.');
      } else if (a2 === 'confirm-close-entries') {
        updateRaffle(id, (r) => closeRaffle(r, wallet.require()));
        show('detail', { id });
        toast('Entries locked. Ready to draw.');
      } else if (a2 === 'draw') await startDraw(id);
      else if (a2 === 'remove-image') {
        createImage = null;
        $('#project-image').value = '';
        $('#image-state').innerHTML = '';
      } else if (a2 === 'pause-activity') {
        activityPaused = !activityPaused;
        b2.textContent = activityPaused ? 'Resume' : 'Pause';
        b2.setAttribute('aria-pressed', String(activityPaused));
      } else if (a2 === 'browse') {
        closeModal();
        $('#raffles').scrollIntoView({ behavior: 'smooth' });
      } else if (a2 === 'clear-search') {
        query = '';
        filter = 'active';
        $('#search').value = '';
        setFilterButtons();
        renderGrid();
      }
    } catch (error) {
      toast(
        error.message || 'Something went wrong. Your input has been preserved.',
      );
    }
  });
  function handleLink() {
    const m = location.hash.match(/^#raffle=(RFL-[A-F0-9]{6})$/);
    if (m) show('detail', { id: m[1] });
  }
  window.addEventListener('hashchange', handleLink);
  function registerTools() {
    const mc = document.modelContext;
    if (!mc?.registerTool) return;
    const life = new AbortController();
    const defs = [
      {
        name: 'list_raffles',
        title: 'List RAFFLER pools',
        description:
          'Read the raffle IDs, prizes, and status saved in this browser.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: (input) => {
          if (input && Object.keys(input).length)
            throw new Error('No input fields accepted.');
          return state.raffles.map((r) => ({
            id: r.id,
            title: r.title,
            prize: prizeLabel(r),
            status: status(r),
          }));
        },
      },
      {
        name: 'open_raffle',
        title: 'Open raffle details',
        description: 'Open a saved raffle dialog. Does not enter the raffle.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string', pattern: '^RFL-[A-F0-9]{6}$' } },
          required: ['id'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: (input) => {
          if (
            !input ||
            Object.keys(input).length !== 1 ||
            typeof input.id !== 'string' ||
            !getRaffle(input.id)
          )
            throw new Error('Unknown raffle ID.');
          show('detail', { id: input.id });
          return { id: input.id, opened: true };
        },
      },
      {
        name: 'start_raffle_creation',
        title: 'Start creating a raffle',
        description: 'Open the creation form. Does not publish a raffle.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input) => {
          if (input && Object.keys(input).length)
            throw new Error('No input fields accepted.');
          show('create');
          return { formOpened: true };
        },
      },
    ];
    for (const d2 of defs)
      try {
        Promise.resolve(mc.registerTool(d2, { signal: life.signal })).catch(
          () => {},
        );
      } catch {}
    window.addEventListener('pagehide', () => life.abort(), { once: true });
  }
  renderGrid();
  renderPast();
  updatePhoneDemo();
  handleLink();
  registerTools();
  if (!damagedRaw) commit((s2) => s2);
  if (storageError) toast(storageError);
  void wallet.reconnect();
})();
