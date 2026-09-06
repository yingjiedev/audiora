/**
 * @format
 */

import { registerRootComponent } from "expo";
import { Platform } from "react-native";

if (Platform.OS === "web") {
    const WebPreview = require("./src/preview/WebPreview").default;
    registerRootComponent(WebPreview);
} else {
    const TrackPlayer = require("react-native-track-player").default;
    const Pages = require("@/entry").default;
    registerRootComponent(Pages);
    TrackPlayer.registerPlaybackService(() => require("./src/service/index"));
}
