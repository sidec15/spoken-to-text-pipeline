import { describe, it, expect } from '@jest/globals';
import { resolveOpenAiConfig } from '../../../../src/services/ai/openai/resolveOpenAiConfig.js';
import type { PipelineConfig, StepAiConfig } from '../../../../src/config/config.types.js';

describe('resolveOpenAiConfig', () => {
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

  const createStepConfig = (): StepAiConfig => ({
    provider: 'openai',
    model: 'gpt-4o-mini',
  });

  it('should resolve config for cleaning step', () => {
    // Arrange
    const config = createMockConfig();
    const stepConfig = createStepConfig();

    // Act
    const result = resolveOpenAiConfig(config, 'cleaning', stepConfig);

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
    const result = resolveOpenAiConfig(config, 'handout', stepConfig);

    // Assert
    expect(result.systemPrompt).toBeDefined();
    expect(result.systemPrompt).toContain('it'); // Language instruction
  });

  it('should resolve config for summary step', () => {
    // Arrange
    const config = createMockConfig();
    const stepConfig = createStepConfig();

    // Act
    const result = resolveOpenAiConfig(config, 'summary', stepConfig);

    // Assert
    expect(result.systemPrompt).toBeDefined();
    expect(result.systemPrompt).toContain('it'); // Language instruction
  });

  it('should apply preset overrides', () => {
    // Arrange
    const config = createMockConfig();
    const stepConfig = createStepConfig();

    // Act
    const result = resolveOpenAiConfig(config, 'cleaning', stepConfig);

    // Assert
    expect(result.temperature).toBe(0); // From preset
  });

  it('should apply step-specific overrides', () => {
    // Arrange
    const config = createMockConfig();
    const stepConfig: StepAiConfig = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      overrides: {
        temperature: 0.7,
        maxTokens: 2000,
      },
    };

    // Act
    const result = resolveOpenAiConfig(config, 'cleaning', stepConfig);

    // Assert
    expect(result.temperature).toBe(0.7);
    expect(result.maxTokens).toBe(2000);
  });

  it('should throw error for non-OpenAI provider', () => {
    // Arrange
    const config = createMockConfig();
    const stepConfig: StepAiConfig = {
      provider: 'deepseek',
      model: 'deepseek-chat',
    };

    // Act & Assert
    expect(() => resolveOpenAiConfig(config, 'cleaning', stepConfig)).toThrow(
      /AI provider is not OpenAI/
    );
  });

});
