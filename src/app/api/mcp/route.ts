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

        console.log(
          "[强制代理] ✅ 在 MCP API 中强制初始化代理:",
          process.env.GLOBAL_AGENT_HTTP_PROXY
        );
      }
    } catch (error) {
      console.error("[强制代理] MCP API 初始化失败:", error);
    }
  }
})();

import {
  GoogleGenAI,
  FunctionCallingConfigMode,
  mcpToTool,
} from "@google/genai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
// 改用HTTP传输，而不是stdio
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { NextResponse } from "next/server";
import { initializeGlobalProxy } from "@/lib/proxyConfig";

export async function POST(request: Request) {
  let client: Client | null = null;

  try {
    // 初始化代理支持
    initializeGlobalProxy();

    // Configure the client
    const geminiApiKey =
      process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    console.log("[MCP] GoogleGenAI 客户端已初始化");

    const { prompt } = await request.json();

    // 创建 MCP 客户端连接到指定的服务器
    const transport = new SSEClientTransport(
      new URL("https://sequencer-v2.heurist.xyz/tool98bc8f47/sse")
    );
    client = new Client(
      {
        name: "kurateart-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    // 连接到 MCP 服务器
    await client.connect(transport);

    // 获取可用的工具
    const toolsResponse = await client.listTools();
    console.log("Available MCP tools:", toolsResponse.tools);

    // Define the grounding tool
    const groundingTool = {
      googleSearch: {},
    };

    // Configure generation settings
    const config = {
      tools: [groundingTool],
      // 暂时不直接集成 MCP，先测试连接
    };

    // Send request to the model
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config,
    });

    console.log("Gemini response:", response.text);
    console.log(
      "MCP tools available:",
      toolsResponse.tools.map((t) => t.name)
    );

    return NextResponse.json({
      data: response.text,
      success: true,
      mcpTools: toolsResponse.tools.map((t) => ({
        name: t.name,
        description: t.description,
      })),
    });
  } catch (error) {
    console.error("MCP API Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  } finally {
    // 确保在任何情况下都关闭 MCP 连接
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error("Error closing MCP client:", closeError);
      }
    }
  }
}
