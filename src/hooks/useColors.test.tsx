import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import useColors from "./useColors";
import { lightColors } from "@/constants/colorPalette";

let mockTheme = { dark: false, colors: { ...lightColors, background: "transparent" } };
jest.mock("@react-navigation/native", () => ({ useTheme: () => mockTheme }));

function Probe({ capture }: { capture: (colors: ReturnType<typeof useColors>) => void }) {
    capture(useColors());
    return null;
}

describe("shared theme resolution", () => {
    it("reuses resolved colors across independent consumers of the same immutable theme", () => {
        const values: ReturnType<typeof useColors>[] = [];
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<><Probe capture={value => values.push(value)} /><Probe capture={value => values.push(value)} /></>);
        });
        expect(values[0]).toBe(values[1]);
        act(() => renderer!.unmount());
    });

    it("invalidates resolution when a custom color object or theme mode changes", () => {
        const values: ReturnType<typeof useColors>[] = [];
        const capture = (value: ReturnType<typeof useColors>) => values.push(value);
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<Probe capture={capture} />); 
        });
        const original = values.at(-1)!;
        mockTheme = { dark: false, colors: { ...mockTheme.colors, primary: "#FFCC00" } };
        act(() => renderer!.update(<Probe capture={capture} />));
        expect(values.at(-1)!.primary).toBe("#FFCC00");
        expect(values.at(-1)).not.toBe(original);
        const custom = values.at(-1)!;
        mockTheme = { ...mockTheme, dark: true };
        act(() => renderer!.update(<Probe capture={capture} />));
        expect(values.at(-1)).not.toBe(custom);
        act(() => renderer!.unmount());
    });
});
