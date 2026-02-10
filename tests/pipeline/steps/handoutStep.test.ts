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

jest.unstable_mockModule('../../../src/services/ai/aiServiceFactory.js', () => ({
  createAiService: mockCreateAiService,
  resolveAiConfig: mockResolveAiConfig,
}));

// Mock loadContextText
const mockLoadContextText = jest.fn<(paths?: string[]) => string>().mockReturnValue('');
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
      profiles: {
        lecture: {
          prompts: { cleaning: 'test', handout: 'test', summary: 'test' },
        },
        meeting: {
          prompts: { cleaning: 'test', handout: 'test', summary: 'test' },
        },
        other: {
          prompts: { cleaning: 'test', handout: 'test', summary: 'test' },
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

  it('should use chunking strategy for large content', async () => {
    // Arrange
    const largeContent = 'x'.repeat(400000); // ~100K tokens (exceeds MAX_SAFE_INPUT_TOKENS)
    mockReaddirSync.mockReturnValue(['part-1.md', 'part-2.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('handout.md') ? false : true;
    });
    mockReadFileSync.mockReturnValue(largeContent);
    mockResolveAiConfig.mockReturnValue({
      systemPrompt: 'Create handout',
      temperature: 0,
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

  it('should handle chunking when content exceeds token limits', async () => {
    // Arrange
    // Create content large enough to trigger chunking
    // CHUNK_SIZE_CHARS = 80000 * 4 = 320000, so we need > 320000 chars
    const largeContent = 'x'.repeat(400000);
    mockReaddirSync.mockReturnValue(['part-1.md', 'part-2.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('handout.md') ? false : true;
    });
    mockReadFileSync.mockReturnValue(largeContent);
    mockResolveAiConfig.mockReturnValue({
      systemPrompt: 'Create handout',
      temperature: 0,
    });
    // Mock chunk result
    mockGenerateTextAsync.mockResolvedValue('chunk handout');

    // Act
    await step.runAsync(mockContext);

    // Assert
    // Should use chunking strategy
    expect(mockContext.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('exceeds safe limit')
    );
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('should handle multiple chunks and merge', async () => {
    // Arrange
    // Create content large enough to trigger multiple chunks
    const largeContent = 'x'.repeat(700000); // Large enough for multiple chunks
    mockReaddirSync.mockReturnValue(['part-1.md', 'part-2.md', 'part-3.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('handout.md') ? false : true;
    });
    mockReadFileSync.mockReturnValue(largeContent);
    mockResolveAiConfig.mockReturnValue({
      systemPrompt: 'Create handout',
      temperature: 0,
    });
    // Mock multiple chunk results and final merge
    mockGenerateTextAsync
      .mockResolvedValueOnce('chunk 1 handout')
      .mockResolvedValueOnce('chunk 2 handout')
      .mockResolvedValueOnce('merged final handout');

    // Act
    await step.runAsync(mockContext);

    // Assert
    // Should call generateTextAsync multiple times (chunks + merge)
    expect(mockGenerateTextAsync.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(mockWriteFile).toHaveBeenCalled();
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
    expect(mockLoadContextText).toHaveBeenCalledWith(['ref1.txt', 'ref2.md'], undefined);
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

  it('should pass context to AI service during chunking', async () => {
    // Arrange
    const contextText = 'reference material content';
    (mockLoadContextText as jest.Mock).mockReturnValue(contextText);
    mockConfig.context = { textSources: ['ref.txt'] };
    const largeContent = 'x'.repeat(400000);
    mockReaddirSync.mockReturnValue(['part-1.md', 'part-2.md'] as any);
    mockExistsSync.mockImplementation((path: string) => {
      return path.includes('handout.md') ? false : true;
    });
    mockReadFileSync.mockReturnValue(largeContent);
    mockResolveAiConfig.mockReturnValue({
      systemPrompt: 'Create handout',
      temperature: 0,
    });
    mockGenerateTextAsync.mockResolvedValue('chunk handout');

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
});
