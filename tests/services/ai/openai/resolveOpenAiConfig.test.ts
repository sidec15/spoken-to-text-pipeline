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

  it('should include metadata block in handout prompts when title, authors, or date are set', () => {
    // Arrange
    const config = createMockConfig();
    config.title = 'Post-razionalismo';
    config.authors = ['Prof. Giovanni Turella'];
    config.date = '07 febbraio 2026';
    const stepConfig = createStepConfig();

    // Act
    const result = resolveOpenAiConfig(config, 'handout', stepConfig);
    const systemPrompt = result.systemPrompt as { singlePass: string; incremental: string };

    // Assert - metadata block present in both prompts
    expect(systemPrompt.singlePass).toContain('METADATA');
    expect(systemPrompt.singlePass).toContain('Title: Post-razionalismo');
    expect(systemPrompt.singlePass).toContain('Authors: Prof. Giovanni Turella');
    expect(systemPrompt.singlePass).toContain('Date: 07 febbraio 2026');
    expect(systemPrompt.incremental).toContain('METADATA');
    expect(systemPrompt.incremental).toContain('Title: Post-razionalismo');
    expect(systemPrompt.incremental).toContain('Authors: Prof. Giovanni Turella');
    expect(systemPrompt.incremental).toContain('Date: 07 febbraio 2026');
  });

  it('should not include metadata block when title, authors, and date are absent', () => {
    // Arrange - createMockConfig has no title, authors, date
    const config = createMockConfig();
    const stepConfig = createStepConfig();

    // Act
    const result = resolveOpenAiConfig(config, 'handout', stepConfig);
    const systemPrompt = result.systemPrompt as { singlePass: string; incremental: string };

    // Assert
    expect(systemPrompt.singlePass).not.toContain('METADATA (use these values exactly)');
    expect(systemPrompt.incremental).not.toContain('METADATA (use these values exactly)');
  });

  it('should include Italian localized handout label when language.output is it', () => {
    // Arrange - Italian output
    const config = createMockConfig();
    config.title = 'Repertorio dell\'Aggressività';
    config.authors = ['Prof. Ligozzi'];
    config.date = '07 febbraio 2026';
    config.language = { input: 'it', output: 'it' };
    const stepConfig = createStepConfig();

    // Act
    const result = resolveOpenAiConfig(config, 'handout', stepConfig);
    const systemPrompt = result.systemPrompt as { singlePass: string; incremental: string };

    // Assert - Italian localized label for handout
    expect(systemPrompt.singlePass).toContain('***Dispense della lezione***');
    expect(systemPrompt.incremental).toContain('***Dispense della lezione***');
  });

  it('should include metadata block in summary prompt when title, authors, or date are set', () => {
    // Arrange
    const config = createMockConfig();
    config.title = 'Repertorio dell\'Aggressività';
    config.authors = ['Prof. Ligozzi'];
    config.date = '07 febbraio 2026';
    config.language = { input: 'it', output: 'it' };
    const stepConfig = createStepConfig();

    // Act
    const result = resolveOpenAiConfig(config, 'summary', stepConfig);

    // Assert - metadata block present with Italian localized summary label
    expect(result.systemPrompt).toContain('METADATA (use these values exactly)');
    expect(result.systemPrompt).toContain('Title: Repertorio dell\'Aggressività');
    expect(result.systemPrompt).toContain('Authors: Prof. Ligozzi');
    expect(result.systemPrompt).toContain('Date: 07 febbraio 2026');
    expect(result.systemPrompt).toContain('***Riassunto della lezione***');
  });

  it('should not include metadata block in summary when title, authors, and date are absent', () => {
    // Arrange
    const config = createMockConfig();
    const stepConfig = createStepConfig();

    // Act
    const result = resolveOpenAiConfig(config, 'summary', stepConfig);

    // Assert
    expect(result.systemPrompt).not.toContain('METADATA (use these values exactly)');
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
