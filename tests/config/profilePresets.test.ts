import { describe, it, expect } from '@jest/globals';
import { AI_PROFILE_PRESETS, METADATA_BLOCK_PLACEHOLDER } from '../../src/config/profilePresets.js';
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
      expect(preset.handout).toBeDefined();
      expect(preset.summary).toBeDefined();
    });

    it('should get preset for other profile', () => {
      // Act
      const preset = AI_PROFILE_PRESETS.other;

      // Assert
      expect(preset).toBeDefined();
      expect(preset.cleaning).toBeDefined();
      expect(preset.handout).toBeDefined();
      expect(preset.summary).toBeDefined();
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
      // handout has dual prompts: singlePass and incremental
      expect(lecturePreset.handout?.systemPrompt).toHaveProperty('singlePass');
      expect(lecturePreset.handout?.systemPrompt).toHaveProperty('incremental');
      expect(typeof lecturePreset.handout?.systemPrompt?.singlePass).toBe('string');
      expect(typeof lecturePreset.handout?.systemPrompt?.incremental).toBe('string');
      
      expect(lecturePreset.summary).toHaveProperty('temperature');
      expect(lecturePreset.summary).toHaveProperty('systemPrompt');
      expect(typeof lecturePreset.summary?.temperature).toBe('number');
      expect(typeof lecturePreset.summary?.systemPrompt).toBe('string');

      // Act & Assert - Meeting (handout has dual prompts)
      const meetingPreset = AI_PROFILE_PRESETS.meeting;
      expect(meetingPreset.cleaning).toHaveProperty('temperature');
      expect(meetingPreset.cleaning).toHaveProperty('systemPrompt');
      expect(meetingPreset.handout).toHaveProperty('temperature');
      expect(meetingPreset.handout).toHaveProperty('systemPrompt');
      expect(meetingPreset.handout?.systemPrompt).toHaveProperty('singlePass');
      expect(meetingPreset.handout?.systemPrompt).toHaveProperty('incremental');
      expect(typeof meetingPreset.handout?.systemPrompt?.singlePass).toBe('string');
      expect(typeof meetingPreset.handout?.systemPrompt?.incremental).toBe('string');
      expect(meetingPreset.summary).toHaveProperty('temperature');
      expect(meetingPreset.summary).toHaveProperty('systemPrompt');

      // Act & Assert - Other (handout has dual prompts)
      const otherPreset = AI_PROFILE_PRESETS.other;
      expect(otherPreset.cleaning).toHaveProperty('temperature');
      expect(otherPreset.cleaning).toHaveProperty('systemPrompt');
      expect(otherPreset.handout).toHaveProperty('temperature');
      expect(otherPreset.handout).toHaveProperty('systemPrompt');
      expect(otherPreset.handout?.systemPrompt).toHaveProperty('singlePass');
      expect(otherPreset.handout?.systemPrompt).toHaveProperty('incremental');
      expect(typeof otherPreset.handout?.systemPrompt?.singlePass).toBe('string');
      expect(typeof otherPreset.handout?.systemPrompt?.incremental).toBe('string');
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

    it('should include METADATA_BLOCK_PLACEHOLDER in handout and summary prompts that have header structure', () => {
      expect(METADATA_BLOCK_PLACEHOLDER).toBe('{{METADATA_BLOCK}}');

      for (const profile of ['lecture', 'meeting', 'other'] as const) {
        const preset = AI_PROFILE_PRESETS[profile];
        if (preset?.handout?.systemPrompt) {
          const sp = preset.handout.systemPrompt as { singlePass?: string; incremental?: string };
          expect(sp.singlePass).toContain(METADATA_BLOCK_PLACEHOLDER);
          expect(sp.incremental).toContain(METADATA_BLOCK_PLACEHOLDER);
        }
        if (preset?.summary?.systemPrompt) {
          expect(preset.summary.systemPrompt).toContain(METADATA_BLOCK_PLACEHOLDER);
        }
      }
    });
  });
});
