import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { RequestStateCode } from "@/constants/commonConst";
import ResultWrapper from "./resultWrapper";

const mockSearch = jest.fn();
jest.mock("@/utils/motion", () => ({ motionDuration: () => 0, motionEasing: {} }));
jest.mock("../../hooks/useSearch", () => () => mockSearch);
jest.mock("jotai", () => ({ useAtomValue: () => "query" }));
jest.mock("../../store/atoms", () => ({ queryAtom: {} }));
jest.mock("@/hooks/useMediaGrid", () => () => 2);
jest.mock("@shopify/flash-list", () => ({ FlashList: "MockList" }));
jest.mock("@/components/base/loading", () => "MockLoading");
jest.mock("@/components/base/listEmpty", () => "MockEmpty");
jest.mock("@/components/base/listFooter", () => "MockFooter");
jest.mock("./results", () => ({ renderMap: { music: () => null } }));
jest.mock("./sourceFeedback", () => ({ SourceIssue: "MockSourceIssue" }));
jest.mock("@/core/router", () => ({ useNavigate: () => jest.fn() }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));

it("leaves the loading state when new search results arrive and updates retry/pagination state", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    const props = {
        tab: "music" as const,
        pluginHash: "source",
        pluginName: "Source",
        pluginSearchResultRef: { current: {} } as any,
    };
    const result = { data: [], state: RequestStateCode.PENDING_FIRST_PAGE } as any;
    act(() => {
        renderer = TestRenderer.create(<ResultWrapper {...props} searchResult={result} />);
    });
    expect(renderer.root.findAllByType("MockLoading" as any)).toHaveLength(1);

    const songs = [{ id: "song", platform: "source" }];
    act(() => {
        renderer.update(<ResultWrapper {...props} searchResult={{ ...result, data: songs, state: RequestStateCode.PARTLY_DONE }} />);
    });
    expect(renderer.root.findAllByType("MockLoading" as any)).toHaveLength(0);
    let list = renderer.root.findByType("MockList" as any);
    expect(list.props.data).toBe(songs);
    act(() => list.props.onEndReached());
    expect(mockSearch).toHaveBeenCalledWith(undefined, undefined, "music", "source", "next");

    mockSearch.mockClear();
    act(() => {
        renderer.update(<ResultWrapper {...props} searchResult={{ ...result, data: songs, state: RequestStateCode.ERROR }} />);
    });
    list = renderer.root.findByType("MockList" as any);
    expect(list.props.ListFooterComponent.type).toBe("MockSourceIssue");
    expect(list.props.ListFooterComponent.props.result.state).toBe(RequestStateCode.ERROR);
    expect(list.props.data).toBe(songs);
    act(() => list.props.onEndReached());
    expect(mockSearch).not.toHaveBeenCalled();
    act(() => renderer.unmount());
});
