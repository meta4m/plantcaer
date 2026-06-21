import type { LightRequirement, TaskType } from '@/lib/types';

/**
 * Structured suggestion returned by the AI when identifying a plant from a photo.
 * Mirrors the Add Plant form fields + care tasks.
 */
export interface AiPlantSuggestion {
  /** Common name of the plant (e.g. "Monstera Deliciosa") */
  common_name: string;
  /** Scientific/Latin name (e.g. "Monstera deliciosa") */
  scientific_name: string;
  /** Light requirement category */
  light_requirement: LightRequirement;
  /** Minimum safe temperature in Celsius */
  min_temp: number;
  /** Maximum safe temperature in Celsius */
  max_temp: number;
  /** Minimum comfortable humidity percentage (0-100) */
  humidity_min: number;
  /** General care notes (1-3 sentences) */
  notes: string;
  /** Suggested care tasks with frequencies */
  care_tasks: AiSuggestedCareTask[];
}

/**
 * A single suggested care task from the AI.
 */
export interface AiSuggestedCareTask {
  /** Type of care task */
  task_type: TaskType;
  /** How often this task should be performed (in days) */
  frequency_days: number;
  /** Amount/quantity (e.g. "200ml", "1 cup", "dilute to half strength") */
  amount: string;
  /** Any special instructions for this task */
  notes: string;
}

/**
 * Configuration for a supported AI provider.
 */
export interface AiProviderInfo {
  id: string;
  name: string;
  supportsVision: boolean;
  defaultModel: string;
  apiKeyEnvVar: string;
  endpoint: string;
}
