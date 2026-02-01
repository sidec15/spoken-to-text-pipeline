import { describe, it, expect } from '@jest/globals';

/**
 * Example test to verify Jest is working correctly
 * This file can be removed once real tests are added
 */
describe('Jest Setup', () => {
  it('should run tests successfully', () => {
    expect(true).toBe(true);
  });

  it('should support ES modules', () => {
    const module = { name: 'test' };
    expect(module.name).toBe('test');
  });
});
