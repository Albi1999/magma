import { StateCell, StatesGrid, stateCell } from '@fixture/states';
import { h } from '@stencil/core';
import { useEffect, useState } from 'react';
import { expect, waitFor } from 'storybook/test';

export default {
  title: 'UI / Forms / Input Date',
  id: 'form-input-date',
  argTypes: {
    disabled: {
      type: { name: 'boolean' },
      description: 'If true, the element is displayed as disabled',
    },
    min: {
      type: { name: 'string' },
      description: 'Specifies the min date can be set',
    },
    max: {
      type: { name: 'string' },
      description: 'Specifies the max date can be set',
    },
    readOnly: {
      type: { name: 'boolean' },
      description: 'Specifies that the element is read-only',
    },
    required: {
      type: { name: 'boolean' },
      description: 'Specifies that the element must be filled out before submitting the form',
    },
    value: {
      type: { name: 'string' },
      description: 'Specifies the value of the input',
    },
  },
};

const getDate = (offsetDays: number = 0): string => {
  const today = new Date();
  today.setDate(today.getDate() + offsetDays);

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const Template = (args) => (
  <mds-input-date aria-label="Data" {...args} class="max-w-[400px]"></mds-input-date>
);

export const Default = {
  render: Template,

  args: {
    value: getDate(),
  },
};

export const MinMax = {
  render: Template,

  args: {
    min: getDate(-15),
    max: getDate(15),
  },
};

export const Invalid = {
  render: Template,

  args: {
    value: '2025-04-31',
  },
};

export const Required = {
  render: Template,

  args: {
    required: true,
  },
};

export const Disabled = {
  render: Template,

  args: {
    disabled: true,
  },
};

/**
 * Dates the user can change, and cannot: read-only and disabled. The calendar button changes the
 * date, so a locked field has none: its text takes its room, and its end is left to the badge of
 * its state, which covered it (#1368).
 */
const TemplateLocked = () => (
  <div class="@container">
    <div class="grid items-start gap-600 @md:grid-cols-3">
      <mds-input-date aria-label="Scadenza" value="2026-11-11"></mds-input-date>
      <mds-input-date aria-label="Creazione" value="2026-11-11" readonly></mds-input-date>
      <mds-input-date aria-label="Archiviazione" value="2026-11-11" disabled></mds-input-date>
    </div>
  </div>
);

export const Locked = {
  render: TemplateLocked,

  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const fields = Array.from(canvasElement.querySelectorAll('mds-input-date'));
    await waitFor(() => fields.forEach((field) => expect(field).toHaveAttribute('hydrated')));
    fields.forEach((field) => {
      const locked = field.hasAttribute('readonly') || field.hasAttribute('disabled');
      const button = field.shadowRoot!.querySelector('.action-open-calendar');
      if (locked) expect(button).toBeNull();
      else expect(button).not.toBeNull();
    });
  },
};

// A date field inside a modal with a custom window (mds-banner in slot="window", so the calendar
// pops out of the window instead of being clipped by the default window). The play opens the
// modal and the calendar and checks that the calendar takes the field width, capped by
// --mds-calendar-max-width (480px), with seven evenly sized columns, anchored to the end of the
// field.
const InsideModalTemplate = () => {
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const modalElement = document.querySelector('#date-modal');
    const close = (): void => setOpened(false);
    modalElement?.addEventListener('mdsModalClose', close);
    modalElement?.addEventListener('mdsModalHide', close);
    return () => {
      modalElement?.removeEventListener('mdsModalClose', close);
      modalElement?.removeEventListener('mdsModalHide', close);
    };
  }, []);

  return (
    <div>
      <mds-button id="open-modal" onClick={() => setOpened(true)}>
        Apri la modale
      </mds-button>
      <mds-modal
        id="date-modal"
        aria-label="Verbale"
        opened={opened ? true : undefined}
        position="center"
      >
        <mds-banner slot="window" class="max-w-[480px]" headline="Verbale">
          <mds-button
            icon="mi/baseline/close"
            variant="dark"
            tone="text"
            style={{ position: 'absolute', right: '0.5rem', top: '0.5rem' }}
            onClick={() => setOpened(false)}
          ></mds-button>
          <mds-input-field label="Preparato da">
            <mds-input value="Mario Rossi"></mds-input>
          </mds-input-field>
          <mds-input-field label="il">
            <mds-input-date id="modal-date" value={getDate()}></mds-input-date>
          </mds-input-field>
          <mds-input-field label="Commento">
            <mds-input type="textarea" placeholder="Commento"></mds-input>
          </mds-input-field>
        </mds-banner>
      </mds-modal>
    </div>
  );
};

// Waits for the dropdown opening transition to stand still before measuring.
const waitForSettled = (element: Element): Promise<void> =>
  waitFor(
    () => {
      const { opacity, transform } = getComputedStyle(element);
      expect(opacity).toBe('1');
      expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(transform);
    },
    { timeout: 5000 },
  );

// The play starts on the React render, before the Stencil hydration: wait for the components,
// then for mdsModalShow (the end of the window's opening transition) before opening the calendar.
const openModalAndCalendar = async ({ canvasElement, userEvent }) => {
  const modal = canvasElement.querySelector('#date-modal') as HTMLMdsModalElement;
  const host = canvasElement.querySelector('#modal-date') as HTMLMdsInputDateElement;
  await Promise.all([modal.componentOnReady(), host.componentOnReady()]);
  const dropdown = host.shadowRoot?.querySelector('mds-dropdown') as HTMLMdsDropdownElement;
  await dropdown.componentOnReady();

  let shown = false;
  modal.addEventListener(
    'mdsModalShow',
    () => {
      shown = true;
    },
    { once: true },
  );
  await userEvent.click(canvasElement.querySelector('#open-modal') as HTMLElement);
  await waitFor(() => expect(shown).toBe(true), { timeout: 5000 });

  await userEvent.click(host.shadowRoot?.querySelector('#calendar-dropdown') as HTMLElement);
  await waitFor(() => expect(dropdown).toHaveAttribute('visible'), { timeout: 5000 });
  await waitForSettled(dropdown);

  return {
    host,
    dropdown,
    calendar: dropdown.querySelector('mds-calendar') as HTMLMdsCalendarElement,
  };
};

// The calendar takes the field width (100cqw of the input-date host) capped by
// --mds-calendar-max-width (480px), with seven evenly sized columns; the dropdown ends at the
// field's right edge (placement bottom-end), pushed past it by at most the arrow padding (24px).
const expectCalendarSizedToField = ({ host, dropdown, calendar }): void => {
  const { width: fieldWidth, right: fieldRight } = host.getBoundingClientRect();
  const { width } = calendar.getBoundingClientRect();
  expect(width).toBeCloseTo(Math.min(fieldWidth, 480), 0);

  const cells = calendar.shadowRoot?.querySelector('.month-view__cells') as HTMLElement;
  const tracks = getComputedStyle(cells).gridTemplateColumns.split(' ').map(parseFloat);
  expect(tracks).toHaveLength(7);
  tracks.forEach((track) => expect(track).toBeCloseTo(tracks[0], 0));

  expect(dropdown.getBoundingClientRect().right).toBeGreaterThanOrEqual(fieldRight - 1);
  expect(dropdown.getBoundingClientRect().right).toBeLessThanOrEqual(fieldRight + 24);
};

export const UseCaseInsideModal = {
  render: InsideModalTemplate,

  play: async (context) => {
    expectCalendarSizedToField(await openModalAndCalendar(context));
  },
};

/**
 * Every state of the date field once the story has opened (#1440, @fixture/states). A field alone
 * is named by `aria-label`, as a product names it, and its dates are fixed, so that the story
 * looks the same tomorrow. A state only an interaction reaches (`play: true`) is brought there by
 * the play function, which checks the state, not its look. The calendar is opened in the last
 * cell, which keeps the room its panel opens into, so that it covers no other state.
 */
interface DateState {
  state: string;
  play?: boolean;
  field: Record<string, string | boolean>;
}

const birth = { 'aria-label': 'Data di nascita' };
const deadline = { 'aria-label': 'Scadenza della domanda' };
const works = { 'aria-label': 'Inizio dei lavori', min: '2026-01-12', max: '2026-06-30' };
const filed = { 'aria-label': 'Data di protocollo', value: '2026-03-02' };
const openCalendar = 'calendar open, min and max';

const dateStates: DateState[] = [
  { state: 'rest', field: birth },
  { state: 'value', field: { ...birth, value: '1983-02-21' } },
  { state: 'invalid date', field: { ...birth, value: '1983-02-30' } },
  { state: 'required', field: { ...deadline, required: true } },
  { state: 'required, with a date', field: { ...deadline, required: true, value: '2026-03-31' } },
  { state: 'required, left empty', play: true, field: { ...deadline, required: true } },
  { state: 'min and max', field: { ...works, value: '2026-03-02' } },
  { state: 'before min, left', play: true, field: { ...works, value: '2025-12-22' } },
  { state: 'after max, left', play: true, field: { ...works, value: '2026-07-15' } },
  { state: 'variant error', field: { ...deadline, variant: 'error', value: '2026-02-27' } },
  { state: 'variant warning', field: { ...deadline, variant: 'warning', value: '2026-03-02' } },
  { state: 'variant success', field: { ...deadline, variant: 'success', value: '2026-03-31' } },
  { state: 'variant info', field: { ...deadline, variant: 'info' } },
  { state: 'variant ai', field: { ...deadline, variant: 'ai', value: '2026-04-15' } },
  { state: 'readonly', field: { ...filed, readonly: true } },
  { state: 'disabled', field: { ...filed, disabled: true } },
  { state: 'size sm', field: { ...filed, size: 'sm' } },
  { state: 'size md', field: { ...filed, size: 'md' } },
  { state: 'size lg', field: { ...filed, size: 'lg' } },
  {
    state: openCalendar,
    play: true,
    field: { ...works, max: '2026-03-20', value: '2026-03-02' },
  },
];

const TemplateStates = () => (
  <StatesGrid>
    {dateStates.map(({ state, play, field }) => (
      <StateCell key={state} state={state} play={play}>
        <mds-input-date name={state} {...field}></mds-input-date>
        {/* the room the panel opens into: a calendar as wide as the field, up to its 480px */}
        {state === openCalendar && <div class="aspect-square max-w-12000 mb-1600"></div>}
      </StateCell>
    ))}
  </StatesGrid>
);

/** The field of a cell, once it and every Magma element in its shadow root have loaded. */
const loadedField = async (cell: HTMLElement): Promise<HTMLMdsInputDateElement> => {
  const field = cell.querySelector('mds-input-date') as HTMLMdsInputDateElement;
  await waitFor(() => expect(field).toHaveAttribute('hydrated'));
  const inner = Array.from(field.shadowRoot!.querySelectorAll('*')).filter((element) =>
    element.tagName.startsWith('MDS-'),
  );
  await waitFor(() => inner.forEach((element) => expect(element).toHaveAttribute('hydrated')));
  return field;
};

/**
 * Leaves the field as a person does, focus then blur on its native input. The events are sent,
 * because focus() and blur() fire nothing while the document has no focus.
 */
const leaveDate = async (cell: HTMLElement): Promise<void> => {
  const field = await loadedField(cell);
  const native = field.shadowRoot!.querySelector('input.input') as HTMLInputElement;
  native.dispatchEvent(new FocusEvent('focus'));
  native.dispatchEvent(new FocusEvent('blur'));
};

const playStates = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const field = (state: string) =>
    stateCell(canvasElement, state).querySelector('mds-input-date') as HTMLMdsInputDateElement;
  for (const state of ['required, left empty', 'before min, left', 'after max, left']) {
    await leaveDate(stateCell(canvasElement, state));
  }
  // the property, not the attribute: Stencil reflects it on the next frame, and a hidden page
  // draws no frame
  await waitFor(() => expect(field('required, left empty')).toHaveProperty('variant', 'error'));
  await waitFor(() => expect(field('before min, left')).toHaveProperty('variant', 'error'));
  await waitFor(() => expect(field('after max, left')).toHaveProperty('variant', 'error'));

  // last, as any click on the page closes the panel: the calendar button opens it, with a click
  // sent with no pointer behind it
  const open = await loadedField(stateCell(canvasElement, openCalendar));
  (open.shadowRoot!.querySelector('#calendar-dropdown') as HTMLElement).click();
  await waitFor(() =>
    expect(open.shadowRoot!.querySelector('mds-dropdown')).toHaveProperty('visible', true),
  );
};

export const States = {
  render: TemplateStates,

  play: playStates,
};
