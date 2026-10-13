import axios from "axios";

// Search endpoints can take several seconds before returning their first byte.
// Plugins can still override the default timeout on individual requests.
axios.defaults.timeout = 10_000;
axios.interceptors.response.use(response => {
    // 统一 set-cookie 格式。AxiosHeaders 在部分环境下不可扩展，必须 try/catch。
    try {
        const headers: any = response.headers;
        const setCookie =
            headers?.["set-cookie"] ??
            (typeof headers?.get === "function" ? headers.get("set-cookie") : undefined);
        if (setCookie && Array.isArray(setCookie) && setCookie.length === 1) {
            const splitedCookie = String(setCookie[0]).split(",");
            if (typeof headers?.set === "function") {
                headers.set("set-cookie", splitedCookie);
                headers.set("x-set-cookie", setCookie);
            } else {
                headers["set-cookie"] = splitedCookie;
                headers["x-set-cookie"] = setCookie;
            }
        }
    } catch {
        // ignore header normalization failures
    }

    return response;
});

export default axios;
