import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

interface Laboratory {
  id: number;
  number: number;
  title: string;
  description: string | null;
  topic: string | null;
}

interface Submission {
  id: number;
  studentId: number;
  labId: number;
  fileUrl: string | null;
  fileName: string | null;
  status: "not_submitted" | "submitted" | "graded";
  grade: string | null;
  feedback: string | null;
}

export default function StudentDashboard() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<any>(null);
  const [labs, setLabs] = useState<Laboratory[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const labsQuery = trpc.labs.list.useQuery();
  const submissionsQuery = trpc.student.submissions.useQuery();
  const uploadMutation = trpc.student.uploadFile.useMutation();

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      setLocation("/");
      return;
    }
    setUser(JSON.parse(userData));
  }, [setLocation]);

  useEffect(() => {
    if (labsQuery.data) {
      setLabs(labsQuery.data);
    }
  }, [labsQuery.data]);

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

  const handleFileUpload = async (labId: number, file: File) => {
    setIsUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const result = (e.target?.result as string).split(",")[1];
            resolve(result);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await uploadMutation.mutateAsync({
        labId,
        fileName: file.name,
        fileData: base64,
      });

      toast.success("File uploaded successfully!");
      submissionsQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  if (labsQuery.isLoading || submissionsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const getSubmissionStatus = (labId: number) => {
    return submissions.find((s) => s.labId === labId);
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

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">LabMtuci</h1>
            <p className="text-sm text-muted-foreground">Профиль студента</p>
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
            Лабораторные работы
          </h2>
          <p className="subtitle">Загрузите ваши работы для проверки</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {labs.map((lab) => {
            const submission = getSubmissionStatus(lab.id);
            return (
              <Card key={lab.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      Лабораторная работа №{lab.number}
                    </h3>
                    <p className="text-sm text-muted-foreground">{lab.topic}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                      submission?.status || "not_submitted"
                    )}`}
                  >
                    {getStatusText(submission?.status || "not_submitted")}
                  </span>
                </div>

                <p className="text-sm text-foreground mb-4">{lab.description}</p>

                {submission?.grade !== undefined && (
                  <div className="mb-4 p-3 bg-muted rounded-lg">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">
                      Оценка
                    </p>
                    <p className="text-2xl font-bold text-accent">
                      {submission.grade}/100
                    </p>
                    {submission.feedback && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {submission.feedback}
                      </p>
                    )}
                  </div>
                )}

                {submission?.fileName && (
                  <div className="mb-4 p-3 bg-muted rounded-lg">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">
                      Загруженный файл
                    </p>
                    <p className="text-sm text-foreground truncate">
                      {submission.fileName}
                    </p>
                  </div>
                )}

                <label className="block w-full">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleFileUpload(lab.id, e.target.files[0]);
                      }
                    }}
                    disabled={isUploading}
                  />
                  <Button
                    className="w-full cursor-pointer bg-accent text-accent-foreground hover:opacity-90"
                    disabled={isUploading}
                    onClick={(e) => {
                      e.preventDefault();
                      (e.currentTarget.parentElement?.querySelector('input[type="file"]') as HTMLInputElement)?.click();
                    }}
                  >
                    {isUploading ? "Загрузка..." : "📁 Загрузить файл"}
                  </Button>
                </label>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
