import { themeInputVariantDictionary } from '@type/variant';
import { validationModelDictionary } from '@component/mds-input/meta/dictionary';
import { h } from '@stencil/core';
import { inDarkMode } from '@fixture/dark-mode';
import { StateCell, StatesGrid, leaveInput, stateCell } from '@fixture/states';
import { expect, waitFor } from 'storybook/test';

interface MdsInputFieldInterface {
  label?: string;
  message?: string;
}

export default {
  title: 'UI / Forms / Input Field',
  id: 'form-input-field',
  argTypes: {
    label: {
      type: { name: 'string' },
      description: 'Display a text on the top of the input text field',
    },
    message: {
      type: { name: 'string' },
      description: 'Display a message at the bottom of the input text field',
    },
    pattern: {
      type: { name: 'string' },
      description: "Specifies a regular expression that element's value is checked against",
    },
    variant: {
      type: { name: 'string' },
      options: themeInputVariantDictionary,
      control: { type: 'select' },
      description: 'Sets the variant of the input field',
    },
    validate: {
      type: { name: 'string' },
      description: 'Specifies the type of model data to be automatically validated',
      options: validationModelDictionary,
      control: { type: 'select' },
    },
  },
};

const Template = (args) => (
  <mds-input-field {...args}>
    <mds-input name="fullName" placeholder="Es: Mario Rossi"></mds-input>
  </mds-input-field>
);

export const Default = {
  render: Template,

  args: {
    label: 'Nome e cognome',
  },
};

export const Message = {
  render: Template,

  args: {
    label: 'Questo è un label',
    message: 'Senza validazione il messaggio non dovrebbe cambiare o scomparire',
  },
};

export const Variant = {
  render: Template,

  args: {
    label: 'Questo è un label',
    variant: 'error',
    message: 'This is a field with a message',
  },
};

const FormIntegrationTemplate = (args: MdsInputFieldInterface) => (
  <div class="grid gap-600">
    <form class="grid gap-400" id="mds-icon-fi" name="mds-icon-fi">
      <mds-input-field {...args}>
        <mds-input name="fullName" placeholder="Es: Mario Rossi" autofocus></mds-input>
      </mds-input-field>
      <div class="flex flex-wrap gap-400 items-baseline">
        <mds-button
          class="shrink-0 max-mobile:grow"
          type="button"
          onClick={() => {
            const formEl = document.querySelector('form') as HTMLFormElement;
            const spanEl = document.querySelector('span.input-value') as HTMLSpanElement;
            const inputEl = document.querySelector('mds-input') as HTMLMdsInputElement;
            if (formEl.fullName.value === '') {
              inputEl.setFocus();
              spanEl.classList.remove('scale-110');
              spanEl.innerText = 'empty';
              return;
            }
            spanEl.innerText = formEl.fullName.value;
            spanEl.classList.add('scale-110');
            formEl.addEventListener('submit', (e: SubmitEvent) => {
              e.preventDefault();
              console.info('Submitted', e);
            });
          }}
        >
          Check value
        </mds-button>
        <mds-text variant="code">
          Input value taken from form element{' '}
          <span class="input-value inline-flex rounded text-tone-neutral-04 bg-tone-neutral-08 px-200 transition-transform duration-200">
            empty
          </span>
        </mds-text>
      </div>
    </form>
  </div>
);

export const FormIntegration = {
  render: FormIntegrationTemplate,

  args: {
    label: 'full name',
  },
};

const TemplateValidation = () => (
  <div class="grid gap-600">
    <mds-text typography="h6">Validation NOT required</mds-text>
    <mds-input-field label="inserisci il tuo codice fiscale">
      <mds-input name="fullName" type="cf" placeholder="Es: MRCRSS83B21D704L"></mds-input>
    </mds-input-field>
    <mds-hr></mds-hr>
    <mds-text typography="h6">Validation REQUIRED</mds-text>
    <mds-input-field label="inserisci il tuo codice fiscale">
      <mds-input name="fullName" type="cf" placeholder="Es: MRCRSS83B21D704L" required></mds-input>
    </mds-input-field>
  </div>
);

export const Validation = {
  render: TemplateValidation,
};

const TemplateNestedButton = (args) => (
  <mds-input-field {...args}>
    <mds-input name="fullName" type={args.type} placeholder={args.placeholder}></mds-input>
    <mds-button icon="mi/baseline/chevron-right" size="lg"></mds-button>
  </mds-input-field>
);

export const NestedButton = {
  render: TemplateNestedButton,

  args: {
    label: 'inserisci il tuo codice fiscale',
    placeholder: 'Es: MRCRSS83B21D704L',
    type: 'cf',
  },
};

/**
 * Colour fields (#1260) with their label and message: one holding a colour, one whose text names
 * no colour, which shows the message of mds-input once the field is left.
 */
const TemplateColor = () => (
  <div class="@container">
    <form class="grid items-start gap-400 @md:grid-cols-2">
      <mds-input-field label="Colore di base">
        <mds-input type="color" name="base" value="#2f6fd0" placeholder="#rrggbb"></mds-input>
      </mds-input-field>
      <mds-input-field label="Colore del bordo">
        <mds-input type="color" name="border" value="blu" placeholder="#rrggbb"></mds-input>
      </mds-input-field>
    </form>
  </div>
);

const playColor = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const [, wrong] = Array.from(canvasElement.querySelectorAll('mds-input-field'));
  const field = wrong.querySelector('mds-input') as HTMLMdsInputElement;
  await waitFor(() => expect(field).toHaveAttribute('hydrated'));
  const input = field.shadowRoot!.querySelector('input.input') as HTMLInputElement;
  input.focus();
  input.blur();
  await waitFor(() =>
    expect(wrong).toHaveProperty('message', 'Enter a hex colour code, such as #2f6fd0'),
  );
  const action = field.shadowRoot!.querySelector('.color-picker-button') as HTMLElement;
  await expect(action).toHaveAttribute('title', 'Choose a colour for Colore del bordo');
};

export const Color = {
  render: TemplateColor,

  play: playColor,
};

export const ColorDark = {
  render: TemplateColor,

  beforeEach: inDarkMode,

  play: playColor,
};

/**
 * Every state of the field once the story has opened (#1440, @fixture/states). A state only an
 * interaction reaches (`left: true`) is brought there by the play function, which leaves the
 * field as a person does and checks the state was reached, not how it looks.
 */
interface FieldState {
  state: string;
  left?: boolean;
  field: Record<string, string>;
  input?: Record<string, string | boolean>;
  button?: boolean;
}

const fieldStates: FieldState[] = [
  { state: 'rest', field: { label: 'Nome e cognome' }, input: { placeholder: 'Es: Mario Rossi' } },
  { state: 'value', field: { label: 'Nome e cognome' }, input: { value: 'Mario Rossi' } },
  {
    state: 'hint',
    field: { label: 'Codice fiscale', message: 'Sedici caratteri, lettere e numeri' },
    input: { placeholder: 'Es: MRCRSS83B21D704L' },
  },
  {
    state: 'required',
    field: { label: 'Email' },
    input: { type: 'email', required: true, placeholder: 'nome@dominio.it' },
  },
  {
    state: 'required, left empty',
    left: true,
    field: { label: 'Email' },
    input: { type: 'email', required: true, placeholder: 'nome@dominio.it' },
  },
  {
    state: 'invalid, left',
    left: true,
    field: { label: 'Email' },
    input: { type: 'email', value: 'mario.rossi@' },
  },
  {
    state: 'valid, left',
    left: true,
    field: { label: 'Email' },
    input: { type: 'email', value: 'mario.rossi@comune.it' },
  },
  {
    state: 'optional, left empty',
    left: true,
    field: { label: 'Email' },
    input: { type: 'email', placeholder: 'nome@dominio.it' },
  },
  {
    state: 'hint with validators, left',
    left: true,
    field: { label: 'Email', message: 'La useremo solo per le notifiche della pratica' },
    input: { type: 'email', value: 'mario.rossi@comune.it' },
  },
  {
    state: 'variant error',
    field: { label: 'Email', variant: 'error', message: 'Questo indirizzo è già registrato' },
    input: { type: 'email', value: 'mario.rossi@comune.it' },
  },
  {
    state: 'variant warning',
    field: {
      label: 'Email',
      variant: 'warning',
      message: 'Un indirizzo personale: le notifiche potrebbero finire nello spam',
    },
    input: { type: 'email', value: 'mario.rossi@gmail.com' },
  },
  {
    state: 'variant success',
    field: { label: 'Email', variant: 'success', message: 'Indirizzo verificato' },
    input: { type: 'email', value: 'mario.rossi@comune.it' },
  },
  {
    state: 'variant info',
    field: {
      label: 'Email',
      variant: 'info',
      message: 'Useremo questo indirizzo solo per le notifiche della pratica',
    },
    input: { type: 'email', placeholder: 'nome@dominio.it' },
  },
  {
    state: 'variant ai',
    field: { label: 'Oggetto', variant: 'ai', message: "Proposto dall'assistente: controllalo" },
    input: { value: 'Richiesta di accesso agli atti' },
  },
  {
    state: 'readonly',
    field: { label: 'Codice fiscale' },
    input: { value: 'MRCRSS83B21D704L', readonly: true },
  },
  {
    state: 'disabled',
    field: { label: 'Codice fiscale' },
    input: { value: 'MRCRSS83B21D704L', disabled: true },
  },
  {
    state: 'with a button',
    field: { label: 'Codice fiscale' },
    input: { placeholder: 'Es: MRCRSS83B21D704L' },
    button: true,
  },
  {
    state: 'long label and message',
    field: {
      label:
        'Indirizzo di posta elettronica certificata del legale rappresentante della società richiedente',
      message:
        'Se la società non ha un indirizzo di posta certificata, indica quello del professionista che presenta la domanda per suo conto',
    },
    input: { type: 'email', placeholder: 'nome@pec.it' },
  },
];

const TemplateStates = () => (
  <StatesGrid>
    {fieldStates.map(({ state, left, field, input, button }) => (
      <StateCell key={state} state={state} play={left}>
        <mds-input-field {...field}>
          <mds-input name={state} {...input}></mds-input>
          {button && <mds-button icon="mi/baseline/chevron-right" size="lg"></mds-button>}
        </mds-input-field>
      </StateCell>
    ))}
  </StatesGrid>
);

const playStates = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const field = (state: string) => stateCell(canvasElement, state).querySelector('mds-input-field');
  for (const { state } of fieldStates.filter(({ left }) => left)) {
    await leaveInput(stateCell(canvasElement, state));
  }
  // the property, not the attribute: Stencil reflects it on the next frame, and a hidden page
  // draws no frame
  await waitFor(() => expect(field('required, left empty')).toHaveProperty('variant', 'error'));
  await waitFor(() => expect(field('invalid, left')).toHaveProperty('variant', 'error'));
  await waitFor(() => expect(field('valid, left')).toHaveProperty('variant', 'success'));
};

export const States = {
  render: TemplateStates,

  play: playStates,
};
