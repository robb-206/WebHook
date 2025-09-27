import "dotenv/config";
import express from "express";
import crypto from "crypto";
import crc32 from "buffer-crc32";
import fs from "fs/promises";
import fetch from "node-fetch";

// Environment variables
const { CACHE_DIR = ".", WEBHOOK_ID = process.env.WEBHOOK_ID } = process.env;

if (!WEBHOOK_ID) {
  console.error("⚠️ WEBHOOK_ID not set in .env");
  process.exit(1);
}

// Download & cache PayPal certificate
async function downloadAndCache(url, cacheKey) {
  if (!cacheKey) cacheKey = url.replace(/\W+/g, "-");
  const filePath = `${CACHE_DIR}/${cacheKey}`;

  const cachedData = await fs.readFile(filePath, "utf-8").catch(() => null);
  if (cachedData) return cachedData;

  const response = await fetch(url);
  const data = await response.text();
  await fs.writeFile(filePath, data);

  return data;
}

const app = express();

// PayPal sends raw JSON; need raw body for signature
app.post("/api/forward", express.raw({ type: "application/json" }), async (req, res) => {
  const headers = req.headers;
  const rawBody = req.body.toString();

  let data;
  try {
    data = JSON.parse(rawBody);
  } catch (err) {
    console.error("❌ Failed to parse JSON:", err);
    return res.sendStatus(400);
  }

  console.log("📩 Received webhook:", JSON.stringify(data, null, 2));

  const isValid = await verifySignature(rawBody, headers);
  if (isValid) {
    console.log("✅ Signature is valid, processing webhook...");
    // TODO: Add your webhook processing logic here (DB, etc.)
  } else {
    console.log(`❌ Invalid signature for event ${data?.id}`);
  }

  // Always respond 200 to PayPal
  res.sendStatus(200);
});

// Verify PayPal webhook signature
async function verifySignature(rawEvent, headers) {
  const transmissionId = headers["paypal-transmission-id"];
  const timeStamp = headers["paypal-transmission-time"];
  const crc = parseInt("0x" + crc32(rawEvent).toString("hex"));

  const message = `${transmissionId}|${timeStamp}|${WEBHOOK_ID}|${crc}`;
  console.log("🔑 Original signed message:", message);

  const certPem = await downloadAndCache(headers["paypal-cert-url"]);
  const signatureBuffer = Buffer.from(headers["paypal-transmission-sig"], "base64");

  const verifier = crypto.createVerify("SHA256");
  verifier.update(message);

  return verifier.verify(certPem, signatureBuffer);
});

// Start server on default host/port (managed by hosting)
const PORT = process.env.PORT || 443; // 443 for HTTPS
app.listen(PORT, () => {
  console.log(`🚀 Server running and listening at /api/forward`);
});

