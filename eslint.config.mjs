import hooks from 'eslint-plugin-react-hooks';
import tsp from '@typescript-eslint/parser';

/**
 * Just the Rules of Hooks, deliberately.
 *
 * A useEffect placed after an early return crashed the artist allocation
 * dialog on every open — the build was clean, so nothing caught it until a
 * user hit it in the shop. This one rule catches that class of bug; a wider
 * style config can come later without holding this up.
 */
export default [
  { ignores: ['.next/**', 'out/**', 'dist/**', 'node_modules/**'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: tsp, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { 'react-hooks': hooks },
    rules: { 'react-hooks/rules-of-hooks': 'error' },
  },
];
