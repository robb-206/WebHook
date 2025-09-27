import fetch from 'node-fetch';

export default async function handler(req, res) {
  const azureUrl = 'https://htdev-bvhyhpbzgbg3apdh.canadacentral-01.azurewebsites.net/HottubWebhook';

  console.log('Incoming request:', req.method, req.headers, req.body);

  if (req.method === 'GET') {
    return res.status(200).send("Function is alive");
  }

  if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) {
    return res.status(405).send("Method not allowed");
  }

  try {
    // If body exists, stringify it, otherwise undefined
    let bodyToSend = undefined;
    if (req.body && Object.keys(req.body).length) {
      bodyToSend = JSON.stringify(req.body);
    }

    // Forward request to Azure
    const response = await fetch(azureUrl, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: bodyToSend
    });

    const text = await response.text();
    console.log('Azure response status:', response.status, 'body:', text);

    res.status(response.status).send(text);

  } catch (err) {
    console.error('Forwarding error:', err);
    res.status(500).send('Error forwarding request: ' + err.message);
  }
}
