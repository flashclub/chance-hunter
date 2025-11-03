"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

// 自定义hook来处理主题的hydration问题
export function useClientTheme() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return {
    theme: mounted ? theme : "system",
    setTheme,
    mounted,
  };
}
