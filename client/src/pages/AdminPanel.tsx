import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

type Role = "student" | "teacher" | "admin";

const ROLE_LABELS: Record<Role, string> = {
  student: "Студент",
  teacher: "Преподаватель",
  admin: "Администратор",
};

const ROLE_COLORS: Record<Role, string> = {
  student: "bg-blue-100 text-blue-800",
  teacher: "bg-green-100 text-green-800",
  admin: "bg-red-100 text-red-800",
};

export default function AdminPanel() {
  const [, setLocation] = useLocation();
  const { logout, user } = useAuth();
  const [pendingRole, setPendingRole] = useState<Record<number, Role>>({});

  const usersQuery = trpc.admin.users.useQuery();
  const setRoleMutation = trpc.admin.setRole.useMutation({
    onSuccess: () => {
      usersQuery.refetch();
      toast.success("Роль обновлена");
    },
    onError: (err) => toast.error(err.message),
  });
  const revokeMutation = trpc.admin.revokeUserSessions.useMutation({
    onSuccess: () => toast.success("Сессии пользователя аннулированы"),
    onError: (err) => toast.error(err.message),
  });

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const handleSetRole = (userId: number) => {
    const role = pendingRole[userId];
    if (!role) return;
    setRoleMutation.mutate({ userId, role });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Администратор</h1>
            <p className="text-muted-foreground mt-1">Управление ролями пользователей</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.username}</span>
            <Button variant="outline" onClick={handleLogout}>
              Выйти
            </Button>
          </div>
        </div>

        {/* Users table */}
        <Card className="p-0 overflow-hidden">
          {usersQuery.isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">ID</th>
                  <th className="px-4 py-3 text-left font-semibold">Логин</th>
                  <th className="px-4 py-3 text-left font-semibold">Имя</th>
                  <th className="px-4 py-3 text-left font-semibold">Текущая роль</th>
                  <th className="px-4 py-3 text-left font-semibold">Изменить роль</th>
                  <th className="px-4 py-3 text-left font-semibold">Действия</th>
                </tr>
              </thead>
              <tbody>
                {(usersQuery.data ?? []).map((u) => (
                  <tr key={u.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{u.id}</td>
                    <td className="px-4 py-3 font-medium">{u.username}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${ROLE_COLORS[u.role as Role]}`}
                      >
                        {ROLE_LABELS[u.role as Role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={pendingRole[u.id] ?? u.role}
                        onValueChange={(v) =>
                          setPendingRole((prev) => ({ ...prev, [u.id]: v as Role }))
                        }
                      >
                        <SelectTrigger className="w-40 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">Студент</SelectItem>
                          <SelectItem value="teacher">Преподаватель</SelectItem>
                          <SelectItem value="admin">Администратор</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={
                            setRoleMutation.isPending ||
                            (pendingRole[u.id] ?? u.role) === u.role
                          }
                          onClick={() => handleSetRole(u.id)}
                        >
                          Сохранить
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs"
                          disabled={revokeMutation.isPending}
                          onClick={() => revokeMutation.mutate({ userId: u.id })}
                        >
                          Сбросить сессии
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
