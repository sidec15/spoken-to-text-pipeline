import { describe, it, expect } from '@jest/globals';
import type { Step, StepContext } from '../../src/pipeline/step.js';

describe('Step interface', () => {
  it('should have step interface contract', () => {
    // Arrange & Act
    const step: Step = {
      name: 'test-step',
      runAsync: async (_ctx: StepContext) => {
        // Implementation
      },
    };

    // Assert
    expect(step.name).toBe('test-step');
    expect(typeof step.runAsync).toBe('function');
  });

  it('should have step name property', () => {
    // Arrange & Act
    const step: Step = {
      name: 'my-step',
      runAsync: async () => {},
    };

    // Assert
    expect(step.name).toBe('my-step');
    expect(step.name).toBeTruthy();
  });

  it('should accept StepContext in runAsync', async () => {
    // Arrange
    const step: Step = {
      name: 'test-step',
      runAsync: async (ctx: StepContext) => {
        expect(ctx.config).toBeDefined();
        expect(ctx.logger).toBeDefined();
        expect(ctx.progress).toBeDefined();
      },
    };

    const mockContext: StepContext = {
      config: {} as any,
      logger: {} as any,
      progress: {} as any,
    };

    // Act & Assert - Should not throw
    await expect(step.runAsync(mockContext)).resolves.not.toThrow();
  });
});
