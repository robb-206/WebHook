export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const body = req.body;

      // Extract fields from PayPal payload
      const amount = body?.resource?.amount?.value || "0.00";
      const currency = body?.resource?.amount?.currency_code || "USD";
      const invoiceId = body?.resource?.invoice_id || "Unknown";
      const transactionId = body?.resource?.id || "Unknown";
      const firstName = body?.payer?.name?.given_name || "Customer";
      const lastName = body?.payer?.name?.surname || "";
      const email = body?.payer?.email_address || "youremail@example.com";

      // Minimal PDF (just a text file with .pdf extension)
      const pdfContent = `
HotTubPrescription.com

Bill To: ${firstName} ${lastName}

Item Description: Prescription for Spa, Swim Spa, Sauna, Plunge Tub, Lift Recliner Chair, Massage Chair or Mattress
Amount: ${amount} ${currency}

Transaction ID: ${transactionId}
Total: ${amount} ${currency}

Payment Method: PayPal

Thank you for your business!
      `;

      // Save PDF temporarily (optional, only for demo)
      // await require('fs').promises.writeFile('/tmp/receipt.pdf', pdfContent);

      // You can integrate sending email here if you want
      // For zero-dependency, you can skip email or call an external API

      console.log("Received PayPal webhook:", {
        amount,
        currency,
        invoiceId,
        transactionId,
        firstName,
        lastName,
        email
      });

      return res.status(200).json({ message: "Webhook received successfully" });
    } catch (err) {
      console.error("Error processing webhook:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
