import { missingSearchConfiguration } from "./searchConfiguration";

it("does not assume that legacy user variables are required", () => {
    expect(missingSearchConfiguration({ platform: "Optional", userVariables: [{ key: "cookie" }] }, {})).toBe(false);
});

it("honors explicit required declarations and ignores optional fields", () => {
    const instance = { platform: "Source", userVariables: [{ key: "url", required: true }, { key: "cookie" }] };
    expect(missingSearchConfiguration(instance, { url: "  " })).toBe(true);
    expect(missingSearchConfiguration(instance, { url: "https://example.test" })).toBe(false);
});

it("preflights the old Navidrome plugin's required server and credentials", () => {
    const instance = { platform: "Navidrome", userVariables: ["url", "username", "password"].map(key => ({ key })) };
    expect(missingSearchConfiguration(instance, { url: "https://example.test", username: "user" })).toBe(true);
    expect(missingSearchConfiguration(instance, { url: "https://example.test", username: "user", password: "password" })).toBe(false);
});
