const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const data = require('../../data');  // Adjust path if needed

// Helper to send email with PDF
async function sendEmailWithPdf(toEmail, subject, message, pdfBytes) {
  const fromEmail = process.env.GMAIL_USER || 'rdionian69@gmail.com';  // Use env vars for security
  const pw = process.env.GMAIL_PASS || 'zvtxhymdnlwzapla';

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: fromEmail, pass: pw }
    });

    await transporter.sendMail({
      from: fromEmail,
      to: toEmail,
      subject: subject,
      text: message,
      attachments: [{ filename: 'Receipt.pdf', content: pdfBytes }]
    });
    console.log(`Email sent successfully to ${toEmail}`);
  } catch (ex) {
    console.error(`Error sending email to ${toEmail}:`, ex);
  }
}

module.exports = async (req, res) => {
  if (req.method === 'POST') {  // PayPal Webhook
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      console.log('===== PayPal Webhook Received =====');
      console.log('Raw JSON Payload:\n', body);

      data.setLastPaypalRaw(body);

      try {
        const payload = JSON.parse(body);
        const resource = payload.resource;

        if (!resource) {
          console.warn("Missing 'resource' field in payload.");
          return res.status(200).end();
        }

        let total = null;
        let currency = null;
        if (resource.amount) {
          total = resource.amount.value;
          currency = resource.amount.currency_code;
        }

        const invoiceId = resource.invoice_id || "Unknown";
        const transactionId = resource.id || "Unknown";

        let formattedAmount = '';
        if (total && currency) {
          formattedAmount = `${total} ${currency}`;
          data.setLastAmount(formattedAmount);
        }
        data.setLastInvoiceId(invoiceId);
        data.setLastTransactionId(transactionId);

        console.log('Extracted Fields:');
        console.log(`Amount: ${formattedAmount}`);
        console.log(`Invoice ID: ${invoiceId}`);
        console.log(`Transaction ID: ${transactionId}`);

        // Use latest customer info
        const customerFirstName = data.lastCustomerFirstName || "Customer";
        const customerLastName = data.lastCustomerLastName || "";
        const customerEmail = data.lastCustomerEmail || "defaultemail@example.com";

        console.log(`Using customer info from last JotForm: Name: ${customerFirstName} ${customerLastName}, Email: ${customerEmail}`);

        // Generate PDF with PDFKit (approximates QuestPDF layout)
        const doc = new PDFDocument({ margin: 40 });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', async () => {
          const pdfBytes = Buffer.concat(buffers);

          // Send email (to "robb_206@outlook.com" as in code, but use customerEmail?)
          await sendEmailWithPdf("robb_206@outlook.com", "Payment Receipt - HotTubPrescription.com",
            `Hi ${customerFirstName},\n\nPlease find attached your receipt for ${formattedAmount}.`, pdfBytes);

          console.log(`Email sent to: ${customerEmail}`);
          res.status(200).end();
        });

        // PDF Content
        doc.fontSize(18).font('Helvetica-Bold').text('HotTubPrescription.com', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').text('2009 1st Ave. E. • Bradenton, FL 34208', { align: 'center' });
        doc.text('Email: info@hottubprescription.com', { align: 'center' });
        doc.moveDown(1.5);
        doc.fontSize(16).font('Helvetica-Bold').text('Payment Receipt', { align: 'center', underline: true });
        doc.moveDown();
        doc.fontSize(12).text(`Bill To: ${customerFirstName} ${customerLastName}`);
        doc.moveDown();

        // Table (simple text-based, no real borders in basic PDFKit; can add rects if needed)
        doc.font('Helvetica-Bold').text('Item Description').moveDown(0.5);
        doc.font('Helvetica').text('Prescription for Spa, Swim Spa, Sauna, Plunge Tub, Lift Recliner Chair, Massage Chair or Mattress.');
        doc.moveDown();
        doc.font('Helvetica-Bold').text(`Amount: ${formattedAmount}`);
        doc.moveDown();
        doc.fontSize(12).text(`Transaction ID: ${transactionId}`);
        doc.moveDown();
        doc.font('Helvetica-Bold').text(`Total: ${formattedAmount}`);
        doc.text('Payment Method: PayPal');
        doc.moveDown(2);
        doc.text('Thank you for your business!');
        doc.font('Helvetica-Oblique').fontSize(10).text('If you have any questions about this receipt, please contact us.');

        // Footer
        doc.fontSize(9).text('HotTubPrescription.com. All rights reserved.', { align: 'center' });

        doc.end();
      } catch (ex) {
        if (ex instanceof SyntaxError) {
          console.error('Error parsing JSON:', ex);
        } else {
          console.error('General error processing PayPal webhook:', ex);
        }
        res.status(200).end();
      }
    });
  } else if (req.method === 'GET') {  // Test Endpoint
    const response = `
Last payment amount received: ${data.lastAmount}
Last invoice ID: ${data.lastInvoiceId}
Last transaction ID: ${data.lastTransactionId}
Customer first name: ${data.lastCustomerFirstName}
Customer last name: ${data.lastCustomerLastName}
Customer email: ${data.lastCustomerEmail}

Last JotForm pretty-printed submission: 
${data.lastJotFormPretty}

Last PayPal raw JSON:
${data.lastPaypalRaw}`;
    res.setHeader('Content-Type', 'text/plain');
    res.send(response);
  } else {
    res.status(405).end();  // Method Not Allowed
  }
};
