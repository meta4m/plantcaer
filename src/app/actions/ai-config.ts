'use server';

import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { encryptApiKey, maskApiKey } from '@/lib/api-key-crypto';
import { resolveAiConfig, testAiConnection, getAiConfigStatus } from '@/lib/ai-config-resolver';
import { getAuthedUser } from '@/lib/get-user';

// ─── Types ─────────────────────────────────────────────────────

export interface AiConfigFormData {
  provider: string;
  model: string;
  baseUrl?: string;
  apiKey: string;
}

export interface AiConfigStatusResult {
  configured: boolean;
  provider: string;
  model: string;
  hasBaseUrl: boolean;
  maskedKey?: string;
}

// ─── Helper: get authed user ID ──────────────────────────────

async function getAuthedUserIdServer(): Promise<string | null> {
  const supabase = await createClient();
  const user = await getAuthedUser(supabase);
  return user?.id ?? null;
}

// ─── Save AI config ───────────────────────────────────────────

export async function saveAiConfig(formData: AiConfigFormData): Promise<{
  success: boolean;
  error: string | null;
  status: AiConfigStatusResult | null;
}> {
  try {
    const userId = await getAuthedUserIdServer();
    if (!userId) {
      return { success: false, error: 'Not authenticated', status: null };
    }

    if (!formData.provider || !formData.model || !formData.apiKey) {
      return { success: false, error: 'Provider, model, and API key are required.', status: null };
    }

    const encryptedKey = encryptApiKey(formData.apiKey);
    const admin = createAdminClient();

    // Upsert: insert or update existing config for this user
    const { data: existing } = await admin
      .from('user_ai_configs')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await admin
        .from('user_ai_configs')
        .update({
          provider: formData.provider,
          model: formData.model,
          base_url: formData.baseUrl || null,
          encrypted_api_key: encryptedKey,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await admin
        .from('user_ai_configs')
        .insert({
          user_id: userId,
          provider: formData.provider,
          model: formData.model,
          base_url: formData.baseUrl || null,
          encrypted_api_key: encryptedKey,
        });

      if (insertError) throw insertError;
    }

    const status = await getAiConfigStatus(userId);

    return {
      success: true,
      error: null,
      status: {
        ...status,
        maskedKey: maskApiKey(formData.apiKey),
      },
    };
  } catch (err) {
    console.error('[saveAiConfig]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save AI configuration',
      status: null,
    };
  }
}

// ─── Remove AI config ─────────────────────────────────────────

export async function removeAiConfig(): Promise<{
  success: boolean;
  error: string | null;
}> {
  try {
    const userId = await getAuthedUserIdServer();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('user_ai_configs')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;

    return { success: true, error: null };
  } catch (err) {
    console.error('[removeAiConfig]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove AI configuration',
    };
  }
}

// ─── Get AI config status ─────────────────────────────────────

export async function getAiStatus(): Promise<{
  status: AiConfigStatusResult | null;
  error: string | null;
}> {
  try {
    const userId = await getAuthedUserIdServer();
    if (!userId) {
      return { status: null, error: 'Not authenticated' };
    }

    const status = await getAiConfigStatus(userId);
    return { status, error: null };
  } catch (err) {
    console.error('[getAiStatus]', err);
    return {
      status: null,
      error: err instanceof Error ? err.message : 'Failed to get AI status',
    };
  }
}

// ─── Test AI connection ───────────────────────────────────────

export async function testAiConnectionAction(formData: AiConfigFormData): Promise<{
  success: boolean;
  hasVision: boolean;
  error: string | null;
}> {
  try {
    const result = await testAiConnection({
      provider: formData.provider as any,
      model: formData.model,
      apiKey: formData.apiKey,
      baseUrl: formData.baseUrl || undefined,
      endpoint: formData.baseUrl || '',
      maxImageSizeMB: 20,
      supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
      compressToMaxWidth: 2048,
    });

    return {
      success: result.success,
      hasVision: result.hasVision,
      error: result.error,
    };
  } catch (err) {
    return {
      success: false,
      hasVision: false,
      error: err instanceof Error ? err.message : 'Test failed',
    };
  }
}
