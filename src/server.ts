import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { createTestServer } from "mpp-test-sdk";

// --- Env validation ---
const MPP_SECRET_KEY = process.env.MPP_SECRET_KEY;
if (!MPP_SECRET_KEY) {
  console.error("ERROR: MPP_SECRET_KEY is not set. Copy .env.example to .env and configure it.");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

// --- MPP middleware ---
const mpp = createTestServer({ secretKey: MPP_SECRET_KEY });

// --- Health check ---
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// --- Free endpoint ---
app.get("/api/ping/free", (_req, res) => {
  res.json({ message: "pong (free)", timestamp: Date.now() });
});

// --- Paid endpoints ---
app.get("/api/ping/paid", mpp.charge({ amount: "0.01" }), (_req, res) => {
  res.json({ message: "pong", timestamp: Date.now(), paid: true });
});

app.get("/api/premium-data", mpp.charge({ amount: "0.05" }), (_req, res) => {
  res.json({
    data: [
      { id: 1, name: "Premium Item A", value: 42 },
      { id: 2, name: "Premium Item B", value: 99 },
      { id: 3, name: "Premium Item C", value: 7 },
    ],
    meta: { total: 3, paid: true, cost: "0.05 PathUSD" },
  });
});

// --- Server info ---
app.get("/api/info", (_req, res) => {
  res.json({
    name: "MPP Test Server",
    version: "1.0.0",
    network: "Tempo Testnet",
    endpoints: [
      { path: "/api/ping/free", paid: false },
      { path: "/api/ping/paid", paid: true, cost: "0.01 PathUSD" },
      { path: "/api/premium-data", paid: true, cost: "0.05 PathUSD" },
    ],
  });
});

// --- Error handler ---
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// --- Start ---
const PORT = parseInt(process.env.PORT || "3001", 10);
const server = app.listen(PORT, () => {
  console.log(`MPP Test Server running on http://localhost:${PORT}`);
  console.log(`  Network:  Tempo Testnet`);
  console.log(`  Free:     GET /api/ping/free`);
  console.log(`  Paid:     GET /api/ping/paid (0.01 PathUSD)`);
  console.log(`  Premium:  GET /api/premium-data (0.05 PathUSD)`);
  console.log(`  Health:   GET /health`);
});

// --- Graceful shutdown ---
function shutdown() {
  console.log("\nShutting down...");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

