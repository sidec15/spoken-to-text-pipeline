import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock loadConfig
const mockLoadConfig = jest.fn();
jest.unstable_mockModule('../src/config/loadConfig.js', () => ({
  loadConfig: mockLoadConfig,
}));

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn(),
  withContext: jest.fn().mockReturnThis(),
};
const mockCreateLogger = jest.fn().mockReturnValue(mockLogger);
jest.unstable_mockModule('../src/services/logger.js', () => ({
  createLogger: mockCreateLogger,
}));

// Mock PipelineRunner
const mockRun = jest.fn().mockResolvedValue(undefined);
const mockPipelineRunner = jest.fn().mockImplementation(() => ({
  run: mockRun,
}));
jest.unstable_mockModule('../src/pipeline/pipelineRunner.js', () => ({
  PipelineRunner: mockPipelineRunner,
}));

// Mock steps
jest.unstable_mockModule('../src/pipeline/steps/loadProfileStep.js', () => ({
  LoadProfileStep: jest.fn(),
}));
jest.unstable_mockModule('../src/pipeline/steps/asrStep.js', () => ({
  AsrStep: jest.fn(),
}));
jest.unstable_mockModule('../src/pipeline/steps/cleaningStep.js', () => ({
  CleaningStep: jest.fn(),
}));
jest.unstable_mockModule('../src/pipeline/steps/handoutStep.js', () => ({
  HandoutStep: jest.fn(),
}));
jest.unstable_mockModule('../src/pipeline/steps/summaryStep.js', () => ({
  SummaryStep: jest.fn(),
}));

// Mock CliProgressReporter
jest.unstable_mockModule('../src/services/cliProgressReporter.js', () => ({
  CliProgressReporter: jest.fn(),
}));

describe('index.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules(); // Clear module cache to allow re-import with new mocks
    mockLoadConfig.mockReturnValue({
      profile: 'lecture',
      logging: { level: 'info', singleLine: true },
    });
  });

  it('should load config and run pipeline', async () => {
    // Arrange - Import the module which executes main() at module load
    // Since main() is called at module level, we need to test its effects
    // Use a small delay to allow async operations to complete
    const importPromise = import('../src/index.js');
    await new Promise((resolve) => setTimeout(resolve, 50));
    await importPromise;

    // Assert - Check that the mocks were called
    // Note: Since main() runs at import time, we verify the effects
    expect(mockLoadConfig).toHaveBeenCalledWith('pipeline.config.json');
    expect(mockCreateLogger).toHaveBeenCalled();
    expect(mockPipelineRunner).toHaveBeenCalled();
    expect(mockRun).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith('Starting pipeline');
    expect(mockLogger.info).toHaveBeenCalledWith('Pipeline completed successfully');
  });

  it('should handle errors and exit with code 1', async () => {
    // Arrange
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      // Don't actually exit, just verify it was called
      return undefined as never;
    });
    const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const testError = new Error('Test error');
    mockLoadConfig.mockImplementation(() => {
      throw testError;
    });

    // Act - Import will trigger main() which will catch the error
    // The error handler runs asynchronously, so we need to wait for it
    await import('../src/index.js');
    // Wait for the async error handler to execute
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Assert - Verify error was logged and process.exit was called
    expect(mockConsoleError).toHaveBeenCalledWith(testError);
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });
});
