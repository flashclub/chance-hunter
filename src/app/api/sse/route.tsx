export async function GET(request: Request) {
  // 解析查询参数
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId") || `client_${Date.now()}`;
  const eventType = searchParams.get("type") || "general";

  console.log(`SSE连接建立: ${clientId}, 事件类型: ${eventType}`);

  // 创建SSE响应流
  const encoder = new TextEncoder();

  const customReadable = new ReadableStream({
    start(controller) {
      // 发送连接成功消息
      const connectMessage = {
        id: Date.now(),
        type: "connection",
        data: {
          clientId,
          message: "连接已建立",
          timestamp: new Date().toISOString(),
        },
      };

      const sseData = `data: ${JSON.stringify(connectMessage)}\n\n`;
      controller.enqueue(encoder.encode(sseData));

      // 定期发送心跳消息
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = {
            id: Date.now(),
            type: "heartbeat",
            data: {
              clientId,
              timestamp: new Date().toISOString(),
              message: "心跳检测",
            },
          };

          const sseData = `data: ${JSON.stringify(heartbeat)}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        } catch (error) {
          console.error("心跳发送失败:", error);
          clearInterval(heartbeatInterval);
          controller.close();
        }
      }, 10000); // 每10秒发送一次心跳

      // 模拟实时数据推送
      const dataInterval = setInterval(() => {
        try {
          const randomData = {
            id: Date.now(),
            type: eventType,
            data: {
              clientId,
              timestamp: new Date().toISOString(),
              value: Math.floor(Math.random() * 100),
              message: `随机数据 - ${Math.random().toString(36).substr(2, 9)}`,
              status: ["success", "warning", "info"][
                Math.floor(Math.random() * 3)
              ],
            },
          };

          const sseData = `data: ${JSON.stringify(randomData)}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        } catch (error) {
          console.error("数据推送失败:", error);
          clearInterval(dataInterval);
          clearInterval(heartbeatInterval);
          controller.close();
        }
      }, 5000); // 每5秒推送一次数据

      // Vercel函数超时处理 (最大60秒)
      const timeoutId = setTimeout(() => {
        console.log(`SSE连接超时关闭: ${clientId}`);
        const timeoutMessage = {
          id: Date.now(),
          type: "timeout",
          data: {
            clientId,
            message: "连接超时，即将关闭",
            timestamp: new Date().toISOString(),
          },
        };

        const sseData = `data: ${JSON.stringify(timeoutMessage)}\n\n`;
        controller.enqueue(encoder.encode(sseData));

        // 执行清理并关闭连接
        clearInterval(heartbeatInterval);
        clearInterval(dataInterval);
        clearTimeout(timeoutId);
        controller.close();
      }, 50000); // 50秒后超时关闭

      // 清理函数 - 当连接关闭时执行
      const cleanup = () => {
        console.log(`SSE连接关闭: ${clientId}`);
        clearInterval(heartbeatInterval);
        clearInterval(dataInterval);
        clearTimeout(timeoutId);
      };

      // 监听连接关闭
      request.signal?.addEventListener("abort", cleanup);
    },

    cancel() {
      console.log(`SSE流被取消: ${clientId}`);
    },
  });

  return new Response(customReadable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Cache-Control",
      "X-Accel-Buffering": "no", // 禁用Nginx缓冲
    },
  });
}

// 支持OPTIONS请求 (CORS预检)
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Cache-Control",
    },
  });
}
