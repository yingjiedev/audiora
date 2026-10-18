import React, { useCallback, useState } from "react";
import { BackHandler, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { isPlayerOpen } from "@/core/playerOverlay";
import globalStyle from "@/constants/globalStyle";
import { SelectionActions } from "./selectionControls";
import { InlineMusicSelectionSession, MusicSelectionContext, MusicSelectionDispatchContext } from "./selectionContext";

/** One screen owns the exit behavior and fixed toolbar; its existing lists stay mounted. */
export default function MusicSelectionProvider({ children }: { children: React.ReactNode }) {
    const [active, setActive] = useState<InlineMusicSelectionSession>();
    const finish = active?.editor.finish;
    useFocusEffect(useCallback(() => {
        if (!finish) return;
        const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
            if (isPlayerOpen()) return false;
            finish();
            return true;
        });
        return () => subscription.remove();
    }, [finish]));

    return <MusicSelectionDispatchContext.Provider value={setActive}>
        <MusicSelectionContext.Provider value={active}>
            <View style={globalStyle.fwflex1}>
                {children}
                {active ? <SelectionActions key={active.scope} selectedItems={active.editor.selectedItems} onClear={active.editor.clear}
                    actions={active.actions} removal={active.removal} /> : null}
            </View>
        </MusicSelectionContext.Provider>
    </MusicSelectionDispatchContext.Provider>;
}
