#!/usr/bin/env node
/**
 * 设置 / 面板的 UI 约定检查（issue #89 的防线）。
 *
 * 用法：
 *   node scripts/check-ui-conventions.mjs          # 只拦新增
 *   node scripts/check-ui-conventions.mjs --update # 重建基线快照
 *   node scripts/check-ui-conventions.mjs --all    # 列出全部（含存量）
 *
 * 盯三件事，都是「同一个 App」这件事上最容易重新长歪的地方：
 *
 *   1. emoji 当图标用 —— 设置流里的图标一律走 `Icon`（`IIconName`），
 *      emoji 在不同 ROM、不同字号下渲染不一致，也不跟主题色。
 *   2. 字符串字面量里的中文 —— 一律走 `i18n.t()`，否则切到 en-us 会漏出中文。
 *   3. 引号外的中文（JSX 文本） —— 同上，`<Text>确定</Text>` 也要走 t()。
 *
 * 基线按「规则 + 内容 + 归一化代码行」记录，与 `check-hardcoded-colors.mjs`
 * 同构：不给文件留可以挪用的额度，删掉旧文案后不能换个位置补上同类问题。
 *
 * 豁免走 `ui-exempt` 注释，语义见 `scripts/lib/sourceScan.mjs`。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
    collectExemptLines,
    LITERAL_PATTERN,
    stripComments,
    stripLiterals,
    toPosix,
    walkSourceFiles,
} from "./lib/sourceScan.mjs";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = join(projectRoot, "scripts", "ui-baseline.json");
const BASELINE_VERSION = 1;
const EXEMPT_MARK = "ui-exempt";

/**
 * 检查范围刻意只覆盖设置流与面板。
 *
 * 全仓开火会让 60 多个尚未迁移的文件一次性变红，防线第一天就被人 `--update` 掉。
 * 随着 #36 PR4 逐页迁移，再往这里加目录。
 */
const TARGET_DIRS = ["src/components/panels", "src/pages/setting"];

const ALLOWED_PATTERNS = [
    /\.test\.tsx?$/,
    /\.test\.js$/,
    /[\\/]__tests__[\\/]/,
    /\.d\.ts$/,
];

const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;
const CJK_PATTERN = /[\u4e00-\u9fa5]/;

const RULE_LABEL = {
    emoji: "emoji 图标",
    "cjk-literal": "硬编码中文（字符串）",
    "cjk-text": "硬编码中文（JSX 文本）",
};

const args = process.argv.slice(2);
const updateBaseline = args.includes("--update");
const reportAll = args.includes("--all");

function isAllowed(relativePath) {
    return ALLOWED_PATTERNS.some(pattern => pattern.test(relativePath));
}

function normalizeCode(line) {
    return line.trim().replace(/\s+/g, " ");
}

function collectCurrent() {
    const files = {};

    TARGET_DIRS.forEach(dir => {
        walkSourceFiles(join(projectRoot, dir)).forEach(fullPath => {
            const relativePath = toPosix(relative(projectRoot, fullPath));
            if (isAllowed(relativePath)) {
                return;
            }

            const entries = scanFile(fullPath);
            if (entries.length > 0) {
                files[relativePath] = entries;
            }
        });
    });

    return files;
}

function scanFile(fullPath) {
    const source = readFileSync(fullPath, "utf-8");
    const stripped = stripComments(source);
    const strippedLines = stripped.split(/\r?\n/);
    const codeOnlyLines = stripLiterals(stripped).split(/\r?\n/);
    const exemptLines = collectExemptLines(source, EXEMPT_MARK);
    const grouped = new Map();

    function push(rule, text, line, index) {
        if (exemptLines.has(index)) {
            return;
        }
        const code = normalizeCode(line);
        if (!code) {
            return;
        }
        const signature = `${rule}\u0000${text}\u0000${code}`;
        const existing = grouped.get(signature);
        if (existing) {
            existing.count += 1;
        } else {
            grouped.set(signature, { rule, text, code, count: 1, line: index + 1 });
        }
    }

    strippedLines.forEach((line, index) => {
        // emoji：在去注释后的源码上找，注释里写 emoji 不该失败。
        for (const match of line.matchAll(EMOJI_PATTERN)) {
            push("emoji", match[0], line, index);
        }

        // 引号内的中文。
        for (const match of line.matchAll(LITERAL_PATTERN)) {
            if (CJK_PATTERN.test(match[2])) {
                push("cjk-literal", match[0].replace(/\s+/g, " ").trim(), line, index);
            }
        }

        // 引号外的中文：JSX 文本节点、被漏掉的裸文案。
        const codeOnly = codeOnlyLines[index] ?? "";
        if (CJK_PATTERN.test(codeOnly)) {
            push("cjk-text", normalizeCode(codeOnly), line, index);
        }
    });

    return [...grouped.values()].sort((left, right) =>
        left.rule.localeCompare(right.rule) ||
        left.text.localeCompare(right.text) ||
        left.code.localeCompare(right.code),
    );
}

function entrySignature(entry) {
    return `${entry.rule}\u0000${entry.text}\u0000${entry.code}`;
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

function toBaselineShape(files) {
    return Object.fromEntries(
        Object.entries(files).map(([file, entries]) => [
            file,
            entries.map(({ rule, text, code, count }) => ({ rule, text, code, count })),
        ]),
    );
}

const current = collectCurrent();
const totalCount = countEntries(current);

if (updateBaseline) {
    writeFileSync(
        baselinePath,
        `${JSON.stringify(
            { version: BASELINE_VERSION, files: toBaselineShape(current) },
            null,
            4,
        )}\n`,
        "utf-8",
    );
    console.log(
        `check-ui-conventions: 已写入基线 ${totalCount} 处 / ${Object.keys(current).length} 个文件`,
    );
    process.exit(0);
}

let baseline;
try {
    baseline = JSON.parse(readFileSync(baselinePath, "utf-8"));
} catch {
    console.error(
        "check-ui-conventions: 缺少 scripts/ui-baseline.json，先跑 --update 生成",
    );
    process.exit(1);
}

if (baseline.version !== BASELINE_VERSION || !baseline.files) {
    console.error(
        "check-ui-conventions: 基线格式已过期，请运行 npm run check:ui:baseline 重建",
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
    console.error(`check-ui-conventions: 新增了 ${regressions.length} 项 UI 约定违规`);
    regressions.forEach(item => {
        console.error(
            `  ${item.file}:${item.line}  [${RULE_LABEL[item.rule] ?? item.rule}] ${item.text} × ${item.count}（基线 ${item.allowed}）`,
        );
        console.error(`    ${item.code}`);
    });
    console.error("");
    console.error("图标改用 Icon（IIconName）；文案改用 i18n.t()；");
    console.error("确实不该迁移（品牌名、日志前缀等）就在该行加 ui-exempt 注释说明理由。");
    console.error("存量清理后运行：npm run check:ui:baseline");
    process.exit(1);
}

// 与颜色检查同样的口径：基线是待还债清单，除了「不许变多」，还要能看出「还了多少」。
const baselineTotal = countEntries(baseline.files);
const removedCount = baselineTotal - totalCount;
const deltaText =
    removedCount > 0
        ? `已减少 ${removedCount} 处`
        : removedCount === 0
          ? "与基线持平"
          : `较基线增加 ${-removedCount} 处`;

if (reportAll) {
    console.log(
        `check-ui-conventions: 存量 ${totalCount} 处 / ${Object.keys(current).length} 个文件（基线 ${baselineTotal} 处，${deltaText}）`,
    );
    const byRule = new Map();
    Object.entries(current).forEach(([file, entries]) => {
        entries.forEach(entry => {
            const bucket = byRule.get(entry.rule) ?? [];
            bucket.push(`${file}:${entry.line}  ${entry.text}`);
            byRule.set(entry.rule, bucket);
        });
    });
    for (const [rule, items] of byRule) {
        console.log(`  [${RULE_LABEL[rule] ?? rule}] ${items.length} 项`);
        items.forEach(item => console.log(`    ${item}`));
    }
    process.exit(0);
}

console.log(
    `check-ui-conventions: 通过（存量 ${totalCount} 处，基线 ${baselineTotal} 处，${deltaText}）`,
);
