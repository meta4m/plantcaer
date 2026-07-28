'use server';

import { createClient } from '@/lib/supabase-server';
import { getAuthedUser } from '@/lib/get-user';
import { createAiClient } from '@/lib/ai-client';
import { callWithFallback, resolveAiConfig } from '@/lib/ai-config-resolver';
import type { AiPlantSuggestion } from '@/lib/ai/types';

/**
 * Server action: identify a plant from a photo OR from a text name.
 *
 * Uses the fallback resolver chain:
 * 1. User's saved AI config → 2. Preset default → Graceful error
 *
 * @param imageBase64 - Base64-encoded photo (null for text-only mode)
 * @param mimeType - Image MIME type (null for text-only mode)
 * @param plantName - Plant name for text-only mode (when no vision or no photo)
 * @param nicknameOnly - If true, only generate a nickname suggestion
 */
export async function identifyPlantAction(
  imageBase64: string | null,
  mimeType: string | null,
  plantName?: string,
  nicknameOnly?: boolean,
): Promise<{
  data: AiPlantSuggestion | { nickname: string } | null;
  error: string | null;
  warning?: string;
}> {
  try {
    const supabase = await createClient();
    const user = await getAuthedUser(supabase);
    if (!user) {
      return { data: null, error: 'Not authenticated.' };
    }

    // ─── Nickname-only mode ──────────────────────────────────
    if (nicknameOnly && plantName) {
      const result = await callWithFallback(user.id, async (config) => {
        const client = createAiClient(config);
        const nickname = await client.generateStructuredJson<{ nickname: string }>(
          `You are a creative plant naming assistant. Given a plant's common or scientific name, suggest a single fun, creative nickname that relates to the plant's characteristics. Respond with JSON: {"nickname": "suggestion"}`,
          `Suggest a nickname for a ${plantName} plant. Make it creative and fitting. Examples: For a Snake Plant → "Slytherin", For String of Pearls → "Pearl Jam", For a Fiddle Leaf Fig → "Groovy".`,
        );
        return nickname;
      });

      if (result.error) {
        return { data: null, error: result.error.message, warning: result.warning };
      }

      return { data: result.data!, error: null, warning: result.warning };
    }

    // ─── Full identification mode ────────────────────────────

    // Validate inputs
    const hasPhoto = !!imageBase64 && !!mimeType;

    if (!hasPhoto && !plantName) {
      return { data: null, error: 'Provide either a photo or a plant name.' };
    }

    if (imageBase64 && imageBase64.length < 100) {
      return { data: null, error: 'Image data is too short or empty.' };
    }

    if (mimeType && !mimeType.startsWith('image/')) {
      return { data: null, error: 'Invalid image MIME type.' };
    }

    // Call with fallback
    const result = await callWithFallback(user.id, async (config) => {
      const client = createAiClient(config);

      if (hasPhoto) {
        // Photo mode: identify from image
        return await client.identifyPlant(imageBase64!, mimeType!);
      } else {
        // Text-only mode: identify from name
        return await client.generateStructuredJson<AiPlantSuggestion>(
          `You are a world-class botanist and plant care expert. Given a plant name, provide detailed care information. Always respond with valid JSON matching the requested schema exactly.`,
          `Provide care information for "${plantName}". Return a JSON object with EXACTLY this structure (no markdown, no code fences — just raw JSON):
{
  "common_name": "${plantName}",
  "scientific_name": "string (the scientific/latin name)",
  "light_requirement": "direct_sun" | "bright_indirect" | "low_light" | "shade",
  "min_temp": number (minimum safe temperature in Celsius),
  "max_temp": number (maximum safe temperature in Celsius),
  "humidity_min": number (minimum humidity percentage),
  "notes": "string (general care notes in 2-3 sentences)",
  "care_tasks": [
    {
      "task_type": "watering" | "fertilizing" | "repotting" | "pruning" | "pest_disease" | "propagation",
      "frequency_days": number,
      "amount": "string (e.g. '200ml')",
      "notes": "string"
    }
  ]
}

If you don't know this plant, provide conservative default care. Never leave fields empty.`,
        );
      }
    });

    if (result.error) {
      return { data: null, error: result.error.message, warning: result.warning };
    }

    return { data: result.data!, error: null, warning: result.warning };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown AI error';
    console.error('[identify-plant]', message);
    return { data: null, error: message };
  }
}
