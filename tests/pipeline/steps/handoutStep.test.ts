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
const mockRename = jest.fn();

jest.unstable_mockModule('node:fs', () => ({
  default: {
    mkdirSync: mockMkdirSync,
    readdirSync: mockReaddirSync,
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    promises: {
      writeFile: mockWriteFile,
      rename: mockRename,
    },
  },
  mkdirSync: mockMkdirSync,
  readdirSync: mockReaddirSync,
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  promises: {
    writeFile: mockWriteFile,
    rename: mockRename,
  },
}));

// Mock AI service factory
const mockGenerateTextAsync = jest.fn<() => Promise<string>>().mockResolvedValue('handout text');
const mockCreateAiService = jest.fn().mockReturnValue({
  generateTextAsync: mockGenerateTextAsync,
});
const mockResolveAiConfig = jest.fn().mockReturnValue({
  systemPrompt: 'Create handout',
  temperature: 0,
});
const mockResolveStepConfig = jest.fn().mockReturnValue({ execution: 'sync' });
const mockCreateBatchAiService = jest.fn().mockReturnValue({});
const mockGetBatchTuning = jest.fn().mockReturnValue({ pollIntervalMs: 5000, maxWaitMs: undefined });

const mockBuildMetadataHeader = jest.fn().mockReturnValue('');
const mockGetLocalizedStepLabel = jest.fn().mockResolvedValue('Lecture Handout');

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
const mockLoadContextText = jest
  .fn<(paths?: string[], baseDir?: string) => string>()
  .mockReturnValue('');
jest.unstable_mockModule('../../../src/utils/loadContextText.js', () => ({
  loadContextText: mockLoadContextText,
}));

describe('HandoutStep', () => {
  let step: any;
  let HandoutStep: any;
  let mockConfig: PipelineConfig;
  let mockContext: StepContext;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset mock implementations
    (mockLoadContextText as jest.Mock).mockReturnValue('');
    mockCreateAiService.mockReturnValue({
      generateTextAsync: mockGenerateTextAsync,
    });
    mockResolveStepConfig.mockReturnValue({ execution: 'sync' });
    mockCreateBatchAiService.mockReturnValue({});
    mockGetBatchTuning.mockReturnValue({ pollIntervalMs: 5000, maxWaitMs: undefined });
    mockRunBatchStep.mockResolvedValue([]);
    const module = await import('../../../src/pipeline/steps/handoutStep.js');
    HandoutStep = module.HandoutStep;
    step = new HandoutStep();
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
      steps: {
        handout: {},
      },
    };
    mockContext = {
      config: mockConfig,
      outputDir: './output',
      logger: createMockLogger(),
      progress: createMockProgressReporter(),
    };
  });

  it('should process handout incrementally when cleaned files exist', async () => {
    mockConfig.steps = {};
    mockReaddirSync.mockReturnValue(['cleaned1.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('handout.md') || path.includes('.cache') ? false : true;
    });
    mockReadFileSync.mockReturnValue('cleaned text');

    await step.runAsync(mockContext);

    expect(mockCreateAiService).toHaveBeenCalledWith(mockConfig, 'handout');
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('should call AI service with handout prompt', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['cleaned1.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('handout.md') || path.includes('.cache') ? false : true; // handout.md doesn't exist, other files do
    });
    mockReadFileSync.mockReturnValue('cleaned text');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockCreateAiService).toHaveBeenCalledWith(mockConfig, 'handout');
  });

  it('should process cleaned text', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['cleaned1.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('handout.md') || path.includes('.cache') ? false : true;
    });
    mockReadFileSync.mockReturnValue('cleaned text');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockReadFileSync).toHaveBeenCalled();
  });

  it('should handle AI service errors', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['cleaned1.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('handout.md') || path.includes('.cache') ? false : true;
    });
    mockReadFileSync.mockReturnValue('cleaned text');
    const mockErrorGenerateTextAsync = jest.fn<() => Promise<string>>().mockRejectedValue(new Error('AI error'));
    mockCreateAiService.mockReturnValue({
      generateTextAsync: mockErrorGenerateTextAsync,
    });

    // Act & Assert
    await expect(step.runAsync(mockContext)).rejects.toThrow('AI error');
  });

  it('should write handout output', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['cleaned1.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('handout.md') || path.includes('.cache') ? false : true;
    });
    mockReadFileSync.mockReturnValue('cleaned text');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('should run handout step for meeting profile', async () => {
    // Arrange - all profiles now run handout
    mockConfig.profile = 'meeting';
    mockReaddirSync.mockReturnValue(['cleaned1.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('handout.md') || path.includes('.cache') ? false : true;
    });
    mockReadFileSync.mockReturnValue('cleaned text');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockCreateAiService).toHaveBeenCalledWith(mockConfig, 'handout');
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('should skip if handout already exists', async () => {
    // Arrange
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('handout.md'); // handout.md exists
    });

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockContext.logger.info).toHaveBeenCalledWith(
      'Handout already exists, skipping Handout step'
    );
    expect(mockCreateAiService).not.toHaveBeenCalled();
  });

  it('should skip if no cleaned files found', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue([] as any); // No .md files in cleaned dir
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('handout.md')) return false; // handout doesn't exist yet
      return true; // cleaned dir exists
    });

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockContext.logger.warn).toHaveBeenCalledWith(
      'No cleaned transcript files found, skipping Handout step'
    );
    expect(mockCreateAiService).not.toHaveBeenCalled();
  });

  it('should sort files by numeric part correctly', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['part-10.md', 'part-2.md', 'part-1.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('handout.md') || path.includes('.cache') ? false : true;
    });
    mockReadFileSync.mockReturnValue('content');

    // Act
    await step.runAsync(mockContext);

    // Assert
    // Verify files were read in correct order (part-1, part-2, part-10)
    const readCalls = mockReadFileSync.mock.calls.filter((call: any[]) =>
      call[0].includes('part-')
    );
    expect(readCalls.length).toBeGreaterThan(0);
    // Check that part-1 was read before part-10
    const part1Index = readCalls.findIndex((call: any[]) => call[0].includes('part-1.md'));
    const part10Index = readCalls.findIndex((call: any[]) => call[0].includes('part-10.md'));
    expect(part1Index).toBeLessThan(part10Index);
  });

  it('should handle files without numeric parts', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['cleaned.md', 'other.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('handout.md') || path.includes('.cache') ? false : true;
    });
    mockReadFileSync.mockReturnValue('content');

    // Act
    await step.runAsync(mockContext);

    // Assert
    // Files without numbers should still be processed (sorted to end)
    expect(mockReadFileSync).toHaveBeenCalled();
  });

  it('should process all .md files from cleaned directory', async () => {
    // Arrange
    // The cleaned directory only contains part files — handout.md and summary.md
    // live in the parent outputDir, not in cleaned/
    mockReaddirSync.mockReturnValue(['part-1.md', 'part-2.md'] as any);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('handout.md')) return false; // handout doesn't exist yet
      return true; // cleaned dir exists
    });
    mockReadFileSync.mockReturnValue('content');

    // Act
    await step.runAsync(mockContext);

    // Assert
    // Should process both part files
    const readCalls = mockReadFileSync.mock.calls.filter((call: any[]) =>
      call[0].includes('part-')
    );
    expect(readCalls.length).toBe(2);
  });

  it('should pass context to AI service when context is configured', async () => {
    // Arrange
    const contextText = 'reference material content';
    (mockLoadContextText as jest.Mock).mockReturnValue(contextText);
    mockConfig.context = { textSources: ['ref1.txt', 'ref2.md'] };
    mockReaddirSync.mockReturnValue(['cleaned1.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('handout.md') || path.includes('.cache') ? false : true;
    });
    mockReadFileSync.mockReturnValue('cleaned text');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockLoadContextText).toHaveBeenCalledWith(
      ['ref1.txt', 'ref2.md'],
      undefined
    );
    expect(mockGenerateTextAsync).toHaveBeenCalled();
    const generateCall = (mockGenerateTextAsync.mock.calls[0] as any[])[0] as any;
    expect(generateCall.manualContextText).toBe(contextText);
  });

  it('should pass undefined context when context is not configured', async () => {
    // Arrange
    (mockLoadContextText as jest.Mock).mockReturnValue('');
    mockConfig.context = undefined;
    mockReaddirSync.mockReturnValue(['cleaned1.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('handout.md') || path.includes('.cache') ? false : true;
    });
    mockReadFileSync.mockReturnValue('cleaned text');

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockLoadContextText).toHaveBeenCalledWith(undefined, undefined);
    expect(mockGenerateTextAsync).toHaveBeenCalled();
    const generateCall = (mockGenerateTextAsync.mock.calls[0] as any[])[0] as any;
    expect(generateCall.manualContextText).toBeUndefined();
  });

});

describe('HandoutStep batch mode', () => {
  let step: any;
  let mockConfig: PipelineConfig;
  let mockContext: StepContext;

  // Reads the content written to handout.md (Stage-2 is now a mechanical merge,
  // so we assert on the final file rather than on an AI merge call).
  const writtenHandout = (): string => {
    const call = mockWriteFile.mock.calls.find((c: any[]) => String(c[0]).includes('handout.md'));
    return call ? String(call[1]) : '';
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (mockLoadContextText as jest.Mock).mockReturnValue('');

    // Default: sync; individual tests override to 'batch'
    mockResolveStepConfig.mockReturnValue({ execution: 'batch' });
    mockResolveAiConfig.mockReturnValue({ systemPrompt: 'Create handout', temperature: 0 });
    mockCreateBatchAiService.mockReturnValue({});
    mockGetBatchTuning.mockReturnValue({ pollIntervalMs: 5000, maxWaitMs: undefined });
    mockRunBatchStep.mockResolvedValue([]);

    // aiService is still created in runAsync (incremental mode + localized label),
    // but Stage-2 batch merge no longer calls it.
    mockCreateAiService.mockReturnValue({ generateTextAsync: jest.fn() });

    const module = await import('../../../src/pipeline/steps/handoutStep.js');
    const HandoutStep = module.HandoutStep;
    step = new HandoutStep();

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
        providers: { openai: { apiKey: 'sk-test' } },
        default: { provider: 'openai', model: 'gpt-4o-mini' },
      },
      steps: { handout: {} },
    };
    mockContext = {
      config: mockConfig,
      outputDir: './output',
      logger: createMockLogger(),
      progress: createMockProgressReporter(),
    };
  });

  it('should run batch stage-1 with correct customIds in numeric order, draft addendum, neighbor excerpts, and a mechanical stage-2 merge', async () => {
    // Arrange: 3 cleaned parts, handout.md does not exist
    const cleanedFiles = ['part-1.md', 'part-2.md', 'part-3.md'];
    mockReaddirSync.mockReturnValue(cleanedFiles as any);
    mockExistsSync.mockImplementation((p: string) => {
      if ((p as string).includes('handout.md')) return false; // handout not written yet
      if ((p as string).includes('.cache')) return false; // no persisted drafts yet
      return true; // cleaned dir exists
    });
    mockReadFileSync.mockImplementation((p: string) => {
      if ((p as string).includes('part-1')) return 'content of part 1';
      if ((p as string).includes('part-2')) return 'content of part 2';
      if ((p as string).includes('part-3')) return 'content of part 3';
      return '';
    });

    // Batch returns one draft per part
    mockRunBatchStep.mockResolvedValue([
      { customId: 'handout::part-1', text: 'draft part 1' },
      { customId: 'handout::part-2', text: 'draft part 2' },
      { customId: 'handout::part-3', text: 'draft part 3' },
    ]);

    // Act
    await step.runAsync(mockContext);

    // Assert: runBatchStep was called once
    expect(mockRunBatchStep).toHaveBeenCalledTimes(1);
    const batchArgs = mockRunBatchStep.mock.calls[0][0] as any;

    // 3 requests, one per file
    expect(batchArgs.requests).toHaveLength(3);

    // customIds are "handout::<base>" in numeric order
    expect(batchArgs.requests[0].customId).toBe('handout::part-1');
    expect(batchArgs.requests[1].customId).toBe('handout::part-2');
    expect(batchArgs.requests[2].customId).toBe('handout::part-3');

    // Draft addendum is present in every stage-1 system prompt
    for (const req of batchArgs.requests) {
      expect(req.options.systemPrompt).toContain('BATCH DRAFT MODE');
    }

    // First part: no previousChunkExcerpt, has nextChunkExcerpt
    expect(batchArgs.requests[0].options.previousChunkExcerpt).toBeUndefined();
    expect(batchArgs.requests[0].options.nextChunkExcerpt).toBeDefined();

    // Middle part: both defined
    expect(batchArgs.requests[1].options.previousChunkExcerpt).toBeDefined();
    expect(batchArgs.requests[1].options.nextChunkExcerpt).toBeDefined();

    // Last part: has previousChunkExcerpt, no nextChunkExcerpt
    expect(batchArgs.requests[2].options.previousChunkExcerpt).toBeDefined();
    expect(batchArgs.requests[2].options.nextChunkExcerpt).toBeUndefined();

    // Stage-2 is a mechanical, in-process merge: no AI merge call is made and
    // the final handout.md contains every draft's content (in order).
    const handout = writtenHandout();
    expect(handout).toContain('draft part 1');
    expect(handout).toContain('draft part 2');
    expect(handout).toContain('draft part 3');

    // Final handout.md is written
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('handout.md'),
      expect.any(String),
      'utf-8',
    );
  });

  it('should throw hard if a batch draft errors', async () => {
    const cleanedFiles = ['part-1.md', 'part-2.md'];
    mockReaddirSync.mockReturnValue(cleanedFiles as any);
    mockExistsSync.mockImplementation((p: string) => {
      if ((p as string).includes('handout.md')) return false;
      if ((p as string).includes('.cache')) return false;
      return true;
    });
    mockReadFileSync.mockImplementation((p: string) => {
      if ((p as string).includes('part-1')) return 'content of part 1';
      if ((p as string).includes('part-2')) return 'content of part 2';
      return '';
    });

    // part-2 fails
    mockRunBatchStep.mockResolvedValue([
      { customId: 'handout::part-1', text: 'draft part 1' },
      { customId: 'handout::part-2', error: 'timeout' },
    ]);

    await expect(step.runAsync(mockContext)).rejects.toThrow(/part-2/);
  });

  it('persists each stage-1 draft to handout-drafts/ after the batch', async () => {
    const cleanedFiles = ['part-1.md', 'part-2.md'];
    mockReaddirSync.mockReturnValue(cleanedFiles as any);
    mockExistsSync.mockImplementation((p: string) => {
      if ((p as string).includes('handout.md')) return false;
      if ((p as string).includes('.cache')) return false; // no persisted drafts yet
      return true;
    });
    mockReadFileSync.mockReturnValue('cleaned content');
    mockRunBatchStep.mockResolvedValue([
      { customId: 'handout::part-1', text: 'draft part 1' },
      { customId: 'handout::part-2', text: 'draft part 2' },
    ]);

    await step.runAsync(mockContext);

    // Each draft written under the cache (.cache/handout/batch/drafts), keyed by part base name.
    const draftWrites = mockWriteFile.mock.calls.filter((c: any[]) =>
      String(c[0]).includes('.cache'),
    );
    expect(draftWrites).toHaveLength(2);
    const draftPaths = draftWrites.map((c: any[]) => String(c[0]));
    expect(draftPaths.some((p) => p.includes('part-1.md'))).toBe(true);
    expect(draftPaths.some((p) => p.includes('part-2.md'))).toBe(true);
    const part1Write = draftWrites.find((c: any[]) => String(c[0]).includes('part-1.md'))!;
    expect(part1Write[1]).toBe('draft part 1');
  });

  it('reuses persisted drafts and skips the batch when all draft files exist', async () => {
    const cleanedFiles = ['part-1.md', 'part-2.md'];
    mockReaddirSync.mockReturnValue(cleanedFiles as any);
    mockExistsSync.mockImplementation((p: string) => {
      if ((p as string).includes('handout.md')) return false; // final handout not written
      return true; // cleaned dir AND .cache/handout/batch/drafts/* all present
    });
    mockReadFileSync.mockImplementation((p: string) => {
      if ((p as string).includes('.cache')) {
        return String(p).includes('part-1') ? 'persisted draft 1' : 'persisted draft 2';
      }
      return 'cleaned content';
    });

    await step.runAsync(mockContext);

    // Batch must NOT run — drafts came from disk.
    expect(mockRunBatchStep).not.toHaveBeenCalled();
    // Stage-2 mechanical merge still runs, using the persisted drafts.
    const handout = writtenHandout();
    expect(handout).toContain('persisted draft 1');
    expect(handout).toContain('persisted draft 2');
    // Final handout is still written.
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('handout.md'),
      expect.any(String),
      'utf-8',
    );
  });
});

describe('HandoutStep incremental cache & resume', () => {
  let step: any;
  let mockConfig: PipelineConfig;
  let mockContext: StepContext;

  const incrementalGenerateTextAsync = jest.fn<() => Promise<string>>();

  // Content written to the final handout.md (the metadata header is mocked to '').
  const writtenHandout = (): string => {
    const call = mockWriteFile.mock.calls.find((c: any[]) => String(c[0]).endsWith('handout.md'));
    return call ? String(call[1]) : '';
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (mockLoadContextText as jest.Mock).mockReturnValue('');
    mockResolveStepConfig.mockReturnValue({ execution: 'sync' });
    mockResolveAiConfig.mockReturnValue({ systemPrompt: 'Create handout', temperature: 0 });
    mockCreateAiService.mockReturnValue({ generateTextAsync: incrementalGenerateTextAsync });
    incrementalGenerateTextAsync.mockReset();

    const module = await import('../../../src/pipeline/steps/handoutStep.js');
    step = new module.HandoutStep();

    mockConfig = {
      profile: 'lecture',
      language: { input: 'it', output: 'it' },
      logging: { level: 'info', singleLine: true },
      paths: { inputDir: './input', outputDir: './output' },
      asr: { provider: 'whisper', whisper: { serverUrl: 'http://localhost:9000/asr' } },
      ai: {
        providers: { openai: { apiKey: 'sk-test' } },
        default: { provider: 'openai', model: 'gpt-4o-mini' },
      },
      steps: { handout: {} },
    } as any;
    mockContext = {
      config: mockConfig,
      outputDir: './output',
      logger: createMockLogger(),
      progress: createMockProgressReporter(),
    } as any;
  });

  it('persists each part fragment to the incremental cache after each AI call', async () => {
    mockReaddirSync.mockReturnValue(['part-1.md', 'part-2.md'] as any);
    // No handout.md, no cache yet → fresh run.
    mockExistsSync.mockImplementation((p: string) =>
      p.includes('handout.md') || p.includes('.cache') ? false : true,
    );
    mockReadFileSync.mockReturnValue('cleaned content');
    incrementalGenerateTextAsync
      .mockResolvedValueOnce('result 1')
      .mockResolvedValueOnce('result 2');

    await step.runAsync(mockContext);

    // Each fragment is written atomically (temp file + rename) under the cache.
    const fragmentWrites = mockWriteFile.mock.calls.filter((c: any[]) =>
      String(c[0]).includes('.cache') && String(c[0]).includes('incremental'),
    );
    expect(fragmentWrites).toHaveLength(2);
    expect(fragmentWrites.map((c: any[]) => c[1])).toEqual(['result 1', 'result 2']);
    // Every temp write is promoted to its final name via rename.
    expect(mockRename).toHaveBeenCalledTimes(2);
    // Final handout still contains both parts.
    expect(writtenHandout()).toContain('result 1');
    expect(writtenHandout()).toContain('result 2');
  });

  it('resumes from cached fragments, calling the AI only for the missing parts', async () => {
    mockReaddirSync.mockReturnValue(['part-1.md', 'part-2.md', 'part-3.md'] as any);
    // part-1 fragment already cached; part-2 and part-3 are missing.
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('handout.md')) return false;
      if (p.includes('.cache')) {
        // The incremental drafts dir exists, and only part-1's fragment is present.
        if (p.endsWith('part-2.md') || p.endsWith('part-3.md')) return false;
        return true;
      }
      return true;
    });
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes('.cache')) return 'cached part 1';
      return 'cleaned content';
    });
    incrementalGenerateTextAsync
      .mockResolvedValueOnce('result 2')
      .mockResolvedValueOnce('result 3');

    await step.runAsync(mockContext);

    // Only parts 2 and 3 hit the AI; part 1 was reused from cache.
    expect(incrementalGenerateTextAsync).toHaveBeenCalledTimes(2);
    const handout = writtenHandout();
    expect(handout).toContain('cached part 1');
    expect(handout).toContain('result 2');
    expect(handout).toContain('result 3');
  });

  it('skips the AI entirely when every fragment is already cached', async () => {
    mockReaddirSync.mockReturnValue(['part-1.md', 'part-2.md'] as any);
    mockExistsSync.mockImplementation((p: string) => (p.includes('handout.md') ? false : true));
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes('.cache')) return p.includes('part-1') ? 'cached 1' : 'cached 2';
      return 'cleaned content';
    });

    await step.runAsync(mockContext);

    expect(incrementalGenerateTextAsync).not.toHaveBeenCalled();
    const handout = writtenHandout();
    expect(handout).toContain('cached 1');
    expect(handout).toContain('cached 2');
  });

  it('keeps the completed fragment when a later part fails', async () => {
    mockReaddirSync.mockReturnValue(['part-1.md', 'part-2.md'] as any);
    mockExistsSync.mockImplementation((p: string) =>
      p.includes('handout.md') || p.includes('.cache') ? false : true,
    );
    mockReadFileSync.mockReturnValue('cleaned content');
    incrementalGenerateTextAsync
      .mockResolvedValueOnce('result 1')
      .mockRejectedValueOnce(new Error('AI error'));

    await expect(step.runAsync(mockContext)).rejects.toThrow('AI error');

    // part-1's fragment was persisted before the part-2 failure, so a re-run resumes.
    expect(mockRename).toHaveBeenCalledTimes(1);
    const fragmentWrites = mockWriteFile.mock.calls.filter((c: any[]) =>
      String(c[0]).includes('.cache') && String(c[0]).includes('incremental'),
    );
    expect(fragmentWrites).toHaveLength(1);
    expect(fragmentWrites[0][1]).toBe('result 1');
    // No final handout.md is written on failure.
    expect(mockWriteFile.mock.calls.some((c: any[]) => String(c[0]).endsWith('handout.md'))).toBe(false);
  });
});
