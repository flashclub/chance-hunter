import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
const tableName = "kurate-art";

async function verifyGoogleToken(token: string) {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    return {
      email: payload?.email,
      name: payload?.name,
      picture: payload?.picture,
      sub: payload?.sub,
    };
  } catch (error) {
    // If it's an expiration error, we still try to parse the token to get user info
    if (error.message?.includes("Token used too late")) {
      console.log("⚠️ Token expired, but attempting to parse user info...");
      try {
        // Simple JWT payload parsing (without signature verification)
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          return {
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
            sub: payload.sub,
          };
        }
      } catch (parseError) {
        console.error("Failed to parse expired token:", parseError);
      }
    } else {
      console.error("Token verification failed:", error.message || error);
    }
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({
        requiresWatermark: true,
        userType: "anonymous",
        subscriptionStatus: null,
      });
    }

    const token = authHeader.substring(7);
    const currentUser = await verifyGoogleToken(token);

    if (!currentUser) {
      return NextResponse.json({
        requiresWatermark: true,
        userType: "anonymous",
        subscriptionStatus: null,
      });
    }

    const supabase = await createClient();

    // 获取用户订阅信息
    const { data: userData, error: userError } = await supabase
      .from(tableName)
      .select(
        "subscription_status, email, all_count, limit_count, used_count, product_name"
      )
      .eq("email", currentUser.email)
      .single();

    if (userError || !userData) {
      // 用户不存在于数据库中，视为免费用户
      return NextResponse.json({
        requiresWatermark: true,
        userType: "free",
        subscriptionStatus: "free",
      });
    }

    const subscriptionStatus = userData.subscription_status;
    const planType = userData.subscription_status;
    const limitCount = userData.limit_count;
    const allCount = userData.all_count;
    const usedCount = userData.used_count;
    const productName = userData.product_name;
    if (
      productName === "Kurate Art - 10 credit" ||
      productName === "Kurate Art - 25 credit" ||
      productName === "Kurate Art - 60 credit"
    ) {
      if (usedCount >= limitCount) {
        return NextResponse.json({
          requiresWatermark: true,
          userType: "free",
          subscriptionStatus: "free",
        });
      }
    }
    if (
      productName === "Kurate Art - Annual Payment" ||
      productName === "Kurate Art - Monthly Payment"
    ) {
      if (usedCount >= allCount) {
        return NextResponse.json({
          requiresWatermark: true,
          userType: "free",
          subscriptionStatus: "free",
        });
      }
    }
    console.log("subscriptionStatus --", subscriptionStatus);
    // 判断是否需要水印
    const requiresWatermark = !["active", "on_trial", "paid"].includes(
      subscriptionStatus
    );

    return NextResponse.json({
      requiresWatermark,
      userType: requiresWatermark ? "free" : "premium",
      subscriptionStatus,
    });
  } catch (error) {
    console.error("获取用户状态失败:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
