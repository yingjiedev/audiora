import { NativeEventEmitter, NativeModules } from "react-native";

export interface SourceRuntimeTransport {
    create(id: string, bootstrap: string, script: string): Promise<void>;
    post(id: string, payload: string): void;
    destroy(id: string): Promise<void>;
    subscribe(id: string, listener: (payload: string) => void): () => void;
}

interface NativeRuntimeModule {
    create(id: string, bootstrap: string, script: string): Promise<void>;
    post(id: string, payload: string): void;
    destroy(id: string): Promise<void>;
    addListener(event: string): void;
    removeListeners(count: number): void;
}

function getNativeModule(): NativeRuntimeModule {
    const module = NativeModules.ScriptSourceRuntime as NativeRuntimeModule | undefined;
    if (!module) {
        throw new Error("当前安装版本尚未包含自定义音源运行组件，请更新应用");
    }
    return module;
}

const transport: SourceRuntimeTransport = {
    create: (id, bootstrap, script) => getNativeModule().create(id, bootstrap, script),
    post: (id, payload) => getNativeModule().post(id, payload),
    destroy: id => getNativeModule().destroy(id),
    subscribe(id, listener) {
        const emitter = new NativeEventEmitter(getNativeModule());
        const subscription = emitter.addListener("ScriptSourceRuntimeEvent", event => {
            if (event?.id === id && typeof event.payload === "string") {
                listener(event.payload);
            }
        });
        return () => subscription.remove();
    },
};

export default transport;
