import React from "react";
import { ActivityIndicator } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import ListEmpty from "./listEmpty";
import { RequestStateCode } from "@/constants/commonConst";

jest.mock("./icon", () => "MockIcon");
jest.mock("@/utils/motion", () => ({ motionDuration: () => 0, motionEasing: () => undefined }));
jest.mock("./themeText", () => "MockText");
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("@/hooks/useColors", () => () => ({ primaryText: "navy", tonalSurface: "white", onTonal: "navy", danger: "maroon", dangerSurface: "white" }));

function render(state: RequestStateCode, onRetry?: () => void) {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<ListEmpty state={state} onRetry={onRetry} />);
    });
    return renderer!;
}
describe("empty and request feedback", () => {
    it.each([RequestStateCode.IDLE, RequestStateCode.FINISHED, RequestStateCode.PARTLY_DONE])("renders an empty local or finished list for state %s", state => {
        const renderer = render(state);
        expect(renderer.root.findAllByType("MockText" as any).some(node => node.props.children === "common.emptyList")).toBe(true);
    });
    it.each([RequestStateCode.PENDING_FIRST_PAGE, RequestStateCode.PENDING_REST_PAGE])("renders a loading indicator for state %s", state => {
        expect(render(state).root.findAllByType(ActivityIndicator)).toHaveLength(1);
    });
    it("retries an error only when a retry handler is available", () => {
        const retry = jest.fn();
        const renderer = render(RequestStateCode.ERROR, retry);
        act(() => renderer.root.findAllByProps({ accessibilityLabel: "common.clickToRetry" })[0].props.onPress());
        expect(retry).toHaveBeenCalledTimes(1);
        expect(render(RequestStateCode.ERROR).root.findAllByProps({ accessibilityRole: "button" })).toHaveLength(0);
    });
});
