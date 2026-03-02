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

  it('should use steps.cleaning.prompt when set', () => {
    // Arrange
    const config = createMockConfig();
    config.steps = {
      cleaning: { prompt: 'Custom cleaning prompt' },
    };
    const stepConfig = createStepConfig();

    // Act
    const result = resolveOpenAiConfig(config, 'cleaning', stepConfig);

    // Assert
    expect(result.systemPrompt).toContain('Custom cleaning prompt');
    expect(result.systemPrompt).toContain('it'); // Language instruction
  });

  it('should use steps.handout.singlePass.prompt when set', () => {
    // Arrange
    const config = createMockConfig();
    config.steps = {
      handout: {
        strategy: 'single-pass',
        singlePass: { prompt: 'Custom single-pass handout prompt' },
      },
    };
    const stepConfig = createStepConfig();

    // Act
    const result = resolveOpenAiConfig(config, 'handout', stepConfig);
    const systemPrompt = result.systemPrompt as { singlePass: string; incremental: string };

    // Assert
    expect(systemPrompt.singlePass).toContain('Custom single-pass handout prompt');
    expect(systemPrompt.singlePass).toContain('it'); // Language instruction
    expect(systemPrompt.incremental).not.toContain('Custom single-pass handout prompt');
  });

  it('should use steps.handout.incremental.prompt when set', () => {
    // Arrange
    const config = createMockConfig();
    config.steps = {
      handout: {
        strategy: 'incremental',
        incremental: { prompt: 'Custom incremental handout prompt' },
      },
    };
    const stepConfig = createStepConfig();

    // Act
    const result = resolveOpenAiConfig(config, 'handout', stepConfig);
    const systemPrompt = result.systemPrompt as { singlePass: string; incremental: string };

    // Assert
    expect(systemPrompt.incremental).toContain('Custom incremental handout prompt');
    expect(systemPrompt.incremental).toContain('it'); // Language instruction
    expect(systemPrompt.singlePass).not.toContain('Custom incremental handout prompt');
  });

  it('should prefer steps.cleaning.prompt over promptFile when both set', () => {
    // Arrange
    const config = createMockConfig();
    config.steps = {
      cleaning: {
        prompt: 'Inline prompt wins',
        promptFile: './prompts/cleaning.md',
      },
    };
    const stepConfig = createStepConfig();

    // Act
    const result = resolveOpenAiConfig(config, 'cleaning', stepConfig);

    // Assert (inline prompt used; promptFile not loaded)
    expect(result.systemPrompt).toContain('Inline prompt wins');
  });

});
