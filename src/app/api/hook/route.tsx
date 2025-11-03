import * as crypto from "crypto";
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

// 你创建 webhook 时设置的密钥
const WEBHOOK_SECRET = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
const tableName = "kurate-art";
export async function GET(request: Request) {
  return NextResponse.json({ message: "Hello, world!" });
}

export async function POST(request: Request) {
  try {
    // 获取原始请求体
    const rawBody = await request.text();
    // 获取 Lemon Squeezy 签名
    const signature = request.headers.get("x-signature");

    // 验证签名
    if (!verifySignature(rawBody, signature)) {
      console.error("签名验证失败");
      return NextResponse.json({ error: "签名验证失败" }, { status: 401 });
    }

    // 解析请求体
    const body = JSON.parse(rawBody);

    // 处理不同类型的 webhook 事件
    const eventType = body.meta?.event_name;
    const eventData = body.data;
    const supabase = await createClient();

    console.log(`收到 webhook 事件: ${eventType}`);
    const { attributes } = eventData;
    let productName = "";
    if (eventType === "order_created") {
      productName = attributes.first_order_item.product_name.toLowerCase();
    } else {
      productName = attributes.product_name.toLowerCase();
    }
    if (!productName.includes("kurate art")) {
      return NextResponse.json({
        success: true,
        result: "非 Kurate Art",
        eventType: eventType,
      });
    }
    let result = null;
    // 根据不同的事件类型处理逻辑
    switch (eventType) {
      case "order_created":
        // 处理新订单创建
        result = await handleOrderCreated(supabase, eventData, body);
        break;
      case "subscription_created":
        // 处理新订阅创建
        result = await handleSubscriptionCreated(supabase, eventData, body);
        break;
      case "subscription_updated":
        // 处理订阅更新
        result = await handleSubscriptionUpdated(supabase, eventData);
        break;
      case "subscription_cancelled":
        // 处理订阅取消
        result = await handleSubscriptionCancelled(supabase, eventData);
        break;
      // 可以添加更多事件类型的处理
      default:
        console.log(`未处理的事件类型: ${eventType}`);
    }

    // 返回成功响应
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Webhook 处理错误:", error);
    return NextResponse.json(
      { error: "处理 webhook 时发生错误" },
      { status: 500 }
    );
  }
}

// 验证签名函数
function verifySignature(payload: string, signature: string | null): boolean {
  if (!signature || !WEBHOOK_SECRET) {
    return false;
  }

  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  const digest = hmac.update(payload).digest("hex");

  return crypto.timingSafeEqual(
    new Uint8Array(Buffer.from(signature)),
    new Uint8Array(Buffer.from(digest))
  );
}

// 处理订单创建的函数
async function handleOrderCreated(supabase, data: any, body: any) {
  try {
    const { attributes } = data;
    if (
      !attributes.first_order_item.product_name.includes("flux kontext dev")
    ) {
      return { insertError: null, insertResult: null };
    }
    //
    // 解析自定义字段 - 根据LemonSqueezy文档，自定义数据在meta.custom_data中
    let customFields = {};

    try {
      if (body.meta && body.meta.custom_data) {
        customFields = body.meta.custom_data;
        console.log("接收到的自定义字段:", customFields);
      } else {
        console.log("未找到自定义数据，检查其他位置...");
        // 检查其他可能的位置
        if (data.attributes?.checkout_data?.custom) {
          customFields = data.attributes.checkout_data.custom;
          console.log(
            "从attributes.checkout_data.custom找到自定义字段:",
            customFields
          );
        }
      }
    } catch (error) {
      console.error("解析自定义字段失败:", error);
    }
    const newRecordData = {
      email: attributes.user_email,
      name: attributes.user_name,
      customer_id: attributes.customer_id.toString(),
      product_name: attributes.first_order_item.product_name,
      test_mode: attributes.test_mode,
      // 添加自定义字段
      ...(customFields && {
        custom_user_id: (customFields as any).user_id,
        source: (customFields as any).source,
        plan_type: (customFields as any).plan_type,
        billing_cycle: (customFields as any).billing_cycle,
        order_timestamp: (customFields as any).timestamp,
        custom_email: (customFields as any).user_email,
      }),
    };

    const { error: insertError, data: insertResult } = await supabase
      .from(tableName)
      .insert(newRecordData)
      .select();
    return { insertError, insertResult };
  } catch (error) {
    console.error("同步订单创建失败:", error);
    // 添加更详细的错误信息
    if (error instanceof Error) {
      console.error("错误详情:", error.message);
      console.error("错误堆栈:", error.stack);
    }
  }
}

// 处理订阅创建的函数
async function handleSubscriptionCreated(supabase, data: any, body: any) {
  try {
    const { attributes } = data;
    if (!attributes.product_name.includes("flux kontext dev")) {
      return { insertError: null, insertResult: null };
    }
    // 解析自定义字段 - 根据LemonSqueezy文档，自定义数据在meta.custom_data中
    let customFields = {};
    try {
      if (body.meta && body.meta.custom_data) {
        customFields = body.meta.custom_data;
        console.log("订阅创建 - 接收到的自定义字段:", customFields);
      } else {
        console.log("订阅创建 - 未找到自定义数据，检查其他位置...");
        // 检查其他可能的位置
        if (data.attributes?.checkout_data?.custom) {
          customFields = data.attributes.checkout_data.custom;
          console.log(
            "订阅创建 - 从attributes.checkout_data.custom找到自定义字段:",
            customFields
          );
        }
      }
    } catch (error) {
      console.error("订阅创建 - 解析自定义字段失败:", error);
    }

    // 更新用户订阅状态
    const updateData: any = {
      email: attributes.user_email,
      name: attributes.user_name,
      subscription_status: attributes.status,
      product_name: attributes.product_name,
      test_mode: attributes.test_mode,
      // 添加自定义字段
      ...(customFields && {
        custom_user_id: (customFields as any).user_id,
        source: (customFields as any).source,
        plan_type: (customFields as any).plan_type,
        billing_cycle: (customFields as any).billing_cycle,
        order_timestamp: (customFields as any).timestamp,
        custom_email: (customFields as any).user_email,
      }),
    };
    if (
      attributes.status === "active" ||
      attributes.status === "on_trial" ||
      attributes.status === "paid"
    ) {
      if (updateData.plan_type === "professional") {
        updateData.all_count = 200;
      } else if (updateData.plan_type === "master") {
        updateData.all_count = 2000;
      } else if (updateData.plan_type === "small") {
        updateData.limit_count = 10;
      } else if (updateData.plan_type === "medium") {
        updateData.limit_count = 25;
      } else if (updateData.plan_type === "large") {
        updateData.limit_count = 60;
      }
    }

    const { data: updateResult, error } = await supabase
      .from(tableName)
      .update(updateData)
      .eq("customer_id", attributes.customer_id.toString())
      .select();
    return { updateResult, error };
  } catch (error) {
    console.error("同步订阅创建失败:", error);
  }
}

// 处理订阅更新的函数
async function handleSubscriptionUpdated(supabase, data: any) {
  try {
    const { attributes } = data;
    if (!attributes.product_name.includes("flux kontext dev")) {
      return { insertError: null, insertResult: null };
    }
    if (
      attributes.status === "active" ||
      attributes.status === "on_trial" ||
      attributes.status === "paid"
    ) {
    }
    // 更新用户订阅状态
    const { data: updateResult, error } = await supabase
      .from(tableName)
      .update({
        email: attributes.user_email,
        name: attributes.user_name,
        subscription_status: attributes.status,
        product_name: attributes.product_name,
        test_mode: attributes.test_mode,
        used_count: 0,
      })
      .eq("customer_id", attributes.customer_id.toString());

    if (error) throw error;
    return { updateResult, error };
  } catch (error) {
    console.error("同步订阅更新失败:", error);
    if (error instanceof Error) {
      console.error("错误详情:", error.message);
      console.error("错误堆栈:", error.stack);
    }
  }
}

// 处理订阅取消的函数
async function handleSubscriptionCancelled(supabase, data: any) {
  try {
    const { attributes } = data;
    if (!attributes.product_name.includes("flux kontext dev")) {
      return { insertError: null, insertResult: null };
    }
    // 更新用户订阅状态
    const { data: updateResult, error } = await supabase
      .from(tableName)
      .update({
        subscription_status: "cancelled",
      })
      .eq("customer_id", attributes.customer_id.toString());

    if (error) throw error;
    return { updateResult, error };
  } catch (error) {
    console.error("同步订阅取消失败:", error);
  }
}
