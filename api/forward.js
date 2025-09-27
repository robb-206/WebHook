// api/webhook.js
let lastAmount = "No payment received yet";
let lastInvoiceId = "Unknown";
let lastTransactionId = "Unknown";
let lastPaypalRaw = "No PayPal payload received yet";

export const config = {
  api: {
    bodyParser: true, // ensure Vercel parses JSON body
  },
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const body = req.body; // now parsed
      lastPaypalRaw = JSON.stringify(body, null, 2);

      const resource = body.resource || {};
      const amount = resource.amount || {};
      const value = amount.value || "0.00";
      const currency = amount.currency_code || "USD";

      lastAmount = `${value} ${currency}`;
      lastInvoiceId = resource.invoice_id || "No invoice_id";
      lastTransactionId = resource.id || "No transaction ID";

      console.log("Webhook received:", lastPaypalRaw);
      console.log("Parsed values:", { lastAmount, lastInvoiceId, lastTransactionId });

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Error processing webhook:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  if (req.method === 'GET') {
    return res.status(200).send(`
<h2>Last PayPal Webhook Data</h2>
<p><strong>Amount:</strong> ${lastAmount}</p>
<p><strong>Invoice ID:</strong> ${lastInvoiceId}</p>
<p><strong>Transaction ID:</strong> ${lastTransactionId}</p>
<pre>${lastPaypalRaw}</pre>
`);
  }

  res.setHeader('Allow', ['POST','GET']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
