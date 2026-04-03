import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 10;

const STATUS_LABELS: Record<string, string> = {
  all: "Все статусы",
  not_submitted: "Не отправлено",
  submitted: "Отправлено",
  graded: "Оценено",
};

const STATUS_COLORS: Record<string, string> = {
  graded: "bg-accent text-accent-foreground",
  submitted: "bg-secondary text-secondary-foreground",
  not_submitted: "bg-muted text-muted-foreground",
};

export default function TeacherJournal() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { user, logout } = useAuth();

  // Читаем фильтры из URL (сохранение состояния при навигации)
  const params = new URLSearchParams(search);
  const [selectedLabId, setSelectedLabId] = useState<number>(
    Number(params.get("lab") ?? 1),
  );
  const [statusFilter, setStatusFilter] = useState<string>(
    params.get("status") ?? "all",
  );
  const [minGrade, setMinGrade] = useState<string>(params.get("minGrade") ?? "");
  const [maxGrade, setMaxGrade] = useState<string>(params.get("maxGrade") ?? "");
  const [page, setPage] = useState<number>(Number(params.get("page") ?? 1));

  // Редактирование оценки
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editGrade, setEditGrade] = useState("");
  const [editFeedback, setEditFeedback] = useState("");

  // Синхронизируем фильтры с URL
  useEffect(() => {
    const p = new URLSearchParams();
    p.set("lab", String(selectedLabId));
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (minGrade) p.set("minGrade", minGrade);
    if (maxGrade) p.set("maxGrade", maxGrade);
    if (page > 1) p.set("page", String(page));
    const newSearch = p.toString();
    setLocation(`/teacher/journal${newSearch ? `?${newSearch}` : ""}`, { replace: true });
  }, [selectedLabId, statusFilter, minGrade, maxGrade, page]);

  const studentsQuery = trpc.teacher.students.useQuery();
  const submissionsQuery = trpc.teacher.submissions.useQuery({
    labId: selectedLabId,
    status:
      statusFilter === "all"
        ? undefined
        : (statusFilter as "not_submitted" | "submitted" | "graded"),
    minGrade: minGrade !== "" ? Number(minGrade) : undefined,
    maxGrade: maxGrade !== "" ? Number(maxGrade) : undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const gradeMutation = trpc.teacher.gradeSubmission.useMutation({
    onSuccess: () => {
      submissionsQuery.refetch();
      toast.success("Оценка сохранена");
      setEditingId(null);
      setEditGrade("");
      setEditFeedback("");
    },
    onError: (err) => toast.error(err.message),
  });

  const downloadMutation = trpc.teacher.downloadFile.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const handleGrade = (submissionId: number) => {
    const gradeNum = Number(editGrade);
    if (!editGrade || isNaN(gradeNum) || gradeNum < 0 || gradeNum > 100) {
      toast.error("Введите оценку от 0 до 100");
      return;
    }
    gradeMutation.mutate({ submissionId, grade: gradeNum, feedback: editFeedback });
  };

  const handleDownload = async (fileKey: string) => {
    const result = await downloadMutation.mutateAsync({ fileKey });
    window.open(result.url, "_blank");
  };

  const getStudentName = (studentId: number) =>
    studentsQuery.data?.find((s) => s.id === studentId)?.name ?? `#${studentId}`;

  const resetFilters = () => {
    setStatusFilter("all");
    setMinGrade("");
    setMaxGrade("");
    setPage(1);
  };

  const submissions = submissionsQuery.data?.items ?? [];
  const total = submissionsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">LabMtuci</h1>
            <p className="text-sm text-muted-foreground">Журнал преподавателя</p>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-sm font-semibold text-foreground">{user?.name ?? user?.username}</p>
            <Button variant="outline" onClick={handleLogout}>
              Выход
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-1">Проверка работ</h2>
          <p className="text-muted-foreground">Оценивайте работы и оставляйте отзывы</p>
        </div>

        {/* Выбор лабораторной */}
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Button
              key={n}
              variant={selectedLabId === n ? "default" : "outline"}
              className={selectedLabId === n ? "bg-accent text-accent-foreground" : ""}
              onClick={() => {
                setSelectedLabId(n);
                setPage(1);
              }}
            >
              Лаб. №{n}
            </Button>
          ))}
        </div>

        {/* Панель фильтров */}
        <Card className="p-4">
          <p className="text-sm font-semibold text-foreground mb-3">Фильтры</p>
          <div className="flex flex-wrap gap-4 items-end">
            {/* Статус */}
            <div className="space-y-1 min-w-40">
              <Label className="text-xs text-muted-foreground">Статус</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Минимальная оценка */}
            <div className="space-y-1 w-28">
              <Label className="text-xs text-muted-foreground">Оценка от</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="0"
                value={minGrade}
                onChange={(e) => {
                  setMinGrade(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-sm"
              />
            </div>

            {/* Максимальная оценка */}
            <div className="space-y-1 w-28">
              <Label className="text-xs text-muted-foreground">Оценка до</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="100"
                value={maxGrade}
                onChange={(e) => {
                  setMaxGrade(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-sm"
              />
            </div>

            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground">
              Сбросить
            </Button>
          </div>
        </Card>

        {/* Таблица */}
        <Card className="overflow-hidden">
          {submissionsQuery.isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="animate-spin text-accent" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted border-b border-border">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-foreground">Студент</th>
                      <th className="px-6 py-3 text-left font-semibold text-foreground">Файл</th>
                      <th className="px-6 py-3 text-left font-semibold text-foreground">Статус</th>
                      <th className="px-6 py-3 text-left font-semibold text-foreground">Оценка</th>
                      <th className="px-6 py-3 text-left font-semibold text-foreground">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                          Работы не найдены
                        </td>
                      </tr>
                    ) : (
                      submissions.map((sub) => (
                        <tr
                          key={sub.id}
                          className="border-b border-border hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-6 py-4 font-medium text-foreground">
                            {getStudentName(sub.studentId)}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {sub.fileKey ? (
                              <button
                                onClick={() => handleDownload(sub.fileKey!)}
                                className="text-accent hover:underline"
                              >
                                📥 {sub.fileName}
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                STATUS_COLORS[sub.status] ?? ""
                              }`}
                            >
                              {STATUS_LABELS[sub.status] ?? sub.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-foreground">
                            {editingId === sub.id ? (
                              <div className="flex gap-2 items-center">
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={editGrade}
                                  onChange={(e) => setEditGrade(e.target.value)}
                                  placeholder="0–100"
                                  className="w-20 h-7 text-xs"
                                />
                                <Button
                                  size="sm"
                                  className="h-7 bg-accent text-accent-foreground"
                                  onClick={() => handleGrade(sub.id)}
                                  disabled={gradeMutation.isPending}
                                >
                                  ✓
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7"
                                  onClick={() => setEditingId(null)}
                                >
                                  ✕
                                </Button>
                              </div>
                            ) : (
                              sub.grade ?? "—"
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {editingId === sub.id ? (
                              <Input
                                value={editFeedback}
                                onChange={(e) => setEditFeedback(e.target.value)}
                                placeholder="Отзыв..."
                                className="h-7 text-xs"
                              />
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingId(sub.id);
                                  setEditGrade(sub.grade ?? "");
                                  setEditFeedback(sub.feedback ?? "");
                                }}
                              >
                                Оценить
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Пагинация */}
              <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-muted/30">
                <span className="text-xs text-muted-foreground">
                  {total} {total === 1 ? "запись" : "записей"}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs font-medium">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
