import { typographyInfoDictionary, typographyVariationsDictionary } from '@type/typography';
import { inputSwitchSizeDictionary } from '../meta/dictionary';
import { iconsDictionary } from '@type/icon';
import { h } from '@stencil/core';
import { StateCell, StatesGrid, stateCell } from '@fixture/states';
import { expect, waitFor } from 'storybook/test';

export default {
  title: 'UI / Forms / Switch',
  id: 'form-switch',
  argTypes: {
    autofocus: {
      type: { name: 'boolean' },
      description:
        'Sets or returns whether a checkbox should automatically get focus when the page loads',
    },
    checked: {
      type: { name: 'boolean' },
      description:
        'Specifies that an <input> element should be pre-selected when the page loads (for type="checkbox" or type="radio")',
    },
    disabled: {
      type: { name: 'boolean' },
      description: 'Sets or returns whether a checkbox is disabled, or not',
    },
    explicit: {
      type: { name: 'boolean' },
      description: 'Sets if the type switch mode shows explicit icons',
    },
    icon: {
      type: { name: 'string' },
      description:
        'The name of the icon set. The icon set is strictly realted to @maggioli-design-system/icons',
      options: iconsDictionary,
      control: { type: 'select' },
    },
    indeterminate: {
      type: { name: 'boolean' },
      description: 'Sets or returns the indeterminate state of the checkbox',
    },
    name: {
      type: { name: 'string' },
      description: 'Specifies the name of an <input> element',
    },
    size: {
      control: { type: 'select' },
      description:
        'Specifies the size for the switch toggle, it works only if attribute "type" is set to "switch"',
      options: inputSwitchSizeDictionary,
      type: { name: 'string' },
    },
    typography: {
      control: { type: 'select' },
      description: 'Specifies the font typography of the element',
      options: typographyInfoDictionary,
      type: { name: 'string' },
    },
    variant: {
      description: 'Specifies the variant for `typography`',
      options: typographyVariationsDictionary,
      control: { type: 'select' },
    },
    type: {
      control: { type: 'select' },
      description: 'Specifies the type of element',
      options: ['switch', 'checkbox', 'radio'],
      type: { name: 'string' },
    },
    value: {
      type: { name: 'string' },
      description: 'Specifies the value of the input element',
    },
  },
};

const Template = (args) => <mds-input-switch {...args}>Notifiche via e-mail</mds-input-switch>;

const TemplateMultiple = (args) => (
  <form name="form-name" class="grid grid-cols-1 gap-400">
    <mds-input-switch {...args} value="1">
      Choice A
    </mds-input-switch>
    <mds-input-switch {...args} value="2">
      Choice B
    </mds-input-switch>
    <mds-input-switch {...args} value="2">
      Choice C
    </mds-input-switch>
    <mds-input-switch {...args} value="2">
      Choice D
    </mds-input-switch>
  </form>
);

const TemplateList = () => (
  <div class="grid grid-cols-1 gap-400">
    <mds-input-switch value="1" checked>
      Choice A
    </mds-input-switch>
    <mds-input-switch value="2">Choice B</mds-input-switch>
    <mds-input-switch value="3" disabled>
      Choice C
    </mds-input-switch>
    <mds-input-switch value="4" checked disabled>
      Choice D
    </mds-input-switch>
    <mds-input-switch value="1" explicit checked>
      Choice A
    </mds-input-switch>
    <mds-input-switch value="2" explicit>
      Choice B
    </mds-input-switch>
    <mds-input-switch value="3" explicit disabled>
      Choice C
    </mds-input-switch>
    <mds-input-switch value="4" explicit checked disabled>
      Choice D
    </mds-input-switch>
  </div>
);

export const Default = {
  render: Template,

  args: {
    name: 'input-name',
    type: 'switch',
    value: '1',
  },
};

export const ListExample = {
  render: TemplateList,

  args: {
    name: 'input-name',
    type: 'switch',
    value: '1',
  },
};

export const Checked = {
  render: Template,

  args: {
    checked: true,
    name: 'input-name',
    type: 'switch',
    value: '1',
  },
};

export const Disabled = {
  render: Template,

  args: {
    checked: true,
    disabled: true,
    name: 'input-name',
    type: 'switch',
    value: '1',
  },
};

export const Explicit = {
  render: Template,

  args: {
    explicit: true,
    name: 'input-name',
    type: 'switch',
    value: '1',
  },
};

export const Icon = {
  render: Template,

  args: {
    name: 'input-name',
    checked: true,
    icon: 'mi/baseline/check-circle',
    type: 'checkbox',
    value: '1',
  },
};

export const Indeterminate = {
  render: Template,

  args: {
    name: 'input-name',
    checked: true,
    indeterminate: true,
    type: 'checkbox',
    value: '1',
  },
};

export const Size = {
  render: Template,

  args: {
    checked: true,
    size: inputSwitchSizeDictionary[0],
    name: 'input-name',
    type: 'switch',
    value: '1',
  },
};

export const Typography = {
  render: Template,

  args: {
    checked: true,
    size: inputSwitchSizeDictionary[0],
    typography: 'caption',
    name: 'input-name',
    type: 'switch',
    value: '1',
  },
};

export const Checkbox = {
  render: Template,

  args: {
    name: 'checkbox-name',
    type: 'checkbox',
    value: '1',
  },
};

export const Radio = {
  render: TemplateMultiple,

  args: {
    name: 'radio-name',
    type: 'radio',
  },
};

/**
 * Every state of the switch, the checkbox and the radio once the story has opened (#1440,
 * @fixture/states). A state only an interaction reaches (`play: true`) is brought there by the
 * play function, which clicks the control as a person does and checks the state, not its look.
 * A cell holds one control, or the radios of a group; a control without text is named by
 * `aria-label`, as a product names it.
 */
type SwitchProps = { text?: string } & Record<string, string | boolean>;

interface SwitchState {
  state: string;
  play?: boolean;
  fieldset?: boolean;
  switches: SwitchProps[];
}

const email = { text: 'Notifiche via e-mail', value: 'email' };
const sms = { text: 'Notifiche via SMS', value: 'sms' };
const checkbox = { type: 'checkbox', text: 'Allega la ricevuta di pagamento', value: 'ricevuta' };
const all = { type: 'checkbox', text: 'Seleziona tutti i documenti', value: 'tutti' };
const radio = { type: 'radio', text: 'Ritiro allo sportello', value: 'sportello' };
const consent =
  'Acconsento al trattamento dei dati personali, ai sensi del Regolamento UE 2016/679, per ricevere le comunicazioni sullo stato della pratica e sulle scadenze dei pagamenti';
const plans = [
  { type: 'radio', text: 'Piano base', value: 'base' },
  { type: 'radio', text: 'Piano professionale', value: 'pro' },
  { type: 'radio', text: 'Piano ente pubblico', value: 'ente' },
];

const switchStates: SwitchState[] = [
  { state: 'switch', switches: [email] },
  { state: 'switch, checked', switches: [{ ...email, checked: true }] },
  { state: 'switch, explicit', switches: [{ ...email, explicit: true }] },
  { state: 'switch, explicit, checked', switches: [{ ...email, explicit: true, checked: true }] },
  { state: 'switch, size sm', switches: [{ ...email, size: 'sm', checked: true }] },
  { state: 'switch, size md', switches: [{ ...email, size: 'md', checked: true }] },
  { state: 'switch, size lg', switches: [{ ...email, size: 'lg', checked: true }] },
  { state: 'switch, disabled', switches: [{ ...sms, disabled: true }] },
  { state: 'switch, disabled, checked', switches: [{ ...sms, disabled: true, checked: true }] },
  {
    state: 'switch, explicit, disabled',
    switches: [{ ...sms, explicit: true, disabled: true }],
  },
  {
    state: 'switch, explicit, disabled, checked',
    switches: [{ ...sms, explicit: true, disabled: true, checked: true }],
  },
  { state: 'switch, disabled by its fieldset', fieldset: true, switches: [{ ...sms }] },
  {
    state: 'switch, without text',
    switches: [{ 'aria-label': 'Notifiche via e-mail', value: 'email', checked: true }],
  },
  { state: 'switch, long text', switches: [{ text: consent, value: 'consenso' }] },
  { state: 'switch, turned on', play: true, switches: [email] },
  { state: 'checkbox', switches: [checkbox] },
  { state: 'checkbox, checked', switches: [{ ...checkbox, checked: true }] },
  { state: 'checkbox, indeterminate', switches: [{ ...all, indeterminate: true }] },
  {
    state: 'checkbox, indeterminate, checked',
    switches: [{ ...all, indeterminate: true, checked: true }],
  },
  {
    state: 'checkbox, custom icon',
    switches: [
      {
        type: 'checkbox',
        text: 'Segna come pratica preferita',
        value: 'preferita',
        icon: 'mi/baseline/favorite',
        checked: true,
      },
    ],
  },
  { state: 'checkbox, disabled', switches: [{ ...checkbox, disabled: true }] },
  {
    state: 'checkbox, disabled, checked',
    switches: [{ ...checkbox, disabled: true, checked: true }],
  },
  {
    state: 'checkbox, disabled, indeterminate, checked',
    switches: [{ ...all, disabled: true, indeterminate: true, checked: true }],
  },
  { state: 'checkbox, disabled by its fieldset', fieldset: true, switches: [{ ...checkbox }] },
  {
    state: 'checkbox, long text',
    switches: [{ type: 'checkbox', text: consent, value: 'consenso' }],
  },
  {
    state: 'checkbox, indeterminate, clicked',
    play: true,
    switches: [{ ...all, indeterminate: true }],
  },
  { state: 'radio', switches: [radio] },
  { state: 'radio, checked', switches: [{ ...radio, checked: true }] },
  { state: 'radio, disabled', switches: [{ ...radio, disabled: true }] },
  { state: 'radio, disabled, checked', switches: [{ ...radio, disabled: true, checked: true }] },
  { state: 'radio, disabled by its fieldset', fieldset: true, switches: [{ ...radio }] },
  { state: 'radio group', switches: [{ ...plans[0], checked: true }, plans[1], plans[2]] },
  {
    state: 'radio group, another chosen',
    play: true,
    switches: [{ ...plans[0], checked: true }, plans[1], plans[2]],
  },
  {
    state: 'typography caption',
    switches: [{ ...email, typography: 'caption', checked: true }],
  },
  {
    state: 'typography paragraph, variant read',
    switches: [{ ...email, typography: 'paragraph', variant: 'read', checked: true }],
  },
];

const TemplateStates = () => (
  <StatesGrid>
    {switchStates.map(({ state, play, fieldset, switches }) => {
      // the controls of a cell are a group of their own: the name of the cell
      const controls = switches.map(({ text, ...props }) => (
        <mds-input-switch key={String(props.value)} name={state} {...props}>
          {text}
        </mds-input-switch>
      ));
      return (
        <StateCell key={state} state={state} play={play}>
          {fieldset ? (
            <fieldset disabled class="grid gap-400 border-0 m-0 min-w-0 p-0">
              {controls}
            </fieldset>
          ) : (
            <div class="grid gap-400">{controls}</div>
          )}
        </StateCell>
      );
    })}
  </StatesGrid>
);

/** Clicks the control of a switch as a person does, once every Magma element of its cell has loaded. */
const clickSwitch = async (element: HTMLMdsInputSwitchElement): Promise<void> => {
  const cell = element.closest('[data-state]') as HTMLElement;
  const elements = Array.from(cell.querySelectorAll('*')).filter((child) =>
    child.tagName.startsWith('MDS-'),
  );
  await waitFor(() => elements.forEach((child) => expect(child).toHaveAttribute('hydrated')));
  // click() runs the activation of the native control, the change included, with or without
  // the focus of the document
  (element.shadowRoot!.querySelector('input.field') as HTMLInputElement).click();
};

const playStates = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const switches = (state: string) =>
    Array.from(
      stateCell(canvasElement, state).querySelectorAll('mds-input-switch'),
    ) as HTMLMdsInputSwitchElement[];
  const [turnedOn] = switches('switch, turned on');
  const [clicked] = switches('checkbox, indeterminate, clicked');
  const [base, pro] = switches('radio group, another chosen');
  await clickSwitch(turnedOn);
  await clickSwitch(clicked);
  await clickSwitch(pro);
  // the property, not the attribute: Stencil reflects it on the next frame, and a hidden page
  // draws no frame
  await waitFor(() => expect(turnedOn).toHaveProperty('checked', true));
  await waitFor(() => expect(clicked).toHaveProperty('checked', true));
  await waitFor(() => expect(clicked).not.toHaveProperty('indeterminate', true));
  await waitFor(() => expect(pro).toHaveProperty('checked', true));
  await waitFor(() => expect(base).not.toHaveProperty('checked', true));
};

export const States = {
  render: TemplateStates,

  play: playStates,
};
