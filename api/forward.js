let lastAmount = "No payment received yet";
let lastInvoiceId = "Unknown";
let lastTransactionId = "Unknown";
let lastPaypalRaw = "No PayPal payload received yet";

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      // Store and log raw payload
      lastPaypalRaw = JSON.stringify(req.body, null, 2);
      console.log('Webhook received:', lastPaypalRaw);

      // Extract key fields
      const resource = req.body.resource || {};
      lastAmount = resource.amount?.value && resource.amount?.currency_code
        ? `${resource.amount.value} ${resource.amount.currency_code}`
        : lastAmount;
      lastInvoiceId = resource.invoice_id || lastInvoiceId;
      lastTransactionId = resource.id || lastTransactionId;

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Error processing webhook:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  if (req.method === 'GET') {
    // Quick browser test
    return res.status(200).send(`
Last payment amount: ${lastAmount}
Last invoice ID: ${lastInvoiceId}
Last transaction ID: ${lastTransactionId}

Last PayPal payload:
${lastPaypalRaw}
`);
  }

  res.setHeader('Allow', ['POST','GET']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
