<div align="center">

# 9Router AutoLogin Google

**Bulk add & manage Google accounts for AntiGravity Provider on 9Router**

By [**Idamod**](https://github.com/Attazkia)

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Puppeteer](https://img.shields.io/badge/Puppeteer-Stealth-40B5A4?logo=puppeteer&logoColor=white)](https://pptr.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## Features

- **Add Accounts** — Bulk add Google accounts via OAuth API + stealth browser
- **Check Quota** — View `claude-opus-4-6-thinking` quota for all accounts
- **Delete Depleted** — Auto-detect & remove accounts with 0 quota or expired auth
- **Multi-worker** — Run 1-N browsers in parallel for fast account adding
- **Auto-detect Browser** — Chrome, Edge, Brave auto-detected (Windows/Linux/macOS)
- **Interactive Menu** — Clean CLI interface with colored output

## How It Works

```
┌──────────────────────────────────────────────────────┐
│                    index.js (Menu)                    │
├──────────┬──────────────┬──────────────┬──────────────┤
│ [1] Add  │ [2] Quota    │ [3] Delete   │ [4] Refresh  │
└──────────┴──────────────┴──────────────┴──────────────┘
```

## Prerequisites

> **IMPORTANT:** This step is **required** before running the tool.

1. Make sure **9Router** is running at `http://localhost:20128`
2. Open **Settings** in browser: [http://localhost:20128/dashboard/profile](http://localhost:20128/dashboard/profile)
3. Scroll to **Security** section
4. **Turn OFF** the **Require Login** option
5. Save changes

If not disabled, the tool will not be able to access 9Router API.

## Requirements

- [Node.js](https://nodejs.org/) v18+
- [Google Chrome](https://www.google.com/chrome/), Edge, or Brave
- [9Router](https://github.com/9router) running on `localhost:20128`

## Quick Start

```bash
# Clone
git clone https://github.com/Attazkia/9routemanage.git
cd 9routemanage

# Install dependencies
npm install

# Create account list (format: email|password, one per line)
echo "account1@gmail.com|password123" > akun.txt

# Run
npm start
```

## Usage

### Main Menu (`npm start`)

```
   ___  ____              _
  / _ \|  _ \ ___  _   _| |_ ___ _ __
  \_, /| |_) / _ \| | | | __/ _ \ '__|
   / / |  _ < (_) | |_| | ||  __/ |
  /_/  |_| \_\___/ \__,_|\__\___|_|

  Account Manager — AntiGravity | By Idamod

  Accounts  172 total
  Model     claude-opus-4-6-thinking
  ────────────────────────────────────────────────────────────

  Menu:

  [1] Add Accounts       Add Google accounts from akun.txt
  [2] Check Quota        Check claude-opus-4-6-thinking quota
  [3] Delete Depleted    Remove depleted & expired accounts
  [4] Refresh            Reload account list
  [0] Exit
```

### Add Accounts (`npm run add`)

Can also be run standalone:

```bash
npm run add
# or
node add.js
```

### Check Quota

Shows quota status for every account with progress bars:

```
  AVAILABLE (160)
    1  │ user@gmail.com                     │ 200/1000      │ ████░░░░░░░░░░░░░░░░ │ 6d 14h

  DEPLETED (6)
  161  │ user2@gmail.com                    │ 1000/1000     │ ████████████████████ │ 6d 14h

  EXPIRED (5) — auth expired
  167  │ old@gmail.com                      │ expired       │ ──────────────────── │ -
```

### Delete Depleted

Scans all accounts, finds depleted (0/1000) and expired (auth dead) accounts, then deletes them after confirmation.

## Configuration

Edit the top of `index.js` and `add.js`:

```js
const BASE_URL = 'http://localhost:20128';  // 9Router URL
const SCREEN_WIDTH = 1920;                   // Your screen width
const SCREEN_HEIGHT = 1080;                  // Your screen height
```

### Account File

`akun.txt` — one account per line:

```
email1@gmail.com|password123
email2@gmail.com|password456
```

## Project Structure

```
9routemanage/
├── index.js        # Main menu (quota, delete, manage)
├── add.js          # Add accounts (OAuth + browser automation)
├── akun.txt        # Account list (gitignored)
├── package.json    # Dependencies & scripts
├── .gitignore      # Ignored files
└── README.md       # This file
```

## Tech Stack

| Package | Purpose |
|---------|---------|
| `puppeteer` | Browser automation |
| `puppeteer-extra` | Plugin system |
| `puppeteer-extra-plugin-stealth` | Anti-bot detection |

## Disclaimer

This tool is for personal/educational use only. Use responsibly.

**USE AT YOUR OWN RISK**

## License

MIT

---

# Bahasa Indonesia

## Fitur

- **Tambah Akun** — Bulk add akun Google via OAuth API + stealth browser
- **Cek Kuota** — Lihat kuota `claude-opus-4-6-thinking` semua akun
- **Hapus Akun Mati** — Deteksi otomatis & hapus akun yang kuotanya habis atau auth expired
- **Multi-worker** — Jalankan 1-N browser paralel untuk menambah akun lebih cepat
- **Auto-detect Browser** — Chrome, Edge, Brave terdeteksi otomatis (Windows/Linux/macOS)
- **Menu Interaktif** — Tampilan CLI berwarna dan mudah digunakan

## Cara Kerja

```
┌──────────────────────────────────────────────────────┐
│                    index.js (Menu)                    │
├──────────┬──────────────┬──────────────┬──────────────┤
│ [1] Add  │ [2] Quota    │ [3] Delete   │ [4] Refresh  │
└──────────┴──────────────┴──────────────┴──────────────┘
```

## Prasyarat

> **PENTING:** Langkah ini **wajib** dilakukan sebelum menjalankan tool.

1. Pastikan **9Router** sudah berjalan di `http://localhost:20128`
2. Buka halaman **Settings** di browser: [http://localhost:20128/dashboard/profile](http://localhost:20128/dashboard/profile)
3. Scroll ke bagian **Security**
4. **Matikan** / **OFF** kan opsi **Require Login**
5. Simpan perubahan

Jika tidak dimatikan, tool tidak akan bisa mengakses API 9Router.

## Kebutuhan

- [Node.js](https://nodejs.org/) v18+
- [Google Chrome](https://www.google.com/chrome/), Edge, atau Brave
- [9Router](https://github.com/9router) berjalan di `localhost:20128`

## Cara Install

```bash
# Clone repository
git clone https://github.com/Attazkia/9routemanage.git
cd 9routemanage

# Install dependencies
npm install
```

> `npm install` akan otomatis menginstall **puppeteer** beserta **Chromium browser**. Proses ini memerlukan koneksi internet.

## Cara Pakai

### 1. Buat File Akun

Buat file `akun.txt` di root folder, isi dengan format `email|password` (satu akun per baris):

```
akun1@gmail.com|password123
akun2@gmail.com|password456
akun3@gmail.com|password789
```

### 2. Jalankan

```bash
npm start
```

### Tampilan Menu

```
   ___  ____              _
  / _ \|  _ \ ___  _   _| |_ ___ _ __
  \_, /| |_) / _ \| | | | __/ _ \ '__|
   / / |  _ < (_) | |_| | ||  __/ |
  /_/  |_| \_\___/ \__,_|\__\___|_|

  Account Manager — AntiGravity | By Idamod

  Accounts  172 total
  Model     claude-opus-4-6-thinking
  ────────────────────────────────────────────────────────────

  Menu:

  [1] Add Accounts       Tambah akun Google dari akun.txt
  [2] Check Quota        Cek kuota claude-opus-4-6-thinking
  [3] Delete Depleted    Hapus akun yang habis & expired
  [4] Refresh            Reload daftar akun
  [0] Exit
```

### Menu

| Menu | Fungsi |
|------|--------|
| **[1] Add Accounts** | Menambahkan akun Google dari `akun.txt` ke AntiGravity. Bisa pilih jumlah worker (browser paralel). |
| **[2] Check Quota** | Cek kuota `claude-opus-4-6-thinking` semua akun. Tampil progress bar + sisa kuota + waktu reset. |
| **[3] Delete Depleted** | Scan akun yang kuotanya habis (0/1000) atau expired (auth mati), lalu hapus setelah konfirmasi. |
| **[4] Refresh** | Reload ulang daftar akun dari 9Router. |
| **[0] Exit** | Keluar. |

### Cek Kuota

Menampilkan status kuota setiap akun dengan progress bar:

```
  AVAILABLE (160)
    1  │ user@gmail.com                     │ 200/1000      │ ████░░░░░░░░░░░░░░░░ │ 6d 14h

  DEPLETED (6)
  161  │ user2@gmail.com                    │ 1000/1000     │ ████████████████████ │ 6d 14h

  EXPIRED (5) — auth expired
  167  │ old@gmail.com                      │ expired       │ ──────────────────── │ -
```

### Hapus Akun Mati

Scan semua akun, temukan yang kuotanya habis (0/1000) dan expired (auth mati), lalu hapus setelah konfirmasi.

### Menambah Akun Langsung (Tanpa Menu)

```bash
npm run add
```

## Konfigurasi

Edit bagian atas `index.js` dan `add.js`:

```js
const BASE_URL = 'http://localhost:20128';  // URL 9Router
const SCREEN_WIDTH = 1920;                   // Lebar layar
const SCREEN_HEIGHT = 1080;                  // Tinggi layar
```

## Struktur Project

```
9routemanage/
├── index.js        # Menu utama (kuota, hapus, kelola)
├── add.js          # Tambah akun (OAuth + browser automation)
├── akun.txt        # Daftar akun (tidak di-upload ke GitHub)
├── package.json    # Dependencies & scripts
├── .gitignore      # File yang di-ignore
└── README.md       # Dokumentasi
```

## Teknologi

| Package | Fungsi |
|---------|--------|
| `puppeteer` | Otomasi browser |
| `puppeteer-extra` | Sistem plugin |
| `puppeteer-extra-plugin-stealth` | Bypass deteksi bot |

## Disclaimer

Tool ini untuk keperluan pribadi/edukasi. Gunakan dengan bijak.

**GUNAKAN DENGAN RISIKO SENDIRI**
