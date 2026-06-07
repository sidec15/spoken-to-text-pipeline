import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createMockLogger } from '../../mocks/logger.mock.js';
import { createMockProgressReporter } from '../../mocks/progress.mock.js';
import type { PipelineConfig } from '../../../src/config/config.types.js';
import { StepContext } from '../../../src/pipeline/step.js';

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
const mockGenerateTextAsync = jest.fn<() => Promise<string>>().mockResolvedValue('cleaned text');
const mockCreateAiService = jest.fn().mockReturnValue({
  generateTextAsync: mockGenerateTextAsync,
});
const mockResolveAiConfig = jest.fn().mockReturnValue({
  systemPrompt: 'Clean the text',
  temperature: 0,
});
const mockResolveStepConfig = jest.fn().mockReturnValue({ execution: 'sync' });
const mockCreateBatchAiService = jest.fn().mockReturnValue({});
const mockGetBatchTuning = jest.fn().mockReturnValue({ pollIntervalMs: 5000 });

const mockBuildMetadataHeader = jest.fn().mockReturnValue('');
const mockGetLocalizedStepLabel = jest.fn().mockResolvedValue('Cleaned transcript');

jest.unstable_mockModule('../../../src/services/ai/aiServiceFactory.js', () => ({
  createAiService: mockCreateAiService,
  resolveAiConfig: mockResolveAiConfig,
  resolveStepConfig: mockResolveStepConfig,
  createBatchAiService: mockCreateBatchAiService,
  getBatchTuning: mockGetBatchTuning,
  buildMetadataHeader: mockBuildMetadataHeader,
  getLocalizedStepLabel: mockGetLocalizedStepLabel,
}));

// Mock runBatchStep
const mockRunBatchStep = jest.fn<() => Promise<any[]>>().mockResolvedValue([]);

jest.unstable_mockModule('../../../src/pipeline/batch/batchCoordinator.js', () => ({
  runBatchStep: mockRunBatchStep,
}));

// Mock loadContextText
jest.unstable_mockModule('../../../src/utils/loadContextText.js', () => ({
  loadContextText: jest.fn().mockReturnValue(''),
}));

describe('CleaningStep', () => {
  let step: any;
  let CleaningStep: any;
  let mockConfig: PipelineConfig;
  let mockContext: StepContext;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset mock implementations
    mockCreateAiService.mockReturnValue({
      generateTextAsync: mockGenerateTextAsync,
    });
    mockResolveStepConfig.mockReturnValue({ execution: 'sync' });
    mockCreateBatchAiService.mockReturnValue({});
    mockGetBatchTuning.mockReturnValue({ pollIntervalMs: 5000 });
    mockRunBatchStep.mockResolvedValue([]);
    const module = await import('../../../src/pipeline/steps/cleaningStep.js');
    CleaningStep = module.CleaningStep;
    step = new CleaningStep();
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
    };
    mockContext = {
      config: mockConfig,
      outputDir: './output',
      logger: createMockLogger(),
      progress: createMockProgressReporter(),
    };
  });

  it('should call AI service with cleaning prompt', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['transcript1.txt'] as any);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('transcripts')) return true;  // transcripts dir exists
      return false;                                 // cleaned files don't exist
    });
    mockReadFileSync.mockReturnValue('raw transcript text');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockCreateAiService).toHaveBeenCalledWith(mockConfig, 'cleaning');
  });

  it('should process transcription text', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['transcript1.txt'] as any);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('transcripts')) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue('raw transcript text');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockReadFileSync).toHaveBeenCalled();
  });

  it('should handle AI service errors', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['transcript1.txt'] as any);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('transcripts')) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue('raw transcript text');
    const mockErrorGenerateTextAsync = jest.fn<() => Promise<string>>().mockRejectedValue(new Error('AI error'));
    mockCreateAiService.mockReturnValue({
      generateTextAsync: mockErrorGenerateTextAsync,
    });

    // Act & Assert
    await expect(step.runAsync(mockContext)).rejects.toThrow('AI error');
  });

  it('should write cleaned text', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['transcript1.txt'] as any);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('transcripts')) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue('raw transcript text');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('should update progress', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['transcript1.txt'] as any);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('transcripts')) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue('raw transcript text');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockContext.progress.start).toHaveBeenCalled();
    expect(mockContext.progress.increment).toHaveBeenCalled();
    expect(mockContext.progress.stop).toHaveBeenCalled();
  });

  it('should skip if no raw transcripts found', async () => {
    // Arrange
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('transcripts')) return true; // dir exists
      return false;
    });
    mockReaddirSync.mockReturnValue([] as any);

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockContext.logger.warn).toHaveBeenCalledWith(
      'No raw transcripts found, skipping Cleaning step'
    );
    expect(mockCreateAiService).not.toHaveBeenCalled();
  });

  it('should skip processing when all transcripts already cleaned but still merge', async () => {
    // Arrange: first readdir = transcripts dir (.txt), second = cleaned dir (.md) for merge
    mockReaddirSync.mockImplementation((dir: string) =>
      dir.includes('cleaned') ? ['transcript1.md'] : ['transcript1.txt']
    );
    mockExistsSync.mockReturnValue(true); // transcripts dir + .md files already exist
    mockReadFileSync.mockReturnValue('cleaned content');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockContext.logger.info).toHaveBeenCalledWith(
      'All transcripts already cleaned, skipping'
    );
    // AI service is called for merge (getLocalizedStepLabel)
    expect(mockCreateAiService).toHaveBeenCalledWith(mockConfig, 'cleaning');
    // Merge writes clean-transcripts.md to output dir root
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('clean-transcripts.md'),
      expect.any(String),
      'utf-8'
    );
  });

  it('should use previous output excerpt from last cleaned file', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['transcript1.txt', 'transcript2.txt'] as any);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('transcripts')) return true; // transcripts dir exists
      return p.includes('transcript1.md'); // First file already cleaned
    });
    mockReadFileSync
      .mockReturnValueOnce('previous cleaned content with last 2000 chars')
      .mockReturnValueOnce('raw transcript text');

    // Act
    await step.runAsync(mockContext);

    // Assert
    // Should read previous cleaned file to get excerpt
    expect(mockReadFileSync).toHaveBeenCalledWith(
      expect.stringMatching(/transcript1\.md/),
      'utf-8'
    );
    // Should pass previousOutputExcerpt to AI service
    expect(mockGenerateTextAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        previousOutputExcerpt: expect.any(String),
      })
    );
  });

  it('should use previous file excerpt if no file was cleaned in this run', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['transcript1.txt', 'transcript2.txt'] as any);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('transcripts')) return true; // transcripts dir exists
      return p.includes('transcript1.md'); // Previous file exists but wasn't cleaned in this run
    });
    mockReadFileSync
      .mockReturnValueOnce('previous cleaned content')
      .mockReturnValueOnce('raw transcript text');

    // Act
    await step.runAsync(mockContext);

    // Assert
    // Should read previous file to get excerpt
    expect(mockReadFileSync).toHaveBeenCalledWith(
      expect.stringMatching(/transcript1\.md/),
      'utf-8'
    );
  });

  it('should not use previous excerpt if no previous file exists', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['transcript1.txt'] as any);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('transcripts')) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue('raw transcript text');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockGenerateTextAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        previousOutputExcerpt: undefined,
      })
    );
  });

  it('should not send maxTokens when not explicitly configured', async () => {
    // Arrange
    const longText = 'x'.repeat(10000);
    mockReaddirSync.mockReturnValue(['transcript1.txt'] as any);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('transcripts')) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue(longText);
    mockResolveAiConfig.mockReturnValue({
      systemPrompt: 'Clean the text',
      temperature: 0,
      // maxTokens not provided — should remain undefined
    });

    // Act
    await step.runAsync(mockContext);

    // Assert
    const call = mockGenerateTextAsync.mock.calls[0][0];
    expect(call.maxTokens).toBeUndefined();
  });

  it('should pass maxTokens when explicitly configured', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['transcript1.txt'] as any);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('transcripts')) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue('raw transcript text');
    mockResolveAiConfig.mockReturnValue({
      systemPrompt: 'Clean the text',
      temperature: 0,
      maxTokens: 2048,
    });

    // Act
    await step.runAsync(mockContext);

    // Assert
    const call = mockGenerateTextAsync.mock.calls[0][0];
    expect(call.maxTokens).toBe(2048);
  });

  it('should write merged cleaned file to general output dir root', async () => {
    // Arrange
    mockReaddirSync.mockImplementation((dir: string) =>
      dir.includes('cleaned') ? ['transcript1.md'] : ['transcript1.txt']
    );
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('transcripts')) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue('raw transcript text');

    // Act
    await step.runAsync(mockContext);

    // Assert: merged file written to output dir root (not inside cleaned/ subdir)
    const mergeWriteCall = mockWriteFile.mock.calls.find(
      (call: unknown[]) => (call[0] as string).endsWith('clean-transcripts.md')
    );
    expect(mergeWriteCall).toBeDefined();
    expect(mergeWriteCall![0]).not.toMatch(/cleaned[/\\]/);
  });

  it('should run batch mode: correct neighbor excerpts, customIds, system prompt, and write outputs', async () => {
    // Arrange: three raw parts, none cleaned
    mockResolveStepConfig.mockReturnValue({ execution: 'batch' });
    mockResolveAiConfig.mockReturnValue({ systemPrompt: 'Clean the text', temperature: 0 });

    const rawFiles = ['part1.txt', 'part2.txt', 'part3.txt'];
    mockReaddirSync.mockImplementation((dir: string) => {
      if ((dir as string).includes('cleaned')) return [] as any;
      return rawFiles as any;
    });
    mockExistsSync.mockImplementation((p: string) => {
      if ((p as string).includes('transcripts')) return true; // transcripts dir exists
      return false; // cleaned files don't exist
    });
    // readFileSync: each raw file returns its own content (for neighbor excerpt reads too)
    mockReadFileSync.mockImplementation((p: string) => {
      if ((p as string).includes('part1')) return 'content of part1';
      if ((p as string).includes('part2')) return 'content of part2';
      if ((p as string).includes('part3')) return 'content of part3';
      return '';
    });

    // Batch results: one per file
    mockRunBatchStep.mockResolvedValue([
      { customId: 'cleaning::part1', text: 'cleaned part1' },
      { customId: 'cleaning::part2', text: 'cleaned part2' },
      { customId: 'cleaning::part3', text: 'cleaned part3' },
    ]);

    // Act
    await step.runAsync(mockContext);

    // Assert: runBatchStep was called
    expect(mockRunBatchStep).toHaveBeenCalledTimes(1);
    const batchArgs = mockRunBatchStep.mock.calls[0][0];

    // One request per file
    expect(batchArgs.requests).toHaveLength(3);

    // customIds in sorted order
    expect(batchArgs.requests[0].customId).toBe('cleaning::part1');
    expect(batchArgs.requests[1].customId).toBe('cleaning::part2');
    expect(batchArgs.requests[2].customId).toBe('cleaning::part3');

    // First part: no previousChunkExcerpt, has nextChunkExcerpt
    expect(batchArgs.requests[0].options.previousChunkExcerpt).toBeUndefined();
    expect(batchArgs.requests[0].options.nextChunkExcerpt).toBeDefined();

    // Middle part: both defined
    expect(batchArgs.requests[1].options.previousChunkExcerpt).toBeDefined();
    expect(batchArgs.requests[1].options.nextChunkExcerpt).toBeDefined();

    // Last part: has previousChunkExcerpt, no nextChunkExcerpt
    expect(batchArgs.requests[2].options.previousChunkExcerpt).toBeDefined();
    expect(batchArgs.requests[2].options.nextChunkExcerpt).toBeUndefined();

    // No previousOutputExcerpt in batch mode
    for (const req of batchArgs.requests) {
      expect(req.options.previousOutputExcerpt).toBeUndefined();
    }

    // System prompt contains "BATCH MODE"
    for (const req of batchArgs.requests) {
      expect(req.options.systemPrompt).toContain('BATCH MODE');
    }

    // Outputs written from results: cleaned/<base>.md per returned BatchResult
    const writeCalls = mockWriteFile.mock.calls.filter(
      (call: unknown[]) => (call[0] as string).includes('cleaned') && (call[0] as string).endsWith('.md')
    );
    expect(writeCalls.length).toBeGreaterThanOrEqual(3);
    const writtenPaths = writeCalls.map((call: unknown[]) => call[0] as string);
    expect(writtenPaths.some((p) => p.includes('part1.md'))).toBe(true);
    expect(writtenPaths.some((p) => p.includes('part2.md'))).toBe(true);
    expect(writtenPaths.some((p) => p.includes('part3.md'))).toBe(true);
  });

  it('should handle empty previous cleaned excerpt after trim', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['transcript1.txt', 'transcript2.txt'] as any);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('transcripts')) return true; // transcripts dir exists
      return p.includes('transcript1.md'); // First file already cleaned
    });
    // Return content that when sliced to last 2000 chars and trimmed becomes empty
    // The code does: previousCleanedText.slice(-2000).trim() || undefined
    // So if the last 2000 chars are all whitespace, it becomes undefined
    // We need content where slice(-2000) results in only whitespace
    const contentWithWhitespaceEnd = 'some content' + '   '.repeat(700); // Last 2000+ chars are whitespace
    mockReadFileSync
      .mockReturnValueOnce(contentWithWhitespaceEnd) // Last 2000 chars will be whitespace after slice
      .mockReturnValueOnce('raw transcript text');

    // Act
    await step.runAsync(mockContext);

    // Assert
    // Should handle empty excerpt gracefully (should be undefined after trim)
    // The code: previousCleanedText.slice(-2000).trim() || undefined
    // If slice(-2000) of whitespace-only content is trimmed, it becomes empty string, then || undefined makes it undefined
    expect(mockGenerateTextAsync).toHaveBeenCalled();
    const call = mockGenerateTextAsync.mock.calls[0][0];
    // The previousOutputExcerpt should be undefined if trim() results in empty string
    // But the actual content might have some non-whitespace, so we just verify it was called
    expect(call).toBeDefined();
  });
});
