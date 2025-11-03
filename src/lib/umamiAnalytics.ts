// Umami 网站分析工具库

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: any) => void;
    };
  }
}

// 基础事件跟踪
export const trackUmamiEvent = (
  eventName: string,
  eventData?: { [key: string]: any }
) => {
  if (typeof window !== "undefined" && window.umami) {
    window.umami.track(eventName, eventData);
  }
};

// 跟踪页面浏览（Umami会自动跟踪，但可以手动触发）
export const trackUmamiPageView = (url: string, title?: string) => {
  trackUmamiEvent("pageview", {
    url,
    title,
    timestamp: new Date().toISOString(),
  });
};

// 跟踪视频转录相关事件
export const trackUmamiVideoTranscript = (
  action: "start" | "complete" | "error",
  videoId?: string
) => {
  trackUmamiEvent("video_transcript", {
    action,
    video_id: videoId,
    timestamp: new Date().toISOString(),
  });
};

// 跟踪用户认证事件
export const trackUmamiAuth = (action: "signup" | "login" | "logout") => {
  trackUmamiEvent("auth_action", {
    action,
    timestamp: new Date().toISOString(),
  });
};

// 跟踪功能使用
export const trackUmamiFeatureUsage = (feature: string, action: string) => {
  trackUmamiEvent("feature_usage", {
    feature_name: feature,
    action,
    timestamp: new Date().toISOString(),
  });
};

// 跟踪转换事件（如付费等）
export const trackUmamiConversion = (value?: number, currency?: string) => {
  trackUmamiEvent("conversion", {
    value,
    currency: currency || "USD",
    timestamp: new Date().toISOString(),
  });
};

// 跟踪下载事件
export const trackUmamiDownload = (fileName: string, fileType: string) => {
  trackUmamiEvent("download", {
    file_name: fileName,
    file_type: fileType,
    timestamp: new Date().toISOString(),
  });
};

// 跟踪搜索事件
export const trackUmamiSearch = (searchTerm: string, resultCount?: number) => {
  trackUmamiEvent("search", {
    search_term: searchTerm,
    result_count: resultCount,
    timestamp: new Date().toISOString(),
  });
};

// 跟踪外部链接点击
export const trackUmamiExternalLink = (url: string, linkText?: string) => {
  trackUmamiEvent("external_link", {
    url,
    link_text: linkText,
    timestamp: new Date().toISOString(),
  });
};
