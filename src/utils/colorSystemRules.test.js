const { checkSource, checkProject } = require("../../scripts/check-color-semantics");
const path = require("path");

const dock = "src/components/musicBar/playerDock.tsx";
const page = "src/pages/example/index.tsx";

describe("color system boundaries", () => {
    it.each([
        "import { audioraGradient as tint } from '@/constants/designSystem';",
        "import * as ds from '@/constants/designSystem'; const tint = ds['audioraGradient'];",
        "import * as ds from '@/constants/designSystem'; const {audioraGradient: tint} = ds;",
        "export { audioraGradient as tint } from '@/constants/designSystem';",
        "const palette = require('@/constants/colorPalette');",
        "const palette = import('@/constants/colorPalette');",
        "import { lightColors } from '../../constants/colorPalette';",
    ])("rejects primitive/brand access even when renamed: %s", source => {
        expect(checkSource(source, dock).length).toBeGreaterThan(0);
    });

    it.each([
        "const color = c.success;",
        "const color = c['danger'];",
        "const {success: color} = c;",
    ])("rejects status colors in the migrated playback components: %s", source => {
        const code = `import getColors from '@/hooks/useColors'; const c = getColors(); ${source}`;
        expect(checkSource(code, dock).map(issue => issue.rule)).toContain("state-role");
    });

    it("handles direct hook destructuring and ignores comments/string contents", () => {
        expect(checkSource("import useColors from '@/hooks/useColors'; const {success: active} = useColors();", dock)).toHaveLength(1);
        expect(checkSource("// colors.success\nconst label = 'audioraGradient colors.danger';", dock)).toHaveLength(0);
    });

    it("allows geometry, semantic colors, theme resolution, and the explicit chart decoration", () => {
        expect(checkSource("import { spacing, radius } from '@/constants/designSystem'; import useColors from '@/hooks/useColors'; const c=useColors(); const active=c.active; const heart=c.favorite;", dock)).toHaveLength(0);
        expect(checkSource("import { lightColors } from '@/constants/colorPalette';", "src/core/theme.ts")).toHaveLength(0);
        expect(checkSource("import { topListGradients } from '@/constants/designSystem';", "src/components/mediaItem/topListItem.tsx")).toHaveLength(0);
        expect(checkSource("import useColors from '@/hooks/useColors'; const c=useColors(); const status=c.success;", page)).toHaveLength(0);
    });

    it("keeps test fixtures out of production rules and scans the actual project", () => {
        expect(checkSource("import { lightColors } from '@/constants/colorPalette';", "src/utils/themeColors.test.ts")).toHaveLength(0);
        expect(checkProject(path.resolve(__dirname, "../.."))).toEqual([]);
    });
});
