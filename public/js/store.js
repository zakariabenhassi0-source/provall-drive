// État de l'application.
// - Mode local (config.js vide) : données dans le navigateur, partagées entre onglets via localStorage.
// - Mode Supabase : données dans la base, synchronisées en temps réel entre tous les appareils.
import { PRODUCTS, CATEGORIES, DEMO_CUSTOMERS } from './data.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { toast } from './ui.js';

export { CATEGORIES };
export const REMOTE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const KEY = 'proval-drive-state-v1';
const CART_KEY = 'proval-drive-cart-v1';
const AFTER_LOGIN = 'proval-drive-after-login';

export const DEFAULT_SETTINGS = {
  slotMinutes: 30,
  capacity: 4,
  minOrder: 20,
  leadHours: 2,
  daysAhead: 7,
  open: '09:00',
  close: '19:00',
  closedDays: [0], // 0 = dimanche
  parkingSpots: 4,
  weightMargin: 0.1,
};

function initialState() {
  return {
    products: REMOTE ? [] : PRODUCTS.map((p) => ({ ...p })),
    settings: { ...DEFAULT_SETTINGS, closedDays: [...DEFAULT_SETTINGS.closedDays] },
    orders: [],
    nextOrder: 1001,
    customer: null,
  };
}

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible : l'app fonctionne en mémoire */
  }
}

function loadState() {
  if (REMOTE) return initialState();
  const s = read(KEY);
  if (s && Array.isArray(s.products) && Array.isArray(s.orders)) {
    s.settings = { ...DEFAULT_SETTINGS, ...s.settings };
    return s;
  }
  return initialState();
}
function loadCart() {
  const c = read(CART_KEY);
  return Array.isArray(c) ? c : [];
}

let state = loadState();
let cart = loadCart();
const listeners = new Set();

// Connexion (mode Supabase). En mode local, tout le monde a accès à tout.
export const auth = { ready: !REMOTE, user: null, role: REMOTE ? 'anon' : 'admin', error: null };

function emit(source = 'local') {
  for (const fn of listeners) fn(source);
}

export const getState = () => state;
export const getCart = () => cart;
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const refresh = () => emit('local');

export function update(fn) {
  fn(state);
  if (!REMOTE) {
    write(KEY, state);
    emit();
    return;
  }
  emit();
  push().catch(fail);
}
export function updateCart(fn) {
  fn(cart);
  write(CART_KEY, cart);
  emit();
}

window.addEventListener('storage', (e) => {
  if (!REMOTE && (e.key === KEY || e.key === null)) state = loadState();
  if (e.key === CART_KEY || e.key === null) cart = loadCart();
  emit('remote');
});

export function resetDemo() {
  if (REMOTE) return;
  state = initialState();
  cart = [];
  write(KEY, state);
  write(CART_KEY, cart);
  emit();
}

// ---------- Produits et panier ----------

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const product = (id) => state.products.find((p) => p.id === id);
export const category = (id) => CATEGORIES.find((c) => c.id === id);

export function cartSummary(lines = cart) {
  let estimated = 0;
  let preauth = 0;
  let count = 0;
  for (const l of lines) {
    const p = product(l.productId);
    if (!p) continue;
    const t = p.price * l.qty;
    estimated += t;
    preauth += p.unit === 'kg' ? t * (1 + state.settings.weightMargin) : t;
    count += p.unit === 'kg' ? 1 : l.qty;
  }
  return { estimated: round2(estimated), preauth: round2(preauth), count };
}

// ---------- Créneaux ----------

const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const toMin = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + (m || 0);
};

// En mode Supabase, un client ne voit que ses commandes : le remplissage des créneaux
// vient d'une fonction serveur qui ne renvoie que des nombres.
let slotCounts = new Map();
let slotCountsAt = 0;
let slotCountsLoading = false;

export function bookedCount(date, start) {
  if (REMOTE) return slotCounts.get(`${date} ${start}`) || 0;
  return state.orders.filter((o) => o.status !== 'annulee' && o.slot.date === date && o.slot.start === start).length;
}

export function availableSlots(now = new Date()) {
  const s = state.settings;
  const days = [];
  for (let d = 0; d < s.daysAhead; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    if (s.closedDays.includes(day.getDay())) continue;
    const date = isoDate(day);
    const slots = [];
    for (let m = toMin(s.open); m + s.slotMinutes <= toMin(s.close); m += s.slotMinutes) {
      const startAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, m);
      const start = hhmm(m);
      const booked = bookedCount(date, start);
      slots.push({
        date,
        start,
        end: hhmm(m + s.slotMinutes),
        booked,
        full: booked >= s.capacity,
        tooSoon: startAt.getTime() < now.getTime() + s.leadHours * 3600e3,
      });
    }
    days.push({ date, offset: d, slots });
  }
  return days;
}

export function isSlotBookable(slot) {
  const day = availableSlots().find((d) => d.date === slot.date);
  const s = day && day.slots.find((x) => x.start === slot.start);
  return Boolean(s && !s.full && !s.tooSoon);
}

export function ensureSlotCounts() {
  if (!REMOTE || slotCountsLoading || Date.now() - slotCountsAt < 30000) return;
  slotCountsLoading = true;
  const today = new Date();
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate() + state.settings.daysAhead);
  sb.rpc('slot_counts', { p_from: isoDate(today), p_to: isoDate(to) })
    .then(({ data, error }) => {
      if (error) throw error;
      slotCounts = new Map(data.map((r) => [`${r.slot_date} ${hm(r.slot_start)}`, r.booked]));
      slotCountsAt = Date.now();
      emit();
    })
    .catch(fail)
    .finally(() => (slotCountsLoading = false));
}

// ---------- Commandes ----------

function makeOrder(customer, slot, lines) {
  const sum = cartSummary(lines);
  const now = new Date().toISOString();
  return {
    id: 'PD-' + state.nextOrder,
    createdAt: now,
    customer: { ...customer },
    slot: { ...slot },
    status: 'recue',
    items: lines
      .map((l) => {
        const p = product(l.productId);
        if (!p) return null;
        const cat = category(p.cat);
        return {
          productId: p.id,
          name: p.name,
          emoji: p.emoji,
          unit: p.unit,
          price: p.price,
          cat: p.cat,
          aisle: cat ? cat.aisle : 99,
          temp: p.temp,
          qty: l.qty,
          allowSub: l.allowSub !== false,
          pick: null, // null | 'ok' | 'missing' | 'sub'
          actualQty: null,
          sub: null,
        };
      })
      .filter(Boolean),
    estimated: sum.estimated,
    preauth: sum.preauth,
    final: null,
    capped: false,
    bin: '',
    spot: null,
    arrivedAt: null,
    pickedUpAt: null,
    refunded: false,
    pickupCode: String(Math.floor(1000 + Math.random() * 9000)),
    history: [{ status: 'recue', at: now }],
  };
}

export async function placeOrder(customer, slot) {
  if (!REMOTE) {
    const order = makeOrder(customer, slot, cart);
    update((st) => {
      st.orders.push(order);
      st.nextOrder += 1;
      st.customer = { ...customer };
    });
    updateCart((c) => c.splice(0));
    return order;
  }
  const lines = cart.map((l) => ({ productId: l.productId, qty: l.qty, allowSub: l.allowSub !== false }));
  const { data, error } = await sb.rpc('place_order', {
    p_customer: customer,
    p_slot_date: slot.date,
    p_slot_start: slot.start,
    p_lines: lines,
  });
  if (error) throw new Error(error.message);
  const order = rowToOrder(data);
  state.orders = [order, ...state.orders.filter((o) => o.id !== order.id)];
  state.customer = { ...customer, email: auth.user?.email || customer.email };
  snapshot();
  slotCountsAt = 0;
  updateCart((c) => c.splice(0));
  return order;
}

export function setOrder(id, fn) {
  update((st) => {
    const o = st.orders.find((x) => x.id === id);
    if (o) fn(o);
  });
}

export function setStatus(o, status) {
  o.status = status;
  o.history.push({ status, at: new Date().toISOString() });
}

// Actions du client sur sa commande (passent par des fonctions serveur en mode Supabase).
export async function customerArrived(id, spot) {
  if (!REMOTE) {
    setOrder(id, (o) => {
      if (o.status !== 'prete') return;
      o.spot = spot;
      o.arrivedAt = new Date().toISOString();
      setStatus(o, 'arrive');
    });
    return;
  }
  const { error } = await sb.rpc('customer_arrived', { p_id: id, p_spot: spot });
  if (error) throw new Error(error.message);
  await reload('orders');
}

export async function customerCancel(id) {
  if (!REMOTE) {
    setOrder(id, (o) => o.status === 'recue' && setStatus(o, 'annulee'));
    return;
  }
  const { error } = await sb.rpc('customer_cancel', { p_id: id });
  if (error) throw new Error(error.message);
  await reload('orders');
}

export function itemTotal(it) {
  if (it.pick === 'missing') return 0;
  const qty = it.unit === 'kg' ? Number(it.actualQty ?? it.qty) : it.qty;
  const price = it.pick === 'sub' && it.sub ? it.sub.price : it.price;
  return round2(price * qty);
}

export function finalAmount(o) {
  return round2(o.items.reduce((sum, it) => sum + itemTotal(it), 0));
}

export function itemDone(it) {
  if (it.pick == null) return false;
  if (it.pick === 'missing') return true;
  if (it.unit === 'kg') return Number(it.actualQty) > 0;
  return true;
}

export function reorder(orderId) {
  const o = state.orders.find((x) => x.id === orderId);
  if (!o) return { added: 0, skipped: 0 };
  let added = 0;
  let skipped = 0;
  updateCart((c) => {
    for (const it of o.items) {
      const p = product(it.productId);
      if (!p || !p.available) {
        skipped++;
        continue;
      }
      const existing = c.find((l) => l.productId === p.id);
      if (existing) existing.qty = it.qty;
      else c.push({ productId: p.id, qty: it.qty, allowSub: it.allowSub });
      added++;
    }
  });
  return { added, skipped };
}

// Génère quelques commandes fictives pour montrer l'écran de préparation (mode local uniquement).
export function generateDemoOrders(n = 3) {
  if (REMOTE) return 0;
  const slots = availableSlots()
    .flatMap((d) => d.slots)
    .filter((s) => !s.full && !s.tooSoon);
  const pool = state.products.filter((p) => p.available);
  if (!slots.length || !pool.length) return 0;
  const created = [];
  for (let i = 0; i < n; i++) {
    const slot = slots[Math.min(i, slots.length - 1)];
    const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, 4 + Math.floor(Math.random() * 4));
    const lines = picked.map((p) => ({
      productId: p.id,
      qty: p.unit === 'kg' ? p.step * (2 + Math.floor(Math.random() * 3)) : 1 + Math.floor(Math.random() * 2),
      allowSub: Math.random() > 0.3,
    }));
    const customer = DEMO_CUSTOMERS[(state.nextOrder + i) % DEMO_CUSTOMERS.length];
    created.push({ customer, slot: { date: slot.date, start: slot.start, end: slot.end }, lines });
  }
  update((st) => {
    for (const c of created) {
      st.orders.push(makeOrder(c.customer, c.slot, c.lines));
      st.nextOrder += 1;
    }
  });
  return created.length;
}

// =====================================================================
// Mode Supabase
// =====================================================================

let sb = null;
let synced = null; // dernier état connu de la base, pour n'envoyer que ce qui a changé

const hm = (t) => (t == null ? '' : String(t).slice(0, 5));
const num = (v) => (v == null ? null : Number(v));

const rowToProduct = (r) => ({
  id: r.id,
  name: r.name,
  cat: r.cat,
  price: Number(r.price),
  unit: r.unit,
  step: Number(r.step),
  available: r.available,
  temp: r.temp,
  format: r.format || '',
  origin: r.origin || '',
  emoji: r.emoji || '🛒',
  ...(r.max_qty != null ? { max: Number(r.max_qty) } : {}),
});
const productToRow = (p) => ({
  id: p.id,
  name: p.name,
  cat: p.cat,
  price: p.price,
  unit: p.unit,
  step: p.step,
  available: p.available,
  temp: p.temp,
  format: p.format || '',
  origin: p.origin || '',
  emoji: p.emoji || '🛒',
  max_qty: p.max ?? null,
  updated_at: new Date().toISOString(),
});
const rowToSettings = (r) => ({
  slotMinutes: r.slot_minutes,
  capacity: r.capacity,
  minOrder: Number(r.min_order),
  leadHours: r.lead_hours,
  daysAhead: r.days_ahead,
  open: hm(r.open_time),
  close: hm(r.close_time),
  closedDays: r.closed_days || [],
  parkingSpots: r.parking_spots,
  weightMargin: Number(r.weight_margin),
});
const settingsToRow = (s) => ({
  slot_minutes: s.slotMinutes,
  capacity: s.capacity,
  min_order: s.minOrder,
  lead_hours: s.leadHours,
  days_ahead: s.daysAhead,
  open_time: s.open,
  close_time: s.close,
  closed_days: s.closedDays,
  parking_spots: s.parkingSpots,
  weight_margin: s.weightMargin,
});
const rowToOrder = (r) => ({
  id: r.id,
  createdAt: r.created_at,
  customer: r.customer || {},
  slot: { date: r.slot_date, start: hm(r.slot_start), end: hm(r.slot_end) },
  status: r.status,
  items: r.items || [],
  estimated: Number(r.estimated),
  preauth: Number(r.preauth),
  final: num(r.final),
  capped: r.capped,
  bin: r.bin || '',
  spot: r.spot,
  arrivedAt: r.arrived_at,
  pickedUpAt: r.picked_up_at,
  refunded: r.refunded,
  pickupCode: r.pickup_code,
  history: r.history || [],
});
// Colonnes que l'équipe peut modifier sur une commande.
const orderToRow = (o) => ({
  status: o.status,
  items: o.items,
  final: o.final,
  capped: o.capped,
  bin: o.bin,
  spot: o.spot,
  arrived_at: o.arrivedAt,
  picked_up_at: o.pickedUpAt,
  refunded: o.refunded,
  history: o.history,
});

function snapshot() {
  synced = JSON.parse(JSON.stringify({ products: state.products, settings: state.settings, orders: state.orders }));
}

function fail(e) {
  const msg = (e && (e.message || e.error_description)) || String(e);
  console.error(e);
  toast(`Erreur : ${msg}`);
  if (REMOTE && sb) loadAll().then(() => emit('remote')).catch(() => {});
}

async function loadProducts() {
  const { data, error } = await sb.from('products').select('*').order('name');
  if (error) throw error;
  state.products = data.map(rowToProduct);
}
async function loadSettings() {
  const { data, error } = await sb.from('settings').select('*').eq('id', 1).single();
  if (error) throw error;
  state.settings = rowToSettings(data);
}
async function loadOrders() {
  if (!auth.user) {
    state.orders = [];
    return;
  }
  const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false }).limit(300);
  if (error) throw error;
  state.orders = data.map(rowToOrder);
}
async function loadAll() {
  await Promise.all([loadProducts(), loadSettings(), loadOrders()]);
  snapshot();
}

async function reload(table) {
  if (table === 'orders') await loadOrders();
  if (table === 'products') await loadProducts();
  if (table === 'settings') await loadSettings();
  snapshot();
  emit('remote');
}

// Envoie à la base ce que l'équipe vient de modifier (produits, réglages, commandes).
async function push() {
  const prev = synced;
  snapshot();
  if (!prev) return;
  const before = (list) => new Map(list.map((x) => [x.id, JSON.stringify(x)]));

  const prevProducts = before(prev.products);
  const changed = state.products.filter((p) => prevProducts.get(p.id) !== JSON.stringify(p));
  const removed = prev.products.filter((p) => !state.products.some((x) => x.id === p.id)).map((p) => p.id);
  if (changed.length) {
    const { error } = await sb.from('products').upsert(changed.map(productToRow));
    if (error) throw error;
  }
  if (removed.length) {
    const { error } = await sb.from('products').delete().in('id', removed);
    if (error) throw error;
  }

  if (JSON.stringify(prev.settings) !== JSON.stringify(state.settings)) {
    const { error } = await sb.from('settings').update(settingsToRow(state.settings)).eq('id', 1);
    if (error) throw error;
  }

  const prevOrders = before(prev.orders);
  for (const o of state.orders) {
    if (prevOrders.has(o.id) && prevOrders.get(o.id) !== JSON.stringify(o)) {
      const { error } = await sb.from('orders').update(orderToRow(o)).eq('id', o.id);
      if (error) throw error;
    }
  }
}

async function applySession(session) {
  auth.user = session?.user || null;
  auth.role = 'anon';
  state.customer = null;
  if (auth.user) {
    const { data } = await sb.from('profiles').select('*').eq('id', auth.user.id).maybeSingle();
    auth.role = data?.role || 'client';
    state.customer = {
      name: data?.name || '',
      phone: data?.phone || '',
      plate: data?.plate || '',
      email: auth.user.email || '',
    };
    const next = read(AFTER_LOGIN);
    if (next) {
      try { localStorage.removeItem(AFTER_LOGIN); } catch { /* ignore */ }
      if (typeof next === 'string' && next.startsWith('#/')) location.hash = next;
    }
  }
}

const timers = {};
function schedule(table) {
  clearTimeout(timers[table]);
  timers[table] = setTimeout(() => reload(table).catch(fail), 150);
}

export async function init() {
  if (!REMOTE) return;
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    const { data } = await sb.auth.getSession();
    await applySession(data.session);
    await loadAll();
    sb.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      // Les appels à la base ne doivent pas se faire dans ce rappel : on les décale.
      setTimeout(async () => {
        try {
          await applySession(session);
          await loadOrders();
          snapshot();
        } catch (e) {
          fail(e);
        }
        emit('auth');
      }, 0);
    });
    sb.channel('proval-drive')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => schedule('orders'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => schedule('products'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => schedule('settings'))
      .subscribe();
    if (location.search) history.replaceState(null, '', location.pathname + location.hash);
  } catch (e) {
    auth.error = (e && e.message) || String(e);
    console.error(e);
  }
  auth.ready = true;
}

export async function sendMagicLink(email) {
  write(AFTER_LOGIN, location.hash || '#/');
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  if (error) throw new Error(error.message);
}

export async function staffSignIn(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect' : error.message);
}

export async function signOut() {
  if (sb) await sb.auth.signOut();
}
