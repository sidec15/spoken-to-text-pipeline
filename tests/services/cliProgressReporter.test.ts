import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock cli-progress
const mockStart = jest.fn();
const mockIncrement = jest.fn();
const mockUpdate = jest.fn();
const mockStop = jest.fn();

jest.unstable_mockModule('cli-progress', () => ({
  default: {
    SingleBar: jest.fn().mockImplementation(() => ({
      start: mockStart,
      increment: mockIncrement,
      update: mockUpdate,
      stop: mockStop,
      value: 0,
    })),
    Presets: {
      shades_classic: {},
    },
  },
  SingleBar: jest.fn().mockImplementation(() => ({
    start: mockStart,
    increment: mockIncrement,
    update: mockUpdate,
    stop: mockStop,
    value: 0,
  })),
  Presets: {
    shades_classic: {},
  },
}));

describe('CliProgressReporter', () => {
  let reporter: any;
  let CliProgressReporter: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset mock implementations to default (no-op)
    mockStart.mockImplementation(() => {});
    mockIncrement.mockImplementation(() => {});
    mockUpdate.mockImplementation(() => {});
    mockStop.mockImplementation(() => {});
    const module = await import('../../src/services/cliProgressReporter.js');
    CliProgressReporter = module.CliProgressReporter;
    reporter = new CliProgressReporter();
  });

  it('should create CLI progress bar', () => {
    // Act
    reporter.start(100, 'Processing');

    // Assert
    expect(mockStart).toHaveBeenCalledWith(100, 0);
  });

  it('should update progress', () => {
    // Arrange
    reporter.start(100, 'Processing');

    // Act
    reporter.increment(10);

    // Assert
    expect(mockIncrement).toHaveBeenCalledWith(10);
  });

  it('should update message', () => {
    // Arrange
    reporter.start(100, 'Initial message');
    (mockUpdate as jest.Mock).mockReturnValue(0);

    // Act
    reporter.updateMessage('Updated message');

    // Assert
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('should complete progress bar', () => {
    // Arrange
    reporter.start(100, 'Processing');

    // Act
    reporter.stop();

    // Assert
    expect(mockStop).toHaveBeenCalled();
  });

  it('should handle errors', () => {
    // Arrange
    mockStart.mockImplementationOnce(() => {
      throw new Error('Start error');
    });

    // Act & Assert
    expect(() => reporter.start(100)).toThrow('Start error');
  });

  it('should use default label when not provided', () => {
    // Act
    reporter.start(100);

    // Assert
    expect(mockStart).toHaveBeenCalledWith(100, 0);
  });

  it('should handle increment without start', () => {
    // Act & Assert - Should not throw
    expect(() => reporter.increment()).not.toThrow();
  });

  it('should handle stop without start', () => {
    // Act & Assert - Should not throw
    expect(() => reporter.stop()).not.toThrow();
  });
});
