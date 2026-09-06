const path = require("path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const configPath = path.join(projectRoot, "tsconfig.json");
const config = ts.readConfigFile(configPath, ts.sys.readFile);

if (config.error) {
    console.error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
    process.exit(1);
}

const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    projectRoot,
    { noEmit: true },
    configPath,
);
// Keep this check focused on runtime references. The full project type check
// has existing non-runtime errors, so it cannot be used as a release gate yet.
const compilerOptions = {
    ...parsed.options,
    noEmit: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactNative,
    allowJs: true,
    allowImportingTsExtensions: true,
    allowArbitraryExtensions: true,
    resolveJsonModule: true,
    skipLibCheck: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    baseUrl: projectRoot,
    paths: config.config.compilerOptions?.paths ?? {},
    types: config.config.compilerOptions?.types ?? [],
};
const program = ts.createProgram(parsed.fileNames, compilerOptions);
const runtimeFindings = ts
    .getPreEmitDiagnostics(program)
    .filter(diagnostic => diagnostic.code === 2304 || diagnostic.code === 2552)
    .filter(diagnostic => {
        const fileName = diagnostic.file?.fileName ?? "";
        const relativePath = path.relative(projectRoot, fileName);
        return (
            relativePath.startsWith(`src${path.sep}`) &&
            !relativePath.endsWith(".d.ts") &&
            !relativePath.includes(".test.") &&
            !relativePath.includes(`${path.sep}__tests__${path.sep}`)
        );
    });

if (runtimeFindings.length === 0) {
    console.log("Runtime reference check passed.");
    process.exit(0);
}

console.error("Undefined runtime references found:");
for (const diagnostic of runtimeFindings) {
    const file = diagnostic.file;
    const position = file?.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    const relativePath = path.relative(projectRoot, file?.fileName ?? "unknown");
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
    console.error(
        `${relativePath}:${(position?.line ?? 0) + 1}:${
            (position?.character ?? 0) + 1
        } TS${diagnostic.code}: ${message}`,
    );
}
process.exit(1);
