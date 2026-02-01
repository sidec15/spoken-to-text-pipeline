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
    },
    "steps": {
      "cleaning": {
        "provider": "openai",
        "model": "gpt-4o-mini"
      }
    }
  },
  "profiles": {
    "lecture": {
      "prompts": {
        "cleaning": "Clean lecture transcript",
        "handout": "Create handout from cleaned transcript",
        "summary": "Create summary from handout"
      }
    },
    "meeting": {
      "prompts": {
        "cleaning": "Clean meeting transcript",
        "summary": "Create meeting summary"
      }
    },
    "other": {
      "prompts": {
        "cleaning": "Clean transcript",
        "summary": "Create summary"
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
      expect(result.profiles).toBeDefined();
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
      const invalidConfig = { profile: 'lecture' };
      mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Missing or invalid 'language'/);
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
      expect(() => loadConfig(validConfigPath)).toThrow(/Missing or invalid 'logging.level'/);
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
      expect(() => loadConfig(validConfigPath)).toThrow(/Missing or invalid 'paths'/);
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
      expect(() => loadConfig(validConfigPath)).toThrow(/Missing or invalid 'asr.provider'/);
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
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.ai.providers = {};
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/At least one provider must be configured/);
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
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      configObj.ai.default.provider = 'openai';
      configObj.ai.providers = { deepseek: { apiKey: 'test' } };
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Default provider 'openai' is not configured/);
    });

    it('should validate AI step overrides', () => {
      // Arrange
      mockReadFileSync.mockReturnValue(validConfigContent);

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.ai.steps?.cleaning).toBeDefined();
      expect(result.ai.steps?.cleaning?.provider).toBe('openai');
    });

    it('should validate profiles structure', () => {
      // Arrange
      mockReadFileSync.mockReturnValue(validConfigContent);

      // Act
      const result = loadConfig(validConfigPath);

      // Assert
      expect(result.profiles.lecture.prompts.cleaning).toBeDefined();
      expect(result.profiles.lecture.prompts.handout).toBeDefined();
      expect(result.profiles.lecture.prompts.summary).toBeDefined();
      expect(result.profiles.meeting.prompts.cleaning).toBeDefined();
      expect(result.profiles.meeting.prompts.summary).toBeDefined();
      expect(result.profiles.other.prompts.cleaning).toBeDefined();
      expect(result.profiles.other.prompts.summary).toBeDefined();
    });

    it('should throw error for missing profile prompts', () => {
      // Arrange
      const configObj = JSON.parse(validConfigContent);
      delete configObj.profiles.lecture.prompts.cleaning;
      mockReadFileSync.mockReturnValue(JSON.stringify(configObj));

      // Act & Assert
      expect(() => loadConfig(validConfigPath)).toThrow(/Missing or invalid 'profiles.lecture.prompts.cleaning'/);
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
      expect(() => loadConfig(validConfigPath)).toThrow(/Config validation failed/);
      expect(() => loadConfig(validConfigPath)).toThrow(/Invalid 'profile' value/);
    });
  });
});
