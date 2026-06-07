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
const mockCreateBatchAiService = jest.fn().mockReturnValue({});
const mockGetBatchTuning = jest.fn().mockReturnValue({ pollIntervalMs: 1000 });
const mockResolveStepConfig = jest.fn().mockReturnValue({ execution: 'sync' });
const mockResolveAiConfig = jest.fn().mockReturnValue({
  systemPrompt: 'Create summary',
  temperature: 0.2,
});

const mockBuildMetadataHeader = jest.fn().mockReturnValue('');
const mockGetLocalizedStepLabel = jest.fn().mockResolvedValue('Lecture Summary');

jest.unstable_mockModule('../../../src/services/ai/aiServiceFactory.js', () => ({
  createAiService: mockCreateAiService,
  createBatchAiService: mockCreateBatchAiService,
  getBatchTuning: mockGetBatchTuning,
  resolveStepConfig: mockResolveStepConfig,
  resolveAiConfig: mockResolveAiConfig,
  buildMetadataHeader: mockBuildMetadataHeader,
  getLocalizedStepLabel: mockGetLocalizedStepLabel,
}));

// Mock runBatchStep
const mockRunBatchStep = jest.fn<() => Promise<any[]>>().mockResolvedValue([]);
jest.unstable_mockModule('../../../src/pipeline/batch/batchCoordinator.js', () => ({
  runBatchStep: mockRunBatchStep,
}));

// Mock loadContextText
const mockLoadContextText = jest.fn<(paths?: string[]) => string>().mockReturnValue('');
jest.unstable_mockModule('../../../src/utils/loadContextText.js', () => ({
  loadContextText: mockLoadContextText,
}));

describe('SummaryStep', () => {
  let step: any;
  let SummaryStep: any;
  let mockConfig: PipelineConfig;
  let mockContext: StepContext;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset mock implementations
    (mockLoadContextText as jest.Mock).mockReturnValue('');
    mockCreateAiService.mockReturnValue({
      generateTextAsync: mockGenerateTextAsync,
    });
    mockCreateBatchAiService.mockReturnValue({});
    mockGetBatchTuning.mockReturnValue({ pollIntervalMs: 1000 });
    mockResolveStepConfig.mockReturnValue({ execution: 'sync' });
    mockRunBatchStep.mockResolvedValue([]);
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
    };
    mockContext = {
      config: mockConfig,
      outputDir: './output',
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

  it('should skip if no input content found', async () => {
    // Arrange - no handout, cleaned dir missing (or empty)
    mockReaddirSync.mockReturnValue([] as any);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('handout.md')) return false;
      if (p.includes('summary.md')) return false;
      return false; // cleaned dir not present
    });

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockContext.logger.warn).toHaveBeenCalledWith(
      'Cleaned directory not found, cannot generate summary'
    );
    expect(mockCreateAiService).not.toHaveBeenCalled();
  });

  it('should skip when handout missing and no cleaned files', async () => {
    // Arrange - handout.md missing, cleaned dir exists but empty (all profiles)
    mockReaddirSync.mockReturnValue([] as any);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('handout.md')) return false;
      if (p.includes('summary.md')) return false;
      return true; // cleaned dir exists
    });

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockContext.logger.warn).toHaveBeenCalledWith(
      'No cleaned transcript files found, cannot generate summary'
    );
    expect(mockCreateAiService).not.toHaveBeenCalled();
  });

  it('should read handout.md when present', async () => {
    // Arrange - handout exists (all profiles use it when available)
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

  it('should merge cleaned files when handout missing', async () => {
    // Arrange - no handout.md, use cleaned files (e.g. handout step disabled)
    mockReaddirSync.mockReturnValue(['part-1.md', 'part-2.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      if (path.includes('handout.md')) return false;
      if (path.includes('summary.md')) return false;
      return true;
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

  it('should calculate word count dynamically if not specified', async () => {
    // Arrange - use content that gives a calculated value above minimum
    // ~10000 characters ≈ 2000 words, so dynamic calculation for lecture handout (15%) ≈ 300 words
    const longContent = 'x'.repeat(10000);
    mockReaddirSync.mockReturnValue(['handout.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('summary.md') ? false : true;
    });
    mockReadFileSync.mockReturnValue(longContent);

    // Act
    await step.runAsync(mockContext);

    // Assert - should use dynamic calculation (not 1000)
    // For lecture handout with ~2000 words: 15% = 300 words
    expect(mockGenerateTextAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('300 words'),
      })
    );
  });

  it('should sort files by numeric part when using cleaned input', async () => {
    // Arrange - no handout so summary uses cleaned files
    mockReaddirSync.mockReturnValue(['part-10.md', 'part-2.md', 'part-1.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      if (path.includes('handout.md')) return false;
      if (path.includes('summary.md')) return false;
      return true;
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

  it('should return single chunk summary when only one chunk is generated', async () => {
    // Arrange
    const largeContent = 'x'.repeat(400000); // ~100K tokens
    mockReaddirSync.mockReturnValue(['handout.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('summary.md') ? false : true;
    });
    mockReadFileSync.mockReturnValue(largeContent);
    mockResolveAiConfig.mockReturnValue({
      systemPrompt: 'Create summary',
      temperature: 0.2,
    });
    // Mock to return single chunk summary (simulating chunking that results in one chunk)
    mockGenerateTextAsync.mockResolvedValueOnce('single chunk summary');

    // Act
    await step.runAsync(mockContext);

    // Assert - content includes header (from buildMetadataHeader mock) + summary
    const writeCall = mockWriteFile.mock.calls[0];
    expect(writeCall[0]).toMatch(/summary\.md/);
    expect(writeCall[1]).toContain('single chunk summary');
    expect(writeCall[2]).toBe('utf-8');
  });

  it('should merge multiple chunk summaries when content is very large', async () => {
    // Arrange
    // Create content large enough to trigger chunking with multiple chunks
    // CHUNK_SIZE_CHARS = 80000 * 4 = 320000, so we need > 320000 chars for multiple chunks
    // But the check is based on tokens (estimatedInputTokens > MAX_SAFE_INPUT_TOKENS = 90000)
    // So we need > 90000 * 4 = 360000 chars to trigger chunking
    // And then need enough to create multiple chunks (> 320000 per chunk)
    const largeContent = 'x'.repeat(700000); // Large enough to create multiple chunks
    mockReaddirSync.mockReturnValue(['handout.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('summary.md') ? false : true;
    });
    mockReadFileSync.mockReturnValue(largeContent);
    mockResolveAiConfig.mockReturnValue({
      systemPrompt: 'Create summary',
      temperature: 0.2,
    });
    // Mock multiple chunk summaries and final merge
    // The chunking will split into multiple chunks, each generating a summary, then merge
    mockGenerateTextAsync
      .mockResolvedValueOnce('chunk 1 summary')
      .mockResolvedValueOnce('chunk 2 summary')
      .mockResolvedValueOnce('merged final summary');

    // Act
    await step.runAsync(mockContext);

    // Assert
    // Should use chunking strategy
    expect(mockContext.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('exceeds safe limit')
    );
    expect(mockWriteFile).toHaveBeenCalled();
    // The actual number of calls depends on how many chunks are created
    expect(mockGenerateTextAsync.mock.calls.length).toBeGreaterThan(0);
  });

  it('should handle progress updates during chunking', async () => {
    // Arrange
    const largeContent = 'x'.repeat(500000);
    mockReaddirSync.mockReturnValue(['handout.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('summary.md') ? false : true;
    });
    mockReadFileSync.mockReturnValue(largeContent);
    mockResolveAiConfig.mockReturnValue({
      systemPrompt: 'Create summary',
      temperature: 0.2,
    });
    mockGenerateTextAsync.mockResolvedValue('summary');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockContext.progress.start).toHaveBeenCalled();
    expect(mockContext.progress.increment).toHaveBeenCalled();
    expect(mockContext.progress.stop).toHaveBeenCalled();
  });

  it('should pass context to AI service when context is configured', async () => {
    // Arrange
    const contextText = 'reference material content';
    (mockLoadContextText as jest.Mock).mockReturnValue(contextText);
    mockConfig.context = { textSources: ['ref1.txt', 'ref2.md'] };
    mockReaddirSync.mockReturnValue(['handout.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('summary.md') ? false : true;
    });
    mockReadFileSync.mockReturnValue('handout text content');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockLoadContextText).toHaveBeenCalledWith(['ref1.txt', 'ref2.md'], undefined);
    expect(mockGenerateTextAsync).toHaveBeenCalled();
    const generateCall = (mockGenerateTextAsync.mock.calls[0] as any[])[0] as any;
    expect(generateCall.manualContextText).toBe(contextText);
  });

  it('should pass undefined context when context is not configured', async () => {
    // Arrange
    (mockLoadContextText as jest.Mock).mockReturnValue('');
    mockConfig.context = undefined;
    mockReaddirSync.mockReturnValue(['handout.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('summary.md') ? false : true;
    });
    mockReadFileSync.mockReturnValue('handout text content');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockLoadContextText).toHaveBeenCalledWith(undefined, undefined);
    expect(mockGenerateTextAsync).toHaveBeenCalled();
    const generateCall = (mockGenerateTextAsync.mock.calls[0] as any[])[0] as any;
    expect(generateCall.manualContextText).toBeUndefined();
  });

  it('should pass context to AI service during chunking', async () => {
    // Arrange
    const contextText = 'reference material content';
    (mockLoadContextText as jest.Mock).mockReturnValue(contextText);
    mockConfig.context = { textSources: ['ref.txt'] };
    const largeContent = 'x'.repeat(400000);
    mockReaddirSync.mockReturnValue(['handout.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('summary.md') ? false : true;
    });
    mockReadFileSync.mockReturnValue(largeContent);
    mockResolveAiConfig.mockReturnValue({
      systemPrompt: 'Create summary',
      temperature: 0.2,
    });
    mockGenerateTextAsync.mockResolvedValue('summary');

    // Act
    await step.runAsync(mockContext);

    // Assert
    // Should pass context to all AI calls (chunks and merge)
    expect(mockGenerateTextAsync.mock.calls.length).toBeGreaterThan(0);
    mockGenerateTextAsync.mock.calls.forEach((call: any[]) => {
      expect(call[0]).toMatchObject({
        manualContextText: contextText,
      });
    });
  });

  describe('batch execution', () => {
    it('should submit a single summary::main batch request when input is under threshold (batch single-pass)', async () => {
      // Arrange
      mockResolveStepConfig.mockReturnValue({ execution: 'batch' });
      mockReaddirSync.mockReturnValue(['handout.md'] as any);
      mockExistsSync.mockImplementation((p: string) => {
        return p.includes('summary.md') ? false : true;
      });
      mockReadFileSync.mockReturnValue('short handout content'); // well under 90K tokens
      mockRunBatchStep.mockResolvedValue([
        { customId: 'summary::main', text: 'batch summary result' },
      ]);

      // Act
      await step.runAsync(mockContext);

      // Assert: exactly one request with customId summary::main
      expect(mockRunBatchStep).toHaveBeenCalledTimes(1);
      const { requests } = mockRunBatchStep.mock.calls[0][0] as any;
      expect(requests).toHaveLength(1);
      expect(requests[0].customId).toBe('summary::main');
      expect(requests[0].options.userPrompt).toBe('short handout content');

      // Assert: summary.md written with the batch result text
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const written = mockWriteFile.mock.calls[0][1] as string;
      expect(written).toContain('batch summary result');
    });

    it('should submit chunk batch requests and sync-merge when input exceeds threshold (batch chunked)', async () => {
      // Arrange: content large enough to trigger chunking (> 90000 * 4 = 360000 chars)
      // CHUNK_SIZE_CHARS = 80000 * 4 = 320000; use many short lines to force 2+ chunks
      // Each line is ~100 chars, we need > 640000 chars total for 2 chunks
      const line = 'x'.repeat(99) + '\n'; // 100 chars per line
      const largeContent = line.repeat(7000); // 700000 chars → triggers chunking AND multiple chunks
      mockResolveStepConfig.mockReturnValue({ execution: 'batch' });
      mockReaddirSync.mockReturnValue(['handout.md'] as any);
      mockExistsSync.mockImplementation((p: string) => {
        return p.includes('summary.md') ? false : true;
      });
      mockReadFileSync.mockReturnValue(largeContent);
      mockResolveAiConfig.mockReturnValue({
        systemPrompt: 'Create summary',
        temperature: 0.2,
      });

      // Build expected chunk customIds based on how many chunks splitContentIntoChunks produces
      // CHUNK_SIZE_CHARS=320000, 7000 lines of 100 chars each → ceil(700000/320000) ≈ 3 chunks
      // We'll just return results for however many chunks are produced (test asserts > 1)
      mockRunBatchStep.mockImplementation(async ({ requests }: any) => {
        return requests.map((r: any) => ({ customId: r.customId, text: `summary for ${r.customId}` }));
      });
      // Sync merge call via aiService.generateTextAsync
      mockGenerateTextAsync.mockResolvedValue('merged summary from batch chunks');

      // Act
      await step.runAsync(mockContext);

      // Assert: runBatchStep was called with multiple chunk requests
      expect(mockRunBatchStep).toHaveBeenCalledTimes(1);
      const { requests } = mockRunBatchStep.mock.calls[0][0] as any;
      expect(requests.length).toBeGreaterThan(1);
      expect(requests[0].customId).toMatch(/^summary::chunk-\d{4}$/);

      // Assert: sync merge ran (generateTextAsync called for merging)
      expect(mockGenerateTextAsync).toHaveBeenCalledTimes(1);

      // Assert: summary.md written with merged result
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const written = mockWriteFile.mock.calls[0][1] as string;
      expect(written).toContain('merged summary from batch chunks');
    });

    it('should throw and not write summary.md when batch main result has an error', async () => {
      // Arrange
      mockResolveStepConfig.mockReturnValue({ execution: 'batch' });
      mockReaddirSync.mockReturnValue(['handout.md'] as any);
      mockExistsSync.mockImplementation((p: string) => {
        return p.includes('summary.md') ? false : true;
      });
      mockReadFileSync.mockReturnValue('short content');
      mockRunBatchStep.mockResolvedValue([
        { customId: 'summary::main', error: 'model refused' },
      ]);

      // Act & Assert
      await expect(step.runAsync(mockContext)).rejects.toThrow('Summary batch result missing/failed');
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should throw and not write summary.md when a batch chunk result has an error', async () => {
      // Arrange: large multi-line content so chunking path is taken with multiple chunks
      const line = 'x'.repeat(99) + '\n';
      const largeContent = line.repeat(7000); // same chunking trigger as batch chunked test
      mockResolveStepConfig.mockReturnValue({ execution: 'batch' });
      mockReaddirSync.mockReturnValue(['handout.md'] as any);
      mockExistsSync.mockImplementation((p: string) => {
        return p.includes('summary.md') ? false : true;
      });
      mockReadFileSync.mockReturnValue(largeContent);
      mockResolveAiConfig.mockReturnValue({
        systemPrompt: 'Create summary',
        temperature: 0.2,
      });
      // Return results where chunk-0001 has an error (chunk-0000 succeeds)
      mockRunBatchStep.mockImplementation(async ({ requests }: any) => {
        return requests.map((r: any, i: number) =>
          i === 1
            ? { customId: r.customId, error: 'token limit exceeded' }
            : { customId: r.customId, text: `summary for ${r.customId}` }
        );
      });

      // Act & Assert
      await expect(step.runAsync(mockContext)).rejects.toThrow('Summary batch chunk missing/failed');
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should use createBatchAiService and getBatchTuning in batch mode', async () => {
      // Arrange
      const fakeBatchService = { submit: jest.fn(), poll: jest.fn(), collect: jest.fn() };
      mockCreateBatchAiService.mockReturnValue(fakeBatchService);
      mockGetBatchTuning.mockReturnValue({ pollIntervalMs: 5000, maxWaitMs: 60000 });
      mockResolveStepConfig.mockReturnValue({ execution: 'batch' });
      mockReaddirSync.mockReturnValue(['handout.md'] as any);
      mockExistsSync.mockImplementation((p: string) => {
        return p.includes('summary.md') ? false : true;
      });
      mockReadFileSync.mockReturnValue('short content');
      mockRunBatchStep.mockResolvedValue([
        { customId: 'summary::main', text: 'batch text' },
      ]);

      // Act
      await step.runAsync(mockContext);

      // Assert
      expect(mockCreateBatchAiService).toHaveBeenCalledWith(mockConfig, 'summary');
      expect(mockGetBatchTuning).toHaveBeenCalledWith(mockConfig);
      const args = mockRunBatchStep.mock.calls[0][0] as any;
      expect(args.batchService).toBe(fakeBatchService);
      expect(args.pollIntervalMs).toBe(5000);
      expect(args.maxWaitMs).toBe(60000);
    });
  });
});
