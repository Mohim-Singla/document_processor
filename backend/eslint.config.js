import pluginImport from 'eslint-plugin-import';
import pluginJs from '@eslint/js';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-trailing-spaces': 'error',
      'indent': ['error', 2],
      'eol-last': ['error', 'always'],
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
      'no-multiple-empty-lines': ['error', { max: 1 }],
      'object-curly-spacing': ['error', 'always'],
      'comma-dangle': ['error', {
        arrays: 'always-multiline',
        objects: 'always-multiline',
        imports: 'always-multiline',
        exports: 'always-multiline',
        functions: 'never',
      }],
      'import/first': 'error',
      'import/newline-after-import': ['error', { count: 1 }],
    },
    plugins: {
      import: pluginImport,
    },
  },
  pluginJs.configs.recommended,
];
