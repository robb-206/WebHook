import fetch from 'node-fetch';

export default async function handler(req, res) {
  const azureUrl = 'https://htdev-bvhyhpbzgbg3apdh.canadacentral-01.azurewebsites.net/HottubWebhook';

  console.log('Incoming request:', {
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: req.query
  });

  // Always respond 200 for GET (browser test)
  if (req.method === 'GET') {
    return res.status(200).send("Function is alive");
  }

  // Only forward POST/PUT/PATCH/DELETE
  if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) {
    return res.status(405).send("Method not allowed");
  }

  try {
    // Prepare body safely
    const bodyToSend = req.body && Object.keys(req.body).length ? JSON.stringify(req.body) : undefined;

    const response = await fetch(azureUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: bodyToSend
    });

    const text = await response.text();
    console.log('Azure response:', response.status, text);

    res.status(response.status).send(text);

  } catch (err) {
    console.error('Forwarding error:', err);
    res.status(500).send('Error forwarding request: ' + err.message);
  }
}
