import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as path from 'node:path';
import { resolveOutputDir } from '../../src/utils/resolveOutputDir.js';
import type { PipelineConfig } from '../../src/config/config.types.js';

describe('resolveOutputDir', () => {
  const createMockConfig = (): PipelineConfig => ({
    profile: 'lecture',
    language: { input: 'it', output: 'it' },
    logging: { level: 'info', singleLine: true },
    paths: {
      inputDir: './input',
      outputDir: './output',
    },
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

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should resolve absolute path', () => {
    // Arrange
    const config = createMockConfig();
    config.paths.outputDir = '/absolute/path/output';

    // Act
    const result = resolveOutputDir(config);

    // Assert
    expect(path.isAbsolute(result)).toBe(true);
    expect(result).toContain('output');
  });

  it('should resolve relative path', () => {
    // Arrange
    const config = createMockConfig();
    config.paths.outputDir = './relative/output';

    // Act
    const result = resolveOutputDir(config);

    // Assert
    expect(result).toBe(path.resolve(process.cwd(), './relative/output'));
  });

  it('should resolve relative path relative to baseDir when provided', () => {
    // Arrange
    const config = createMockConfig();
    config.paths.outputDir = './relative/output';

    // Act
    const result = resolveOutputDir(config, '/custom/base');

    // Assert
    expect(result).toBe(path.resolve('/custom/base', './relative/output'));
  });

  it('should resolve absolute path even when baseDir is provided', () => {
    // Arrange
    const config = createMockConfig();
    config.paths.outputDir = '/absolute/output';

    // Act
    const result = resolveOutputDir(config, '/custom/base');

    // Assert
    expect(result).toBe('/absolute/output');
  });

  it('should add timestamp suffix when addTimestamp is true', () => {
    // Arrange
    const config = createMockConfig();
    config.output = { addTimestamp: true };
    jest.setSystemTime(new Date('2025-01-25T14:30:00Z'));

    // Act
    const result = resolveOutputDir(config);

    // Assert
    expect(result).toContain('output_20250125143000');
  });

  it('should not add timestamp suffix when addTimestamp is false', () => {
    // Arrange
    const config = createMockConfig();
    config.output = { addTimestamp: false };

    // Act
    const result = resolveOutputDir(config);

    // Assert
    expect(result).not.toMatch(/_202\d{10}$/);
  });

  it('should not add timestamp suffix when output config is missing', () => {
    // Arrange
    const config = createMockConfig();
    delete config.output;

    // Act
    const result = resolveOutputDir(config);

    // Assert
    expect(result).not.toMatch(/_202\d{10}$/);
  });

  it('should format timestamp correctly', () => {
    // Arrange
    const config = createMockConfig();
    config.output = { addTimestamp: true };
    jest.setSystemTime(new Date('2025-01-25T14:30:00.123Z'));

    // Act
    const result = resolveOutputDir(config);

    // Assert
    // Should be yyyyMMddHHmmss format (no milliseconds, no colons, no dashes)
    expect(result).toMatch(/output_20250125143000$/);
  });
});
