// api/predict.js  ← PROJECT ROOT
const GEMINI_MODEL          = 'gemini-2.5-flash';

const PREDICTION_SYSTEM_PROMPT = `You are an elite tennis prediction AI with encyclopedic knowledge of every ATP, WTA, ITF, and Challenger circuit player.

RULES:
- Respond ONLY with valid JSON. No markdown. No backticks. No preamble.
- Be specific with percentages: 63%, 71%, 38% — NOT round 50% unless genuinely a coin-flip.
- key_factors: EXACTLY 5 to 7 items. Each must be a specific factual sentence, not generic filler.
- ai_analysis: 3–4 sentences minimum. Cite real stats, match results, and give a direct verdict.
- Never say "Player A is a strong competitor" or "Both players are capable".
- Always name actual tournaments, opponents, and scores from your training knowledge.`;

async function callGemini(apiKey, model, systemInstruction, userPrompt) {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature:     0.4,
          maxOutputTokens: 2500,
          topP:            0.85,
        },
      }),
    }
  );
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI service is not configured' });

  const { prompt } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt string is required' });
  }

  try {
    let geminiRes = await callGemini(apiKey, GEMINI_MODEL, PREDICTION_SYSTEM_PROMPT, prompt);

    if (geminiRes.status === 429) {
      console.warn('[/api/predict] quota exceeded — trying fallback');
      geminiRes = await callGemini(apiKey, GEMINI_MODEL_FALLBACK, PREDICTION_SYSTEM_PROMPT, prompt);
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[/api/predict] Gemini error:', geminiRes.status, errText);
      if (geminiRes.status === 429) {
        return res.status(429).json({ error: 'rate_limit', message: 'AI is busy. Please wait 30 seconds and try again.' });
      }
      return res.status(502).json({ error: 'Gemini API error', detail: geminiRes.status });
    }

    const geminiData = await geminiRes.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('[/api/predict] Empty response:', JSON.stringify(geminiData));
      return res.status(502).json({ error: 'Empty response from Gemini' });
    }

    const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();

    try { JSON.parse(cleaned); } catch {
      console.error('[/api/predict] Non-JSON response:', text.slice(0, 300));
      return res.status(502).json({ error: 'Gemini returned non-JSON' });
    }

    return res.status(200).json({ content: [{ text: cleaned }] });

  } catch (err) {
    console.error('[/api/predict] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};