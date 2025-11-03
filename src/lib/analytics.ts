// Google Analytics 4 事件跟踪工具库

declare global {
  interface Window {
    gtag: (
      command: "config" | "event" | "js" | "set",
      targetId?: string | Date,
      config?: {
        [key: string]: any;
      }
    ) => void;
  }
}

// 调试模式（仅在开发环境启用）
const DEBUG_MODE = process.env.NODE_ENV === "development";

// Google Ads转换跟踪
export const trackAdsConversion = (
  conversionLabel: string,
  value?: number,
  currency: string = "USD",
  transactionId?: string
) => {
  if (
    typeof window !== "undefined" &&
    window.gtag &&
    process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
  ) {
    window.gtag("event", "conversion", {
      send_to: `${process.env.NEXT_PUBLIC_GOOGLE_ADS_ID}/${conversionLabel}`,
      value: value,
      currency: currency,
      transaction_id: transactionId,
    });

    if (DEBUG_MODE) {
      console.log("🎯 Google Ads Conversion:", {
        conversionLabel,
        value,
        currency,
        transactionId,
      });
    }
  }
};

// 跟踪页面浏览
export const trackPageView = (url: string, title?: string) => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "page_view", {
      page_location: url,
      page_title: title,
    });

    if (DEBUG_MODE) {
      console.log("📊 GA Event: page_view", { url, title });
    }
  }
};

// 跟踪自定义事件
export const trackEvent = (
  eventName: string,
  parameters?: { [key: string]: any }
) => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", eventName, parameters);

    if (DEBUG_MODE) {
      console.log(`📊 GA Event: ${eventName}`, parameters);
    }
  }
};

// 跟踪图像相关事件
export const trackImageEvent = (
  action:
    | "upload"
    | "generate_start"
    | "generate_success"
    | "generate_error"
    | "download",
  metadata?: {
    file_size?: number;
    file_type?: string;
    prompt_length?: number;
    inference_steps?: number;
    guidance_scale?: number;
    error_message?: string;
    generation_time?: number;
    user_authenticated?: boolean;
    [key: string]: any; // 允许额外的属性
  }
) => {
  trackEvent("image_action", {
    action,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
};

// 跟踪用户注册/登录
export const trackAuth = (
  action: "signup" | "login" | "logout" | "login_error",
  method?: string
) => {
  trackEvent("auth_action", {
    action,
    method: method || "google",
    timestamp: new Date().toISOString(),
  });
};

// 跟踪功能使用
export const trackFeatureUsage = (
  feature: string,
  action: string,
  metadata?: any
) => {
  trackEvent("feature_usage", {
    feature_name: feature,
    action,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
};

// 跟踪转换事件（如付费等）- 同时发送给GA和Google Ads
export const trackConversion = (
  value?: number,
  currency?: string,
  product?: string,
  adsConversionLabel?: string,
  transactionId?: string
) => {
  // Google Analytics 转换跟踪
  trackEvent("conversion", {
    value,
    currency: currency || "USD",
    product,
    timestamp: new Date().toISOString(),
  });

  // Google Ads 转换跟踪（如果提供了转换标签）
  if (adsConversionLabel) {
    trackAdsConversion(
      adsConversionLabel,
      value,
      currency || "USD",
      transactionId
    );
  }
};

// 跟踪按钮点击
export const trackButtonClick = (
  button_name: string,
  location: string,
  metadata?: any
) => {
  trackEvent("button_click", {
    button_name,
    location,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
};

// 跟踪用户参与度
export const trackEngagement = (
  engagement_type: "scroll" | "time_on_page" | "interaction",
  value?: number,
  metadata?: any
) => {
  trackEvent("user_engagement", {
    engagement_type,
    value,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
};

// 跟踪错误事件
export const trackError = (
  error_type: "api_error" | "client_error" | "validation_error",
  error_message: string,
  location?: string
) => {
  trackEvent("error_occurred", {
    error_type,
    error_message: error_message.substring(0, 200), // 限制错误消息长度
    location,
    timestamp: new Date().toISOString(),
  });
};

// 跟踪性能指标
export const trackPerformance = (
  metric:
    | "page_load"
    | "api_response"
    | "image_generation"
    | "session_duration",
  duration: number,
  metadata?: any
) => {
  trackEvent("performance_metric", {
    metric,
    duration,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
};

// 跟踪定价页面事件
export const trackPricingEvent = (
  action:
    | "view_pricing"
    | "select_plan"
    | "upgrade_click"
    | "credit_pack_click"
    | "subscription_click",
  plan?: string,
  metadata?: any
) => {
  trackEvent("pricing_action", {
    action,
    plan,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
};

// 异步跟踪（不阻塞主流程）
export const trackAsync = (trackingFunction: () => void) => {
  if (typeof window !== "undefined") {
    // 使用 requestIdleCallback 或 setTimeout 来确保不影响性能
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(trackingFunction);
    } else {
      setTimeout(trackingFunction, 0);
    }
  }
};

// 批量跟踪事件（性能优化）
let eventQueue: Array<{ name: string; parameters: any }> = [];
let flushTimeout: NodeJS.Timeout | null = null;

export const trackEventBatched = (eventName: string, parameters?: any) => {
  eventQueue.push({ name: eventName, parameters });

  // 清除现有的刷新计时器
  if (flushTimeout) {
    clearTimeout(flushTimeout);
  }

  // 设置新的刷新计时器（1秒后或队列满时刷新）
  flushTimeout = setTimeout(flushEventQueue, 1000);

  // 如果队列过大，立即刷新
  if (eventQueue.length >= 10) {
    flushEventQueue();
  }
};

const flushEventQueue = () => {
  if (eventQueue.length === 0) return;

  // 批量发送事件
  eventQueue.forEach(({ name, parameters }) => {
    trackEvent(name, parameters);
  });

  // 清空队列
  eventQueue = [];
  flushTimeout = null;
};

// 特定业务转换跟踪示例
export const trackPurchaseConversion = (
  value: number,
  product: string,
  currency: string = "USD",
  transactionId?: string
) => {
  // Google Analytics 增强型电商跟踪
  trackEvent("purchase", {
    transaction_id: transactionId,
    value: value,
    currency: currency,
    items: [
      {
        item_id: product,
        item_name: product,
        price: value,
        quantity: 1,
      },
    ],
  });

  // Google Ads 转换跟踪（在环境变量中配置转换标签）
  if (process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL) {
    trackAdsConversion(
      process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL,
      value,
      currency,
      transactionId
    );
  }
};

// 注册转换跟踪
export const trackSignupConversion = () => {
  trackEvent("sign_up", {
    method: "google",
  });

  if (process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL) {
    trackAdsConversion(process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL);
  }
};
