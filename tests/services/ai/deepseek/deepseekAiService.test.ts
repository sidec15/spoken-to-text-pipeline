import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { AiGenerateOptions } from '../../../../src/services/ai/ai.types.js';

// Mock OpenAI for ESM
const mockCreate = jest.fn();
jest.unstable_mockModule('openai', () => {
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
  return {
    default: MockOpenAI,
  };
});

describe('DeepSeekAiService', () => {
  let service: any;
  let DeepSeekAiService: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await import('../../../../src/services/ai/deepseek/deepseekAiService.js');
    DeepSeekAiService = module.DeepSeekAiService;
    service = new DeepSeekAiService('sk-test-key', 'deepseek-chat');
  });

  it('should generate text with valid options', async () => {
    // Arrange
    const options: AiGenerateOptions = {
      systemPrompt: 'You are a helpful assistant',
      userPrompt: 'Hello, world!',
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Generated response' } }],
    });

    // Act
    const result = await service.generateTextAsync(options);

    // Assert
    expect(result).toBe('Generated response');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'deepseek-chat',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system', content: options.systemPrompt }),
          expect.objectContaining({ role: 'user', content: expect.stringContaining('Hello, world!') }),
        ]),
      })
    );
  });

  it('should use correct model', async () => {
    // Arrange
    const serviceWithModel = new DeepSeekAiService('sk-test', 'deepseek-reasoner');
    const options: AiGenerateOptions = {
      systemPrompt: 'Test',
      userPrompt: 'Test',
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Response' } }],
    });

    // Act
    await serviceWithModel.generateTextAsync(options);

    // Assert
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'deepseek-reasoner' })
    );
  });

  it('should pass temperature and maxTokens', async () => {
    // Arrange
    const options: AiGenerateOptions = {
      systemPrompt: 'Test',
      userPrompt: 'Test',
      temperature: 0.7,
      maxTokens: 1000,
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Response' } }],
    });

    // Act
    await service.generateTextAsync(options);

    // Assert
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.7,
        max_tokens: 1000,
      })
    );
  });

  it('should handle API errors', async () => {
    // Arrange
    const options: AiGenerateOptions = {
      systemPrompt: 'Test',
      userPrompt: 'Test',
    };
    const apiError = new Error('API Error');
    mockCreate.mockRejectedValue(apiError);

    // Act & Assert
    await expect(service.generateTextAsync(options)).rejects.toThrow('API Error');
  });

  it('should handle network errors', async () => {
    // Arrange
    const options: AiGenerateOptions = {
      systemPrompt: 'Test',
      userPrompt: 'Test',
    };
    const networkError = new Error('Network error');
    mockCreate.mockRejectedValue(networkError);

    // Act & Assert
    await expect(service.generateTextAsync(options)).rejects.toThrow('Network error');
  });

  it('should return empty string when no content in response', async () => {
    // Arrange
    const options: AiGenerateOptions = {
      systemPrompt: 'Test',
      userPrompt: 'Test',
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: {} }],
    });

    // Act
    const result = await service.generateTextAsync(options);

    // Assert
    expect(result).toBe('');
  });

  it('should include manual context text when provided', async () => {
    // Arrange
    const options: AiGenerateOptions = {
      systemPrompt: 'Test',
      userPrompt: 'Test',
      manualContextText: 'Reference context',
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Response' } }],
    });

    // Act
    await service.generateTextAsync(options);

    // Assert
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('MANUAL CONTEXT'),
          }),
        ]),
      })
    );
  });

  it('should include previous output excerpt when provided', async () => {
    // Arrange
    const options: AiGenerateOptions = {
      systemPrompt: 'Test',
      userPrompt: 'Test',
      previousOutputExcerpt: 'Previous output',
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Response' } }],
    });

    // Act
    await service.generateTextAsync(options);

    // Assert
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('PREVIOUS OUTPUT EXCERPT'),
          }),
        ]),
      })
    );
  });

  it('should not include manual context when empty', async () => {
    // Arrange
    const options: AiGenerateOptions = {
      systemPrompt: 'Test',
      userPrompt: 'Test',
      manualContextText: '   ', // Whitespace only
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Response' } }],
    });

    // Act
    await service.generateTextAsync(options);

    // Assert
    const messages = mockCreate.mock.calls[0][0].messages;
    const hasManualContext = messages.some((m: any) =>
      m.content?.includes('MANUAL CONTEXT')
    );
    expect(hasManualContext).toBe(false);
  });

  it('should not include previous excerpt when empty', async () => {
    // Arrange
    const options: AiGenerateOptions = {
      systemPrompt: 'Test',
      userPrompt: 'Test',
      previousOutputExcerpt: '   ', // Whitespace only
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Response' } }],
    });

    // Act
    await service.generateTextAsync(options);

    // Assert
    const messages = mockCreate.mock.calls[0][0].messages;
    const hasPreviousExcerpt = messages.some((m: any) =>
      m.content?.includes('PREVIOUS OUTPUT EXCERPT')
    );
    expect(hasPreviousExcerpt).toBe(false);
  });
});
