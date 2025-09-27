import "dotenv/config";
import express from "express";
 
import crypto from "crypto"
import crc32 from "buffer-crc32"
 
import fs from "fs/promises"
import fetch from "node-fetch"
 
// Note: PayPal only delivers webhooks to port 443 (HTTPS).
// Development ports can be used in a forwarding configuration, set 443 if this is front-facing.
const { LISTEN_PORT = 8888, LISTEN_PATH="/", CACHE_DIR = ".", WEBHOOK_ID = "<from when the listener URL was subscribed>" } = process.env;
 
async function downloadAndCache(url, cacheKey) {
  if(!cacheKey) {
    cacheKey = url.replace(/\W+/g, '-')
  }
  const filePath = `${CACHE_DIR}/${cacheKey}`;
 
  // Check if cached file exists
  const cachedData = await fs.readFile(filePath, 'utf-8').catch(() => null);
  if (cachedData) {
    return cachedData;
  }
 
  // Download the file if not cached
  const response = await fetch(url);
  const data = await response.text()
  await fs.writeFile(filePath, data);
 
  return data;
}
 
const app = express();
 
app.post(LISTEN_PATH, express.raw({type: 'application/json'}), async (request, response) => {
  const headers = request.headers;
  const event = request.body;
  const data = JSON.parse(event)
 
  console.log(`headers`, headers);
  console.log(`parsed json`, JSON.stringify(data, null, 2));
  console.log(`raw event: ${event}`);
 
  const isSignatureValid = await verifySignature(event, headers);
 
  if (isSignatureValid) {
    console.log('Signature is valid.');
 
    // Successful receipt of webhook, do something with the webhook data here to process it, e.g. write to database
    console.log(`Received event`, JSON.stringify(data, null, 2));
 
  } else {
    console.log(`Signature is not valid for ${data?.id} ${headers?.['correlation-id']}`);
    // Reject processing the webhook event. May wish to log all headers+data for debug purposes.
  }
 
  // Return a 200 response to mark successful webhook delivery
  response.sendStatus(200);
});
 
async function verifySignature(event, headers) {
  const transmissionId = headers['paypal-transmission-id']
  const timeStamp = headers['paypal-transmission-time']
  const crc = parseInt("0x" + crc32(event).toString('hex')); // hex crc32 of raw event data, parsed to decimal form
 
  const message = `${transmissionId}|${timeStamp}|${WEBHOOK_ID}|${crc}`
  console.log(`Original signed message ${message}`);
 
  const certPem = await downloadAndCache(headers['paypal-cert-url']);
 
  // Create buffer from base64-encoded signature
  const signatureBuffer = Buffer.from(headers['paypal-transmission-sig'], 'base64');
 
  // Create a verification object
  const verifier = crypto.createVerify('SHA256');
 
  // Add the original message to the verifier
  verifier.update(message);
 
  return verifier.verify(certPem, signatureBuffer);
}
 
app.listen(LISTEN_PORT, () => {
  console.log(`Node server listening at http://localhost:${LISTEN_PORT}/`);
});
