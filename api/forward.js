consmodule.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).end(); // Method Not Allowed
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    console.log('===== PayPal Webhook Received =====');
    console.log('Raw JSON Payload:\n', body);

    try {
      const payload = JSON.parse(body);
      const resource = payload.resource;

      if (!resource) {
        console.warn("Missing 'resource' field in payload.");
        return res.status(200).end();
      }

      // Extract fields
      let total = null;
      let currency = null;
      if (resource.amount) {
        total = resource.amount.value;
        currency = resource.amount.currency_code;
      }
      const invoiceId = resource.invoice_id || "Unknown";
      const transactionId = resource.id || "Unknown";

      // Log extracted fields
      const formattedAmount = total && currency ? `${total} ${currency}` : 'Unknown';
      console.log('Extracted Fields:');
      console.log(`Amount: ${formattedAmount}`);
      console.log(`Invoice ID: ${invoiceId}`);
      console.log(`Transaction ID: ${transactionId}`);

      res.status(200).end();
    } catch (ex) {
      if (ex instanceof SyntaxError) {
        console.error('Error parsing JSON:', ex);
      } else {
        console.error('General error processing PayPal webhook:', ex);
      }
      res.status(200).end(); // PayPal expects 200 even on errors
    }
  });
};
