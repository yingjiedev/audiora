/**
 * @format
 */

import { registerRootComponent } from "expo";
import { AppRegistry, Platform } from "react-native";

if (Platform.OS === "web") {
    const WebPreview = require("./src/preview/WebPreview").default;
    registerRootComponent(WebPreview);
} else {
    const TrackPlayer = require("react-native-track-player").default;
    registerRootComponent(require("./src/entry/nativeRoot").default);
    TrackPlayer.registerPlaybackService(() => require("./src/service/index"));
    AppRegistry.registerHeadlessTask("AudioraWidget", () => require("./src/service/widgetTask").default);
}
