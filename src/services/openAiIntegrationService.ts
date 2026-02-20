interface JsonSchema {
  name: string;
  schema: Record<string, unknown>;
  description?: string;
  strict?: boolean;
}

interface OpenAIJsonRequest {
  systemPrompt: string;
  userPrompt: string;
  responseSchema: JsonSchema;
  maxRetries?: number;
  model?: string;
  maxOutputTokens?: number;
}

interface OpenAIUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface OpenAIJsonResponse<T> {
  data: T;
  usage: OpenAIUsage;
  model: string;
}

interface ResponsesApiResult {
  output_text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
}

export interface ResumeBulletOptimization {
  original: string;
  optimized: string;
}

const DEFAULT_MODEL = 'gpt-4.1-mini';
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_MAX_OUTPUT_TOKENS = 350;
const RETRYABLE_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);

const wait = (delayMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const cleanPrompt = (prompt: string): string => prompt.replace(/\s+/g, ' ').trim();

const isRetryableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const status = (error as Error & { status?: number }).status;

  if (typeof status === 'number') {
    return RETRYABLE_STATUSES.has(status);
  }

  return /network|timeout|fetch/i.test(error.message);
};

const getApiKey = (): string => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable.');
  }

  return apiKey;
};

const buildResponseFormat = (schema: JsonSchema): Record<string, unknown> => ({
  type: 'json_schema',
  name: schema.name,
  strict: schema.strict ?? true,
  description: schema.description,
  schema: schema.schema,
});

const callResponsesApi = async (payload: Record<string, unknown>): Promise<ResponsesApiResult> => {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const error = new Error(`OpenAI request failed (${response.status}): ${errorBody}`) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }

  return (await response.json()) as ResponsesApiResult;
};

export const requestStructuredJson = async <T>(
  request: OpenAIJsonRequest,
): Promise<OpenAIJsonResponse<T>> => {
  const model = request.model ?? DEFAULT_MODEL;
  const retries = request.maxRetries ?? DEFAULT_MAX_RETRIES;
  const maxOutputTokens = request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;

  const payload = {
    model,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: `${cleanPrompt(request.systemPrompt)} Keep responses concise.`,
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: cleanPrompt(request.userPrompt),
          },
        ],
      },
    ],
    max_output_tokens: maxOutputTokens,
    text: {
      format: buildResponseFormat(request.responseSchema),
    },
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const result = await callResponsesApi(payload);
      const outputText = result.output_text?.trim();

      if (!outputText) {
        throw new Error('OpenAI returned an empty response body.');
      }

      return {
        data: JSON.parse(outputText) as T,
        usage: {
          inputTokens: result.usage?.input_tokens ?? 0,
          outputTokens: result.usage?.output_tokens ?? 0,
          totalTokens: result.usage?.total_tokens ?? 0,
        },
        model: result.model ?? model,
      };
    } catch (error) {
      lastError = error;

      if (attempt === retries || !isRetryableError(error)) {
        break;
      }

      const backoffMs = 300 * 2 ** attempt;
      await wait(backoffMs);
    }
  }

  throw new Error(`Failed to get structured JSON response from OpenAI: ${String(lastError)}`);
};

interface OptimizeResumeBulletsResponse {
  bulletPoints: ResumeBulletOptimization[];
}

const optimizeResumeBulletsSchema: JsonSchema = {
  name: 'optimized_resume_bullets',
  description: 'Improved resume bullet points with stronger language and measurable impact where appropriate.',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['bulletPoints'],
    properties: {
      bulletPoints: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['original', 'optimized'],
          properties: {
            original: { type: 'string' },
            optimized: { type: 'string' },
          },
        },
      },
    },
  },
};

export const optimizeResumeBulletPoints = async (
  bulletPoints: string[],
): Promise<ResumeBulletOptimization[]> => {
  const normalizedBullets = bulletPoints.map((bullet) => bullet.trim()).filter(Boolean);

  if (normalizedBullets.length === 0) {
    return [];
  }

  const systemPrompt = `You are an expert resume writer. Improve each resume bullet point while preserving factual accuracy.
Follow these rules:
- Improve clarity
- Add measurable impact when reasonable and grounded in the original statement
- Use strong action verbs
- Avoid exaggeration
- Preserve factual accuracy
Return JSON matching the schema exactly.`;

  const userPrompt = `Optimize the following resume bullet points:\n${normalizedBullets
    .map((bullet, index) => `${index + 1}. ${bullet}`)
    .join('\n')}`;

  const response = await requestStructuredJson<OptimizeResumeBulletsResponse>({
    systemPrompt,
    userPrompt,
    responseSchema: optimizeResumeBulletsSchema,
    maxOutputTokens: 700,
  });

  if (response.data.bulletPoints.length !== normalizedBullets.length) {
    throw new Error('OpenAI returned a different number of bullet points than requested.');
  }

  return response.data.bulletPoints;
};
