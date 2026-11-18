/**
 * The States story of a component (#1440, SPEC.md "Tests"): every state of the component visible
 * once the story has opened, so a person, the a11y run and an audit see them all. Which
 * components owe one: those with a stories file of their own, `test/<tag>.stories.tsx` in their
 * folder (the file that carries the component's Docs page, SPEC.md "Storybook"); a part of a
 * compound has none and shows its states in the stories of its compound.
 *
 * The components that do not have it yet are listed in states-stories-pending.json; the check
 * fails on a component added without one, and on a listed component that has one now or no
 * stories file of its own anymore, so the list only shrinks.
 */

/** A States story: `export const States` in the stories file, as Storybook names a story by its export. */
export const hasStatesStory = (source: string): boolean => /^export const States\b/m.test(source);

export interface StatesReport {
  /** the components with their States story */
  done: string[];
  /** with a stories file of their own, no States story, and not pending: added without one */
  missing: string[];
  /** pending, but with a States story now or no stories file of their own: out of the list */
  stale: string[];
}

/**
 * `stories`: each component with a stories file of its own, by tag, with the file's source;
 * `pending`: the components allowed to lack the States story for now.
 */
export const checkStatesStories = (
  stories: Record<string, string>,
  pending: string[],
): StatesReport => {
  const tags = Object.keys(stories).sort();
  const done = tags.filter((tag) => hasStatesStory(stories[tag]!));
  const missing = tags.filter((tag) => !done.includes(tag) && !pending.includes(tag));
  const stale = pending.filter((tag) => stories[tag] === undefined || done.includes(tag)).sort();
  return { done, missing, stale };
};
