import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Color from "color";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = process.argv[2];
if (!output) throw new Error("Usage: node scripts/generate-widget-resources.mjs <resource-directory>");
const source = fs.readFileSync(path.join(root, "src/constants/colorPalette.ts"), "utf8");
function constant(name) {
    const color = source.match(new RegExp(`export const ${name} = "(#[0-9A-Fa-f]{6})"`))?.[1];
    if (!color) throw new Error(`Missing ${name}`);
    return color;
}
function write(relative, content) {
    const target = path.join(output, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
}
const luminance = value => Color(value).rgb().array().map(channel => channel / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (first, second) => (Math.max(luminance(first), luminance(second)) + 0.05) / (Math.min(luminance(first), luminance(second)) + 0.05);
const colorResources = [];
for (const mode of ["light", "dark"]) {
    const palette = source.match(new RegExp(`export const ${mode}Colors = \\{([\\s\\S]*?)\\n\\};`))?.[1];
    if (!palette) throw new Error(`Missing ${mode} palette`);
    const colors = {};
    for (const [name, token] of Object.entries({ surface: "card", text: "text", secondary: "textSecondary", primary: "primary" })) {
        colors[name] = palette.match(new RegExp(`\\b${token}: "(#[0-9A-Fa-f]{6})"`))?.[1];
        if (!colors[name]) throw new Error(`Missing ${mode}.${token}`);
    }
    const candidates = [constant("mediaOnDark"), source.match(/export const lightColors = \{[\s\S]*?text: "([^"]+)"/)[1], constant("controlNeutralDark")];
    colors.on_primary = contrast(candidates[0], colors.primary) >= 3 ? candidates[0]
        : [...candidates].sort((a, b) => contrast(b, colors.primary) - contrast(a, colors.primary))[0];
    const lightPrimary = source.match(/export const lightColors = \{[\s\S]*?primary: "([^"]+)"/)[1];
    colors.discovery_surface = mode === "dark" ? colors.surface : Color(lightPrimary).mix(Color(constant("mediaScrim")), 0.44).hex();
    colors.on_discovery = constant("mediaOnDark");
    colors.divider = Color(colors.text).mix(Color(colors.surface), 0.85).hex();
    for (const [name, color] of Object.entries(colors)) colorResources.push(`    <color name="widget_${mode}_${name}">${color}</color>`);
    for (const [name, shape, token, corners] of [
        ["background", "rectangle", "surface", '<corners android:radius="28dp" />'],
        ["play_background", "oval", "primary", ""],
        ["divider", "rectangle", "divider", ""],
    ]) {
        write(`drawable/widget_${mode}_${name}.xml`, `<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="${shape}"><solid android:color="@color/widget_${mode}_${token}" />${corners}</shape>\n`);
    }
    for (const [name, asset] of Object.entries({ play: "play", pause: "pause", previous: "skip-left", next: "skip-right" })) {
        const svg = fs.readFileSync(path.join(root, `src/assets/icons/${asset}.svg`), "utf8");
        const paths = [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*\/?\s*>/g)];
        if (!paths.length) throw new Error(`Missing SVG path in ${asset}`);
        const token = name === "play" || name === "pause" ? "on_primary" : "secondary";
        write(`drawable/widget_${mode}_${name}.xml`, `<!-- Generated from ${asset}.svg. -->\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">\n${paths.map(match => `    <path android:fillColor="@color/widget_${mode}_${token}" android:fillType="${match[0].includes('fill-rule="evenodd"') ? "evenOdd" : "nonZero"}" android:pathData="${match[1]}" />`).join("\n")}\n</vector>\n`);
    }
}
write("values/widget_colors.xml", `<!-- Generated from colorPalette.ts. Both picker appearances are independent of system night mode. -->\n<resources>\n${colorResources.join("\n")}\n</resources>\n`);
for (const name of ["music_widget", "music_widget_compact"]) {
    const layout = fs.readFileSync(path.join(root, `android/app/src/main/res/layout/${name}.xml`), "utf8");
    write(`layout/${name}_dark.xml`, `<!-- Generated from the shared light layout. -->\n${layout.replaceAll("widget_light_", "widget_dark_")}`);
}
for (const [name, asset] of Object.entries({ light_art: "widget-cloud-light-v1.png", dark_art: "widget-cloud-dark-v1.png", album_default: "album-default.png" })) {
    const target = path.join(output, `drawable-nodpi/widget_${name}.png`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, "src/assets/imgs", asset), target);
}
// Remove only obsolete files from this generator's previous resource schema.
for (const relative of ["values-night/widget_colors.xml", "drawable-nodpi/widget_discovery_art.png", ...["play", "pause", "previous", "next"].map(name => `drawable/widget_${name}.xml`)]) {
    const target = path.join(output, relative);
    if (fs.existsSync(target)) fs.unlinkSync(target);
}
