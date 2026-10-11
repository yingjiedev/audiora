/** Checks the public color API without pretending to infer every color's visual purpose. */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const RAW_CONSUMERS = new Set(["src/core/theme.ts", "src/utils/themeColors.ts", "src/constants/designSystem.ts"]);
const RAW_SYMBOLS = new Set(["audioraGradient", "topListGradients", "mediaOnDark", "mediaScrim"]);
const isTest = file => /(?:\.test\.[jt]sx?$|\/__tests__\/|\.d\.ts$)/.test(file);

function modulePath(file, specifier) {
    const value = specifier.startsWith("@/") ? `src/${specifier.slice(2)}`
        : specifier.startsWith(".") ? path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)) : specifier;
    return value.replace(/\.[jt]sx?$/, "");
}

function checkSource(source, file) {
    file = file.replace(/\\/g, "/");
    if (isTest(file)) return [];
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const issues = [];
    const namespaces = new Set();
    const hooks = new Set();
    const colorObjects = new Set();
    const controlled = /^(src\/components\/musicBar\/|src\/components\/panels\/types\/playList\/|src\/components\/mediaItem\/musicItem\.tsx$)/.test(file);
    const report = (node, rule, message) => issues.push({ file, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, rule, message });
    const symbolAllowed = name => RAW_CONSUMERS.has(file) || (file === "src/components/mediaItem/topListItem.tsx" && name === "topListGradients");
    function checkModule(node, specifier) {
        if (modulePath(file, specifier) === "src/constants/colorPalette" && !RAW_CONSUMERS.has(file)) {
            report(node, "raw-palette", "业务组件通过 useColors() 取色，不能直接导入原始色板");
        }
    }
    function colorField(node, field) {
        if (controlled && (field === "success" || field === "danger")) {
            report(node, "state-role", `播放器/歌曲行/队列不使用 ${field}；选中用 active，喜欢用 favorite`);
        }
    }
    function visitImports(node) {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
            if (node.importClause?.isTypeOnly) return;
            const specifier = node.moduleSpecifier.text;
            checkModule(node, specifier);
            const resolved = modulePath(file, specifier);
            const bindings = node.importClause?.namedBindings;
            if (resolved === "src/hooks/useColors" && node.importClause?.name) hooks.add(node.importClause.name.text);
            if (resolved === "src/constants/designSystem" && bindings) {
                if (ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
                if (ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
                    if (binding.isTypeOnly) continue;
                    const name = (binding.propertyName ?? binding.name).text;
                    if (RAW_SYMBOLS.has(name) && !symbolAllowed(name)) report(binding, "brand-control", `装饰色 ${name} 不用于业务控件；使用语义颜色`);
                }
            }
        }
        if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && !node.isTypeOnly) {
            checkModule(node, node.moduleSpecifier.text);
            if (modulePath(file, node.moduleSpecifier.text) === "src/constants/designSystem" && !RAW_CONSUMERS.has(file)) {
                if (!node.exportClause || ts.isNamespaceExport(node.exportClause)) report(node, "brand-control", "业务模块不能整体转发装饰色接口");
                else for (const binding of node.exportClause.elements) {
                    const name = (binding.propertyName ?? binding.name).text;
                    if (RAW_SYMBOLS.has(name)) report(binding, "brand-control", "业务模块不能转发原始品牌色");
                }
            }
        }
        ts.forEachChild(node, visitImports);
    }
    visitImports(sf);
    function visitBindings(node) {
        if (ts.isVariableDeclaration(node) && node.initializer) {
            const fromHook = ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression) && hooks.has(node.initializer.expression.text);
            if (fromHook && ts.isIdentifier(node.name)) colorObjects.add(node.name.text);
            if (fromHook && ts.isObjectBindingPattern(node.name)) for (const binding of node.name.elements) colorField(binding, (binding.propertyName ?? binding.name).getText(sf));
        }
        ts.forEachChild(node, visitBindings);
    }
    visitBindings(sf);
    function visit(node) {
        if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
            const specifier = node.arguments[0].text;
            if (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require")) {
                checkModule(node, specifier);
                if (modulePath(file, specifier) === "src/constants/designSystem" && !RAW_CONSUMERS.has(file)) report(node, "brand-control", "动态导入设计常量会绕过颜色用途检查；改用显式导入");
            }
        }
        if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
            const object = node.expression;
            const field = ts.isPropertyAccessExpression(node) ? node.name.text
                : ts.isStringLiteral(node.argumentExpression) ? node.argumentExpression.text : null;
            if (ts.isIdentifier(object)) {
                if (namespaces.has(object.text) && ((!field && !RAW_CONSUMERS.has(file)) || (field && RAW_SYMBOLS.has(field) && !symbolAllowed(field)))) report(node, "brand-control", "通过命名空间访问装饰色不能替代语义颜色");
                if (field && colorObjects.has(object.text)) colorField(node, field);
            }
        }
        if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer && ts.isIdentifier(node.initializer)) {
            for (const binding of node.name.elements) {
                const field = (binding.propertyName ?? binding.name).getText(sf);
                if (namespaces.has(node.initializer.text) && RAW_SYMBOLS.has(field) && !symbolAllowed(field)) report(binding, "brand-control", "解构装饰色不能替代语义颜色");
                if (colorObjects.has(node.initializer.text)) colorField(binding, field);
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(sf);
    return issues;
}

function checkProject(root) {
    const issues = [];
    function walk(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) walk(fullPath);
            else if (/\.tsx?$/.test(entry.name)) issues.push(...checkSource(fs.readFileSync(fullPath, "utf8"), path.relative(root, fullPath)));
        }
    }
    walk(path.join(root, "src"));
    return issues;
}

module.exports = { checkSource, checkProject };
if (require.main === module) {
    const issues = checkProject(path.resolve(__dirname, ".."));
    for (const issue of issues) console.error(`${issue.file}:${issue.line} [${issue.rule}] ${issue.message}`);
    if (issues.length) process.exitCode = 1;
    else console.log("check-color-semantics: 通过（原始色板入口、装饰色边界、公共播放器/歌曲行/队列状态用途）");
}
