import { StateCell, StatesGrid, stateCell } from '@fixture/states';
import { h } from '@stencil/core';
import { expect, waitFor } from 'storybook/test';

export default {
  title: 'UI / Forms / Input Date Range',
  id: 'form-input-date-range',
  argTypes: {
    delay: {
      type: { name: 'number' },
      description: 'Specifies the delay in milliseconds before closing the calendar dropdown',
    },
    'start-date': {
      type: { name: 'string' },
      description: 'Specifies the start date of the range',
    },
    'end-date': {
      type: { name: 'string' },
      description: 'Specifies the end date of the range',
    },
    min: {
      type: { name: 'string' },
      description: 'Specifies the min date of the range, user cannot set dates before this date',
    },
    max: {
      type: { name: 'string' },
      description: 'Specifies the max date of the range, user cannot set dates after this date',
    },
    'dual-calendar': {
      type: { name: 'boolean' },
      description: 'Enables the linked dual-calendar range picker behavior',
    },
    disabled: {
      type: { name: 'boolean' },
      description:
        'Disables the range, its calendar and the two fields: the dates are left out of the form',
    },
  },
};

const formatDate = (date = new Date()) => {
  // Format: YYYY-MM-DD
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMonthBounds = (date = new Date()) => {
  // Primo giorno del mese
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);

  // Ultimo giorno del mese
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  return {
    startOfMonth: formatDate(firstDay),
    endOfMonth: formatDate(lastDay),
  };
};

const getWeekBounds = (date = new Date()) => {
  // Clona la data per non modificarla
  const currentDate = new Date(date);

  // Ottiene il giorno della settimana (0 = domenica, 1 = lunedì, ..., 6 = sabato)
  const day = currentDate.getDay();

  // Calcola differenza dal lunedì
  const diffToMonday = day === 0 ? -6 : 1 - day;

  // Primo giorno (lunedì)
  const monday = new Date(currentDate);
  monday.setDate(currentDate.getDate() + diffToMonday);

  // Ultimo giorno (domenica)
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  // Ritorna date pulite (solo anno-mese-giorno)
  return {
    startOfWeek: monday.toISOString().split('T')[0],
    endOfWeek: sunday.toISOString().split('T')[0],
  };
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
  <mds-input-date-range {...args} class="max-w-[400px]">
    <mds-input-date slot="start"></mds-input-date>
    <mds-input-date slot="end"></mds-input-date>
  </mds-input-date-range>
);

const TemplateMinMax = (args) => (
  <div class="grid gap-400 max-w-[400px]">
    <mds-input-date-range {...args}>
      <mds-input-date slot="start"></mds-input-date>
      <mds-input-date slot="end"></mds-input-date>
    </mds-input-date-range>
    <div class="inline-flex gap-400">
      <mds-text>Min date {args.min}</mds-text>
      <mds-text>Max date {args.max}</mds-text>
    </div>
  </div>
);

const TemplatePreselection = (args) => {
  const { startOfWeek, endOfWeek } = getWeekBounds();
  const { startOfMonth, endOfMonth } = getMonthBounds();
  return (
    <div class="grid gap-400 max-w-[400px]">
      <mds-input-date-range {...args}>
        <mds-input-date slot="start"></mds-input-date>
        <mds-input-date slot="end"></mds-input-date>
        <mds-input-date-range-preselection start={startOfWeek} end={endOfWeek}>
          Questa settimana
        </mds-input-date-range-preselection>
        <mds-input-date-range-preselection start={startOfMonth} end={endOfMonth}>
          Questo mese
        </mds-input-date-range-preselection>
      </mds-input-date-range>
    </div>
  );
};

export const Default = {
  render: Template,
};

export const InvalidDates = {
  render: Template,

  args: {
    'start-date': getDate(-3),
    'end-date': getDate(4),
  },
};

export const MinMax = {
  render: TemplateMinMax,

  args: {
    'start-date': getDate(-3),
    'end-date': getDate(4),
    min: getDate(-30),
    max: getDate(30),
  },
};

export const Preselection = {
  render: TemplatePreselection,
};

// The flow of #341, walked by the play of the stories below: the calendar picks the start, passes
// to the end by itself, picks the end; then the voice of the start in the header changes the start
// alone. delay 0 keeps the panel open, so that the a11y check audits the header and the calendar.
const pad = (value: number): string => String(value).padStart(2, '0');

const dayOfMonth = (n: number): string => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(n)}`;
};

const walkTheRange = async ({ canvasElement, userEvent }) => {
  const host = canvasElement.querySelector('mds-input-date-range') as HTMLMdsInputDateRangeElement;
  await host.componentOnReady();
  const root = host.shadowRoot as ShadowRoot;
  const dropdown = root.querySelector('mds-dropdown') as HTMLMdsDropdownElement;
  await dropdown.componentOnReady();

  const cell = (date: string): HTMLElement =>
    Array.from(root.querySelectorAll('mds-calendar'))
      .map((calendar) =>
        calendar.shadowRoot?.querySelector<HTMLElement>(
          `mds-calendar-cell[date="${date}"][month="current"]`,
        ),
      )
      .find((found) => found != null) as HTMLElement;
  const voice = (end: 'start' | 'end'): HTMLMdsTabItemElement =>
    root.querySelector(`mds-tab-item[value="${end}"]`) as HTMLMdsTabItemElement;
  const dates = (): string[] =>
    ['start', 'end'].map(
      (end) => (host.querySelector(`[slot="${end}"]`) as HTMLMdsInputDateElement).value ?? '',
    );

  await userEvent.click(root.querySelector('#calendar-dropdown') as HTMLElement);
  await waitFor(() => expect(dropdown).toHaveAttribute('visible'), { timeout: 5000 });
  await waitFor(() => expect(voice('start')).toHaveAttribute('selected'));

  await userEvent.click(cell(dayOfMonth(10)));
  await waitFor(() => expect(dates()).toEqual([dayOfMonth(10), '']));
  await waitFor(() => expect(voice('end')).toHaveAttribute('selected'));

  await userEvent.click(cell(dayOfMonth(14)));
  await waitFor(() => expect(dates()).toEqual([dayOfMonth(10), dayOfMonth(14)]));

  // the voice listens on its inner button, which a synthetic click on the host never reaches
  await userEvent.click(voice('start').shadowRoot?.querySelector('mds-button') as HTMLElement);
  await waitFor(() => expect(voice('start')).toHaveAttribute('selected'));

  await userEvent.click(cell(dayOfMonth(5)));
  await waitFor(() => expect(dates()).toEqual([dayOfMonth(5), dayOfMonth(14)]));
  await waitFor(() => expect(voice('end')).toHaveAttribute('selected'));
};

// The palette flips on the classes of <html>, which the components watch: the dark stories set
// the mode for themselves and give the previous one back when they end.
const inDarkMode = () => {
  const html = document.documentElement;
  const previous = Array.from(html.classList).filter((name) => name.startsWith('pref-mode-'));
  const previousVariable = html.style.getPropertyValue('--magma-pref-mode');
  html.classList.remove(...previous);
  html.classList.add('pref-mode-dark');
  html.style.setProperty('--magma-pref-mode', 'dark');
  return () => {
    html.classList.remove('pref-mode-dark');
    html.classList.add(...previous);
    if (previousVariable !== '') html.style.setProperty('--magma-pref-mode', previousVariable);
    else html.style.removeProperty('--magma-pref-mode');
  };
};

export const PickARange = {
  render: Template,

  args: {
    delay: 0,
  },

  play: walkTheRange,
};

export const PickARangeDark = {
  render: Template,

  args: {
    delay: 0,
  },

  beforeEach: inDarkMode,
  play: walkTheRange,
};

export const DualCalendar = {
  render: Template,

  args: {
    'dual-calendar': true,
    delay: 0,
  },

  play: walkTheRange,
};

export const DualCalendarDark = {
  render: Template,

  args: {
    'dual-calendar': true,
    delay: 0,
  },

  beforeEach: inDarkMode,
  play: walkTheRange,
};

/**
 * Every state of the range once the story has opened (#1440, @fixture/states). A range alone is
 * named by `aria-label`, as a product names it, which names its two fields; its dates are fixed,
 * so that the story looks the same tomorrow. A state only an interaction reaches (`play: true`)
 * is brought there by the play function, which checks the state, not its look. One panel can be
 * open at a time, a click on the page closes it: it is opened in the last cell, on the dual
 * calendar, with presets, a start alone and the pointer on a day of the second month, and the
 * cell keeps the room it opens into, so that it covers no other state.
 */
interface RangeState {
  state: string;
  play?: boolean;
  range: Record<string, string | boolean>;
  preselection?: boolean;
}

const period = { 'aria-label': 'Periodo di validità' };
const dated = { ...period, 'start-date': '2026-03-02', 'end-date': '2026-03-13' };
const works = { 'aria-label': 'Periodo dei lavori', min: '2026-01-12', max: '2026-06-30' };
const openPanel = 'calendar open: dual, presets, end active, hover preview';

const rangeStates: RangeState[] = [
  { state: 'rest', range: period },
  { state: 'start only', range: { ...period, 'start-date': '2026-03-02' } },
  { state: 'both ends', range: dated },
  {
    state: 'min and max',
    range: { ...works, 'start-date': '2026-02-02', 'end-date': '2026-02-27' },
  },
  {
    state: 'start before min, left',
    play: true,
    range: { ...works, 'start-date': '2025-12-22', 'end-date': '2026-01-30' },
  },
  {
    state: 'end before start, left',
    play: true,
    range: { ...period, 'start-date': '2026-03-20', 'end-date': '2026-03-10' },
  },
  { state: 'disabled', range: { ...dated, disabled: true } },
  { state: 'size sm', range: { ...dated, size: 'sm' } },
  { state: 'size md', range: { ...dated, size: 'md' } },
  { state: 'size lg', range: { ...dated, size: 'lg' } },
  {
    state: openPanel,
    play: true,
    range: { 'aria-label': 'Periodo di ferie', 'start-date': '2026-07-27', 'dual-calendar': true },
    preselection: true,
  },
];

const TemplateStates = () => (
  <StatesGrid>
    {rangeStates.map(({ state, play, range, preselection }) => (
      <StateCell key={state} state={state} play={play}>
        <mds-input-date-range name={state} {...range}>
          <mds-input-date slot="start"></mds-input-date>
          <mds-input-date slot="end"></mds-input-date>
          {preselection && [
            <mds-input-date-range-preselection key="week" start="2026-08-03" end="2026-08-09">
              Prima settimana di agosto
            </mds-input-date-range-preselection>,
            <mds-input-date-range-preselection key="month" start="2026-08-01" end="2026-08-31">
              Tutto agosto
            </mds-input-date-range-preselection>,
          ]}
        </mds-input-date-range>
        {/* the room the panel opens into: its two calendars side by side, whatever the width */}
        {state === openPanel && <div class="h-12000"></div>}
      </StateCell>
    ))}
  </StatesGrid>
);

/** The range of a cell, once every Magma element in it and in its shadow root has loaded. */
const loadedRange = async (cell: HTMLElement): Promise<HTMLMdsInputDateRangeElement> => {
  const range = cell.querySelector('mds-input-date-range') as HTMLMdsInputDateRangeElement;
  const magma = (root: ParentNode) =>
    Array.from(root.querySelectorAll('*')).filter((element) => element.tagName.startsWith('MDS-'));
  await waitFor(() =>
    magma(cell).forEach((element) => expect(element).toHaveAttribute('hydrated')),
  );
  await waitFor(() =>
    magma(range.shadowRoot!).forEach((element) => expect(element).toHaveAttribute('hydrated')),
  );
  return range;
};

const field = (range: HTMLElement, end: 'start' | 'end'): HTMLMdsInputDateElement =>
  range.querySelector(`[slot="${end}"]`) as HTMLMdsInputDateElement;

/**
 * Goes into a field of the range and leaves the range, as a person does: focus, then blur, on
 * its native input. The events are sent, because focus() and blur() fire nothing while the
 * document has no focus; focusin and focusout cross the shadow roots up to the range, as the
 * browser sends them.
 */
const leaveRange = async (cell: HTMLElement, end: 'start' | 'end'): Promise<void> => {
  const range = await loadedRange(cell);
  const native = field(range, end).shadowRoot!.querySelector('input.input') as HTMLInputElement;
  native.dispatchEvent(new FocusEvent('focus'));
  native.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
  native.dispatchEvent(new FocusEvent('blur'));
  native.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
};

const playStates = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const range = (state: string) =>
    stateCell(canvasElement, state).querySelector('mds-input-date-range') as HTMLElement;
  await leaveRange(stateCell(canvasElement, 'start before min, left'), 'start');
  await leaveRange(stateCell(canvasElement, 'end before start, left'), 'end');
  // the property, not the attribute: Stencil reflects it on the next frame, and a hidden page
  // draws no frame
  await waitFor(() =>
    expect(field(range('start before min, left'), 'start')).toHaveProperty('variant', 'error'),
  );
  // leaving the range snaps an end before the start to the start
  await waitFor(() =>
    expect(field(range('end before start, left'), 'end')).toHaveProperty('value', '2026-03-20'),
  );

  // last, as any click on the page closes the panel: the calendar button opens it, with a click
  // sent with no pointer behind it, and renders its calendars again
  const open = await loadedRange(stateCell(canvasElement, openPanel));
  const root = open.shadowRoot!;
  const closed = Array.from(root.querySelectorAll('mds-calendar'));
  (root.querySelector('#calendar-dropdown') as HTMLElement).click();
  await waitFor(() => expect(root.querySelector('mds-dropdown')).toHaveProperty('visible', true));
  // the pointer on a day of the second month: the range spreads it to both calendars, the ones
  // the opening rendered again
  const calendars = await waitFor(() => {
    const found = Array.from(root.querySelectorAll('mds-calendar'));
    expect(found).toHaveLength(2);
    found.forEach((calendar) => {
      expect(closed).not.toContain(calendar);
      expect(calendar).toHaveAttribute('hydrated');
    });
    return found;
  });
  const day = await waitFor(() => {
    const cell = calendars[1].shadowRoot!.querySelector(
      'mds-calendar-cell[date="2026-08-07"][month="current"]',
    );
    expect(cell).not.toBeNull();
    return cell as HTMLElement;
  });
  day.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true }));
  await waitFor(() =>
    calendars.forEach((calendar) => expect(calendar).toHaveProperty('hoverDate', '2026-08-07')),
  );
  // with a start alone, the calendar picks the end: its voice in the header is the selected one
  await waitFor(() =>
    expect(root.querySelector('mds-tab-item[value="end"]')).toHaveProperty('selected', true),
  );
};

export const States = {
  render: TemplateStates,

  play: playStates,
};
