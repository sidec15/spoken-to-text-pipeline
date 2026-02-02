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

// Mock WhisperAsrService
const mockTranscribeFileAsync = jest.fn<() => Promise<Buffer>>().mockResolvedValue(Buffer.from('transcript text'));
const mockWhisperAsrService = jest.fn().mockImplementation(() => ({
  transcribeFileAsync: mockTranscribeFileAsync,
}));

jest.unstable_mockModule('../../../src/services/asr/whisperAsrService.js', () => ({
  WhisperAsrService: mockWhisperAsrService,
}));

describe('AsrStep', () => {
  let step: any;
  let AsrStep: any;
  let mockConfig: PipelineConfig;
  let mockContext: StepContext;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset mock implementations
    mockTranscribeFileAsync.mockResolvedValue(Buffer.from('transcript text'));
    mockWhisperAsrService.mockImplementation(() => ({
      transcribeFileAsync: mockTranscribeFileAsync,
    }));
    const module = await import('../../../src/pipeline/steps/asrStep.js');
    AsrStep = module.AsrStep;
    step = new AsrStep();
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

  it('should process audio files', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['audio1.wav', 'audio2.wav'] as any);
    mockExistsSync.mockReturnValue(false);

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockMkdirSync).toHaveBeenCalled();
    expect(mockContext.progress.start).toHaveBeenCalled();
  });

  it('should call ASR service with correct parameters', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['audio.wav'] as any);
    mockExistsSync.mockReturnValue(false);

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockWhisperAsrService).toHaveBeenCalled();
  });

  it('should handle ASR errors', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['audio.wav'] as any);
    mockExistsSync.mockReturnValue(false);
    const mockErrorTranscribeFileAsync = jest.fn<() => Promise<Buffer>>().mockRejectedValue(new Error('ASR error'));
    mockWhisperAsrService.mockImplementation(() => ({
      transcribeFileAsync: mockErrorTranscribeFileAsync,
    }));

    // Act & Assert
    await expect(step.runAsync(mockContext)).rejects.toThrow('ASR error');
  });

  it('should write transcription results', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['audio.wav'] as any);
    mockExistsSync.mockReturnValue(false);

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('should update progress', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['audio1.wav', 'audio2.wav'] as any);
    mockExistsSync.mockReturnValue(false);

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockContext.progress.start).toHaveBeenCalled();
    expect(mockContext.progress.increment).toHaveBeenCalled();
    expect(mockContext.progress.stop).toHaveBeenCalled();
  });

  it('should skip when no audio files found', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue([] as any);

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockContext.logger.warn).toHaveBeenCalledWith('No audio files found, skipping ASR step');
    expect(mockContext.progress.start).not.toHaveBeenCalled();
  });

  it('should skip when all audio files already transcribed', async () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['audio1.wav', 'audio2.wav'] as any);
    mockExistsSync.mockReturnValue(true); // All .txt files already exist

    // Act
    await step.runAsync(mockContext);

    // Assert
    expect(mockContext.logger.info).toHaveBeenCalledWith(
      'All audio files already transcribed, skipping ASR step'
    );
    expect(mockTranscribeFileAsync).not.toHaveBeenCalled();
    expect(mockContext.progress.start).not.toHaveBeenCalled();
  });
});
