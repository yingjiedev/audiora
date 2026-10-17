import { classifySearchError, SearchRequestError } from "./searchError";

it.each([
    [{ code: "ETIMEDOUT" }, "timeout", true],
    [{ message: "Network Error" }, "network", true],
    [{ response: { status: 403 } }, "authentication", false],
    [{ response: { status: 404 } }, "unavailable", false],
    [{ response: { status: 429 } }, "rateLimited", true],
    [{ response: { status: 503 } }, "unavailable", true],
    [new TypeError("Cannot read property of null"), "plugin", false],
    [new SearchRequestError({ kind: "configuration", retryable: false }), "configuration", false],
    [null, "plugin", false],
])("classifies source errors without exposing raw payloads: %p", (error, kind, retryable) => {
    expect(classifySearchError(error)).toMatchObject({ kind, retryable });
});

it("discards sensitive request data and untrusted error text", () => {
    const error = { message: "token=private&password=secret", code: "private-secret", response: { status: 401, data: "secret" }, config: { headers: { Authorization: "secret" } } };
    expect(classifySearchError(error)).toEqual({ kind: "authentication", retryable: false, status: 401 });
});
