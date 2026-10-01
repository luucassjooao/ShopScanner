import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { ecmaVersion: 2023, globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Dinheiro é texto decimal: converter para número é bug, não estilo.
      'no-restricted-globals': [
        'error',
        { name: 'parseFloat', message: 'Dinheiro é texto decimal. Não converta para float.' },
      ],
    },
  },
  prettier,
);
