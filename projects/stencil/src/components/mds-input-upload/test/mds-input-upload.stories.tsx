import { h } from '@stencil/core';
import { expect, waitFor } from 'storybook/test';
import { StateCell, StatesGrid, stateCell } from '@fixture/states';
import { attachmentSortDictionary } from '../meta/dictionary';

export default {
  title: 'UI / Forms / Input Upload',
  id: 'form-input-upload',
  argTypes: {
    accept: {
      type: { name: 'string' },
      description: 'Defines the file types the file input should accept',
    },
    'max-file-size': {
      type: { name: 'number' },
      description: 'Specifies the max size of a single file that can be uploaded in MB',
    },
    'max-files': {
      type: { name: 'number' },
      description: 'Specifies the max number of files that can be uploaded',
    },
    sort: {
      type: { name: 'string' },
      description:
        'Specifies if the component should show a sort widget by alphabetical name or date of upload',
      options: attachmentSortDictionary,
      control: { type: 'select' },
    },
    disabled: {
      type: { name: 'boolean' },
      description:
        'Disables the component: no file can be added, dropped or removed, and the files are left out of the form',
    },
  },
};

const Template = (args) => (
  <div>
    <mds-input-upload {...args}></mds-input-upload>
  </div>
);

export const Default = {
  render: Template,

  args: {
    // icon: 'mi/baseline/email',
    accept: '',
  },
};

export const CustomAccept = {
  render: Template,

  args: {
    accept: '.pdf, image/jpeg',
    'max-file-size': 70,
  },
};

export const Multiple = {
  render: Template,

  args: {
    accept: '.pdf, image/jpeg, image/png, .svg, .heic, .webp',
    'max-file-size': 70,
    'max-files': 3,
  },
};

/**
 * Every state of the upload once the story has opened (#1440, @fixture/states). The files are
 * `File` objects built here, given to the component through `initialValue` as a product gives
 * the files a record already has; a state only an interaction reaches (`play: true`) is brought
 * there by the play function, which checks the state, not its look.
 */
interface UploadState {
  state: string;
  play?: boolean;
  upload: Record<string, string | number | boolean>;
  files?: () => File[];
  // the upload in a disabled fieldset, which disables it as a native control
  fieldset?: boolean;
}

const KB = 1024;
const MB = 1024 * KB;

/** A file of a size, its bytes all zero: the component reads its name, type and size. */
const file = (name: string, type: string, size: number): File =>
  new File([new Uint8Array(size)], name, { type });

const pdf = (name: string, size: number): File => file(name, 'application/pdf', size);

/** A floor plan drawn on a canvas: a real PNG, which the preview shows as an image. */
const floorPlan = (name: string): File => {
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 240;
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  context.fillStyle = '#f4f1ea';
  context.fillRect(0, 0, 240, 240);
  context.strokeStyle = '#34495e';
  context.lineWidth = 6;
  context.strokeRect(24, 24, 192, 192);
  context.beginPath();
  context.moveTo(120, 24);
  context.lineTo(120, 136);
  context.moveTo(24, 136);
  context.lineTo(96, 136);
  context.moveTo(144, 136);
  context.lineTo(216, 136);
  context.stroke();
  const bytes = Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]), (char) =>
    char.charCodeAt(0),
  );
  return new File([bytes], name, { type: 'image/png' });
};

// the files of each state, built once: a new list would add the files again
const filesOf = new Map<string, File[]>();
const cachedFiles = (state: string, files: () => File[]): File[] => {
  if (!filesOf.has(state)) filesOf.set(state, files());
  return filesOf.get(state) as File[];
};

const documents = { accept: '.pdf, image/*', 'max-files': 5, name: 'allegati' };

const uploadStates: UploadState[] = [
  { state: 'empty', upload: { name: 'allegato' } },
  {
    state: 'empty, types and size',
    upload: { accept: '.pdf, image/jpeg, image/png', 'max-file-size': 10, 'max-files': 3 },
  },
  {
    state: 'one file',
    upload: { accept: '.pdf', name: 'domanda' },
    files: () => [pdf('domanda-di-contributo.pdf', 240 * KB)],
  },
  {
    state: 'several files',
    upload: documents,
    files: () => [
      floorPlan('planimetria-piano-terra.png'),
      pdf('relazione-tecnica.pdf', 1.2 * MB),
      pdf('documento-di-identita.pdf', 380 * KB),
    ],
  },
  {
    state: 'maximum reached',
    upload: { accept: '.pdf', 'max-files': 2, name: 'allegati' },
    files: () => [pdf('preventivo.pdf', 180 * KB), pdf('fattura.pdf', 95 * KB)],
  },
  {
    state: 'over the maximum',
    upload: { accept: '.pdf', 'max-files': 2, name: 'allegati' },
    files: () => [
      pdf('preventivo.pdf', 180 * KB),
      pdf('fattura.pdf', 95 * KB),
      pdf('ricevuta-di-pagamento.pdf', 60 * KB),
    ],
  },
  {
    state: 'file too large',
    upload: { accept: '.pdf', 'max-file-size': 2, name: 'atto' },
    files: () => [pdf('scansione-atto-notarile.pdf', 3 * MB)],
  },
  {
    state: 'type not accepted',
    upload: { accept: '.pdf', name: 'incarico' },
    files: () => [
      file(
        'lettera-di-incarico.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        48 * KB,
      ),
    ],
  },
  {
    state: 'sort tabs',
    upload: { ...documents, sort: 'status' },
    files: () => [
      pdf('relazione-tecnica.pdf', 1.2 * MB),
      file('foto-cantiere.heic', 'image/heic', 2.4 * MB),
      file('computo-metrico.xlsx', 'application/vnd.ms-excel', 64 * KB),
      floorPlan('planimetria-piano-terra.png'),
    ],
  },
  {
    state: 'long file name',
    upload: { accept: '.pdf', name: 'verbale' },
    files: () => [
      pdf('verbale-della-seduta-del-consiglio-comunale-del-12-novembre-2026.pdf', 820 * KB),
    ],
  },
  { state: 'disabled', upload: { name: 'allegato', disabled: true } },
  {
    state: 'disabled, with files',
    upload: { ...documents, disabled: true },
    files: () => [pdf('relazione-tecnica.pdf', 1.2 * MB), pdf('preventivo.pdf', 180 * KB)],
  },
  {
    state: 'in a disabled fieldset',
    upload: documents,
    files: () => [pdf('relazione-tecnica.pdf', 1.2 * MB)],
    fieldset: true,
  },
  { state: 'dragging', play: true, upload: documents },
];

const TemplateStates = () => (
  <StatesGrid>
    {uploadStates.map(({ state, play, upload, files, fieldset }) => {
      const control = (
        <mds-input-upload
          {...upload}
          ref={(element?: HTMLMdsInputUploadElement) => {
            if (element && files) element.initialValue = cachedFiles(state, files);
          }}
        ></mds-input-upload>
      );
      return (
        <StateCell key={state} state={state} play={play}>
          {fieldset ? (
            <fieldset class="m-0 min-w-0 border-0 p-0" disabled>
              {control}
            </fieldset>
          ) : (
            control
          )}
        </StateCell>
      );
    })}
  </StatesGrid>
);

const playStates = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const cell = stateCell(canvasElement, 'dragging');
  const upload = cell.querySelector('mds-input-upload') as HTMLMdsInputUploadElement;
  await waitFor(() => expect(upload).toHaveAttribute('hydrated'));
  // the title of the area: its text asks for a click or a drag, and while a file is dragged over
  // the area it asks to drop it
  const title = upload.shadowRoot!.querySelector('.main-action mds-text') as HTMLMdsTextElement;
  const prompt = title.text;
  upload.shadowRoot!.querySelector('.drag-area')!.dispatchEvent(
    new DragEvent('dragenter', {
      bubbles: true,
      cancelable: true,
      dataTransfer: new DataTransfer(),
    }),
  );
  // the property, not the attribute: Stencil reflects it on the next frame, and a hidden page
  // draws no frame
  await waitFor(() => expect(title).not.toHaveProperty('text', prompt));
};

export const States = {
  render: TemplateStates,

  play: playStates,
};
