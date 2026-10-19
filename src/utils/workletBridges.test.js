const path = require("path");
const {
    findUnsafeBridgeTargets,
    findUnsafeWorkletBridges,
} = require("../../scripts/check-worklet-bridges");

const filename = path.resolve(__dirname, "workletBridgeFixture.tsx");

function fixture(longPressHandler, bridge = "runOnJS") {
    return `
import { Gesture } from "react-native-gesture-handler";
import { runOnJS as ${bridge} } from "react-native-reanimated";
export function createGestures(onExpand) {
    const handleExpand = () => onExpand();
    const hold = Gesture.LongPress().onStart(${longPressHandler}).runOnJS(true);
    const pan = Gesture.Pan().onEnd(() => ${bridge}(handleExpand)());
    return [hold, pan];
}`;
}

describe("production worklet bridge boundaries", () => {
    it("detects auto-workletization of a shared gesture handler despite runOnJS(true)", () => {
        expect(findUnsafeBridgeTargets(fixture("handleExpand"), filename))
            .toEqual([{ target: "handleExpand", line: 7 }]);
    });

    it("keeps a wrapped gesture handler on RN for another gesture to bridge to", () => {
        expect(findUnsafeBridgeTargets(fixture("() => handleExpand()"), filename)).toEqual([]);
    });

    it("recognizes an imported bridge alias", () => {
        expect(findUnsafeBridgeTargets(fixture("handleExpand", "dispatchToRN"), filename))
            .toEqual([{ target: "handleExpand", line: 7 }]);
    });

    it("does not confuse an unrelated handler with the same name in another scope", () => {
        const source = fixture("() => handleExpand()") + `
export function anotherGesture(onExpand) {
    const handleExpand = () => onExpand();
    return Gesture.LongPress().onStart(handleExpand).runOnJS(true);
}`;
        expect(findUnsafeBridgeTargets(source, filename)).toEqual([]);
    });

    it("checks actual application bridge targets with the production compiler", () => {
        expect(findUnsafeWorkletBridges(path.resolve(__dirname, ".."))).toEqual([]);
    });
});
