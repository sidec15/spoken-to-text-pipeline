import { jest } from '@jest/globals';
import type { Logger } from '../../src/services/logger.js';

export function createMockLogger(): Logger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    silly: jest.fn(),
    withContext: jest.fn().mockReturnThis(),
  };
}
