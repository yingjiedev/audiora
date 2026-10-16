/* Node CPU benchmark only; this does not measure native UI or network latency. */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const { performance } = require("perf_hooks");

function loadSource(relativePath, dependencies = {}) {
    const filename = path.join(__dirname, "..", relativePath);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const localModule = { exports: {} };
    new Function("require", "module", "exports", source)(name => dependencies[name] ?? require(name), localModule, localModule.exports);
    return localModule.exports;
}

const metadata = loadSource("src/utils/sheetMerge.ts");
let normalized = 0;
const grouping = loadSource("src/utils/trackGroup.ts", { "@/utils/sheetMerge": {
    ...metadata,
    normalizeTrackTitle(title) {
        normalized += 1;
        return metadata.normalizeTrackTitle(title);
    },
} });

function run(sourceCount, pages, pageSize, incremental) {
    const sources = Array.from({ length: sourceCount }, (_, i) => ({ key: String(i), data: [], dataVersion: 1 }));
    const index = new grouping.TrackGroupIndex();
    let groups = [];
    normalized = 0;
    const start = performance.now();
    for (let page = 0; page < pages; page += 1) {
        for (let source = 0; source < sourceCount; source += 1) {
            const additions = Array.from({ length: pageSize }, (_, offset) => {
                const rank = page * pageSize + offset;
                return { platform: String(source), id: String(rank), title: `Song ${rank}`, artist: "Artist", duration: 200 };
            });
            sources[source] = { ...sources[source], data: [...sources[source].data, ...additions] };
            groups = incremental ? index.sync([...sources])
                : grouping.groupTracks(grouping.interleaveTracks(sources.map(item => item.data)), groups);
        }
    }
    if (groups.length !== pages * pageSize || groups.some(group => group.candidates.length !== sourceCount)) {
        throw new Error("Benchmark grouping mismatch");
    }
    return { milliseconds: +(performance.now() - start).toFixed(1), normalizedSongs: normalized };
}

run(3, 2, 20, true);
for (const sourceCount of [12, 24]) {
    const scenario = { sources: sourceCount, pages: 5, pageSize: 80 };
    const regroup = run(sourceCount, 5, 80, false);
    const incremental = run(sourceCount, 5, 80, true);
    console.log(JSON.stringify({ scenario, regroup, incremental, speedup: +(regroup.milliseconds / incremental.milliseconds).toFixed(1) }));
}
