import "dotenv/config";
import express from "express";
import crypto from "crypto";
import crc32 from "buffer-crc32";
import fs from "fs/promises";
import fetch from "node-fetch";

// Environment variables
const {
  LISTEN_PATH = "/api/forward",
  CACHE_DIR = "/tmp/cache", // Vercel-safe temp dir
  WEBHOOK_ID = "4R839067G13323109",
} = process.env;

// Wrap top-level await in an async IIFE to fix SyntaxError
(async () => {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    console.log(`Cache directory ready: ${CACHE_DIR}`);
  } catch (err) {
    console.error(`Failed to create cache directory: ${err.message}`);
  }
})();

async function downloadAndCache(url, cacheKey) {
  try {
    if (!url) throw new Error("No certificate URL provided");
    if (!cacheKey) cacheKey = url.replace(/\W+/g, "-");
    const filePath = `${CACHE_DIR}/${cacheKey}`;

    // Check cache
    try {
      const cachedData = await fs.readFile(filePath, "utf-8");
      console.log(`Using cached certificate for ${url}`);
      return cachedData;
    } catch {}

    // Fetch and cache
    console.log(`Fetching certificate from ${url}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
    const data = await response.text();
    await fs.writeFile(filePath, data);
    return data;
  } catch (err) {
    console.error(`downloadAndCache error: ${err.message}`);
    throw err;
  }
}

async function verifySignature(event, headers) {
  try {
    const transmissionId = headers["paypal-transmission-id"];
    const timeStamp = headers["paypal-transmission-time"];
    const certUrl = headers["paypal-cert-url"];
    const signature = headers["paypal-transmission-sig"];

    if (!transmissionId || !timeStamp || !certUrl || !signature) {
      throw new Error("Missing PayPal headers");
    }

    const crc = crc32(event).toString("hex");
    const message = `${transmissionId}|${timeStamp}|${WEBHOOK_ID}|${crc}`;
    console.log(`Signature message: ${message}`);

    const certPem = await downloadAndCache(certUrl);
    const verifier = crypto.createVerify("SHA256");
    verifier.update(message);
    const signatureBuffer = Buffer.from(signature, "base64");
    return verifier.verify(certPem, signatureBuffer);
  } catch (err) {
    console.error(`verifySignature error: ${err.message}`);
    return false;
  }
}

const app = express();
app.use(express.raw({ type: "application/json" }));

app.post(LISTEN_PATH, async (request, response) => {
  try {
    console.log("Webhook received");
    const headers = request.headers;
    const event = request.body;

    console.log("Headers:", JSON.stringify(headers, null, 2));

    // Validate headers
    const requiredHeaders = ["paypal-transmission-id", "paypal-transmission-time", "paypal-cert-url", "paypal-transmission-sig"];
    for (const header of requiredHeaders) {
      if (!headers[header]) {
        console.error(`Missing header: ${header}`);
        return response.status(400).json({ error: `Missing ${header}` });
      }
    }

    // Parse JSON
    let data;
    try {
      data = JSON.parse(event.toString());
      console.log("Parsed JSON:", JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(`JSON parse error: ${err.message}`);
      return response.status(400).json({ error: "Invalid JSON" });
    }

    // Verify signature
    const isValid = await verifySignature(event, headers);
    if (isValid) {
      console.log("Signature valid");
      // TODO: Generate receipt and email here
      console.log("Event:", JSON.stringify(data, null, 2));
    } else {
      console.error("Invalid signature");
    }

    return response.sendStatus(200);
  } catch (err) {
    console.error(`Handler error: ${err.message}\nStack: ${err.stack}`);
    return response.sendStatus(200);
  }
});

// Export for Vercel
export default app;

