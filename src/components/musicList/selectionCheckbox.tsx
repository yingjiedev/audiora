import React from "react";
import { StyleSheet, View } from "react-native";
import Checkbox from "@/components/base/checkbox";
import { spacing } from "@/constants/designSystem";

/** The whole music row owns the accessible checkbox and handles the press. */
export default function SelectionCheckbox({ checked }: { checked: boolean | "mixed" }) {
    return <View style={styles.checkbox} accessible={false} pointerEvents="none"><Checkbox checked={checked === true} indeterminate={checked === "mixed"} /></View>;
}

const styles = StyleSheet.create({
    checkbox: { justifyContent: "center", marginRight: spacing.sm },
});
