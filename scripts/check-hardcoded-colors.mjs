#!/usr/bin/env node
/**
 * 硬编码颜色检查（issue #36 的防线）。
 *
 * 用法：
 *   node scripts/check-hardcoded-colors.mjs          # 只拦新增
 *   node scripts/check-hardcoded-colors.mjs --update # 重建基线快照
 *   node scripts/check-hardcoded-colors.mjs --all    # 列出全部（含存量）
 *
 * 基线按「颜色字面量 + 归一化代码行」记录，而不是给每个文件一个
 * 可以挪用的颜色数量额度。这样删除注释或旧样式后，不能在其他位置
 * 补上同色新样式而绕过检查。
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(projectRoot, "src");
const baselinePath = join(projectRoot, "scripts", "color-baseline.json");
const BASELINE_VERSION = 2;

const COLOR_PATTERNS = [
    /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g,
    /\b(?:rgba?|hsla?)\((?=[^)\r\n]*\d)[^)\r\n]+\)/gi,
    /(["'`])(?:black|white)\1/gi,
];
const EXEMPT_MARK = "color-exempt";

/** 整文件豁免：这些文件的工作就是定义或挑选颜色 */
const ALLOWED_PATHS = [
    "src/core/theme.ts",
    "src/components/panels/types/colorPicker.tsx",
    "src/native/lyricUtil.ts",
    "src/pages/setting/settingTypes/basicSetting.tsx",
    "src/preview",
    "src/components/base/icon.tsx",
    "src/constants",
];

const ALLOWED_PATTERNS = [
    /\.test\.tsx?$/,
    /\.test\.js$/,
    /[\\/]__tests__[\\/]/,
    /\.d\.ts$/,
];

const args = process.argv.slice(2);
const updateBaseline = args.includes("--update");
const reportAll = args.includes("--all");

function toPosix(value) {
    return value.split(sep).join("/");
}

function isAllowed(relativePath) {
    if (ALLOWED_PATTERNS.some(pattern => pattern.test(relativePath))) {
        return true;
    }

    return ALLOWED_PATHS.some(allowed => {
        const normalized = toPosix(relativePath);
        return (
            normalized === allowed ||
            normalized.startsWith(`${allowed}/`) ||
            normalized.startsWith(`${allowed}.`)
        );
    });
}

function collectFiles(dir, result = []) {
    readdirSync(dir).forEach(entry => {
        const fullPath = join(dir, entry);
        if (statSync(fullPath).isDirectory()) {
            collectFiles(fullPath, result);
            return;
        }
        if (/\.tsx?$/.test(entry)) {
            result.push(fullPath);
        }
    });

    return result;
}

/** 去掉真正的 JS/TS 注释，保留字符串和模板字符串内容。 */
function stripComments(source) {
    let result = "";
    let state = "code";

    for (let index = 0; index < source.length; index += 1) {
        const char = source[index];
        const next = source[index + 1];

        if (state === "line-comment") {
            if (char === "\n") {
                result += char;
                state = "code";
            } else {
                result += " ";
            }
            continue;
        }

        if (state === "block-comment") {
            if (char === "*" && next === "/") {
                result += "  ";
                index += 1;
                state = "code";
            } else {
                result += char === "\n" ? "\n" : " ";
            }
            continue;
        }

        if (state !== "code") {
            result += char;
            if (char === "\\" && next !== undefined) {
                result += next;
                index += 1;
            } else if (
                (state === "single-quote" && char === "'") ||
                (state === "double-quote" && char === "\"") ||
                (state === "template" && char === "`")
            ) {
                state = "code";
            }
            continue;
        }

        if (char === "/" && next === "/") {
            result += "  ";
            index += 1;
            state = "line-comment";
        } else if (char === "/" && next === "*") {
            result += "  ";
            index += 1;
            state = "block-comment";
        } else {
            result += char;
            if (char === "'") {
                state = "single-quote";
            } else if (char === "\"") {
                state = "double-quote";
            } else if (char === "`") {
                state = "template";
            }
        }
    }

    return result;
}

function normalizeLiteral(value) {
    const unquoted = /^["'`].*["'`]$/.test(value)
        ? value.slice(1, -1)
        : value;
    return unquoted.toLowerCase().replace(/\s+/g, "");
}

function normalizeCode(line) {
    return line.trim().replace(/\s+/g, " ");
}

function scanFile(fullPath) {
    const source = readFileSync(fullPath, "utf-8");
    const originalLines = source.split(/\r?\n/);
    const codeLines = stripComments(source).split(/\r?\n/);
    const grouped = new Map();

    codeLines.forEach((line, index) => {
        if (originalLines[index]?.includes(EXEMPT_MARK)) {
            return;
        }

        const code = normalizeCode(line);
        if (!code) {
            return;
        }

        COLOR_PATTERNS.forEach(pattern => {
            for (const match of line.matchAll(pattern)) {
                const literal = normalizeLiteral(match[0]);
                const signature = `${literal}\u0000${code}`;
                const existing = grouped.get(signature);
                if (existing) {
                    existing.count += 1;
                } else {
                    grouped.set(signature, { literal, code, count: 1 });
                }
            }
        });
    });

    return [...grouped.values()].sort((left, right) =>
        left.literal.localeCompare(right.literal) ||
        left.code.localeCompare(right.code),
    );
}

function collectCurrent() {
    const files = {};
    collectFiles(srcDir).forEach(fullPath => {
        const relativePath = toPosix(relative(projectRoot, fullPath));
        if (isAllowed(relativePath)) {
            return;
        }

        const entries = scanFile(fullPath);
        if (entries.length > 0) {
            files[relativePath] = entries;
        }
    });
    return files;
}

function entrySignature(entry) {
    return `${entry.literal}\u0000${entry.code}`;
}

function entryMap(entries = []) {
    return new Map(entries.map(entry => [entrySignature(entry), entry]));
}

function countEntries(files) {
    return Object.values(files).reduce(
        (sum, entries) => sum + entries.reduce((inner, entry) => inner + entry.count, 0),
        0,
    );
}

const current = collectCurrent();
const totalCount = countEntries(current);

if (updateBaseline) {
    const baseline = {
        version: BASELINE_VERSION,
        files: current,
    };
    writeFileSync(
        baselinePath,
        `${JSON.stringify(baseline, null, 4)}\n`,
        "utf-8",
    );
    console.log(
        `check-hardcoded-colors: 已写入基线 ${totalCount} 处 / ${Object.keys(current).length} 个文件`,
    );
    process.exit(0);
}

let baseline;
try {
    baseline = JSON.parse(readFileSync(baselinePath, "utf-8"));
} catch {
    console.error(
        "check-hardcoded-colors: 缺少 scripts/color-baseline.json，先跑 --update 生成",
    );
    process.exit(1);
}

if (baseline.version !== BASELINE_VERSION || !baseline.files) {
    console.error(
        "check-hardcoded-colors: 基线格式已过期，请运行 npm run check:colors:baseline 重建",
    );
    process.exit(1);
}

const regressions = [];
Object.entries(current).forEach(([file, entries]) => {
    const allowedEntries = entryMap(baseline.files[file]);
    entries.forEach(entry => {
        const allowed = allowedEntries.get(entrySignature(entry))?.count ?? 0;
        if (entry.count > allowed) {
            regressions.push({ file, ...entry, allowed });
        }
    });
});

if (regressions.length > 0) {
    console.error(
        `check-hardcoded-colors: 新增了 ${regressions.length} 项硬编码颜色`,
    );
    regressions.forEach(item => {
        console.error(
            `  ${item.file}  ${item.literal} × ${item.count}（基线 ${item.allowed}）`,
        );
        console.error(`    ${item.code}`);
    });
    console.error("");
    console.error(
        "改用 useColors() 的语义 token；确实要写死就在该行加 color-exempt 注释。",
    );
    console.error("存量清理后运行：npm run check:colors:baseline");
    process.exit(1);
}

if (reportAll) {
    console.log(
        `check-hardcoded-colors: 存量 ${totalCount} 处 / ${Object.keys(current).length} 个文件（未超基线）`,
    );
    Object.entries(current).forEach(([file, entries]) => {
        const colors = [...new Set(entries.map(entry => entry.literal))].join(" ");
        console.log(`  ${file}  ${colors}`);
    });
    process.exit(0);
}

console.log(
    `check-hardcoded-colors: 通过（存量 ${totalCount} 处未超基线）`,
);
