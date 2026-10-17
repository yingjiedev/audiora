import { useCallback, useEffect, useRef, useState } from "react";
import {
    runOnJS,
    SharedValue,
    useAnimatedReaction,
} from "react-native-reanimated";

export const PLAYER_INPUT_THRESHOLD = 0.05;
const HIDDEN_WATCHDOG_MS = 900;
const VISIBLE = 1;
const HIDDEN_IDLE = 2;

function visibilityState(progress: number, dragging: boolean, closing: boolean) {
    "worklet";
    const visible = progress > PLAYER_INPUT_THRESHOLD;
    if (closing) {
        return 0;
    }
    return visible ? VISIBLE : dragging ? 0 : HIDDEN_IDLE;
}

/** Release a transparent overlay even if no explicit exit was requested. */
export default function usePlayerVisibility(
    progress: SharedValue<number>,
    isDragging: SharedValue<boolean>,
    isClosing: SharedValue<boolean>,
    isExiting: boolean,
    onClose: () => void,
) {
    const [visible, setVisible] = useState(
        progress.value > PLAYER_INPUT_THRESHOLD,
    );
    const activeRef = useRef(true);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const updateVisibility = useCallback((value: number) => {
        if (!activeRef.current) {
            return;
        }
        setVisible(value === VISIBLE);
        if (value !== HIDDEN_IDLE) {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        } else if (timerRef.current === null) {
            timerRef.current = setTimeout(() => {
                timerRef.current = null;
                // Recheck the UI values: queued reactions may arrive late.
                if (
                    activeRef.current &&
                    progress.value <= PLAYER_INPUT_THRESHOLD &&
                    !isDragging.value &&
                    !isClosing.value
                ) {
                    onClose();
                }
            }, HIDDEN_WATCHDOG_MS);
        }
    }, [progress, isDragging, isClosing, onClose]);

    useEffect(() => {
        activeRef.current = true;
        updateVisibility(visibilityState(
            progress.value,
            isDragging.value,
            isClosing.value,
        ));
        return () => {
            activeRef.current = false;
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [progress, isDragging, isClosing, isExiting, updateVisibility]);

    useAnimatedReaction(
        () => visibilityState(progress.value, isDragging.value, isClosing.value),
        (value, previous) => {
            if (value !== previous) {
                runOnJS(updateVisibility)(value);
            }
        },
        [updateVisibility],
    );

    return visible && !isExiting;
}
