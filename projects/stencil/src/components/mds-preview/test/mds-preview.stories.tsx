import { h } from '@stencil/core';
import { useEffect, useRef, useState } from 'react';
import { expect, waitFor } from 'storybook/test';
import { StateCell, StatesGrid, stateCell } from '@fixture/states';
import { previewDockDictionary } from '../meta/dictionary';

// The page a product would show in the result: a document of its own, drawn at the width of the
// desktop and scaled down to the box. Plain markup with a light and a dark mode of its own, so
// the story needs nothing loaded in it: the conditions in the head of the result switch the mode
// of this document only, as a product switches the mode of its page (edit-with-preview)
const page = `<!doctype html><html lang="en" data-mode="light"><head><style>
:root { color-scheme: light; --page: #f4f4f4; --text: #222; --field: #fff; --line: #bbb; --action: #1a5fd6; --on-action: #fff }
:root[data-mode="dark"] { color-scheme: dark; --page: #1d1d1f; --text: #ececec; --field: #2b2b2e; --line: #5a5a5e; --action: #7aa7ff; --on-action: #111 }
body { margin: 0; font: 16px/1.5 system-ui; background: var(--page); color: var(--text) }
main { max-width: 36rem; margin: 0 auto; padding: 48px 24px; display: grid; gap: 16px }
h1, p { margin: 0 } h1 { font-size: 40px }
label { display: grid; gap: 4px; font-size: 13px; font-weight: 700 }
input { font: inherit; padding: 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--field); color: var(--text) }
.action { display: inline-block; padding: 10px 16px; border-radius: 8px; background: var(--action); color: var(--on-action) }
</style></head><body><main>
<h1 id="title">Access request</h1>
<p>Fill in your details: we write to you as soon as the request is approved.</p>
<label>EMAIL<input placeholder="name@example.com"></label>
<p><span id="action" class="action">Send the request</span></p>
</main></body></html>`;

export default {
  title: 'UI / Content / Preview',
  argTypes: {
    label: {
      type: { name: 'string', required: true },
      description:
        'What the result shows and under which conditions: it names the region, and is the title of an iframe in the default slot. The story adds the mode chosen in the head of the result',
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

type Texts = { title?: string; action?: string };

/**
 * The result as a product writes it: the conditions switch the mode of the page in the iframe,
 * without loading it again, and `label` says the mode, so the region and the title of the
 * iframe follow it; the texts of the controls go into the page as they are typed.
 */
const Result = ({
  label,
  texts = {},
  ...props
}: {
  label: string;
  texts?: Texts;
  [prop: string]: unknown;
}) => {
  const [mode, setMode] = useState('light');
  const modeOf = useRef(mode);
  const tabs = useRef<HTMLElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  const paint = () => {
    const doc = frame.current?.contentDocument;
    if (!doc?.getElementById('title')) return;
    doc.documentElement.setAttribute('data-mode', modeOf.current);
    if (texts.title !== undefined) doc.getElementById('title')!.textContent = texts.title;
    if (texts.action !== undefined) doc.getElementById('action')!.textContent = texts.action;
  };

  useEffect(() => {
    const tab = tabs.current;
    const change = (event: Event) =>
      setMode((event as CustomEvent<{ value?: string }>).detail.value ?? 'light');
    tab?.addEventListener('mdsTabChange', change);
    return () => tab?.removeEventListener('mdsTabChange', change);
  }, []);

  useEffect(() => {
    modeOf.current = mode;
    paint();
  });

  return (
    <mds-preview label={`${label}, ${mode} mode`} headline="Preview" {...props}>
      <mds-tab ref={tabs} slot="conditions" size="sm">
        <mds-tab-item label="Light" value="light" selected></mds-tab-item>
        <mds-tab-item label="Dark" value="dark"></mds-tab-item>
      </mds-tab>
      <iframe ref={frame} srcdoc={page} onLoad={paint}></iframe>
    </mds-preview>
  );
};

const Template = (args) => {
  const [texts, setTexts] = useState<Texts>({
    title: 'Access request',
    action: 'Send the request',
  });
  const title = useRef<HTMLElement>(null);
  const action = useRef<HTMLElement>(null);

  useEffect(() => {
    const listen = (input: HTMLElement | null, key: keyof Texts) => {
      const change = (event: Event) => {
        const value = (event as CustomEvent<{ value?: string | null }>).detail.value ?? '';
        setTexts((before) => ({ ...before, [key]: value }));
      };
      input?.addEventListener('mdsInputChange', change);
      return () => input?.removeEventListener('mdsInputChange', change);
    };
    const stops = [listen(title.current, 'title'), listen(action.current, 'action')];
    return () => stops.forEach((stop) => stop());
  }, []);

  return (
    <div class="grid gap-600 desktop:grid-cols-[minmax(0,var(--magma-width-form))_minmax(0,1fr)]">
      <div class="grid content-start gap-between-fields">
        <mds-input-field label="Title of the page">
          <mds-input ref={title} value="Access request"></mds-input>
        </mds-input-field>
        <mds-input-field label="Main action">
          <mds-input ref={action} value="Send the request"></mds-input>
        </mds-input-field>
      </div>
      <Result {...args} texts={texts} />
    </div>
  );
};

export const Default = {
  render: Template,
  args: {
    label: 'The theme Magma on a page of a product',
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
