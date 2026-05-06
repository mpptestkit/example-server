# mpp-example-server

A reference Express server demonstrating HTTP 402 pay-per-request integration using `mpp-test-sdk`. Designed to be used alongside the playground and as a template for your own paid API.

---

## What this is

This server shows both sides of the MPP pattern in the simplest possible form:

- **Free endpoints** — no middleware, no payment required
- **Paid endpoints** — one `mpp.charge()` middleware line, payments verified on-chain

The server auto-generates a Solana keypair on startup. All payments land in that wallet. No config required.

---

## Endpoints

| Method | Path | Cost | Description |
|---|---|---|---|
| `GET` | `/health` | free | Uptime and network info |
| `GET` | `/api/info` | free | Server metadata and endpoint listing |
| `GET` | `/api/ping/free` | free | Basic ping — no payment |
| `GET` | `/api/ping/paid` | 0.001 SOL | Ping with payment required |
| `GET` | `/api/premium-data` | 0.005 SOL | Sample premium data response |

---

## Running

From the repo root:

```bash
npm run dev
```

Or from this package directly:

```bash
npm run dev      # tsx watch — restarts on file change
npm start        # tsx — single run
```

Server starts on `http://localhost:3001` by default.

### Environment

```bash
PORT=3001   # optional, default 3001
```

No other environment variables required. The server wallet is auto-generated on every cold start. To persist the same recipient address across restarts, pass a `secretKey` to `createTestServer()`.

---

## Usage

### With mppFetch (auto-handles 402)

```ts
import { mppFetch } from "mpp-test-sdk";

// Free — returns immediately
const ping = await mppFetch("http://localhost:3001/api/ping/free");
console.log(await ping.json()); // { message: "pong (free)", ... }

// Paid — SDK handles wallet + faucet + payment automatically
const data = await mppFetch("http://localhost:3001/api/premium-data");
console.log(await data.json()); // { data: [...], meta: { paid: true, cost: "0.005 SOL" } }
```

### With curl (manual 402 flow)

```bash
# Step 1 — call the paid endpoint, get 402 back
curl -i http://localhost:3001/api/ping/paid
# HTTP/1.1 402 Payment Required
# Payment-Request: solana; amount="0.001"; recipient="9WzDX..."; network="devnet"

# Step 2 — pay on Solana, then retry with the receipt
curl -H 'Payment-Receipt: solana; signature="3xKm7..."; network="devnet"' \
     http://localhost:3001/api/ping/paid
# HTTP/1.1 200 OK
# { "message": "pong", "paid": true }
```

---

## Adding your own paid endpoint

```ts
import express from "express";
import { createTestServer } from "mpp-test-sdk";

const app = express();
const mpp = createTestServer();            // auto wallet on devnet

// Free
app.get("/free", (req, res) => res.json({ ok: true }));

// Paid — drop mpp.charge() before your handler
app.get("/paid",
  mpp.charge({ amount: "0.001" }),         // amount in SOL
  (req, res) => res.json({ secret: "premium content" })
);

app.listen(3001);
console.log("Recipient:", mpp.recipientAddress);
```

Switch to mainnet by passing a funded keypair:

```ts
const mpp = createTestServer({
  network: "mainnet",
  secretKey: Uint8Array.from(JSON.parse(process.env.SOLANA_SECRET_KEY!)),
});
```

---

## How payment verification works

When a request arrives with a `Payment-Receipt` header the middleware:

1. Parses the Solana transaction signature from the header
2. Fetches the transaction from the Solana RPC
3. Confirms the recipient in `accountKeys` matches `mpp.recipientAddress`
4. Confirms the SOL delta on the recipient account is ≥ the required amount
5. Calls `next()` if valid, returns `403` if not

---

## Source

```
src/
└── server.ts   # all endpoints + MPP setup (< 80 lines)
```

The entire server is one file. Copy, modify, ship.
