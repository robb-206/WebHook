// api/webhook.js
let lastAmount = "No payment received yet";
let lastCustomerFirstName = "No customer first name yet";
let lastCustomerLastName = "No customer last name yet";
let lastCustomerEmail = "No customer email yet";
let lastInvoiceId = " ";
let lastPaypalRaw = "No PayPal payload received yet";
let lastTransactionId = " ";
let lastJotFormPretty = "No JotForm submission received yet";

export default async function handler(req, res) {
  if (req.method === "POST") {
    // PayPal webhook
    try {
      const body = req.body;
      lastPaypalRaw = JSON.stringify(body, null, 2);

      if (!body.resource) {
        console.warn("Missing resource in PayPal payload");
        return res.status(200).send("OK");
      }

      // Extract payment details
      const amount = body.resource.amount?.value;
      const currency = body.resource.amount?.currency_code;
      lastAmount = amount && currency ? `${amount} ${currency}` : "Unknown";

      lastInvoiceId = body.resource.invoice_id || "Unknown";
      lastTransactionId = body.resource.id || "Unknown";

      console.log("PayPal webhook processed:", {
        amount: lastAmount,
        invoice: lastInvoiceId,
        transaction: lastTransactionId,
      });

      return res.status(200).send("PayPal webhook received");
    } catch (err) {
      console.error("Error handling PayPal webhook:", err);
      return res.status(200).send("Error processing webhook");
    }
  }

  if (req.method === "GET") {
    // Test endpoint
    const response = `
      Last payment amount: ${lastAmount}
      Last invoice ID: ${lastInvoiceId}
      Last transaction ID: ${lastTransactionId}
      Customer first name: ${lastCustomerFirstName}
      Customer last name: ${lastCustomerLastName}
      Customer email: ${lastCustomerEmail}

      Last JotForm pretty:
      ${lastJotFormPretty}

      Last PayPal raw JSON:
      ${lastPaypalRaw}
    `;
    return res.status(200).send(response);
  }

  return res.status(405).send("Method Not Allowed");
}

// JotForm webhook endpoint
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
};

// Create a separate endpoint for JotForm
export async function jotformHandler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const formData = req.body;

  console.log("JotForm payload received:", formData);

  const rawRequest = formData.rawRequest;
  if (!rawRequest) {
    return res.status(400).send("Missing rawRequest field");
  }

  try {
    const data = JSON.parse(rawRequest);

    lastCustomerFirstName = data.q3_name?.first || "Unknown";
    lastCustomerLastName = data.q3_name?.last || "Unknown";
    lastCustomerEmail = data.q4_email || "Unknown";

    lastInvoiceId =
      data.q7_invoiceId || `ServerGen_${Date.now().toString(36)}`;

    lastJotFormPretty = formData.pretty || JSON.stringify(data, null, 2);

    console.log("Extracted JotForm fields:", {
      firstName: lastCustomerFirstName,
      lastName: lastCustomerLastName,
      email: lastCustomerEmail,
      invoice: lastInvoiceId,
    });

    return res.status(200).json({ invoiceID: lastInvoiceId });
  } catch (err) {
    console.error("Error parsing JotForm JSON:", err);
    return res.status(400).send("Invalid JSON in rawRequest");
  }
}
