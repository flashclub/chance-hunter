/**
 * 强制代理模块 - 覆盖 GoogleGenAI 的网络请求
 * 这个模块必须在 GoogleGenAI import 之前加载
 */

import { HttpsProxyAgent } from "https-proxy-agent";

// 保存原始 fetch
const originalFetch = globalThis.fetch;

// 创建代理 agent
const proxyAgent = new HttpsProxyAgent("http://127.0.0.1:7890");

// 覆盖全局 fetch
(globalThis as any).fetch = async function (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<any> {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;

  // 检查是否是 Google AI API 请求
  if (
    url.includes("generativelanguage.googleapis.com") ||
    url.includes("googleapis.com") ||
    url.includes("google.com")
  ) {
    console.log("[强制代理] 拦截 Google AI API 请求:", url);

    // 使用 Node.js 的 https 模块通过代理发送请求
    const https = require("https");
    const { URL: NodeURL } = require("url");

    return new Promise((resolve, reject) => {
      const requestUrl = new NodeURL(url);
      const requestData = init?.body
        ? typeof init.body === "string"
          ? init.body
          : JSON.stringify(init.body)
        : undefined;

      const options = {
        hostname: requestUrl.hostname,
        port: requestUrl.port || 443,
        path: requestUrl.pathname + requestUrl.search,
        method: init?.method || "GET",
        headers: {
          "Content-Type": "application/json",
          ...init?.headers,
          "x-goog-api-key":
            process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY,
          "Content-Length": requestData ? Buffer.byteLength(requestData) : 0,
        },
        agent: proxyAgent,
      };

      console.log("[强制代理] 请求选项:", {
        hostname: options.hostname,
        path: options.path,
        method: options.method,
        headers: options.headers,
        agent: "代理已设置",
      });

      const req = https.request(options, (res: any) => {
        console.log("[强制代理] ✅ 请求成功，状态码:", res.statusCode);

        // 检查是否是流式请求
        const isStreamRequest =
          url.includes("alt=sse") || url.includes("streamGenerateContent");

        if (isStreamRequest) {
          console.log("[强制代理] 🔄 处理流式响应");

          // 创建 ReadableStream 用于流式传输
          const stream = new ReadableStream({
            start(controller) {
              res.on("data", (chunk: Buffer) => {
                controller.enqueue(new Uint8Array(chunk));
              });

              res.on("end", () => {
                console.log("[强制代理] ✅ 流式响应结束");
                controller.close();
              });

              res.on("error", (error: Error) => {
                console.error("[强制代理] ❌ 流式响应错误:", error);
                controller.error(error);
              });
            },
          });

          // 模拟 fetch Response 对象（流式版本）
          const response = {
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage || "",
            headers: new Headers(res.headers as any),
            redirected: false,
            type: "basic" as ResponseType,
            url: url,
            body: stream,
            bodyUsed: false,
            clone: () => response as any,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
            blob: () => Promise.resolve(new Blob()),
            formData: () => Promise.resolve(new FormData()),
            text: async () => {
              const reader = stream.getReader();
              let result = "";
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                result += new TextDecoder().decode(value);
              }
              return result;
            },
            json: async () => {
              const text = await response.text();
              return JSON.parse(text);
            },
          };

          resolve(response as Response);
        } else {
          // 非流式请求的原有逻辑
          let data = "";

          res.on("data", (chunk: Buffer) => {
            data += chunk.toString();
          });

          res.on("end", () => {
            // 模拟 fetch Response 对象
            const response = {
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              statusText: res.statusMessage || "",
              headers: new Headers(res.headers as any),
              redirected: false,
              type: "basic" as ResponseType,
              url: url,
              body: null,
              bodyUsed: false,
              clone: () => response as any,
              arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
              blob: () => Promise.resolve(new Blob()),
              formData: () => Promise.resolve(new FormData()),
              text: () => Promise.resolve(data),
              json: () => Promise.resolve(JSON.parse(data)),
            };

            resolve(response as Response);
          });
        }
      });

      req.on("error", (error: Error) => {
        console.error("[强制代理] ❌ 请求失败:", error.message);
        reject(error);
      });

      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      if (requestData) {
        req.write(requestData);
      }

      req.end();
    });
  }

  // 对于非 Google API 请求，使用原始 fetch
  return originalFetch(input, init);
};

console.log("[强制代理] ✅ 已覆盖全局 fetch，Google AI API 请求将强制通过代理");

export default function initForceProxy() {
  console.log("[强制代理] 强制代理模块已初始化");
}
