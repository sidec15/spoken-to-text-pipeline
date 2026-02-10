import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { PipelineConfig } from '../../../src/config/config.types.js';

// Mock AI services for ESM
const mockOpenAiService = jest.fn().mockImplementation(() => ({
  generateTextAsync: jest.fn(),
}));

const mockDeepSeekService = jest.fn().mockImplementation(() => ({
  generateTextAsync: jest.fn(),
}));

const mockOllamaService = jest.fn().mockImplementation(() => ({
  generateTextAsync: jest.fn(),
}));

jest.unstable_mockModule('../../../src/services/ai/openai/openaiAiService.js', () => ({
  OpenAiService: mockOpenAiService,
}));

jest.unstable_mockModule('../../../src/services/ai/deepseek/deepseekAiService.js', () => ({
  DeepSeekAiService: mockDeepSeekService,
}));

jest.unstable_mockModule('../../../src/services/ai/ollama/ollamaAiService.js', () => ({
  OllamaAiService: mockOllamaService,
}));

describe('aiServiceFactory', () => {
  const createMockConfig = (): PipelineConfig => ({
    profile: 'lecture',
    language: { input: 'it', output: 'it' },
    logging: { level: 'info', singleLine: true },
    paths: { inputDir: './input', outputDir: './output' },
    asr: {
      provider: 'whisper',
      whisper: { serverUrl: 'http://localhost:9000/asr' },
    },
    ai: {
      providers: {
        openai: { apiKey: 'sk-openai-test' },
        deepseek: { apiKey: 'sk-deepseek-test' },
        ollama: {},
      },
      default: {
        provider: 'openai',
        model: 'gpt-4o-mini',
      },
    },
    profiles: {
      lecture: {
        prompts: { cleaning: 'test', handout: 'test', summary: 'test' },
      },
      meeting: {
        prompts: { cleaning: 'test', summary: 'test' },
      },
      other: {
        prompts: { cleaning: 'test', summary: 'test' },
      },
    },
  });

  let createAiService: any;
  let resolveAiConfig: any;
  let resolveStepConfig: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await import('../../../src/services/ai/aiServiceFactory.js');
    createAiService = module.createAiService;
    resolveAiConfig = module.resolveAiConfig;
    resolveStepConfig = module.resolveStepConfig;
  });

  describe('resolveStepConfig', () => {
    it('should resolve step config with defaults', () => {
      // Arrange
      const config = createMockConfig();

      // Act
      const result = resolveStepConfig(config, 'cleaning');

      // Assert
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4o-mini');
    });

    it('should resolve step config with overrides', () => {
      // Arrange
      const config = createMockConfig();
      config.steps = {
        cleaning: {
          enabled: true,
          aiConfig: {
            provider: 'deepseek',
            model: 'deepseek-chat',
          },
        },
      };

      // Act
      const result = resolveStepConfig(config, 'cleaning');

      // Assert
      expect(result.provider).toBe('deepseek');
      expect(result.model).toBe('deepseek-chat');
    });
  });

  describe('createAiService', () => {
    it('should create OpenAI service', async () => {
      // Arrange
      const config = createMockConfig();

      // Act
      const service = createAiService(config, 'cleaning');

      // Assert
      expect(mockOpenAiService).toHaveBeenCalledWith('sk-openai-test', 'gpt-4o-mini');
      expect(service).toBeDefined();
    });

    it('should use SPOKEN_TO_TEXT_OPENAI_API_KEY when openai apiKey empty in config', () => {
      const config = createMockConfig();
      config.ai!.providers!.openai = { apiKey: '' };
      const prev = process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY = 'sk-env-openai';
      try {
        createAiService(config, 'cleaning');
        expect(mockOpenAiService).toHaveBeenCalledWith('sk-env-openai', 'gpt-4o-mini');
      } finally {
        if (prev !== undefined) process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY = prev;
        else delete process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      }
    });

    it('should use SPOKEN_TO_TEXT_DEEPSEEK_API_KEY when deepseek apiKey empty in config', () => {
      const config = createMockConfig();
      config.ai!.default!.provider = 'deepseek';
      config.ai!.default!.model = 'deepseek-chat';
      config.ai!.providers!.deepseek = { apiKey: '' };
      const prev = process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY = 'sk-env-deepseek';
      try {
        createAiService(config, 'cleaning');
        expect(mockDeepSeekService).toHaveBeenCalledWith('sk-env-deepseek', 'deepseek-chat');
      } finally {
        if (prev !== undefined) process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY = prev;
        else delete process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      }
    });

    it('should create DeepSeek service', async () => {
      // Arrange
      const config = createMockConfig();
      config.ai.default.provider = 'deepseek';
      config.ai.default.model = 'deepseek-chat';

      // Act
      const service = createAiService(config, 'cleaning');

      // Assert
      expect(mockDeepSeekService).toHaveBeenCalledWith('sk-deepseek-test', 'deepseek-chat');
      expect(service).toBeDefined();
    });

    it('should create Ollama service', async () => {
      // Arrange
      const config = createMockConfig();
      config.ai.default.provider = 'ollama';
      config.ai.default.model = 'llama3.1:8b';

      // Act
      const service = createAiService(config, 'cleaning');

      // Assert
      expect(mockOllamaService).toHaveBeenCalledWith('llama3.1:8b', undefined);
      expect(service).toBeDefined();
    });

    it('should create Ollama service with custom base URL', async () => {
      // Arrange
      const config = createMockConfig();
      config.ai.default.provider = 'ollama';
      config.ai.default.model = 'llama3.1:8b';
      config.ai.providers!.ollama = { baseUrl: 'http://192.168.1.100:11434/v1' };

      // Act
      const service = createAiService(config, 'cleaning');

      // Assert
      expect(mockOllamaService).toHaveBeenCalledWith('llama3.1:8b', 'http://192.168.1.100:11434/v1');
      expect(service).toBeDefined();
    });

    it('should throw error for missing provider', () => {
      // Arrange
      const config = createMockConfig();
      config.ai.providers = {};

      // Act & Assert
      expect(() => createAiService(config, 'cleaning')).toThrow(/OpenAI provider not configured/);
    });

    it('should throw error for unsupported provider', () => {
      // Arrange
      const config = createMockConfig();
      config.ai.default.provider = 'invalid-provider' as any;

      // Act & Assert
      expect(() => createAiService(config, 'cleaning')).toThrow(/Unsupported provider/);
    });

    it('should throw error for missing DeepSeek provider', () => {
      // Arrange
      const config = createMockConfig();
      config.ai.default.provider = 'deepseek';
      config.ai.providers = { openai: { apiKey: 'sk-test' } };

      // Act & Assert
      expect(() => createAiService(config, 'cleaning')).toThrow(/DeepSeek provider not configured/);
    });

    it('should throw error for missing Ollama provider', () => {
      // Arrange
      const config = createMockConfig();
      config.ai.default.provider = 'ollama';
      config.ai.providers = { openai: { apiKey: 'sk-test' } };

      // Act & Assert
      expect(() => createAiService(config, 'cleaning')).toThrow(/Ollama provider not configured/);
    });

    it('should throw error for unsupported AI provider in createAiService', () => {
      // Arrange
      const config = createMockConfig();
      config.ai.default.provider = 'invalid-provider' as any;
      config.ai.providers = { invalid: { apiKey: 'test' } as any };

      // Act & Assert
      expect(() => createAiService(config, 'cleaning')).toThrow(/Unsupported provider/);
    });
  });

  describe('resolveAiConfig', () => {
    it('should resolve AI config for OpenAI', () => {
      // Arrange
      const config = createMockConfig();

      // Act
      const result = resolveAiConfig(config, 'cleaning');

      // Assert
      expect(result.systemPrompt).toBeDefined();
      expect(result.systemPrompt).toContain('it'); // Language instruction
      expect(result.temperature).toBeDefined();
    });

    it('should resolve AI config for DeepSeek', () => {
      // Arrange
      const config = createMockConfig();
      config.ai.default.provider = 'deepseek';

      // Act
      const result = resolveAiConfig(config, 'cleaning');

      // Assert
      expect(result.systemPrompt).toBeDefined();
      expect(result.systemPrompt).toContain('it'); // Language instruction
    });

    it('should resolve AI config for Ollama', () => {
      // Arrange
      const config = createMockConfig();
      config.ai.default.provider = 'ollama';

      // Act
      const result = resolveAiConfig(config, 'cleaning');

      // Assert
      expect(result.systemPrompt).toBeDefined();
      expect(result.systemPrompt).toContain('it'); // Language instruction
    });

    it('should throw error for unsupported provider', () => {
      // Arrange
      const config = createMockConfig();
      config.ai.default.provider = 'invalid-provider' as any;

      // Act & Assert
      expect(() => resolveAiConfig(config, 'cleaning')).toThrow(/Unsupported AI provider/);
    });
  });
});
