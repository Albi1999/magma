import { h } from '@stencil/core';
import { expect, waitFor } from 'storybook/test';
import { StateCell, StatesGrid, stateCell } from '@fixture/states';

export default {
  title: 'UI / Forms / Filter / Filter item',
  id: 'ui-filter-filter-item',
  argTypes: {
    count: {
      type: { name: 'string' },
      description: 'Shows the number of items will be filtered by the component',
    },
    selected: {
      type: { name: 'boolean' },
      description: 'Sets the component to selected state',
    },
    label: {
      type: { name: 'string' },
      description: 'Sets the label of the filter',
    },
    value: {
      type: { name: 'string' },
      description: 'Sets the value of the component to be used with forms',
    },
  },
};

// an item is a toggle of a filter bar: the story renders it in its mds-filter
const Template = (args) => (
  <div class="inline-flex">
    <mds-filter label="Filters">
      <mds-filter-item {...args} />
    </mds-filter>
  </div>
);

export const Default = {
  render: Template,

  args: {
    label: 'Filter label',
  },
};

export const Selected = {
  render: Template,

  args: {
    label: 'Filter label',
    selected: true,
  },
};

/**
 * Every state an item has of its own once the story has opened (#1440, @fixture/states), each in
 * a bar of its own: an item is a toggle of an mds-filter, named by its label or, icon only, by
 * `aria-label`. The states that come from the bar (single and multiple choice, reset, the strip
 * that scrolls) are in the story of mds-filter. A state only an interaction reaches
 * (`play: true`) is brought there by the play function, which checks `selected`, not its look.
 */
interface ItemState {
  state: string;
  play?: boolean;
  filter: string;
  item: Record<string, string | boolean>;
}

const toSign = { label: 'Da firmare', value: 'da-firmare' };
const toSignCount = { ...toSign, count: '4' };
const pdf = { icon: 'mgg/file-type-pdf', label: 'PDF', value: 'pdf' };
const map = { icon: 'mdi/map-marker', 'aria-label': 'Mappa', value: 'mappa' };
const archived = { label: 'Archiviate', value: 'archiviate' };

const itemStates: ItemState[] = [
  { state: 'rest', filter: 'Stato della pratica', item: toSign },
  { state: 'selected', filter: 'Stato della pratica', item: { ...toSign, selected: true } },
  { state: 'count', filter: 'Stato della pratica', item: toSignCount },
  {
    state: 'count, selected',
    filter: 'Stato della pratica',
    item: { ...toSignCount, selected: true },
  },
  { state: 'icon and label', filter: 'Tipo di documento', item: pdf },
  {
    state: 'icon and label, selected',
    filter: 'Tipo di documento',
    item: { ...pdf, selected: true },
  },
  { state: 'icon, label and count', filter: 'Tipo di documento', item: { ...pdf, count: '24' } },
  {
    state: 'icon, label and count, selected',
    filter: 'Tipo di documento',
    item: { ...pdf, count: '24', selected: true },
  },
  { state: 'icon only', filter: 'Vista', item: map },
  { state: 'icon only, selected', filter: 'Vista', item: { ...map, selected: true } },
  { state: 'disabled', filter: 'Stato della pratica', item: { ...archived, disabled: true } },
  {
    state: 'disabled, with count',
    filter: 'Stato della pratica',
    item: { ...archived, count: '0', disabled: true },
  },
  {
    state: 'disabled, selected',
    filter: 'Stato della pratica',
    item: { ...archived, disabled: true, selected: true },
  },
  {
    state: 'long label',
    filter: 'Stato della segnalazione',
    item: { label: 'In attesa del sopralluogo tecnico', value: 'sopralluogo', count: '128' },
  },
  { state: 'selected by a click', play: true, filter: 'Stato della pratica', item: toSignCount },
  { state: 'selected with Enter', play: true, filter: 'Stato della pratica', item: toSignCount },
  { state: 'selected with Space', play: true, filter: 'Stato della pratica', item: toSignCount },
];

const TemplateStates = () => (
  <StatesGrid>
    {itemStates.map(({ state, play, filter, item }) => (
      <StateCell key={state} state={state} play={play}>
        <div class="flex">
          <mds-filter label={filter}>
            <mds-filter-item {...item}></mds-filter-item>
          </mds-filter>
        </div>
      </StateCell>
    ))}
  </StatesGrid>
);

/** The item of a cell, once every Magma element of the cell has loaded. */
const loadedItem = async (canvasElement: HTMLElement, state: string) => {
  const cell = stateCell(canvasElement, state);
  const elements = Array.from(cell.querySelectorAll('*')).filter((element) =>
    element.tagName.startsWith('MDS-'),
  );
  await waitFor(() => elements.forEach((element) => expect(element).toHaveAttribute('hydrated')));
  return cell.querySelector('mds-filter-item') as HTMLMdsFilterItemElement;
};

/** A key sent to the item: the keys of a button, Enter on its press and Space on its release. */
const key = (item: HTMLElement, type: 'keydown' | 'keyup', code: string) =>
  item.dispatchEvent(
    new KeyboardEvent(type, {
      code,
      key: code === 'Space' ? ' ' : code,
      bubbles: true,
      cancelable: true,
    }),
  );

const playStates = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const clicked = await loadedItem(canvasElement, 'selected by a click');
  clicked.click();
  const enter = await loadedItem(canvasElement, 'selected with Enter');
  key(enter, 'keydown', 'Enter');
  const space = await loadedItem(canvasElement, 'selected with Space');
  key(space, 'keydown', 'Space');
  key(space, 'keyup', 'Space');

  // the property, not the attribute: Stencil reflects it on the next frame, and a hidden page
  // draws no frame
  await waitFor(() => expect(clicked).toHaveProperty('selected', true));
  await waitFor(() => expect(enter).toHaveProperty('selected', true));
  await waitFor(() => expect(space).toHaveProperty('selected', true));
};

export const States = {
  render: TemplateStates,

  play: playStates,
};
