/**
 * Fails on a component added without a States story, and on a component of
 * states-stories-pending.json that has one now or no stories file of its own anymore: the list of
 * the components still to do only shrinks (#1440). What a States story is, and which components
 * owe one: states-stories-lib.ts and SPEC.md "Tests".
 *
 * Reads the sources only, no build. Run from the stencil package dir:  npm run check.states-stories
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { PROJECT_DIR } from './meta';
import { checkStatesStories } from './states-stories-lib';

const COMPONENTS = join(PROJECT_DIR, 'src/components');
const PENDING = join(PROJECT_DIR, 'scripts/states-stories-pending.json');

const stories: Record<string, string> = {};
for (const tag of readdirSync(COMPONENTS)) {
  const file = join(COMPONENTS, tag, 'test', `${tag}.stories.tsx`);
  if (existsSync(file)) stories[tag] = readFileSync(file, 'utf8');
}
const pending = JSON.parse(readFileSync(PENDING, 'utf8')) as string[];
const { done, missing, stale } = checkStatesStories(stories, pending);
const list = relative(PROJECT_DIR, PENDING);

console.log(
  `States stories: ${done.length} of ${Object.keys(stories).length} components with a stories file of their own; ${pending.length} pending in ${list}`,
);
missing.forEach((tag) =>
  console.error(
    `${tag}: no States story (export const States in test/${tag}.stories.tsx, SPEC.md "Tests")`,
  ),
);
stale.forEach((tag) =>
  console.error(
    `${tag}: in ${list}, but ${stories[tag] === undefined ? 'it has no stories file of its own' : 'it has its States story now'}: take it out of the list`,
  ),
);
if (missing.length > 0 || stale.length > 0) process.exit(1);
