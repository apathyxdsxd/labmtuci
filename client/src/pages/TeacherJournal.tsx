import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

interface Student {
  id: number;
  username: string;
  name: string | null;
  email: string | null;
}

interface Submission {
  id: number;
  studentId: number;
  labId: number;
  fileName: string | null;
  status: "not_submitted" | "submitted" | "graded";
  grade: string | null;
  feedback: string | null;
  fileUrl: string | null;
}

export default function TeacherJournal() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<number>(1);
  const [editingSubmissionId, setEditingSubmissionId] = useState<number | null>(null);
  const [editGrade, setEditGrade] = useState("");
  const [editFeedback, setEditFeedback] = useState("");

  const studentsQuery = trpc.teacher.students.useQuery();
  const submissionsQuery = trpc.teacher.submissions.useQuery({ labId: selectedLabId });
  const gradeMutation = trpc.teacher.gradeSubmission.useMutation();
  const downloadMutation = trpc.teacher.downloadFile.useMutation();

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      setLocation("/");
      return;
    }
    setUser(JSON.parse(userData));
  }, [setLocation]);

  useEffect(() => {
    if (studentsQuery.data) {
      setStudents(studentsQuery.data);
    }
  }, [studentsQuery.data]);

  useEffect(() => {
    if (submissionsQuery.data) {
      setSubmissions(submissionsQuery.data);
    }
  }, [submissionsQuery.data]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setLocation("/");
  };

  const handleGrade = async (submissionId: number) => {
    if (!editGrade || isNaN(Number(editGrade))) {
      toast.error("Please enter a valid grade");
      return;
    }

    try {
      await gradeMutation.mutateAsync({
        submissionId,
        grade: Number(editGrade),
        feedback: editFeedback,
      });
      toast.success("Grade saved successfully!");
      setEditingSubmissionId(null);
      setEditGrade("");
      setEditFeedback("");
      submissionsQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to save grade");
    }
  };

  const handleDownload = async (fileKey: string, fileName: string) => {
    try {
      const result = await downloadMutation.mutateAsync({ fileKey });
      window.open(result.url, "_blank");
    } catch (error: any) {
      toast.error(error.message || "Failed to download file");
    }
  };

  const getStudentName = (studentId: number) => {
    return students.find((s) => s.id === studentId)?.name || "Unknown";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "graded":
        return "bg-accent text-accent-foreground";
      case "submitted":
        return "bg-secondary text-secondary-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "graded":
        return "✓ Оценено";
      case "submitted":
        return "✓ Отправлено";
      default:
        return "○ Не отправлено";
    }
  };

  if (studentsQuery.isLoading || submissionsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">LabMtuci</h1>
            <p className="text-sm text-muted-foreground">Журнал преподавателя</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-semibold text-foreground">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.username}</p>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="text-foreground border-foreground hover:bg-foreground hover:text-background"
            >
              Выход
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Проверка лабораторных работ
          </h2>
          <p className="subtitle">Оценивайте работы студентов и оставляйте отзывы</p>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map((labNum) => (
            <Button
              key={labNum}
              onClick={() => {
                setSelectedLabId(labNum);
                submissionsQuery.refetch();
              }}
              variant={selectedLabId === labNum ? "default" : "outline"}
              className={
                selectedLabId === labNum
                  ? "bg-accent text-accent-foreground"
                  : "border-border text-foreground"
              }
            >
              Лаб. №{labNum}
            </Button>
          ))}
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    Студент
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    Файл
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    Оценка
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => (
                  <tr
                    key={submission.id}
                    className="border-b border-border hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-foreground">
                      {getStudentName(submission.studentId)}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {submission.fileName ? (
                        <button
                          onClick={() =>
                            handleDownload(
                              submission.fileUrl || "",
                              submission.fileName || ""
                            )
                          }
                          className="text-accent hover:underline"
                        >
                          📥 {submission.fileName}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                          submission.status
                        )}`}
                      >
                        {getStatusText(submission.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-foreground">
                      {editingSubmissionId === submission.id ? (
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={editGrade}
                            onChange={(e) => setEditGrade(e.target.value)}
                            placeholder="0-100"
                            className="w-20"
                          />
                          <Button
                            onClick={() => handleGrade(submission.id)}
                            size="sm"
                            className="bg-accent text-accent-foreground"
                          >
                            ✓
                          </Button>
                          <Button
                            onClick={() => setEditingSubmissionId(null)}
                            size="sm"
                            variant="outline"
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <span>{submission.grade || "—"}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingSubmissionId === submission.id ? (
                        <Input
                          value={editFeedback}
                          onChange={(e) => setEditFeedback(e.target.value)}
                          placeholder="Отзыв..."
                          className="text-sm"
                        />
                      ) : (
                        <Button
                          onClick={() => {
                            setEditingSubmissionId(submission.id);
                            setEditGrade(String(submission.grade || ""));
                            setEditFeedback(submission.feedback || "");
                          }}
                          size="sm"
                          variant="outline"
                          className="text-foreground border-foreground"
                        >
                          Оценить
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {submissions.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              Нет отправленных работ для этой лабораторной
            </p>
          </Card>
        )}
      </main>
    </div>
  );
}
