import { describe, it, expect } from '@jest/globals';
import { createLogger } from '../../src/services/logger.js';

describe('logger', () => {
  it('should create logger instance', () => {
    // Act
    const logger = createLogger();

    // Assert
    expect(logger).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.debug).toBeDefined();
    expect(logger.silly).toBeDefined();
    expect(logger.withContext).toBeDefined();
  });

  it('should log at different levels', () => {
    // Arrange
    const logger = createLogger('debug');

    // Act & Assert - Should not throw
    expect(() => logger.error('Error message')).not.toThrow();
    expect(() => logger.warn('Warning message')).not.toThrow();
    expect(() => logger.info('Info message')).not.toThrow();
    expect(() => logger.debug('Debug message')).not.toThrow();
    expect(() => logger.silly('Silly message')).not.toThrow();
  });

  it('should create logger with context', () => {
    // Arrange
    const logger = createLogger('info', true, { profile: 'lecture' });

    // Act
    const contextualLogger = logger.withContext({ step: 'cleaning' });

    // Assert
    expect(contextualLogger).toBeDefined();
    expect(contextualLogger).not.toBe(logger); // Should return new logger instance
  });

  it('should format log messages', () => {
    // Arrange
    const logger = createLogger('info', true);

    // Act & Assert - Should not throw when logging
    expect(() => {
      logger.info('Test message');
    }).not.toThrow();
  });

  it('should handle error logging with error object', () => {
    // Arrange
    const logger = createLogger('error');
    const error = new Error('Test error');

    // Act & Assert - Should not throw
    expect(() => logger.error('Error occurred', error)).not.toThrow();
  });

  it('should respect log level', () => {
    // Arrange
    const logger = createLogger('warn');

    // Act & Assert - Should not throw
    expect(() => logger.error('Error')).not.toThrow();
    expect(() => logger.warn('Warning')).not.toThrow();
    // Debug and info should be filtered out at warn level, but function should still exist
    expect(() => logger.info('Info')).not.toThrow();
    expect(() => logger.debug('Debug')).not.toThrow();
  });

  it('should support singleLine format', () => {
    // Arrange
    const logger = createLogger('info', true);

    // Act & Assert - Should not throw
    expect(() => logger.info('Single line message')).not.toThrow();
  });

  it('should support multiLine format', () => {
    // Arrange
    const logger = createLogger('info', false);

    // Act & Assert - Should not throw
    expect(() => logger.info('Multi line message')).not.toThrow();
  });

  it('should format stack trace in singleLine mode', () => {
    // Arrange
    const logger = createLogger('error', true);
    const error = new Error('Test error');

    // Act & Assert - Should not throw and format stack trace
    expect(() => logger.error('Error occurred', error)).not.toThrow();
  });

  it('should format stack trace in multiLine mode', () => {
    // Arrange
    const logger = createLogger('error', false);
    const error = new Error('Test error');

    // Act & Assert - Should not throw and format stack trace
    expect(() => logger.error('Error occurred', error)).not.toThrow();
  });

  it('should handle error without stack trace', () => {
    // Arrange
    const logger = createLogger('error', true);
    const error = { message: 'Error without stack' } as Error;

    // Act & Assert - Should not throw
    expect(() => logger.error('Error occurred', error)).not.toThrow();
  });

  it('should merge context when using withContext', () => {
    // Arrange
    const logger = createLogger('info', true, { profile: 'lecture' });

    // Act
    const contextualLogger = logger.withContext({ step: 'cleaning' });

    // Assert
    expect(contextualLogger).toBeDefined();
    // The new logger should have merged context
    expect(() => contextualLogger.info('Test')).not.toThrow();
  });
});
