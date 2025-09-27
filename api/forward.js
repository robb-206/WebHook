import express from "express";
import fs from "fs/promises";
import pdfLib from "pdfkit"; // Simple PDF generation
import nodemailer from "nodemailer";
import { readFileSync } from "fs";

const app = express();
app.use(express.json());

// Load JSON configuration
const config = JSON.parse(readFileSync("./config.json", "utf-8"));

// In-memory storage
let lastPayment = {
  amount: null,
  currency: null,
  invoiceId: null,
  transactionId: null,
  customer: { firstName: null, lastName: null, email: null },
  rawPayload: null
};

// Helper to extract nested fields
function getNested(obj, path) {
  return path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj);
}

// Generate PDF receipt
function generatePdf(paymentInfo) {
  const doc = new pdfLib();
  const buffers = [];
  doc.on("data", buffers.push.bind(buffers));
  doc.on("end", () => {});

  doc.fontSize(18).text(config.pdfTemplate.header, { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(
    config.pdfTemplate.customerNameField
      .replace("{firstName}", paymentInfo.customer.firstName)
      .replace("{lastName}", paymentInfo.customer.lastName)
  );
  doc.moveDown();

  config.pdfTemplate.table.forEach(row => {
    doc.text(`${row.item} - ${row.amount.replace("{amount}", paymentInfo.amount).replace("{currency}", paymentInfo.currency)}`);
  });

  doc.moveDown();
  doc.text(`Transaction ID: ${paymentInfo.transactionId}`);
  doc.text(`Total: ${paymentInfo.amount} ${paymentInfo.currency}`);
  doc.text(config.pdfTemplate.footer, { align: "center" });

  doc.end();
  return Buffer.concat(buffers);
}

// Send email
async function sendEmail(paymentInfo, pdfBuffer) {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: config.emailTemplate.from,
      pass: process.env.EMAIL_PASSWORD // store securely
    }
  });

  await transporter.sendMail({
    from: config.emailTemplate.from,
    to: paymentInfo.customer.email,
    subject: config.emailTemplate.subject,
    text: config.emailTemplate.body
      .replace("{firstName}", paymentInfo.customer.firstName)
      .replace("{amount}", paymentInfo.amount)
      .replace("{currency}", paymentInfo.currency),
    attachments: [
      {
        filename: "Receipt.pdf",
        content: pdfBuffer
      }
    ]
  });
}

// Webhook endpoint
app.post("/paypal-webhook", async (req, res) => {
  try {
    const body = req.body;
    lastPayment.rawPayload = body;

    // Extract fields
    lastPayment.amount = getNested(body, "resource.amount.value");
    lastPayment.currency = getNested(body, "resource.amount.currency_code");
    lastPayment.invoiceId = getNested(body, "resource.invoice_id");
    lastPayment.transactionId = getNested(body, "resource.id");
    lastPayment.customer.firstName = getNested(body, "payer.name.given_name") || "Customer";
    lastPayment.customer.lastName = getNested(body, "payer.name.surname") || "";
    lastPayment.customer.email = getNested(body, "payer.email_address") || "defaultemail@example.com";

    // Generate PDF
    const pdfBuffer = generatePdf(lastPayment);

    // Send email
    await sendEmail(lastPayment, pdfBuffer);

    console.log("Webhook processed successfully", lastPayment);
    res.sendStatus(200);
  } catch (err) {
    console.error("Error processing webhook:", err);
    res.sendStatus(500);
  }
});

// Test endpoint
app.get("/paypal-webhook/test", (req, res) => {
  res.json(lastPayment);
});

app.listen(process.env.PORT || 3000, () => {
  console.log("PayPal webhook server running on port 3000");
});
