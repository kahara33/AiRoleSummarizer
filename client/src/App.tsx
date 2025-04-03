import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import RoleModelsPage from "@/pages/role-models";
import RoleModelDetailPage from "@/pages/role-model-detail";
import TagsPage from "@/pages/tags";
import SummariesPage from "@/pages/summaries";
import KnowledgeGraphPage from "@/pages/knowledge-graph";
import OrganizationsPage from "@/pages/organizations";
import InformationCollectionPage from "@/pages/information-collection";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/role-models/new" component={RoleModelsPage} />
      <ProtectedRoute path="/role-models/:id" component={RoleModelDetailPage} />
      <ProtectedRoute path="/role-models" component={RoleModelsPage} />
      <ProtectedRoute path="/role-model/:id/knowledge-graph" component={KnowledgeGraphPage} />
      <ProtectedRoute path="/role-model/:id" component={RoleModelDetailPage} />
      <ProtectedRoute path="/knowledge-graph" component={KnowledgeGraphPage} />
      <ProtectedRoute path="/information-collection" component={InformationCollectionPage} />
      <ProtectedRoute path="/tags" component={TagsPage} />
      <ProtectedRoute path="/summaries" component={SummariesPage} />
      <ProtectedRoute path="/organizations" component={OrganizationsPage} />
      <ProtectedRoute path="/" component={Dashboard} />
      <Route path="/:rest*" component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
