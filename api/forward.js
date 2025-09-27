export default function handler(req, res) {
  console.log('Incoming request:', {
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: req.query
  });

  res.status(200).send("Function is alive");
}

