import useContentDimensions from "@/hooks/useContentDimensions";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "@/constants/designSystem";

export function mediaGridColumns(width: number, fontScale: number, gutter: number) {
    const available = Math.max(0, width - gutter * 2);
    const scale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
    return Math.max(1, Math.min(6, Math.floor(available / (100 * scale))));
}

export default function useMediaGrid() {
    const { width, fontScale } = useContentDimensions();
    const insets = useSafeAreaInsets();
    return mediaGridColumns(width - insets.left - insets.right, fontScale, spacing.xxxl);
}
