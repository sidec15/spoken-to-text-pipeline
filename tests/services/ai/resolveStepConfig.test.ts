import { describe, it, expect } from '@jest/globals';
import { resolveStepConfig } from '../../../src/services/ai/aiServiceFactory.js';
import type { PipelineConfig } from '../../../src/config/config.types.js';

describe('resolveStepConfig', () => {
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
        openai: { apiKey: 'sk-test' },
        deepseek: { apiKey: 'sk-deepseek-test' },
      },
      default: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        overrides: { temperature: 0.5 },
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

  it('should merge default with step override', () => {
    // Arrange
    const config = createMockConfig();
    config.ai.steps = {
      cleaning: {
        provider: 'deepseek',
        model: 'deepseek-chat',
        overrides: { temperature: 0.7 },
      },
    };

    // Act
    const result = resolveStepConfig(config, 'cleaning');

    // Assert
    expect(result.provider).toBe('deepseek');
    expect(result.model).toBe('deepseek-chat');
    expect(result.overrides?.temperature).toBe(0.7);
  });

  it('should use default when step override missing', () => {
    // Arrange
    const config = createMockConfig();

    // Act
    const result = resolveStepConfig(config, 'cleaning');

    // Assert
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4o-mini');
    expect(result.overrides?.temperature).toBe(0.5);
  });

  it('should override provider', () => {
    // Arrange
    const config = createMockConfig();
    config.ai.steps = {
      cleaning: { provider: 'deepseek' },
    };

    // Act
    const result = resolveStepConfig(config, 'cleaning');

    // Assert
    expect(result.provider).toBe('deepseek');
    expect(result.model).toBe('gpt-4o-mini'); // Uses default model
  });

  it('should override model', () => {
    // Arrange
    const config = createMockConfig();
    config.ai.steps = {
      cleaning: { model: 'gpt-4' },
    };

    // Act
    const result = resolveStepConfig(config, 'cleaning');

    // Assert
    expect(result.provider).toBe('openai'); // Uses default provider
    expect(result.model).toBe('gpt-4');
  });

  it('should merge overrides object', () => {
    // Arrange
    const config = createMockConfig();
    config.ai.default.overrides = { temperature: 0.5, maxTokens: 1000 };
    config.ai.steps = {
      cleaning: {
        overrides: { temperature: 0.7 },
      },
    };

    // Act
    const result = resolveStepConfig(config, 'cleaning');

    // Assert
    expect(result.overrides?.temperature).toBe(0.7); // Step override takes precedence
    expect(result.overrides?.maxTokens).toBe(1000); // Default override preserved
  });
});
