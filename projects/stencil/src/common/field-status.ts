import miBaselineCheckCircle from '@icon/mi/baseline/check-circle.svg';
import miBaselineError from '@icon/mi/baseline/error.svg';
import miBaselineInfo from '@icon/mi/baseline/info.svg';
import miBaselineWarning from '@icon/mi/baseline/warning.svg';
import { ThemeStatusVariantType } from '@type/variant';

/**
 * The icon of each status a field shows inside its frame at rest (#1466): the status is read from
 * its shape, not only from its colour, since the edge of the field stays neutral. The icons of
 * mds-usage (`meta/variants.ts`) for info, success and warning, and the one the guides of
 * mds-toast and mds-list name for an error.
 */
const STATUS_ICONS: Record<ThemeStatusVariantType, string> = {
  error: miBaselineError,
  info: miBaselineInfo,
  success: miBaselineCheckCircle,
  warning: miBaselineWarning,
};

/**
 * The icon of the status of a field, or `undefined` for a variant that is no status (`primary`,
 * `ai`, none): a field shows the icon only while it shows a status.
 */
export const fieldStatusIcon = (variant?: string): string | undefined =>
  variant !== undefined && Object.prototype.hasOwnProperty.call(STATUS_ICONS, variant)
    ? STATUS_ICONS[variant as ThemeStatusVariantType]
    : undefined;
