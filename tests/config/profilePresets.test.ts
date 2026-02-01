import { describe, it, expect } from '@jest/globals';
import { AI_PROFILE_PRESETS } from '../../src/config/profilePresets.js';
import type { PipelineConfig } from '../../src/config/config.types.js';

describe('profilePresets', () => {
  describe('AI_PROFILE_PRESETS', () => {
    it('should get preset for lecture profile', () => {
      // Act
      const preset = AI_PROFILE_PRESETS.lecture;

      // Assert
      expect(preset).toBeDefined();
      expect(preset.cleaning).toBeDefined();
      expect(preset.handout).toBeDefined();
      expect(preset.summary).toBeDefined();
    });

    it('should get preset for meeting profile', () => {
      // Act
      const preset = AI_PROFILE_PRESETS.meeting;

      // Assert
      expect(preset).toBeDefined();
      expect(preset.cleaning).toBeDefined();
      expect(preset.summary).toBeDefined();
      // Meeting profile should not have handout
      expect(preset.handout).toBeUndefined();
    });

    it('should get preset for other profile', () => {
      // Act
      const preset = AI_PROFILE_PRESETS.other;

      // Assert
      expect(preset).toBeDefined();
      expect(preset.cleaning).toBeDefined();
      expect(preset.summary).toBeDefined();
      // Other profile should not have handout
      expect(preset.handout).toBeUndefined();
    });

    it('should have preset structure matching expected format', () => {
      // Act & Assert - Lecture
      const lecturePreset = AI_PROFILE_PRESETS.lecture;
      expect(lecturePreset.cleaning).toHaveProperty('temperature');
      expect(lecturePreset.cleaning).toHaveProperty('systemPrompt');
      expect(typeof lecturePreset.cleaning?.temperature).toBe('number');
      expect(typeof lecturePreset.cleaning?.systemPrompt).toBe('string');
      
      expect(lecturePreset.handout).toHaveProperty('temperature');
      expect(lecturePreset.handout).toHaveProperty('systemPrompt');
      expect(typeof lecturePreset.handout?.temperature).toBe('number');
      expect(typeof lecturePreset.handout?.systemPrompt).toBe('string');
      
      expect(lecturePreset.summary).toHaveProperty('temperature');
      expect(lecturePreset.summary).toHaveProperty('systemPrompt');
      expect(typeof lecturePreset.summary?.temperature).toBe('number');
      expect(typeof lecturePreset.summary?.systemPrompt).toBe('string');

      // Act & Assert - Meeting
      const meetingPreset = AI_PROFILE_PRESETS.meeting;
      expect(meetingPreset.cleaning).toHaveProperty('temperature');
      expect(meetingPreset.cleaning).toHaveProperty('systemPrompt');
      expect(meetingPreset.summary).toHaveProperty('temperature');
      expect(meetingPreset.summary).toHaveProperty('systemPrompt');

      // Act & Assert - Other
      const otherPreset = AI_PROFILE_PRESETS.other;
      expect(otherPreset.cleaning).toHaveProperty('temperature');
      expect(otherPreset.cleaning).toHaveProperty('systemPrompt');
      expect(otherPreset.summary).toHaveProperty('temperature');
      expect(otherPreset.summary).toHaveProperty('systemPrompt');
    });

    it('should have valid profile keys', () => {
      // Act
      const profiles: PipelineConfig['profile'][] = ['lecture', 'meeting', 'other'];

      // Assert
      for (const profile of profiles) {
        expect(AI_PROFILE_PRESETS[profile]).toBeDefined();
      }
    });
  });
});
