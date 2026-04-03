import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";
import StudentDashboard from "@/pages/StudentDashboard";
import TeacherJournal from "@/pages/TeacherJournal";
import AdminPanel from "@/pages/AdminPanel";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./hooks/useAuth";
import type { AuthUser } from "./hooks/useAuth";

/** Приватный маршрут — только для авторизованных пользователей указанной роли. */
function ProtectedRoute({
  component: Component,
  allowedRoles,
}: {
  component: React.ComponentType;
  allowedRoles?: Array<AuthUser["role"]>;
}) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) return null;

  if (!isAuthenticated) {
    setLocation("/");
    return null;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Перенаправляем на "свою" страницу
    if (user.role === "student") setLocation("/student/dashboard");
    else if (user.role === "teacher") setLocation("/teacher/journal");
    else if (user.role === "admin") setLocation("/admin");
    return null;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route
        path="/student/dashboard"
        component={() => (
          <ProtectedRoute component={StudentDashboard} allowedRoles={["student"]} />
        )}
      />
      <Route
        path="/teacher/journal"
        component={() => (
          <ProtectedRoute component={TeacherJournal} allowedRoles={["teacher"]} />
        )}
      />
      <Route
        path="/admin"
        component={() => (
          <ProtectedRoute component={AdminPanel} allowedRoles={["admin"]} />
        )}
      />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
