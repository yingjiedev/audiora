# Repository Guidelines

## Project Structure & Module Organization

Audiora is a React Native application. Application code lives in `src/`: reusable UI is under `components/`, screens under `pages/`, shared business logic under `core/`, platform services under `service/`, and helpers under `utils/`. Images, SVG icons, and fonts are stored in `src/assets/` and `assets/fonts/`. Native projects are in `android/` and `ios/`; avoid editing generated build output. Maintenance scripts live in `scripts/`, while `generator/generate-assets.mjs` rebuilds the icon component map.

Tests are colocated with their subjects as `*.test.ts` or `*.test.tsx`; some utility tests also live in `src/utils/__tests__/`.

## Build, Test, and Development Commands

- `npm install` installs locked dependencies and applies required package patches.
- `npm start` launches Metro.
- `npm run android` builds and runs the Android debug app.
- `npm run ios` runs the iOS app on a configured macOS environment.
- `npm test` runs the Jest suite; use `npm test -- --runInBand path/to/file.test.ts` for a focused run.
- `npm run lint` runs ESLint over `src/` and fixes supported issues.
- `npm run build-android` generates build metadata and produces the release APK.
- `npm run build-preview` increments the base semantic version's patch number, generates a uniquely versioned Android preview APK, verifies its metadata and signature, and cleans up temporary build settings. For example, `0.1.9` becomes `0.1.10-preview.<timestamp>`. Build output is stored under `%TEMP%\audiora-build-preview-logs`; successful builds show only the summary, failed commands show the last 20 lines, and runs remove log sessions older than 7 days. Use `npm run build-preview -- -Abi all` for all Android ABIs.
- `npm run generate-assets` regenerates `src/components/base/icon.tsx` after SVG icon changes.

## Coding Style & Naming Conventions

Use TypeScript for new application code and the `@/` alias for imports from `src/`. ESLint is authoritative for `src`: four-space indentation, semicolons, double quotes, spaced object braces, trailing commas in multiline structures, and 1TBS braces. Use `camelCase` for variables and hooks (`usePrimaryColor`), `PascalCase` for components and types, and descriptive lowercase filenames consistent with the surrounding directory. Run `npm run lint` before submitting changes.

## Testing Guidelines

Jest uses the React Native preset and loads `jest.setup.js`. Add regression tests beside changed behavior, especially for parsing, storage, panels, and playback state. Mock native modules rather than requiring a device. No coverage threshold is enforced, but new logic should cover success, failure, and boundary cases.

For Android preview handoff, build the requested preview APK and install it on the user's connected physical device. Once installation succeeds and the installed version is confirmed, stop; the user performs the UI and functional acceptance testing manually. Do not start an emulator, capture device screenshots, or perform substitute visual acceptance unless the user explicitly asks for it.

## Android Preview Builds

`BUILDING.md` is the command reference. The points below are the failure modes actually hit while building preview APKs — check them before assuming a source problem.

- Build in a short-path worktree on a drive with real free space. A nearly full drive does not fail loudly; dependency extraction stops partway and leaves `node_modules` incomplete. The tell is `npm run typecheck:runtime` reporting `TS2304 Cannot find name 'Math' / 'Array' / 'JSON'` in files the change never touched. Reinstall instead of editing code.
- Copy the fonts before building. `build-preview` does not do it (CI does), and a build without it ships an APK missing roughly 22 MB of fonts: run `New-Item -ItemType Directory -Force android/app/src/main/assets/fonts` followed by `Copy-Item assets/fonts/*.ttf android/app/src/main/assets/fonts/`.
- If Node reports a module missing while its `package.json` points at a file that should exist, look for a `*.DELETE.<hash>` sibling in that directory before reinstalling. A sandboxed delete can rename the file away instead of removing it; the content is intact, so restoring the original name is enough.
- Pass `-PreviewVersion` explicitly whenever the version string matters, for example `npm run build-preview -- -PreviewVersion 0.3.4`. `package.json` trails the release line, so the derived default can read older than the branch being built.
- Without `android/keystore.properties` the release build falls back to the debug keystore. That installs over another debug-signed build with `adb install -r`, but it cannot replace a release-signed install without uninstalling, which clears app data.
- Verify the artifact with `aapt2 dump badging` for package, `versionCode`/`versionName` and `native-code`, and with `apksigner` for the signature. Where `JAVA_HOME` is a POSIX-style path, `apksigner.bat` rejects it; call the jar directly: `java -jar "$ANDROID_SDK_ROOT/build-tools/36.0.0/lib/apksigner.jar" verify --verbose --print-certs <apk>`.

## Commit & Pull Request Guidelines

Commits follow Conventional Commits, for example `fix(主题): correct custom background color` or `docs: update installation notes`. Commitlint permits `ci`, `chore`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, and `style`; choose the closest applicable type.

Pull requests should explain the user-visible effect, link relevant issues, list verification commands, and include screenshots or recordings for UI changes. Call out Android/iOS-specific behavior and any migration or configuration impact.
