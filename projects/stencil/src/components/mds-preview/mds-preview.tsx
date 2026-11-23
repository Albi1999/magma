import miBaselineZoomIn from '@icon/mi/baseline/zoom-in.svg';
import miBaselineZoomOut from '@icon/mi/baseline/zoom-out.svg';
import {
  Component,
  Element,
  Event,
  EventEmitter,
  Host,
  Prop,
  State,
  Watch,
  h,
} from '@stencil/core';
import { Locale } from '@common/locale';
import { preferenceStore } from '@common/preference';
import { hasChildWithSlot } from '@common/slot';
import { PreviewDockType } from './meta/types';
import { MdsPreviewZoomEventDetail } from './meta/event-detail';
import localeEl from './meta/locale.el.json';
import localeEn from './meta/locale.en.json';
import localeEs from './meta/locale.es.json';
import localeIt from './meta/locale.it.json';

/** The width the result is drawn at when `width` gives none: the desktop breakpoint. */
const DEFAULT_WIDTH = 1024;

/**
 * The result of an editor, drawn at a width of its own and fitted to its box, so the person
 * judges it while changing the controls beside it. From the desktop breakpoint it sits in the
 * flow of the page; under it, it docks small in a corner of the window, always in view, and its
 * lens zooms it without leaving the controls.
 *
 * @category content
 * @slot - The result: an `<iframe>`, a document of its own (for a change that reaches
 * the whole page: a theme, a mode, a language), or the components of a part, written as they
 * will be
 * @slot head - The title of the result, an `mds-text typography="section"` heading; while docked
 * small it stays at the start of the head, the lens at its end. Without it, the docked result
 * has no head: the lens sits on the image
 * @slot conditions - The conditions the result is judged under, an `mds-tab size="sm"`; hidden
 * while docked small, back when zoomed
 * @part head - The row of the title, the conditions and the lens
 * @part frame - The box the result is drawn in, at its own width and scaled down to fit
 * @part lens - The button that zooms the docked result and shrinks it back
 */
@Component({
  tag: 'mds-preview',
  styleUrl: 'mds-preview.css',
  shadow: true,
})
export class MdsPreview {
  @Element() host: HTMLMdsPreviewElement;
  private lens?: HTMLMdsButtonElement;
  private t: Locale = new Locale({
    el: localeEl,
    en: localeEn,
    es: localeEs,
    it: localeIt,
  });

  /**
   * What the result shows and under which conditions ("The theme Warm on a page of a product,
   * dark mode"): it names the region, and is the `title` of an `<iframe>` in the default slot,
   * kept current as it changes
   */
  @Prop({ reflect: true }) readonly label!: string;

  /**
   * The narrowest width in px the result is drawn at: it is drawn at the width of its box or at
   * this one, whichever is wider, and scaled down to fit the box, never enlarged
   */
  @Prop() readonly width?: number = DEFAULT_WIDTH;

  /**
   * Where the result goes under the desktop breakpoint: docked small in a corner of the window,
   * over the page (`bottom-right`, `bottom-left`, as the positions of `mds-modal`), or `none`,
   * in the flow of the page at the width it is given
   */
  @Prop({ reflect: true }) readonly dock?: PreviewDockType = 'bottom-right';

  /**
   * Whether the docked result is zoomed to the width of the window, with its title and its
   * conditions; its lens flips it. It changes nothing from the desktop breakpoint up
   */
  @Prop({ reflect: true, mutable: true }) zoomed?: boolean = false;

  /** Whether the result has a title in the `head` slot: docked without one, it has no head. */
  @State() hasHead = false;

  /**
   * Emits when the person zooms the docked result or shrinks it back, with the lens or with
   * Escape; not when `zoomed` is set by code
   */
  @Event({ eventName: 'mdsPreviewZoom' }) zoomEvent: EventEmitter<MdsPreviewZoomEventDetail>;

  @Watch('label')
  handleLabelChange(): void {
    this.titleFrames();
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || this.zoomed !== true || !this.isDocked()) return;
    event.preventDefault();
    this.setZoomed(false);
    this.lens?.focus();
  };

  componentWillLoad(): void {
    this.readHead();
  }

  componentDidLoad(): void {
    this.titleFrames();
  }

  private readHead = (): void => {
    this.hasHead = hasChildWithSlot(this.host, 'head');
  };

  /** Docked is a box fixed to the window: its CSS decides it, under the desktop breakpoint. */
  private isDocked = (): boolean => {
    const box = this.host.shadowRoot?.querySelector('.box');
    return !!box && getComputedStyle(box).position === 'fixed';
  };

  /** An `<iframe>` of the result takes `label` as its title, which names the document it holds. */
  private titleFrames = (): void => {
    const slot = this.host.shadowRoot?.querySelector<HTMLSlotElement>('slot:not([name])');
    if (!slot || this.label === undefined || this.label === '') return;
    for (const element of slot.assignedElements({ flatten: true })) {
      if (element.localName === 'iframe') element.setAttribute('title', this.label);
    }
  };

  private setZoomed = (zoomed: boolean): void => {
    this.zoomed = zoomed;
    this.zoomEvent.emit({ zoomed });
  };

  private toggleZoom = (): void => {
    this.setZoomed(!this.zoomed);
  };

  private drawnWidth = (): number =>
    typeof this.width === 'number' && Number.isFinite(this.width) && this.width > 0
      ? this.width
      : DEFAULT_WIDTH;

  render() {
    return (
      <Host
        role="region"
        aria-label={this.label}
        onKeyDown={this.handleKeyDown}
        style={{ '--private-preview-width': `${this.drawnWidth()}px` }}
        pref-animation={preferenceStore.state.animation}
        pref-contrast={preferenceStore.state.contrast}
        pref-mode={preferenceStore.state.mode}
        pref-theme-scheme={preferenceStore.state['theme-scheme']}
      >
        <div class={{ box: true, 'has-head': this.hasHead }}>
          <div class="head" part="head">
            <div class="title">
              <slot name="head" onSlotchange={this.readHead}></slot>
            </div>
            <div class="conditions">
              <slot name="conditions"></slot>
            </div>
            <mds-button
              ref={(el) => (this.lens = el)}
              class="lens"
              part="lens"
              aria-label={this.t.get('zoom')}
              aria-pressed={this.zoomed ? 'true' : 'false'}
              icon={this.zoomed ? miBaselineZoomOut : miBaselineZoomIn}
              tone="text"
              variant="dark"
              onClick={this.toggleZoom}
            ></mds-button>
          </div>
          <div class="frame" part="frame">
            <div class="canvas">
              <slot onSlotchange={this.titleFrames}></slot>
            </div>
          </div>
        </div>
      </Host>
    );
  }
}
