# Unit Test Implementation Plan

## Overview
This document outlines the unit test implementation strategy using Jest for the spoken-to-text-pipeline project.

## Jest Configuration

### Required Dependencies
- `jest` - Test framework
- `@types/jest` - TypeScript types for Jest
- `ts-jest` - TypeScript preprocessor for Jest
- `@jest/globals` - ESM-compatible Jest globals

### Jest Configuration (`jest.config.js`)
```javascript
export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
```

## Test Structure

### Directory Organization
```
spoken-to-text-pipeline/
├── tests/
│   ├── setup.ts                    # Test setup and global mocks
│   ├── fixtures/                   # Test fixtures and mock data
│   │   ├── configs/
│   │   │   ├── valid-config.json
│   │   │   └── invalid-config.json
│   │   ├── responses/
│   │   └── files/
│   ├── mocks/                      # Reusable mock implementations
│   │   ├── logger.mock.ts
│   │   ├── progress.mock.ts
│   │   └── services.mock.ts
│   ├── config/
│   │   ├── loadConfig.test.ts
│   │   └── profilePresets.test.ts
│   ├── pipeline/
│   │   ├── pipelineRunner.test.ts
│   │   └── step.test.ts
│   │   └── steps/
│   │       ├── asrStep.test.ts
│   │       ├── cleaningStep.test.ts
│   │       ├── handoutStep.test.ts
│   │       ├── loadProfileStep.test.ts
│   │       └── summaryStep.test.ts
│   ├── services/
│   │   ├── ai/
│   │   │   ├── aiServiceFactory.test.ts
│   │   │   ├── resolveStepConfig.test.ts
│   │   │   ├── openai/
│   │   │   │   ├── openaiAiService.test.ts
│   │   │   │   └── resolveOpenAiConfig.test.ts
│   │   │   └── deepseek/
│   │   │       ├── deepseekAiService.test.ts
│   │   │       └── resolveDeepSeekConfig.test.ts
│   │   ├── asr/
│   │   │   ├── whisperAsrService.test.ts
│   │   │   └── resolveWhisperConfig.test.ts
│   │   ├── logger.test.ts
│   │   ├── progress.test.ts
│   │   └── cliProgressReporter.test.ts
│   └── utils/
│       ├── loadContextText.test.ts
│       └── resolveOutputDir.test.ts
└── src/
    └── ... (source code)
```

## Test Coverage Plan

### 1. Configuration (`src/config/`)

#### `loadConfig.test.ts`
- ✅ Load valid config file (absolute path)
- ✅ Load valid config file (relative path)
- ✅ Throw error for non-existent file
- ✅ Throw error for invalid JSON
- ✅ Validate all required fields
- ✅ Validate profile values (lecture, meeting, other)
- ✅ Validate language structure
- ✅ Validate logging structure
- ✅ Validate paths structure
- ✅ Validate ASR configuration
- ✅ Validate AI providers pool
- ✅ Validate AI default configuration
- ✅ Validate AI step overrides
- ✅ Validate profiles structure
- ✅ Validate context (optional)
- ✅ Error messages are descriptive

#### `profilePresets.test.ts`
- ✅ Get preset for lecture profile
- ✅ Get preset for meeting profile
- ✅ Get preset for other profile
- ✅ Throw error for invalid profile
- ✅ Preset structure matches expected format

### 2. Pipeline (`src/pipeline/`)

#### `pipelineRunner.test.ts`
- ✅ Run all steps in sequence
- ✅ Pass context to each step
- ✅ Log step start and completion
- ✅ Fail fast on step error
- ✅ Propagate step errors
- ✅ Create step-specific logger context

#### `step.test.ts` (if abstract base class exists)
- ✅ Step interface contract
- ✅ Step name property

### 3. Pipeline Steps (`src/pipeline/steps/`)

#### `loadProfileStep.test.ts`
- ✅ Load profile from config
- ✅ Set profile in context
- ✅ Handle invalid profile

#### `asrStep.test.ts`
- ✅ Process audio files
- ✅ Call ASR service with correct parameters
- ✅ Handle ASR errors
- ✅ Write transcription results
- ✅ Update progress

#### `cleaningStep.test.ts`
- ✅ Call AI service with cleaning prompt
- ✅ Process transcription text
- ✅ Handle AI service errors
- ✅ Write cleaned text
- ✅ Update progress

#### `handoutStep.test.ts`
- ✅ Call AI service with handout prompt
- ✅ Process cleaned text
- ✅ Handle AI service errors
- ✅ Write handout output
- ✅ Skip for non-lecture profiles
- ✅ Update progress

#### `summaryStep.test.ts`
- ✅ Call AI service with summary prompt
- ✅ Process text with word count limit
- ✅ Handle AI service errors
- ✅ Write summary output
- ✅ Update progress

### 4. AI Services (`src/services/ai/`)

#### `aiServiceFactory.test.ts`
- ✅ Create OpenAI service
- ✅ Create DeepSeek service
- ✅ Resolve step config with defaults
- ✅ Resolve step config with overrides
- ✅ Get API key from provider pool
- ✅ Throw error for missing provider
- ✅ Throw error for unsupported provider
- ✅ Resolve AI config for OpenAI
- ✅ Resolve AI config for DeepSeek

#### `resolveStepConfig.test.ts`
- ✅ Merge default with step override
- ✅ Use default when step override missing
- ✅ Override provider
- ✅ Override model
- ✅ Merge overrides object

#### `openaiAiService.test.ts`
- ✅ Generate text with valid options
- ✅ Handle API errors
- ✅ Handle network errors
- ✅ Return generated text
- ✅ Use correct model
- ✅ Pass temperature and maxTokens

#### `resolveOpenAiConfig.test.ts`
- ✅ Resolve config for cleaning step
- ✅ Resolve config for handout step
- ✅ Resolve config for summary step
- ✅ Apply preset overrides
- ✅ Apply step-specific overrides

#### `deepseekAiService.test.ts`
- ✅ Generate text with valid options
- ✅ Handle API errors
- ✅ Handle network errors
- ✅ Return generated text
- ✅ Use correct model

#### `resolveDeepSeekConfig.test.ts`
- ✅ Resolve config for cleaning step
- ✅ Resolve config for handout step
- ✅ Resolve config for summary step
- ✅ Apply preset overrides
- ✅ Apply step-specific overrides

### 5. ASR Services (`src/services/asr/`)

#### `whisperAsrService.test.ts`
- ✅ Transcribe audio file
- ✅ Call Whisper API with correct parameters
- ✅ Handle API errors
- ✅ Handle network errors
- ✅ Return transcription result
- ✅ Use VAD when enabled
- ✅ Use correct model

#### `resolveWhisperConfig.test.ts`
- ✅ Resolve config with defaults
- ✅ Resolve config with VAD enabled
- ✅ Resolve config with VAD disabled
- ✅ Apply preset overrides

### 6. Utilities (`src/utils/`)

#### `loadContextText.test.ts`
- ✅ Load single text file
- ✅ Load multiple text files
- ✅ Handle non-existent files
- ✅ Concatenate text sources
- ✅ Handle empty array

#### `resolveOutputDir.test.ts`
- ✅ Resolve absolute path
- ✅ Resolve relative path
- ✅ Create directory if not exists
- ✅ Handle permission errors

### 7. Services (`src/services/`)

#### `logger.test.ts`
- ✅ Create logger instance
- ✅ Log at different levels
- ✅ Create logger with context
- ✅ Format log messages

#### `progress.test.ts`
- ✅ Create progress reporter
- ✅ Update progress
- ✅ Complete progress
- ✅ Handle errors

#### `cliProgressReporter.test.ts`
- ✅ Create CLI progress bar
- ✅ Update progress
- ✅ Complete progress bar
- ✅ Handle errors

## Mocking Strategy

### External Dependencies
- **OpenAI SDK** - Mock API calls
- **DeepSeek SDK** - Mock API calls
- **Whisper API** - Mock HTTP requests
- **File System** - Mock `fs` operations
- **Winston** - Mock logger methods

### Test Utilities

#### `tests/mocks/logger.mock.ts`
```typescript
export function createMockLogger(): Logger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    withContext: jest.fn().mockReturnThis(),
  };
}
```

#### `tests/mocks/progress.mock.ts`
```typescript
export function createMockProgressReporter(): ProgressReporter {
  return {
    start: jest.fn(),
    update: jest.fn(),
    complete: jest.fn(),
  };
}
```

#### `tests/fixtures/configs/valid-config.json`
- Complete valid configuration file for testing

#### `tests/fixtures/configs/invalid-config.json`
- Invalid configuration files for error testing

## Test Scripts

Add to `package.json`:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

## Implementation Priority

### Phase 1: Core Infrastructure
1. Jest configuration setup
2. Test utilities and mocks
3. Configuration tests (`loadConfig`, `profilePresets`)

### Phase 2: Services
4. AI service factory tests
5. AI service implementations (OpenAI, DeepSeek)
6. ASR service tests

### Phase 3: Pipeline
7. Pipeline runner tests
8. Step implementations (loadProfile, asr, cleaning, handout, summary)

### Phase 4: Utilities
9. Utility function tests
10. Service helper tests (logger, progress)

## Best Practices

1. **Isolation**: Each test should be independent
2. **Naming**: Use descriptive test names (`describe` blocks for grouping, `it`/`test` for cases)
3. **AAA Pattern**: Arrange, Act, Assert
4. **Mock External Dependencies**: Don't make real API calls
5. **Test Edge Cases**: Invalid inputs, errors, boundary conditions
6. **Coverage Goals**: Aim for >80% code coverage
7. **Fast Tests**: Keep tests fast (<100ms per test when possible)
8. **Clear Assertions**: One assertion per test when possible

## Example Test Structure

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { functionToTest } from '../../src/module';

describe('ModuleName', () => {
  beforeEach(() => {
    // Setup
  });

  describe('functionToTest', () => {
    it('should handle valid input', () => {
      // Arrange
      const input = 'valid';
      
      // Act
      const result = functionToTest(input);
      
      // Assert
      expect(result).toBe('expected');
    });

    it('should throw error for invalid input', () => {
      // Arrange
      const input = null;
      
      // Act & Assert
      expect(() => functionToTest(input)).toThrow('Error message');
    });
  });
});
```

## Import Paths

When writing tests in the `tests/` folder, use relative paths to import from `src/`:
- From `tests/config/` → `../../src/config/`
- From `tests/pipeline/steps/` → `../../../src/pipeline/steps/`
- From `tests/services/ai/` → `../../../src/services/ai/`

Alternatively, configure path aliases in `tsconfig.json` for cleaner imports:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```
