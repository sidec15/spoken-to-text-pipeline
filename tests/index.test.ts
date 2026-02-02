import { describe, it, expect, beforeEach, jest } from '@jest/globals';

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
const mockRun = jest.fn().mockResolvedValue(undefined as never);
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

describe('index.ts (library exports)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('should export runPipeline function', async () => {
    const module = await import('../src/index.js');
    expect(typeof module.runPipeline).toBe('function');
  });

  it('should export all public types', async () => {
    const module = await import('../src/index.js');
    // Verify that types are exported (they won't exist at runtime, but the import should succeed)
    expect(module).toBeDefined();
  });
});
