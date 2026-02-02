import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock loadConfig
const mockLoadConfig = jest.fn();
jest.unstable_mockModule('../src/config/loadConfig.js', () => ({
  loadConfig: mockLoadConfig,
}));

// Mock CliProgressReporter
const mockCliProgressReporter = jest.fn().mockImplementation(() => ({
  start: jest.fn(),
  increment: jest.fn(),
  updateMessage: jest.fn(),
  stop: jest.fn(),
}));
jest.unstable_mockModule('../src/services/cliProgressReporter.js', () => ({
  CliProgressReporter: mockCliProgressReporter,
}));

// Mock runPipeline
const mockRunPipeline = jest.fn().mockResolvedValue({ success: true } as never);
jest.unstable_mockModule('../src/pipeline/runPipeline.js', () => ({
  runPipeline: mockRunPipeline,
}));

describe('cli.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules(); // Clear module cache to allow re-import with new mocks
    const mockConfig = {
      profile: 'lecture',
      logging: { level: 'info', singleLine: true },
      language: { input: 'en', output: 'en' },
      paths: { inputDir: './input', outputDir: './output' },
      asr: { provider: 'whisper', whisper: { serverUrl: 'http://localhost:9000' } },
      ai: {
        providers: { openai: { apiKey: 'test-key' } },
        default: { provider: 'openai', model: 'gpt-4' },
      },
      profiles: {
        lecture: { prompts: { cleaning: '', handout: '', summary: '' } },
        meeting: { prompts: { cleaning: '', summary: '' } },
        other: { prompts: { cleaning: '', summary: '' } },
      },
    };
    mockLoadConfig.mockReturnValue(mockConfig);
    mockRunPipeline.mockResolvedValue({ success: true } as never);
  });

  it('should parse args and run pipeline', async () => {
    // Arrange
    const originalArgv = process.argv;
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never;
    });
    process.argv = ['node', 'cli.js', '--config', 'test-config.json'];

    // Act
    const importPromise = import('../src/cli.js');
    await new Promise((resolve) => setTimeout(resolve, 100));
    await importPromise;

    // Assert
    expect(mockLoadConfig).toHaveBeenCalledWith('test-config.json');
    expect(mockRunPipeline).toHaveBeenCalled();

    // Restore
    process.argv = originalArgv;
    mockExit.mockRestore();
  });

  it('should handle errors and exit with code 1', async () => {
    // Arrange
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never;
    });
    const testError = new Error('Test error');
    mockLoadConfig.mockImplementation(() => {
      throw testError;
    });

    const originalArgv = process.argv;
    process.argv = ['node', 'cli.js'];

    // Act
    await import('../src/cli.js');
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Assert
    expect(console.error).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    process.argv = originalArgv;
  });

  it('should exit with code 1 when pipeline fails', async () => {
    // Arrange
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never;
    });
    mockRunPipeline.mockResolvedValue({ success: false, error: 'Pipeline error' } as never);

    const originalArgv = process.argv;
    process.argv = ['node', 'cli.js'];

    // Act
    await import('../src/cli.js');
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Assert
    expect(console.error).toHaveBeenCalledWith('Pipeline error');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    process.argv = originalArgv;
  });
});
