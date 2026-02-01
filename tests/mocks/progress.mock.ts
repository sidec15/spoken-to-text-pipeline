import { jest } from '@jest/globals';
import type { ProgressReporter } from '../../src/services/progress.js';

export function createMockProgressReporter(): ProgressReporter {
  return {
    start: jest.fn(),
    increment: jest.fn(),
    updateMessage: jest.fn(),
    stop: jest.fn(),
  };
}
