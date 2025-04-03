import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  // No register mutation in this application
};

const loginSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

export type LoginData = z.infer<typeof loginSchema>;

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      console.log("ログイン試行:", credentials);
      try {
        const res = await apiRequest("POST", "/api/login", credentials);
        const data = await res.json();
        console.log("ログイン応答:", data);
        return data;
      } catch (error) {
        console.error("ログインエラー:", error);
        throw error;
      }
    },
    onSuccess: (user: User) => {
      console.log("ログイン成功:", user);
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "ログイン成功",
        description: `${user.name}さん、ようこそ！`,
      });
    },
    onError: (error: Error) => {
      console.error("ログイン失敗:", error);
      
      // エラーメッセージをユーザーにとってわかりやすく表示
      let description = "ログイン処理中にエラーが発生しました。";
      
      if (error.message.includes("401")) {
        description = "メールアドレスまたはパスワードが正しくありません。";
      } else if (error.message.includes("404")) {
        description = "サーバーに接続できません。";
      } else if (error.message.includes("500")) {
        description = "サーバーでエラーが発生しました。後ほど再度お試しください。";
      }
      
      toast({
        title: "ログインに失敗しました",
        description: description,
        variant: "destructive",
      });
    },
  });

  // 登録機能は管理者画面で行うため、こちらでは実装しません

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "ログアウトしました",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "ログアウトに失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
