import { getAiConfig, resolveEndpoint, type AiConfig } from './ai-config';
import type { AiPlantSuggestion } from './ai/types';

// ─── Constants ─────────────────────────────────────────────────

const MAX_RETRIES = 2;

// ─── Client interface ───────────────────────────────────────────────

export interface AiClient {
  /**
   * Identify a plant from an image and return structured care suggestions.
   * @param imageBase64 - Base64-encoded image data (without data: URI prefix)
   * @param mimeType - Image MIME type (e.g. "image/jpeg")
   * @returns Structured plant suggestion
   */
  identifyPlant(imageBase64: string, mimeType: string): Promise<AiPlantSuggestion>;

  /**
   * Send a text-only prompt and get a structured JSON response.
   * @param systemPrompt - System-level instructions
   * @param userPrompt - The user's request
   * @returns Parsed JSON response
   */
  generateStructuredJson<T>(systemPrompt: string, userPrompt: string): Promise<T>;
}

// ─── Factory ────────────────────────────────────────────────────────

/**
 * Create an AI client based on the current configuration.
 * The config is loaded from config/ai-config.json + environment variables.
 */
export function createAiClient(config?: AiConfig): AiClient {
  const resolvedConfig = config ?? getAiConfig();

  switch (resolvedConfig.provider) {
    case 'google':
      return createGoogleClient(resolvedConfig);
    case 'groq':
    case 'openai':
      return createOpenAICompatibleClient(resolvedConfig);
    case 'anthropic':
      return createAnthropicClient(resolvedConfig);
    default:
      throw new Error(`Unsupported AI provider: ${resolvedConfig.provider}`);
  }
}

// ─── Google Gemini Client ──────────────────────────────────────────

function createGoogleClient(config: AiConfig): AiClient {
  const endpoint = resolveEndpoint(config.endpoint, config.model);
  const headers = {
    'Content-Type': 'application/json',
    'x-goog-api-key': config.apiKey,
  };

  const systemPrompt = `You are a world-class botanist and plant care expert. Identify plants from photos accurately and provide structured care data. Always respond with valid JSON matching the requested schema exactly.`;

  return {
    async identifyPlant(imageBase64: string, mimeType: string): Promise<AiPlantSuggestion> {
      validateImage(imageBase64, mimeType, config);

      const userPrompt = `Identify this plant from the photo. Return a JSON object with EXACTLY this structure (no markdown, no code fences — just raw JSON):
{
  "common_name": "string",
  "scientific_name": "string",
  "light_requirement": "direct_sun" | "bright_indirect" | "low_light" | "shade",
  "min_temp": number,
  "max_temp": number,
  "humidity_min": number,
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

If you cannot identify the plant, set common_name to "Unknown Plant" and provide conservative default care suggestions. Never leave fields empty.`;

      const body = {
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [{
          parts: [
            { text: userPrompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
          ],
        }],
        generation_config: {
          temperature: 0.2,
          max_output_tokens: 2048,
          response_mime_type: 'application/json',
        },
      };

      const response = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error('Gemini API returned an empty response');
      }

      return parseAiResponse(text);
    },

    async generateStructuredJson<T>(systemPromptInput: string, userPrompt: string): Promise<T> {
      const body = {
        system_instruction: {
          parts: [{ text: systemPromptInput }],
        },
        contents: [{
          parts: [{ text: userPrompt }],
        }],
        generation_config: {
          temperature: 0.2,
          max_output_tokens: 2048,
          response_mime_type: 'application/json',
        },
      };

      const response = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error('Gemini API returned an empty response');
      }

      return parseJsonResponse<T>(text);
    },
  };
}

// ─── OpenAI-Compatible Client (Groq, OpenAI, etc.) ─────────────────

function createOpenAICompatibleClient(config: AiConfig): AiClient {
  const endpoint = resolveEndpoint(config.endpoint, config.model);

  return {
    async identifyPlant(imageBase64: string, mimeType: string): Promise<AiPlantSuggestion> {
      validateImage(imageBase64, mimeType, config);

      const systemPrompt = `You are a plant identification expert. Identify plants from photos and return structured care data. Always respond with valid JSON.`;

      const userPrompt = `Identify this plant from the photo. Return a JSON object with EXACTLY this structure (no markdown, no code fences — just raw JSON):
{
  "common_name": "string",
  "scientific_name": "string",
  "light_requirement": "direct_sun" | "bright_indirect" | "low_light" | "shade",
  "min_temp": number,
  "max_temp": number,
  "humidity_min": number,
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

If you cannot identify the plant, set common_name to "Unknown" and provide conservative default care suggestions. Never leave fields empty.`;

      const body: Record<string, unknown> = {
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        temperature: 0.2,
        max_tokens: 2048,
      };

      // Try with json_object response format first; fall back if model doesn't support it
      const data = await openAiCallWithFormatFallback(
        endpoint, config.apiKey, body
      );

      const text = data?.choices?.[0]?.message?.content;

      if (!text) {
        throw new Error(`${config.provider} API returned an empty response`);
      }

      return parseAiResponse(text);
    },

    async generateStructuredJson<T>(systemPrompt: string, userPrompt: string): Promise<T> {
      const body: Record<string, unknown> = {
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 2048,
      };

      const data = await openAiCallWithFormatFallback(
        endpoint, config.apiKey, body
      );

      const text = data?.choices?.[0]?.message?.content;

      if (!text) {
        throw new Error(`${config.provider} API returned an empty response`);
      }

      return parseJsonResponse<T>(text);
    },
  };
}

// ─── Anthropic Claude Client ───────────────────────────────────────

function createAnthropicClient(config: AiConfig): AiClient {
  return {
    async identifyPlant(imageBase64: string, mimeType: string): Promise<AiPlantSuggestion> {
      const endpoint = resolveEndpoint(config.endpoint, config.model);
      validateImage(imageBase64, mimeType, config);

      const systemPrompt = `You are a plant identification expert. Identify plants from photos and return structured care data. Always respond with valid JSON.`;

      const userPrompt = `Identify this plant from the photo. Return a JSON object with EXACTLY this structure (no markdown, no code fences — just raw JSON):
{
  "common_name": "string",
  "scientific_name": "string",
  "light_requirement": "direct_sun" | "bright_indirect" | "low_light" | "shade",
  "min_temp": number,
  "max_temp": number,
  "humidity_min": number,
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

If you cannot identify the plant, set common_name to "Unknown" and provide conservative default care suggestions. Never leave fields empty.`;

      const body = {
        model: config.model,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: imageBase64,
                },
              },
              { type: 'text', text: userPrompt },
            ],
          },
        ],
        max_tokens: 2048,
        temperature: 0.2,
      };

      const response = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      const text = data?.content?.[0]?.text;

      if (!text) {
        throw new Error('Anthropic API returned an empty response');
      }

      return parseAiResponse(text);
    },

    async generateStructuredJson<T>(systemPrompt: string, userPrompt: string): Promise<T> {
      const endpoint = resolveEndpoint(config.endpoint, config.model);

      const body = {
        model: config.model,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 2048,
        temperature: 0.2,
      };

      const response = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      const text = data?.content?.[0]?.text;

      if (!text) {
        throw new Error('Anthropic API returned an empty response');
      }

      return parseJsonResponse<T>(text);
    },
  };
}

// ─── Response parsing ──────────────────────────────────────────────

/**
 * Parse AI response text into structured JSON.
 * Handles markdown code fences, extraneous text, and malformed JSON.
 */
function parseJsonResponse<T>(text: string): T {
  const cleaned = text
    .replace(/^```(?:json)?\s*/gm, '')
    .replace(/\s*```$/gm, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to find JSON object in the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as T;
      } catch {
        // Fall through to error
      }
    }
    throw new Error(`Failed to parse AI response as JSON. Raw response (first 500 chars):\n${text.slice(0, 500)}`);
  }
}

/**
 * Parse AI response text into an AiPlantSuggestion.
 */
function parseAiResponse(text: string): AiPlantSuggestion {
  return parseJsonResponse<AiPlantSuggestion>(text);
}

// ─── Image validation ────────────────────────────────────────────────

/**
 * Validate an image before sending to the AI provider.
 * @throws Error if the image exceeds the configured size limit.
 */
function validateImage(imageBase64: string, mimeType: string, config: AiConfig): void {
  // Check MIME type
  if (!config.supportedFormats.includes(mimeType)) {
    throw new Error(
      `Unsupported image format "${mimeType}". Supported: ${config.supportedFormats.join(', ')}`
    );
  }

  // Check file size (base64 is ~37% larger than binary)
  const sizeInBytes = Math.ceil((imageBase64.length * 3) / 4);
  const maxBytes = config.maxImageSizeMB * 1024 * 1024;

  if (sizeInBytes > maxBytes) {
    throw new Error(
      `Image too large (${(sizeInBytes / (1024 * 1024)).toFixed(1)}MB). ` +
      `Maximum allowed: ${config.maxImageSizeMB}MB.`
    );
  }
}

// ─── HTTP helpers ──────────────────────────────────────────────────

/**
 * Fetch with automatic retry on transient failures (network errors, 5xx).
 * Does NOT retry on 4xx errors (client errors).
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Don't retry on 4xx errors (bad request, auth failure, etc.)
      if (!response.ok && response.status >= 400 && response.status < 500) {
        const errorBody = await response.text().catch(() => 'No error body');
        throw new Error(`API error (${response.status}): ${errorBody}`);
      }

      // Retry on 5xx errors
      if (!response.ok && attempt < retries) {
        lastError = new Error(`Server error (${response.status}), retrying...`);
        await sleep(Math.pow(2, attempt) * 500); // exponential backoff: 500ms, 1s, 2s
        continue;
      }

      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry if it's a client error with status
      if (err instanceof Error && err.message.startsWith('API error (4')) {
        throw err;
      }

      if (attempt < retries) {
        await sleep(Math.pow(2, attempt) * 500);
      }
    }
  }

  throw lastError ?? new Error('Request failed after retries');
}

/**
 * Make an API call to an OpenAI-compatible endpoint.
 * Returns the Response object for the caller to parse.
 */
async function callOpenAICompatible(
  endpoint: string,
  apiKey: string,
  body: Record<string, unknown>
): Promise<Response> {
  return fetchWithRetry(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
}

/**
 * Make an OpenAI-compatible API call with format fallback.
 * Tries with response_format: json_object first; falls back without it if the model
 * doesn't support structured response format.
 */
async function openAiCallWithFormatFallback(
  endpoint: string,
  apiKey: string,
  body: Record<string, unknown>
): Promise<any> {
  // First attempt: with json_object response format
  try {
    const response = await callOpenAICompatible(endpoint, apiKey, {
      ...body,
      response_format: { type: 'json_object' },
    });
    return await response.json();
  } catch (err) {
    // If it's a 400 error, the model likely doesn't support structured format — retry without it
    if (err instanceof Error && err.message.includes('API error (4')) {
      const fallbackResponse = await callOpenAICompatible(endpoint, apiKey, body);
      return await fallbackResponse.json();
    }
    throw err;
  }
}

/** Sleep for a given number of milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
