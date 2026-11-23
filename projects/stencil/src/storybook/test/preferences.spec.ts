import { describe, expect, it } from 'vitest';
import {
  LANGUAGE,
  LINK_GLOBALS,
  LINKED,
  PREFERENCES,
  linkedPreferences,
} from '../../../.storybook/preferences.mjs';

// The preferences a link sets on a story (#1436): `?globals=mode:dark;contrast:more`.
describe('LINK_GLOBALS', () => {
  it('declares every preference of the panel and the language, each empty', () => {
    const names = [...PREFERENCES, LANGUAGE].map(({ name }) => name);
    expect(Object.keys(LINK_GLOBALS)).toEqual(names);
    expect(Object.values(LINK_GLOBALS).every((value) => value === '')).toBe(true);
    expect(LINKED.map(({ name }) => name)).toEqual(names);
  });
});

describe('linkedPreferences', () => {
  it('takes the values that are options of their preference', () => {
    expect(
      linkedPreferences({ mode: 'dark', contrast: 'more', animation: 'reduce', language: 'it' }),
    ).toEqual({
      values: { mode: 'dark', contrast: 'more', animation: 'reduce', language: 'it' },
      ignored: [],
    });
  });

  it('takes unset, an option of the panel too', () => {
    expect(linkedPreferences({ contrast: 'unset' }).values).toEqual({ contrast: 'unset' });
  });

  it('leaves out a value that is not an option, and names it', () => {
    expect(linkedPreferences({ mode: 'sepia', contrast: 'more' })).toEqual({
      values: { contrast: 'more' },
      ignored: ['mode:sepia'],
    });
  });

  it('reads an empty global as not set by the link', () => {
    expect(linkedPreferences(LINK_GLOBALS)).toEqual({ values: {}, ignored: [] });
    expect(linkedPreferences()).toEqual({ values: {}, ignored: [] });
  });

  it('ignores the globals that name no preference', () => {
    expect(linkedPreferences({ backgrounds: { value: 'dark' }, viewport: 'mobile' })).toEqual({
      values: {},
      ignored: [],
    });
  });
});
