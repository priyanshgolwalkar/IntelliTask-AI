import { GoogleGenAI } from '@google/genai';

export type LLMProviderName = 'gemini' | 'groq';

export interface LLMExecutionMetadata {
  agentName: string;
  provider: LLMProviderName;
  model: string;
  status: 'success' | 'failed';
  durationMs: number;
  fallbackReason?: string;
  errorCode?: string;
}

export interface LLMGenerateResult {
  text: string;
  provider: LLMProviderName;
  model: string;
  metadata: LLMExecutionMetadata;
}

function statusOf(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const value = error as { status?: number; statusCode?: number; code?: number };
  return value.status ?? value.statusCode ?? value.code;
}

export function classifyProviderError(error: unknown): {
  statusCode?: number;
  retryable: boolean;
  exhaustedDailyQuota: boolean;
  unavailableModel: boolean;
  reason: string;
} {
  const statusCode = statusOf(error);
  const reason = error instanceof Error ? error.message : String(error || '');
  const combined = `${statusCode || ''} ${reason}`.toUpperCase();
  const exhaustedDailyQuota = /DAILY|QUOTA.*(EXCEEDED|LIMIT)|FREE TIER.*LIMIT/i.test(reason) ||
    statusCode === 429;
  const unavailableModel = statusCode === 404 || /MODEL.*(NOT FOUND|UNAVAILABLE|UNSUPPORTED)/i.test(reason);
  const retryable =
    ![401, 403].includes(statusCode || 0) &&
    (unavailableModel ||
      [429, 500, 502, 503, 504].includes(statusCode || 0) ||
      /UNAVAILABLE|RESOURCE_EXHAUSTED|ECONNRESET|ETIMEDOUT|NETWORK|TIMED OUT|FETCH FAILED/i.test(combined));
  return { statusCode, retryable, exhaustedDailyQuota, unavailableModel, reason };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function providerPriority(): LLMProviderName[] {
  const configured = (process.env.LLM_PROVIDER_PRIORITY || 'gemini,groq')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is LLMProviderName => value === 'gemini' || value === 'groq');
  return [...new Set(configured.length ? configured : ['gemini', 'groq'])] as LLMProviderName[];
}

export class LLMProviderManager {
  constructor(private readonly geminiClient?: GoogleGenAI) {}

  public getStatus() {
    return {
      primary: providerPriority()[0],
      priority: providerPriority(),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim() && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' && process.env.GEMINI_MODEL?.trim()),
      geminiModel: process.env.GEMINI_MODEL || null,
      groqConfigured: Boolean(process.env.GROQ_API_KEY?.trim() && process.env.GROQ_MODEL?.trim()),
      groqModel: process.env.GROQ_MODEL || null,
    };
  }

  private async callGemini(contents: unknown, config: Record<string, unknown> | undefined, agentName: string, timeoutMs: number, fallbackReason?: string) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const model = process.env.GEMINI_MODEL?.trim();
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      throw Object.assign(new Error('Gemini API key is not configured'), { statusCode: 503, provider: 'gemini', code: 'MISSING_CREDENTIALS' });
    }
    if (!model) {
      throw Object.assign(new Error('GEMINI_MODEL is not configured'), { statusCode: 404, provider: 'gemini', code: 'MODEL_NOT_CONFIGURED' });
    }

    const client = this.geminiClient || new GoogleGenAI({ apiKey });
    const startedAt = Date.now();
    const request = client.models.generateContent({ model, contents: contents as never, config: config as never });
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(Object.assign(
        new Error(`Gemini request timed out after ${Math.round(timeoutMs / 1000)} seconds`),
        { statusCode: 504, provider: 'gemini', code: 'TIMEOUT' },
      )), timeoutMs);
    });

    try {
      const response = await Promise.race([request, timeout]);
      return {
        text: response.text || '',
        provider: 'gemini' as const,
        model,
        metadata: {
          agentName,
          provider: 'gemini' as const,
          model,
          status: 'success' as const,
          durationMs: Date.now() - startedAt,
          fallbackReason,
        },
      };
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  private async callGroq(contents: unknown, config: Record<string, unknown> | undefined, agentName: string, timeoutMs: number, fallbackReason?: string) {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    const model = process.env.GROQ_MODEL?.trim();
    if (!apiKey) throw Object.assign(new Error('Groq API key is not configured'), { statusCode: 503, provider: 'groq', code: 'MISSING_CREDENTIALS' });
    if (!model) throw Object.assign(new Error('GROQ_MODEL is not configured'), { statusCode: 404, provider: 'groq', code: 'MODEL_NOT_CONFIGURED' });

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    if (config?.systemInstruction) messages.push({ role: 'system', content: String(config.systemInstruction) });
    messages.push({ role: 'user', content: typeof contents === 'string' ? contents : JSON.stringify(contents) });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const baseUrl = (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
    const startedAt = Date.now();
    const maxTokens = Math.max(1, Math.min(Number(process.env.GROQ_MAX_TOKENS || 300), 400));
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
                    Authorization: "Bearer " + apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: typeof config?.temperature === 'number' ? config.temperature : 0.2,
          max_tokens: maxTokens,
          response_format: config?.responseMimeType === 'application/json' ? { type: 'json_object' } : undefined,
        }),
        signal: controller.signal,
      });
      let data = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfterHeader = response.headers.get('retry-after');
          const retryAfter = retryAfterHeader
            ? Math.max(0, Math.min(Number(retryAfterHeader) || 0, 15))
            : 0;
          const message = data?.error?.message || 'Groq output-token or request rate limit reached';
          if (retryAfter > 0 && retryAfter <= 15) {
            await sleep(retryAfter * 1000);
            const retryController = new AbortController();
            const retryTimeout = setTimeout(() => retryController.abort(), timeoutMs);
            try {
              const retryResponse = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model,
                  messages,
                  temperature: typeof config?.temperature === 'number' ? config.temperature : 0.2,
                  max_tokens: maxTokens,
                  response_format: config?.responseMimeType === 'application/json' ? { type: 'json_object' } : undefined,
                }),
                signal: retryController.signal,
              });
              data = await retryResponse.json().catch(() => null);
              if (!retryResponse.ok) {
                const retryMessage = data?.error?.message || `Groq request failed with HTTP ${retryResponse.status}`;
                throw Object.assign(new Error(retryMessage), {
                  statusCode: retryResponse.status,
                  provider: 'groq',
                  code: String(retryResponse.status),
                  retryAfter: retryResponse.headers.get('retry-after') || undefined,
                });
              }
              const retryText = data?.choices?.[0]?.message?.content;
              if (typeof retryText === 'string' && retryText.trim()) {
                return {
                  text: retryText,
                  provider: 'groq' as const,
                  model,
                  metadata: {
                    agentName,
                    provider: 'groq' as const,
                    model,
                    status: 'success' as const,
                    durationMs: Date.now() - startedAt,
                    fallbackReason,
                  },
                };
              }
              throw Object.assign(new Error('Groq returned no message content after the rate-limit retry'), {
                statusCode: 502, provider: 'groq', code: 'EMPTY_RESPONSE',
              });
            } finally {
              clearTimeout(retryTimeout);
            }
          }
          throw Object.assign(new Error(message), {
            statusCode: response.status,
            provider: 'groq',
            code: '429',
            retryAfter: retryAfterHeader || undefined,
          });
        }
        const message = data?.error?.message || `Groq request failed with HTTP ${response.status}`;
        const retryAfterHeader = response.headers.get('retry-after');
        throw Object.assign(new Error(message), {
          statusCode: response.status,
          provider: 'groq',
          code: String(response.status),
          retryAfter: retryAfterHeader ? Number(retryAfterHeader) || retryAfterHeader : undefined,
        });
      }
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) {
        throw Object.assign(new Error('Groq returned no message content'), { statusCode: 502, provider: 'groq', code: 'EMPTY_RESPONSE' });
      }
      return {
        text,
        provider: 'groq' as const,
        model,
        metadata: {
          agentName,
          provider: 'groq' as const,
          model,
          status: 'success' as const,
          durationMs: Date.now() - startedAt,
          fallbackReason,
        },
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw Object.assign(new Error(`Groq request timed out after ${Math.round(timeoutMs / 1000)} seconds`), {
          statusCode: 504, provider: 'groq', code: 'TIMEOUT',
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  public async generate(options: { agentName: string; contents: unknown; config?: Record<string, unknown> }) {
    const timeoutMs = Math.max(5000, Number(process.env.LLM_REQUEST_TIMEOUT_MS || process.env.GEMINI_REQUEST_TIMEOUT_MS || 30000));
    const providers = providerPriority();
    const errors: string[] = [];
    let fallbackReason: string | undefined;

    for (const provider of providers) {
      let providerAttempted = false;
      try {
        providerAttempted = true;
        const result = provider === 'gemini'
          ? await this.callGemini(options.contents, options.config, options.agentName, timeoutMs, fallbackReason)
          : await this.callGroq(options.contents, options.config, options.agentName, timeoutMs, fallbackReason);
        return result as LLMGenerateResult;
      } catch (error: unknown) {
        const classified = classifyProviderError(error);
        errors.push(`${provider}: ${classified.reason}`);
        const statusCode = classified.statusCode;
        if ([401, 403].includes(statusCode || 0)) {
          throw Object.assign(
            new Error(`LLM authentication failed for ${provider}: ${classified.reason}`),
            { code: 'LLM_AUTH_ERROR', provider, fallbackReason },
          );
        }
        const configurationError = (error as { code?: string }).code === 'MODEL_NOT_CONFIGURED' ||
          (error as { code?: string }).code === 'MISSING_CREDENTIALS';
        if (configurationError) {
          fallbackReason = `${provider} configuration unavailable: ${classified.reason}`;
        } else if (statusCode === 429) {
          fallbackReason = `${provider} rate limit/quota reached: ${classified.reason}`;
        } else if (classified.retryable && !providerAttempted) {
          fallbackReason = `${provider} failed: ${classified.reason}`;
        } else {
          fallbackReason = `${provider} failed: ${classified.reason}`;
        }
      }
      const nextProvider = providers[providers.indexOf(provider) + 1];
      if (!nextProvider) break;
      fallbackReason = `${fallbackReason}; falling back to ${nextProvider}`;
    }

    throw Object.assign(
      new Error(`All configured LLM providers failed. ${errors.join('; ')}`),
      { code: 'LLM_PROVIDERS_FAILED', provider: 'both', errors },
    );
  }
}
