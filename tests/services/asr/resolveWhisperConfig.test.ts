import { describe, it, expect } from '@jest/globals';
import { resolveWhisperConfig } from '../../../src/services/asr/resolveWhisperConfig.js';
import type { PipelineConfig } from '../../../src/config/config.types.js';

describe('resolveWhisperConfig', () => {
  const createMockConfig = (): PipelineConfig => ({
    profile: 'lecture',
    language: { input: 'it', output: 'it' },
    logging: { level: 'info', singleLine: true },
    paths: { inputDir: './input', outputDir: './output' },
    asr: {
      provider: 'whisper',
      whisper: {
        serverUrl: 'http://localhost:9000/asr',
      },
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

  it('should resolve config with defaults', () => {
    // Arrange
    const config = createMockConfig();

    // Act
    const result = resolveWhisperConfig(config);

    // Assert
    expect(result.serverUrl).toBe('http://localhost:9000/asr');
    expect(result.options.language).toBe('it');
    expect(result.options).toBeDefined();
  });

  it('should resolve config with VAD enabled', () => {
    // Arrange
    const config = createMockConfig();
    config.asr.whisper.vad = {
      enabled: true,
      threshold: 0.5,
      minSilenceMs: 500,
      maxSpeechS: 30,
    };

    // Act
    const result = resolveWhisperConfig(config);

    // Assert
    expect(result.options.vad?.enabled).toBe(true);
    expect(result.options.vad?.threshold).toBe(0.5);
  });

  it('should resolve config with VAD disabled', () => {
    // Arrange
    const config = createMockConfig();
    config.asr.whisper.vad = {
      enabled: false,
    };

    // Act
    const result = resolveWhisperConfig(config);

    // Assert
    expect(result.options.vad?.enabled).toBe(false);
  });

  it('should apply preset overrides', () => {
    // Arrange
    const config = createMockConfig();
    config.asr.whisper.temperature = 0.3;
    config.asr.whisper.beamSize = 5;

    // Act
    const result = resolveWhisperConfig(config);

    // Assert
    expect(result.options.temperature).toBe(0.3);
    expect(result.options.beamSize).toBe(5);
  });

  it('should use language from config', () => {
    // Arrange
    const config = createMockConfig();
    config.language.input = 'en';

    // Act
    const result = resolveWhisperConfig(config);

    // Assert
    expect(result.options.language).toBe('en');
  });
});
