# Timing Close Visual QA

## Evidence

- Source visual truth: `C:\Users\yingj\AppData\Local\Temp\codex-clipboard-6f8e39be-58b5-41fe-9f13-6b0ee869c10c.png`
- Implementation screenshot: `D:\yingj\workspace\audiora-timer-polish\artifacts\design-qa\timing-close-verified.png`
- Combined comparison: `D:\yingj\workspace\audiora-timer-polish\artifacts\design-qa\timing-close-comparison-verified.png`
- State: portrait, Simplified Chinese, light theme, 30 minutes selected, close-after-track disabled.
- Source pixels: 853 × 1844.
- Implementation pixels: 1080 × 2248 on the connected Android device.
- Implementation viewport: 393 dp wide at 440 dpi (2.75 device scale); physical display 1080 × 2248.
- Density normalization: full views were normalized to 720 px width and bottom-aligned; the source panel crop (853 × 846) and implementation panel crop (1080 × 1068) were both normalized to 720 × 712 for direct comparison.

## Full-view comparison

The combined comparison confirms that the sheet hierarchy, dimmer strength, top radius, horizontal gutters, dial scale, option row, close-after-track card, hint, and primary action follow the source composition. The different amount of home content above the sheet is expected from the source and device aspect-ratio mismatch; the app-owned sheet keeps the source's width-relative geometry.

## Focused panel comparison

The lower pair in the combined comparison is an equal-size panel-only comparison. Typography, spacing, sampled colors, image/icon quality, copy, control state, shadows, and touch-target proportions were inspected at that normalized size. The Phosphor Moon Stars and Sun Horizon assets replace the former generic symbols with source-like vector icons. No raster placeholder, text glyph, or hand-drawn icon is used.

## Findings

- No actionable P0, P1, or P2 differences remain.
- P3: the source moon uses small sleep marks while the closest library asset uses sparkle marks. This is acceptable at the rendered size and does not change hierarchy or meaning.
- Expected: underlying home content and visible vertical extent differ because the source is 853 × 1844 while the verification device is 1080 × 2248.

## Comparison history

1. Pass 1: the dial was a full circle, the dimmer was too light, icons did not match, and the source proportions were undersized. Fixed by matching the sheet geometry, 30-minute default state, card/button dimensions, sampled mask and surface colors, and source-like icons.
2. Pass 2: the 270-degree gauge had the opening and active arc on the wrong sides. Fixed by rotating the gauge so the active arc is on the left, remaining track on the right, and opening at the bottom.
3. Pass 3: tick marks were too faint, the numeric label and row copy were optically heavy, and the top surface was too bright. Fixed by lengthening/darkening ticks, reducing optical type size/weight, and applying sampled surface and mask colors.
4. Final pass: the revised 1080 × 2248 device capture was normalized with the source panel and showed no remaining P0/P1/P2 mismatch.

## Interaction verification

- Selected 10 minutes and confirmed the dial knob, arc, and selected pill updated.
- Toggled close-after-track on and confirmed the custom switch state changed.
- Started the timer and confirmed the sheet dismissed.
- Reopened the sheet and confirmed the cancel-timer state appeared.
- Cancelled the timer and restored the close-after-track switch to off for the final capture.

## Implementation checklist

- [x] Match sheet size, radius, dimmer, gradient, spacing, and shadows.
- [x] Match the 270-degree dial, ticks, knob, colors, and 30-minute state.
- [x] Match shortcut pills, close-after-track card, switch, hint, and CTA.
- [x] Preserve timer selection, custom-time, start, cancel, and close-after-track behavior.
- [x] Verify the exact release APK on a connected Android device.

final result: passed

---

# Playback drawer visual verification

- Source visual truth: user attachment `3a1dae1a278d6baac0a6893d95eec025.jpg` (1220 × 2656 pixels, displayed at 941 × 2048).
- Implementation: native React Native playback drawer; no implementation screenshot captured.
- Viewport: physical Android device; runtime viewport and density not captured.
- State: playing queue, song history, and playlist history in light/dark themes await manual acceptance.
- Density normalization: none; no paired runtime capture is available.
- Full-view comparison evidence: unavailable. The reference was inspected, but code and passing tests do not establish visual fidelity.
- Focused region comparison evidence: unavailable for tab typography, row spacing, toolbar icons, current-song indicator, or gesture rendering.

## Findings

Visual verification remains pending. The repository's explicit preview instructions require installation and installed-version confirmation, then stopping for user acceptance; they prohibit device screenshots or substitute visual acceptance unless requested. This instruction takes precedence over the design skill's automatic screenshot workflow.

The implementation uses the existing theme, type sizes, icons, and native panel. Three tabs and live counts replace the old queue header; songs use compact single-line title/artist rows with separate remove and reorder controls. Playlist history uses real collection metadata. The current-song indicator uses existing musical-note/pause icons rather than the reference's equalizer. Dragging commits on release; automatic scrolling at the viewport edge is not implemented. These are implementation facts, not verified visual matches.

## Required fidelity surfaces

- Fonts/typography: existing native typography reused; runtime font rendering, clipping, large text, and selected-tab underline await review.
- Spacing/layout rhythm: bottom drawer height 62%, 20dp horizontal inset, at least 48dp song rows and action height; runtime safe-area layout awaits review.
- Colors/tokens: existing panel, foreground, secondary text, and success tokens reused; light/dark runtime contrast awaits review.
- Image/assets: existing icons and actual collection covers reused; no sample art or fabricated playlist data. Runtime crop and sharpness await review.
- Copy/content: localized tabs, counts, empty states, and confirmations have automated coverage; runtime truncation and text scaling await review.

## Comparison history

No paired native visual comparison has been performed. No visual iteration is claimed as passed.

## Implementation checklist

- Automated playback-history, tab/action isolation, navigation, stale reorder, and gesture cancellation regressions passed.
- Build and install a uniquely versioned Android preview; verify package, ABI, fonts, signing certificate, and installed version.
- User to accept appearance, list scrolling, drag behavior, tab switching, source navigation, and full-player return interactions on the physical device.

final result: blocked

Blocker: native visual evidence is intentionally deferred to user manual acceptance under repository preview instructions.

---

# Shared song list visual verification

- Source visual truth: user attachments `ee7e58cfb1a098d38dd4ef12c43617ca.jpg` (search) and `6d5720c670e4d282895ec47ae26281e2.jpg` (favorites).
- Provided pre-change implementation: `18490df32c3627379c43f4565c903ff7.jpg` (search). All three images are 1220 × 2656 pixels, displayed at 941 × 2048.
- Implementation: native React Native shared `MusicItem`; no post-change runtime screenshot captured.
- Viewport: Android; runtime viewport and density not captured. No density normalization or paired post-change comparison is claimed.
- State: search results, favorites, local songs, album/playlist songs, artist songs, and editing mode. Source screenshots have different results and tabs; only row structure is compared.
- Full-view evidence: supplied references inspected; reference rows use a continuous page background with title/artist hierarchy. The supplied old app adds covers, raised containers, borders, shadows, and a separate source/duration column.
- Focused evidence: supplied rows inspected for sequence numbers, title/artist alignment, badges, and right actions. Post-change native typography and tap geometry await manual acceptance.

## Findings and implementation

- [P1] Per-song cards compete with song titles and fragment the list. Removed both scene wrappers and the card variant from the common song list.
- [P2] Covers and source columns consume title space. Default rows now omit covers, use two text lines, and place real quality/VIP/MV/local status and duration in the secondary line. Full source metadata stays in the existing options panel.
- [P2] Scene-specific wrappers can drift. Search, favorites, local songs, playlist/album songs, artist songs, and the legacy history screen use the same `MusicItem` row. Sequence numbers, optional cover, and typed actions are configuration.
- [P2] Adjacent controls must not trigger row playback. Text/leading content and actions use sibling press targets; automated tests cover play, favorite, next-play, options, and editing isolation. Native hit testing remains manual.

## Required fidelity surfaces

- Fonts/typography: existing app font and 28/22rpx title/metadata sizes, single-line truncation, literal keyword highlights, current-track primary color. Runtime rendering and long metadata await review.
- Spacing/layout: one shared 120rpx row minimum, 32rpx left inset, 8rpx metadata gap; 44 × 48dp minimum action targets. No per-song border, radius, shadow, or persistent row fill. Sequence numbers remain aligned in collection lists.
- Colors/tokens: existing theme foreground, secondary, primary, pressed state, and favorite danger tokens; existing factual badges reused. Reference green is mapped to the app's configurable primary color.
- Image/assets: default reference-style rows contain no covers; optional real artwork remains supported. Existing icon assets are reused, including the app's next-play icon. No fabricated artwork, social counts, or quality badges.
- Copy/content: existing localized action labels; actual artist/album/duration fields. Search keeps the current playback preference and query highlights. No data migration.

## Comparison history and acceptance

The supplied pre-change screenshots guided the fixes. No post-change native capture or visual pass is claimed. Repository instructions defer UI acceptance to the user and prohibit automatic device capture or substitute visual acceptance.

- Automated: 81 Jest suites / 590 tests passed, including 22 new row/highlight/adapter cases; runtime reference, motion, color, and UI guards passed.
- Manual: verify light/dark appearance, long titles and metadata, action hit targets, current-song highlighting, list scrolling, favorite updates, and batch editing on the new APK.

final result: blocked

Blocker: post-change native visual evidence is deferred to user manual acceptance; the user requested packaging before connecting the device.

---

# Audiora color system verification

- Accepted target: the user-approved blue primary / blue-gray surfaces / limited purple accents proposal, following the complaint that the expanded player's mint gradient differed from the app palette.
- Source reference: the user selected the previously captured homepage with expanded PlayerDock. New analysis captures showed the system lock screen and were rejected as app evidence.
- Implementation: `COLOR_SYSTEM.md`, the repository instructions, centralized preset palette, pure semantic derivation, shared text component, PlayerDock, seek bar, song-row favorites, queue highlighting, and PR color CI.
- Spacing, artwork, copy, press regions, overlay lifecycle, gestures, and navigation were preserved. No post-change native appearance capture is claimed.

## Findings addressed

- The light player bypassed the theme primary by choosing the green branding stop. Its panel now derives a subtle 6% / 2% / 0% primary tint from the current surface.
- Queue selection used success green; selection now uses the readable active primary role.
- Likes shared the danger role; favorites and destructive/status colors now have separate preset values and component roles.
- Secondary text ignored configured theme values; the hook now honors them before applying legacy fallbacks.
- Color lint could pass imported but inappropriate brand colors. The combined check now restricts raw-palette access, decorative color imports, and success/danger usage in migrated playback components; the broad constants-directory exemption was removed.
- Primary text and button foreground account for rendered backgrounds. Tests cover alpha compositing, custom primary opacity, both presets, representative custom accents, transparent custom surfaces, gradient interpolation, invalid primary fallback, and incompatible surface limits.

## Verification and acceptance

- Automated: 84 Jest suites / 619 tests passed (29 added in this change); color, runtime-reference, motion and UI checks passed. Modified source files have zero ESLint errors/warnings and zero TypeScript diagnostics. Full-repository ESLint retains its existing 61 errors / 140 warnings.
- CI: color checks and the focused color/theme/component regression suite run for affected PR changes.
- Documentation: the checked-in color requirements define usage, exceptions, contrast limits, theme preservation, visual acceptance and progressive legacy cleanup.
- Native: the new colors are not yet packaged or accepted on Android/iOS. Manual acceptance should compare light/dark/custom themes, compact/expanded player, queue, search/favorites/local lists and settings.

final result: blocked

Blocker: post-change native visual evidence awaits a new preview and user manual acceptance; source implementation and automated checks are complete.

---

# App-wide color migration (2026-10-11)

- Target: apply `COLOR_SYSTEM.md` throughout the existing Android application while preserving player/navigation/gesture geometry and animations.
- Source audit: the guarded business-color inventory decreased from 180 occurrences in 47 files to zero. The baseline was tightened to zero after migration; common named colors are now checked alongside hex/RGB/HSL values. Preset/configuration/native lyric inputs, generated assets and the independent web preview retain their documented boundaries.
- Corrected: fixed-color controls in dialogs, sleep timer, links, switches, toast statuses, badges, library actions, song lists, search, downloads, settings, lyrics, album information and MV controls. The immersive cover tint now follows primary with a limited purple ambient stop. Destructive-fill foreground is independent of primary-fill foreground; RGBA error tints no longer use hex suffix concatenation.
- Contrast: light/dark presets, bright/transparent custom primary, tonal badges, warnings, destructive fills and opaque panel RGB are covered. A custom blue exposed a 4.486:1 button foreground; a neutral fallback now meets the unrounded 4.5:1 text threshold. Real cover imagery and arbitrary incompatible custom surfaces still require native/manual checks.
- Performance: semantic results are reused across consumers of the same immutable theme; mode/color-object changes invalidate them. This avoids repeating contrast derivation per mounted lyric row.
- Validation: 85 suites / 628 tests passed, plus the final language-package check (4 tests). Color, runtime-reference, animation-callback and UI guards passed. Changed source has zero ESLint errors and four existing warnings; TypeScript has ten existing diagnostics and zero introduced diagnostics. Repository ESLint retains 43 existing errors and 138 warnings.
- Handoff: a new signed arm64 preview is built from the committed source, with actual package/version/signature/font/resource verification and preserve-data installation recorded in the preview verification JSON. Per `AGENTS.md`, installation stops after confirming the installed version. Light/dark/custom appearance and interactive acceptance remain with the user; no post-migration native screenshot or visual pass is claimed.

Source/color regression result: pass. Native visual acceptance: pending user.

---

# Expanded player purple gradient (2026-10-11)

- Evidence: the user's screenshot of `0.3.1-preview.i88.colors.20261011.105538` shows that the 6% blue tint is barely visible. The user requested trying purple.
- Change: the expanded player now blends the theme's purple decorative accent into the opaque panel at 28% / 12% / 0%. Default light stops are #E9D6FC / #F6EEFE / #FFFFFF; dark stops are #4B4380 / #333763 / #212E4E. Primary controls retain their blue/theme role. Custom decorative accents remain configurable, with a safe preset fallback.
- Readability: the stronger tint exposed insufficient contrast in existing secondary/tertiary player text. Those roles are now calibrated across the gradient; preset light/dark tests sample both rendered gradient segments and enforce the unrounded 4.5:1 threshold.
- Validation: all 12 color suites / 115 tests passed, including actual native gradient binding, separate primary/decorative overrides, missing/invalid accents and opaque custom accents. Color, runtime-reference, animation and UI checks passed. Modified source has zero ESLint errors/warnings; PR type comparison retains ten existing diagnostics and zero introduced diagnostics. The previous change's missing placeholder key declaration was completed. Full repository lint still has existing findings. No component layout, animation, navigation or hit-region changes were made.
- Native acceptance: deliver a new uniquely versioned preview, verify the artifact and preserve-data installation, then leave visual comparison with the user per repository instructions. No post-change screenshot or native visual pass is claimed.

Source/color regression result: pass. Native visual acceptance: pending user.
