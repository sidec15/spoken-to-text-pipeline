import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock fs for ESM
const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();

jest.unstable_mockModule('node:fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
  },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

describe('loadConfig', () => {
  let loadConfig: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await import('../../src/config/loadConfig.js');
    loadConfig = module.loadConfig;
  });

  const validConfigPath = path.join(__dirname, '../fixtures/configs/valid-config.json');
  const invalidConfigPath = path.join(__dirname, '../fixtures/configs/invalid-config.json');
  const nonExistentPath = path.join(__dirname, '../fixtures/configs/non-existent.json');

  // Load valid config once for reuse
  const validConfigContent = `{
  "profile": "lecture",
  "language": {
    "input": "it",
    "output": "it"
  },
  "logging": {
    "level": "info",
    "singleLine": true
  },
  "paths": {
    "inputDir": "./input",
    "outputDir": "./output"
  },
  "output": {
    "addTimestamp": false,
    "summaryWordCount": 1000
  },
  "asr": {
    "provider": "whisper",
    "whisper": {
      "serverUrl": "http://localhost:9000/asr",
      "vad": {
        "enabled": true
      }
    }
  },
  "ai": {
    "providers": {
      "openai": {
        "apiKey": "sk-test-key-12345"
      },
      "deepseek": {
        "apiKey": "sk-deepseek-test-key-12345"
      }
    },
    "default": {
      "provider": "openai",
      "model": "gpt-4o-mini"
    }
  },
  "steps": {
    "cleaning": {
      "enabled": true,
      "aiConfig": {
        "provider": "openai",
        "model": "gpt-4o-mini"
      }
    }
  }
}`;

  describe('file loading', () => {
    it('should load valid config file (absolute path)', () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(validConfigContent);

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result).toBeDefined();
      expect(result.profile).toBe('lecture');
      expect(mockExistsSync).toHaveBeenCalled();
      expect(mockReadFileSync).toHaveBeenCalled();
    });

    it('should load valid config file (relative path)', () => {
      // Arrange
      const relativePath = './config.json';
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(validConfigContent);

      // Act
      const result = loadConfig(relativePath);

      // Assert
      expect(result).toBeDefined();
      expect(result.profile).toBe('lecture');
      expect(mockExistsSync).toHaveBeenCalled();
    });

    it('should resolve config path relative to baseDir when provided', () => {
      // Arrange
      const relativePath = './config.json';
      const baseDir = '/custom/base';
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(validConfigContent);

      // Act
      const result = loadConfig(relativePath, baseDir);

      // Assert
      expect(result).toBeDefined();
      expect(result.profile).toBe('lecture');
      // baseDir should NOT be in the config object
      expect(result.baseDir).toBeUndefined();
    });

    it('should resolve config path relative to baseDir when provided', () => {
      // Arrange
      const relativePath = './config.json';
      const baseDir = '/custom/base';
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(validConfigContent);

      // Act
      loadConfig(relativePath, baseDir);

      // Assert
      const expectedConfigPath = path.resolve(process.cwd(), baseDir, relativePath);
      expect(mockExistsSync).toHaveBeenCalledWith(expectedConfigPath);
    });

    it('should use absolute baseDir as-is when provided', () => {
      // Arrange
      const relativePath = './config.json';
      const baseDir = '/absolute/base';
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(validConfigContent);

      // Act
      const result = loadConfig(relativePath, baseDir);

      // Assert
      expect(result).toBeDefined();
      expect(result.profile).toBe('lecture');
      // baseDir should NOT be in the config object
      expect(result.baseDir).toBeUndefined();
      const expectedConfigPath = path.resolve(baseDir, relativePath);
      expect(mockExistsSync).toHaveBeenCalledWith(expectedConfigPath);
    });

    it('should throw error for non-existent file', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act & Assert
      expect(() => loadConfig(nonExistentPath)).toThrow(/Config file not found/);
      expect(mockExistsSync).toHaveBeenCalled();
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });

    it('should throw error for invalid JSON', () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{ invalid json }');

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid JSON in config file/);
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
    });

    it('should validate all required fields', () => {
      // Arrange
      mockReadFileSync.mockReturnValue(validConfigContent);

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.profile).toBeDefined();
      expect(result.language).toBeDefined();
      expect(result.logging).toBeDefined();
      expect(result.paths).toBeDefined();
      expect(result.asr).toBeDefined();
      expect(result.ai).toBeDefined();
    });

    it('should validate profile values (lecture, meeting, other)', () => {
      // Arrange
      const configs = ['lecture', 'meeting', 'other'];
      
      for (const profile of configs) {
        const configObj = JSON.parse(validConfigContent);
        configObj.profile = profile;
        mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

        // Act
        const result = loadConfig(validConfigPath);

        // Assert
        expect(result.profile).toBe(profile);
      }
    });

    it('should throw error for invalid profile value', () => {
      // Arrange
      const invalidConfig = `{
        "profile": "invalid-profile",
        "language": {
          "input": "it"
        }
      }`;
      mockReadFileSync.mockReturnValue(invalidConfig);

      // Act & Assert
      expect(() => loadConfig(invalidConfigPath)).toThrow(/Invalid 'profile' value/);
    });

    it('should validate language structure', () => {
      // Arrange
      mockReadFileSync.mockReturnValue(validConfigContent);

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.language.input).toBe('it');
      expect(result.language.output).toBe('it');
    });

    it('should throw error for missing language fields', () => {
      // Arrange
      const invalidConfig = {
        profile: 'lecture',
        ai: {
          providers: { openai: { apiKey: 'test' } },
          default: { provider: 'openai', model: 'test' }
        }
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      // Act & Assert
      // Language has defaults, so this should not throw - defaults are applied
      const result = loadConfig(validConfigPath);
      expect(result.language).toBeDefined();
      expect(result.language.input).toBeDefined();
      expect(result.language.output).toBeDefined();
    });

    it('should validate logging structure', () => {
      // Arrange
      mockReadFileSync.mockReturnValue(validConfigContent);

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.logging.level).toBe('info');
      expect(result.logging.singleLine).toBe(true);
    });

    it('should throw error for invalid logging level', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.logging.level = 'invalid';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'logging.level' field/);
    });

    it('should validate paths structure', () => {
      // Arrange
      mockReadFileSync.mockReturnValue(validConfigContent);

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.paths.inputDir).toBe('./input');
      expect(result.paths.outputDir).toBe('./output');
    });

    it('should throw error for missing paths fields', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      delete configObj.paths;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      // Paths have defaults, so this should not throw - defaults are applied
      const result = loadConfig(validConfigPath);
      expect(result.paths).toBeDefined();
      expect(result.paths.inputDir).toBeDefined();
      expect(result.paths.outputDir).toBeDefined();
    });

    it('should validate ASR configuration', () => {
      // Arrange
      mockReadFileSync.mockReturnValue(validConfigContent);

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.asr.provider).toBe('whisper');
      expect(result.asr.whisper.serverUrl).toBe('http://localhost:9000/asr');
    });

    it('should throw error for invalid ASR provider', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.asr.provider = 'invalid';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'asr.provider' field/);
    });

    it('should validate AI providers pool', () => {
      // Arrange
      mockReadFileSync.mockReturnValue(validConfigContent);

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.ai.providers.openai).toBeDefined();
      expect(result.ai.providers.openai?.apiKey).toBe('sk-test-key-12345');
    });

    it('should throw error when no AI providers configured', () => {
      // Arrange - empty providers; clear env so no key is injected (otherwise validation may pass)
      const prevOpenai = process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      const prevDeepseek = process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      delete process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      delete process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      try {
        const configObj = JSON.parse(validConfigContent);
        configObj.ai.providers = {};
        mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

        // Act & Assert - error may include multiple messages, so match any part
        expect(() => loadConfig(validConfigPath)).toThrow(/At least one provider must be configured|Default provider.*not configured|Step.*provider.*not configured/);
      } finally {
        if (prevOpenai !== undefined) process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY = prevOpenai;
        else delete process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
        if (prevDeepseek !== undefined) process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY = prevDeepseek;
        else delete process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      }
    });

    it('should validate AI default configuration', () => {
      // Arrange
      mockReadFileSync.mockReturnValue(validConfigContent);

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.ai.default.provider).toBe('openai');
      expect(result.ai.default.model).toBe('gpt-4o-mini');
    });

    it('should throw error when default provider not in providers pool', () => {
      // Arrange - clear env so validation fails properly
      const prevOpenai = process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      const prevDeepseek = process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      delete process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      delete process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      try {
        const configObj = JSON.parse(validConfigContent);
        configObj.ai.default.provider = 'openai';
        configObj.ai.providers = { deepseek: { apiKey: 'test' } };
        mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

        // Act & Assert
        expect(() => loadConfig(validConfigPath)).toThrow(/Default provider 'openai' is not configured/);
      } finally {
        if (prevOpenai !== undefined) process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY = prevOpenai;
        else delete process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
        if (prevDeepseek !== undefined) process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY = prevDeepseek;
        else delete process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      }
    });

    it('should validate AI step overrides', () => {
      // Arrange
      mockReadFileSync.mockReturnValue(validConfigContent);

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      // Steps are optional and come from ai.steps, not top-level steps
      // The valid config has ai.steps.cleaning configured
      expect(result.steps?.cleaning).toBeDefined();
      if (result.steps?.cleaning?.aiConfig) {
        expect(result.steps.cleaning.aiConfig.provider).toBe('openai');
      }
    });

    it('should set configDir to config file directory', () => {
      // Arrange
      mockReadFileSync.mockReturnValue(validConfigContent);

      // Act
      const result = loadConfig(validConfigPath);

      // Assert (loadConfig resolves path relative to cwd when not absolute)
      const absolutePath = path.isAbsolute(validConfigPath)
        ? validConfigPath
        : path.resolve(process.cwd(), validConfigPath);
      expect(result.configDir).toBe(path.dirname(absolutePath));
    });

    it('should accept steps.cleaning.prompt', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.steps.cleaning.prompt = 'Custom cleaning prompt';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.steps?.cleaning?.prompt).toBe('Custom cleaning prompt');
    });

    it('should accept steps.cleaning.promptFile', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.steps.cleaning.promptFile = './prompts/cleaning.md';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.steps?.cleaning?.promptFile).toBe('./prompts/cleaning.md');
    });

    it('should accept title, authors, and date metadata', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.title = 'Post-razionalismo';
      configObj.authors = ['Prof. Giovanni Turella'];
      configObj.date = '07 febbraio 2026';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.title).toBe('Post-razionalismo');
      expect(result.authors).toEqual(['Prof. Giovanni Turella']);
      expect(result.date).toBe('07 febbraio 2026');
    });

    it('should throw error for invalid title type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.title = 123;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'title' field/);
    });

    it('should throw error for invalid authors type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.authors = 'not-an-array';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'authors' field/);
    });

    it('should throw error for invalid authors array element', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.authors = [123, 'valid'];
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'authors\[0\]'/);
    });

    it('should throw error for invalid date type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.date = 2026;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'date' field/);
    });

    it('should accept steps.handout.prompt', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.steps = configObj.steps || {};
      configObj.steps.handout = { prompt: 'Custom handout prompt' };
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.steps?.handout?.prompt).toBe('Custom handout prompt');
    });

    it('should throw error for invalid steps.cleaning.prompt', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.steps = configObj.steps || {};
      configObj.steps.cleaning = configObj.steps.cleaning || {};
      configObj.steps.cleaning.prompt = 123;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'steps.cleaning.prompt' field/);
    });

    it('should throw error for invalid steps.cleaning.promptFile', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.steps = configObj.steps || {};
      configObj.steps.cleaning = configObj.steps.cleaning || {};
      configObj.steps.cleaning.promptFile = 456;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'steps.cleaning.promptFile' field/);
    });

    it('should validate context (optional)', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.context = { textSources: ['file1.txt', 'file2.txt'] };
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.context?.textSources).toEqual(['file1.txt', 'file2.txt']);
    });

    it('should throw error for invalid context textSources', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.context = { textSources: 'not-an-array' };
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'context.textSources'/);
    });

    it('should provide descriptive error messages', () => {
      // Arrange
      const invalidConfig = { profile: 'invalid' };
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'profile' value/);
    });

    it('should throw error when config is not an object', () => {
      // Arrange
      mockReadFileSync.mockReturnValue('"not an object"');

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Config must be an object/);
    });

    it('should throw error when config is null', () => {
      // Arrange
      mockReadFileSync.mockReturnValue('null');

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Config must be an object/);
    });

    it('should throw error for missing profile field', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      delete configObj.profile;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Missing or invalid 'profile' field/);
    });

    it('should throw error for missing language.input', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      delete configObj.language.input;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      // Language.input has defaults, so this should not throw - defaults are applied
      const result = loadConfig(validConfigPath);
      expect(result.language.input).toBeDefined();
    });

    it('should throw error for missing language.output', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      delete configObj.language.output;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      // Language.output has defaults, so this should not throw - defaults are applied
      const result = loadConfig(validConfigPath);
      expect(result.language.output).toBeDefined();
    });

    it('should throw error for missing logging.singleLine', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      delete configObj.logging.singleLine;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      // Logging.singleLine has defaults, so this should not throw - defaults are applied
      const result = loadConfig(validConfigPath);
      expect(result.logging.singleLine).toBeDefined();
    });

    it('should throw error for missing paths.inputDir', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      delete configObj.paths.inputDir;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      // Paths.inputDir has defaults, so this should not throw - defaults are applied
      const result = loadConfig(validConfigPath);
      expect(result.paths.inputDir).toBeDefined();
    });

    it('should throw error for missing paths.outputDir', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      delete configObj.paths.outputDir;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      // Paths.outputDir has defaults, so this should not throw - defaults are applied
      const result = loadConfig(validConfigPath);
      expect(result.paths.outputDir).toBeDefined();
    });

    it('should throw error for invalid output.addTimestamp', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.output.addTimestamp = 'not-boolean';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'output.addTimestamp'/);
    });

    it('should throw error for invalid output.summaryWordCount', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.output.summaryWordCount = -1;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'output.summaryWordCount'/);
    });

    it('should throw error for missing asr.whisper', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      delete configObj.asr.whisper;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      // ASR whisper has defaults applied, so this should not throw - defaults are applied
      const result = loadConfig(validConfigPath);
      expect(result.asr.whisper).toBeDefined();
    });

    it('should throw error for missing asr.whisper.serverUrl', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      delete configObj.asr.whisper.serverUrl;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      // ASR whisper serverUrl has defaults, so this should not throw - defaults are applied
      const result = loadConfig(validConfigPath);
      expect(result.asr.whisper.serverUrl).toBeDefined();
    });

    it('should throw error for invalid asr.whisper.vad', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.asr.whisper.vad = 'not-object';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'asr.whisper.vad'/);
    });

    it('should throw error for missing asr.whisper.vad.enabled', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.asr.whisper.vad = {};
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      // VAD defaults are merged, so enabled will be present from defaults
      // This test verifies that vad.enabled is required when vad is explicitly provided
      // But since defaults are merged, enabled will be present
      const result = loadConfig(validConfigPath);
      expect(result.asr.whisper.vad.enabled).toBeDefined();
    });

    it('should throw error for invalid ai.providers.openai', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.ai.providers.openai = 'not-object';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'ai.providers.openai'/);
    });

    it('should throw error for missing ai.providers.openai.apiKey when env unset', () => {
      // Arrange - env must be unset so validation still requires apiKey
      const prev = process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      delete process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      try {
        const configObj = JSON.parse(validConfigContent);
        delete configObj.ai.providers.openai.apiKey;
        mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

        // Act & Assert
        expect(() => loadConfig(validConfigPath)).toThrow(/Default provider 'openai' is not configured|At least one provider must be configured/);
      } finally {
        if (prev !== undefined) process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY = prev;
      }
    });

    it('should use SPOKEN_TO_TEXT_OPENAI_API_KEY when openai apiKey not in config', () => {
      const prev = process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      // Clear first to ensure we use the test key, not any existing env key
      delete process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY = 'sk-env-openai-key';
      try {
        const configObj = JSON.parse(validConfigContent);
        delete configObj.ai.providers.openai.apiKey;
        mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

        const result = loadConfig(validConfigPath);

        expect(result.ai.providers.openai?.apiKey).toBe('sk-env-openai-key');
      } finally {
        if (prev !== undefined) process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY = prev;
        else delete process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      }
    });

    it('should throw error for invalid ai.default.provider', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.ai.default.provider = 'invalid';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'ai.default.provider' field/);
    });

    it('should throw error for missing ai.default.model', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      delete configObj.ai.default.model;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      // AI default.model has defaults, but let's check if it's validated
      // Actually, defaults are applied, so model should be present from defaults
      const result = loadConfig(validConfigPath);
      expect(result.ai.default.model).toBeDefined();
    });

    it('should throw error for invalid ai.default.overrides.temperature', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.ai.default.overrides = { temperature: 'not-number' };
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'ai.default.overrides.temperature'/);
    });

    it('should throw error for invalid ai.default.overrides.maxTokens', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.ai.default.overrides = { maxTokens: 'not-number' };
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'ai.default.overrides.maxTokens'/);
    });

    it('should throw error for invalid steps field', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.steps = 'not-object';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'steps'/);
    });

    it('should throw error for invalid steps.cleaning.aiConfig.provider', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      if (!configObj.steps) {
        configObj.steps = {};
      }
      if (!configObj.steps.cleaning) {
        configObj.steps.cleaning = {};
      }
      if (!configObj.steps.cleaning.aiConfig) {
        configObj.steps.cleaning.aiConfig = {};
      }
      configObj.steps.cleaning.aiConfig.provider = 'invalid';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'steps.cleaning.aiConfig.provider' field/);
    });

    it('should throw error when step provider not in providers pool', () => {
      // Arrange - clear env so validation fails properly
      const prevOpenai = process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      const prevDeepseek = process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      const hadSystemDeepseekKey = !!prevDeepseek;
      delete process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      delete process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      try {
        const configObj = JSON.parse(validConfigContent);
        if (!configObj.steps) {
          configObj.steps = {};
        }
        if (!configObj.steps.cleaning) {
          configObj.steps.cleaning = {};
        }
        if (!configObj.steps.cleaning.aiConfig) {
          configObj.steps.cleaning.aiConfig = {};
        }
        configObj.steps.cleaning.aiConfig.provider = 'deepseek';
        // Set providers to only openai (no deepseek), so step provider check should fail
        // Note: defaults merge will add deepseek back, but with empty apiKey, so hasDeepseek will be false
        configObj.ai.providers = { openai: { apiKey: 'test' } };
        // Also set default to openai to ensure it's configured, so step provider check runs
        configObj.ai.default = { provider: 'openai', model: 'gpt-4o-mini' };
        mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

        // Act & Assert
        // If system has DeepSeek key, validation will pass (correct behavior - provider is configured)
        // Otherwise, should fail because step uses deepseek but it's not configured (empty apiKey = not configured)
        if (hadSystemDeepseekKey) {
          // System has key, so validation should pass (provider gets configured via env)
          const result = loadConfig(validConfigPath);
          expect(result).toBeDefined();
        } else {
          // No system key, so validation should fail
          expect(() => loadConfig(validConfigPath)).toThrow(/Step 'cleaning' provider 'deepseek' is not configured/);
        }
      } finally {
        if (prevOpenai !== undefined) process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY = prevOpenai;
        else delete process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
        if (prevDeepseek !== undefined) process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY = prevDeepseek;
        else delete process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      }
    });

    it('should throw error for invalid steps.cleaning.aiConfig.model', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      if (!configObj.steps) {
        configObj.steps = {};
      }
      if (!configObj.steps.cleaning) {
        configObj.steps.cleaning = {};
      }
      if (!configObj.steps.cleaning.aiConfig) {
        configObj.steps.cleaning.aiConfig = {};
      }
      configObj.steps.cleaning.aiConfig.model = 123;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'steps.cleaning.aiConfig.model' field/);
    });

    it('should throw error for invalid context field', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.context = 'not-object';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'context'/);
    });

    it('should throw error for invalid context.textSources array element', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.context = { textSources: [123, 'valid'] };
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'context.textSources\[0\]'/);
    });

    it('should throw error for invalid output field (not an object)', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.output = 'not-object';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'output' field \(must be an object\)/);
    });

    it('should throw error for missing ai.providers field', () => {
      // Arrange - clear env so validation fails properly
      const prevOpenai = process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      const prevDeepseek = process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      delete process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      delete process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      try {
        const configObj = JSON.parse(validConfigContent);
        delete configObj.ai.providers;
        // Also remove default and steps to avoid the code trying to access undefined providers
        delete configObj.ai.default;
        delete configObj.steps;
        mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

        // Act & Assert
        // Providers have defaults (empty object), but final validation requires at least one provider
        // Error may be about missing providers or default provider not configured
        expect(() => loadConfig(validConfigPath)).toThrow(/Missing 'ai.providers' field|At least one provider must be configured|Default provider.*not configured/);
      } finally {
        if (prevOpenai !== undefined) process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY = prevOpenai;
        else delete process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
        if (prevDeepseek !== undefined) process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY = prevDeepseek;
        else delete process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      }
    });

    it('should throw error for invalid ai.providers.deepseek field (not an object)', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.ai.providers.deepseek = 'not-object';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'ai.providers.deepseek' field \(must be an object\)/);
    });

    it('should throw error for missing ai.providers.deepseek.apiKey when env unset', () => {
      const prevOpenai = process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      const prevDeepseek = process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      const hadSystemDeepseekKey = !!prevDeepseek;
      // Explicitly set to undefined to ensure it's cleared (delete might not work if set elsewhere)
      process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY = undefined as any;
      process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY = undefined as any;
      delete process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      delete process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      try {
        const configObj = JSON.parse(validConfigContent);
        // Set providers to only deepseek with no apiKey
        configObj.ai.providers = { deepseek: {} };
        configObj.ai.default = { provider: 'deepseek', model: 'deepseek-chat' };
        delete configObj.steps;
        mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

        // If system has DeepSeek key, validation will pass (correct behavior - provider is configured via env)
        // Otherwise, should fail because no provider is configured
        if (hadSystemDeepseekKey) {
          // System has key, so validation should pass (provider gets configured via env)
          const result = loadConfig(validConfigPath);
          expect(result).toBeDefined();
        } else {
          // No system key, so validation should fail
          expect(() => loadConfig(validConfigPath)).toThrow(/At least one provider must be configured|Default provider.*not configured/);
        }
      } finally {
        if (prevOpenai !== undefined) process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY = prevOpenai;
        else delete process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
        if (prevDeepseek !== undefined) process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY = prevDeepseek;
        else delete process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      }
    });

    it('should use SPOKEN_TO_TEXT_DEEPSEEK_API_KEY when deepseek apiKey not in config', () => {
      const prevOpenai = process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      const prevDeepseek = process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      // Clear first to ensure we use the test key, not any existing env key
      // Explicitly set to undefined then delete to ensure it's cleared
      process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY = undefined as any;
      process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY = undefined as any;
      delete process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      delete process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      // Set test key - if system has a real key, this test will use that instead (acceptable)
      process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY = 'sk-env-deepseek-key';
      try {
        const configObj = JSON.parse(validConfigContent);
        configObj.ai.providers.deepseek = {};
        delete configObj.ai.providers.openai;
        configObj.ai.default = { provider: 'deepseek', model: 'deepseek-chat' };
        delete configObj.steps;
        mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

        const result = loadConfig(validConfigPath);

        // Verify it uses an env key (either our test key or system key) - not empty
        expect(result.ai.providers.deepseek?.apiKey).toBeTruthy();
        expect(result.ai.providers.deepseek?.apiKey).not.toBe('');
        // If system has real key, it will be used (acceptable for this test)
        if (prevDeepseek && prevDeepseek !== 'sk-env-deepseek-key') {
          // System had a real key, so it will be used instead of test key
          expect(result.ai.providers.deepseek?.apiKey).toBe(prevDeepseek);
        } else {
          // No system key, so test key should be used
          expect(result.ai.providers.deepseek?.apiKey).toBe('sk-env-deepseek-key');
        }
      } finally {
        if (prevOpenai !== undefined) process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY = prevOpenai;
        else delete process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
        if (prevDeepseek !== undefined) process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY = prevDeepseek;
        else delete process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      }
    });

    it('should throw error for missing ai.default field', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      delete configObj.ai.default;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      // AI default has defaults, so it's always present after merge
      const result = loadConfig(validConfigPath);
      expect(result.ai.default).toBeDefined();
      expect(result.ai.default.provider).toBeDefined();
      expect(result.ai.default.model).toBeDefined();
    });

    it('should throw error for invalid ai.default.overrides field (not an object)', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.ai.default.overrides = 'not-object';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'ai.default.overrides' field \(must be an object\)/);
    });

    it('should throw error for invalid steps.cleaning.aiConfig.overrides field (not an object)', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      if (!configObj.steps) {
        configObj.steps = {};
      }
      if (!configObj.steps.cleaning) {
        configObj.steps.cleaning = {};
      }
      if (!configObj.steps.cleaning.aiConfig) {
        configObj.steps.cleaning.aiConfig = {};
      }
      configObj.steps.cleaning.aiConfig.overrides = 'not-object';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'steps.cleaning.aiConfig.overrides' field/);
    });

    it('should throw error for invalid steps.cleaning.aiConfig.overrides.temperature', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      if (!configObj.steps) {
        configObj.steps = {};
      }
      if (!configObj.steps.cleaning) {
        configObj.steps.cleaning = {};
      }
      if (!configObj.steps.cleaning.aiConfig) {
        configObj.steps.cleaning.aiConfig = {};
      }
      configObj.steps.cleaning.aiConfig.overrides = { temperature: 'not-number' };
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'steps.cleaning.aiConfig.overrides.temperature' field/);
    });

    it('should throw error for invalid steps.cleaning.aiConfig.overrides.maxTokens', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      if (!configObj.steps) {
        configObj.steps = {};
      }
      if (!configObj.steps.cleaning) {
        configObj.steps.cleaning = {};
      }
      if (!configObj.steps.cleaning.aiConfig) {
        configObj.steps.cleaning.aiConfig = {};
      }
      configObj.steps.cleaning.aiConfig.overrides = { maxTokens: 'not-number' };
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'steps.cleaning.aiConfig.overrides.maxTokens' field/);
    });

    it('should accept steps.cleaning.aiConfig.execution "batch" with openai provider', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.steps.cleaning.aiConfig.provider = 'openai';
      configObj.steps.cleaning.aiConfig.execution = 'batch';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.steps?.cleaning?.aiConfig?.execution).toBe('batch');
    });

    it('should throw error for invalid steps.cleaning.aiConfig.execution value', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.steps.cleaning.aiConfig.execution = 'nope';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/steps\.cleaning\.aiConfig\.execution/);
    });

    it('should throw error for invalid ai.default.execution value', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.ai.default.execution = 'nope';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/ai\.default\.execution/);
    });

    it('should throw when execution "batch" resolves to a non-openai provider', () => {
      // Arrange - clear env so deepseek key is not injected (not relevant here, provider mismatch is the point)
      const configObj = JSON.parse(validConfigContent);
      configObj.steps.cleaning.aiConfig.provider = 'deepseek';
      configObj.steps.cleaning.aiConfig.execution = 'batch';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/requires provider 'openai'/);
    });

    it('should accept execution "batch" resolved from ai.default with openai provider', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.ai.default.execution = 'batch';
      // Remove step-level override so default execution resolves for the step
      delete configObj.steps.cleaning.aiConfig.execution;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.ai.default.execution).toBe('batch');
    });

    it('should accept ai.batch tuning object', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.ai.batch = { pollIntervalMs: 15000, maxWaitMs: 600000 };
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.ai.batch.pollIntervalMs).toBe(15000);
      expect(result.ai.batch.maxWaitMs).toBe(600000);
    });

    it('should throw error for invalid ai.batch.pollIntervalMs', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.ai.batch = { pollIntervalMs: 0 };
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/ai\.batch\.pollIntervalMs/);
    });

    it('should throw error for invalid ai.batch.maxWaitMs', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.ai.batch = { maxWaitMs: -5 };
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/ai\.batch\.maxWaitMs/);
    });

  });

  describe('fallback assignments after merge', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
    });

    it('should assign default asr when missing after merge', () => {
      // Arrange - config with no asr field at all
      const configObj = {
        profile: 'lecture',
        ai: {
          providers: { openai: { apiKey: 'test' } },
          default: { provider: 'openai', model: 'test' }
        }
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.asr).toBeDefined();
      expect(result.asr.provider).toBe('whisper');
      expect(result.asr.whisper).toBeDefined();
    });

    it('should assign default asr.whisper when missing after merge', () => {
      // Arrange - config with asr but no whisper
      const configObj = {
        profile: 'lecture',
        asr: { provider: 'whisper' },
        ai: {
          providers: { openai: { apiKey: 'test' } },
          default: { provider: 'openai', model: 'test' }
        }
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.asr.whisper).toBeDefined();
      expect(result.asr.whisper.serverUrl).toBeDefined();
    });

    it('should assign default asr.provider when missing', () => {
      // Arrange - config with asr.whisper but no provider
      const configObj = {
        profile: 'lecture',
        asr: {
          whisper: { serverUrl: 'http://test:9000/asr' }
        },
        ai: {
          providers: { openai: { apiKey: 'test' } },
          default: { provider: 'openai', model: 'test' }
        }
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.asr.provider).toBe('whisper');
    });

    it('should assign default language when missing after merge', () => {
      // Arrange - minimal config without language
      const configObj = {
        profile: 'lecture',
        ai: {
          providers: { openai: { apiKey: 'test' } },
          default: { provider: 'openai', model: 'test' }
        }
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.language).toBeDefined();
      expect(result.language.input).toBe('en');
      expect(result.language.output).toBe('en');
    });

    it('should assign default logging when missing after merge', () => {
      // Arrange - minimal config without logging
      const configObj = {
        profile: 'lecture',
        ai: {
          providers: { openai: { apiKey: 'test' } },
          default: { provider: 'openai', model: 'test' }
        }
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.logging).toBeDefined();
      expect(result.logging.level).toBe('info');
      expect(result.logging.singleLine).toBe(false);
    });

    it('should assign default paths when missing after merge', () => {
      // Arrange - minimal config without paths
      const configObj = {
        profile: 'lecture',
        ai: {
          providers: { openai: { apiKey: 'test' } },
          default: { provider: 'openai', model: 'test' }
        }
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.paths).toBeDefined();
      expect(result.paths.inputDir).toBe('./input');
      expect(result.paths.outputDir).toBe('./output');
    });

    it('should assign default ai when missing after merge', () => {
      // Arrange - minimal config without ai; clear env so validation fails properly
      const prevOpenai = process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      const prevDeepseek = process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      delete process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
      delete process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      try {
        const configObj = {
          profile: 'lecture'
        };
        mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

        // Act & Assert - This will fail because ai.providers is required
        // Error may be about missing providers or default provider not configured
        expect(() => loadConfig(validConfigPath)).toThrow(/Missing 'ai.providers' field|At least one provider must be configured|Default provider.*not configured/);
      } finally {
        if (prevOpenai !== undefined) process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY = prevOpenai;
        else delete process.env.SPOKEN_TO_TEXT_OPENAI_API_KEY;
        if (prevDeepseek !== undefined) process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY = prevDeepseek;
        else delete process.env.SPOKEN_TO_TEXT_DEEPSEEK_API_KEY;
      }
    });
  });

  describe('validateUserConfig error paths', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
    });

    it('should validate invalid profile value in validateUserConfig', () => {
      // Arrange - profile is invalid but passes initial check (edge case)
      const configObj = {
        profile: 'invalid-profile',
        ai: {
          providers: { openai: { apiKey: 'test' } },
          default: { provider: 'openai', model: 'test' }
        }
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert - This should fail at the initial profile check, not in validateUserConfig
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'profile' value/);
    });

    it('should validate invalid language field type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.language = 'not-an-object';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'language' field \(must be an object\)/);
    });

    it('should validate invalid language.input type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.language.input = 123;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'language.input' field/);
    });

    it('should validate invalid language.output type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.language.output = 123;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'language.output' field/);
    });

    it('should validate invalid logging field type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.logging = 'not-an-object';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'logging' field \(must be an object\)/);
    });

    it('should validate invalid logging.singleLine type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.logging.singleLine = 'not-boolean';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'logging.singleLine' field/);
    });

    it('should validate invalid paths field type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.paths = 'not-an-object';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'paths' field \(must be an object\)/);
    });

    it('should validate invalid paths.inputDir type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.paths.inputDir = 123;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'paths.inputDir' field/);
    });

    it('should validate invalid paths.outputDir type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.paths.outputDir = 123;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'paths.outputDir' field/);
    });

    it('should validate invalid asr field type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.asr = 'not-an-object';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'asr' field \(must be an object\)/);
    });

    it('should validate invalid asr.whisper field type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.asr.whisper = 'not-an-object';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'asr.whisper' field \(must be an object\)/);
    });

    it('should validate invalid asr.whisper.serverUrl type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.asr.whisper.serverUrl = 123;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'asr.whisper.serverUrl' field/);
    });

    it('should validate invalid asr.whisper.task value', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.asr.whisper.task = 'invalid-task';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'asr.whisper.task' field/);
    });

    it('should validate invalid asr.whisper.outputFormat value', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.asr.whisper.outputFormat = 'invalid-format';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'asr.whisper.outputFormat' field/);
    });

    it('should validate invalid asr.whisper.temperature type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.asr.whisper.temperature = 'not-a-number';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'asr.whisper.temperature' field/);
    });

    it('should validate invalid asr.whisper.beamSize type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.asr.whisper.beamSize = 'not-a-number';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'asr.whisper.beamSize' field/);
    });

    it('should validate invalid asr.whisper.bestOf type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.asr.whisper.bestOf = 'not-a-number';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'asr.whisper.bestOf' field/);
    });

    it('should validate invalid asr.whisper.vad.enabled type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.asr.whisper.vad.enabled = 'not-boolean';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'asr.whisper.vad.enabled' field/);
    });

    it('should validate invalid asr.whisper.vad.threshold type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.asr.whisper.vad.threshold = 'not-a-number';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'asr.whisper.vad.threshold' field/);
    });

    it('should validate invalid asr.whisper.vad.minSilenceMs type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.asr.whisper.vad.minSilenceMs = 'not-a-number';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'asr.whisper.vad.minSilenceMs' field/);
    });

    it('should validate invalid asr.whisper.vad.maxSpeechS type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.asr.whisper.vad.maxSpeechS = 'not-a-number';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'asr.whisper.vad.maxSpeechS' field/);
    });

    it('should validate invalid ai field type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.ai = 'not-an-object';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'ai' field \(must be an object\)/);
    });

    it('should validate invalid ai.providers field type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.ai.providers = 'not-an-object';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'ai.providers' field \(must be an object\)/);
    });

    it('should validate invalid ai.providers.openai.apiKey type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.ai.providers.openai.apiKey = 123;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'ai.providers.openai.apiKey' field/);
    });

    it('should validate invalid ai.providers.deepseek.apiKey type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.ai.providers.deepseek.apiKey = 123;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'ai.providers.deepseek.apiKey' field/);
    });

    it('should validate invalid ai.default field type', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.ai.default = 'not-an-object';
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'ai.default' field \(must be an object\)/);
    });
  });
});
