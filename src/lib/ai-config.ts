import 'server-only';

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ─── Types ─────────────────────────────────────────────────────────

export type AiProvider = 'google' | 'groq' | 'openai' | 'anthropic';

export interface AiConfig {
  /** The AI provider to use */
  provider: AiProvider;
  /** The model name (e.g. "gemini-3.5-flash", "llama-4-scout-17b") */
  model: string;
  /** The API key for the provider */
  apiKey: string;
  /** Optional base URL override (takes precedence over config file) */
  baseUrl?: string;
  /** The endpoint URL template (may contain {model} placeholder) */
  endpoint: string;
  /** Max image size in MB for vision requests */
  maxImageSizeMB: number;
  /** Supported image MIME types */
  supportedFormats: string[];
  /** Max width to compress images to */
  compressToMaxWidth: number;
}

export interface ProviderDefaults {
  model: string;
  supportsVision: boolean;
  apiKeyEnvVar: string;
}

// ─── JSON config type ──────────────────────────────────────────────

interface JsonConfig {
  provider: string;
  model: string;
  endpoints: Record<string, string>;
  providerDefaults: Record<string, ProviderDefaults>;
  vision: {
    maxImageSizeMB: number;
    supportedFormats: string[];
    compressToMaxWidth: number;
  };
}

// ─── Config loader ─────────────────────────────────────────────────

const DEFAULT_CONFIG_PATH = join(process.cwd(), 'config', 'ai-config.json');

let cachedConfig: AiConfig | null = null;

/**
 * Load and merge AI configuration from:
 * 1. config/ai-config.json (non-sensitive defaults)
 * 2. Environment variables (secrets + overrides)
 *
 * Environment variables take precedence over JSON config values.
 */
export function getAiConfig(): AiConfig {
  // Skip cache in development to pick up env var changes without server restart
  if (process.env.NODE_ENV === 'development') {
    resetAiConfig();
  }
  if (cachedConfig) return cachedConfig;

  // Load JSON config
  let jsonConfig: JsonConfig;
  try {
    if (existsSync(DEFAULT_CONFIG_PATH)) {
      const raw = readFileSync(DEFAULT_CONFIG_PATH, 'utf-8');
      jsonConfig = JSON.parse(raw);
    } else {
      throw new Error(`AI config file not found at ${DEFAULT_CONFIG_PATH}`);
    }
  } catch (err) {
    console.warn(
      '[ai-config] Failed to load config file, falling back to defaults:',
      err instanceof Error ? err.message : String(err)
    );
    jsonConfig = getDefaultJsonConfig();
  }

  // Determine provider (env var overrides JSON)
  const provider = (process.env.AI_PROVIDER || jsonConfig.provider) as AiProvider;
  const providerDefaults = jsonConfig.providerDefaults[provider];

  if (!providerDefaults) {
    throw new Error(
      `Unknown AI provider "${provider}". Supported: ${Object.keys(jsonConfig.providerDefaults).join(', ')}`
    );
  }

  // Determine model (env var overrides JSON)
  const model = process.env.AI_MODEL || jsonConfig.model || providerDefaults.model;

  // Determine API key
  const envVarName = providerDefaults.apiKeyEnvVar || 'AI_API_KEY';
  const apiKey = process.env[envVarName] || process.env.AI_API_KEY || '';

  if (!apiKey) {
    throw new Error(
      `Missing API key for provider "${provider}". Set the ${envVarName} environment variable.`
    );
  }

  // Determine endpoint (env var overrides JSON)
  const baseUrl = process.env.AI_BASE_URL;
  const endpoint = baseUrl || jsonConfig.endpoints[provider];

  if (!endpoint) {
    throw new Error(
      `No endpoint configured for provider "${provider}". Set AI_BASE_URL or add it to config/ai-config.json.`
    );
  }

  cachedConfig = {
    provider,
    model,
    apiKey,
    baseUrl,
    endpoint,
    maxImageSizeMB: jsonConfig.vision?.maxImageSizeMB ?? 20,
    supportedFormats: jsonConfig.vision?.supportedFormats ?? [
      'image/jpeg',
      'image/png',
      'image/webp',
    ],
    compressToMaxWidth: jsonConfig.vision?.compressToMaxWidth ?? 2048,
  };

  return cachedConfig;
}

/**
 * Reset the cached config (useful for testing or runtime config changes).
 */
export function resetAiConfig(): void {
  cachedConfig = null;
}

// ─── Defaults (fallback if config file is missing) ──────────────────

function getDefaultJsonConfig(): JsonConfig {
  return {
    provider: 'google',
    model: 'gemini-3.5-flash',
    endpoints: {
      google: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
      groq: 'https://api.groq.com/openai/v1/chat/completions',
      openai: 'https://api.openai.com/v1/chat/completions',
      anthropic: 'https://api.anthropic.com/v1/messages',
    },
    providerDefaults: {
      google: { model: 'gemini-3.5-flash', supportsVision: true, apiKeyEnvVar: 'AI_API_KEY' },
      groq: { model: 'llama-4-scout-17b', supportsVision: true, apiKeyEnvVar: 'AI_API_KEY' },
      openai: { model: 'gpt-5.4-mini', supportsVision: true, apiKeyEnvVar: 'AI_API_KEY' },
      anthropic: { model: 'claude-haiku-4.5', supportsVision: true, apiKeyEnvVar: 'AI_API_KEY' },
    },
    vision: {
      maxImageSizeMB: 20,
      supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
      compressToMaxWidth: 2048,
    },
  };
}

// ─── Utility: replace {model} placeholder in endpoint URLs ──────────

export function resolveEndpoint(endpoint: string, model: string): string {
  return endpoint.replace(/\{model\}/g, model);
}
