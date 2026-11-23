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
import { TypographyHeadingTagType } from '@type/text';
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
 * @slot conditions - The conditions the result is judged under, an `mds-tab size="sm"`; hidden
 * while docked small, back when zoomed
 * @part head - The row of the headline, the conditions and the lens
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
   * The title of the result, shown in its head as a heading of the page ("Preview"). Docked small
   * it stays at the start of the head, the lens at its end; without it the docked result has no
   * head, and the lens sits on the image
   */
  @Prop() readonly headline?: string;

  /**
   * The level of the heading of `headline` in the outline of the page
   */
  @Prop() readonly tag?: TypographyHeadingTagType = 'h2';

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

  /**
   * Emits when the person zooms the docked result or shrinks it back, with the lens or with
   * Escape; not when `zoomed` is set by code
   */
  @Event({ eventName: 'mdsPreviewZoom' }) zoomEvent: EventEmitter<MdsPreviewZoomEventDetail>;

  /**
   * Whether the docked tray has reached the width of its zoom: the conditions come in only then,
   * so the head does not squeeze and wrap while the tray grows (decided on the draft, 2026-11-23).
   */
  @State() settled = false;

  /** Whether the conditions are coming in: only when the zoom has just ended, never at load. */
  @State() entering = false;

  @Watch('zoomed')
  handleZoomedChange(zoomed?: boolean): void {
    this.settled = false;
    this.entering = false;
    if (zoomed === true) this.settleWhenStill();
  }

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
    // a result that loads zoomed draws no transition: its conditions are there at once
    this.settled = this.zoomed === true;
  }

  componentDidLoad(): void {
    this.titleFrames();
  }

  /**
   * The zoom is still when the tray is not docked, or its width has no transition (reduced motion,
   * a duration of 0): no transitionend would come, so the conditions come in at once. Otherwise
   * handleTransitionEnd settles it.
   */
  private settleWhenStill = (): void => {
    const box = this.host.shadowRoot?.querySelector('.box');
    if (!box || !this.isDocked()) {
      this.settled = true;
      return;
    }
    const style = getComputedStyle(box);
    const longest = Math.max(
      ...style.transitionDuration.split(',').map((one) => parseFloat(one) || 0),
    );
    if (longest === 0) this.settled = true;
  };

  private handleTransitionEnd = (event: TransitionEvent): void => {
    if (event.target !== event.currentTarget || event.propertyName !== 'width') return;
    if (this.zoomed !== true) return;
    this.settled = true;
    this.entering = true;
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

  private hasHeadline = (): boolean => this.headline !== undefined && this.headline !== '';

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
        pref-consumption={preferenceStore.state.consumption}
        pref-contrast={preferenceStore.state.contrast}
        pref-mode={preferenceStore.state.mode}
        pref-theme-scheme={preferenceStore.state['theme-scheme']}
      >
        <div
          class={{
            box: true,
            'has-head': this.hasHeadline(),
            settled: this.settled,
            entering: this.entering,
          }}
          onTransitionEnd={this.handleTransitionEnd}
        >
          <div class="card">
            <div class="head" part="head">
              {this.hasHeadline() && (
                <div class="title">
                  <mds-text class="headline" typography="h6" tag={this.tag}>
                    {this.headline}
                  </mds-text>
                </div>
              )}
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
        </div>
      </Host>
    );
  }
}
