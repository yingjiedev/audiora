import React from "react";
import { StyleSheet, Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import ThemeText from "./themeText";

jest.mock("@/hooks/useColors", () => () => ({ primary: "#3867F4", primaryText: "#315AD7", text: "#10172D", onPrimary: "#FFFFFF" }));
jest.mock("@/hooks/useFontFamily", () => ({ useAppFontFamily: () => undefined }));

describe("theme text color roles", () => {
    it("uses readable primary text while preserving button foreground and explicit overrides", () => {
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<>
                <ThemeText fontColor="primary">Selected</ThemeText>
                <ThemeText fontColor="onPrimary">Button</ThemeText>
                <ThemeText fontColor="primary" color="#574B67">Custom</ThemeText>
            </>);
        });
        expect(renderer.root.findAllByType(Text).map(node => StyleSheet.flatten(node.props.style).color)).toEqual(["#315AD7", "#FFFFFF", "#574B67"]);
        act(() => renderer.unmount());
    });
});
