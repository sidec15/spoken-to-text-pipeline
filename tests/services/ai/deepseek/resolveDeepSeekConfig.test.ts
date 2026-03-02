import { describe, it, expect } from '@jest/globals';
import { resolveDeepSeekConfig } from '../../../../src/services/ai/deepseek/resolveDeepSeekConfig.js';
import type { PipelineConfig, StepAiConfig } from '../../../../src/config/config.types.js';

describe('resolveDeepSeekConfig', () => {
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
        deepseek: { apiKey: 'sk-test' },
      },
      default: {
        provider: 'deepseek',
        model: 'deepseek-chat',
      },
    },
  });

  const createStepConfig = (): StepAiConfig => ({
    provider: 'deepseek',
    model: 'deepseek-chat',
  });

  it('should resolve config for cleaning step', () => {
    // Arrange
    const config = createMockConfig();
    const stepConfig = createStepConfig();

    // Act
    const result = resolveDeepSeekConfig(config, 'cleaning', stepConfig);

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
    const result = resolveDeepSeekConfig(config, 'handout', stepConfig);
    const systemPrompt = result.systemPrompt as { singlePass: string; incremental: string };

    // Assert - handout returns HandoutAiGenerateOptions with dual prompts
    expect(systemPrompt).toBeDefined();
    expect(systemPrompt).toHaveProperty('singlePass');
    expect(systemPrompt).toHaveProperty('incremental');
    expect(typeof systemPrompt.singlePass).toBe('string');
    expect(typeof systemPrompt.incremental).toBe('string');
    expect(systemPrompt.singlePass).toContain('it'); // Language instruction
    expect(systemPrompt.incremental).toContain('it'); // Language instruction
  });

  it('should resolve config for summary step', () => {
    // Arrange
    const config = createMockConfig();
    const stepConfig = createStepConfig();

    // Act
    const result = resolveDeepSeekConfig(config, 'summary', stepConfig);

    // Assert
    expect(result.systemPrompt).toBeDefined();
    expect(result.systemPrompt).toContain('it'); // Language instruction
  });

  it('should apply preset overrides', () => {
    // Arrange
    const config = createMockConfig();
    const stepConfig = createStepConfig();

    // Act
    const result = resolveDeepSeekConfig(config, 'cleaning', stepConfig);

    // Assert
    expect(result.temperature).toBe(0); // From preset
  });

  it('should apply step-specific overrides', () => {
    // Arrange
    const config = createMockConfig();
    const stepConfig: StepAiConfig = {
      provider: 'deepseek',
      model: 'deepseek-chat',
      overrides: {
        temperature: 0.7,
        maxTokens: 2000,
      },
    };

    // Act
    const result = resolveDeepSeekConfig(config, 'cleaning', stepConfig);

    // Assert
    expect(result.temperature).toBe(0.7);
    expect(result.maxTokens).toBe(2000);
  });

  it('should throw error for non-DeepSeek provider', () => {
    // Arrange
    const config = createMockConfig();
    const stepConfig: StepAiConfig = {
      provider: 'openai',
      model: 'gpt-4o-mini',
    };

    // Act & Assert
    expect(() => resolveDeepSeekConfig(config, 'cleaning', stepConfig)).toThrow(
      /AI provider is not DeepSeek/
    );
  });

  it('should use steps.cleaning.prompt when set', () => {
    // Arrange
    const config = createMockConfig();
    config.steps = {
      cleaning: { prompt: 'Custom DeepSeek cleaning prompt' },
    };
    const stepConfig = createStepConfig();

    // Act
    const result = resolveDeepSeekConfig(config, 'cleaning', stepConfig);

    // Assert
    expect(result.systemPrompt).toContain('Custom DeepSeek cleaning prompt');
    expect(result.systemPrompt).toContain('it'); // Language instruction
  });
});
