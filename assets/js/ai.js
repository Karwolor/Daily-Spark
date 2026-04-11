// Hugging Face Inference API stubs
// Set HUGGING_FACE_TOKEN in your browser local storage: localStorage.setItem('HF_TOKEN','hf_...')

// Use the new Router endpoint with fallback to legacy API if needed
window.HF_BASES = window.HF_BASES || [
    'https://router.huggingface.co/hf-inference/models',
    'https://api-inference.huggingface.co/models'
];
function hfHeaders() {
    const token = localStorage.getItem('HF_TOKEN') || '';
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function hfPost(model, payload, { retries = 3 } = {}) {
    // First try a local proxy (useful when deployed with Firebase Functions and Hosting rewrite)
    const proxyUrl = localStorage.getItem('HF_PROXY') || window.HF_PROXY_URL || '/api/hf';
    if (proxyUrl) {
        try {
            const pRes = await fetch(proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, payload })
            });
            if (pRes.ok) return pRes.json();
            // if proxy returns unauthorized or error, fall through to direct attempt
        } catch (e) {
            // proxy failed (network or not found) - fall back to direct HF
            console.warn('HF proxy failed, falling back to direct HF:', e?.message || e);
        }
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
        let lastErr;
        for (const BASE of HF_BASES) {
            const res = await fetch(`${BASE}/${model}`, { method: 'POST', headers: hfHeaders(), body: JSON.stringify(payload) });
            if (res.status === 401 || res.status === 403) {
                lastErr = new Error('Hugging Face auth failed (401/403). Set a valid token in localStorage: HF_TOKEN');
                continue; // try next BASE
            }
            if (res.status === 429) {
                throw new Error('Hugging Face rate limited (429). Please try again shortly.');
            }
            if (res.status === 503) {
                // Model cold start: wait and retry
                try {
                    const info = await res.json();
                    const waitMs = Math.min(4000, Math.ceil((info.estimated_time || 1) * 1000));
                    if (attempt < retries) {
                        await new Promise(r => setTimeout(r, waitMs));
                        continue; // retry same BASE
                    }
                } catch {/* ignore */ }
                throw new Error('Model is loading (503). Please retry in a moment.');
            }
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                lastErr = new Error(`Hugging Face error ${res.status}: ${text}`);
                continue; // try next BASE
            }
            return res.json();
        }
        if (lastErr) {
            // If we tried all BASES and still have an error, throw it or retry if 503 logic handled above
            if (attempt < retries) continue;
            throw lastErr;
        }
    }
}

async function analyzeSentiment(text) {
    try {
        const model = 'distilbert-base-uncased-finetuned-sst-2-english';
        const j = await hfPost(model, { inputs: text });
        const top = Array.isArray(j) ? j[0][0] : { label: 'neutral', score: 0 };
        return { label: top.label || 'neutral', score: Number(top.score || 0).toFixed(2) };
    } catch (e) {
        console.warn('HF sentiment fallback:', e?.message || e);
        // Fallback: simple keyword-based sentiment
        const positive = /\b(happy|good|great|awesome|love|excited|joy|positive|amazing|wonderful|fantastic)\b/i;
        const negative = /\b(sad|bad|terrible|angry|hate|upset|negative|awful|horrible|disappointed)\b/i;
        if (positive.test(text)) return { label: 'positive', score: '0.80' };
        if (negative.test(text)) return { label: 'negative', score: '0.70' };
        return { label: 'neutral', score: '0.50' };
    }
}

async function summarizeText(text) {
    try {
        const model = 'facebook/bart-large-cnn';
        const j = await hfPost(model, { inputs: text.slice(0, 3000) });
        const sum = Array.isArray(j) && j[0]?.summary_text ? j[0].summary_text : 'Summary unavailable.';
        return sum;
    } catch (e) {
        console.warn('HF summarize fallback:', e?.message || e);
        // Fallback: simple summary
        const words = text.split(' ').slice(0, 50).join(' ');
        return `Summary: ${words}...`;
    }
}

async function generateChallenge() {
    // Lightweight heuristic + optional GPT2-small continuation API
    const seed = [
        'Drink a full glass of water now',
        'Do 10 calf raises while standing',
        'Write one thing you are grateful for',
        'Stretch your neck for 60 seconds',
        'Take 10 deep breaths',
        'Compliment someone today',
    ];
    // Try HF text-generation (optional)
    try {
        const model = 'gpt2';
        const prompt = 'Give one short, practical, 1-minute habit challenge:';
        const j = await hfPost(model, { inputs: prompt, parameters: { max_new_tokens: 24, temperature: 0.8 } });
        const txt = j?.[0]?.generated_text?.split(':').pop()?.trim();
        return (txt && txt.length < 100) ? txt : seed[Math.floor(Math.random() * seed.length)];
    } catch (e) {
        console.warn('HF generation fallback:', e?.message || e);
        return seed[Math.floor(Math.random() * seed.length)];
    }
}
