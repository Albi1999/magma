import { h } from '@stencil/core';
import type { ReactNode } from 'react';
import { expect, waitFor } from 'storybook/test';

/**
 * The frame of a States story (#1440, SPEC.md "Tests"): every state of a component visible once
 * the story has opened, each with its name, so a person, the a11y run and an audit see them all
 * without scripting the page.
 *
 * - The area takes the surface a component sits on in a product (`bg-surface-raised`, a card or
 *   a panel), through its role, so dark mode follows (decided on #1440 between raised and
 *   overlay, on the real render).
 * - Columns by container queries: one, two from `@md`, three from `@3xl`.
 * - A state that only an interaction reaches is named with `play`: the story's play function
 *   brings it there and checks it was reached, never how it looks, so a defect shows instead of
 *   being held by the test.
 */
// `children` and `key` are optional in the types: the stories run on React's JSX, which passes
// them as props, while tsc reads them with the Stencil `h` of tsconfig.json, which does not
export const StatesGrid = ({ children }: { children?: ReactNode }) => (
  <div class="@container bg-surface-raised p-600 rounded-lg">
    <div class="grid items-start gap-x-600 gap-y-800 @md:grid-cols-2 @3xl:grid-cols-3">
      {children}
    </div>
  </div>
);

export const StateCell = ({
  state,
  play,
  children,
}: {
  key?: string;
  state: string;
  play?: boolean;
  children?: ReactNode;
}) => (
  <section data-state={state} class="grid gap-200">
    <mds-text typography="hack" class="text-fg-muted">
      {play ? `${state} (play)` : state}
    </mds-text>
    {children}
  </section>
);

/** The cell of a state, by its name. */
export const stateCell = (canvasElement: HTMLElement, state: string): HTMLElement =>
  canvasElement.querySelector(`[data-state="${state}"]`) as HTMLElement;

/**
 * Leaves the `mds-input` of a cell as a person does, focus then blur, once it and every Magma
 * element around it in the cell have loaded (a field listens to its input only then). The events
 * are sent, because focus() and blur() fire nothing while the document has no focus (a
 * background tab, a hidden pane of the browser).
 */
export const leaveInput = async (cell: HTMLElement): Promise<void> => {
  const elements = Array.from(cell.querySelectorAll('*')).filter((element) =>
    element.tagName.startsWith('MDS-'),
  );
  await waitFor(() => elements.forEach((element) => expect(element).toHaveAttribute('hydrated')));
  const input = cell.querySelector('mds-input') as HTMLMdsInputElement;
  const native = input.shadowRoot!.querySelector('input.input, textarea') as HTMLElement;
  native.dispatchEvent(new FocusEvent('focus'));
  native.dispatchEvent(new FocusEvent('blur'));
};
