import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { ComponentProps } from "./types";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: (props: ComponentProps) => React.ReactElement;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        {(params) => (
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-border" />
          </div>
        )}
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        {() => <Redirect to="/auth" />}
      </Route>
    );
  }

  return (
    <Route path={path}>
      {(params) => {
        // Convert [number]: string|undefined to Record<string, string>
        const safeParams: Record<string, string> = {};
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) {
              safeParams[key] = value;
            }
          });
        }
        return <Component params={safeParams} />;
      }}
    </Route>
  );
}
