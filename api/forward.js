import express from "express";
import { writeFile } from "fs/promises";
import { createTransport } from "nodemailer"; // nodemailer is still needed for email
import { Readable } from "stream";

const app = express();
app.use(express.json());

// In-memory last payment info
let lastPayment = {
  amount: null,
  currency: null,
  invoiceId: null,
  transactionId: null,
  customer: { firstName: null, lastName: null, email: null },
  rawPayload: null
};

// Simple PDF generator using Node's built-in buffers
function generatePdf(paymentInfo) {
  // This is a minimal PDF structure using basic PDF syntax
  // It creates a simple PDF with text
  const text = `
HotTubPrescription.com

Bill To: ${paymentInfo.customer.firstName} ${paymentInfo.customer.lastName}

Item Description: Prescription for Spa, Swim Spa, Sauna, Plunge Tub, Lift Recliner Chair, Massage Chair or Mattress
Amount: ${paymentInfo.amount} ${paymentInfo.currency}

Transaction ID: ${paymentInfo.transactionId}
Total: ${paymentInfo.amount} ${paymentInfo.currency}

Payment Method: PayPal

Thank you for your business!
  `;

  const pdfHeader = Buffer.from(
    `%PDF-1.1
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj
4 0 obj << /Length ${text.length} >> stream\n`
  );

  const pdfFooter = Buffer.from(`\nendstream endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000110 00000 n 
0000000160 00000 n 
trailer << /Size 5 /Root 1 0 R >>
startxref
260
%%EOF`);

  const pdfContent = Buffer.from(text);

  return Buffer.concat([pdfHeader, pdfContent, pdfFooter]);
}

// Send email with built-in nodemailer
async function sendEmail(paymentInfo, pdfBuffer) {
  const transporter = createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER, // set in Vercel env
      pass: process.env.EMAIL_PASSWORD // set in Vercel env
    }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: paymentInfo.customer.email,
    subject: `Payment Receipt - HotTubPrescription.com`,
    text: `Hi ${paymentInfo.customer.firstName},\n\nPlease find attached your receipt for ${paymentInfo.amount} ${paymentInfo.currency}.`,
    attachments: [
      {
        filename: "Receipt.pdf",
        content: pdfBuffer
      }
    ]
  });
}

// Webhook endpoint
app.post("/api/forward", async (req, res) => {
  try {
    const body = req.body;
    lastPayment.rawPayload = body;

    // Extract fields from PayPal payload
    lastPayment.amount = body?.resource?.amount?.value || "0.00";
    lastPayment.currency = body?.resource?.amount?.currency_code || "USD";
    lastPayment.invoiceId = body?.resource?.invoice_id || "Unknown";
    lastPayment.transactionId = body?.resource?.id || "Unknown";
    lastPayment.customer.firstName = body?.payer?.name?.given_name || "Customer";
    lastPayment.customer.lastName = body?.payer?.name?.surname || "";
    lastPayment.customer.email = body?.payer?.email_address || process.env.EMAIL_USER;

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

// Test endpoint to view last payment
app.get("/api/forward/test", (req, res) => {
  res.json(lastPayment);
});

app.listen(process.env.PORT || 3000, () => {
  console.log("PayPal webhook server running");
});
