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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get("authorization");
    let token = null;
    let currentUser = null;

    if (!authHeader) {
      console.log("Missing authorization header");
    } else {
      token = authHeader.substring(7);
      console.log("Received token: ", token.substring(0, 50) + "...");

      // Try to get user info (without strict expiration validation)
      currentUser = await verifyGoogleToken(token);
    }

    const {
      prompt,
      image_url,
      num_inference_steps = 28,
      guidance_scale = 2.5,
      num_images = 1,
      seed,
      enable_safety_checker = true,
      output_format = "jpeg",
      resolution_mode = "match_input",
      sync_mode = false,
    } = body;

    const supabase = await createClient();

    // Get user identifier: prioritize email from token, then email from body, finally use IP address
    let userIdentifier = currentUser?.email || body.email;
    let isAnonymousUser = false;

    if (!userIdentifier) {
      // Unauthenticated user, use IP address as identifier
      const forwardedFor = request.headers.get("x-forwarded-for");
      const realIp = request.headers.get("x-real-ip");
      const clientIp = forwardedFor?.split(",")[0] || realIp || "unknown";
      userIdentifier = `anonymous_${clientIp}`;
      isAnonymousUser = true;
      console.log(
        "🔍 Unauthenticated user, using IP identifier:",
        userIdentifier
      );
    }

    console.log("🔍 Querying user data, identifier:", userIdentifier);
    const { data: userData, error: userError } = await supabase
      .from(tableName)
      .select("*")
      .eq("email", userIdentifier)
      .single();

    if (userError) {
      console.error("Failed to query user data:", userError);
      // Create new user record
      await supabase.from(tableName).insert({
        email: userIdentifier,
        name: isAnonymousUser
          ? "Anonymous User"
          : currentUser?.name || "Unknown User",
        subscription_status: "free", // Unauthenticated users default to free plan
        used_count: 1, // First use set to 1
        updated_at: new Date().toISOString(),
      });
    } else {
      console.log("📊 User data query result:", userData?.email);
      const subscription_status = userData.subscription_status;
      console.log("🔍 Subscription status:", subscription_status);
      // All users (including anonymous users) check free quota
      if (subscription_status === "free") {
        // Get current date and user's last update date
        const today = new Date();
        const userLastUpdate = new Date(userData.updated_at);

        // Check if it's the same day
        const isSameDay =
          today.toDateString() === userLastUpdate.toDateString();

        if (isSameDay) {
          // Same day, check if exceeds daily limit (2 times)
          const used_count = userData.used_count;
          if (used_count >= 3) {
            const errorMessage = isAnonymousUser
              ? "You have reached your daily free usage limit of 3 images. Please try again tomorrow or sign up for an account to get more benefits."
              : "You have reached your daily free usage limit of 3 images. Please try again tomorrow or upgrade to a paid plan.";

            return NextResponse.json({ error: errorMessage }, { status: 403 });
          }
          // Increment today's usage count
          await supabase
            .from(tableName)
            .update({
              used_count: used_count + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("email", userIdentifier);
        } else {
          // New day, reset usage count to 1
          await supabase
            .from(tableName)
            .update({
              used_count: 1,
              updated_at: new Date().toISOString(),
            })
            .eq("email", userIdentifier);
        }
      } else if (
        subscription_status === "active" ||
        subscription_status === "on_trial" ||
        subscription_status === "paid"
      ) {
        const all_count = userData.all_count;
        const used_count = userData.used_count;
        if (used_count >= all_count) {
          return NextResponse.json(
            { error: "You have reached your limit" },
            { status: 403 }
          );
        }
        await supabase
          .from(tableName)
          .update({
            used_count: used_count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("email", userIdentifier);
      } else {
        // Paid user, only update timestamp, no usage limit
        const used_count = userData.used_count;
        await supabase
          .from(tableName)
          .update({
            used_count: used_count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("email", userIdentifier);
      }
    }

    // Validate required parameters
    if (!prompt || !image_url) {
      return NextResponse.json(
        { error: "Missing required parameters: prompt and image_url" },
        { status: 400 }
      );
    }

    // Check FAL API key in environment variables
    const falApiKey = process.env.FAL_KEY;
    if (!falApiKey) {
      return NextResponse.json(
        { error: "Server configuration error: Missing FAL API key" },
        { status: 500 }
      );
    }

    // Prepare request data to send to fal.ai
    const falRequestData: any = {
      prompt,
      image_url,
      num_inference_steps,
      guidance_scale,
      num_images,
      enable_safety_checker,
      output_format,
      resolution_mode,
      sync_mode,
    };

    // If seed is provided, add it to the request
    if (seed !== undefined && seed !== null) {
      falRequestData.seed = seed;
    }

    // Send request to fal.ai API
    const falResponse = await fetch("https://fal.run/fal-ai/flux-kontext/dev", {
      method: "POST",
      headers: {
        Authorization: `Key ${falApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(falRequestData),
    });

    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      return NextResponse.json(
        {
          error: `FAL API error: ${falResponse.status} ${falResponse.statusText}`,
          details: errorText,
        },
        { status: falResponse.status }
      );
    }

    const result = await falResponse.json();

    // Return processed result
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    // Provide more detailed error information
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : "";

    return NextResponse.json(
      {
        error: "Internal server error",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
