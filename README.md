# TAZIA

**Temporary Anonymous Zone In Action**

A room that only exists while you’re inside it: no accounts, and no message server of ours. You share a phrase, talk live, then **burn the session** when you’re done.

On phones you can **Install / Add to Home Screen**.  
Live site: [gonzosint.github.io/tazia](https://gonzosint.github.io/tazia/)

[Español](README.es.md)

---

## In short

TAZIA does not store chats in the cloud. Conversation lives between browsers that are **online at the same time**. When nobody else is connected, the room goes quiet. When you burn, **this** device forgets the zone.

| You want… | Go to… |
| --- | --- |
| Open or join | **Zones** |
| Group talk | **Plaza** |
| See who’s here / verify someone | **Tribe** |
| Private message | **Whispers** |
| Clear everything on this device | **Burn session** |

---

## How to use it (on the web)

1. Open [TAZIA](https://gonzosint.github.io/tazia/).
2. Tap **Open zone** and generate (or type) a **phrase**.
3. Pass it to the other person in person, by phone, or on paper.  
   You can also put it in the link — easier, less private.
4. They join with **Enter with phrase**, the link, or the **QR**.
5. The first time, the browser asks for a network permission so you can find each other on the same Wi‑Fi or LAN.
6. When you’re done: **Burn session**.

You can keep up to **three zones** open and switch between them. Leaving one does not drop the others; burn clears all on **this** browser.

---

## How to run it on your machine

You need [Node.js](https://nodejs.org/) (LTS recommended) and this repo.

```bash
npm install
```

### Development (live reload)

```bash
npm run dev
```

Open **http://localhost:5173/tazia/** (the trailing path matters: the app lives under `/tazia/`).

Good for hacking on the code. Two tabs or two devices on the same network can join the same zone with the same phrase.

### Preview the production build

```bash
npm run build
npm run preview
```

Vite serves the `dist/` folder (PWA included). The URL is still under `/tazia/`.

### Single-file HTML (offline / verifiable)

```bash
npm run build:single
```

Creates:

| File | Purpose |
| --- | --- |
| `release/tazia-single.html` | The whole app in one HTML file (CSS/JS and the QR worker inlined) |
| `release/tazia-single.html.sha256` | SHA-256 fingerprint so you can check it wasn’t altered |
| `release/MANIFEST.txt` | Short build summary |

**How to open it**

1. Open `tazia-single.html` in a browser (double-click / `file://`), **or** serve it with any local static server.
2. To verify integrity (PowerShell example):

```powershell
Get-FileHash .\release\tazia-single.html -Algorithm SHA256
# Compare with the hash in tazia-single.html.sha256
```

**What the single-file is not**

- It does not include a PWA service worker (no “install app” like on Pages).
- It does not replace the multi-asset GitHub Pages deploy.
- It is for USB carry, auditing one build, or using the app without serving `dist/`.

---

## Tips

**Connection.** Same Wi‑Fi usually works better. If you can’t connect, **Zones → Fix** walks through next steps. Sometimes you need your own TURN server ([guide](docs/TURN.md)): a relay that helps when direct P2P can’t get through the router or CGNAT.

**Phrase.** It’s the key to the room — don’t post it in a public chat. Verifying in **Tribe** (emoji sequence) confirms you’re talking to the right person.

**Expectations.** Best for small groups. Not a daily messenger replacement: it’s a **temporary** zone. Burn clears this device; the other side keeps theirs until they burn too.

---

## Browsers

Chrome, Brave, Firefox, and Safari. On the public internet you need **HTTPS**. Locally, `localhost` counts as a secure context.

---

## More documentation

| Topic | Document |
| --- | --- |
| Risks and limits | [Security](docs/SECURITY.md) |
| Can’t connect (TURN / Wi‑Fi) | [Connection](docs/TURN.md) |
| Technical index | [docs/](docs/README.md) |

---

## Development

Stack: React + Vite + [Trystero](https://trystero.dev/). Protocol **TAZEP** (`tazep-v2`). App ID: `tazia.app`.

```bash
npm install
npm run dev          # http://localhost:5173/tazia/
npm run build        # → dist/ (PWA)
npm run build:single # → release/tazia-single.html + SHA-256
npm run preview      # serves dist/
npm run lint         # TypeScript check, no emit
```

GitHub Pages deploy: [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) (`base: '/tazia/'`).  
Sample headers: [`public/_headers`](public/_headers).  
Technical detail and papers: [docs/README.md](docs/README.md).
