/**
 * 9Router AutoLogin Google — Account Manager
 *
 * Interactive CLI to manage AntiGravity provider accounts on 9Router.
 * Features: add accounts, check quota, delete depleted/expired accounts.
 *
 * Usage: node index.js
 */

const http = require('http');
const readline = require('readline');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ══════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════
const BASE_URL = 'http://localhost:20128';
const PAGE_SIZE = 100;
const TARGET_MODEL = 'claude-opus-4-6-thinking';

// ══════════════════════════════════════
//  COLORS
// ══════════════════════════════════════
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

// ══════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════
function ask(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(query, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

function clear() {
  process.stdout.write('\x1b[2J\x1b[H');
}

function timeUntil(dateStr) {
  if (!dateStr) return '-';
  const diff = new Date(dateStr) - new Date();
  if (diff <= 0) return `${RED}expired${RESET}`;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`;
}

function bar(used, total, width = 20) {
  const pct = total > 0 ? used / total : 0;
  const filled = Math.round(pct * width);
  const color = pct >= 1 ? RED : pct >= 0.8 ? YELLOW : GREEN;
  return `${color}${'█'.repeat(filled)}${DIM}${'░'.repeat(width - filled)}${RESET}`;
}

// ══════════════════════════════════════
//  HTTP
// ══════════════════════════════════════
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('Bad JSON')); } });
    }).on('error', reject);
  });
}

function httpDelete(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'DELETE' }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, data: d }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

// ══════════════════════════════════════
//  9ROUTER API
// ══════════════════════════════════════
async function fetchConnections() {
  const all = [];
  let page = 1, pages = 1;
  while (page <= pages) {
    const res = await httpGet(`${BASE_URL}/api/providers/client?page=${page}&pageSize=${PAGE_SIZE}&accountStatus=all&sort=priority`);
    if (res.connections) all.push(...res.connections);
    pages = res.pagination?.totalPages || 1;
    page++;
  }
  return all;
}

async function fetchQuota(id, retries = 2) {
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await httpGet(`${BASE_URL}/api/usage/${id}`);
      if (res.message?.includes('expired') && (!res.quotas || !Object.keys(res.quotas).length)) return { _expired: true };
      return res.quotas || {};
    } catch {
      if (i < retries) await new Promise(r => setTimeout(r, 500));
    }
  }
  return null;
}

async function fetchAllQuotas(connections) {
  let done = 0;
  const t0 = Date.now();
  const results = await Promise.all(connections.map(async (conn) => {
    const q = await fetchQuota(conn.id);
    const expired = q?._expired === true;
    const m = (!expired && q) ? q[TARGET_MODEL] : null;
    done++;
    process.stdout.write(`\r  Checking quotas... ${done}/${connections.length}`);
    return {
      id: conn.id,
      email: conn.email || conn.name,
      expired,
      used: m ? m.used : '?',
      total: m ? m.total : '?',
      remaining: m ? m.total - m.used : '?',
      resetAt: m ? m.resetAt : null,
    };
  }));
  process.stdout.write(`\r  Checked ${connections.length} accounts in ${((Date.now() - t0) / 1000).toFixed(1)}s${' '.repeat(20)}\n`);
  return results;
}

// ══════════════════════════════════════
//  HEADER
// ══════════════════════════════════════
function showHeader(totalAccounts) {
  clear();
  console.log(`${CYAN}`);
  console.log(`   ___  ____              _            `);
  console.log(`  / _ \\|  _ \\ ___  _   _| |_ ___ _ __ `);
  console.log(`  \\_, /| |_) / _ \\| | | | __/ _ \\ '__|`);
  console.log(`   / / |  _ < (_) | |_| | ||  __/ |   `);
  console.log(`  /_/  |_| \\_\\___/ \\__,_|\\__\\___|_|   `);
  console.log(`${RESET}`);
  console.log(`  ${DIM}Account Manager — AntiGravity | By Idamod${RESET}\n`);
  console.log(`  ${BOLD}Accounts${RESET}  ${totalAccounts} total`);
  console.log(`  ${BOLD}Model${RESET}     ${TARGET_MODEL}`);
  console.log(`  ${'─'.repeat(60)}\n`);
}

// ══════════════════════════════════════
//  MENU 1: ADD ACCOUNTS
// ══════════════════════════════════════
async function menuAdd() {
  clear();
  console.log(`\n  ${GREEN}${BOLD}[ Add Accounts ]${RESET}\n`);

  const akunFile = path.join(__dirname, 'akun.txt');
  if (!fs.existsSync(akunFile)) {
    console.log(`  ${RED}akun.txt not found!${RESET}`);
    console.log(`  ${DIM}Create it with format: email|password (one per line)${RESET}`);
    await ask('\n  Press Enter to go back...');
    return;
  }

  const lines = fs.readFileSync(akunFile, 'utf-8').trim().split('\n').filter(l => {
    const t = l.trim();
    return t && (t.includes('|') || t.includes(':'));
  });
  if (!lines.length) {
    console.log(`  ${YELLOW}akun.txt is empty${RESET}`);
    await ask('\n  Press Enter to go back...');
    return;
  }

  console.log(`  Found ${GREEN}${lines.length}${RESET} accounts in akun.txt\n`);

  return new Promise((resolve) => {
    const child = spawn('node', [path.join(__dirname, 'add.js')], { stdio: 'inherit', cwd: __dirname });
    child.on('close', () => { console.log(); resolve(); });
    child.on('error', (err) => { console.log(`  ${RED}Error: ${err.message}${RESET}`); resolve(); });
  });
}

// ══════════════════════════════════════
//  MENU 2: CHECK QUOTA
// ══════════════════════════════════════
async function menuQuota(connections) {
  clear();
  console.log(`\n  ${CYAN}${BOLD}[ Check Quota — ${TARGET_MODEL} ]${RESET}\n`);

  if (!connections.length) { console.log(`  ${YELLOW}No accounts${RESET}`); await ask('\n  Enter to go back...'); return; }

  const results = await fetchAllQuotas(connections);
  results.sort((a, b) => (typeof a.remaining === 'number' && typeof b.remaining === 'number') ? b.remaining - a.remaining : 0);

  const avail = results.filter(r => !r.expired && typeof r.remaining === 'number' && r.remaining > 0);
  const depl = results.filter(r => !r.expired && typeof r.remaining === 'number' && r.remaining <= 0);
  const exp = results.filter(r => r.expired);
  const unk = results.filter(r => !r.expired && typeof r.remaining !== 'number');

  console.log(`\n  ${BOLD}  #  │ Email                              │ Quota         │ Bar                  │ Reset${RESET}`);
  console.log(`  ${'─'.repeat(105)}`);

  let i = 1;
  const row = (r, dim) => {
    const pre = dim ? DIM : '';
    const suf = dim ? RESET : '';
    const quota = typeof r.used === 'number' ? `${r.used}/${r.total}` : r.expired ? 'expired' : '?';
    const b = typeof r.used === 'number' ? bar(r.used, r.total) : r.expired ? '─'.repeat(20) : '?'.padEnd(21);
    const reset = r.resetAt ? timeUntil(r.resetAt) : '-';
    console.log(`  ${pre}${String(i++).padStart(3)}  │ ${r.email.padEnd(35).substring(0, 35)}│ ${quota.padEnd(14)}│ ${b} │ ${reset}${suf}`);
  };

  if (avail.length) { console.log(`\n  ${GREEN}${BOLD}  AVAILABLE (${avail.length})${RESET}`); avail.forEach(r => row(r, false)); }
  if (depl.length) { console.log(`\n  ${RED}${BOLD}  DEPLETED (${depl.length})${RESET}`); depl.forEach(r => row(r, true)); }
  if (exp.length) { console.log(`\n  ${RED}${BOLD}  EXPIRED (${exp.length})${RESET} ${DIM}— auth expired${RESET}`); exp.forEach(r => row(r, true)); }
  if (unk.length) { console.log(`\n  ${YELLOW}${BOLD}  UNKNOWN (${unk.length})${RESET}`); unk.forEach(r => row(r, true)); }

  const used = results.reduce((s, r) => s + (typeof r.used === 'number' ? r.used : 0), 0);
  const cap = results.reduce((s, r) => s + (typeof r.total === 'number' ? r.total : 0), 0);

  console.log(`\n  ${'─'.repeat(105)}`);
  console.log(`  ${BOLD}SUMMARY${RESET}`);
  console.log(`  Total      : ${results.length}`);
  console.log(`  ${GREEN}Available  : ${avail.length}${RESET}`);
  if (depl.length) console.log(`  ${RED}Depleted   : ${depl.length}${RESET}`);
  if (exp.length) console.log(`  ${RED}Expired    : ${exp.length}${RESET}`);
  if (unk.length) console.log(`  ${YELLOW}Unknown    : ${unk.length}${RESET}`);
  console.log(`  Quota      : ${used.toLocaleString()} / ${cap.toLocaleString()} used`);
  console.log(`  ${GREEN}Remaining  : ${(cap - used).toLocaleString()} requests${RESET}`);
  console.log(`  ${'─'.repeat(105)}`);

  await ask('\n  Press Enter to go back...');
}

// ══════════════════════════════════════
//  MENU 3: DELETE DEPLETED + EXPIRED
// ══════════════════════════════════════
async function menuDelete(connections) {
  clear();
  console.log(`\n  ${RED}${BOLD}[ Delete Depleted & Expired ]${RESET}\n`);

  if (!connections.length) { console.log(`  ${YELLOW}No accounts${RESET}`); await ask('\n  Enter to go back...'); return connections; }

  const results = await fetchAllQuotas(connections);
  const depl = results.filter(r => !r.expired && typeof r.remaining === 'number' && r.remaining <= 0);
  const exp = results.filter(r => r.expired);
  const avail = results.filter(r => !r.expired && typeof r.remaining === 'number' && r.remaining > 0);
  const targets = [...depl, ...exp];

  if (!targets.length) {
    console.log(`\n  ${GREEN}All accounts are healthy! Nothing to delete.${RESET}`);
    await ask('\n  Press Enter to go back...');
    return connections;
  }

  // Scan results
  console.log(`\n  ${BOLD}Scan Results:${RESET}`);
  console.log(`  ${'─'.repeat(60)}`);
  console.log(`  ${GREEN}Available  : ${avail.length} (have quota)${RESET}`);
  if (depl.length) console.log(`  ${RED}Depleted   : ${depl.length} (0 remaining)${RESET}`);
  if (exp.length) console.log(`  ${RED}Expired    : ${exp.length} (auth expired)${RESET}`);
  console.log(`  ${'─'.repeat(60)}`);

  if (depl.length) {
    console.log(`\n  ${BOLD}Depleted:${RESET}`);
    depl.forEach((r, i) => console.log(`  ${DIM}${String(i + 1).padStart(3)}.${RESET} ${r.email} ${DIM}(${r.used}/${r.total} | reset: ${timeUntil(r.resetAt)})${RESET}`));
  }
  if (exp.length) {
    console.log(`\n  ${BOLD}Expired:${RESET}`);
    exp.forEach((r, i) => console.log(`  ${DIM}${String(depl.length + i + 1).padStart(3)}.${RESET} ${r.email} ${DIM}(auth expired)${RESET}`));
  }

  console.log(`\n  ${BOLD}Options:${RESET}\n`);
  console.log(`  ${RED}[1]${RESET} Delete ALL ${targets.length} accounts`);
  console.log(`  ${DIM}[0]${RESET} Cancel\n`);

  if ((await ask(`  ${BOLD}> ${RESET}`)) !== '1') { console.log(`\n  ${YELLOW}Cancelled${RESET}`); await ask('\n  Enter to go back...'); return connections; }
  if ((await ask(`\n  ${RED}${BOLD}Type "yes" to confirm: ${RESET}`)).toLowerCase() !== 'yes') { console.log(`\n  ${YELLOW}Cancelled${RESET}`); await ask('\n  Enter to go back...'); return connections; }

  console.log();
  let ok = 0, fail = 0;
  for (const r of targets) {
    try {
      const res = await httpDelete(`${BASE_URL}/api/providers/${r.id}`);
      if (res.status >= 200 && res.status < 300) { ok++; console.log(`  ${GREEN}Deleted${RESET} ${r.email}`); }
      else { fail++; console.log(`  ${RED}Failed${RESET}  ${r.email} ${DIM}(${res.status})${RESET}`); }
    } catch (e) { fail++; console.log(`  ${RED}Error${RESET}   ${r.email} ${DIM}(${e.message})${RESET}`); }
  }

  console.log(`\n  ${GREEN}Deleted: ${ok}${RESET} | ${fail ? `${RED}Failed: ${fail}${RESET}` : 'Failed: 0'}`);
  console.log(`\n  ${CYAN}Refreshing...${RESET}`);
  const updated = await fetchConnections();
  console.log(`  ${GREEN}${updated.length} accounts remaining${RESET}`);
  await ask('\n  Press Enter to go back...');
  return updated;
}

// ══════════════════════════════════════
//  MAIN
// ══════════════════════════════════════
(async () => {
  clear();
  console.log(`\n  ${CYAN}Loading accounts...${RESET}`);
  let conns = await fetchConnections();

  while (true) {
    showHeader(conns.length);

    console.log(`  ${BOLD}Menu:${RESET}\n`);
    console.log(`  ${CYAN}[1]${RESET} Add Accounts       Add Google accounts from akun.txt`);
    console.log(`  ${CYAN}[2]${RESET} Check Quota        Check ${TARGET_MODEL} quota`);
    console.log(`  ${CYAN}[3]${RESET} Delete Depleted    Remove depleted & expired accounts`);
    console.log(`  ${CYAN}[4]${RESET} Refresh            Reload account list`);
    console.log(`  ${DIM}[0]${RESET} Exit\n`);

    switch (await ask(`  ${BOLD}> ${RESET}`)) {
      case '1': await menuAdd(); conns = await fetchConnections(); break;
      case '2': await menuQuota(conns); break;
      case '3': conns = await menuDelete(conns); break;
      case '4': clear(); console.log(`\n  ${CYAN}Refreshing...${RESET}`); conns = await fetchConnections(); console.log(`  ${GREEN}${conns.length} loaded${RESET}`); break;
      case '0': case 'q': clear(); console.log(`\n  ${GREEN}Goodbye!${RESET}\n`); process.exit(0);
    }
  }
})().catch((e) => { console.error(`\n${RED}Error: ${e.message}${RESET}`); process.exit(1); });
