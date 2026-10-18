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

Entry points: Settings → Sound effects & equalizer; current-player song menu
→ Sound effects & equalizer. Scope is the main Android music player. MV uses
another player, and iOS has no effects entry in this implementation.

Verification: focused Jest tests under `src/core/audioEffects`, settings page
tests and `src/utils/audioEffectsPatch.test.js`; Android `EqualizerCurveTest`;
runtime/color checks; compile the app Kotlin and RNTP Java adapter. Device
listening, background/route changes, and light/dark/custom-theme acceptance
remain manual; no screenshot or emulator acceptance is substituted.
