"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  Dispatch,
  SetStateAction,
} from "react";

const AppContext = createContext<any | undefined>(undefined);

// 4. 创建 Provider 组件
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider = ({ children }: AppProviderProps) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [shareText, setShareText] = useState<any>({
    start_time: "",
    end_time: "",
    before_text: "",
    selected_text: "",
    after_text: "",
  });
  const [details, setDetails] = useState<any>({});

  const contextValue: any = {
    isLoading,
    setIsLoading,
    shareText,
    setShareText,
    details,
    setDetails,
  };

  return (
    <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
  );
};

// 5. 创建自定义 Hook 以方便消费 Context
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext 必须在 AppProvider 内部使用");
  }
  return context;
};
