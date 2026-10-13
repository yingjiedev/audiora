/**
 * 源码扫描共享工具。
 *
 * 供 `check-hardcoded-colors.mjs`（issue #36 的防线）与 `check-ui-conventions.mjs`
 * （issue #89 的防线）共用。两条防线都要做同一件容易被写歪的事：
 *
 *   1. 去掉注释但保留字符串内容 —— 判断「代码里有没有写死某个东西」时，
 *      注释里的字样不算，但字符串里的必须算。
 *   2. 解析 `xxx-exempt` 豁免标记覆盖到哪几行。
 *
 * 放在一个模块里是为了避免两份实现各自演化：豁免语义一旦不一致，
 * 两个脚本就会对同一行给出不同结论。
 */
import { readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";

export function toPosix(value) {
    return value.split(sep).join("/");
}

/** 递归收集 .ts/.tsx，结果按路径排序，保证多次运行输出稳定。 */
export function walkSourceFiles(dir, result = []) {
    readdirSync(dir)
        .sort()
        .forEach(entry => {
            const fullPath = join(dir, entry);
            if (statSync(fullPath).isDirectory()) {
                walkSourceFiles(fullPath, result);
                return;
            }
            if (/\.tsx?$/.test(entry)) {
                result.push(fullPath);
            }
        });

    return result;
}

/** 匹配一段字符串字面量（含定界引号），逐行匹配。 */
export const LITERAL_PATTERN = /(["'`])((?:\\.|(?!\1)[^\\\r\n])*?)\1/g;

/**
 * 去掉真正的 JS/TS 注释，保留字符串和模板字符串内容。
 *
 * 逐字符等长替换（注释里的字符换成空格，换行原样保留），
 * 因此返回值与原文的**下标一一对应**，可以拿两个串做逐位比较来定位注释区间。
 */
export function stripComments(source) {
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

/**
 * 把字符串字面量的**内容**抹成空格，定界引号保留，换行保留。
 *
 * 用途：数花括号、找「引号外的中文」时，字符串里的 `{` `}` 和中文都不该参与。
 * 同样是等长替换，下标与原文对齐。
 */
export function stripLiterals(source) {
    let result = "";
    let state = "code";

    for (let index = 0; index < source.length; index += 1) {
        const char = source[index];

        if (state !== "code") {
            if (char === "\\" && index + 1 < source.length) {
                const escaped = source[index + 1];
                result += ` ${escaped === "\n" ? "\n" : " "}`;
                index += 1;
                continue;
            }

            const closes =
                (state === "single-quote" && char === "'") ||
                (state === "double-quote" && char === "\"") ||
                (state === "template" && char === "`");

            result += char === "\n" ? "\n" : closes ? char : " ";
            if (closes) {
                state = "code";
            }
            continue;
        }

        result += char;
        if (char === "'") {
            state = "single-quote";
        } else if (char === "\"") {
            state = "double-quote";
        } else if (char === "`") {
            state = "template";
        }
    }

    return result;
}

/** 每行的起始下标（0-based 行号 → 偏移）。 */
export function lineStarts(source) {
    const starts = [0];
    for (let index = 0; index < source.length; index += 1) {
        if (source[index] === "\n") {
            starts.push(index + 1);
        }
    }
    return starts;
}

/** 给定偏移量，返回它所在的 0-based 行号。 */
export function lineIndexOf(starts, offset) {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (starts[mid] <= offset) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }
    return low;
}

/**
 * 解析豁免标记覆盖的行号集合（0-based）。
 *
 * 两种写法，语义不同：
 *
 * - **行尾注释**：`backgroundColor: "#FFF", // xxx-exempt: 理由`
 *   只豁免本行。适合精确豁免单个字面量，也要求理由写得足够具体。
 * - **独占一行的注释**：豁免到所在花括号块收尾。注释摆在块**内部**
 *   （惯例写法）或紧挨在块**上方**都可以，取更靠近标记的那一种：
 *   标记在块内 → 到该块收尾；标记在块外 → 到紧跟其后那个块的收尾。
 *   适合「这一整块都是同一件事的例外」——例如 badge 的行业约定色、
 *   压在图片上的固定白色圆钮。
 *
 * 之所以要区分：行内写法如果外扩到整个函数，会顺带把同函数里真正的
 * 硬编码一起放行；块级写法如果只认同一行，注释就形同虚设。
 */
export function collectExemptLines(source, mark) {
    const stripped = stripComments(source);
    const codeOnly = stripLiterals(stripped);
    const starts = lineStarts(source);
    const exempt = new Set();

    /** 标记处已经进了几层花括号（在抹掉字面量的代码上数）。 */
    function depthBefore(offset) {
        let depth = 0;
        for (let index = 0; index < offset; index += 1) {
            const char = codeOnly[index];
            if (char === "{") {
                depth += 1;
            } else if (char === "}") {
                depth -= 1;
            }
        }
        return depth;
    }

    /** 标记在块内：找到把它带回上一层的那一收尾。 */
    function enclosingBlockEnd(offset, depth) {
        let current = depth;
        for (let index = offset; index < codeOnly.length; index += 1) {
            const char = codeOnly[index];
            if (char === "{") {
                current += 1;
            } else if (char === "}") {
                current -= 1;
                if (current < depth) {
                    return index;
                }
            }
        }
        return -1;
    }

    /** 标记在块外：找到紧跟其后那个块的范围。 */
    function followingBlockEnd(offset) {
        const openAt = codeOnly.indexOf("{", offset);
        if (openAt < 0) {
            return -1;
        }
        // 从 `{` 之后接着数，并把基准深度抬一层，这样收尾时才会落回基准。
        return enclosingBlockEnd(openAt + 1, depthBefore(openAt) + 1);
    }

    let cursor = 0;
    while (cursor < source.length) {
        const at = source.indexOf(mark, cursor);
        if (at < 0) {
            break;
        }
        cursor = at + mark.length;

        // 标记出现在字符串或普通代码里都不算豁免，必须在注释里：
        // stripComments 会把注释内容换成空格，所以这里应当对不上。
        if (stripped.startsWith(mark, at)) {
            continue;
        }

        const markLine = lineIndexOf(starts, at);
        const lineStart = starts[markLine];

        let commentStart = at;
        for (let index = lineStart; index <= at; index += 1) {
            if (source[index] !== stripped[index]) {
                commentStart = index;
                break;
            }
        }

        const isTrailing = stripped.slice(lineStart, commentStart).trim().length > 0;
        if (isTrailing) {
            exempt.add(markLine);
            continue;
        }

        const depth = depthBefore(at);
        const closeAt =
            depth > 0 ? enclosingBlockEnd(at, depth) : followingBlockEnd(at);
        const endLine = closeAt < 0 ? markLine : lineIndexOf(starts, closeAt);
        for (let line = markLine; line <= endLine; line += 1) {
            exempt.add(line);
        }
    }

    return exempt;
}
