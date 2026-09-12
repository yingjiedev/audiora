# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# --- Audiora (issue #46): R8 minification for release builds ---
# React Native, Expo modules, Nitro, Reanimated and react-native-track-player
# all ship consumer proguard rules in their AARs; no extra app-side keeps are
# required for them. The rules below only cover third-party Java libraries
# vendored directly by the app and missing-class noise.

# jaudiotagger / nanohttpd are referenced directly from app native code,
# no reflection-based entry points are known - rely on reachability analysis.

-dontwarn javax.annotation.**
-dontwarn java.awt.**
-dontwarn org.jaudiotagger.**
-dontwarn org.nanohttpd.**
-dontwarn sun.misc.Unsafe
-dontwarn sun.security.**
-dontwarn java.nio.file.**
-dontwarn org.codehaus.mojo.animal_sniffer.**
