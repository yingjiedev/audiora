const mockListeners: Record<string, () => Promise<void>> = {};
const mockPush = jest.fn(async (..._args: unknown[]) => {});
let mockSubscription: () => void;
let mockFavorite = true;
const mockToggle = jest.fn();
const mockTrack = { currentMusic: { id: "1", platform: "A" } };
jest.mock("react-native", () => ({ DeviceEventEmitter: { addListener: (key, listener) => {
    mockListeners[key] = listener;
} }, NativeModules: { LyricUtil: { setCompactNotificationFavorite: (...args) => mockPush(...args) } } }));
jest.mock("react-native-track-player", () => ({ __esModule: true, default: { addEventListener: jest.fn() }, Event: {}, State: {} }));
jest.mock("@/core/musicSheet", () => ({ __esModule: true, default: {
    favorites: { isFavorite: () => mockFavorite, toggle: (...args) => mockToggle(...args) },
    subscribeFavorites: callback => {
        mockSubscription = callback;
    },
} }));
jest.mock("@/core/trackPlayer", () => ({ __esModule: true, default: mockTrack }));
jest.mock("@/core/appConfig", () => ({ __esModule: true, default: { getConfig: jest.fn() } }));
jest.mock("@/core/i18n", () => ({ __esModule: true, default: { t: key => key } }));
jest.mock("@/utils/toast", () => ({ __esModule: true, default: { success: jest.fn(), warn: jest.fn() } }));
jest.mock("@/utils/trackUtils", () => ({ musicIsPaused: () => false }));
jest.mock("@/utils/persistStatus", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("./listeningStatsRecorder", () => ({ setupListeningStatsRecorder: jest.fn() }));
jest.mock("./androidAuto", () => ({ setupAndroidAutoService: jest.fn() }));
const service = require("./index");

describe("native favorite action synchronization", () => {
    beforeEach(async () => {
        jest.clearAllMocks(); mockFavorite = true; await service();
    });
    it("waits for the shared mutation before pushing the resulting native heart state", async () => {
        let complete!: () => void;
        mockToggle.mockImplementationOnce(() => new Promise<boolean>(resolve => {
            complete = () => {
                mockFavorite = false; resolve(false);
            };
        }));
        const pending = mockListeners["remote-favorite"]();
        expect(mockPush).not.toHaveBeenCalled();
        complete(); await pending;
        expect(mockToggle).toHaveBeenCalledWith(mockTrack.currentMusic);
        expect(mockPush).toHaveBeenCalledWith(false);
    });
    it("also updates native state after a favorite change made in the app", () => {
        mockFavorite = false; mockSubscription();
        expect(mockPush).toHaveBeenCalledWith(false);
    });
    it("keeps the actual stored state when an update fails", async () => {
        mockToggle.mockRejectedValueOnce(new Error("disk"));
        await mockListeners["remote-favorite"]();
        expect(mockPush).toHaveBeenCalledWith(true);
    });
});
