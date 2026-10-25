import { createContext, useContext } from "react";
import useOrientation from "@/hooks/useOrientation";

export const PlayerOrientationContext = createContext<"vertical" | "horizontal" | null>(null);

/** Scope the player's arrangement without changing the device orientation store. */
export default function usePlayerOrientation() {
    const orientation = useOrientation();
    return useContext(PlayerOrientationContext) ?? orientation;
}
