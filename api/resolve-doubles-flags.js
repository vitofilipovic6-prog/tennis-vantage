// ─────────────────────────────────────────────────────────────────────────────
// api/resolve-doubles-flags.js
//
// PURPOSE:
//   Resolves missing country codes for doubles players (names like "A. Smith / B. Jones")
//   using Gemini, then permanently saves them to the Supabase `players` table.
//   Called automatically on app load — no user interaction needed.
//
// FLOW:
//   1. Receives an array of doubles players with missing/blank countries
//   2. Batches them into groups and asks Gemini for the nationality of each half
//   3. Saves resolved country codes back to Supabase (permanent, one-time per player)
//   4. Returns the resolved flag map so the frontend can update immediately
//      without waiting for a DB re-fetch
//
// SECURITY: Uses SUPABASE_SERVICE_ROLE_KEY (server-side only, never exposed to client)
// ─────────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const GEMINI_MODEL          = 'gemini-2.5-flash';
const GEMINI_MODEL_FALLBACK = 'gemini-2.0-flash';

// ── Supabase admin client (server-side only) ──────────────────────────────────
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Gemini call helper ────────────────────────────────────────────────────────
async function callGemini(apiKey, model, prompt) {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text: `You are a professional tennis database with encyclopedic knowledge of every ATP and WTA doubles player and their nationality.
Your job is to identify the 3-letter ATP/WTA country code for tennis players given their names.
Use standard ATP/WTA codes: ESP, USA, GBR, ARG, ITA, FRA, AUS, GER, SUI, SRB, CZE, POL, ROU, CRO, BLR, KAZ, RUS, UKR, etc.
Respond ONLY with valid JSON. No markdown, no backticks, no preamble, no explanation.`,
          }],
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          topP: 0.8,
        },
      }),
    }
  );
}

// ── Build Gemini prompt for a batch of doubles players ────────────────────────
function buildPrompt(players) {
  const lines = players.map((p, i) => {
    const halves = p.name.split('/').map(n => n.trim());
    return `${i}: Player1="${halves[0]}", Player2="${halves[1]}"`;
  }).join('\n');

  return `For each doubles tennis pair below, provide the 3-letter ATP/WTA country code for EACH individual player.
Use standard codes (ESP, USA, GBR, ARG, ITA, FRA, AUS, GER, SUI, SRB, etc.).
If you genuinely don't know a player, use "UNK".

Pairs:
${lines}

Respond ONLY with this exact JSON structure:
{
  "results": [
    { "index": 0, "p1_country": "ESP", "p2_country": "ARG" },
    { "index": 1, "p1_country": "ITA", "p2_country": "FRA" }
  ]
}`;
}

// ── Parse Gemini JSON response safely ─────────────────────────────────────────
function parseGeminiResponse(text) {
  if (!text?.trim()) throw new Error('Empty response from Gemini');

  // Try direct parse
  try { return JSON.parse(text.trim()); } catch {}

  // Strip markdown fences
  const stripped = text
    .replace(/^```json\s*/im, '')
    .replace(/^```\s*/im, '')
    .replace(/```\s*$/im, '')
    .trim();
  try { return JSON.parse(stripped); } catch {}

  // Find JSON object
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }

  throw new Error('Could not parse JSON from Gemini response');
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return res.status(503).json({ error: 'AI service not configured' });

  const { players } = req.body ?? {};
  if (!Array.isArray(players) || players.length === 0) {
    return res.status(400).json({ error: 'players array is required', resolved: {} });
  }

  // Validate — must be doubles players (name contains '/')
  const doublesPlayers = players.filter(p =>
    p?.id && p?.name && p.name.includes('/')
  );

  if (doublesPlayers.length === 0) {
    return res.status(200).json({ resolved: {}, message: 'No doubles players to resolve' });
  }

  console.log(`[resolve-doubles-flags] Resolving ${doublesPlayers.length} players`);

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error('[resolve-doubles-flags] Supabase init failed:', e.message);
    return res.status(503).json({ error: 'Database not configured', resolved: {} });
  }

  const resolved = {}; // { playerId: { country: "ESP/ARG", p1_country: "ESP", p2_country: "ARG" } }
  const BATCH_SIZE = 15; // Keep batches small for token efficiency

  // Process in batches
  for (let batchStart = 0; batchStart < doublesPlayers.length; batchStart += BATCH_SIZE) {
    const batch = doublesPlayers.slice(batchStart, batchStart + BATCH_SIZE);

    try {
      const prompt = buildPrompt(batch);

      let geminiRes = await callGemini(geminiKey, GEMINI_MODEL, prompt);

      // Fallback on quota exceeded
      if (geminiRes.status === 429) {
        console.warn('[resolve-doubles-flags] Primary model quota exceeded, using fallback');
        geminiRes = await callGemini(geminiKey, GEMINI_MODEL_FALLBACK, prompt);
      }

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        console.error(`[resolve-doubles-flags] Gemini error ${geminiRes.status}:`, errText.slice(0, 200));
        continue; // Skip this batch, don't fail the whole request
      }

      const geminiData = await geminiRes.json();
      const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      const parsed = parseGeminiResponse(rawText);

      if (!Array.isArray(parsed?.results)) {
        console.warn('[resolve-doubles-flags] Unexpected Gemini format:', rawText.slice(0, 200));
        continue;
      }

      // Process results for this batch
      const dbUpdates = [];

      for (const result of parsed.results) {
        const player = batch[result.index];
        if (!player) continue;

        const p1Country = result.p1_country ?? 'UNK';
        const p2Country = result.p2_country ?? 'UNK';

        // Only use non-UNK values
        if (p1Country === 'UNK' && p2Country === 'UNK') continue;

        const c1 = p1Country !== 'UNK' ? p1Country : '';
        const c2 = p2Country !== 'UNK' ? p2Country : '';
        const countryStr = c1 && c2 ? `${c1}/${c2}`
          : c1 ? `${c1}/${c1}`
          : c2 ? `${c2}/${c2}`
          : '';

        if (!countryStr) continue;

        resolved[player.id] = {
          country:    countryStr,
          p1_country: p1Country,
          p2_country: p2Country,
        };

        dbUpdates.push({
          id:                 player.id,
          country:            countryStr,
          flag_resolved_at:   new Date().toISOString(),
        });
      }

      // Save to Supabase in one upsert per batch
      if (dbUpdates.length > 0) {
        const { error: upsertError } = await supabase
          .from('players')
          .upsert(dbUpdates, { onConflict: 'id', ignoreDuplicates: false });

        if (upsertError) {
          console.error('[resolve-doubles-flags] DB upsert error:', upsertError.message);
          // Don't fail — we still return the resolved map to the frontend
        } else {
          console.log(`[resolve-doubles-flags] ✓ Saved ${dbUpdates.length} resolved flags to DB`);
        }
      }

    } catch (batchError) {
      console.error(`[resolve-doubles-flags] Batch ${batchStart} error:`, batchError.message);
      // Continue with next batch
    }
  }

  console.log(`[resolve-doubles-flags] Done. Resolved: ${Object.keys(resolved).length}/${doublesPlayers.length}`);

  return res.status(200).json({
    resolved,
    count: Object.keys(resolved).length,
    total: doublesPlayers.length,
  });
};