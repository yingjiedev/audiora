import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, TouchableHighlight, View } from "react-native";
import ListItem from "./listItem";

jest.mock("./icon", () => "MockIcon");
jest.mock("./fastImage", () => "MockImage");
jest.mock("./themeText", () => "MockText");
jest.mock("@/core/appConfig", () => ({ useAppConfig: () => undefined }));
jest.mock("@/hooks/useColors", () => () => ({ text: "black", listActive: "white" }));

describe("ListItem intrinsic row sizing", () => {
    it("keeps icon and text intrinsic inside a row without an explicit height", () => {
        const press = jest.fn();
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(
                <ListItem heightType="small" onPress={press}>
                    <ListItem.ListItemIcon fixedWidth width={24} icon="identification" />
                    <ListItem.Content title="Song information" description="Source and ID" />
                </ListItem>,
            );
        });
        const styles = renderer!.root.findAllByType(View).map(node => StyleSheet.flatten(node.props.style));
        expect(styles.every(style => style?.height !== "100%")).toBe(true);
        expect(styles.some(style => style?.minHeight === ListItem.Size.small)).toBe(true);
        expect(styles.filter(style => style?.alignSelf === "stretch")).toHaveLength(2);
        expect(styles.find(style => style?.flex === 1)?.minWidth).toBe(0);
        act(() => renderer!.root.findByType(TouchableHighlight).props.onPress());
        expect(press).toHaveBeenCalledTimes(1);
        act(() => renderer!.unmount());
    });
});
