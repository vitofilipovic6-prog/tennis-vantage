// ─────────────────────────────────────────────────────────────────────────────
// api/player-bio.js
// Dedicated endpoint for player bio/stats generation.
// Uses gemini-2.5-pro for higher quality structured data.
// Separate from /api/chat so it has its own quota + system prompt.
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_MODEL          = 'gemini-2.5-pro';
const GEMINI_MODEL_FALLBACK = 'gemini-2.5-flash';

async function callGemini(apiKey, model, prompt) {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text: 'You are a professional tennis statistics database with encyclopedic knowledge of ATP and WTA players. Always respond with valid JSON only. No markdown fences. No explanations. No extra text. Just the raw JSON object.',
          }],
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature:      0.3,  // low temp = more factual, less hallucination
          maxOutputTokens:  2048,
          topP:             0.8,
          responseMimeType: 'application/json',
        },
      }),
    }
  );
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI service not configured' });

  const { player } = req.body ?? {};
  if (!player?.name) return res.status(400).json({ error: 'player.name is required' });

  const prompt = `Generate comprehensive stats and analysis for this tennis player.

Player: ${player.name}
Country: ${player.country ?? 'Unknown'}
Current Rank: ${player.rank && player.rank < 999 ? `#${player.rank}` : 'Unknown'}
Surface preference: ${player.surface_pref ?? 'Unknown'}

Return this exact JSON structure (use real accurate data, null only if truly unknown):
{
  "full_name": "full official name",
  "turned_pro": "year as string e.g. '2015'",
  "plays": "Right-handed or Left-handed",
  "height": "e.g. 185 cm / 6'1\\"",
  "coach": "current coach name or null",
  "career_titles": number,
  "peak_rank": number,
  "career_win_pct": number between 0 and 100,
  "grand_slams": {
    "total_titles": number,
    "australian_open": number,
    "french_open": number,
    "wimbledon": number,
    "us_open": number
  },
  "current_season": {
    "wins": number,
    "losses": number,
    "titles": number,
    "form": "last 5 results e.g. W W L W W"
  },
  "surface_stats": {
    "clay":  { "win_pct": number, "titles": number },
    "hard":  { "win_pct": number, "titles": number },
    "grass": { "win_pct": number, "titles": number }
  },
  "playing_style": "2-3 sentence description of playing style and game patterns",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "best_rivals": [
    { "name": "rival name", "h2h": "e.g. 14-12 in favor of ${player.name}" }
  ],
  "career_highlight": "single most impressive career achievement in one sentence"
}`;

  try {
    let geminiRes = await callGemini(apiKey, GEMINI_MODEL, prompt);

    // Fallback if primary model quota exceeded
    if (geminiRes.status === 429) {
      console.warn('[/api/player-bio] pro quota exceeded — trying flash fallback');
      geminiRes = await callGemini(apiKey, GEMINI_MODEL_FALLBACK, prompt);
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[/api/player-bio] Gemini error:', geminiRes.status, errText);
      return res.status(502).json({ error: 'Gemini API error', status: geminiRes.status });
    }

    const geminiData = await geminiRes.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!text) {
      return res.status(502).json({ error: 'Empty response from Gemini' });
    }

    // Clean and parse JSON
    const clean = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json({ data: parsed });

  } catch (err) {
    console.error('[/api/player-bio] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};