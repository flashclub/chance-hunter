// 数据清理函数，处理各种可能的JSON格式问题
const cleanJsonData = (data: string): string => {
  // 移除可能的尾随换行符和多余的引号
  let cleaned = data.trim();

  // 处理常见的JSON格式问题
  cleaned = cleaned
    .replace(/\\n$/, "") // 移除尾随的\n
    .replace(/\\"$/, '"') // 修复尾随的转义引号
    .replace(/\\\\/g, "\\") // 修复双重转义
    .replace(/\n/g, "\\n"); // 确保换行符被正确转义

  return cleaned;
};

export const generate = async (
  text: string,
  type: string,
  setIsGenerating: (isGenerating: boolean) => void,
  setResponse: (response: string | ((prev: string) => string)) => void,
  locale: string,
  authToken?: string // 添加可选的认证token参数
): Promise<void> => {
  setIsGenerating(true);
  setResponse("");

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // 如果有认证token，添加到headers中
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    console.log("generate --", locale);
    const res = await fetch("/api/now-analysis", {
      method: "POST",
      headers,
      body: JSON.stringify({ text, type, locale }),
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("认证失败，请重新登录");
      }
      throw new Error(`API调用失败: ${res.status}`);
    }

    if (!res.body) {
      throw new Error("没有响应体");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        setIsGenerating(false);
        break;
      }

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            setIsGenerating(false);
            return;
          }

          if (!data) {
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              setResponse((prev: string) => prev + parsed.content);
            }
          } catch (e) {
            try {
              const cleanedData = cleanJsonData(data);
              const parsed = JSON.parse(cleanedData);
              if (parsed.content) {
                setResponse((prev: string) => prev + parsed.content);
              }
            } catch (e2) {
              console.warn("JSON修复解析也失败:", {
                cleanedData: data,
                error: e2,
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("生成错误:", error);
    setIsGenerating(false);
    throw error; // 重新抛出错误以便调用者处理
  }
};
