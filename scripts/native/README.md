# Android audio effects

`AudioSessionObserver.java` is installed into React Native Track Player by
`patch-track-player-audio-effects.js`, called by the existing postinstall patch.
It targets RNTP **4.1.2** and KotlinAudio **2.1.0**. The Java adapter shares
KotlinAudio's package to call its protected JVM player getter; it does not use
reflection, poll session IDs, replace ExoPlayer, or attach effects to session 0.
Recheck this adapter when upgrading either dependency. The patch must fail if
the lifecycle anchors change, and must remain idempotent.

The adapter sends package-scoped session lifecycle broadcasts to the app's
non-exported receiver. `AudioEffectsController` initializes in `Application`
and owns effects and native preferences even when React/UI is inactive.
Session changes release old effects and restore the current tuning; closing
an old session cannot detach a newer one.

Android 9+ first tries `DynamicsProcessing` (ten EQ bands, non-positive preamp,
linked limiter). It falls back to `Equalizer` with the engine's real bands and
range. Curves are stored as frequency/gain control points and interpolated on
log frequency across devices. Both backends reserve gain headroom. The legacy
backend shifts the curve into its supported cut range instead of changing
RNTP volume, so interruption ducking cannot erase the compensation. Preamp
and limiter controls are only shown when supported. Effects default to off.

Slider previews update the native effect in memory; completing the drag,
selecting a preset, saving a custom preset, and toggling effects persist native
preferences. The JS store serializes/coalesces writes and ignores old native
versions. Preferences are read before editing is enabled.

The presets page provides ten Audiora EQ curves with descriptions and illustrations.
The custom editor shows a logarithmic view of configured gains and groups the
device's actual bands into lows, mids and highs. Before a session exists it can
edit the portable ten-band curve, which is fitted to the device at playback.
It does not render a live
spectrum or claim a measured frequency response. Advanced sound-effect research
and scope are documented in `docs/audio-effects-research.md`.

Shared v3 backups include portable sound settings under
`data.audiora.audioEffects`. Backup reads native preferences even if the page
was never opened, and waits for queued writes. Restore validates before any
mutations and persists the curve, preamp, enabled state and named preset library;
device/session capabilities are rediscovered locally. An older backup with no
sound settings leaves the current tuning unchanged. Unsupported platforms keep
imported settings in an archive for future backup without activating playback
effects.

Named presets use `customPresets` (at most 32 entries, IDs up to 80 characters,
names up to 40 characters) and `activeCustomId`. The native reader and portable
parser migrate the earlier `savedCustom` slot to `legacy-custom` without losing
its curve. An explicit empty library is authoritative, so deleting the last
preset cannot resurrect the old slot. Editing current tuning leaves the saved
copy unchanged until Save changes; deleting the selected preset keeps playback
tuning and clears only its selected ID.

The gallery and saved presets share one equalizer editor. Tap a saved preset's
name or curve to edit it without enabling effects; Use applies it for playback.
Editing or enabling the currently selected preset preserves unsaved tuning.
The compact saved-preset rows keep rename and delete in a More menu; the page
does not duplicate the editor as a separate manual-equalizer card.

Entry points: Settings → Sound effects & equalizer; current-player song menu
→ Sound effects & equalizer. Scope is the main Android music player. MV uses
another player, and iOS has no effects entry in this implementation.

Verification: focused Jest tests under `src/core/audioEffects`, settings page
tests and `src/utils/audioEffectsPatch.test.js`; Android `EqualizerCurveTest`;
runtime/color checks; compile the app Kotlin and RNTP Java adapter. Device
listening, background/route changes, and light/dark/custom-theme acceptance
remain manual; no screenshot or emulator acceptance is substituted.
