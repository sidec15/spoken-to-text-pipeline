import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { PipelineOptions, PipelineResult } from '../../src/types.js';
import { createMockLogger } from '../mocks/logger.mock.js';
import { createMockProgressReporter } from '../mocks/progress.mock.js';
import type { PipelineConfig } from '../../src/config/config.types.js';

// Mock PipelineRunner
const mockRun = jest.fn().mockResolvedValue(undefined);
const mockPipelineRunner = jest.fn().mockImplementation(() => ({
  run: mockRun,
}));
jest.unstable_mockModule('../../src/pipeline/pipelineRunner.js', () => ({
  PipelineRunner: mockPipelineRunner,
}));

// Mock steps
jest.unstable_mockModule('../../src/pipeline/steps/loadProfileStep.js', () => ({
  LoadProfileStep: jest.fn(),
}));
jest.unstable_mockModule('../../src/pipeline/steps/asrStep.js', () => ({
  AsrStep: jest.fn(),
}));
jest.unstable_mockModule('../../src/pipeline/steps/cleaningStep.js', () => ({
  CleaningStep: jest.fn(),
}));
jest.unstable_mockModule('../../src/pipeline/steps/handoutStep.js', () => ({
  HandoutStep: jest.fn(),
}));
jest.unstable_mockModule('../../src/pipeline/steps/summaryStep.js', () => ({
  SummaryStep: jest.fn(),
}));

describe('runPipeline', () => {
  let runPipeline: any;
  let mockConfig: PipelineConfig;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockProgress: ReturnType<typeof createMockProgressReporter>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRun.mockResolvedValue(undefined);
    const module = await import('../../src/pipeline/runPipeline.js');
    runPipeline = module.runPipeline;
    mockConfig = {
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
    };
    mockLogger = createMockLogger();
    mockProgress = createMockProgressReporter();
    mockRun.mockResolvedValue(undefined);
  });

  it('should run pipeline successfully with provided logger and progress', async () => {
    // Arrange
    const { runPipeline: runPipelineFn } = await import('../../src/pipeline/runPipeline.js');
    const options: PipelineOptions = {
      config: mockConfig,
      logger: mockLogger,
      progress: mockProgress,
    };

    // Act
    const result = await runPipelineFn(options);

    // Assert
    expect(result).toEqual({ success: true });
    expect(mockRun).toHaveBeenCalledWith({
      config: mockConfig,
      baseDir: undefined,
      outputDir: expect.any(String),
      dryRun: undefined,
      logger: mockLogger,
      progress: mockProgress,
    });
    expect(mockLogger.info).toHaveBeenCalledWith('Starting pipeline');
    expect(mockLogger.info).toHaveBeenCalledWith('Pipeline completed successfully');
  });

  it('should create default logger when not provided', async () => {
    // Arrange
    const { runPipeline: runPipelineFn } = await import('../../src/pipeline/runPipeline.js');
    const options: PipelineOptions = {
      config: mockConfig,
    };

    // Act
    const result = await runPipelineFn(options);

    // Assert
    expect(result).toEqual({ success: true });
    expect(mockRun).toHaveBeenCalled();
    const callArgs = mockRun.mock.calls[0][0];
    expect(callArgs.logger).toBeDefined();
    expect(callArgs.logger).not.toBe(mockLogger);
  });

  it('should create no-op progress reporter when not provided', async () => {
    // Arrange
    const { runPipeline: runPipelineFn } = await import('../../src/pipeline/runPipeline.js');
    const options: PipelineOptions = {
      config: mockConfig,
      logger: mockLogger,
    };

    // Act
    const result = await runPipelineFn(options);

    // Assert
    expect(result).toEqual({ success: true });
    expect(mockRun).toHaveBeenCalled();
    const callArgs = mockRun.mock.calls[0][0];
    expect(callArgs.progress).toBeDefined();
    expect(callArgs.progress).not.toBe(mockProgress);
    // Verify it's a no-op by calling methods
    callArgs.progress.start(10);
    callArgs.progress.increment();
    callArgs.progress.updateMessage('test');
    callArgs.progress.stop();
    // Should not throw
  });

  it('should handle pipeline errors and return failure result', async () => {
    // Arrange
    const { runPipeline: runPipelineFn } = await import('../../src/pipeline/runPipeline.js');
    const error = new Error('Pipeline execution failed');
    mockRun.mockRejectedValue(error);
    const options: PipelineOptions = {
      config: mockConfig,
      logger: mockLogger,
      progress: mockProgress,
    };

    // Act
    const result = await runPipelineFn(options);

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'Pipeline execution failed',
    });
    expect(mockLogger.error).toHaveBeenCalledWith('Pipeline failed', error);
  });

  it('should handle non-Error exceptions', async () => {
    // Arrange
    const { runPipeline: runPipelineFn } = await import('../../src/pipeline/runPipeline.js');
    const error = 'String error';
    mockRun.mockRejectedValue(error);
    const options: PipelineOptions = {
      config: mockConfig,
      logger: mockLogger,
      progress: mockProgress,
    };

    // Act
    const result = await runPipelineFn(options);

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'String error',
    });
    expect(mockLogger.error).toHaveBeenCalledWith('Pipeline failed', error);
  });

  it('should use config logging settings for default logger', async () => {
    // Arrange
    const { runPipeline: runPipelineFn } = await import('../../src/pipeline/runPipeline.js');
    const configWithLogging: PipelineConfig = {
      ...mockConfig,
      logging: { level: 'debug', singleLine: false },
    };
    const options: PipelineOptions = {
      config: configWithLogging,
    };

    // Act
    await runPipelineFn(options);

    // Assert
    expect(mockRun).toHaveBeenCalled();
    const callArgs = mockRun.mock.calls[0][0];
    expect(callArgs.logger).toBeDefined();
  });
});
