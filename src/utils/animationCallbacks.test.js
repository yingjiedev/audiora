/**
 * Guards the crash class that took Audiora down twice.
 *
 * A callback passed to `withTiming` / `withSpring` / the motion helpers runs on
 * the UI runtime (Reanimated's `valueSetter` calls it from `step()`, off the
 * frame queue). If it is not a worklet, worklets turns it into a "Remote
 * Function" that can only throw, and the exception escapes the frame callback
 * and kills the process. See `scripts/check-animation-callbacks.js` for the
 * full explanation.
 *
 * The scan is AST-based, so it is exact rather than a heuristic over strings.
 */
const path = require("path");
const {
    findMissingWorkletCallbacks,
} = require("../../scripts/check-animation-callbacks.js");

describe("animation callbacks", () => {
    it("are always worklets", () => {
        const srcDir = path.resolve(__dirname, "..");

        const violations = findMissingWorkletCallbacks(srcDir).map(
            v => `${v.file}:${v.line} ${v.call}() argument #${v.argIndex}`,
        );

        expect(violations).toEqual([]);
    });
});
