import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { createClient } from "@/utils/supabase/server";

import NextAuth, { AuthOptions } from "next-auth";
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const tableName = "kurate-art";
const authOptions: AuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      httpOptions: {
        timeout: 10000,
      },
    }),
  ],
  callbacks: {
    async signIn({
      user,
      account,
      profile,
    }: {
      user: any;
      account: any;
      profile?: any;
    }) {
      console.log("SignIn callback started", { user, account, profile });
      const supabase = await createClient();

      // 检查用户是否已存在
      const { data: existingUser, error: userError } = await supabase
        .from(tableName)
        .select("email")
        .eq("email", user.email)
        .single();

      if (userError && userError.code === "PGRST116") {
        // 用户不存在，创建新用户
        await supabase.from(tableName).insert({
          email: user.email,
          name: user.name,
          subscription_status: "free",
          used_count: 0,
        });
        console.log("New user created successfully");
      } else if (existingUser) {
        // 用户已存在，可以选择更新用户信息（比如name可能会变）
        await supabase
          .from(tableName)
          .update({ name: user.name })
          .eq("email", user.email);
        console.log("Existing user updated successfully");
      } else {
        console.error("Unexpected error checking user:", userError);
      }

      console.log("SignIn callback completed successfully");
      return true;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
