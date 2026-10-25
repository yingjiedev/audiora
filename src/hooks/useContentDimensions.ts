import { createContext, useContext } from "react";
import { useWindowDimensions } from "react-native";

export const ContentDimensionsContext = createContext<{ width: number; height: number; wide?: boolean } | null>(null);

/** Cards and grids measure their allocated pane, never the full tablet window. */
export default function useContentDimensions() {
    const window = useWindowDimensions();
    const content = useContext(ContentDimensionsContext);
    return { ...window, ...(content ?? {}), wide: content?.wide ?? false };
}
