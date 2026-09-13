#!/usr/bin/env node
/**
 * 硬编码颜色检查（issue #36 的防线）。
 *
 * 组件里直接写 hex 色值是深色模式破窗的根源：浅色下看着正常，深色下就可能
 * 变成一块浅底或一行深色字。这个脚本把「不许新增写死的颜色」变成可执行约束。
 *
 * 用法：
 *   node scripts/check-hardcoded-colors.mjs              # 只拦新增
 *   node scripts/check-hardcoded-colors.mjs --update      # 重建基线快照
 *   node scripts/check-hardcoded-colors.mjs --all         # 列出全部（含存量）
 *
 * 为什么要有基线：仓库里已有的一批设计稿固定值（品牌色、行业约定色、浅色
 * 分支保留值）不可能一次清完。用基线锁住存量，保证「只减不增」，清理进度靠
 * 重新生成基线来推进。
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(projectRoot, "src");
const baselinePath = join(projectRoot, "scripts", "color-baseline.json");

/** #RGB / #RGBA / #RRGGBB / #RRGGBBAA */
const HEX_PATTERN =
    /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
/** 行内豁免标记：确实必须写死的行加这个注释并说明原因 */
const EXEMPT_MARK = "color-exempt";

/** 整文件豁免：这些文件的工作就是定义或挑选颜色 */
const ALLOWED_PATHS = [
    // 主题色板本身
    "src/core/theme.ts",
    // 调色板 UI / 取色器
    "src/components/panels/types/colorPicker.tsx",
    // 歌词配色预设
    "src/native/lyricUtil.ts",
    "src/pages/setting/settingTypes/basicSetting.tsx",
    // web 预览，不进 app 渲染路径
    "src/preview",
    // 图标映射（自动生成）
    "src/components/base/icon.tsx",
    // 设计常量
    "src/constants",
];

/** 按路径模式豁免 */
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

/** 当前扫描结果：{ "src/foo.tsx": { "#FFFFFF": 2, ... } } */
const current = {};

collectFiles(srcDir).forEach(fullPath => {
    const relativePath = toPosix(relative(projectRoot, fullPath));
    if (isAllowed(relativePath)) {
        return;
    }

    const counter = {};
    readFileSync(fullPath, "utf-8").split(/\r?\n/).forEach(line => {
        if (line.includes(EXEMPT_MARK)) {
            return;
        }
        const matches = line.match(HEX_PATTERN);
        if (!matches) {
            return;
        }
        matches.forEach(color => {
            const key = color.toLowerCase();
            counter[key] = (counter[key] ?? 0) + 1;
        });
    });

    if (Object.keys(counter).length > 0) {
        current[relativePath] = counter;
    }
});

if (updateBaseline) {
    writeFileSync(
        baselinePath,
        `${JSON.stringify(current, null, 4)}\n`,
        "utf-8",
    );
    const total = Object.values(current).reduce(
        (sum, counter) =>
            sum + Object.values(counter).reduce((inner, n) => inner + n, 0),
        0,
    );
    console.log(
        `check-hardcoded-colors: 已写入基线 ${total} 处 / ${Object.keys(current).length} 个文件`,
    );
    process.exit(0);
}

let baseline = {};
try {
    baseline = JSON.parse(readFileSync(baselinePath, "utf-8"));
} catch {
    console.error(
        "check-hardcoded-colors: 缺少 scripts/color-baseline.json，先跑 --update 生成",
    );
    process.exit(1);
}

const regressions = [];
let totalCount = 0;

Object.keys(current).forEach(file => {
    const counter = current[file];
    const allowed = baseline[file] ?? {};

    Object.keys(counter).forEach(color => {
        totalCount += counter[color];
        const allowedCount = allowed[color] ?? 0;
        if (counter[color] > allowedCount) {
            regressions.push({
                file,
                color,
                count: counter[color],
                allowed: allowedCount,
            });
        }
    });
});

if (regressions.length > 0) {
    console.error(
        `check-hardcoded-colors: 新增了 ${regressions.length} 项硬编码颜色`,
    );
    regressions.forEach(item => {
        console.error(
            `  ${item.file}  ${item.color} × ${item.count}（基线 ${item.allowed}）`,
        );
    });
    console.error("");
    console.error(
        "改用 useColors() 的语义 token；确实要写死就在该行加 color-exempt 注释。",
    );
    console.error("存量清理后运行：node scripts/check-hardcoded-colors.mjs --update");
    process.exit(1);
}

if (reportAll) {
    console.log(
        `check-hardcoded-colors: 存量 ${totalCount} 处 / ${Object.keys(current).length} 个文件（未超基线）`,
    );
    Object.keys(current).forEach(file => {
        const colors = Object.keys(current[file]).join(" ");
        console.log(`  ${file}  ${colors}`);
    });
    process.exit(0);
}

console.log(
    `check-hardcoded-colors: 通过（存量 ${totalCount} 处未超基线）`,
);
