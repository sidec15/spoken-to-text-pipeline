import { describe, it, expect } from '@jest/globals';
import { mergeHandoutDrafts } from '../../src/utils/mergeHandoutDrafts.js';

describe('mergeHandoutDrafts', () => {
  it('renumbers main sections globally across drafts (locally each starts at 1)', () => {
    const draftA = '## 1. Intro\nbody a\n\n### 1.1 First sub\nsub a';
    const draftB = '## 1. Methods\nbody b\n\n### 1.1 Second sub\nsub b';

    const merged = mergeHandoutDrafts([draftA, draftB]);

    expect(merged).toContain('## 1. Intro');
    expect(merged).toContain('### 1.1 First sub');
    expect(merged).toContain('## 2. Methods');
    expect(merged).toContain('### 2.1 Second sub');
    // No leftover local numbering on the second draft
    expect(merged).not.toMatch(/## 1\. Methods/);
  });

  it('resets deeper levels when a new parent section starts', () => {
    const draft =
      '## 1. A\n### 1.1 A1\n#### 1.1.1 A1a\n## 2. B\n### 2.1 B1';
    const merged = mergeHandoutDrafts([draft]);

    expect(merged).toContain('## 1. A');
    expect(merged).toContain('### 1.1 A1');
    expect(merged).toContain('#### 1.1.1 A1a');
    expect(merged).toContain('## 2. B');
    expect(merged).toContain('### 2.1 B1');
  });

  it('increments subsections within the same parent', () => {
    const draft = '## 1. A\n### 1.1 First\n### 1.2 Second\n### 1.3 Third';
    const merged = mergeHandoutDrafts([draft]);

    expect(merged).toContain('### 1.1 First');
    expect(merged).toContain('### 1.2 Second');
    expect(merged).toContain('### 1.3 Third');
  });

  it('numbers headings that have no existing number prefix', () => {
    const draft = '## Intro\ntext\n### Background\nmore';
    const merged = mergeHandoutDrafts([draft]);

    expect(merged).toContain('## 1. Intro');
    expect(merged).toContain('### 1.1 Background');
  });

  it('leaves #-lines inside fenced code blocks untouched', () => {
    const draft =
      '## 1. Code\n```bash\n# this is a shell comment\n## not a heading\n```\n### 1.1 After';
    const merged = mergeHandoutDrafts([draft]);

    expect(merged).toContain('# this is a shell comment');
    expect(merged).toContain('## not a heading');
    expect(merged).toContain('## 1. Code');
    expect(merged).toContain('### 1.1 After');
  });

  it('preserves all body content with no omissions', () => {
    const draftA = '## 1. A\nalpha line one\nalpha line two';
    const draftB = '## 1. B\nbeta line one';
    const merged = mergeHandoutDrafts([draftA, draftB]);

    expect(merged).toContain('alpha line one');
    expect(merged).toContain('alpha line two');
    expect(merged).toContain('beta line one');
  });

  it('drops empty/whitespace-only drafts and trims', () => {
    const merged = mergeHandoutDrafts(['## 1. A\nbody', '   ', '']);
    expect(merged).toContain('## 1. A');
    expect(merged.trim()).toBe(merged);
  });

  it('passes a single draft through with clean 1-based numbering', () => {
    const draft = '## 3. Misnumbered\n### 3.5 Sub';
    const merged = mergeHandoutDrafts([draft]);

    expect(merged).toContain('## 1. Misnumbered');
    expect(merged).toContain('### 1.1 Sub');
  });

  it('does not emit 0.x when a subsection appears before any parent', () => {
    const draft = '### 1.1 Orphan sub\nbody';
    const merged = mergeHandoutDrafts([draft]);

    expect(merged).toContain('### 1.1 Orphan sub');
    expect(merged).not.toContain('0.1');
  });
});
