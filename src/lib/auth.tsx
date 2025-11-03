"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface User {
  email: string;
  name: string;
  picture: string;
  sub: string;
  googleToken?: string;
}

interface AuthContextType {
  user: User | null;
  login: (userData: User, googleToken?: string) => void;
  logout: () => void;
  getAuthToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // 初始化时从 localStorage 读取用户信息（不检查过期）
    const savedUser = localStorage.getItem("user");
    const savedToken = localStorage.getItem("googleToken");
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        if (savedToken) {
          userData.googleToken = savedToken;
        }
        setUser(userData);
      } catch (error) {
        console.error("Error parsing saved user:", error);
        localStorage.removeItem("user");
        localStorage.removeItem("googleToken");
      }
    }
  }, []);

  const login = (userData: User, googleToken?: string) => {
    if (googleToken) {
      userData.googleToken = googleToken;
      localStorage.setItem("googleToken", googleToken);
    }
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));

    console.log("✅ 用户登录成功，token将永久有效直到手动退出");
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("googleToken");
    window.location.reload();
  };

  const getAuthToken = () => {
    return user?.googleToken || localStorage.getItem("googleToken");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, getAuthToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// 辅助函数：进行认证API调用
export function useAuthenticatedFetch() {
  const { getAuthToken } = useAuth();

  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const token = getAuthToken();

    if (!token) {
      throw new Error("用户未登录");
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    };

    return fetch(url, {
      ...options,
      headers,
    });
  };

  return authenticatedFetch;
}
