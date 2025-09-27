// api/webhook.js
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  try {
    const azureUrl = 'https://htdev-bvhyhpbzgbg3apdh.canadacentral-01.azurewebsites.net/HottubWebhook';

    // Forward original request to Azure
    const response = await fetch(azureUrl, {
      method: req.method,
      headers: { ...req.headers, host: undefined }, // drop host header
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    // Pass through status and headers
    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Send back response body
    const text = await response.text();
    res.send(text);

  } catch (error) {
    console.error('Forwarding error:', error);
    res.status(500).json({ error: 'Failed to forward request' });
  }
};
