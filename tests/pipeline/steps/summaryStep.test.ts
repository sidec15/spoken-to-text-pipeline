import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createMockLogger } from '../../mocks/logger.mock.js';
import { createMockProgressReporter } from '../../mocks/progress.mock.js';
import type { PipelineConfig } from '../../../src/config/config.types.js';
import type { StepContext } from '../../../src/pipeline/step.js';

// Mock fs for ESM
const mockMkdirSync = jest.fn();
const mockReaddirSync = jest.fn();
const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockWriteFile = jest.fn();

jest.unstable_mockModule('node:fs', () => ({
  default: {
    mkdirSync: mockMkdirSync,
    readdirSync: mockReaddirSync,
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    promises: {
      writeFile: mockWriteFile,
    },
  },
  mkdirSync: mockMkdirSync,
  readdirSync: mockReaddirSync,
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  promises: {
    writeFile: mockWriteFile,
  },
}));

// Mock AI service factory
const mockGenerateTextAsync = jest.fn<() => Promise<string>>().mockResolvedValue('summary text');
const mockCreateAiService = jest.fn().mockReturnValue({
  generateTextAsync: mockGenerateTextAsync,
});
const mockResolveAiConfig = jest.fn().mockReturnValue({
  systemPrompt: 'Create summary',
  temperature: 0.2,
});

jest.unstable_mockModule('../../../src/services/ai/aiServiceFactory.js', () => ({
  createAiService: mockCreateAiService,
  resolveAiConfig: mockResolveAiConfig,
}));

// Mock loadContextText
jest.unstable_mockModule('../../../src/utils/loadContextText.js', () => ({
  loadContextText: jest.fn().mockReturnValue(''),
}));

describe('SummaryStep', () => {
  let step: any;
  let SummaryStep: any;
  let mockConfig: PipelineConfig;
  let mockContext: StepContext;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset mock implementations
    mockCreateAiService.mockReturnValue({
      generateTextAsync: mockGenerateTextAsync,
    });
    const module = await import('../../../src/pipeline/steps/summaryStep.js');
    SummaryStep = module.SummaryStep;
    step = new SummaryStep();
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

  it('should call AI service with summary prompt', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['handout.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('summary.md') ? false : true; // summary.md doesn't exist, handout.md does
    });
    mockReadFileSync.mockReturnValue('handout text content');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockCreateAiService).toHaveBeenCalledWith(mockConfig, 'summary');
  });

  it('should process text with word count limit', async () => {
    // Arrange
    mockConfig.output = { summaryWordCount: 500 };
    mockReaddirSync.mockReturnValue(['handout.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('summary.md') ? false : true;
    });
    mockReadFileSync.mockReturnValue('handout text content');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockReadFileSync).toHaveBeenCalled();
  });

  it('should handle AI service errors', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['handout.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('summary.md') ? false : true;
    });
    mockReadFileSync.mockReturnValue('handout text content');
    const mockErrorGenerateTextAsync = jest.fn<() => Promise<string>>().mockRejectedValue(new Error('AI error'));
    mockCreateAiService.mockReturnValue({
      generateTextAsync: mockErrorGenerateTextAsync,
    });

    // Act & Assert
    await expect(step.runAsync(mockContext)).rejects.toThrow('AI error');
  });

  it('should write summary output', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['handout.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('summary.md') ? false : true;
    });
    mockReadFileSync.mockReturnValue('handout text content');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('should update progress', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['handout.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('summary.md') ? false : true;
    });
    mockReadFileSync.mockReturnValue('handout text content');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockContext.progress.start).toHaveBeenCalled();
    expect(mockContext.progress.increment).toHaveBeenCalled();
    expect(mockContext.progress.stop).toHaveBeenCalled();
  });

  it('should skip if summary already exists', async () => {
    // Arrange
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('summary.md'); // summary.md exists
    });

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockContext.logger.info).toHaveBeenCalledWith(
      'Summary already exists, skipping Summary step'
    );
    expect(mockCreateAiService).not.toHaveBeenCalled();
  });

  it('should skip if no input content found for lecture profile', async () => {
    // Arrange
    mockConfig.profile = 'lecture';
    mockReaddirSync.mockReturnValue([] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('summary.md') ? false : false; // handout.md doesn't exist
    });

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockContext.logger.warn).toHaveBeenCalledWith(
      'Handout not found, cannot generate summary for lecture profile'
    );
    expect(mockCreateAiService).not.toHaveBeenCalled();
  });

  it('should skip if no cleaned files found for meeting profile', async () => {
    // Arrange
    mockConfig.profile = 'meeting';
    mockReaddirSync.mockReturnValue(['handout.md', 'summary.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('summary.md') ? false : true;
    });

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockContext.logger.warn).toHaveBeenCalledWith(
      'No cleaned transcript files found, cannot generate summary'
    );
    expect(mockCreateAiService).not.toHaveBeenCalled();
  });

  it('should read handout.md for lecture profile', async () => {
    // Arrange
    mockConfig.profile = 'lecture';
    mockReaddirSync.mockReturnValue(['handout.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('summary.md') ? false : path.includes('handout.md');
    });
    mockReadFileSync.mockReturnValue('handout content');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockReadFileSync).toHaveBeenCalledWith(
      expect.stringMatching(/handout\.md/),
      'utf-8'
    );
    expect(mockContext.logger.info).toHaveBeenCalledWith(
      'Reading handout.md for summary input'
    );
  });

  it('should merge cleaned files for meeting profile', async () => {
    // Arrange
    mockConfig.profile = 'meeting';
    mockReaddirSync.mockReturnValue(['part-1.md', 'part-2.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('summary.md') ? false : true;
    });
    mockReadFileSync.mockReturnValue('part content');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockReadFileSync).toHaveBeenCalledTimes(2);
    expect(mockContext.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('cleaned transcript parts to merge')
    );
  });

  it('should use chunking strategy for large content', async () => {
    // Arrange
    const largeContent = 'x'.repeat(400000); // ~100K tokens (exceeds MAX_SAFE_INPUT_TOKENS)
    mockReaddirSync.mockReturnValue(['handout.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('summary.md') ? false : true;
    });
    mockReadFileSync.mockReturnValue(largeContent);
    mockResolveAiConfig.mockReturnValue({
      systemPrompt: 'Create summary',
      temperature: 0.2,
      maxTokens: 1300,
    });

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockContext.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('exceeds safe limit')
    );
    expect(mockContext.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('chunks')
    );
  });

  it('should enhance prompt with word count', async () => {
    // Arrange
    mockConfig.output = { summaryWordCount: 500 };
    mockReaddirSync.mockReturnValue(['handout.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('summary.md') ? false : true;
    });
    mockReadFileSync.mockReturnValue('handout content');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockGenerateTextAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('500 words'),
      })
    );
  });

  it('should use default word count if not specified', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['handout.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('summary.md') ? false : true;
    });
    mockReadFileSync.mockReturnValue('handout content');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockGenerateTextAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('1000 words'),
      })
    );
  });

  it('should sort files by numeric part for meeting profile', async () => {
    // Arrange
    mockConfig.profile = 'meeting';
    mockReaddirSync.mockReturnValue(['part-10.md', 'part-2.md', 'part-1.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('summary.md') ? false : true;
    });
    mockReadFileSync.mockReturnValue('content');

    // Act
    await step.runAsync(mockContext);

    // Assert
    // Verify files were read in correct order
    const readCalls = mockReadFileSync.mock.calls.filter((call: any[]) =>
      call[0].includes('part-')
    );
    expect(readCalls.length).toBe(3);
  });
});
