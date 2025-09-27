import fetch from 'node-fetch';

export default async function handler(req, res) {
  const azureUrl = 'https://htdev-bvhyhpbzgbg3apdh.canadacentral-01.azurewebsites.net/HottubWebhook';

  console.log('Incoming request:', {
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: req.query
  });

  if (req.method === 'GET') {
    return res.status(200).send("Function is alive");
  }

  try {
    const body = req.body && Object.keys(req.body).length ? JSON.stringify(req.body) : undefined;

    const response = await fetch(azureUrl, {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
      },
      body: body,
    });

    const text = await response.text();
    res.status(response.status).send(text);
  } catch (err) {
    console.error('Forwarding error:', err);
    res.status(500).send('Error forwarding request: ' + err.message);
  }
}

