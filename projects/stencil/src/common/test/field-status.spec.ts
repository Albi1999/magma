import { fieldStatusIcon } from '@common/field-status';
import { themeStatusVariantDictionary } from '@type/variant';

// the status of a field shows as an icon inside its frame, the edge neutral (#1466)
describe('fieldStatusIcon', () => {
  it('gives each status an icon of its own', () => {
    const icons = themeStatusVariantDictionary.map((status) => fieldStatusIcon(status));

    expect(icons.every((icon) => typeof icon === 'string' && icon.length > 0)).toBe(true);
    expect(new Set(icons).size).toBe(themeStatusVariantDictionary.length);
  });

  it.each([undefined, 'primary', 'ai', 'constructor', 'toString'])(
    'gives no icon to a variant that is no status: %s',
    (variant) => {
      expect(fieldStatusIcon(variant)).toBeUndefined();
    },
  );
});
