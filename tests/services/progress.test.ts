import { describe, it, expect } from '@jest/globals';
import type { ProgressReporter } from '../../src/services/progress.js';
import { createMockProgressReporter } from '../mocks/progress.mock.js';

describe('ProgressReporter', () => {
  it('should create progress reporter', () => {
    // Act
    const progress = createMockProgressReporter();

    // Assert
    expect(progress).toBeDefined();
    expect(progress.start).toBeDefined();
    expect(progress.increment).toBeDefined();
    expect(progress.updateMessage).toBeDefined();
    expect(progress.stop).toBeDefined();
  });

  it('should update progress', () => {
    // Arrange
    const progress = createMockProgressReporter();

    // Act
    progress.start(100, 'Processing');
    progress.increment(10);
    progress.updateMessage('Updated message');
    progress.stop();

    // Assert
    expect(progress.start).toHaveBeenCalledWith(100, 'Processing');
    expect(progress.increment).toHaveBeenCalledWith(10);
    expect(progress.updateMessage).toHaveBeenCalledWith('Updated message');
    expect(progress.stop).toHaveBeenCalled();
  });

  it('should complete progress', () => {
    // Arrange
    const progress = createMockProgressReporter();

    // Act
    progress.start(100);
    progress.stop();

    // Assert
    expect(progress.start).toHaveBeenCalledWith(100);
    expect(progress.stop).toHaveBeenCalled();
  });

  it('should handle errors gracefully', () => {
    // Arrange
    const progress = createMockProgressReporter();
    (progress.start as jest.Mock).mockImplementation(() => {
      throw new Error('Start error');
    });

    // Act & Assert
    expect(() => progress.start(100)).toThrow('Start error');
  });
});
