import { CONFIG } from './config.js';
import {
  initialState,
  ensureShowcase,
  validateState,
  totalEntries,
  ownEntries,
  walletCount,
  odds,
  remaining,
  status,
  shortWallet,
  prizeLabel,
  entryError,
  acceptEntry,
  validateCreation,
  createRaffle,
  drawRaffle,
  closeRaffle,
  exportBackup,
  parseBackup,
  mergeBackups,
  roundSOL,
} from './core.js';
import { SolanaWallet, validateRPC } from './wallet.js';
const $ = (s, root = document) => root.querySelector(s),
  $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const num = (n) =>
    Number(n).toLocaleString('en-US', { maximumFractionDigits: 9 }),
  pct = (n) => `${n.toFixed(2)}%`,
  date = (n) =>
    new Date(n).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
let storageError = '',
  damagedRaw = null;
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
let state = load(),
  settings = { rpcUrl: CONFIG.rpcUrl, network: CONFIG.network };
try {
  const s = JSON.parse(localStorage.getItem('raffler:rpc'));
  if (s) {
    validateRPC(s.rpcUrl, s.network);
    settings = s;
  }
} catch {}
const modal = $('#modal'),
  content = $('#modal-content');
let context = null,
  returnContext = null,
  filter = 'active',
  query = '',
  sort = 'featured',
  quantity = 5,
  createDraft = null,
  createImage = null,
  operation = null,
  toastTimer,
  activityPaused = false,
  activityIndex = 0;
const wallet = new SolanaWallet({ settings, changed: walletChanged });
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('#toast').hidden = true), 6000);
}
function latestState() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (raw && !damagedRaw) {
      const s = ensureShowcase(validateState(JSON.parse(raw)));
      if (s.updatedAt > state.updatedAt) state = s;
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
  commit((s) => {
    if (!s.raffles.some((r) => r.id === id))
      throw new Error('This raffle is no longer available in this browser.');
    return {
      ...s,
      raffles: s.raffles.map((r) => (r.id === id ? update(r) : r)),
    };
  });
}
const getRaffle = (id) => state.raffles.find((r) => r.id === id);
function walletChanged() {
  $('#wallet-button').textContent = wallet.connecting
    ? 'Connecting…'
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
              (r.endCondition === 'timer' && r.endsAt - now < 86400000) ||
              r.maxEntries - totalEntries(r) <= 10)
          : status(r, now) !== 'completed',
    );
  list = list.filter((r) =>
    `${r.title} ${prizeLabel(r)} ${r.prizeSymbol} ${r.id} ${r.creatorName || r.creator}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  if (sort === 'price') list.sort((a, b) => a.entryPrice - b.entryPrice);
  else if (sort === 'entries')
    list.sort((a, b) => totalEntries(b) - totalEntries(a));
  else if (sort === 'ending' || filter === 'ending')
    list.sort(
      (a, b) =>
        (status(a) === 'ready' ? 0 : a.endsAt || Infinity) -
        (status(b) === 'ready' ? 0 : b.endsAt || Infinity),
    );
  else list.sort((a, b) => b.createdAt - a.createdAt);
  $('#raffle-grid').innerHTML = list.length
    ? list.map(card).join('')
    : state.raffles.length
      ? '<div class="empty"><h3>No pools found.</h3><p>Try another search or filter, or create a pool for your community.</p><button class="btn primary" data-action="clear-search">Reset search & filters</button></div>'
      : '<div class="empty"><h3>No raffles yet.</h3><p>Create the first pool for your community, or import a backup.</p><button class="btn primary" data-action="create">Create a raffle ＋</button></div>';
}
function card(r) {
  const n = totalEntries(r),
    me = ownEntries(r, wallet.address),
    s = status(r),
    prize = prizeLabel(r);
  return `<article class="raffle-card" style="--card-color:${r.color}"><div class="card-prize">${r.image ? `<img class="card-project-image" src="${esc(r.image)}" alt="Project image for ${esc(r.title)}">` : ''}<div class="card-prize-top"><span class="tag">${r.prizeType.toUpperCase()} PRIZE</span><span class="card-id">${r.id}</span></div><div><div class="prize-value ${prize.length > 12 ? 'long' : ''}">${esc(prize)}</div><div class="prize-sub">${s === 'completed' ? 'RESULT RECORDED' : 'ONE WINNER. ALL YOURS.'}</div></div></div><div class="card-body"><h3>${esc(r.title)}</h3><div class="creator">by <span title="${r.creator}">${esc(r.creatorName || shortWallet(r.creator))}</span>${r.creator === wallet.address ? '<span class="vault">Your pool</span>' : ''}</div><div class="card-metrics"><div class="metric"><small>Entry price</small><strong>${num(r.entryPrice)} SOL</strong></div><div class="metric"><small>Total entries</small><strong>${num(n)}</strong></div><div class="metric"><small>Wallets</small><strong>${num(walletCount(r))}</strong></div></div><div class="capacity"><div class="capacity-meta"><span>${num(n)} / ${num(r.maxEntries)} spots</span><span>${Math.round((n / r.maxEntries) * 100)}% filled</span></div><div class="capacity-track"><span style="width:${(n / r.maxEntries) * 100}%"></span></div></div><div class="card-bottom"><span class="time-left ${s === 'ready' || r.endsAt - Date.now() < 7200000 ? 'urgent' : ''}" data-countdown="${r.id}">◷ ${remaining(r)}</span><button class="btn ${s === 'completed' ? 'secondary' : 'primary'}" data-action="${s === 'completed' ? 'receipt' : 'detail'}" data-id="${r.id}">${s === 'completed' ? 'View receipt' : s === 'ready' ? 'View draw' : 'Take a shot'}</button></div><div class="card-user">Your entries: ${me} · Current odds: ${pct(odds(me, n))}</div></div></article>`;
}
function renderPast() {
  $('#past-list').innerHTML =
    state.raffles
      .filter((r) => r.receipt && r.prizeType === 'SOL')
      .sort((a, b) => b.receipt.drawTimestamp - a.receipt.drawTimestamp)
      .map(
        (r) =>
          `<button class="past-row" style="--row-color:${r.color}" data-action="receipt" data-id="${r.id}"><span class="past-icon">◎</span><span><span class="past-title">${esc(r.title)}</span><span class="past-sub">${num(totalEntries(r))} entries · ${shortWallet(r.receipt.winningWallet)}</span></span><span class="past-value">${esc(prizeLabel(r))}<small>View receipt</small></span></button>`,
      )
      .join('') ||
    '<div class="empty"><h3>No receipts yet.</h3><p>Completed draws will appear here.</p></div>';
}
function renderDetail(id) {
  const r = getRaffle(id);
  if (!r || r.prizeType !== 'SOL') {
    content.innerHTML =
      '<h2 class="modal-title" id="modal-title">This pool isn’t here.</h2><p>This raffle isn’t saved in this browser. Ask its creator for a backup to import.</p>';
    return;
  }
  const n = totalEntries(r),
    s = status(r),
    mine = wallet.address === r.creator;
  content.innerHTML = `<h2 class="modal-title" id="modal-title">${esc(r.title)}</h2><p class="modal-description">${esc(r.description)}</p><div class="detail-prize" style="--card-color:${r.color}"><div><small>PRIZE</small><div class="detail-prize-value">${esc(prizeLabel(r))}</div></div><span class="tag">${s === 'active' ? 'OPEN' : s === 'ready' ? 'READY TO DRAW' : 'COMPLETED'}</span></div><div class="detail-grid"><div class="stat-box"><small>Total accepted entries</small><strong>${num(n)}</strong></div><div class="stat-box"><small>Unique wallets</small><strong>${num(walletCount(r))}</strong></div><div class="stat-box"><small>Your entries</small><strong id="detail-own">${ownEntries(r, wallet.address)}</strong></div><div class="stat-box"><small>Entry proceeds</small><strong>${num(roundSOL(n * r.entryPrice))} SOL</strong></div></div><div class="detail-meta"><span>${r.id}<br>Creator: <span title="${r.creator}">${shortWallet(r.creator)}</span></span><span data-countdown="${r.id}">${remaining(r)}</span></div><p class="field-hint">${r.maxPerWallet} entries maximum per wallet. ${r.endCondition === 'timer' ? `Draw eligible at ${date(r.endsAt)}, or when sold out.` : 'Draw eligible when all spots sell out.'} Prize stays fixed; entry proceeds are separate.</p>${s === 'active' ? `<div class="entry-panel"><h3>Take your shot.</h3><div class="entry-options" role="group" aria-label="Number of entries">${[1, 5, 10].map((q) => `<button class="quantity-btn ${quantity === q ? 'active' : ''}" data-action="quantity" data-quantity="${q}" aria-pressed="${quantity === q}">${q}</button>`).join('')}<label><span class="sr-only">Custom number of entries</span><input class="custom-quantity" type="number" id="custom-quantity" min="1" max="${r.maxEntries}" step="1" placeholder="Custom" value="${[1, 5, 10].includes(quantity) ? '' : quantity}"></label></div><div class="cost-row"><div><small>TOTAL · ${num(r.entryPrice)} SOL / ENTRY</small><strong id="entry-total"></strong></div><div><small>ESTIMATED ODDS AFTER ENTRY</small><strong id="entry-odds"></strong></div></div><p class="field-hint" id="entry-limit"></p><p class="error-inline" id="entry-error" role="status"></p><button class="btn primary" data-action="enter" data-id="${r.id}" id="enter-button">Enter raffle</button><p class="field-hint" style="margin-top:12px"></p></div>` : s === 'completed' ? `<div class="notice success">Winner: ${shortWallet(r.receipt.winningWallet)} · Entry #${r.receipt.winningEntry}</div><button class="btn primary" data-action="receipt" data-id="${r.id}">Inspect draw receipt</button>` : `<div class="notice">Entries are locked. ${mine ? 'You can draw the winner.' : 'Waiting for the creator to draw.'}</div>`}${mine ? `<div class="admin-panel"><h3>Creator controls</h3><p>You created this raffle.</p>${s === 'active' ? `<button class="btn secondary small" data-action="close-entries" data-id="${id}" ${n ? '' : 'disabled'}>Close entries early</button>` : s === 'ready' ? `<button class="btn primary" data-action="draw" data-id="${id}" ${n ? '' : 'disabled'}>Draw winner</button>` : '<p>Draw complete.</p>'}${!n ? '<p class="field-hint">Accept at least one entry before closing or drawing.</p>' : ''}<div class="dialog-actions"><button class="btn secondary small" data-action="entrants-csv" data-id="${id}" ${n ? '' : 'disabled'}>Download entrants (CSV)</button><button class="btn secondary small" data-action="duplicate" data-id="${id}">Duplicate</button><button class="btn secondary small" data-action="delete-raffle" data-id="${id}">Delete</button></div></div>` : ''}<div class="dialog-actions"><button class="btn secondary small" data-action="share" data-id="${id}">Share raffle</button><button class="btn secondary small" data-action="history">My entries</button></div>`;
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
    : '—';
  $('#entry-odds').textContent = valid
    ? pct(odds(me + quantity, n + quantity))
    : '—';
  $('#detail-own').textContent = me;
  $('#entry-limit').textContent =
    `${r.maxEntries - n} spots left · Your wallet can add ${Math.max(0, r.maxPerWallet - me)} more entries.`;
  const err = wallet.connected()
    ? entryError(r, wallet.address, quantity)
    : !valid
      ? 'Choose a positive whole number of entries.'
      : null;
  $('#entry-error').textContent = err || '';
  $('#enter-button').disabled = Boolean(err) || wallet.connecting;
  $('#enter-button').textContent = wallet.connecting
    ? 'Connecting…'
    : wallet.connected()
      ? 'Enter raffle'
      : 'Connect wallet to enter';
  $$('.quantity-btn', content).forEach((b) => {
    const yes = Number(b.dataset.quantity) === quantity;
    b.classList.toggle('active', yes);
    b.setAttribute('aria-pressed', String(yes));
  });
}
function captureDraft() {
  const f = $('#create-form');
  if (f) createDraft = Object.fromEntries(new FormData(f));
}
function defaultDraft() {
  const t = new Date(Date.now() + 86400000);
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
    endsAt: new Date(t - t.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16),
  };
}
function renderCreate() {
  const d = createDraft || defaultDraft();
  content.innerHTML = `<h2 class="modal-title" id="modal-title">Make a pool.<br><span class="sticker yellow">Bring your people.</span></h2><p class="modal-description">Set the prize and the rules.</p><form id="create-form" novalidate><div class="form-grid"><label class="full">Raffle title<input name="title" maxlength="70" placeholder="The community pot" value="${esc(d.title)}" required></label><label class="full">Description<textarea name="description" maxlength="600" placeholder="What’s in the pool? What should your community know?" required>${esc(d.description)}</textarea></label><input type="hidden" name="prizeType" value="SOL"><label>SOL prize amount<input name="prizeAmount" type="number" min="0.000000001" max="1000000000000" step="any" value="${esc(d.prizeAmount)}" required></label><label>Entry price · SOL<input name="entryPrice" type="number" min="0.000000001" max="1000" step="any" value="${esc(d.entryPrice)}" required></label><label>Maximum entries<input name="maxEntries" type="number" min="1" max="100000" step="1" value="${esc(d.maxEntries)}" required></label><label>Maximum per wallet<input name="maxPerWallet" type="number" min="1" step="1" value="${esc(d.maxPerWallet)}" required></label><label>End condition<select name="endCondition"><option value="timer" ${d.endCondition === 'timer' ? 'selected' : ''}>Timer or sold out</option><option value="soldout" ${d.endCondition === 'soldout' ? 'selected' : ''}>When sold out</option></select></label><label class="full" id="time-field" ${d.endCondition === 'soldout' ? 'hidden' : ''}>Draw time<input name="endsAt" type="datetime-local" value="${esc(d.endsAt)}"></label><label class="full">Project image · optional<input type="file" id="project-image" accept="image/png,image/jpeg,image/webp"><span class="field-hint">PNG, JPG, or WebP · up to 300 KB · embedded in your backup</span><span id="image-state">${createImage ? '<img class="image-preview" src="' + esc(createImage) + '" alt="Selected project image"><button type="button" class="text-button" data-action="remove-image">Remove image</button>' : ''}</span></label><div class="full"><span class="field">Creator wallet · connected address</span><code class="wallet-address" id="creator-wallet">${esc(wallet.address || 'Connect wallet to autofill your creator wallet')}</code><button class="btn secondary small" type="button" data-action="connect-inline">${wallet.connected() ? 'Manage wallet' : 'Connect wallet'}</button></div></div><div class="notice">Raffles are recorded in this browser. No SOL is deposited or paid out.</div><div id="create-errors" role="alert"></div><div class="dialog-actions"><button class="btn primary" type="submit">Create raffle</button><button class="btn secondary" type="button" data-action="close">Cancel</button></div></form>`;
  $('#create-form').addEventListener('submit', submitCreation);
  updatePrizeType();
}
function updatePrizeType() {
  const f = $('#create-form');
  if (f) $('#time-field').hidden = f.elements.endCondition.value === 'soldout';
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
      commit((s) => ({ ...s, raffles: [r, ...s.raffles] }));
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
const walletApps = [
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
      (w, i) =>
        `<button class="wallet-choice" data-action="select-wallet" data-wallet-id="${esc(w.id)}" ${wallet.connecting ? 'disabled' : ''}><span class="wallet-monogram" style="--wallet-color:${['#FFE135', '#FF3D82', '#2563EB', '#22C55E', '#FF6B2B'][i % 5]}">${esc(w.name.slice(0, 1))}</span><span><strong>${esc(w.name)}</strong><small>${wallet.connecting && wallet.name === w.name ? 'Waiting for approval…' : 'Detected · Solana'}</small></span><span class="tag">Connect</span></button>`,
    )
    .join('');
  content.innerHTML = `<h2 class="modal-title" id="modal-title">${connected ? 'Your wallet.' : 'Choose your wallet.'}</h2><p class="modal-description">${connected ? `${esc(wallet.name || 'Solana wallet')} connected. Your balance comes from the selected Solana RPC.` : 'Connect any installed wallet that supports Solana Wallet Standard.'}</p>${connected ? `<code class="wallet-address">${wallet.address}</code><div class="live-balance"><div class="balance-label">ACTUAL WALLET BALANCE · ${esc(settings.network.toUpperCase())}</div><strong>${wallet.balanceState === 'ready' ? num(wallet.balance) + ' SOL' : wallet.balanceState === 'loading' ? 'Checking…' : 'Unavailable'}</strong><p class="field-hint">${wallet.balanceAt ? `Checked ${date(wallet.balanceAt)}. Your balance is separate from raffle activity.` : esc(wallet.balanceError || 'Checking your SOL balance…')}</p></div><div class="balance-actions"><button class="btn secondary small" data-action="balance">Refresh balance</button><button class="text-button" data-action="settings">RPC settings</button></div><div class="dialog-actions"><button class="btn secondary" data-action="disconnect">Disconnect</button><button class="btn primary" data-action="wallet-back">${returnContext ? 'Back to raffle' : 'Done'}</button></div><details class="wallet-switch"><summary>Switch wallet</summary><div class="wallet-choices">${choices}</div></details>` : `<div class="wallet-choices">${choices || '<div class="notice">No compatible wallet detected. Install a Solana wallet, or open this site in your wallet’s browser.</div>'}</div><button class="text-button" data-action="refresh-wallets">Refresh wallet list</button><details class="wallet-switch" ${available.length ? '' : 'open'}><summary>Get a wallet</summary><div class="wallet-choices">${walletApps.map((w) => `<a class="wallet-choice" href="${w.url}" target="_blank" rel="noopener noreferrer"><span class="wallet-monogram">${w.name[0]}</span><span><strong>${w.name}</strong><small>Visit official site</small></span><span aria-hidden="true">↗</span></a>`).join('')}</div></details><p class="field-hint" style="margin-top:18px">Connecting shares your public address only. No payment or signature is requested.</p>${returnContext ? '<div class="dialog-actions"><button class="btn secondary" data-action="wallet-back">Back to raffle</button></div>' : ''}`}`;
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
  content.innerHTML = `<h2 class="modal-title" id="modal-title">Ready to take a shot?</h2><p class="modal-description">${esc(r.title)}</p><div class="detail-grid"><div class="stat-box"><small>Your new entries</small><strong>${quantity}</strong></div><div class="stat-box"><small>Entry cost</small><strong>${num(roundSOL(quantity * r.entryPrice))} SOL</strong></div></div><code class="wallet-address">${address}</code><div class="notice">Your wallet isn’t asked to sign or pay. Entries are saved in this browser and no SOL moves.</div><div class="dialog-actions"><button class="btn primary" data-action="approve-entry">Confirm entry</button><button class="btn secondary" data-action="approval-back">Cancel</button></div>`;
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
      toast(storageError || `${q} ${q === 1 ? 'entry' : 'entries'} accepted.`);
    },
    () => show('detail', { id }),
    'Taking your shot.',
  );
}
const delay = (ms, signal) =>
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
  content.innerHTML = `<h2 class="modal-title" id="modal-title">${title}</h2><ol class="status-list" aria-live="polite">${steps.map((x, i) => `<li data-stage="${i}">${esc(x)}…</li>`).join('')}</ol><div class="cancel-row"><button class="text-button" data-action="cancel-operation">Cancel</button></div>`;
  try {
    for (let i = 0; i < steps.length; i++) {
      const li = $(`[data-stage="${i}"]`);
      li.classList.add('current');
      await delay(
        matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 120
          : CONFIG.simulationDelay,
        controller.signal,
      );
      li.classList.remove('current');
      li.classList.add('done');
      li.textContent = '✓ ' + steps[i];
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
    d = r?.receipt;
  if (!d) throw new Error('This raffle has no draw receipt yet.');
  content.innerHTML = `<h2 class="modal-title" id="modal-title">${esc(r.title)}</h2><p class="modal-description">The full result.</p><div class="draw-result"><div class="eyebrow">WINNER</div><h3>${shortWallet(d.winningWallet)}</h3><p class="winner-wallet">${d.winningWallet}</p><p>ENTRY #${d.winningEntry} · PRIZE ${esc(d.prize)}</p></div><div class="receipt"><span class="tag simulated">NO ONCHAIN SETTLEMENT</span><dl>${[
    ['Raffle ID', d.raffleId],
    ['Winning wallet', d.winningWallet],
    ['Winning entry', '#' + d.winningEntry],
    ['Total entries', num(d.totalEntries)],
    ['Draw timestamp', new Date(d.drawTimestamp).toISOString()],
    ['Randomness', 'Browser cryptographic randomness'],
    ['Settlement', 'None · no SOL is transferred'],
    ['Reference', d.reference],
  ]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
    .join(
      '',
    )}</dl></div><div class="dialog-actions"><button class="btn primary" data-action="download-receipt" data-id="${id}">Download receipt</button><button class="btn secondary" data-action="copy-receipt" data-id="${id}">Copy receipt</button><button class="btn secondary" data-action="share-card" data-id="${id}">Download share card</button><button class="btn secondary" data-action="detail" data-id="${id}">Raffle details</button></div>`;
}
function renderHistory(tab = 'entries') {
  context = { type: 'history', tab };
  const w = wallet.connected() ? wallet.address : null,
    entered = w
      ? state.raffles.filter(
          (r) => r.prizeType === 'SOL' && ownEntries(r, w) > 0,
        )
      : [],
    created = w
      ? state.raffles.filter((r) => r.prizeType === 'SOL' && r.creator === w)
      : [],
    wins = entered.filter((r) => r.receipt?.winningWallet === w),
    spent = entered.reduce(
      (n, r) =>
        n +
        r.allocations
          .filter((a) => a.wallet === w)
          .reduce((a, b) => a + b.cost, 0),
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
  content.innerHTML = `<h2 class="modal-title" id="modal-title">Your shots. Your pools.</h2><p class="modal-description">${w ? shortWallet(w) + ' · history in this browser' : 'Connect wallet to see history for your real wallet.'}</p>${storageError ? `<div class="notice error">${esc(storageError)}</div>` : ''}<div class="history-stats">${[
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
      ([k, l]) =>
        `<button class="filter ${k === tab ? 'active' : ''}" data-action="history-tab" data-tab="${k}" aria-pressed="${k === tab}">${l}</button>`,
    )
    .join(
      '',
    )}</div><div class="history-list">${list.length ? list.map((r) => `<button class="history-row" data-action="${r.receipt ? 'receipt' : 'detail'}" data-id="${r.id}"><span><strong>${esc(r.title)}</strong><small>${r.id} · ${ownEntries(r, w)} of your entries</small></span><span>${esc(prizeLabel(r))}<small>${remaining(r)}</small></span></button>`).join('') : `<div class="empty"><h3>${w ? 'No ' + (tab === 'created' ? 'created raffles' : tab === 'wins' ? 'wins' : tab === 'completed' ? 'completed entries' : 'active entries') + ' yet.' : 'Your wallet, your history.'}</h3><p>${w ? 'Find a pool or create one to get started.' : 'Saved browser data is never treated as a wallet connection.'}</p><button class="btn primary" data-action="${w ? 'browse' : 'wallet'}">${w ? 'Explore raffles' : 'Connect wallet'}</button></div>`}</div><div class="dialog-actions"><button class="btn secondary" data-action="export">Export backup</button><label class="btn secondary file-action" tabindex="0">Import backup<input type="file" id="import-backup" accept="application/json,.json" aria-label="Import RAFFLER backup"></label><button class="btn secondary" data-action="create">Create raffle</button></div><div id="import-result" role="status"></div><p class="field-hint" style="margin-top:16px">Backups contain public addresses and raffle activity. Duplicate raffle IDs are kept as-is; imports never replace an existing raffle. Checksums detect damage, not authenticity.</p>`;
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
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
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
  const u = new URL(location.href);
  u.hash = 'raffle=' + id;
  return u.href;
}
function renderShare(id) {
  const r = getRaffle(id);
  content.innerHTML = `<h2 class="modal-title" id="modal-title">Bring your people.</h2><p class="modal-description">${esc(r.title)} · ${esc(prizeLabel(r))}</p><code class="wallet-address">${esc(raffleURL(id))}</code><div class="notice">This link opens the raffle in browsers that already have it. To share it with someone new, export a backup for them to import.</div><div class="dialog-actions"><button class="btn primary" data-action="copy-link" data-id="${id}">Copy raffle link</button><button class="btn secondary" data-action="share-card" data-id="${id}">Download share card</button><button class="btn secondary" data-action="export">Export backup</button><button class="btn secondary" data-action="detail" data-id="${id}">Back to raffle</button></div>`;
}
async function shareCard(id) {
  const r = getRaffle(id);
  await document.fonts.ready;
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 630;
  const x = c.getContext('2d');
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
      ? `Winner: ${shortWallet(r.receipt.winningWallet)} · Entry #${r.receipt.winningEntry}`
      : `${num(r.entryPrice)} SOL / entry · ${num(totalEntries(r))} entries`,
    75,
    390,
    1030,
  );
  x.fillStyle = '#111';
  x.fillRect(75, 457, 1037, 75);
  x.fillStyle = '#fff';
  x.font = '800 21px Outfit';
  x.fillText('ONE POOL · ONE WINNER · EVERY ENTRY COUNTS', 99, 502, 990);
  const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Share card could not be generated. Try again.');
  download(blob, `${id}-share-card.png`, 'image/png');
  toast('Share card downloaded.');
}
function renderSettings() {
  content.innerHTML = `<h2 class="modal-title" id="modal-title">Your connection.</h2><p class="modal-description">Optional real balance reads. Raffles work when the RPC is unavailable.</p><form id="settings-form" class="settings-form"><label class="field">Solana RPC endpoint<input name="rpcUrl" type="url" value="${esc(settings.rpcUrl)}" required><span class="field-hint">Public HTTPS only. No secret API keys. Your public wallet address is sent here for balance reads.</span></label><label class="field">Network label<select name="network">${['mainnet-beta', 'devnet', 'testnet'].map((x) => `<option ${settings.network === x ? 'selected' : ''}>${x}</option>`).join('')}</select><span class="field-hint">Match the endpoint’s network. This label does not change the endpoint’s network.</span></label><div id="settings-error" role="alert"></div><div class="dialog-actions"><button class="btn primary" type="submit">Save RPC settings</button><button class="btn secondary" type="button" data-action="rpc-defaults">Restore defaults</button></div></form><hr class="modal-rule"><h3>Browser data</h3><p class="field-hint" style="margin-top:12px">${storageError ? esc(storageError) : 'Your raffles are saved in this browser.'}</p><div class="dialog-actions"><button class="btn secondary" data-action="export">Export backup</button>${damagedRaw ? '<button class="btn secondary" data-action="damaged-export">Export damaged data</button><button class="btn secondary" data-action="reset-damaged">Reset damaged data</button>' : ''}</div>`;
  $('#settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const d = Object.fromEntries(new FormData(e.target));
      settings = {
        rpcUrl: validateRPC(d.rpcUrl, d.network),
        network: d.network,
      };
      wallet.settings = settings;
      try {
        localStorage.setItem('raffler:rpc', JSON.stringify(settings));
      } catch {}
      void wallet.refreshBalance();
      toast('RPC settings applied.');
    } catch (e) {
      $('#settings-error').innerHTML =
        `<div class="notice error">${esc(e.message)}</div>`;
    }
  });
}
function renderAbout() {
  content.innerHTML =
    '<h2 class="modal-title" id="modal-title">Your wallet. Clear rules.</h2><p>Connect a Solana wallet, choose a pool, and see your cost and odds before entering.</p><div class="notice">RAFFLER records raffles, entries and draws in your browser. Your wallet shares its public address and balance only. No SOL is deposited, charged or paid out.</div><h3>Check every result</h3><p>The winner is picked with your browser’s cryptographic randomness. Receipts record the winning wallet, entry, time, and reference. History stays on this device and can be backed up or moved with an export.</p><div class="dialog-actions"><button class="btn primary" data-action="browse">Explore pools</button></div>';
}
function updatePhoneDemo() {
  const r = state.raffles.find(
      (r) => r.prizeType === 'SOL' && status(r) === 'active',
    ),
    done = state.raffles.find((r) => r.receipt && r.prizeType === 'SOL'),
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
  $$('[data-filter]').forEach((b) => {
    b.classList.toggle('active', b.dataset.filter === filter);
    b.setAttribute('aria-pressed', String(b.dataset.filter === filter));
  });
}
const activities = [
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
let previousStatuses = '';
setInterval(() => {
  if (document.hidden) return;
  const now = Date.now();
  $$('[data-countdown]').forEach((e) => {
    const r = getRaffle(e.dataset.countdown);
    if (r)
      e.textContent =
        (e.classList.contains('time-left') ? '◷ ' : '') + remaining(r, now);
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
}, 1000);
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
    const f = e.target.files[0];
    if (!f) return;
    try {
      if (f.size > CONFIG.maxImageBytes)
        throw new Error('Choose an image smaller than 300 KB.');
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type))
        throw new Error('Choose PNG, JPG, or WebP.');
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Image could not be read.'));
        reader.readAsDataURL(f);
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
  const b = e.target.closest('[data-action],[data-filter],[data-step]');
  if (!b || b.disabled) return;
  try {
    if (b.dataset.filter) {
      filter = b.dataset.filter;
      setFilterButtons();
      renderGrid();
      return;
    }

    const a = b.dataset.action,
      id = b.dataset.id;
    if (a === 'close') closeModal();
    else if (a === 'create') {
      if (context?.type === 'create') captureDraft();
      show('create');
    } else if (a === 'detail') show('detail', { id });
    else if (a === 'receipt') show('receipt', { id });
    else if (a === 'quantity') {
      quantity = Number(b.dataset.quantity);
      if ($('#custom-quantity')) $('#custom-quantity').value = '';
      updateEntryQuote();
    } else if (a === 'enter') await startEntry(id);
    else if (a === 'approve-entry') await approveEntry();
    else if (a === 'approval-back') show('detail', { id: context.id });
    else if (a === 'wallet') {
      if (context?.type === 'create') captureDraft();
      returnContext = context;
      show('wallet');
    } else if (a === 'connect-inline') await connectInline();
    else if (a === 'connect' || a === 'select-wallet') {
      if (a === 'select-wallet') await wallet.select(b.dataset.walletId);
      else await wallet.connect();
      toast('Wallet connected.');
      if (returnContext) {
        const c = returnContext;
        returnContext = null;
        show(c.type, c);
      } else renderWallet();
    } else if (a === 'refresh-wallets') {
      renderWallet();
    } else if (a === 'wallet-back') {
      if (returnContext) {
        const c = returnContext;
        returnContext = null;
        show(c.type, c);
      } else closeModal();
    } else if (a === 'disconnect') {
      await wallet.disconnect();
      renderWallet();
      toast('Wallet disconnected. Browser history preserved.');
    } else if (a === 'balance') await wallet.refreshBalance();
    else if (a === 'history') show('history');
    else if (a === 'history-tab') renderHistory(b.dataset.tab);
    else if (a === 'about') show('about');
    else if (a === 'settings') show('settings');
    else if (a === 'share') show('share', { id });
    else if (a === 'copy-link') await copy(raffleURL(id));
    else if (a === 'share-card') await shareCard(id);
    else if (a === 'download-receipt') {
      download(getRaffle(id).receipt, `${id}-receipt.json`);
      toast('Draw receipt downloaded.');
    } else if (a === 'copy-receipt')
      await copy(JSON.stringify(getRaffle(id).receipt, null, 2));
    else if (a === 'export') {
      download(await exportBackup(state), 'raffler-backup.json');
      toast('Backup downloaded. Keep it somewhere safe.');
    } else if (a === 'damaged-export') {
      download(damagedRaw, 'raffler-damaged-data.json');
      toast('Damaged data downloaded.');
    } else if (a === 'reset-damaged')
      content.insertAdjacentHTML(
        'beforeend',
        '<div class="notice error">Export the damaged data first. Reset replaces it with the current session.<div class="dialog-actions"><button class="btn secondary" data-action="damaged-export">Download damaged data</button><button class="btn primary" data-action="confirm-reset">Reset browser data</button></div></div>',
      );
    else if (a === 'confirm-reset') {
      damagedRaw = null;
      commit((s) => s);
      renderSettings();
      toast(storageError || 'Current session saved.');
    } else if (a === 'rpc-defaults') {
      settings = { rpcUrl: CONFIG.rpcUrl, network: CONFIG.network };
      wallet.settings = settings;
      try {
        localStorage.removeItem('raffler:rpc');
      } catch {}
      void wallet.refreshBalance();
      renderSettings();
      toast('Default RPC restored.');
    } else if (a === 'cancel-operation') cancelOperation();
    else if (a === 'close-entries') confirmCloseEntries(id);
    else if (a === 'entrants-csv') {
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
    } else if (a === 'duplicate') {
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
    } else if (a === 'delete-raffle') {
      context = { type: 'delete-approval', id };
      content.innerHTML = `<h2 class="modal-title" id="modal-title">Delete this raffle?</h2><p>${esc(getRaffle(id).title)} and its entries will be removed from this browser. Export a backup first if you may need it again.</p><div class="dialog-actions"><button class="btn primary" data-action="confirm-delete" data-id="${id}">Delete raffle</button><button class="btn secondary" data-action="detail" data-id="${id}">Keep it</button></div>`;
    } else if (a === 'confirm-delete') {
      const r = getRaffle(id);
      if (r.creator !== wallet.require())
        throw new Error('Connect the creator wallet to delete this raffle.');
      commit((st) => ({
        ...st,
        raffles: st.raffles.filter((x) => x.id !== id),
      }));
      closeModal();
      toast('Raffle deleted.');
    } else if (a === 'confirm-close-entries') {
      updateRaffle(id, (r) => closeRaffle(r, wallet.require()));
      show('detail', { id });
      toast('Entries locked. Ready to draw.');
    } else if (a === 'draw') await startDraw(id);
    else if (a === 'remove-image') {
      createImage = null;
      $('#project-image').value = '';
      $('#image-state').innerHTML = '';
    } else if (a === 'pause-activity') {
      activityPaused = !activityPaused;
      b.textContent = activityPaused ? 'Resume' : 'Pause';
      b.setAttribute('aria-pressed', String(activityPaused));
    } else if (a === 'browse') {
      closeModal();
      $('#raffles').scrollIntoView({ behavior: 'smooth' });
    } else if (a === 'clear-search') {
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
  for (const d of defs)
    try {
      Promise.resolve(mc.registerTool(d, { signal: life.signal })).catch(
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
if (!damagedRaw) commit((s) => s);
if (storageError) toast(storageError);
void wallet.reconnect();
