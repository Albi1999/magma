import { h } from '@stencil/core';
import { expect, waitFor } from 'storybook/test';
import { StateCell, StatesGrid, stateCell } from '@fixture/states';

export default {
  title: 'UI / Forms / Filter',
  id: 'ui-filter',
  argTypes: {
    'auto-reset': {
      type: { name: 'boolean' },
      description: 'Sets an automatic reset of active filters if all filters are triggered',
    },
    label: {
      type: { name: 'string' },
      description: 'Sets the label of the filter',
    },
    multiple: {
      type: { name: 'boolean' },
      description: 'Sets if the filter group can filter multiple filters simultaneously',
    },
    reset: {
      type: { name: 'boolean' },
      description: 'Shows a reset button if one or more filters are active',
    },
  },
};

const Template = (args) => (
  <mds-filter {...args}>
    <mds-filter-item label="This first time" value="1" count="101" />
    <mds-filter-item label="Infamous second son" value="2" count="43" />
    <mds-filter-item label="The third sequence" value="3" count="7" />
  </mds-filter>
);

export const Default = {
  render: Template,

  args: {
    label: 'Filter label',
  },
};

export const AutoReset = {
  render: Template,

  args: {
    multiple: true,
    'auto-reset': true,
  },
};

export const Reset = {
  render: Template,

  args: {
    multiple: true,
    reset: true,
  },
};

export const Multiple = {
  render: Template,

  args: {
    multiple: true,
  },
};

/**
 * Every state of the filter once the story has opened (#1440, @fixture/states): the states of
 * the bar and of the selection it keeps; the states of an item of its own are in the story of
 * mds-filter-item. A bar is named by its `label`, as a product names it, an item by its label or,
 * icon only, by `aria-label`. A state only an interaction reaches (`play: true`) is brought there
 * by the play function, which checks the selection on the items, not its look.
 */
interface FilterItem {
  label?: string;
  value: string;
  count?: string;
  icon?: string;
  selected?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
}

interface FilterState {
  state: string;
  play?: boolean;
  filter: Record<string, string | boolean>;
  items: FilterItem[];
}

/** The items, the ones of `selected` selected; the others without the attribute, as in markup. */
const selecting = (items: FilterItem[], ...selected: string[]): FilterItem[] =>
  items.map((item) => (selected.includes(item.value) ? { ...item, selected: true } : item));

const caseStatus = { label: 'Stato della pratica' };
const caseItems: FilterItem[] = [
  { label: 'Bozza', value: 'bozza' },
  { label: 'Inviata', value: 'inviata' },
  { label: 'In istruttoria', value: 'istruttoria' },
  { label: 'Conclusa', value: 'conclusa' },
];

const sector = { label: 'Settore', multiple: true };
const sectorItems: FilterItem[] = [
  { label: 'Sanità', value: 'sanita' },
  { label: 'Istruzione', value: 'istruzione' },
  { label: 'Trasporti', value: 'trasporti' },
  { label: 'Ambiente', value: 'ambiente' },
];

const region = { label: 'Zona', multiple: true };
const regionItems: FilterItem[] = [
  { label: 'Nord', value: 'nord' },
  { label: 'Centro', value: 'centro' },
  { label: 'Sud', value: 'sud' },
];

const reportItems: FilterItem[] = [
  { label: 'Illuminazione pubblica e semafori', value: 'illuminazione' },
  { label: 'Manutenzione di strade e marciapiedi', value: 'strade' },
  { label: 'Raccolta dei rifiuti ingombranti', value: 'rifiuti' },
  { label: 'Verde pubblico, parchi e giardini', value: 'verde' },
];

const filterStates: FilterState[] = [
  { state: 'single choice', filter: caseStatus, items: caseItems },
  {
    state: 'single choice, one selected',
    filter: caseStatus,
    items: selecting(caseItems, 'istruttoria'),
  },
  {
    state: 'single choice, two selected in the markup',
    filter: caseStatus,
    items: selecting(caseItems, 'bozza', 'conclusa'),
  },
  { state: 'multiple choice', filter: sector, items: sectorItems },
  {
    state: 'multiple choice, items selected',
    filter: sector,
    items: selecting(sectorItems, 'sanita', 'istruzione', 'ambiente'),
  },
  {
    state: 'icon and count',
    filter: { label: 'Tipo di documento', multiple: true },
    items: [
      { icon: 'mgg/file-type-pdf', label: 'PDF', value: 'pdf', count: '24', selected: true },
      { icon: 'mi/baseline/panorama', label: 'Immagini', value: 'immagini', count: '8' },
      { icon: 'mi/baseline/videocam', label: 'Video', value: 'video', count: '1' },
    ],
  },
  {
    state: 'icon only',
    filter: { label: 'Vista' },
    items: [
      { icon: 'mi/baseline/grid-view', 'aria-label': 'Griglia', value: 'griglia' },
      { icon: 'mi/baseline/view-list', 'aria-label': 'Elenco', value: 'elenco', selected: true },
      { icon: 'mdi/map-marker', 'aria-label': 'Mappa', value: 'mappa' },
    ],
  },
  {
    state: 'disabled items',
    filter: caseStatus,
    items: [
      { label: 'Bozza', value: 'bozza', count: '4', selected: true },
      { label: 'Inviata', value: 'inviata', count: '12' },
      { label: 'Archiviata', value: 'archiviata', count: '0', disabled: true },
    ],
  },
  { state: 'reset, nothing selected', filter: { ...region, reset: true }, items: regionItems },
  {
    state: 'reset, items selected',
    filter: { ...region, reset: true },
    items: selecting(regionItems, 'nord', 'sud'),
  },
  {
    state: 'auto reset, items selected',
    filter: { ...region, 'auto-reset': true },
    items: selecting(regionItems, 'nord', 'centro'),
  },
  { state: 'long labels', filter: { label: 'Categoria della segnalazione' }, items: reportItems },
  {
    state: 'long labels, last selected',
    filter: { label: 'Categoria della segnalazione' },
    items: selecting(reportItems, 'verde'),
  },
  {
    state: 'single choice, selected by a click',
    play: true,
    filter: caseStatus,
    items: selecting(caseItems, 'bozza'),
  },
  {
    state: 'multiple choice, selected by clicks',
    play: true,
    filter: sector,
    items: sectorItems,
  },
  {
    state: 'reset, cleared by its button',
    play: true,
    filter: { ...region, reset: true },
    items: selecting(regionItems, 'nord', 'sud'),
  },
  {
    state: 'auto reset, every item clicked',
    play: true,
    filter: { ...region, 'auto-reset': true },
    items: regionItems,
  },
];

const TemplateStates = () => (
  <StatesGrid>
    {filterStates.map(({ state, play, filter, items }) => (
      <StateCell key={state} state={state} play={play}>
        <mds-filter {...filter}>
          {items.map((item) => (
            <mds-filter-item key={item.value} {...item}></mds-filter-item>
          ))}
        </mds-filter>
      </StateCell>
    ))}
  </StatesGrid>
);

/** The items of a cell, by value, once every Magma element of the cell has loaded. */
const loadedItems = async (canvasElement: HTMLElement, state: string) => {
  const cell = stateCell(canvasElement, state);
  const elements = Array.from(cell.querySelectorAll('*')).filter((element) =>
    element.tagName.startsWith('MDS-'),
  );
  await waitFor(() => elements.forEach((element) => expect(element).toHaveAttribute('hydrated')));
  const filter = cell.querySelector('mds-filter') as HTMLMdsFilterElement;
  const item = (value: string) =>
    cell.querySelector(`mds-filter-item[value="${value}"]`) as HTMLMdsFilterItemElement;
  return { filter, item };
};

const playStates = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const single = await loadedItems(canvasElement, 'single choice, selected by a click');
  single.item('istruttoria').click();

  const multiple = await loadedItems(canvasElement, 'multiple choice, selected by clicks');
  multiple.item('sanita').click();
  multiple.item('trasporti').click();

  const reset = await loadedItems(canvasElement, 'reset, cleared by its button');
  (reset.filter.shadowRoot!.querySelector('.reset-button') as HTMLElement).click();

  // the last item clicked selects them all: the filter clears them
  const autoReset = await loadedItems(canvasElement, 'auto reset, every item clicked');
  regionItems.forEach(({ value }) => autoReset.item(value).click());

  // the property, not the attribute: Stencil reflects it on the next frame, and a hidden page
  // draws no frame
  await waitFor(() => expect(single.item('istruttoria')).toHaveProperty('selected', true));
  await waitFor(() => expect(single.item('bozza')).toHaveProperty('selected', false));
  await waitFor(() => expect(multiple.item('sanita')).toHaveProperty('selected', true));
  await waitFor(() => expect(multiple.item('trasporti')).toHaveProperty('selected', true));
  await waitFor(() => expect(multiple.item('istruzione')).not.toHaveProperty('selected', true));
  for (const { value } of regionItems) {
    await waitFor(() => expect(reset.item(value)).toHaveProperty('selected', false));
    await waitFor(() => expect(autoReset.item(value)).toHaveProperty('selected', false));
  }
};

export const States = {
  render: TemplateStates,

  play: playStates,
};
