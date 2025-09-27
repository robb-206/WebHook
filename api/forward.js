

module.exports = (req, res) => {
  try {
    // Optional: Add logic here, e.g., check req.query or fetch from Azure
    const azureUrl = 'https://htdev-bvhyhpbzgbg3apdh.canadacentral-01.azurewebsites.net/HottubWebhook';  // Or build dynamically
    res.redirect(301, azureUrl);  // 301 permanent; use 302 for temporary
  } catch (error) {
    console.error('Redirect error:', error);  // Log for debugging
    res.status(500).json({ error: 'Internal redirect error' });
  }
};
