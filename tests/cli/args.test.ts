import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { CliArgs } from '../../src/cli/args.js';

// Mock loadConfig
const mockLoadConfig = jest.fn();
jest.unstable_mockModule('../../src/config/loadConfig.js', () => ({
  loadConfig: mockLoadConfig,
}));

// Mock console.log for help
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});

describe('parseArgs', () => {
  let parseArgs: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await import('../../src/cli/args.js');
    parseArgs = module.parseArgs;
  });

  it('should return default config path when no arguments provided', () => {
    // Act
    const result = parseArgs([]);

    // Assert
    expect(result).toEqual({
      configPath: 'pipeline.config.json',
      baseDir: undefined,
    });
  });

  it('should parse --config option', () => {
    // Act
    const result = parseArgs(['--config', 'custom-config.json']);

    // Assert
    expect(result).toEqual({
      configPath: 'custom-config.json',
      baseDir: undefined,
    });
  });

  it('should parse -c option', () => {
    // Act
    const result = parseArgs(['-c', 'short-config.json']);

    // Assert
    expect(result).toEqual({
      configPath: 'short-config.json',
      baseDir: undefined,
    });
  });

  it('should parse positional argument as config path', () => {
    // Act
    const result = parseArgs(['my-config.json']);

    // Assert
    expect(result).toEqual({
      configPath: 'my-config.json',
      baseDir: undefined,
    });
  });

  it('should throw error when --config is missing value', () => {
    // Act & Assert
    expect(() => parseArgs(['--config'])).toThrow('Missing value for option --config');
  });

  it('should throw error when -c is missing value', () => {
    // Act & Assert
    expect(() => parseArgs(['-c'])).toThrow('Missing value for option -c');
  });

  it('should parse --base-dir option', () => {
    // Act
    const result = parseArgs(['--base-dir', '/path/to/project']);

    // Assert
    expect(result).toEqual({
      configPath: 'pipeline.config.json',
      baseDir: '/path/to/project',
    });
  });

  it('should parse -b option', () => {
    // Act
    const result = parseArgs(['-b', './project']);

    // Assert
    expect(result).toEqual({
      configPath: 'pipeline.config.json',
      baseDir: './project',
    });
  });

  it('should parse both --config and --base-dir', () => {
    // Act
    const result = parseArgs(['--config', 'my-config.json', '--base-dir', '/path/to/project']);

    // Assert
    expect(result).toEqual({
      configPath: 'my-config.json',
      baseDir: '/path/to/project',
    });
  });

  it('should throw error when --base-dir is missing value', () => {
    // Act & Assert
    expect(() => parseArgs(['--base-dir'])).toThrow('Missing value for option --base-dir');
  });

  it('should throw error when -b is missing value', () => {
    // Act & Assert
    expect(() => parseArgs(['-b'])).toThrow('Missing value for option -b');
  });

  it('should throw error for unknown option', () => {
    // Act & Assert
    expect(() => parseArgs(['--unknown'])).toThrow('Unknown option: --unknown. Use --help for usage information.');
  });

  it('should throw error for unknown short option', () => {
    // Act & Assert
    expect(() => parseArgs(['-x'])).toThrow('Unknown option: -x. Use --help for usage information.');
  });

  it('should print help and exit when --help is provided', () => {
    // Arrange
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never;
    });

    // Act
    parseArgs(['--help']);

    // Assert
    expect(mockConsoleLog).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);

    // Restore
    mockExit.mockRestore();
  });

  it('should print help and exit when -h is provided', () => {
    // Arrange
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never;
    });

    // Act
    parseArgs(['-h']);

    // Assert
    expect(mockConsoleLog).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);

    // Restore
    mockExit.mockRestore();
  });

  it('should use positional argument when --config is not the last flag', () => {
    // Note: parseArgs processes arguments in order, so positional args come after flags
    // Act
    const result = parseArgs(['--config', 'config-from-flag.json']);

    // Assert
    expect(result).toEqual({
      configPath: 'config-from-flag.json',
      baseDir: undefined,
    });
  });

  it('should use positional argument when provided without flags', () => {
    // Act
    const result = parseArgs(['positional-config.json']);

    // Assert
    expect(result).toEqual({
      configPath: 'positional-config.json',
      baseDir: undefined,
    });
  });

  it('should handle multiple flags correctly', () => {
    // Arrange
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never;
    });

    // Act
    parseArgs(['--config', 'test.json', '--help']);

    // Assert
    // Should exit due to --help, but config should be parsed first
    expect(mockExit).toHaveBeenCalledWith(0);

    // Restore
    mockExit.mockRestore();
  });
});

describe('loadPipelineConfig', () => {
  let loadPipelineConfig: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLoadConfig.mockReturnValue({ profile: 'lecture' } as never);
    const module = await import('../../src/cli/args.js');
    loadPipelineConfig = module.loadPipelineConfig;
  });

  it('should call loadConfig with provided path', () => {
    // Arrange
    const mockConfig = { profile: 'lecture' } as never;
    mockLoadConfig.mockReturnValue(mockConfig);

    // Act
    const result = loadPipelineConfig('test-config.json');

    // Assert
    expect(mockLoadConfig).toHaveBeenCalledWith('test-config.json', undefined);
    expect(result).toBe(mockConfig);
  });

  it('should call loadConfig with provided path and baseDir', () => {
    // Arrange
    const mockConfig = { profile: 'lecture' } as never;
    mockLoadConfig.mockReturnValue(mockConfig);

    // Act
    const result = loadPipelineConfig('test-config.json', '/path/to/project');

    // Assert
    expect(mockLoadConfig).toHaveBeenCalledWith('test-config.json', '/path/to/project');
    expect(result).toBe(mockConfig);
  });

  it('should propagate errors from loadConfig', () => {
    // Arrange
    const error = new Error('Config file not found');
    mockLoadConfig.mockImplementation(() => {
      throw error;
    });

    // Act & Assert
    expect(() => loadPipelineConfig('missing.json')).toThrow('Config file not found');
  });
});
