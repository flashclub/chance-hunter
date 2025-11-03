// 强制代理初始化 - 必须在所有其他 import 之前
(() => {
  if (typeof window === "undefined") {
    try {
      // 强制设置代理环境变量
      if (
        !process.env.GLOBAL_AGENT_HTTP_PROXY &&
        process.env.NODE_ENV === "development"
      ) {
        process.env.GLOBAL_AGENT_HTTP_PROXY = "http://127.0.0.1:7890";
      }

      if (process.env.GLOBAL_AGENT_HTTP_PROXY) {
        process.env.GLOBAL_AGENT_HTTPS_PROXY =
          process.env.GLOBAL_AGENT_HTTP_PROXY;

        const globalAgent = require("global-agent");
        globalAgent.bootstrap();

        // 导入强制代理模块
        console.log("[强制代理] 🚨 启用 fetch 覆盖...");
        require("../../../lib/forceProxy");

        console.log(
          "[强制代理] ✅ 在 reddit-market API 中强制初始化代理:",
          process.env.GLOBAL_AGENT_HTTP_PROXY
        );

        // 验证 global.GLOBAL_AGENT 存在
        if (global.GLOBAL_AGENT) {
          console.log("[强制代理] global.GLOBAL_AGENT 已设置");
        }
      }
    } catch (error) {
      console.error("[强制代理] 初始化失败:", error);
    }
  }
})();

import { NextResponse } from "next/server";
import { HttpsProxyAgent } from "https-proxy-agent";
import https from "https";
import http from "http";
import * as cheerio from "cheerio";
import { GoogleGenAI } from "@google/genai";

// 使用Node.js原生模块的请求函数
function makeHttpRequest(
  url: string,
  agent?: any
): Promise<{
  status: number;
  statusText: string;
  text: () => Promise<string>;
  ok: boolean;
}> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      agent: agent,
    };

    const requestModule = urlObj.protocol === "https:" ? https : http;

    const req = requestModule.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        resolve({
          status: res.statusCode || 0,
          statusText: res.statusMessage || "",
          text: () => Promise.resolve(data),
          ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
        });
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    req.end();
  });
}

// 重试函数
async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      // HTTP请求将直接处理超时

      // 尝试使用Node.js原生模块
      let response: any;
      if (typeof globalThis !== "undefined" && "process" in globalThis) {
        const agent = new HttpsProxyAgent("http://127.0.0.1:7890");
        console.log(
          `Using native HTTP module with proxy for ${new URL(url).hostname}`
        );
        response = await makeHttpRequest(url, agent);
      } else {
        console.log(
          `Using native HTTP module direct for ${new URL(url).hostname}`
        );
        response = await makeHttpRequest(url);
      }
      // 模拟Response对象
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        text: response.text,
      } as Response;
    } catch (error) {
      // 如果是代理相关错误，尝试不使用代理
      if ((error as Error).message.includes("ECONNREFUSED")) {
        console.log("代理连接被拒绝，尝试直连...");
        try {
          console.log("Using native HTTP module for direct fallback");
          const directResponse = await makeHttpRequest(url);

          return {
            ok: directResponse.ok,
            status: directResponse.status,
            statusText: directResponse.statusText,
            text: directResponse.text,
          } as Response;
        } catch (directError) {
          console.log("直连也失败:", directError);
        }
      }

      if (i === retries) {
        throw error;
      }
      // 等待一段时间再重试
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error("All retry attempts failed");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    // 验证URL格式
    const validUrl = new URL(url);

    // 检查协议
    if (!validUrl.protocol.startsWith("http")) {
      return NextResponse.json(
        { error: "Only HTTP and HTTPS URLs are supported" },
        { status: 400 }
      );
    }

    console.log(`Fetching URL: ${validUrl.toString()}`);

    // 使用重试机制获取网页内容
    const response = await fetchWithRetry(validUrl.toString());

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Failed to fetch URL: ${response.status} ${response.statusText}`,
        },
        { status: 400 }
      );
    }

    const html = await response.text();

    // 使用cheerio专业解析HTML DOM
    const $ = cheerio.load(html);

    // 提取title标签内容 - cheerio会自动处理HTML实体解码
    const title = $("title").text().trim() || "No title found";

    // 提取meta description内容
    let description = "";

    // 方法1: 标准meta description
    description = $('meta[name="description"]').attr("content")?.trim() || "";

    // 方法2: 如果没有找到，尝试og:description
    if (!description) {
      description =
        $('meta[property="og:description"]').attr("content")?.trim() || "";
    }

    // 方法3: 尝试twitter:description
    if (!description) {
      description =
        $('meta[name="twitter:description"]').attr("content")?.trim() || "";
    }

    // 使用Gemini API分析网站内容
    let analysis = "";
    try {
      const geminiApiKey =
        process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;

      if (geminiApiKey) {
        console.log("[Gemini] 开始调用 Gemini API...");

        const ai = new GoogleGenAI({
          apiKey: geminiApiKey,
        });

        const prompt = `请分析以下网站信息：

网站URL: ${url}
标题: ${title}
描述: ${description || "无描述"}

请提供以下分析：
1. 网站类型和主要用途
2. 内容主题分类
3. 目标受众
4. 网站质量评估（基于标题和描述的专业性）
5. 简短总结

请用中文回答，简洁明了。`;
        const groundingTool = {
          googleSearch: {},
        };

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            tools: [groundingTool],
            thinkingConfig: {
              thinkingBudget: 0, // 禁用思考功能以提高速度
            },
          },
        });

        analysis = response.text || "分析失败";
        console.log("[Gemini] API 调用成功");
      } else {
        analysis = "未配置Gemini API密钥，无法进行AI分析";
        console.warn("[Gemini] 未找到 API 密钥");
      }
    } catch (error) {
      console.error("Gemini API分析错误:", error);

      // 检查是否是网络连接问题
      if (error instanceof Error) {
        if (
          error.message.includes("ECONNREFUSED") ||
          error.message.includes("ENOTFOUND") ||
          error.message.includes("timeout")
        ) {
          analysis = "AI分析失败: 网络连接问题，请检查代理设置或网络连接";
        } else if (
          error.message.includes("403") ||
          error.message.includes("401")
        ) {
          analysis = "AI分析失败: API密钥无效或权限不足";
        } else {
          analysis = "AI分析失败: " + error.message;
        }
      } else {
        analysis = "AI分析失败: 未知错误";
      }
    }

    return NextResponse.json(
      {
        url: url,
        title,
        description,
        analysis,
        message: "网站信息提取和AI分析完成",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Reddit market API error:", error);

    if (error instanceof TypeError && error.message.includes("Invalid URL")) {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // 检查特定的网络错误
    if (error instanceof Error) {
      if (error.message.includes("ECONNRESET")) {
        return NextResponse.json(
          {
            error:
              "Connection was reset by the target server. The website may be blocking requests.",
          },
          { status: 500 }
        );
      }

      if (error.message.includes("ENOTFOUND")) {
        return NextResponse.json(
          { error: "Domain not found. Please check the URL." },
          { status: 400 }
        );
      }

      if (error.message.includes("ETIMEDOUT")) {
        return NextResponse.json(
          { error: "Request timeout. The server took too long to respond." },
          { status: 500 }
        );
      }

      if (error.message.includes("fetch failed")) {
        return NextResponse.json(
          {
            error:
              "Network error: Unable to connect to the website. It may be blocking requests or temporarily unavailable.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        error: `Failed to fetch title: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 }
    );
  }
}
