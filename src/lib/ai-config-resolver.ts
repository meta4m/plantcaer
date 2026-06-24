/**
 * AI Configuration Resolver
 *
 * Resolves the effective AI configuration for a user with fallback:
 * 1. User's saved configuration (encrypted API key in DB)
 * 2. Preset default (environment variables)
 *
 * Also provides callWithFallback() that attempts user config first,
 * then falls back to preset default on transient errors.
 */

import 'server-only';
import { createAdminClient } from './supabase-admin';
import { getAiConfig, type AiConfig } from './ai-config';
import { createAiClient } from './ai-client';
import { decryptApiKey } from './api-key-crypto';
import type { AiPlantSuggestion } from './ai/types';

// ─── Error classification ──────────────────────────────────────

export class UserFacingError extends Error {
  constructor(
    message: string,
    public readonly kind: 'rate_limited' | 'invalid_key' | 'timeout' | 'vision_unsupported' | 'unavailable' | 'config_error',
  ) {
    super(message);
    this.name = 'UserFacingError';
  }
}

/**
 * Classify an error to determine if it's transient (should fallback) or permanent.
 */
function classifyError(err: unknown): UserFacingError {
  const message = err instanceof Error ? err.message : String(err);

  // Rate limiting
  if (message.includes('429') || message.includes('rate') || message.includes('quota') || message.includes('RESOURCE_EXHAUSTED')) {
    return new UserFacingError(
      'Your AI provider is rate-limited. Falling back to the default provider.',
      'rate_limited',
    );
  }

  // Timeout
  if (message.includes('timeout') || message.includes('timed out') || message.includes('ETIMEDOUT') || message.includes('504') || message.includes('503')) {
    return new UserFacingError(
      'Your AI provider timed out. Falling back to the default provider.',
      'timeout',
    );
  }

  // Invalid key / auth
  if (message.includes('401') || message.includes('unauthorized') || message.includes('unauthorized') || message.includes('API key') || message.includes('403')) {
    return new UserFacingError(
      'Your API key appears to be invalid. Please check your AI settings and update the key.',
      'invalid_key',
    );
  }

  // Vision unsupported
  if (message.includes('vision') || message.includes('image') || message.includes('multimodal')) {
    return new UserFacingError(
      'Your AI model does not support image identification. You can still enter the plant name manually for AI suggestions.',
      'vision_unsupported',
    );
  }

  // Default: unclassified error
  return new UserFacingError(
    `AI service error: ${message}`,
    'unavailable',
  );
}

function isTransientError(err: UserFacingError): boolean {
  return err.kind === 'rate_limited' || err.kind === 'timeout';
}

// ─── Resolve config ──────────────────────────────────────────

export interface StoredUserConfig {
  id: string;
  provider: string;
  model: string;
  base_url: string | null;
  encrypted_api_key: string;
}

/**
 * Fetch a user's saved AI config from the database.
 * Returns null if no config is saved.
 */
async function getUserAiConfig(userId: string): Promise<AiConfig | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('user_ai_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;

  try {
    const apiKey = decryptApiKey(data.encrypted_api_key);

    // Use the existing AiConfig type
    const presetDefaults = getAiConfig(); // get defaults for endpoint templates etc.

    return {
      provider: data.provider as AiConfig['provider'],
      model: data.model,
      apiKey,
      baseUrl: data.base_url || undefined,
      endpoint: data.base_url || presetDefaults.endpoint,
      maxImageSizeMB: presetDefaults.maxImageSizeMB,
      supportedFormats: presetDefaults.supportedFormats,
      compressToMaxWidth: presetDefaults.compressToMaxWidth,
    };
  } catch (decryptErr) {
    console.error('[ai-config-resolver] Failed to decrypt user API key:', decryptErr);
    return null;
  }
}

/**
 * Resolve the effective AI config for a user.
 * Returns user config if saved, otherwise the preset default.
 */
export async function resolveAiConfig(userId: string): Promise<AiConfig> {
  const userConfig = await getUserAiConfig(userId);
  return userConfig ?? getAiConfig();
}

/**
 * Get the status of a user's AI config (without exposing the key).
 */
export async function getAiConfigStatus(userId: string): Promise<{
  configured: boolean;
  provider: string;
  model: string;
  hasBaseUrl: boolean;
}> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('user_ai_configs')
    .select('provider, model, base_url')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (data) {
    return {
      configured: true,
      provider: data.provider,
      model: data.model,
      hasBaseUrl: !!data.base_url,
    };
  }

  // Fall back to preset default info
  const preset = getAiConfig();
  return {
    configured: false,
    provider: preset.provider,
    model: preset.model,
    hasBaseUrl: !!preset.baseUrl,
  };
}

// ─── Test connection ──────────────────────────────────────────

export interface TestConnectionResult {
  success: boolean;
  hasVision: boolean;
  error: string | null;
  provider: string;
  model: string;
}

/**
 * Test an AI provider connection.
 * Step 1: Send a simple text prompt to verify the key works.
 * Step 2: If text works, attempt a vision test to check image capability.
 */
export async function testAiConnection(config: AiConfig): Promise<TestConnectionResult> {
  try {
    const client = createAiClient(config);

    // Step 1: Text-only test
    try {
      await client.generateStructuredJson<{ ok: boolean }>(
        'You are a test assistant. Always respond with valid JSON.',
        'Respond with {"ok": true} to confirm you are working.',
      );
    } catch {
      return {
        success: false,
        hasVision: false,
        error: 'Text generation failed. Check your API key and model name.',
        provider: config.provider,
        model: config.model,
      };
    }

    // Step 2: Vision test — try with a minimal 1x1 pixel PNG
    // This is a valid base64-encoded 1x1 white PNG pixel
    const minimalPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    try {
      await client.identifyPlant(minimalPngBase64, 'image/png');
      return {
        success: true,
        hasVision: true,
        error: null,
        provider: config.provider,
        model: config.model,
      };
    } catch {
      return {
        success: true,
        hasVision: false,
        error: null,
        provider: config.provider,
        model: config.model,
      };
    }
  } catch (err) {
    return {
      success: false,
      hasVision: false,
      error: err instanceof Error ? err.message : 'Unknown error during test',
      provider: config.provider,
      model: config.model,
    };
  }
}

// ─── Call with fallback ──────────────────────────────────────

export type FallbackResult<T> = {
  data: T;
  source: 'user' | 'default';
  warning?: string;
};

/**
 * Call an AI function with automatic fallback.
 *
 * 1. Tries user's saved config
 * 2. On transient errors (429, timeout), falls back to preset default
 * 3. On permanent errors (invalid key), returns the error directly
 * 4. If both fail, returns a graceful error message
 */
export async function callWithFallback<T>(
  userId: string,
  caller: (config: AiConfig) => Promise<T>,
): Promise<{ data: T | null; error: UserFacingError | null; warning?: string }> {
  // Try user config first
  const userConfig = await getUserAiConfig(userId);
  let lastError: UserFacingError | null = null;

  if (userConfig) {
    try {
      const data = await caller(userConfig);
      return { data, error: null };
    } catch (err) {
      const classified = classifyError(err);
      lastError = classified;

      // Only fallback on transient errors
      if (!isTransientError(classified)) {
        return { data: null, error: classified };
      }
    }
  }

  // Fall back to preset default
  try {
    const presetConfig = getAiConfig();
    const data = await caller(presetConfig);
    return {
      data,
      error: null,
      warning: lastError?.message,
    };
  } catch (err) {
    const classified = classifyError(err);

    // If both failed, give the user a meaningful message
    if (lastError) {
      return {
        data: null,
        error: new UserFacingError(
          `AI service is currently unavailable. ${lastError.message} The default provider also failed: ${classified.message}`,
          'unavailable',
        ),
      };
    }

    return { data: null, error: classified };
  }
}
