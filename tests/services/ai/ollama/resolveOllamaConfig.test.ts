import { describe, it, expect } from '@jest/globals';
import { resolveOllamaConfig } from '../../../../src/services/ai/ollama/resolveOllamaConfig.js';
import type { PipelineConfig, StepAiConfig } from '../../../../src/config/config.types.js';

describe('resolveOllamaConfig', () => {
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
        ollama: {},
      },
      default: {
        provider: 'ollama',
        model: 'llama3.1:8b',
      },
    },
  });

  const createStepConfig = (): StepAiConfig => ({
    provider: 'ollama',
    model: 'llama3.1:8b',
  });

  it('should resolve config for cleaning step', () => {
    // Arrange
    const config = createMockConfig();
    const stepConfig = createStepConfig();

    // Act
    const result = resolveOllamaConfig(config, 'cleaning', stepConfig);

    // Assert
    expect(result.systemPrompt).toBeDefined();
    expect(result.systemPrompt).toContain('it'); // Language instruction
    expect(result.temperature).toBeDefined();
  });

  it('should resolve config for handout step', () => {
    // Arrange
    const config = createMockConfig();
    const stepConfig = createStepConfig();

    // Act
    const result = resolveOllamaConfig(config, 'handout', stepConfig);

    // Assert - handout returns HandoutAiGenerateOptions with string systemPrompt
    expect(result.systemPrompt).toBeDefined();
    expect(typeof result.systemPrompt).toBe('string');
    expect(result.systemPrompt).toContain('it'); // Language instruction
  });

  it('should resolve config for summary step', () => {
    // Arrange
    const config = createMockConfig();
    const stepConfig = createStepConfig();

    // Act
    const result = resolveOllamaConfig(config, 'summary', stepConfig);

    // Assert
    expect(result.systemPrompt).toBeDefined();
    expect(result.systemPrompt).toContain('it'); // Language instruction
  });

  it('should apply preset overrides', () => {
    // Arrange
    const config = createMockConfig();
    const stepConfig = createStepConfig();

    // Act
    const result = resolveOllamaConfig(config, 'cleaning', stepConfig);

    // Assert
    expect(result.temperature).toBe(0); // From preset
  });

  it('should apply step-specific overrides', () => {
    // Arrange
    const config = createMockConfig();
    const stepConfig: StepAiConfig = {
      provider: 'ollama',
      model: 'llama3.1:8b',
      overrides: {
        temperature: 0.7,
        maxTokens: 2000,
      },
    };

    // Act
    const result = resolveOllamaConfig(config, 'cleaning', stepConfig);

    // Assert
    expect(result.temperature).toBe(0.7);
    expect(result.maxTokens).toBe(2000);
  });

  it('should throw error for non-Ollama provider', () => {
    // Arrange
    const config = createMockConfig();
    const stepConfig: StepAiConfig = {
      provider: 'openai',
      model: 'gpt-4o-mini',
    };

    // Act & Assert
    expect(() => resolveOllamaConfig(config, 'cleaning', stepConfig)).toThrow(
      /AI provider is not Ollama/
    );
  });

  it('should use steps.handout.prompt when set', () => {
    // Arrange
    const config = createMockConfig();
    config.steps = {
      handout: { prompt: 'Custom handout prompt' },
    };
    const stepConfig = createStepConfig();

    // Act
    const result = resolveOllamaConfig(config, 'handout', stepConfig);

    // Assert
    expect(result.systemPrompt).toContain('Custom handout prompt');
    expect(result.systemPrompt).toContain('it');
  });

  it('should use steps.cleaning.prompt when set', () => {
    // Arrange
    const config = createMockConfig();
    config.steps = {
      cleaning: { prompt: 'Custom Ollama cleaning prompt' },
    };
    const stepConfig = createStepConfig();

    // Act
    const result = resolveOllamaConfig(config, 'cleaning', stepConfig);

    // Assert
    expect(result.systemPrompt).toContain('Custom Ollama cleaning prompt');
    expect(result.systemPrompt).toContain('it'); // Language instruction
  });
});
