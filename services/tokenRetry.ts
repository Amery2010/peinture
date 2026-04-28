/**
 * Unified Token Retry Service
 *
 * Consolidates the runWithTokenRetry pattern used across all provider services.
 * Each provider can configure:
 * - Whether tokens are required or optional
 * - Custom quota error detection patterns
 * - Error messages for missing/exhausted tokens
 */

import { ProviderId } from "../types";
import { useConfigStore } from "../store/configStore";

// --- Token Access Helpers ---

const getNextAvailableToken = (providerId: ProviderId): string | null => {
  useConfigStore.getState().resetDailyStatus(providerId);

  const currentState = useConfigStore.getState();
  const tokens = currentState.tokens[providerId] || [];
  const status = currentState.tokenStatus[providerId];

  return tokens.find((t) => !status.exhausted[t]) || null;
};

const markTokenExhausted = (providerId: ProviderId, token: string): void => {
  useConfigStore.getState().markTokenExhausted(providerId, token);
};

// --- Provider-specific Quota Error Patterns ---

const QUOTA_ERROR_PATTERNS: Record<ProviderId, string[]> = {
  huggingface: ["429", "You have exceeded your free GPU quota"],
  gitee: ["429", "quota", "credit"],
  modelscope: ["429", "quota", "credit", "Arrearage", "Bill"],
  a4f: ["429", "insufficient_quota", "quota"],
  openai: ["429", "insufficient_quota", "quota"],
  google: ["429", "quota", "Resource exhausted"],
};

const ERROR_KEYS: Record<ProviderId, { required: string; exhausted: string }> =
  {
    huggingface: {
      required: "error_quota_exhausted", // HF doesn't require tokens, but this is used when all are exhausted
      exhausted: "error_quota_exhausted",
    },
    gitee: {
      required: "error_gitee_token_required",
      exhausted: "error_gitee_token_exhausted",
    },
    modelscope: {
      required: "error_ms_token_required",
      exhausted: "error_ms_token_exhausted",
    },
    a4f: {
      required: "error_a4f_token_required",
      exhausted: "error_a4f_token_exhausted",
    },
    openai: {
      required: "error_openai_token_required",
      exhausted: "error_openai_token_exhausted",
    },
    google: {
      required: "error_google_token_required",
      exhausted: "error_google_token_exhausted",
    },
  };

// HuggingFace can operate without tokens (public quota)
const TOKEN_OPTIONAL_PROVIDERS: ProviderId[] = ["huggingface"];

// --- Unified Retry Implementation ---

function isQuotaError(error: any, providerId: ProviderId): boolean {
  const patterns = QUOTA_ERROR_PATTERNS[providerId] || [];

  if (error.status === 429) return true;

  const message = error.message || "";
  return patterns.some((pattern) => message.includes(pattern));
}

/**
 * Run an operation with automatic token rotation on quota errors.
 *
 * For providers where tokens are optional (HuggingFace):
 * - If no tokens configured, runs once with null token
 * - If tokens configured but all exhausted, throws exhausted error
 *
 * For providers where tokens are required (Gitee, ModelScope, A4F):
 * - If no tokens configured, throws required error immediately
 * - If all tokens exhausted, throws exhausted error
 */
export async function runWithTokenRetry<T>(
  providerId: ProviderId,
  operation: (token: string | null) => Promise<T>,
): Promise<T> {
  const tokens = useConfigStore.getState().tokens[providerId] || [];
  const isOptional = TOKEN_OPTIONAL_PROVIDERS.includes(providerId);
  const errorKeys = ERROR_KEYS[providerId];

  // Handle no-token scenarios
  if (tokens.length === 0) {
    if (isOptional) {
      // HuggingFace: run with null token (public quota)
      return operation(null);
    }
    throw new Error(errorKeys.required);
  }

  let lastError: any;
  let attempts = 0;
  const maxAttempts = tokens.length + 1;

  while (attempts < maxAttempts) {
    attempts++;
    const token = getNextAvailableToken(providerId);

    if (!token) {
      throw new Error(errorKeys.exhausted);
    }

    try {
      return await operation(token);
    } catch (error: any) {
      lastError = error;

      // Don't retry on user abort
      if (error.name === "AbortError") {
        throw error;
      }

      if (isQuotaError(error, providerId) && token) {
        console.warn(
          `[${providerId}] Token ${token.substring(0, 4)}**** exhausted. Switching to next token.`,
        );
        markTokenExhausted(providerId, token);
        continue;
      }

      // Non-quota error — rethrow immediately
      throw error;
    }
  }

  throw lastError || new Error("error_api_connection");
}
