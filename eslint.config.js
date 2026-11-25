const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const globals = require('globals');

module.exports = tseslint.config(
  { ignores: ['node_modules', 'static/**', 'coverage', '.forge'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  {
    // jest.mock factories are hoisted above imports and must use require().
    files: ['tests/**/*.ts'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['*.js', 'scripts/**/*.js'],
    languageOptions: { globals: { ...globals.node }, sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
