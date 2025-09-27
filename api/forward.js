import fetch from 'node-fetch';

export default async function handler(req, res) {
  const azureUrl = 'https://<https://htdev-bvhyhpbzgbg3apdh.canadacentral-01.azurewebsites.net/HottubWebhook>';

  try {
    const response = await fetch(azureUrl, {
      method: req.method,
      headers: req.headers,
      body: req.body,
    });

    const text = await response.text();
    res.status(response.status).send(text);
  } catch (err) {
    res.status(500).send('Error forwarding request: ' + err.message);
  }
}
