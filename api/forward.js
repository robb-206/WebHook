// api/webhook.js

let lastAmount = "No payment received yet";
let lastInvoiceId = "Unknown";
let lastTransactionId = "Unknown";
let lastPaypalRaw = "No PayPal payload received yet";

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      lastPaypalRaw = JSON.stringify(req.body, null, 2);

      const resource = req.body.resource || {};
      lastAmount = resource.amount?.value && resource.amount?.currency_code
        ? `${resource.amount.value} ${resource.amount.currency_code}`
        : lastAmount;
      lastInvoiceId = resource.invoice_id || lastInvoiceId;
      lastTransactionId = resource.id || lastTransactionId;

      console.log("Webhook received:", lastPaypalRaw);

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Error processing webhook:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  if (req.method === 'GET') {
    // Display the extracted fields in browser
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
