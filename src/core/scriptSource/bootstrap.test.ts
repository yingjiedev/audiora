import vm from "vm";
import { createHash, createCipheriv } from "crypto";
import { SOURCE_BOOTSTRAP } from "./bootstrap";

function context() {
    const messages: any[] = [];
    const realm = vm.createContext({
        __sourceSend: (raw: string) => messages.push(JSON.parse(raw)),
        __sourceCrypto: (raw: string) => {
            const request = JSON.parse(raw);
            if (request.operation === "md5") {
                return JSON.stringify({ data: createHash("md5").update(request.text).digest("hex") });
            }
            const cipher = createCipheriv("aes-128-cbc", Buffer.from(request.key, "base64"), Buffer.from(request.iv, "base64"));
            return JSON.stringify({ data: Buffer.concat([cipher.update(Buffer.from(request.data, "base64")), cipher.final()]).toString("base64") });
        },
    });
    vm.runInContext(`${SOURCE_BOOTSTRAP}(${JSON.stringify({ name: "Fixture", rawScript: "original" })});`, realm);
    return { realm, messages, run: (code: string) => vm.runInContext(code, realm) };
}

describe("isolated source host contract", () => {
    it("provides independent globals, legacy aliases and original script information", () => {
        const first = context();
        const second = context();
        expect(first.run("globalThis === window && lx === window.lx && lx.env === 'mobile'")).toBe(true);
        expect(first.run("lx.currentScriptInfo.rawScript")).toBe("original");
        first.run("globalThis.customState = 42; Array.prototype.customExtension = true;");
        expect(second.run("typeof customState")).toBe("undefined");
        expect(second.run("Array.prototype.customExtension")).toBeUndefined();
        expect(first.run("typeof __sourceSend")).toBe("undefined");
    });

    it("round-trips UTF-8, base64, hex and binary data including supplementary characters", () => {
        const host = context();
        const text = "音乐 🎵 café";
        host.realm.inputText = text;
        expect(host.run("lx.utils.buffer.bufToString(lx.utils.buffer.from(inputText), 'utf8')")).toBe(text);
        expect(host.run("Buffer.from(inputText).toString('base64')")).toBe(Buffer.from(text).toString("base64"));
        expect(host.run("Buffer.from(Buffer.from(inputText).toString('hex'), 'hex').toString()")).toBe(text);
        expect(host.run("Array.from(Buffer.from('AP+A', 'base64')).join(',')")).toBe("0,255,128");
    });

    it("bridges synchronous utilities with their byte-oriented signatures", () => {
        const host = context();
        expect(host.run("lx.utils.crypto.md5('fixture')")).toBe(createHash("md5").update("fixture").digest("hex"));
        expect(host.run("lx.utils.crypto.aesEncrypt(Buffer.from('data'), 'aes-128-cbc', Buffer.alloc(16), Buffer.alloc(16)).length")).toBe(16);
    });

    it("delivers asynchronous initialization, HTTP response triples and idempotent cancellation", async () => {
        const host = context();
        host.run(`lx.on('request', () => Promise.resolve('https://example.invalid/song'));
            globalThis.cancel = lx.request('https://example.invalid/init', {}, (error, response, body) => {
                globalThis.received = [error, response.statusCode, body.value];
                lx.send('inited', {sources:{wy:{type:'music',actions:['musicUrl'],qualitys:['320k']}}});
            });`);
        expect(host.messages.map(message => message.type)).toEqual(["http"]);
        const request = host.messages[0];
        host.run(`__audioraDispatch(${JSON.stringify({ type: "http", id: request.id, response: { statusCode: 403, body: { value: "body" } } })});`);
        expect(Array.from(host.run("received"))).toEqual([null, 403, "body"]);
        expect(host.messages[1].type).toBe("inited");
        host.run("cancel();cancel();");
        expect(host.messages.filter(message => message.type === "cancelHttp")).toHaveLength(0);
        host.run("globalThis.cancel2=lx.request('https://example.invalid/other',{},()=>{}); cancel2();cancel2();");
        expect(host.messages.filter(message => message.type === "cancelHttp")).toHaveLength(1);
        host.run("__audioraDispatch({type:'request',id:9,data:{source:'wy',action:'musicUrl',info:{}}});");
        await new Promise(resolve => setImmediate(resolve));
        expect(host.messages.find(message => message.type === "result")).toMatchObject({ id: 9, result: "https://example.invalid/song" });
    });

    it("does not expose script-authored update text as product messages", () => {
        const host = context();
        host.run("lx.send('updateAlert',{log:'third-party branding',updateUrl:'https://example.invalid'});");
        expect(host.messages).toEqual([{ type: "updateAvailable" }]);
    });
});
