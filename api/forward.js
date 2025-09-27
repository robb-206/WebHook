import "dotenv/config";
import express from "express";
import crypto from "crypto";
import crc32 from "buffer-crc32";
import fs from "fs/promises";
import fetch from "node-fetch";

// Environment variables with defaults
const {
  LISTEN_PORT = 3000, // Use 443 for production, 3000 for local testing with ngrok
  LISTEN_PATH = "/webhook", // Simplified path for testing
  CACHE_DIR = "./cache", // Explicit cache dir
  WEBHOOK_ID = "4R839067G13323109", // Your PayPal webhook ID
} = process.env;

// Ensure cache directory exists
await fs.mkdir(CACHE_DIR, { recursive: true }).catch((err) => {
  console.error(`Failed to create cache directory: ${err.message}`);
  process.exit(1); // Exit if cache dir can't be created
});

async function downloadAndCache(url, cacheKey) {
  try {
    if (!cacheKey) {
      cacheKey = url.replace(/\W+/g, "-");
    }
    const filePath = `${CACHE_DIR}/${cacheKey}`;

    // Check if cached file exists
    const cachedData = await fs.readFile(filePath, "utf-8").catch(() => null);
    if (cachedData) {
      console.log(`Using cached certificate for ${url}`);
      return cachedData;
    }

    // Download certificate
    console.log(`Fetching certificate from ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch certificate: ${response.statusText}`);
    }
    const data = await response.text();
    await fs.writeFile(filePath, data).catch((err) => {
      console.error(`Failed to cache certificate: ${err.message}`);
    });
    return data;
  } catch (err) {
    console.error(`Error in downloadAndCache: ${err.message}`);
    throw err; // Let caller handle
  }
}

const app = express();

// Parse raw JSON body for PayPal webhooks
app.use(express.raw({ type: "application/json" }));

app.post(LISTEN_PATH, async (request, response) => {
  try {
    const headers = request.headers;
    const event = request.body; // Raw Buffer

    // Validate required headers
    const requiredHeaders = [
      "paypal-transmission-id",
      "paypal-transmission-time",
      "paypal-cert-url",
      "paypal-transmission-sig",
    ];
    for (const header of requiredHeaders) {
      if (!headers[header]) {
        console.error(`Missing header: ${header}`);
        return response.status(400).json({ error: `Missing ${header}` });
      }
    }

    // Parse JSON safely
    let data;
    try {
      data = JSON.parse(event.toString());
    } catch (err) {
      console.error(`Failed to parse JSON: ${err.message}`);
      return response.status(400).json({ error: "Invalid JSON payload" });
    }

    // Log payload for debugging
    console.log("Headers:", headers);
    console.log("Parsed JSON:", JSON.stringify(data, null, 2));

    // Verify PayPal signature
    const isSignatureValid = await verifySignature(event, headers);
    if (isSignatureValid) {
      console.log("Signature is valid.");
      // TODO: Process webhook data (e.g., generate receipt, email)
      console.log("Received event:", JSON.stringify(data, null, 2));
      // Example: Save to DB, generate PDF receipt, send email
    } else {
      console.error(
        `Invalid signature for event ${data?.id} (correlation-id: ${headers["paypal-transmission-id"]})`
      );
    }

    // Always return 200 to acknowledge receipt (PayPal requirement)
    return response.sendStatus(200);
  } catch (err) {
    console.error(`Error processing webhook: ${err.message}`);
    return response.sendStatus(200); // Still acknowledge to PayPal, log error for debugging
  }
});

async function verifySignature(event, headers) {
  try {
    const transmissionId = headers["paypal-transmission-id"];
    const timeStamp = headers["paypal-transmission-time"];
    const certUrl = headers["paypal-cert-url"];
    const signature = headers["paypal-transmission-sig"];

    // Calculate CRC32 of raw event body (hex string)
    const crc = crc32(event).toString("hex");
    const message = `${transmissionId}|${timeStamp}|${WEBHOOK_ID}|${crc}`;
    console.log(`Signature message: ${message}`);

    // Fetch and cache PayPal certificate
    const certPem = await downloadAndCache(certUrl);

    // Verify signature
    const verifier = crypto.createVerify("SHA256");
    verifier.update(message);
    const signatureBuffer = Buffer.from(signature, "base64");
    const isValid = verifier.verify(certPem, signatureBuffer);

    return isValid;
  } catch (err) {
    console.error(`Signature verification failed: ${err.message}`);
    return false; // Fail safely
  }
}

app.listen(LISTEN_PORT, () => {
  console.log(`Server listening at http://localhost:${LISTEN_PORT}${LISTEN_PATH}`);
});
