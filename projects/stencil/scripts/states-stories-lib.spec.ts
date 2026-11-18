import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { checkStatesStories, hasStatesStory } from './states-stories-lib';

describe('hasStatesStory', () => {
  it('finds the States export', () => {
    expect(hasStatesStory('export const Default = {};\n\nexport const States = {\n')).toBe(true);
  });

  it('does not take another story whose name starts with States', () => {
    expect(hasStatesStory('export const StatesDark = {};')).toBe(false);
    expect(hasStatesStory('// export const States = {};')).toBe(false);
  });
});

describe('checkStatesStories', () => {
  const stories = {
    'mds-input': 'export const States = {};',
    'mds-button': 'export const Default = {};',
    'mds-chip': 'export const Default = {};',
  };

  it('passes when every component lacking the story is pending', () => {
    expect(checkStatesStories(stories, ['mds-button', 'mds-chip'])).toEqual({
      done: ['mds-input'],
      missing: [],
      stale: [],
    });
  });

  it('names a component added without a States story', () => {
    expect(checkStatesStories(stories, ['mds-button']).missing).toEqual(['mds-chip']);
  });

  it('names a pending component that has its story now, or no stories file of its own', () => {
    expect(
      checkStatesStories(stories, ['mds-button', 'mds-chip', 'mds-input', 'mds-gone']).stale,
    ).toEqual(['mds-gone', 'mds-input']);
  });
});

describe('states-stories-pending.json', () => {
  it('is a sorted list of component tags, each once', () => {
    const pending = JSON.parse(
      fs.readFileSync(path.join(import.meta.dirname, 'states-stories-pending.json'), 'utf8'),
    ) as string[];
    expect(pending.every((tag) => /^mds-[a-z0-9-]+$/.test(tag))).toBe(true);
    expect([...new Set(pending)].sort()).toEqual(pending);
  });
});
