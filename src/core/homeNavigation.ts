import { GlobalState } from "@/utils/stateMapper";

export type HomeTab = "home" | "library" | "mine";
export const homeTabStore = new GlobalState<HomeTab>("home");
export type PlaybackPaneTab = "lyric" | "queue";
export const playbackPaneTabStore = new GlobalState<PlaybackPaneTab>("lyric");
