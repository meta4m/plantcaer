'use server';

import { createAiClient } from '@/lib/ai-client';
import { getAiConfig } from '@/lib/ai-config';
import type { AiPlantSuggestion } from '@/lib/ai/types';

/**
 * Server action: identify a plant from a base64-encoded photo.
 * Calls the configured AI provider (Gemini, Groq, OpenAI, or Anthropic).
 */
export async function identifyPlantAction(
  imageBase64: string,
  mimeType: string
): Promise<{
  data: AiPlantSuggestion | null;
  error: string | null;
}> {
  try {
    // Basic validation
    if (!imageBase64 || imageBase64.length < 100) {
      return { data: null, error: 'Image data is too short or empty.' };
    }

    if (!mimeType || !mimeType.startsWith('image/')) {
      return { data: null, error: 'Invalid image MIME type.' };
    }

    // Validate config before making the call
    let config;
    try {
      config = getAiConfig();
    } catch (configErr) {
      return {
        data: null,
        error: `AI configuration error: ${configErr instanceof Error ? configErr.message : 'Missing API key or config'}`,
      };
    }

    const client = createAiClient(config);
    const suggestion = await client.identifyPlant(imageBase64, mimeType);

    return { data: suggestion, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown AI error';
    console.error('[identify-plant]', message);
    return { data: null, error: message };
  }
}
