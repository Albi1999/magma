import { h } from '@stencil/core';

import { MdsInputOtpInterface } from '../mds-input-otp';
import { useState } from 'react';
import { expect, waitFor } from 'storybook/test';
import { StateCell, StatesGrid, stateCell } from '@fixture/states';

export default {
  title: 'UI / Forms / OTP',
  id: 'form-otp',
  argTypes: {
    length: {
      type: { name: 'number' },
      description: 'Number of digits in the OTP code',
    },
    autosubmit: {
      type: { name: 'boolean' },
      description: 'Automatically submits the form when the OTP code is complete',
    },
    disabled: {
      type: { name: 'boolean' },
      description: 'Disables every cell: the code cannot be changed and is left out of the form',
    },
  },
};

const Template = (args: MdsInputOtpInterface) => <mds-input-otp {...args}></mds-input-otp>;

export const Default = {
  render: Template,
};

const FormIntegrationTemplate = (args: MdsInputOtpInterface) => {
  return (
    <div class="grid gap-600">
      <form
        class="grid gap-400"
        id="mds-icon-fi"
        name="mds-icon-fi"
        onSubmit={(e: SubmitEvent) => {
          e.preventDefault();
          console.info('Submitted', e);
          const form = document.querySelector('form') as HTMLFormElement;
          const span = document.querySelector('span.input-value') as HTMLSpanElement;
          span.innerText =
            form['mds-input-otp'].value !== '' ? form['mds-input-otp'].value : 'Empty';
        }}
      >
        <mds-input-otp {...args}></mds-input-otp>
        <mds-button
          class="w-min"
          type="submit"
          onClick={(e: MouseEvent) => {
            e.preventDefault();
          }}
          disabled={args.autosubmit}
        >
          {args.autosubmit ? 'autosubmit enabled' : 'Submit'}
        </mds-button>
        <mds-text variant="code">
          Input value taken from form element:{' '}
          <span class="inline-flex input-value rounded text-tone-neutral-01 bg-tone-neutral-08 px-200 py-50">
            Empty
          </span>
        </mds-text>
      </form>
    </div>
  );
};

const FormAutoSubmitTemplate = (args: MdsInputOtpInterface) => {
  const [isDisabled, setDisabled] = useState(true);
  const [isAwaiting, setAwait] = useState(false);
  const [isSubmitted, setSubmitted] = useState(false);
  const [buttonLabel, setLabel] = useState('Submit OTP');
  return (
    <div class="grid gap-600">
      <form
        class="grid gap-600 max-w-[370px]"
        id="mds-icon-fi"
        name="mds-icon-fi"
        onSubmit={(e: SubmitEvent) => {
          e.preventDefault();
          setAwait(true);
          setLabel('Submitting...');
          setDisabled(false);
          setTimeout(() => {
            setSubmitted(true);
            setAwait(false);
            setLabel('Submitted successfully');
          }, 2000);
          const form = document.querySelector('form') as HTMLFormElement;
          const span = document.querySelector('span.input-value') as HTMLSpanElement;
          span.innerText =
            form['mds-input-otp'].value !== '' ? form['mds-input-otp'].value : 'Empty';
        }}
      >
        <mds-input-otp {...args} class="justify-center"></mds-input-otp>
        <mds-button
          disabled={isDisabled === true ? true : undefined}
          icon={isSubmitted ? 'mi/baseline/done' : ''}
          variant={isSubmitted ? 'success' : 'primary'}
          await={isAwaiting}
          size="lg"
          type="submit"
          onClick={(e: MouseEvent) => {
            e.preventDefault();
          }}
        >
          {buttonLabel}
        </mds-button>
        <mds-text variant="code">
          Input value taken from form element:{' '}
          <span class="inline-flex input-value rounded text-tone-neutral-01 bg-tone-neutral-08 px-200 py-50">
            Empty
          </span>
        </mds-text>
      </form>
    </div>
  );
};

export const FormIntegration = {
  render: FormIntegrationTemplate,

  args: {
    name: 'mds-input-otp',
    autosubmit: false,
  },
  // the args set to false reach the elements through the spread, as the controls do
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('mds-input-otp')).not.toHaveAttribute('autosubmit');
    expect(canvasElement.querySelector('mds-button')).not.toBeDisabled();
  },
};

export const AutoSubmit = {
  render: FormAutoSubmitTemplate,

  args: {
    name: 'mds-input-otp',
    autosubmit: true,
  },
};

/**
 * Every state of the code once the story has opened (#1440, @fixture/states). The code is
 * named by `aria-label`, as a product names it; a state only an interaction reaches
 * (`play: true`) is brought there by the play function, which types, pastes and deletes as a
 * person does and checks the value, not its look.
 */
interface OtpState {
  state: string;
  play?: boolean;
  fieldset?: boolean;
  otp: Record<string, string | number | boolean>;
}

const code = { 'aria-label': 'Codice di verifica', name: 'codice' };

const otpStates: OtpState[] = [
  { state: 'empty', otp: code },
  { state: 'in progress', otp: { ...code, value: '482' } },
  { state: 'complete', otp: { ...code, value: '482913' } },
  {
    state: 'length 4',
    otp: { 'aria-label': 'PIN della carta', name: 'pin', length: 4, value: '4829' },
  },
  { state: 'disabled', otp: { ...code, disabled: true } },
  { state: 'disabled, complete', otp: { ...code, disabled: true, value: '482913' } },
  { state: 'disabled by its fieldset', fieldset: true, otp: { ...code, value: '482913' } },
  { state: 'typed, in progress', play: true, otp: code },
  { state: 'pasted', play: true, otp: code },
  { state: 'a digit deleted', play: true, otp: { ...code, value: '482913' } },
  // last: eight cells are wider than a column and overflow it, here into the end of the row
  { state: 'length 8', otp: { ...code, length: 8, value: '48291375' } },
];

const TemplateStates = () => (
  <StatesGrid>
    {otpStates.map(({ state, play, fieldset, otp }) => (
      <StateCell key={state} state={state} play={play}>
        {fieldset ? (
          <fieldset disabled class="border-0 m-0 min-w-0 p-0">
            <mds-input-otp {...otp}></mds-input-otp>
          </fieldset>
        ) : (
          <mds-input-otp {...otp}></mds-input-otp>
        )}
      </StateCell>
    ))}
  </StatesGrid>
);

/**
 * The native inputs of the cells of a code, once every Magma element of its cell has loaded. The
 * keys and the paste are sent as events from there, as a person's reach the code.
 */
const digitInputs = async (otp: HTMLMdsInputOtpElement): Promise<HTMLInputElement[]> => {
  const cells = () => Array.from(otp.shadowRoot!.querySelectorAll('mds-input'));
  await waitFor(() => {
    expect(otp).toHaveAttribute('hydrated');
    expect(cells().length).toBeGreaterThan(0);
    cells().forEach((cell) => expect(cell).toHaveAttribute('hydrated'));
  });
  return cells().map((cell) => cell.shadowRoot!.querySelector('input.input') as HTMLInputElement);
};

const pressKey = (input: HTMLInputElement, key: string): void => {
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
};

const playStates = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const otp = (state: string) =>
    stateCell(canvasElement, state).querySelector('mds-input-otp') as HTMLMdsInputOtpElement;

  // three digits, each in its cell
  const typed = await digitInputs(otp('typed, in progress'));
  ['4', '8', '2'].forEach((digit, index) => pressKey(typed[index], digit));

  // a code copied from a message, with the spaces around it
  const [first] = await digitInputs(otp('pasted'));
  const clipboardData = new DataTransfer();
  clipboardData.setData('text', ' 482913 ');
  first.dispatchEvent(
    new ClipboardEvent('paste', { clipboardData, bubbles: true, composed: true }),
  );

  // Delete on the third cell of a complete code
  const deleted = await digitInputs(otp('a digit deleted'));
  pressKey(deleted[2], 'Delete');

  // the property, not the attribute: Stencil reflects it on the next frame, and a hidden page
  // draws no frame
  await waitFor(() => expect(otp('typed, in progress')).toHaveProperty('value', '482'));
  await waitFor(() => expect(otp('pasted')).toHaveProperty('value', '482913'));
  // the empty cell adds nothing to the value
  await waitFor(() => expect(otp('a digit deleted')).toHaveProperty('value', '48913'));
};

export const States = {
  render: TemplateStates,

  play: playStates,
};
