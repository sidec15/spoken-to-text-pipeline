import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createMockLogger } from '../../mocks/logger.mock.js';
import type { AsrTranscribeOptions } from '../../../src/services/asr/asr.types.js';

// Create mock function
const mockReadFile = jest.fn<() => Promise<Buffer>>();

// Mock fs for ESM
jest.unstable_mockModule('node:fs', () => ({
  default: {
    promises: {
      readFile: mockReadFile,
    },
  },
  promises: {
    readFile: mockReadFile,
  },
}));

// Mock fetch
global.fetch = jest.fn() as any;

describe('WhisperAsrService', () => {
  let service: any;
  let WhisperAsrService: any;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLogger = createMockLogger();
    const module = await import('../../../src/services/asr/whisperAsrService.js');
    WhisperAsrService = module.WhisperAsrService;
    service = new WhisperAsrService('http://localhost:9000/asr', mockLogger);
    (global.fetch as any).mockClear();
    mockReadFile.mockResolvedValue(Buffer.from('mock audio data'));
  });

  it('should transcribe audio file', async () => {
    // Arrange
    const mockAudioBuffer = Buffer.from('mock audio data');
    const mockResponse = {
      ok: true,
      arrayBuffer: jest.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(mockAudioBuffer.buffer),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const options: AsrTranscribeOptions = {
      task: 'transcribe',
      outputFormat: 'txt',
      language: 'it',
    };

    // Act
    const result = await service.transcribeFileAsync('/path/to/audio.wav', options);

    // Assert
    expect(result).toBeInstanceOf(Buffer);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('should call Whisper API with correct parameters', async () => {
    // Arrange
    const mockResponse = {
      ok: true,
      arrayBuffer: jest.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(Buffer.from('transcript').buffer),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const options: AsrTranscribeOptions = {
      task: 'transcribe',
      outputFormat: 'txt',
      language: 'it',
      temperature: 0.5,
    };

    // Act
    await service.transcribeFileAsync('/path/to/audio.wav', options);

    // Assert
    const fetchCall = (global.fetch as any).mock.calls[0];
    expect(fetchCall[0]).toContain('http://localhost:9000/asr');
    expect(fetchCall[0]).toContain('task=transcribe');
    expect(fetchCall[0]).toContain('language=it');
    expect(fetchCall[0]).toContain('temperature=0.5');
  });

  it('should use VAD when enabled', async () => {
    // Arrange
    const mockResponse = {
      ok: true,
      arrayBuffer: jest.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(Buffer.from('transcript').buffer),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const options: AsrTranscribeOptions = {
      task: 'transcribe',
      outputFormat: 'txt',
      vad: {
        enabled: true,
        threshold: 0.5,
      },
    };

    // Act
    await service.transcribeFileAsync('/path/to/audio.wav', options);

    // Assert
    const fetchCall = (global.fetch as any).mock.calls[0];
    expect(fetchCall[0]).toContain('vad_filter=true');
    expect(fetchCall[0]).toContain('vad_threshold=0.5');
  });

  it('should use correct model', async () => {
    // Arrange
    const mockResponse = {
      ok: true,
      arrayBuffer: jest.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(Buffer.from('transcript').buffer),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const options: AsrTranscribeOptions = {
      task: 'transcribe',
      outputFormat: 'txt',
    };

    // Act
    await service.transcribeFileAsync('/path/to/audio.wav', options);

    // Assert
    expect(global.fetch).toHaveBeenCalled();
  });

  it('should handle API errors', async () => {
    // Arrange
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const options: AsrTranscribeOptions = {
      task: 'transcribe',
      outputFormat: 'txt',
    };

    // Act & Assert
    await expect(
      service.transcribeFileAsync('/path/to/audio.wav', options)
    ).rejects.toThrow();
  });

  it('should handle network errors', async () => {
    // Arrange
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const options: AsrTranscribeOptions = {
      task: 'transcribe',
      outputFormat: 'txt',
    };

    // Act & Assert
    await expect(
      service.transcribeFileAsync('/path/to/audio.wav', options)
    ).rejects.toThrow('Network error');
  });

  it('should return transcription result', async () => {
    // Arrange
    const transcriptText = 'This is a transcription';
    // Create ArrayBuffer from text - create Buffer first, then get its buffer
    // This ensures the ArrayBuffer contains only the text bytes
    const textBuffer = Buffer.from(transcriptText, 'utf-8');
    const arrayBuffer = textBuffer.buffer.slice(textBuffer.byteOffset, textBuffer.byteOffset + textBuffer.byteLength);
    const mockArrayBuffer = jest.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(arrayBuffer);
    const mockResponse = {
      ok: true,
      arrayBuffer: mockArrayBuffer,
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const options: AsrTranscribeOptions = {
      task: 'transcribe',
      outputFormat: 'txt',
    };

    // Act
    const result = await service.transcribeFileAsync('/path/to/audio.wav', options);

    // Assert
    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString('utf-8')).toBe(transcriptText);
  });
});
