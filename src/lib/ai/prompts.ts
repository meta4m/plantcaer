/**
 * Prompt templates for AI-powered plant identification and care suggestions.
 *
 * These prompts are designed to work across all supported AI providers
 * and produce consistent structured JSON output.
 */

import type { AiPlantSuggestion } from './types';

/**
 * System prompt for the plant identification AI.
 * Instructs the model to act as a plant expert and return structured data.
 */
export const PLANT_ID_SYSTEM_PROMPT = `You are a world-class botanist and plant care expert. Your job is to:
1. Identify plant species from photographs with high accuracy
2. Provide accurate, conservative care recommendations
3. Always return data in the exact JSON schema requested

For common houseplants, be specific with care instructions. For unknown plants, make conservative default recommendations suitable for typical indoor conditions.

Never make up scientific names. If unsure, use "Unknown species" and omit the scientific name.

Temperature ranges should be in Celsius. Humidity as percentage (0-100).`;

/**
 * User prompt template for identifying a plant from a photo.
 * Includes the exact JSON schema the AI must return.
 */
export function buildPlantIdUserPrompt(): string {
  return `Identify this plant from the photo and provide care recommendations.

Return a JSON object with EXACTLY this structure (no markdown, no code fences — just raw JSON):

${JSON.stringify(getPlantIdResponseSchema(), null, 2)}

Guidelines:
- common_name: The most common name for this plant. If unknown, use "Unknown Plant".
- scientific_name: The Latin binomial name. If unsure, leave as empty string.
- light_requirement: Choose the best match from the four options.
- min_temp / max_temp: Conservative temperature range in Celsius that is safe for this plant.
- humidity_min: Minimum comfortable humidity percentage.
- notes: 1-3 sentences covering care highlights and any unique characteristics.
- care_tasks: At minimum include "watering". Add other relevant tasks (fertilizing, repotting, pruning, pest_disease, propagation) that apply to this specific plant.
  - frequency_days: Standard interval in days between care sessions.
  - amount: The typical quantity (e.g. "200ml", "1 cup", "dilute to half strength").
  - notes: Any special instructions for this task type.

If you cannot identify the plant visually:
- Set common_name to "Unknown Plant"
- Do NOT make up a scientific name
- Provide conservative, safe defaults for all care fields suitable for a typical tropical houseplant
- Include a note saying "Plant could not be positively identified from the photo"

Deliver ONLY the JSON object with no additional text before or after.`;
}

/**
 * Returns the expected JSON schema for the AI response.
 * Used both as a prompt template and for type safety.
 */
function getPlantIdResponseSchema(): Omit<AiPlantSuggestion, 'care_tasks'> & {
  care_tasks: (Omit<AiPlantSuggestion['care_tasks'][number], 'task_type'> & { task_type: string })[];
} {
  return {
    common_name: 'Monstera Deliciosa',
    scientific_name: 'Monstera deliciosa',
    light_requirement: 'bright_indirect',
    min_temp: 18,
    max_temp: 30,
    humidity_min: 60,
    notes: 'Thrives in bright, indirect light. Water when top 2-3 inches of soil are dry. Toxic to pets.',
    care_tasks: [
      {
        task_type: 'watering',
        frequency_days: 7,
        amount: '200ml',
        notes: 'Water thoroughly, allow excess to drain. Reduce frequency in winter.',
      },
      {
        task_type: 'fertilizing',
        frequency_days: 30,
        amount: 'dilute to half strength',
        notes: 'Use balanced liquid fertilizer during growing season (spring/summer).',
      },
    ],
  };
}

/**
 * Build a prompt for generating a shareable plant care summary
 * that users can paste into ChatGPT/Gemini/Claude for validation.
 */
export function buildPlantCareSummaryPrompt(plantData: {
  common_name: string;
  scientific_name?: string | null;
  location?: string | null;
  light_requirement?: string | null;
  min_temp?: number | null;
  max_temp?: number | null;
  humidity_min?: number | null;
  notes?: string | null;
  care_tasks?: {
    task_type: string;
    frequency_days?: number | null;
    amount?: string | null;
    notes?: string | null;
  }[];
}): string {
  const lines: string[] = [
    `🌿 Plant: ${plantData.common_name}`,
  ];

  if (plantData.scientific_name) {
    lines.push(`Scientific name: ${plantData.scientific_name}`);
  }

  if (plantData.location) {
    lines.push(`Location: ${plantData.location}`);
  }

  if (plantData.light_requirement) {
    const labels: Record<string, string> = {
      direct_sun: 'Direct Sun',
      bright_indirect: 'Bright Indirect',
      low_light: 'Low Light',
      shade: 'Shade',
    };
    lines.push(`Light: ${labels[plantData.light_requirement] || plantData.light_requirement}`);
  }

  if (plantData.min_temp != null && plantData.max_temp != null) {
    lines.push(`Temperature: ${plantData.min_temp}°C - ${plantData.max_temp}°C`);
  } else if (plantData.min_temp != null) {
    lines.push(`Min temperature: ${plantData.min_temp}°C`);
  } else if (plantData.max_temp != null) {
    lines.push(`Max temperature: ${plantData.max_temp}°C`);
  }

  if (plantData.humidity_min != null) {
    lines.push(`Humidity: ${plantData.humidity_min}%+`);
  }

  if (plantData.care_tasks && plantData.care_tasks.length > 0) {
    lines.push('', 'Care schedule:');
    const icons: Record<string, string> = {
      watering: '💧',
      fertilizing: '🌿',
      repotting: '🪴',
      pruning: '✂️',
      pest_disease: '🐛',
      propagation: '🌱',
    };
    for (const task of plantData.care_tasks) {
      const icon = icons[task.task_type] || '📋';
      const label = task.task_type.charAt(0).toUpperCase() + task.task_type.slice(1).replace('_', ' ');
      const parts: string[] = [`${icon} ${label}:`];
      if (task.frequency_days) {
        parts.push(`Every ${task.frequency_days} days`);
      }
      if (task.amount) {
        parts.push(`(${task.amount})`);
      }
      lines.push(parts.join(' '));
      if (task.notes) {
        lines.push(`  → ${task.notes}`);
      }
    }
  }

  if (plantData.notes) {
    lines.push('', `Notes: ${plantData.notes}`);
  }

  lines.push('', '---', 'Please review these plant care recommendations and suggest any corrections or additions.');

  return lines.join('\n');
}

/**
 * Format plant data as a shareable text summary for copy-paste.
 */
export function formatPlantSummary(plantData: {
  common_name: string;
  scientific_name?: string | null;
  location?: string | null;
  light_requirement?: string | null;
  min_temp?: number | null;
  max_temp?: number | null;
  humidity_min?: number | null;
  notes?: string | null;
  care_tasks?: {
    task_type: string;
    frequency_days?: number | null;
    amount?: string | null;
    notes?: string | null;
  }[];
}): string {
  const labels: Record<string, string> = {
    direct_sun: 'Direct Sun',
    bright_indirect: 'Bright Indirect',
    low_light: 'Low Light',
    shade: 'Shade',
  };

  const icons: Record<string, string> = {
    watering: '💧',
    fertilizing: '🌿',
    repotting: '🪴',
    pruning: '✂️',
    pest_disease: '🐛',
    propagation: '🌱',
  };

  const lines: string[] = [
    `🌿 **${plantData.common_name}**`,
  ];

  if (plantData.scientific_name) {
    lines.push(`*Scientific name:* ${plantData.scientific_name}`);
  }

  lines.push('');

  if (plantData.location) lines.push(`📍 *Location:* ${plantData.location}`);
  if (plantData.light_requirement) lines.push(`☀️ *Light:* ${labels[plantData.light_requirement] || plantData.light_requirement}`);
  if (plantData.min_temp != null && plantData.max_temp != null) lines.push(`🌡️ *Temperature:* ${plantData.min_temp}°C – ${plantData.max_temp}°C`);
  if (plantData.humidity_min != null) lines.push(`💦 *Humidity:* ${plantData.humidity_min}%+`);

  if (plantData.care_tasks && plantData.care_tasks.length > 0) {
    lines.push('', '**Care Schedule:**');
    for (const task of plantData.care_tasks) {
      const icon = icons[task.task_type] || '📋';
      const label = task.task_type.charAt(0).toUpperCase() + task.task_type.slice(1).replace('_', ' ');
      const freq = task.frequency_days ? `every ${task.frequency_days} days` : '';
      const amt = task.amount ? `(${task.amount})` : '';
      lines.push(`- ${icon} ${label}: ${freq} ${amt}`.trim());
      if (task.notes) lines.push(`  *${task.notes}*`);
    }
  }

  if (plantData.notes) {
    lines.push('', `📝 *Notes:* ${plantData.notes}`);
  }

  lines.push('', '---');
  lines.push('*Generated by Plantcaer*');

  return lines.join('\n');
}
