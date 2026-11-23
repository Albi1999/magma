import { h } from '@stencil/core';
import { expect, waitFor } from 'storybook/test';
import { StateCell, StatesGrid, stateCell } from '@fixture/states';
import { previewDockDictionary } from '../meta/dictionary';

// The page a product would show in the result: a document of its own, drawn at the width of the
// desktop and scaled down to the box. Plain markup, so the story needs nothing loaded in it
const page = `<!doctype html><html lang="en"><body style="margin:0;font:16px/1.5 system-ui;background:#f4f4f4;color:#222">
<main style="max-width:36rem;margin:0 auto;padding:48px 24px;display:grid;gap:16px">
<h1 style="margin:0;font-size:40px">Access request</h1>
<p style="margin:0">Fill in your details: we write to you as soon as the request is approved.</p>
<label style="display:grid;gap:4px;font-size:13px;font-weight:700">EMAIL<input style="font:inherit;padding:12px;border:1px solid #bbb;border-radius:8px" placeholder="name@example.com"></label>
<p style="margin:0"><span style="display:inline-block;padding:10px 16px;border-radius:8px;background:#1a5fd6;color:#fff">Send the request</span></p>
</main></body></html>`;

export default {
  title: 'UI / Content / Preview',
  argTypes: {
    label: {
      type: { name: 'string', required: true },
      description:
        'What the result shows and under which conditions: it names the region, and is the title of an iframe in the default slot',
    },
    width: {
      type: { name: 'number' },
      description: 'The narrowest width in px the result is drawn at, scaled down to fit its box',
    },
    dock: {
      type: { name: 'string' },
      description: 'Where the result goes under the desktop breakpoint',
      control: { type: 'select' },
      options: previewDockDictionary,
    },
    zoomed: {
      type: { name: 'boolean' },
      description: 'Whether the docked result is zoomed to the width of the window',
    },
  },
};

const Result = (props) => (
  <mds-preview {...props}>
    <mds-text slot="head" typography="section" tag="h2">
      Preview
    </mds-text>
    <mds-tab slot="conditions" size="sm">
      <mds-tab-item label="Light" value="light" selected></mds-tab-item>
      <mds-tab-item label="Dark" value="dark"></mds-tab-item>
    </mds-tab>
    <iframe srcdoc={page}></iframe>
  </mds-preview>
);

const Template = (args) => (
  <div class="grid gap-600 desktop:grid-cols-[minmax(0,var(--magma-width-form))_minmax(0,1fr)]">
    <div class="grid content-start gap-between-fields">
      <mds-input-field label="Title of the page">
        <mds-input value="Access request"></mds-input>
      </mds-input-field>
      <mds-input-field label="Main action">
        <mds-input value="Send the request"></mds-input>
      </mds-input-field>
    </div>
    <Result {...args} />
  </div>
);

export const Default = {
  render: Template,
  args: {
    label: 'The theme Magma on a page of a product, light mode',
  },
};

// A cell that holds the window of a product: a fixed box is placed in the nearest element with
// layout containment, so the docked result sits in the corner of its cell instead of the window
const Window = ({ children }: { children?: unknown }) => (
  <div
    class="relative overflow-hidden rounded-md border border-border-default bg-surface-default"
    style={{ contain: 'layout', height: '20rem' }}
  >
    {children}
  </div>
);

const states = [
  { state: 'docked small', props: {} },
  { state: 'docked, zoomed', props: { zoomed: true } },
  { state: 'docked at the bottom left', props: { dock: 'bottom-left' } },
  { state: 'zoomed with the lens', play: true, props: {} },
  { state: 'in the flow', props: { dock: 'none' } },
  { state: 'drawn at 1440', props: { dock: 'none', width: 1440 } },
];

const TemplateStates = () => (
  <StatesGrid>
    {states.map(({ state, play, props }) => (
      <StateCell key={state} state={state} play={play}>
        <Window>
          <Result label={`The theme Magma on a page of a product, ${state}`} {...props} />
        </Window>
      </StateCell>
    ))}
  </StatesGrid>
);

// Docked is a state of a window under the desktop breakpoint: the story opens at the width of a
// tablet (MINIMAL_VIEWPORTS of Storybook), which the Vitest run of the stories applies too
export const States = {
  render: TemplateStates,
  globals: { viewport: { value: 'tablet', isRotated: false } },
  play: async ({ canvasElement }) => {
    const cell = stateCell(canvasElement, 'zoomed with the lens');
    const preview = cell.querySelector('mds-preview') as HTMLMdsPreviewElement;
    await waitFor(() => expect(preview).toHaveAttribute('hydrated'));
    const lens = preview.shadowRoot!.querySelector('.lens') as HTMLElement;
    await waitFor(() => expect(lens).toHaveAttribute('hydrated'));
    lens.click();
    await waitFor(() => expect(preview).toHaveProperty('zoomed', true));
  },
};
