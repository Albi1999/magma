import { StateCell, StatesGrid, stateCell } from '@fixture/states';
import { h } from '@stencil/core';
import { expect, waitFor } from 'storybook/test';

export default {
  title: 'UI / Forms / Calendar',
  id: 'ui-calendar',
  argTypes: {
    'start-date': {
      control: 'select',
      options: ['2024-12-12', '2024-12-14'],
      description: 'Sets the start date of the calendar',
    },
    'end-date': {
      control: 'select',
      options: ['2024-12-16', '2024-12-24'],
      description: 'Sets the end date of the calendar',
    },
    'hide-today': {
      control: 'boolean',
      description: "Hides the highlight on today's date",
    },
    'single-picker': {
      control: 'boolean',
      description: 'Selects a single date instead of a date range',
    },
    'hide-previous-button': {
      control: 'boolean',
      description: 'Hides the previous navigation button',
    },
    'hide-next-button': {
      control: 'boolean',
      description: 'Hides the next navigation button',
    },
  },
};

const Template = (args) => <mds-calendar {...args}></mds-calendar>;

export const Default = {
  render: Template,

  args: {
    'start-date': '2025-03-18',
    'end-date': '2025-03-24',
  },
};

export const SinglePicker = {
  render: Template,

  args: {
    'single-picker': true,
    'start-date': '2025-03-18',
  },
};

/**
 * Every state of the calendar once the story has opened (#1440, @fixture/states). Each calendar
 * shows a month of its own, fixed in its dates, so that the story looks the same tomorrow and
 * the header of each, a navigation landmark named after its month, has a name of its own. A state
 * only an interaction reaches (`play: true`) is brought there by the play function, which checks
 * the state, not its look.
 */
interface CalendarState {
  state: string;
  play?: boolean;
  calendar: Record<string, string | boolean>;
  preselection?: boolean;
}

const calendarStates: CalendarState[] = [
  { state: 'rest', calendar: { 'view-date': '2026-01-01' } },
  {
    state: 'single picker, a day',
    calendar: { 'single-picker': true, 'start-date': '2026-02-12' },
  },
  { state: 'range, start only', calendar: { 'start-date': '2026-03-09' } },
  {
    state: 'range, both ends',
    calendar: { 'start-date': '2026-04-07', 'end-date': '2026-04-14' },
  },
  {
    state: 'range, one day',
    calendar: { 'start-date': '2026-05-21', 'end-date': '2026-05-21' },
  },
  {
    state: 'range across two months',
    calendar: { 'start-date': '2026-06-24', 'end-date': '2026-07-03' },
  },
  {
    state: 'hover preview, the band to the end',
    calendar: { 'start-date': '2026-07-06', 'hover-date': '2026-07-10' },
  },
  {
    state: 'hover preview, a new start before the start',
    calendar: { 'start-date': '2026-08-17', 'hover-date': '2026-08-11' },
  },
  {
    state: 'active end start, hover preview after the start',
    calendar: { 'start-date': '2026-09-08', 'active-end': 'start', 'hover-date': '2026-09-15' },
  },
  {
    state: 'min and max',
    calendar: {
      'single-picker': true,
      'start-date': '2026-10-14',
      min: '2026-10-05',
      max: '2026-10-23',
    },
  },
  {
    state: 'preselection',
    calendar: { 'start-date': '2025-12-01', 'end-date': '2025-12-07' },
    preselection: true,
  },
  {
    state: 'preselection hidden',
    calendar: { 'start-date': '2025-11-03', 'end-date': '2025-11-09', 'hide-preselection': true },
    preselection: true,
  },
  {
    state: 'first of a pair: next hidden, header locked',
    calendar: {
      'view-date': '2025-09-01',
      'hide-next-button': true,
      'disable-month-year-selection': true,
    },
  },
  {
    state: 'second of a pair: previous hidden, header locked',
    calendar: {
      'view-date': '2025-10-01',
      'hide-previous-button': true,
      'disable-month-year-selection': true,
    },
  },
  { state: 'months view', play: true, calendar: { 'view-date': '2025-06-01' } },
  { state: 'years view', play: true, calendar: { 'view-date': '2025-05-01' } },
];

const TemplateStates = () => (
  <StatesGrid>
    {calendarStates.map(({ state, play, calendar, preselection }) => (
      <StateCell key={state} state={state} play={play}>
        <mds-calendar {...calendar}>
          {preselection && (
            <div slot="preselection" class="flex flex-wrap gap-200">
              <mds-button variant="dark" tone="text" label="Ultimi 7 giorni"></mds-button>
              <mds-button variant="dark" tone="text" label="Ultimi 30 giorni"></mds-button>
            </div>
          )}
        </mds-calendar>
      </StateCell>
    ))}
  </StatesGrid>
);

/** The calendar of a cell, once it and the buttons of its header have loaded. */
const loadedCalendar = async (cell: HTMLElement): Promise<HTMLMdsCalendarElement> => {
  const calendar = cell.querySelector('mds-calendar') as HTMLMdsCalendarElement;
  await waitFor(() => expect(calendar).toHaveAttribute('hydrated'));
  const buttons = Array.from(calendar.shadowRoot!.querySelectorAll('nav mds-button'));
  await waitFor(() => buttons.forEach((button) => expect(button).toHaveAttribute('hydrated')));
  return calendar;
};

const playStates = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  // the month and the year in the header open their views on a click; click() sends it, with no
  // pointer and no focus behind it
  const months = await loadedCalendar(stateCell(canvasElement, 'months view'));
  (months.shadowRoot!.querySelector('.action-month') as HTMLElement).click();
  const years = await loadedCalendar(stateCell(canvasElement, 'years view'));
  (years.shadowRoot!.querySelector('.action-year') as HTMLElement).click();

  // the view is a state of the calendar of its own: the grid it renders, and on the months view
  // the arrows, which have nothing to page through, disabled on their property
  await waitFor(() =>
    expect(months.shadowRoot!.querySelector('section.month-selection')).not.toBeNull(),
  );
  await waitFor(() =>
    expect(months.shadowRoot!.querySelector('.action-back')).toHaveProperty('disabled', true),
  );
  await waitFor(() =>
    expect(years.shadowRoot!.querySelector('section.year-selection')).not.toBeNull(),
  );
};

export const States = {
  render: TemplateStates,

  play: playStates,
};
