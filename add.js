/**
 * 9Router AutoLogin Google — Add Accounts
 *
 * Bulk add Google accounts to AntiGravity provider via OAuth API.
 * Uses puppeteer-extra with stealth plugin + real Chrome browser.
 *
 * Usage: node add.js (or via menu in index.js)
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const http = require('http');

// ══════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════
const BASE_URL = 'http://localhost:20128';
const REDIRECT_URI = `${BASE_URL}/callback`;
const AKUN_FILE = path.join(__dirname, 'akun.txt');
const PROFILES_DIR = path.join(__dirname, 'profiles');
const SCREEN_WIDTH = 1920;
const SCREEN_HEIGHT = 1080;

// ══════════════════════════════════════
//  COLORS & HELPERS
// ══════════════════════════════════════
const COLORS = ['\x1b[36m', '\x1b[33m', '\x1b[35m', '\x1b[32m', '\x1b[34m'];
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(workerId, msg) {
  console.log(`${COLORS[workerId % COLORS.length]}[Worker ${workerId + 1}]${RESET} ${msg}`);
}

function ask(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => { rl.question(query, (a) => { rl.close(); resolve(a.trim()); }); });
}

// ══════════════════════════════════════
//  BROWSER DETECTION
// ══════════════════════════════════════
function detectBrowser() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    `${process.env.LOCALAPPDATA}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser', '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  for (const p of paths) {
    try {
      if (p && fs.existsSync(p)) {
        const name = /chrome/i.test(p) ? 'Chrome' : /edge/i.test(p) ? 'Edge' : /brave/i.test(p) ? 'Brave' : 'Browser';
        return { path: p, name };
      }
    } catch {}
  }
  return { path: null, name: 'Chromium (bundled)' };
}

// ══════════════════════════════════════
//  ACCOUNT MANAGEMENT
// ══════════════════════════════════════
const completed = new Set();
const failed = [];

function readAccounts() {
  const content = fs.readFileSync(AKUN_FILE, 'utf-8').trim();
  if (!content) return [];
  return content.split('\n')
    .map((l) => {
      const t = l.trim();
      if (!t) return null;
      const sep = t.includes('|') ? '|' : ':';
      const idx = t.indexOf(sep);
      if (idx === -1) return null;
      const email = t.substring(0, idx).trim();
      const password = t.substring(idx + 1).trim();
      return { email, password, raw: t };
    })
    .filter((a) => a?.email && a?.password);
}

function markDone(raw) {
  completed.add(raw);
  const lines = fs.readFileSync(AKUN_FILE, 'utf-8').split('\n').filter((l) => !completed.has(l.trim()));
  fs.writeFileSync(AKUN_FILE, lines.join('\n'));
}

// ══════════════════════════════════════
//  HTTP
// ══════════════════════════════════════
function request(method, url, { body, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) } };
    const req = http.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { const cookies = res.headers['set-cookie'] || []; try { resolve({ status: res.statusCode, data: JSON.parse(d), cookies }); } catch { resolve({ status: res.statusCode, data: d, cookies }); } });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ══════════════════════════════════════
//  9ROUTER API
// ══════════════════════════════════════
async function startOAuth(cookie) {
  const res = await request('GET', `${BASE_URL}/api/oauth/antigravity/authorize?redirect_uri=${encodeURIComponent(REDIRECT_URI)}`, { cookie });
  if (res.status !== 200) throw new Error(`OAuth failed (${res.status})`);
  const { authUrl, codeVerifier, state } = res.data;
  if (!authUrl || !codeVerifier || !state) throw new Error('Incomplete OAuth response');
  return { authUrl, codeVerifier, state };
}

async function exchangeToken(cookie, { code, codeVerifier, state }) {
  const res = await request('POST', `${BASE_URL}/api/oauth/antigravity/exchange`, { cookie, body: { code, redirectUri: REDIRECT_URI, codeVerifier, state } });
  if (res.status !== 200 && res.status !== 201) throw new Error(`Exchange failed (${res.status})`);
  return res.data;
}

// ══════════════════════════════════════
//  GOOGLE LOGIN
// ══════════════════════════════════════
async function clickFirst(page, selectors) {
  for (const sel of selectors) { try { const el = await page.$(sel); if (el) { await el.click(); return true; } } catch {} }
  return false;
}

async function googleLogin(authUrl, email, password, workerId, workerCount, browserInfo) {
  const w = Math.floor(SCREEN_WIDTH / workerCount);
  const profileDir = path.join(PROFILES_DIR, `worker-${workerId + 1}`);

  if (fs.existsSync(profileDir)) fs.rmSync(profileDir, { recursive: true, force: true });
  fs.mkdirSync(profileDir, { recursive: true });

  log(workerId, `Launching ${browserInfo.name}...`);
  const opts = {
    headless: false, defaultViewport: null, userDataDir: profileDir,
    args: ['--incognito', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-blink-features=AutomationControlled', `--window-size=${w},${SCREEN_HEIGHT}`, `--window-position=${workerId * w},0`],
    ignoreDefaultArgs: ['--enable-automation'],
  };
  if (browserInfo.path) opts.executablePath = browserInfo.path;
  const browser = await puppeteer.launch(opts);

  try {
    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();
    let authCode = null;

    // Intercept callback redirect
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith(REDIRECT_URI)) { authCode = new URL(url).searchParams.get('code'); req.abort(); return; }
      req.continue();
    });

    // 1. LOGIN TO GEMINI FIRST
    log(workerId, 'Navigating to Gemini...');
    await page.goto('https://gemini.google.com/app', { waitUntil: 'networkidle2', timeout: 45000 });
    await sleep(2000);

    // If we are not redirected to signin page, click login
    if (!page.url().includes('accounts.google.com')) {
      log(workerId, 'Clicking login/chat button on Gemini...');
      const loginSelectors = [
        'a::-p-text(Login)', 'button::-p-text(Login)',
        'a::-p-text(Sign in)', 'button::-p-text(Sign in)',
        'a::-p-text(Masuk)', 'button::-p-text(Masuk)',
        'a::-p-text(Chat with Gemini)', 'button::-p-text(Chat with Gemini)',
        'a::-p-text(Chat dengan Gemini)', 'button::-p-text(Chat dengan Gemini)',
        'a[href*="accounts.google.com"]', 'button[href*="accounts.google.com"]'
      ];
      let clicked = false;
      for (const sel of loginSelectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            await el.click();
            log(workerId, `Clicked: ${sel}`);
            clicked = true;
            break;
          }
        } catch (e) {}
      }
      if (!clicked) {
        await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('a, button'));
          const target = elements.find(el => {
            const txt = el.textContent.toLowerCase();
            return txt.includes('login') || txt.includes('sign in') || txt.includes('masuk') || txt.includes('chat with') || txt.includes('chat dengan');
          });
          if (target) target.click();
        });
      }
      await sleep(3000);
    }

    // Email
    log(workerId, 'Email: ' + email);
    await page.waitForSelector('#identifierId', { visible: true, timeout: 15000 });
    await page.type('#identifierId', email, { delay: 20 });
    await sleep(500);
    await page.keyboard.press('Enter');

    // Password
    log(workerId, 'Password...');
    await sleep(2000);
    for (let a = 0; a < 10; a++) {
      if (!page.url().includes('/identifier') || page.url().includes('/challenge') || page.url().includes('/pwd')) break;
      if (await page.$('input[type="password"]')) break;
      await sleep(1000);
    }
    let pwd = null;
    for (const sel of ['input[type="password"][name="Passwd"]', 'input[type="password"]', '#password input']) {
      try { pwd = await page.waitForSelector(sel, { visible: true, timeout: 5000 }); if (pwd) break; } catch {}
    }
    if (!pwd) throw new Error('Password field not found');
    await sleep(500);
    await pwd.type(password, { delay: 20 });
    await sleep(500);
    await page.keyboard.press('Enter');

    // Wait and handle speedbumps / terms / popups
    log(workerId, 'Waiting for Gemini redirect & agreements...');
    const tStart = Date.now();
    let onGeminiApp = false;

    while (Date.now() - tStart < 45000) {
      const url = page.url();

      if (url.includes('/speedbump/passkeyenrollment')) {
        log(workerId, 'Handling Passkey Enrollment speedbump (Rejecting)...');
        const rejected = await clickFirst(page, [
          'button::-p-text(Not now)', 'button::-p-text(Jangan sekarang)',
          'button::-p-text(Lain kali)', 'button::-p-text(Skip)', '[data-dismiss="true"]'
        ]);
        if (rejected) {
          log(workerId, 'Clicked Not now / Reject Passkey');
          await sleep(2000);
          continue;
        }
      }

      if (url.includes('/speedbump') || url.includes('/workspacetermsofservice')) {
        log(workerId, 'Handling Workspace Terms of Service speedbump...');
        await clickFirst(page, ['button::-p-text(Saya mengerti)', 'button::-p-text(I understand)', 'button::-p-text(Accept)', 'button::-p-text(Setuju)']);
        await sleep(2000);
        continue;
      }

      if (url.includes('gemini.google.com')) {
        const clickedChat = await clickFirst(page, [
          'a::-p-text(Chat with Gemini)', 'button::-p-text(Chat with Gemini)',
          'a::-p-text(Chat dengan Gemini)', 'button::-p-text(Chat dengan Gemini)',
          'a::-p-text(Gunakan Gemini)', 'button::-p-text(Gunakan Gemini)',
          'a::-p-text(Use Gemini)', 'button::-p-text(Use Gemini)'
        ]);
        if (clickedChat) {
          log(workerId, 'Clicked Chat button');
          await sleep(2000);
          continue;
        }

        const clickedUse = await clickFirst(page, [
          'button::-p-text(Use Gemini)', 'button::-p-text(Gunakan Gemini)',
          'button::-p-text(Saya mengerti)', 'button::-p-text(I understand)',
          'button.glue-button--primary-raised', // fallback class for Google buttons
          'button[aria-label="Use Gemini"]'
        ]);
        if (clickedUse) {
          log(workerId, 'Clicked Use Gemini modal');
          await sleep(2000);
          continue;
        }

        // Alternative detection and click for "Use Gemini" modal
        const useGeminiBtn = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const target = btns.find(b => {
            const txt = b.textContent.trim().toLowerCase();
            return txt === 'use gemini' || txt === 'gunakan gemini' || txt === 'saya mengerti' || txt === 'i understand';
          });
          if (target) {
            target.click();
            return true;
          }
          return false;
        });
        if (useGeminiBtn) {
          log(workerId, 'Clicked Use Gemini modal via JS evaluation');
          await sleep(2000);
          continue;
        }

        const textarea = await page.$('textarea, input[placeholder*="Gemini"], div[contenteditable="true"]');
        if (textarea) {
          log(workerId, 'Logged into Gemini App successfully.');
          onGeminiApp = true;
          break;
        }
      }
      await sleep(1000);
    }

    if (!onGeminiApp) {
      log(workerId, 'Warning: Gemini App not fully ready, proceeding to OAuth anyway...');
    }

    // 2. NOW NAVIGATE TO OAUTH URL
    log(workerId, 'Navigating to 9Router OAuth url...');
    await page.goto(authUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    if (authCode) { log(workerId, 'Auth code captured instantly'); return authCode; }

    // Handle account chooser if present
    log(workerId, 'Checking for Account Chooser...');
    await sleep(2000);
    const clickedAccount = await clickFirst(page, [
      `div[data-identifier="${email}"]`,
      `div[data-email="${email}"]`,
      `[data-identifier="${email}"]`,
      `[data-email="${email}"]`,
      `div::-p-text(${email})`
    ]);
    if (clickedAccount) {
      log(workerId, 'Selected active Google account');
      await sleep(1000);
    }

    // Handle any post-login OAuth consent buttons (Allow, Continue, Next)
    log(workerId, 'Capturing Auth code...');
    const tOAuth = Date.now();
    while (!authCode && Date.now() - tOAuth < 30000) {
      try { await page.evaluate(() => window.scrollBy(0, 300)); } catch {}
      if (await clickFirst(page, [
        '#submit_approve_access button', '#submit_approve_access',
        'button::-p-text(Allow)', 'button::-p-text(Continue)', 'button::-p-text(Izinkan)',
        'button::-p-text(Berikutnya)', 'button::-p-text(Next)'
      ])) {
        log(workerId, 'Clicked Allow/Continue');
        await sleep(2000);
        continue;
      }
      await sleep(1000);
    }

    if (!authCode) {
      // Final backup checks
      const s = Date.now();
      while (!authCode && Date.now() - s < 10000) await sleep(300);
    }
    if (!authCode) {
      try {
        const u = page.url();
        if (u.startsWith(REDIRECT_URI)) authCode = new URL(u).searchParams.get('code');
      } catch {}
    }
    if (!authCode) throw new Error('Auth code not captured');

    log(workerId, 'Auth code captured!');
    return authCode;
  } finally {
    await browser.close();
  }
}

// ══════════════════════════════════════
//  LOGIN FLOW
// ══════════════════════════════════════
async function loginAccount(cookie, account, workerId, idx, total, workerCount, browserInfo) {
  const { email, password } = account;
  log(workerId, `=== ${idx + 1}/${total}: ${email} ===`);
  try {
    log(workerId, 'OAuth...');
    const { authUrl, codeVerifier, state } = await startOAuth(cookie);
    const code = await googleLogin(authUrl, email, password, workerId, workerCount, browserInfo);
    log(workerId, 'Exchange...');
    const result = await exchangeToken(cookie, { code, codeVerifier, state });
    log(workerId, `${GREEN}SUCCESS: ${result.connection?.email || email}${RESET}`);
    markDone(account.raw);
    return true;
  } catch (err) {
    log(workerId, `${RED}FAILED: ${email} — ${err.message}${RESET}`);
    failed.push({ email, error: err.message, workerId });
    return false;
  }
}

async function runWorker(workerId, accounts, total, workerCount, cookie, browserInfo) {
  let ok = 0;
  for (let i = 0; i < accounts.length; i++) {
    if (await loginAccount(cookie, accounts[i], workerId, accounts[i]._idx, total, workerCount, browserInfo)) ok++;
    if (i < accounts.length - 1) { log(workerId, 'Delay 1s...'); await sleep(1000); }
  }
  log(workerId, `Done. ${ok} added.`);
  return ok;
}

// ══════════════════════════════════════
//  MAIN
// ══════════════════════════════════════
(async () => {
  const accounts = readAccounts();
  const total = accounts.length;
  const browser = detectBrowser();

  console.log(`\n${GREEN}========================================${RESET}`);
  console.log(`${GREEN}  9Router AutoLogin Google${RESET}`);
  console.log(`${GREEN}========================================${RESET}`);
  console.log(`Accounts : ${total}`);
  console.log(`Browser  : ${browser.name}${browser.path ? '' : ' (bundled)'}`);

  if (!total) { console.log(`${YELLOW}No accounts in akun.txt${RESET}`); return; }

  const n = Math.max(1, Math.min(total, parseInt(await ask(`\nWorkers (1-${total}, default 5): `)) || 5));
  console.log(`\n${GREEN}Workers: ${n}${RESET} | ~${Math.ceil(total / n)} per worker | ${Math.floor(SCREEN_WIDTH / n)}x${SCREEN_HEIGHT}px\n`);

  const cookie = null;
  const t0 = Date.now();

  if (!fs.existsSync(PROFILES_DIR)) fs.mkdirSync(PROFILES_DIR, { recursive: true });

  const chunks = Array.from({ length: n }, () => []);
  accounts.forEach((a, i) => { a._idx = i; chunks[i % n].push(a); });

  const promises = [];
  for (let i = 0; i < n; i++) {
    if (!chunks[i].length) continue;
    promises.push(runWorker(i, chunks[i], total, n, cookie, browser));
    if (i < n - 1) await sleep(3000);
  }
  await Promise.all(promises);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n${GREEN}========================================${RESET}`);
  console.log(`${GREEN}  SUMMARY${RESET}`);
  console.log(`${GREEN}========================================${RESET}`);
  console.log(`${GREEN}Completed : ${completed.size}${RESET}`);
  if (failed.length) { console.log(`${RED}Failed    : ${failed.length}${RESET}`); failed.forEach((f) => console.log(`  ${RED}- ${f.email}: ${f.error}${RESET}`)); }
  console.log(`Total     : ${total}`);
  console.log(`Time      : ${elapsed}s`);
  console.log(`${GREEN}========================================${RESET}\n`);
})();
