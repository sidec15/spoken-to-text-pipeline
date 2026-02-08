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

  it('should default to English when language.input is undefined', () => {
    // Arrange
    const config = createMockConfig();
    config.language = { output: 'it' };

    // Act
    const result = resolveWhisperConfig(config);

    // Assert
    expect(result.options.language).toBe('English');
  });

  it('should default to English when language is undefined', () => {
    // Arrange
    const config = createMockConfig();
    delete config.language;

    // Act
    const result = resolveWhisperConfig(config);

    // Assert
    expect(result.options.language).toBe('English');
  });

  it('should resolve config for meeting profile', () => {
    // Arrange
    const config = createMockConfig();
    config.profile = 'meeting';

    // Act
    const result = resolveWhisperConfig(config);

    // Assert
    expect(result.serverUrl).toBe('http://localhost:9000/asr');
    expect(result.options.temperature).toBe(0.2); // meeting preset
    expect(result.options.beamSize).toBe(3); // meeting preset
    expect(result.options.bestOf).toBe(3); // meeting preset
  });

  it('should resolve config for other profile', () => {
    // Arrange
    const config = createMockConfig();
    config.profile = 'other';

    // Act
    const result = resolveWhisperConfig(config);

    // Assert
    expect(result.serverUrl).toBe('http://localhost:9000/asr');
    expect(result.options.temperature).toBe(0); // other preset
    expect(result.options.beamSize).toBe(5); // other preset
    expect(result.options.bestOf).toBe(5); // other preset
  });

  it('should handle when config.asr.whisper is undefined', () => {
    // Arrange
    const config = createMockConfig();
    config.asr.whisper = undefined;

    // Act & Assert
    expect(() => resolveWhisperConfig(config)).toThrow(
      /Whisper server URL is not set/
    );
  });

  it('should handle when config.asr is undefined', () => {
    // Arrange
    const config = createMockConfig();
    delete config.asr;

    // Act & Assert
    expect(() => resolveWhisperConfig(config)).toThrow(
      /Whisper server URL is not set/
    );
  });

  it('should throw error when serverUrl is empty string', () => {
    // Arrange
    const config = createMockConfig();
    config.asr.whisper.serverUrl = '';

    // Act & Assert
    expect(() => resolveWhisperConfig(config)).toThrow(
      /Whisper server URL is not set/
    );
  });

  it('should throw error when serverUrl is undefined', () => {
    // Arrange
    const config = createMockConfig();
    delete config.asr.whisper.serverUrl;

    // Act & Assert
    expect(() => resolveWhisperConfig(config)).toThrow(
      /Whisper server URL is not set/
    );
  });

  it('should throw error for invalid profile', () => {
    // Arrange
    const config = createMockConfig();
    config.profile = 'invalid-profile' as any;

    // Act & Assert
    expect(() => resolveWhisperConfig(config)).toThrow(
      /No Whisper preset defined for profile 'invalid-profile'/
    );
  });

  it('should merge preset with overrides correctly', () => {
    // Arrange
    const config = createMockConfig();
    config.asr.whisper.temperature = 0.5;
    config.asr.whisper.task = 'translate';
    config.asr.whisper.outputFormat = 'json';

    // Act
    const result = resolveWhisperConfig(config);

    // Assert
    expect(result.options.temperature).toBe(0.5); // override
    expect(result.options.task).toBe('translate'); // override
    expect(result.options.outputFormat).toBe('json'); // override
    expect(result.options.beamSize).toBe(5); // from preset
    expect(result.options.bestOf).toBe(5); // from preset
  });

  it('should preserve VAD settings from preset when not overridden', () => {
    // Arrange
    const config = createMockConfig();

    // Act
    const result = resolveWhisperConfig(config);

    // Assert
    expect(result.options.vad).toBeDefined();
    expect(result.options.vad?.enabled).toBe(true);
    expect(result.options.vad?.threshold).toBe(0.45); // lecture preset
    expect(result.options.vad?.minSilenceMs).toBe(700); // lecture preset
    expect(result.options.vad?.maxSpeechS).toBe(60); // lecture preset
  });

  it('should override VAD settings partially', () => {
    // Arrange
    const config = createMockConfig();
    config.asr.whisper.vad = {
      enabled: true,
      threshold: 0.7,
    };

    // Act
    const result = resolveWhisperConfig(config);

    // Assert
    expect(result.options.vad?.enabled).toBe(true);
    expect(result.options.vad?.threshold).toBe(0.7); // override
    // Note: Partial VAD override replaces entire vad object (shallow merge)
    expect(result.options.vad?.minSilenceMs).toBeUndefined();
    expect(result.options.vad?.maxSpeechS).toBeUndefined();
  });
});
