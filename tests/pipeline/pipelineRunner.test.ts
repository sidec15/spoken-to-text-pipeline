import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PipelineRunner } from '../../src/pipeline/pipelineRunner.js';
import type { Step, StepContext } from '../../src/pipeline/step.js';
import { createMockLogger } from '../mocks/logger.mock.js';
import { createMockProgressReporter } from '../mocks/progress.mock.js';
import type { PipelineConfig } from '../../src/config/config.types.js';

describe('PipelineRunner', () => {
  let mockConfig: PipelineConfig;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockProgress: ReturnType<typeof createMockProgressReporter>;
  let mockContext: StepContext;

  beforeEach(() => {
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
    mockContext = {
      config: mockConfig,
      logger: mockLogger,
      progress: mockProgress,
    };
  });

  it('should run all steps in sequence', async () => {
    // Arrange
    const step1: Step = {
      name: 'step1',
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    const step2: Step = {
      name: 'step2',
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    const runner = new PipelineRunner([step1, step2]);

    // Act
    await runner.run(mockContext);

    // Assert
    expect(step1.runAsync).toHaveBeenCalledTimes(1);
    expect(step2.runAsync).toHaveBeenCalledTimes(1);
    // Verify step1 was called before step2 by checking call order
    const step1CallOrder = (step1.runAsync as jest.Mock).mock.invocationCallOrder[0];
    const step2CallOrder = (step2.runAsync as jest.Mock).mock.invocationCallOrder[0];
    expect(step1CallOrder).toBeLessThan(step2CallOrder);
  });

  it('should pass context to each step', async () => {
    // Arrange
    const step: Step = {
      name: 'test-step',
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    const runner = new PipelineRunner([step]);

    // Act
    await runner.run(mockContext);

    // Assert
    expect(step.runAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        config: mockConfig,
        logger: expect.anything(),
        progress: mockProgress,
      })
    );
  });

  it('should log step start and completion', async () => {
    // Arrange
    const step: Step = {
      name: 'test-step',
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    const runner = new PipelineRunner([step]);

    // Act
    await runner.run(mockContext);

    // Assert
    expect(mockLogger.info).toHaveBeenCalledWith('Step started');
    expect(mockLogger.info).toHaveBeenCalledWith('Step completed');
  });

  it('should fail fast on step error', async () => {
    // Arrange
    const step1: Step = {
      name: 'step1',
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    const step2: Step = {
      name: 'step2',
      runAsync: jest.fn().mockRejectedValue(new Error('Step failed')),
    };
    const step3: Step = {
      name: 'step3',
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    const runner = new PipelineRunner([step1, step2, step3]);

    // Act & Assert
    await expect(runner.run(mockContext)).rejects.toThrow('Step failed');
    expect(step1.runAsync).toHaveBeenCalled();
    expect(step2.runAsync).toHaveBeenCalled();
    expect(step3.runAsync).not.toHaveBeenCalled(); // Should not run after error
  });

  it('should propagate step errors', async () => {
    // Arrange
    const error = new Error('Step error');
    const step: Step = {
      name: 'test-step',
      runAsync: jest.fn().mockRejectedValue(error),
    };
    const runner = new PipelineRunner([step]);

    // Act & Assert
    await expect(runner.run(mockContext)).rejects.toThrow('Step error');
    expect(mockLogger.error).toHaveBeenCalledWith('Step failed', error);
  });

  it('should create step-specific logger context', async () => {
    // Arrange
    const step: Step = {
      name: 'test-step',
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    const runner = new PipelineRunner([step]);
    (mockLogger.withContext as jest.Mock).mockReturnValue(mockLogger);

    // Act
    await runner.run(mockContext);

    // Assert
    expect(mockLogger.withContext).toHaveBeenCalledWith({ step: 'test-step' });
  });
});
