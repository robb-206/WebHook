import "dotenv/config";
import express from "express";

const { LISTEN_PATH = "/api/forward" } = process.env;

const app = express();
app.use(express.raw({ type: "application/json" }));

app.post(LISTEN_PATH, async (request, response) => {
  try {
    console.log("Webhook received at", new Date().toISOString());
    console.log("Headers:", JSON.stringify(request.headers, null, 2));

    // Check for empty body
    if (!request.body || request.body.length === 0) {
      console.error("Empty request body");
      return response.status(400).json({ error: "Empty request body" });
    }

    // Parse JSON
    let data;
    try {
      data = JSON.parse(request.body.toString());
      console.log("Parsed JSON:", JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(`JSON parse error: ${err.message}`);
      return response.status(400).json({ error: "Invalid JSON" });
    }

    console.log("Event ID:", data?.id || "unknown");
    console.log("Event Type:", data?.event_type || "unknown");
    console.log("Webhook processed successfully");

    // TODO: Add receipt generation and emailing later
    return response.sendStatus(200);
  } catch (err) {
    console.error(`Handler error: ${err.message}\nStack: ${err.stack}`);
    return response.sendStatus(200); // PayPal expects 200
  }
});

export default app;


