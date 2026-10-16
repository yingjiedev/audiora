import React from "react";
import { Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import StateMapper, { GlobalState } from "./stateMapper";

describe("mapped state subscriptions", () => {
    it("updates multiple consumers and supports functional updates", () => {
        const store = new GlobalState(1);
        function Observer() {
            return <Text>{store.useValue()}</Text>;
        }
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<><Observer /><Observer /></>);
        });
        act(() => store.setValue(value => value + 2));
        expect(renderer!.root.findAllByType(Text).map(node => node.props.children)).toEqual([3, 3]);
        act(() => renderer!.unmount());
    });
    it("removes subscriptions when a consumer unmounts", () => {
        const getter = jest.fn(() => 1);
        const mapper = new StateMapper(getter);
        function Observer() {
            return <Text>{mapper.useMappedState()}</Text>;
        }
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<Observer />);
        });
        act(() => renderer!.unmount());
        getter.mockClear();
        act(() => mapper.notify());
        expect(getter).not.toHaveBeenCalled();
    });
});
