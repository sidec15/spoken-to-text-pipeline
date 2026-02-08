import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { AiGenerateOptions } from '../../../../src/services/ai/ai.types.js';

// Mock OpenAI for ESM (Ollama uses OpenAI SDK with custom baseURL)
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

describe('OllamaAiService', () => {
  let service: any;
  let OllamaAiService: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await import('../../../../src/services/ai/ollama/ollamaAiService.js');
    OllamaAiService = module.OllamaAiService;
    service = new OllamaAiService('llama3.1:8b');
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
        model: 'llama3.1:8b',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system', content: options.systemPrompt }),
          expect.objectContaining({ role: 'user', content: expect.stringContaining('Hello, world!') }),
        ]),
      })
    );
  });

  it('should use correct model', async () => {
    // Arrange
    const serviceWithModel = new OllamaAiService('qwen2.5:7b');
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
      expect.objectContaining({ model: 'qwen2.5:7b' })
    );
  });

  it('should instantiate with default base URL when not provided', () => {
    // Arrange & Act
    const serviceDefaultUrl = new OllamaAiService('llama3.1:8b');

    // Assert
    expect(serviceDefaultUrl).toBeDefined();
  });

  it('should instantiate with custom base URL when provided', () => {
    // Arrange & Act
    const customBaseUrl = 'http://192.168.1.100:11434/v1';
    const serviceCustomUrl = new OllamaAiService('llama3.1:8b', customBaseUrl);

    // Assert
    expect(serviceCustomUrl).toBeDefined();
  });

  it('should pass temperature and maxTokens when explicitly set', async () => {
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

  it('should not send max_tokens when maxTokens is not set', async () => {
    // Arrange
    const options: AiGenerateOptions = {
      systemPrompt: 'Test',
      userPrompt: 'Test',
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Response' } }],
    });

    // Act
    await service.generateTextAsync(options);

    // Assert
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty('max_tokens');
  });

  it('should handle connection refused error (server not running)', async () => {
    // Arrange
    const options: AiGenerateOptions = {
      systemPrompt: 'Test',
      userPrompt: 'Test',
    };
    const connectionError = new Error('fetch failed: ECONNREFUSED');
    mockCreate.mockRejectedValue(connectionError);

    // Act & Assert
    await expect(service.generateTextAsync(options)).rejects.toThrow(
      /Ollama server is not reachable/
    );
    await expect(service.generateTextAsync(options)).rejects.toThrow(
      /Make sure Ollama is running/
    );
  });

  it('should handle model not found error (404)', async () => {
    // Arrange
    const options: AiGenerateOptions = {
      systemPrompt: 'Test',
      userPrompt: 'Test',
    };
    const notFoundError = new Error('404 Model not found');
    mockCreate.mockRejectedValue(notFoundError);

    // Act & Assert
    await expect(service.generateTextAsync(options)).rejects.toThrow(
      /Ollama model 'llama3.1:8b' not found/
    );
    await expect(service.generateTextAsync(options)).rejects.toThrow(
      /Pull it first with 'ollama pull/
    );
  });

  it('should handle generic API errors', async () => {
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

  it('should handle fetch failed error (connection issue)', async () => {
    // Arrange
    const options: AiGenerateOptions = {
      systemPrompt: 'Test',
      userPrompt: 'Test',
    };
    const fetchError = new Error('fetch failed');
    mockCreate.mockRejectedValue(fetchError);

    // Act & Assert
    await expect(service.generateTextAsync(options)).rejects.toThrow(
      /Ollama server is not reachable/
    );
  });
});
