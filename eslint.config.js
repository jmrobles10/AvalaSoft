// ESLint flat config del frontend (docs/06 §1.2): typescript-eslint strict-type-checked, sin `any`,
// hooks con dependencias exhaustivas, accesibilidad y MUI importado solo desde @mui/material.
import js from '@eslint/js';
import globals from 'globals';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      // Copias de trabajo (git worktrees) de Claude Code dentro del repo: cada una se valida en su propia carpeta.
      '.claude/**',
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      'packages/api-client/src/generado/**',
      'src/**',
      'tests/**',
      'infra/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.js', '*.mjs', 'apps/web/scripts/*.mjs', 'e2e/soporte/*.mjs', 'packages/api-client/openapi/*.mjs', 'marca/*.mjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/exhaustive-deps': 'error',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@mui/system', '@mui/system/*'], message: 'Importa solo desde @mui/material.' },
            { group: ['**/mocks/**'], message: 'Los mocks solo se usan en pruebas.' },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.tsx'],
    ...jsxA11y.flatConfigs.recommended,
  },
  {
    // Biblioteca y herramientas: exportan componentes junto con sus tipos y helpers puros (o ninguno: el arnés de la marca); el HMR no aplica.
    files: ['packages/**/*.{ts,tsx}', 'marca/**/*.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // La tipografía sale del tema (escala de Sinco: títulos 16, subtítulos 14, texto 13, auxiliares 11): ni las pantallas ni los componentes fijan
    // `fontSize` ni `fontWeight` con un literal (número o texto como «12px»). Se elige la variante (`<Typography variant="body2|caption|subtitle2|h6…">`,
    // o `sx={{ typography: 'caption' }}` donde no hay un Typography). La escala vive en `packages/ui/src/tokens.ts` y se aplica en `packages/ui/src/tema.ts`.
    files: ['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.{ts,tsx}'],
    ignores: [
      'packages/ui/src/tema.ts',
      'packages/ui/src/tokens.ts',
      '**/*.test.{ts,tsx}',
      '**/pruebas/**',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...['fontSize', 'fontWeight'].flatMap((nombre) => {
          const clave = `:matches([key.name='${nombre}'], [key.value='${nombre}'])`;
          // `fontSize` admite palabras sin dígitos (`inherit`); `fontWeight`, ningún literal (tampoco `bold`).
          const literal = nombre === 'fontSize' ? 'Literal[raw=/\\d/]' : 'Literal';
          const mensaje = `Tipografía fuera del tema: no fijes ${nombre} con un literal. Usa una variante de Typography (variant="body2", "caption", "subtitle2", "h6"…) o sx={{ typography: '…' }}; la escala está en packages/ui/src/tokens.ts.`;
          return [
            `Property${clave} > ${literal}`,
            `Property${clave} > ObjectExpression > Property > ${literal}`,
            `Property${clave} > ConditionalExpression > ${literal}`,
            `JSXAttribute[name.name='${nombre}'] > ${literal}`,
            `JSXAttribute[name.name='${nombre}'] > JSXExpressionContainer > ${literal}`,
          ].map((selector) => ({ selector, message: mensaje }));
        }),
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/pruebas/**'],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { ...tseslint.configs.disableTypeChecked.languageOptions, globals: { ...globals.node } },
  },
);
