import fetch from 'node-fetch';

export default async function handler(req, res) {
  const azureUrl = 'https://htdev-bvhyhpbzgbg3apdh.canadacentral-01.azurewebsites.net/HottubWebhook';

  try {
    console.log('Incoming request:', {
      method: req.method,
      headers: req.headers,
      body: req.body,
      query: req.query
    });

    // If GET request, just return a test response
    if (req.method === 'GET') {
      return res.status(200).send("Function is alive");
    }

    // Forward POST/PUT/etc requests to Azure
    const response = await fetch(azureUrl, {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        // You can forward other headers if needed
      },
      body: JSON.stringify(req.body)
    });

    const text = await response.text();
    res.status(response.status).send(text);

  } catch (err) {
    console.error('Forwarding error:', err);
    res.status(500).send('Error forwarding request: ' + err.message);
  }
}
