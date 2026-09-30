import tseslint from "typescript-eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";
export default [{ ignores: ["node_modules/**", ".next/**", ".venv/**"] }, {
  files: ["src/components/{VoiceAuth,ExamControls,AccessibleContent,ExamGuard,AnalyticsDashboard,AudioPractice}.tsx"],
  languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
  plugins: { "jsx-a11y": jsxA11y },
  rules: { ...jsxA11y.configs.recommended.rules, "jsx-a11y/no-static-element-interactions": ["error", { handlers: ["onClick", "onMouseDown", "onMouseUp"] }] },
}];
