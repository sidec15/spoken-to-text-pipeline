import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { AiGenerateOptions } from '../../../../src/services/ai/ai.types.js';

// Mock OpenAI for ESM
const mockCreate = jest.fn();
jest.unstable_mockModule('openai', () => {
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    responses: {
      create: mockCreate,
    },
  }));
  return {
    default: MockOpenAI,
  };
});

describe('OpenAiService', () => {
  let service: any;
  let OpenAiService: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await import('../../../../src/services/ai/openai/openaiAiService.js');
    OpenAiService = module.OpenAiService;
    service = new OpenAiService('sk-test-key', 'gpt-4o-mini');
  });

  it('should generate text with valid options', async () => {
    // Arrange
    const options: AiGenerateOptions = {
      systemPrompt: 'You are a helpful assistant',
      userPrompt: 'Hello, world!',
    };
    mockCreate.mockResolvedValue({
      status: 'completed',
      output_text: 'Generated response',
    });

    // Act
    const result = await service.generateTextAsync(options);

    // Assert
    expect(result).toBe('Generated response');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        input: expect.arrayContaining([
          expect.objectContaining({ role: 'system', content: options.systemPrompt }),
          expect.objectContaining({ role: 'user', content: expect.stringContaining('Hello, world!') }),
        ]),
      })
    );
  });

  it('should use correct model', async () => {
    // Arrange
    const serviceWithModel = new OpenAiService('sk-test', 'gpt-4');
    const options: AiGenerateOptions = {
      systemPrompt: 'Test',
      userPrompt: 'Test',
    };
    mockCreate.mockResolvedValue({ status: 'completed', output_text: 'Response' });

    // Act
    await serviceWithModel.generateTextAsync(options);

    // Assert
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4' })
    );
  });

  it('should pass temperature and maxTokens when explicitly set', async () => {
    // Arrange
    const options: AiGenerateOptions = {
      systemPrompt: 'Test',
      userPrompt: 'Test',
      temperature: 0.7,
      maxTokens: 1000,
    };
    mockCreate.mockResolvedValue({ status: 'completed', output_text: 'Response' });

    // Act
    await service.generateTextAsync(options);

    // Assert
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.7,
        max_output_tokens: 1000,
      })
    );
  });

  it('should not send max_output_tokens when maxTokens is not set', async () => {
    // Arrange
    const options: AiGenerateOptions = {
      systemPrompt: 'Test',
      userPrompt: 'Test',
    };
    mockCreate.mockResolvedValue({ status: 'completed', output_text: 'Response' });

    // Act
    await service.generateTextAsync(options);

    // Assert
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty('max_output_tokens');
  });

  it('should throw error when response is incomplete', async () => {
    // Arrange
    const options: AiGenerateOptions = {
      systemPrompt: 'Test',
      userPrompt: 'Test',
    };
    mockCreate.mockResolvedValue({
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      output_text: '',
    });

    // Act & Assert
    await expect(service.generateTextAsync(options)).rejects.toThrow(
      /OpenAI response incomplete.*max_output_tokens/
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

  it('should include manual context when provided', async () => {
    // Arrange
    const options: AiGenerateOptions = {
      systemPrompt: 'Test',
      userPrompt: 'Test',
      manualContextText: 'Context text',
    };
    mockCreate.mockResolvedValue({ status: 'completed', output_text: 'Response' });

    // Act
    await service.generateTextAsync(options);

    // Assert
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.input).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('OPTIONAL MANUAL CONTEXT'),
        }),
        expect.objectContaining({ role: 'user', content: expect.stringContaining('INPUT CONTENT') }),
      ])
    );
  });

  it('should include previous output excerpt when provided', async () => {
    // Arrange
    const options: AiGenerateOptions = {
      systemPrompt: 'Test',
      userPrompt: 'Test',
      previousOutputExcerpt: 'Previous output',
    };
    mockCreate.mockResolvedValue({ status: 'completed', output_text: 'Response' });

    // Act
    await service.generateTextAsync(options);

    // Assert
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.input).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('PREVIOUS OUTPUT EXCERPT'),
        }),
        expect.objectContaining({ role: 'user', content: expect.stringContaining('INPUT CONTENT') }),
      ])
    );
  });
});
