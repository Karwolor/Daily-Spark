const functions = require('firebase-functions');
// Using global fetch (Node 18+) to call external Hugging Face API

// HTTP function to proxy requests to Hugging Face Inference API.
// Usage: POST { model: 'gpt2', payload: {...} }
// Configure your HF token with: `firebase functions:config:set huggingface.token="hf_xxx"`

exports.hfProxy = functions.https.onRequest(async (req, res) => {
  // Basic CORS handling
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).send('');

  try {
    if (req.method !== 'POST') return res.status(405).send({ error: 'Use POST' });
    const { model, payload } = req.body || {};
    if (!model || !payload) return res.status(400).send({ error: 'Missing model or payload' });

    const token = functions.config().huggingface?.token || process.env.HF_TOKEN;
    if (!token) return res.status(401).send({ error: 'HF token not configured in functions config' });

    const url = `https://router.huggingface.co/hf-inference/models/${encodeURIComponent(model)}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // keep timeout reasonable
    });

    const text = await r.text();
    // Pass through status and body
    res.status(r.status).set('Content-Type', r.headers.get('content-type') || 'application/json').send(text);
  } catch (e) {
    console.error('hfProxy error', e);
    res.status(500).send({ error: e.message || 'Unknown error' });
  }
});