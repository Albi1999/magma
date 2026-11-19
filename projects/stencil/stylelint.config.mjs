/** @type {import('stylelint').Config} */
export default {
  extends: ['../../stylelint.config.mjs'],
  ignoreFiles: ['**/dist/*.css', '**/*.js', '**/*.jsx', '**/*.svg'],
  plugins: ['./scripts/stylelint-token-values.mjs'],
  rules: {
    'import-notation': 'string',
  },
  overrides: [
    {
      // lengths and durations come from the tokens (SPEC.md, Authoring rules); the frame of the
      // fields is a component sheet that every field imports (#1466)
      files: ['src/components/**/*.css', 'src/tailwind/field-frame.css'],
      rules: {
        'magma/token-values': true,
      },
    },
  ],
}
