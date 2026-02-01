import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LoadProfileStep } from '../../../src/pipeline/steps/loadProfileStep.js';
import { createMockLogger } from '../../mocks/logger.mock.js';
import { createMockProgressReporter } from '../../mocks/progress.mock.js';
import type { PipelineConfig, StepContext } from '../../../src/config/config.types.js';

describe('LoadProfileStep', () => {
  let step: LoadProfileStep;
  let mockConfig: PipelineConfig;
  let mockContext: StepContext;

  beforeEach(() => {
    step = new LoadProfileStep();
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
    mockContext = {
      config: mockConfig,
      logger: createMockLogger(),
      progress: createMockProgressReporter(),
    };
  });

  it('should load profile from config', async () => {
    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockContext.logger.debug).toHaveBeenCalledWith('Active profile: lecture');
    expect(mockContext.logger.info).toHaveBeenCalledWith("Profile 'lecture' loaded");
  });

  it('should set profile in context', async () => {
    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockContext.config.profile).toBe('lecture');
    expect(mockContext.config.profiles.lecture).toBeDefined();
  });

  it('should handle invalid profile', async () => {
    // Arrange
    mockContext.config.profile = 'invalid-profile' as any;

    // Act & Assert
    await expect(step.runAsync(mockContext)).rejects.toThrow(
      /Profile not found in config/
    );
  });

  it('should have correct step name', () => {
    // Assert
    expect(step.name).toBe('load-profile');
  });
});
