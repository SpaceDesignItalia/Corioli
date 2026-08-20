module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'dist-electron', '.eslintrc.cjs'],
  overrides: [
    {
      // Processo principale Electron e test: girano in Node, non nel browser
      files: ['electron/**/*.js', '**/__tests__/**/*.{ts,tsx,js}'],
      env: { node: true, browser: false },
    },
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    // Convenzione: il prefisso _ marca un parametro/variabile volutamente inutilizzato
    // (es. firme imposte da una libreria) senza doverlo rimuovere.
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
}
