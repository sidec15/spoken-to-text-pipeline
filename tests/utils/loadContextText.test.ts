import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as path from 'node:path';

// Create mock function
const mockReadFileSync = jest.fn();

// Mock fs module for ESM
jest.unstable_mockModule('node:fs', () => ({
  default: {
    readFileSync: mockReadFileSync,
  },
  readFileSync: mockReadFileSync,
}));

describe('loadContextText', () => {
  let loadContextText: (paths?: string[]) => string;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Dynamically import after mocking
    const module = await import('../../src/utils/loadContextText.js');
    loadContextText = module.loadContextText;
  });

  // Type assertion helper to ensure loadContextText is defined
  const getLoadContextText = (): typeof loadContextText => {
    if (!loadContextText) {
      throw new Error('loadContextText not initialized');
    }
    return loadContextText;
  };

  it('should load single text file', () => {
    // Arrange
    const filePath = './test.txt';
    const fileContent = 'Test content';
    mockReadFileSync.mockReturnValue(fileContent);

    // Act
    const result = getLoadContextText()([filePath]);

    // Assert
    expect(result).toBe(fileContent);
    expect(mockReadFileSync).toHaveBeenCalledTimes(1);
  });

  it('should load multiple text files', () => {
    // Arrange
    const filePaths = ['./file1.txt', './file2.txt'];
    mockReadFileSync
      .mockReturnValueOnce('Content 1')
      .mockReturnValueOnce('Content 2');

    // Act
    const result = getLoadContextText()(filePaths);

    // Assert
    expect(result).toContain('Content 1');
    expect(result).toContain('Content 2');
    expect(result).toContain('---'); // Separator
    expect(mockReadFileSync).toHaveBeenCalledTimes(2);
  });

  it('should handle non-existent files', () => {
    // Arrange
    const filePath = './nonexistent.txt';
    const error = new Error('File not found');
    mockReadFileSync.mockImplementation(() => {
      throw error;
    });

    // Act & Assert
    expect(() => getLoadContextText()([filePath])).toThrow('File not found');
  });

  it('should concatenate text sources', () => {
    // Arrange
    const filePaths = ['./file1.txt', './file2.txt', './file3.txt'];
    mockReadFileSync
      .mockReturnValueOnce('Content 1')
      .mockReturnValueOnce('Content 2')
      .mockReturnValueOnce('Content 3');

    // Act
    const result = getLoadContextText()(filePaths);

    // Assert
    const parts = result.split('\n\n---\n\n');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('Content 1');
    expect(parts[1]).toBe('Content 2');
    expect(parts[2]).toBe('Content 3');
  });

  it('should handle empty array', () => {
    // Act
    const result = getLoadContextText()([]);

    // Assert
    expect(result).toBe('');
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it('should resolve paths relative to process.cwd()', () => {
    // Arrange
    const filePath = './relative/path.txt';
    const expectedResolvedPath = path.resolve(process.cwd(), filePath);
    mockReadFileSync.mockReturnValue('Content\n');
    
    // Act
    getLoadContextText()([filePath]);
    
    // Assert - verify the path was resolved correctly relative to process.cwd()
    expect(mockReadFileSync).toHaveBeenCalledWith(expectedResolvedPath, 'utf-8');
    expect(mockReadFileSync).toHaveBeenCalledTimes(1);
  });
});
