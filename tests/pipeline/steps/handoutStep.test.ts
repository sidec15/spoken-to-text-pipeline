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
      return path.includes('handout.md') ? false : true;
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
      return path.includes('handout.md') ? false : true; // handout.md doesn't exist, other files do
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
      return path.includes('handout.md') ? false : true;
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
      return path.includes('handout.md') ? false : true;
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
      return path.includes('handout.md') ? false : true;
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
      return path.includes('handout.md') ? false : true;
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
      return path.includes('handout.md') ? false : true;
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
      return path.includes('handout.md') ? false : true;
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
      return path.includes('handout.md') ? false : true;
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
      return path.includes('handout.md') ? false : true;
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

describe('buildHandoutMergePrompt', () => {
  it('includes renumbering instruction and the language code', async () => {
    const { buildHandoutMergePrompt } = await import('../../../src/pipeline/steps/handoutStep.js');
    const p = buildHandoutMergePrompt('it');
    expect(p).toMatch(/renumber/i);
    expect(p).toContain('"it"');
  });
});

describe('HandoutStep batch mode', () => {
  let step: any;
  let mockConfig: PipelineConfig;
  let mockContext: StepContext;

  // A separate merge generateTextAsync so we can distinguish it from Stage-1 batch calls
  const mockMergeGenerateTextAsync = jest.fn<() => Promise<string>>().mockResolvedValue('merged handout');

  beforeEach(async () => {
    jest.clearAllMocks();
    (mockLoadContextText as jest.Mock).mockReturnValue('');

    // Default: sync; individual tests override to 'batch'
    mockResolveStepConfig.mockReturnValue({ execution: 'batch' });
    mockResolveAiConfig.mockReturnValue({ systemPrompt: 'Create handout', temperature: 0 });
    mockCreateBatchAiService.mockReturnValue({});
    mockGetBatchTuning.mockReturnValue({ pollIntervalMs: 5000, maxWaitMs: undefined });
    mockRunBatchStep.mockResolvedValue([]);

    // Stage-2 merge service
    mockCreateAiService.mockReturnValue({ generateTextAsync: mockMergeGenerateTextAsync });
    mockMergeGenerateTextAsync.mockResolvedValue('merged handout');

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

  it('should run batch stage-1 with correct customIds in numeric order, draft addendum, neighbor excerpts, and stage-2 merge via generateTextAsync', async () => {
    // Arrange: 3 cleaned parts, handout.md does not exist
    const cleanedFiles = ['part-1.md', 'part-2.md', 'part-3.md'];
    mockReaddirSync.mockReturnValue(cleanedFiles as any);
    mockExistsSync.mockImplementation((p: string) => {
      if ((p as string).includes('handout.md')) return false; // handout not written yet
      if ((p as string).includes('handout-drafts')) return false; // no persisted drafts yet
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

    // Stage-2 merge: createAiService called and generateTextAsync called with merge prompt
    expect(mockCreateAiService).toHaveBeenCalledWith(mockConfig, 'handout');
    expect(mockMergeGenerateTextAsync).toHaveBeenCalledTimes(1);
    const mergeCall = (mockMergeGenerateTextAsync.mock.calls[0] as any[])[0] as any;
    expect(mergeCall.systemPrompt).toMatch(/renumber/i);

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
      if ((p as string).includes('handout-drafts')) return false;
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
      if ((p as string).includes('handout-drafts')) return false; // no persisted drafts yet
      return true;
    });
    mockReadFileSync.mockReturnValue('cleaned content');
    mockRunBatchStep.mockResolvedValue([
      { customId: 'handout::part-1', text: 'draft part 1' },
      { customId: 'handout::part-2', text: 'draft part 2' },
    ]);

    await step.runAsync(mockContext);

    // Each draft written under handout-drafts/, keyed by part base name.
    const draftWrites = mockWriteFile.mock.calls.filter((c: any[]) =>
      String(c[0]).includes('handout-drafts'),
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
      return true; // cleaned dir AND handout-drafts/* all present
    });
    mockReadFileSync.mockImplementation((p: string) => {
      if ((p as string).includes('handout-drafts')) {
        return String(p).includes('part-1') ? 'persisted draft 1' : 'persisted draft 2';
      }
      return 'cleaned content';
    });

    await step.runAsync(mockContext);

    // Batch must NOT run — drafts came from disk.
    expect(mockRunBatchStep).not.toHaveBeenCalled();
    // Stage-2 merge still runs, using the persisted drafts.
    expect(mockMergeGenerateTextAsync).toHaveBeenCalledTimes(1);
    const mergeCall = (mockMergeGenerateTextAsync.mock.calls[0] as any[])[0] as any;
    expect(mergeCall.userPrompt).toContain('persisted draft 1');
    expect(mergeCall.userPrompt).toContain('persisted draft 2');
    // Final handout is still written.
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('handout.md'),
      expect.any(String),
      'utf-8',
    );
  });
});
