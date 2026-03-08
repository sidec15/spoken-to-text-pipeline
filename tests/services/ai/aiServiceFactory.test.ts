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
  });

  let createAiService: any;
  let resolveAiConfig: any;
  let resolveStepConfig: any;
  let getStepLabel: any;
  let getStepLabelForAsr: any;
  let getLocalizedStepLabelForAsr: any;
  let buildMetadataHeader: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await import('../../../src/services/ai/aiServiceFactory.js');
    createAiService = module.createAiService;
    resolveAiConfig = module.resolveAiConfig;
    resolveStepConfig = module.resolveStepConfig;
    getStepLabel = module.getStepLabel;
    getStepLabelForAsr = module.getStepLabelForAsr;
    getLocalizedStepLabelForAsr = module.getLocalizedStepLabelForAsr;
    buildMetadataHeader = module.buildMetadataHeader;
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
      // Arrange - clear env so validation fails properly
      const prevOpenai = process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      delete process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      try {
        const config = createMockConfig();
        config.ai.providers = {};

        // Act & Assert
        expect(() => createAiService(config, 'cleaning')).toThrow(/OpenAI provider not configured/);
      } finally {
        if (prevOpenai !== undefined) process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY = prevOpenai;
        else delete process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      }
    });

    it('should throw error for unsupported provider', () => {
      // Arrange
      const config = createMockConfig();
      config.ai.default.provider = 'invalid-provider' as any;

      // Act & Assert
      expect(() => createAiService(config, 'cleaning')).toThrow(/Unsupported provider/);
    });

    it('should throw error for missing DeepSeek provider', () => {
      // Arrange - clear env so validation fails properly
      const prevDeepseek = process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      delete process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      try {
        const config = createMockConfig();
        config.ai.default.provider = 'deepseek';
        config.ai.providers = { openai: { apiKey: 'sk-test' } };

        // Act & Assert
        expect(() => createAiService(config, 'cleaning')).toThrow(/DeepSeek provider not configured/);
      } finally {
        if (prevDeepseek !== undefined) process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY = prevDeepseek;
        else delete process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      }
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

    it('should resolve AI config for handout step with single system prompt', () => {
      // Arrange
      const config = createMockConfig();

      // Act
      const result = resolveAiConfig(config, 'handout');

      // Assert - handout returns HandoutAiGenerateOptions with string systemPrompt
      expect(result.systemPrompt).toBeDefined();
      expect(typeof result.systemPrompt).toBe('string');
      expect(result.systemPrompt).toContain('it'); // Language instruction
    });
  });

  describe('getStepLabel', () => {
    it('should return correct labels for lecture profile', () => {
      const config = createMockConfig();
      expect(getStepLabel(config, 'cleaning')).toBe('Cleaned transcript');
      expect(getStepLabel(config, 'handout')).toBe('Lecture Handout');
      expect(getStepLabel(config, 'summary')).toBe('Lecture Summary');
    });

    it('should return correct labels for meeting profile', () => {
      const config = createMockConfig();
      config.profile = 'meeting';
      expect(getStepLabel(config, 'cleaning')).toBe('Cleaned transcript');
      expect(getStepLabel(config, 'handout')).toBe('Meeting Handout');
      expect(getStepLabel(config, 'summary')).toBe('Meeting Summary');
    });

    it('should return correct labels for other profile', () => {
      const config = createMockConfig();
      config.profile = 'other';
      expect(getStepLabel(config, 'cleaning')).toBe('Cleaned transcript');
      expect(getStepLabel(config, 'handout')).toBe('Handout');
      expect(getStepLabel(config, 'summary')).toBe('Summary');
    });
  });

  describe('getStepLabelForAsr', () => {
    it('should return Raw transcript for any profile', () => {
      const config = createMockConfig();
      expect(getStepLabelForAsr(config)).toBe('Raw transcript');
      config.profile = 'meeting';
      expect(getStepLabelForAsr(config)).toBe('Raw transcript');
      config.profile = 'other';
      expect(getStepLabelForAsr(config)).toBe('Raw transcript');
    });
  });

  describe('getLocalizedStepLabelForAsr', () => {
    it('should return English label when output is English', async () => {
      const config = createMockConfig();
      config.language = { input: 'it', output: 'en' };
      const result = await getLocalizedStepLabelForAsr(config);
      expect(result).toBe('Raw transcript');
    });

    it('should return English label when aiService is not provided', async () => {
      const config = createMockConfig();
      config.language = { input: 'it', output: 'it' };
      const result = await getLocalizedStepLabelForAsr(config, undefined);
      expect(result).toBe('Raw transcript');
    });
  });

  describe('buildMetadataHeader', () => {
    it('should build header with title, authors, date, and step label', () => {
      const config = createMockConfig();
      config.title = 'Test Title';
      config.authors = ['Author 1', 'Author 2'];
      config.date = '2026-02-07';

      const result = buildMetadataHeader(config, 'Lecture Handout');

      expect(result).toContain('# Test Title');
      expect(result).toContain('**Author 1, Author 2**');
      expect(result).toContain('***Lecture Handout***');
    });

    it('should build header with only step label when no metadata', () => {
      const config = createMockConfig();

      const result = buildMetadataHeader(config, 'Lecture Summary');

      expect(result).toBe('***Lecture Summary***');
    });

    it('should format date according to output locale', () => {
      const config = createMockConfig();
      config.title = 'Test';
      config.date = '2026-02-07';
      config.language = { input: 'en', output: 'en' };

      const result = buildMetadataHeader(config, 'Handout');

      expect(result).toContain('# Test');
      expect(result).toContain('***Handout***');
    });
  });
});
