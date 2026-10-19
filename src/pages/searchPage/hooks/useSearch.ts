import { useCallback } from "react";
import { useParams } from "@/core/router";
import { SearchOperation } from "@/core/aggregateSearch";
import { runSearch } from "../store/searchController";

export default function useSearch() {
    const params = useParams<"search-page">();
    const sourceHash = params?.pluginHash;
    return useCallback((
        query?: string,
        page?: number,
        type?: ICommon.SupportMediaType,
        pluginHash?: string,
        operation?: SearchOperation,
    ) => runSearch(query, page, type, pluginHash, sourceHash, operation), [sourceHash]);
}
