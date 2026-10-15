/** Detect RN callbacks that the production Babel plugin turns into worklets. */
const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");

function collectFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return collectFiles(file);
        }
        return /\.tsx?$/.test(file) && !/\.(test|d)\.tsx?$/.test(file) ? [file] : [];
    });
}

function bindingKey(identifier) {
    return `${identifier.name}:${identifier.loc?.start.line}:${identifier.loc?.start.column}`;
}

function isWorkletFactory(node) {
    if (node?.type !== "CallExpression" ||
        !["FunctionExpression", "ArrowFunctionExpression"].includes(node.callee.type) ||
        node.callee.body.type !== "BlockStatement") {
        return false;
    }
    return node.callee.body.body.some(statement => {
        const expression = statement.expression;
        return expression?.type === "AssignmentExpression" &&
            expression.left.type === "MemberExpression" &&
            expression.left.property.name === "__workletHash";
    });
}

function findUnsafeBridgeTargets(source, filename) {
    const ast = babel.parseSync(source, {
        filename,
        configFile: false,
        babelrc: false,
        parserOpts: { sourceType: "module", plugins: ["typescript", "jsx"] },
    });
    const bridgeNames = new Set();
    const targets = [];
    babel.traverse(ast, {
        ImportDeclaration(p) {
            if (!["react-native-reanimated", "react-native-worklets"].includes(p.node.source.value)) {
                return;
            }
            for (const specifier of p.node.specifiers) {
                if (specifier.type === "ImportSpecifier" &&
                    ["runOnJS", "scheduleOnRN"].includes(specifier.imported.name)) {
                    bridgeNames.add(specifier.local.name);
                }
            }
        },
    });
    babel.traverse(ast, {
        CallExpression(p) {
            if (p.node.callee.type !== "Identifier" || !bridgeNames.has(p.node.callee.name)) {
                return;
            }
            const target = p.node.arguments[0];
            if (target?.type !== "Identifier") {
                return;
            }
            const binding = p.scope.getBinding(target.name);
            if (binding) {
                targets.push({
                    target: target.name,
                    line: p.node.loc.start.line,
                    key: bindingKey(binding.identifier),
                });
            }
        },
    });
    if (!targets.length) {
        return [];
    }
    const compiled = babel.transformSync(source, {
        filename,
        cwd: path.resolve(__dirname, ".."),
        envName: "production",
        ast: true,
        code: false,
    });
    const workletBindings = new Set();
    babel.traverse(compiled.ast, {
        VariableDeclarator(p) {
            if (p.node.id.type === "Identifier" && isWorkletFactory(p.node.init)) {
                workletBindings.add(bindingKey(p.node.id));
            }
        },
    });
    return targets.filter(target => workletBindings.has(target.key))
        .map(({ target, line }) => ({ target, line }));
}

function findUnsafeWorkletBridges(srcDir) {
    return collectFiles(srcDir).flatMap(file => {
        const source = fs.readFileSync(file, "utf8");
        if (!/runOnJS|scheduleOnRN/.test(source)) {
            return [];
        }
        return findUnsafeBridgeTargets(source, file).map(result => ({
            file: path.relative(srcDir, file).replace(/\\/g, "/"),
            ...result,
        }));
    });
}

module.exports = { findUnsafeBridgeTargets, findUnsafeWorkletBridges };

if (require.main === module) {
    const violations = findUnsafeWorkletBridges(path.resolve(__dirname, "..", "src"));
    if (violations.length) {
        for (const v of violations) {
            console.error(`${v.file}:${v.line} ${v.target} is compiled as a worklet; keep the RN bridge target outside the gesture callback.`);
        }
        process.exitCode = 1;
    } else {
        console.log("check-worklet-bridges: OK — no RN bridge target is auto-workletized.");
    }
}
