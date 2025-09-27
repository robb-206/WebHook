import "dotenv/config";
import express from "express";
import crypto from "crypto";
import crc32 from "buffer-crc32";
import fs from "fs/promises";
import fetch from "node-fetch";

// Environment variables with defaults
const {
  LISTEN_PATH = "/api/forward",
  CACHE_DIR = "/tmp/cache", // Vercel only allows writes to /tmp
  WEBHOOK_ID = "4R839067G13323109", // Your PayPal webhook ID
} = process.env;

// Ensure cache directory exists
try {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  console.log(`Cache directory ready: ${CACHE_DIR}`);
} catch (err) {
  console.error(`Failed to create cache directory: ${err.message}`);
}

async function downloadAndCache(url, cacheKey) {
  try {
    if (!url) throw new Error("No certificate URL provided");
    if (!cacheKey) cacheKey = url.replace(/\W+/g, "-");
    const filePath = `${CACHE_DIR}/${cacheKey}`;

    // Check if cached file exists
    try {
      const cachedData = await fs.readFile(filePath, "utf-8");
      console.log(`Using cached certificate for ${url}`);
      return cachedData;
    } catch (err) {
      console.log(`No cached certificate found for ${url}`);
    }

    // Download certificate
    console.log(`Fetching certificate from ${url}`);
    const response = await fetch(url, { timeout: 5000 }); // Add timeout for Vercel
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
      throw new Error("Missing required PayPal headers");
    }

    // Calculate CRC32 of raw event body
    const crc = crc32(event).toString("hex");
    const message = `${transmissionId}|${timeStamp}|${WEBHOOK_ID}|${crc}`;
    console.log(`Signature message: ${message}`);

    // Fetch certificate
    const certPem = await downloadAndCache(certUrl);

    // Verify signature
    const verifier = crypto.createVerify("SHA256");
    verifier.update(message);
    const signatureBuffer = Buffer.from(signature, "base64");
    const isValid = verifier.verify(certPem, signatureBuffer);
    console.log(`Signature verification result: ${isValid}`);
    return isValid;
  } catch (err) {
    console.error(`Signature verification failed: ${err.message}`);
    return false; // Fail safely
  }
}

const app = express();
app.use(express.raw({ type: "application/json" }));

app.post(LISTEN_PATH, async (request, response) => {
  try {
    console.log("Webhook received");
    const headers = request.headers;
    const event = request.body; // Raw Buffer

    // Log headers for debugging
    console.log("Headers:", JSON.stringify(headers, null, 2));

    // Validate headers
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

    // Parse JSON
    let data;
    try {
      data = JSON.parse(event.toString());
      console.log("Parsed JSON:", JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(`Failed to parse JSON: ${err.message}`);
      return response.status(400).json({ error: "Invalid JSON payload" });
    }

    // Verify signature (optional for initial debugging)
    const isSignatureValid = await verifySignature(event, headers);
    if (isSignatureValid) {
      console.log("Signature is valid.");
      // TODO: Process payment (e.g., generate receipt, email)
      console.log("Event data:", JSON.stringify(data, null, 2));
    } else {
      console.error(
        `Invalid signature for event ${data?.id || "unknown"} (correlation-id: ${
          headers["paypal-transmission-id"]
        })`
      );
    }

    // Acknowledge webhook to PayPal
    return response.sendStatus(200);
  } catch (err) {
    console.error(`Webhook error: ${err.message}\nStack: ${err.stack}`);
    return response.sendStatus(200); // PayPal expects 200 even on errors
  }
});

// Export for Vercel serverless
export default app;
