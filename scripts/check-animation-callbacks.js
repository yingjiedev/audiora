/**
 * Every callback handed to an animation must be a worklet.
 *
 * Why: Reanimated's `valueSetter` is a worklet, so it runs on the UI runtime and
 * calls the completion callback directly —
 *
 *     animation.callback?.(true /* finished *\/);
 *
 * (`react-native-reanimated/src/valueSetter.ts`, inside `step()`, which the
 * frame queue invokes). react-native-worklets 0.10 turns any *non-worklet*
 * function captured into a UI closure into a "Remote Function", and calling one
 * of those is fatal by construction:
 *
 *     function remoteFunctionGuard() {
 *       throw new Error('[Worklets] Tried to synchronously call a Remote
 *         Function. Called "anonymous" on the UI Runtime.');
 *     }
 *
 * There is no dev-only warning and no recovery — the exception propagates out
 * of the frame callback and kills the process. A missing `"worklet"` directive
 * on an animation callback therefore reads as "the app crashes when this
 * animation ends", far away from the line that caused it. That is exactly how
 * the Audiora player crashed on launch and again on every panel close.
 *
 * The fix for a violation is either
 *   - add `"worklet";` as the first statement, keeping JS-side effects behind
 *     `runOnJS(...)`, or
 *   - drop the callback and observe the animation from JS instead.
 *
 * Run directly (`node scripts/check-animation-callbacks.js`) or through
 * `src/utils/animationCallbacks.test.js`, which fails the suite on any finding.
 */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

/**
 * Animation factories and the highest argument index that can carry a callback
 * (1-based; the caller's own `callback` is always the last positional argument).
 */
const FACTORY_ARGS = {
    withTiming: 3,
    withSpring: 3,
    withDecay: 2,
    withDelay: 2,
    withSequence: 99,
    withRepeat: 4,
    withClamp: 3,
    "motion.timing": 3,
    "motion.spring": 3,
    withMotionTiming: 3,
    withMotionSpring: 3,
};

/** The body of a function must list the worklets directive explicitly. */
const WORKLET_DIRECTIVE = "worklet";

function collectFiles(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === "node_modules") {
                continue;
            }
            collectFiles(full, out);
        } else if (/\.tsx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
            out.push(full);
        }
    }
    return out;
}

function calleeName(node) {
    if (ts.isIdentifier(node)) {
        return node.text;
    }
    if (ts.isPropertyAccessExpression(node)) {
        return calleeName(node.expression) + "." + node.name.text;
    }
    return null;
}

function isFunctionLike(node) {
    return (
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node) ||
        ts.isFunctionDeclaration(node)
    );
}

function hasWorkletDirective(fn) {
    const body = fn.body;
    if (!body || !ts.isBlock(body)) {
        return false;
    }
    return body.statements.some(
        statement =>
            ts.isExpressionStatement(statement) &&
            ts.isStringLiteral(statement.expression) &&
            statement.expression.text === WORKLET_DIRECTIVE,
    );
}

/**
 * @param {string} srcDir directory to scan (absolute)
 * @returns {{file: string, line: number, call: string, argIndex: number}[]}
 */
function findMissingWorkletCallbacks(srcDir) {
    const violations = [];

    for (const file of collectFiles(srcDir)) {
        const source = fs.readFileSync(file, "utf8");
        const sf = ts.createSourceFile(
            file,
            source,
            ts.ScriptTarget.Latest,
            true,
            file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        );

        const visit = node => {
            if (ts.isCallExpression(node)) {
                const name = calleeName(node.expression);
                const maxArgs = name ? FACTORY_ARGS[name] : undefined;
                if (maxArgs !== undefined) {
                    const args = node.arguments;
                    for (let i = 0; i < Math.min(maxArgs, args.length); i++) {
                        if (isFunctionLike(args[i]) && !hasWorkletDirective(args[i])) {
                            violations.push({
                                file: path
                                    .relative(srcDir, file)
                                    .replace(/\\/g, "/"),
                                line:
                                    sf.getLineAndCharacterOfPosition(
                                        args[i].getStart(sf),
                                    ).line + 1,
                                call: name,
                                argIndex: i + 1,
                            });
                        }
                    }
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sf);
    }

    return violations;
}

module.exports = { findMissingWorkletCallbacks, FACTORY_ARGS };

if (require.main === module) {
    const srcDir = path.resolve(__dirname, "..", "src");
    const violations = findMissingWorkletCallbacks(srcDir);

    if (violations.length === 0) {
        console.log(
            `check-animation-callbacks: OK — every animation callback in ${path.relative(
                process.cwd(),
                srcDir,
            )} is a worklet.`,
        );
    } else {
        console.error(
            `check-animation-callbacks: ${violations.length} animation callback(s) missing the "worklet" directive — these abort the process with "[Worklets] Tried to synchronously call a Remote Function":`,
        );
        for (const v of violations) {
            console.error(`  ${v.file}:${v.line}  ${v.call}() argument #${v.argIndex}`);
        }
        process.exit(1);
    }
}
