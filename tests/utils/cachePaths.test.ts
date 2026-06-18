import { describe, it, expect } from '@jest/globals';
import path from 'node:path';
import {
  CACHE_DIR_NAME,
  cacheRoot,
  stepBatchDir,
  handoutDraftsDir,
} from '../../src/utils/cachePaths.js';

describe('cachePaths', () => {
  it('roots all auxiliary artifacts under .cache', () => {
    expect(CACHE_DIR_NAME).toBe('.cache');
    expect(cacheRoot('/out')).toBe(path.join('/out', '.cache'));
  });

  it('places each step\'s batch state under .cache/<step>/batch', () => {
    expect(stepBatchDir('/out', 'cleaning')).toBe(path.join('/out', '.cache', 'cleaning', 'batch'));
    expect(stepBatchDir('/out', 'handout')).toBe(path.join('/out', '.cache', 'handout', 'batch'));
  });

  it('places handout drafts under .cache/handout/<mode>/drafts', () => {
    expect(handoutDraftsDir('/out', 'batch')).toBe(
      path.join('/out', '.cache', 'handout', 'batch', 'drafts'),
    );
    expect(handoutDraftsDir('/out', 'incremental')).toBe(
      path.join('/out', '.cache', 'handout', 'incremental', 'drafts'),
    );
  });
});
