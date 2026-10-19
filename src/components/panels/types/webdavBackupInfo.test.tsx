import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Button } from "@/components/base/button";
import { hidePanel } from "../usePanel";
import WebdavBackupInfo from "./webdavBackupInfo";

let mockStatus: any;

jest.mock("../base/panelBase", () => ({ renderBody }: { renderBody: () => React.ReactNode }) => renderBody());
jest.mock("../base/panelHeader", () => "PanelHeader");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/button", () => ({ Button: "Button" }));
jest.mock("../usePanel", () => ({ hidePanel: jest.fn() }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string, args?: { time: string }) => args ? `${key}:${args.time}` : key }) }));
jest.mock("@/core/webdavBackup", () => ({ getWebdavBackupStatus: () => mockStatus }));
jest.mock("@/utils/persistStatus", () => ({ __esModule: true, default: { useValue: jest.fn() } }));
jest.mock("@/utils/rpx", () => ({ __esModule: true, default: (value: number) => value, vh: (value: number) => value }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ bottom: 20 }) }));

describe("WebDAV backup information panel", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    afterEach(() => act(() => renderer.unmount()));

    it("shows failure details only when requested and removes a resolved failure while open", () => {
        mockStatus = { lastAttemptAt: 1_790_001_000_000, result: "failed" };
        act(() => {
            renderer = TestRenderer.create(<WebdavBackupInfo />);
        });
        expect(JSON.stringify(renderer.toJSON())).not.toContain("backupAndResume.webdavBackupFailed:");

        act(() => renderer.update(<WebdavBackupInfo showFailure />));
        expect(JSON.stringify(renderer.toJSON())).toContain("backupAndResume.webdavBackupFailed:");

        mockStatus = { ...mockStatus, result: "success" };
        act(() => renderer.update(<WebdavBackupInfo showFailure />));
        expect(JSON.stringify(renderer.toJSON())).not.toContain("backupAndResume.webdavBackupFailed:");
        expect(JSON.stringify(renderer.toJSON())).toContain("backupAndResume.webdavAutoDescription");
        expect(JSON.stringify(renderer.toJSON())).toContain("backupAndResume.webdavBackupContents");
    });

    it("can be dismissed with the confirmation button without an existing backup", () => {
        mockStatus = null;
        act(() => {
            renderer = TestRenderer.create(<WebdavBackupInfo showFailure />);
        });
        act(() => renderer.root.findByType(Button).props.onPress());
        expect(hidePanel).toHaveBeenCalledTimes(1);
    });
});
