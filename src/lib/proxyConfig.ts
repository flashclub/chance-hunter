/**
 * 通用代理配置模块
 * 用于在 GoogleGenAI 等 API 调用中启用代理支持
 */

let globalProxyInitialized = false;

function bootstrapProxy() {
  try {
    // 检查是否需要代理
    const proxyUrl =
      process.env.GLOBAL_AGENT_HTTP_PROXY ||
      process.env.HTTP_PROXY ||
      process.env.HTTPS_PROXY ||
      (process.env.NODE_ENV === "development" ? "http://127.0.0.1:7890" : null);

    if (proxyUrl) {
      console.log("[Proxy] 强制设置代理环境变量...");

      // 强制设置环境变量
      process.env.GLOBAL_AGENT_HTTP_PROXY = proxyUrl;
      process.env.GLOBAL_AGENT_HTTPS_PROXY = proxyUrl;

      console.log("[Proxy] 加载 global-agent...");
      const globalAgent = require("global-agent");

      // 强制初始化
      console.log("[Proxy] 执行 bootstrap...");
      globalAgent.bootstrap();

      // 验证初始化
      if (global.GLOBAL_AGENT) {
        console.log(`[Proxy] ✅ 全局代理已启用: ${proxyUrl}`);
        console.log("[Proxy] global.GLOBAL_AGENT 状态:", {
          HTTP_PROXY: global.GLOBAL_AGENT.HTTP_PROXY,
          HTTPS_PROXY: global.GLOBAL_AGENT.HTTPS_PROXY,
        });
        return true;
      } else {
        console.warn("[Proxy] ⚠️ global.GLOBAL_AGENT 未设置");
        return false;
      }
    } else {
      console.log("[Proxy] 未配置代理，使用直连");
      return false;
    }
  } catch (error) {
    console.error("[Proxy] ❌ 代理初始化失败:", error);
    return false;
  }
}

export function initializeGlobalProxy(): boolean {
  if (globalProxyInitialized) {
    console.log("[Proxy] 代理已初始化");
    return true;
  }

  const success = bootstrapProxy();
  if (success) {
    globalProxyInitialized = true;
  }

  return success;
}

export function getProxyStatus(): {
  enabled: boolean;
  proxyUrl?: string;
  initialized: boolean;
  globalAgentStatus?: any;
} {
  const proxyUrl =
    process.env.GLOBAL_AGENT_HTTP_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.HTTPS_PROXY;

  return {
    enabled: !!proxyUrl,
    proxyUrl,
    initialized: globalProxyInitialized,
    globalAgentStatus:
      typeof global !== "undefined" ? global.GLOBAL_AGENT : undefined,
  };
}

// 立即初始化（服务器端）
if (typeof window === "undefined") {
  console.log("[Proxy] 🚀 模块加载时立即初始化代理...");
  bootstrapProxy();
  globalProxyInitialized = true;
}
