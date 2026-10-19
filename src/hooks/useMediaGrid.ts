import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "@/constants/designSystem";

export function mediaGridColumns(width: number, fontScale: number, gutter: number) {
    const available = Math.max(0, width - gutter * 2);
    return Math.max(1, Math.min(5, Math.floor(available / (100 * Math.max(1, fontScale)))));
}

export default function useMediaGrid() {
    const { width, fontScale } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    return mediaGridColumns(width - insets.left - insets.right, fontScale, spacing.xxxl);
}
