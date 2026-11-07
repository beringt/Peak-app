# Repository instructions

Peak is a minimal Expo React Native MVP in TypeScript for profiles, training plans, weight tracking, and daily recommendations.

## Structure and implementation
- Keep `App.tsx` as the entry point and reuse shared types from `src/types/index.ts`.
- Follow the existing `src/features/profile`, `training`, `weight`, and `recommendation` folders; put shared helpers in `src/utils`.
- Implement only the current issue's requirements and acceptance criteria. Prefer small, incremental changes and simple local component state.
- Preserve the existing architecture and shared type names unless the issue explicitly requests changes. Do not introduce `src/screens`, `src/state`, backend code, persistence, navigation, or global state without an explicit requirement.
- Do not add dependencies unless explicitly required by the issue.
- Use typed React function components, React Native components, and local `StyleSheet.create` styles. Keep pure calculation helpers separate from UI.

## Branches, validation, and pull requests
- Read the issue and relevant existing code before editing. If requirements conflict with the current code, resolve the scope before introducing architecture changes.
- Create a focused branch from the latest `main`; open a pull request against `main` and leave merging to the owner unless asked.
- Change only files required by the issue. Avoid unrelated refactors, formatting, generated files, and dependency or lockfile changes.
- Review the final diff against `main` for scope and acceptance criteria. Run appropriate existing checks; for TypeScript changes, use `npx tsc --noEmit`. Do not add a test framework unless requested.
- In the PR, reference the issue and explain the behavior, validation results, and any untested requirements or limitations.
