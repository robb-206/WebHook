export default async function handler(req, res) {
  if (req.method === 'POST') {
    console.log('===== PayPal Webhook Received =====');
    console.log('Raw Body:', req.body);

    try {
      const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (event.event_type) {
        console.log('Event Type:', event.event_type);
      }
    } catch (err) {
      console.log('Failed to parse JSON:', err);
    }

    // Always respond 200 OK
    return res.status(200).json({ status: 'received' });
  }

  // For GET or other methods
  return res.status(200).json({ status: 'alive' });
}

