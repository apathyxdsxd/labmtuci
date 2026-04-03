import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";

type Role = "student" | "teacher";

export default function Login() {
  const [, setLocation] = useLocation();
  const [role, setRole] = useState<Role | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loginMutation = trpc.auth.login.useMutation();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!role) {
      toast.error("Please select a role");
      return;
    }

    if (!username || !password) {
      toast.error("Please enter username and password");
      return;
    }

    setIsLoading(true);

    try {
      const result = await loginMutation.mutateAsync({
        username,
        password,
      });

      login(
        {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          accessTokenExpiresAt: result.accessTokenExpiresAt,
        },
        result.user,
      );
      toast.success("Вход выполнен!");

      if (result.user.role === "student") {
        setLocation("/student/dashboard");
      } else if (result.user.role === "teacher") {
        setLocation("/teacher/journal");
      } else {
        setLocation("/admin");
      }
    } catch (error: any) {
      toast.error(error.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute top-10 left-10 w-32 h-32 bg-accent rounded-full opacity-10 blur-3xl"></div>
      <div className="absolute bottom-10 right-10 w-40 h-40 bg-secondary rounded-full opacity-10 blur-3xl"></div>

      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">LabMtuci</h1>
          <p className="subtitle">Система сдачи лабораторных работ</p>
        </div>

        {!role ? (
          <div className="space-y-4">
            <p className="text-center text-foreground font-semibold mb-6">
              Выберите вашу роль
            </p>
            <Button
              onClick={() => setRole("student")}
              className="w-full py-6 text-lg font-semibold bg-accent hover:opacity-90"
            >
              👨‍🎓 Студент
            </Button>
            <Button
              onClick={() => setRole("teacher")}
              className="w-full py-6 text-lg font-semibold bg-secondary hover:opacity-90"
            >
              👨‍🏫 Преподаватель
            </Button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm font-semibold text-foreground">
                {role === "student" ? "👨‍🎓 Студент" : "👨‍🏫 Преподаватель"}
              </p>
              <button
                type="button"
                onClick={() => setRole(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Изменить
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Логин
              </label>
              <Input
                type="text"
                placeholder="Введите логин"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Пароль
              </label>
              <Input
                type="password"
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 font-semibold bg-foreground text-background hover:opacity-90"
            >
              {isLoading ? "Вход..." : "Войти"}
            </Button>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <p className="text-xs font-semibold text-foreground mb-2">
                Тестовые учетные данные:
              </p>
              <p className="text-xs text-muted-foreground">
                Студент: student1 / student123
              </p>
              <p className="text-xs text-muted-foreground">
                Преподаватель: teacher / teacher123
              </p>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
