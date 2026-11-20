import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { MagmaConfig } from '@maggioli-design-system/design-tokens/src/lib/color.mjs';
import { semantic } from '@maggioli-design-system/design-tokens/semantic.config';
import { COLOR_MODES } from '@maggioli-design-system/design-tokens/src/lib/theme-manifest.mjs';
import { applyFrame, type Scheme } from './frame.js';
import { useT } from './i18n.js';
import { Field, Range, Select } from './magma.js';
import { alphasOf, measurePage, rolesMarkup, ROLES, type RoleId } from './roles.js';
import { sceneStyle } from './scene-css.js';
import { settled } from './states.js';
import { useThemeChoices } from './theme-choices.js';
import './roles.css';

/*
  The page Band and track of the Colors section (#1472): a preview per transparent role, the band
  and the track, each the real components of its category on the page, a card, a well and a
  coloured fill, light and dark side by side (roles.html, one frame per mode), with the distance
  and the ratio of the role to its ground under each (roles.ts). It paints the theme the person
  chooses, in the configuration they edit (scene-css.ts), and the wash intensity they set: the
  intensity multiplies every alpha, and the measures follow it at once.

  The intensity here is the one --magma-wash-intensity holds; how the studio tunes the roles by
  category, and the bounds of a relative intensity the gate allows, come with the next part
  (#1472, "After this part").
*/

const ROLE_IDS: RoleId[] = ['band', 'track'];

/** The theme of a page with no configuration yet: the base one, the first of the layer. */
const BASE_THEME = Object.keys(semantic.themes)[0];

/** The bounds of the intensity: off, the default, twice the default. */
const INTENSITY = { min: 0, max: 2, step: 0.05 };

/** One mode of a role: the page of the role in a frame, as tall as what it shows. */
function RoleFrame({
  role,
  scheme,
  theme,
  modes,
  css,
  intensity,
}: {
  role: RoleId;
  scheme: Scheme;
  theme: string;
  modes: readonly Scheme[];
  css?: string;
  intensity: number;
}) {
  const t = useT();
  const frame = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(0);
  const [height, setHeight] = useState<number>();
  const markup = rolesMarkup(role, t);

  useEffect(() => {
    const page = frame.current?.contentDocument;
    const main = page?.getElementById('roles');
    if (!page || !main) return;
    applyFrame(page, { theme, scheme, contrast: false, css, modes });
    // the intensity on <html>: every element under it computes its band and track again
    page.documentElement.style.setProperty('--magma-wash-intensity', String(intensity));
    if (main.dataset.markup !== markup) {
      main.innerHTML = markup;
      main.dataset.markup = markup;
    }
    const view = page.defaultView;
    const measure = () => {
      measurePage(page, role, t);
      setHeight(
        Math.ceil(
          main.getBoundingClientRect().bottom +
            (view?.scrollY ?? 0) +
            parseFloat(view?.getComputedStyle(page.body).marginBlockEnd ?? '0'),
        ),
      );
    };
    let live = true;
    // the computed colours need no paint: measured as soon as the components are ready, with no
    // animation frame, which a frame out of view or a hidden pane never runs
    void settled(page).then(() => {
      if (live) measure();
    });
    view?.addEventListener('resize', measure);
    return () => {
      live = false;
      view?.removeEventListener('resize', measure);
    };
  }, [role, scheme, theme, modes, css, intensity, markup, loaded]);

  return (
    <iframe
      ref={frame}
      class="roles-frame"
      src="roles.html"
      data-scheme={scheme}
      title={t(
        scheme === 'light'
          ? '{role} on its grounds, light mode'
          : '{role} on its grounds, dark mode',
        {
          role: t(ROLES[role].title),
        },
      )}
      style={height ? { blockSize: `${height}px` } : undefined}
      onLoad={() => setLoaded((count) => count + 1)}
    />
  );
}

/** The page Band and track. */
export function RolesPreview({ config }: { config: MagmaConfig }) {
  const t = useT();
  const choices = useThemeChoices();
  const scene = useMemo(() => sceneStyle(config, choices), [config, choices]);
  const themes = scene?.themes ?? [];
  const [role, setRole] = useState<RoleId>('band');
  const [chosen, setTheme] = useState('');
  const [intensity, setIntensity] = useState(semantic.transparent.intensity);
  const theme = themes.find((one) => one.name === chosen) ?? themes[0];
  // a theme of one mode is seen in that mode only (#1274)
  const modes: readonly Scheme[] = theme?.modes ?? COLOR_MODES;
  const alphas = alphasOf(role);
  const percent = (value: number) => `${Number(value.toFixed(2))}%`;

  return (
    <div class="roles">
      <mds-text typography="detail" tag="p" class="studio-muted">
        {t(
          'A preview per transparent role: the components of its category on the page, a card, a well and a coloured fill, with the distance (OKLab L x 100, negative = darker) and the ratio of the role to its ground under each.',
        )}
      </mds-text>
      <div class="roles-controls">
        <mds-tab
          aria-label={t('Role')}
          onmdsTabChange={(event: CustomEvent<{ id: number; value?: string }>) => {
            const value = event.detail?.value as RoleId | undefined;
            if (value && ROLE_IDS.includes(value)) setRole(value);
          }}
        >
          {ROLE_IDS.map((id) => (
            <mds-tab-item
              type="button"
              label={t(ROLES[id].title)}
              value={id}
              selected={id === role}
            ></mds-tab-item>
          ))}
        </mds-tab>
        {themes.length > 1 && (
          <Field label={t('Theme')} short>
            <Select
              value={theme?.name ?? ''}
              onValue={setTheme}
              options={themes.map((one) => ({ value: one.name, label: one.name }))}
            />
          </Field>
        )}
        <div class="roles-intensity">
          <mds-text typography="caption" tag="p">
            {t('Wash intensity: {value}', { value: intensity.toFixed(2) })}
          </mds-text>
          <Range
            value={intensity}
            onValue={setIntensity}
            min={INTENSITY.min}
            max={INTENSITY.max}
            step={INTENSITY.step}
            label={t('Wash intensity')}
          />
        </div>
      </div>
      <mds-text typography="detail" tag="p" class="roles-about" data-role={role}>
        {t(ROLES[role].about, {
          alpha: percent(alphas.light),
          dark: percent(alphas.dark),
          selected: percent(alphas.selected ?? 0),
        })}
      </mds-text>
      <div class="roles-frames">
        {modes.map((scheme) => (
          <RoleFrame
            key={scheme}
            role={role}
            scheme={scheme}
            theme={theme?.name ?? BASE_THEME}
            modes={modes}
            css={scene?.css}
            intensity={intensity}
          />
        ))}
      </div>
    </div>
  );
}
