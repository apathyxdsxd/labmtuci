import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, CloudSun, Thermometer } from "lucide-react";

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

interface WeatherData {
  temperature: number;
  weatherCode: number;
  city: string;
}

// Коды погоды WMO → понятный текст
function weatherLabel(code: number): string {
  if (code === 0) return "Ясно";
  if (code <= 3) return "Облачно";
  if (code <= 48) return "Туман";
  if (code <= 67) return "Дождь";
  if (code <= 77) return "Снег";
  if (code <= 82) return "Ливень";
  return "Гроза";
}

export default function StudentDashboard() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [labs, setLabs] = useState<Laboratory[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Сторонний API — погода (Open-Meteo, без ключа)
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState(false);

  const labsQuery = trpc.labs.list.useQuery();
  const submissionsQuery = trpc.student.submissions.useQuery();
  const uploadMutation = trpc.student.uploadFile.useMutation();

  // Загружаем лабы/работы
  useEffect(() => { if (labsQuery.data) setLabs(labsQuery.data); }, [labsQuery.data]);
  useEffect(() => { if (submissionsQuery.data) setSubmissions(submissionsQuery.data); }, [submissionsQuery.data]);

  // Загружаем погоду через наш серверный прокси
  useEffect(() => {
    let cancelled = false;
    fetch("/api/weather")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: WeatherData) => { if (!cancelled) setWeather(data); })
      .catch(() => { if (!cancelled) setWeatherError(true); })
      .finally(() => { if (!cancelled) setWeatherLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const handleFileUpload = async (labId: number, file: File) => {
    setIsUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try { resolve((e.target?.result as string).split(",")[1]); }
          catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await uploadMutation.mutateAsync({ labId, fileName: file.name, fileData: base64 });
      toast.success("Файл загружен!");
      submissionsQuery.refetch();
    } catch (err: any) {
      toast.error(err.message ?? "Ошибка загрузки");
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

  const getSubmission = (labId: number) => submissions.find((s) => s.labId === labId);

  const statusColor: Record<string, string> = {
    graded: "bg-accent text-accent-foreground",
    submitted: "bg-secondary text-secondary-foreground",
    not_submitted: "bg-muted text-muted-foreground",
  };

  const statusText: Record<string, string> = {
    graded: "✓ Оценено",
    submitted: "✓ Отправлено",
    not_submitted: "○ Не отправлено",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Шапка */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">LabMtuci</h1>
            <p className="text-sm text-muted-foreground">Профиль студента</p>
          </div>
          <div className="flex items-center gap-4">
            <p className="font-semibold text-foreground text-sm">{user?.name ?? user?.username}</p>
            <Button variant="outline" onClick={handleLogout}>Выход</Button>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-8">
        {/* Виджет погоды — данные стороннего API */}
        <Card className="p-4 flex items-center gap-4 w-fit">
          <CloudSun className="w-6 h-6 text-accent shrink-0" />
          {weatherLoading ? (
            <span className="text-sm text-muted-foreground">Загрузка погоды…</span>
          ) : weatherError || !weather ? (
            <span className="text-sm text-muted-foreground">Погода недоступна</span>
          ) : (
            <div>
              <p className="text-sm font-semibold text-foreground">
                {weather.city}: {weather.temperature}°C, {weatherLabel(weather.weatherCode)}
              </p>
              <p className="text-xs text-muted-foreground">На улице сейчас</p>
            </div>
          )}
        </Card>

        <div>
          <h2 className="text-3xl font-bold text-foreground mb-1">Лабораторные работы</h2>
          <p className="text-muted-foreground text-sm">Загрузите ваши работы для проверки</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {labs.map((lab) => {
            const sub = getSubmission(lab.id);
            const status = sub?.status ?? "not_submitted";
            return (
              <Card key={lab.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      Лаб. №{lab.number}
                    </h3>
                    <p className="text-sm text-muted-foreground">{lab.topic}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor[status]}`}>
                    {statusText[status]}
                  </span>
                </div>

                <p className="text-sm text-foreground mb-4">{lab.description}</p>

                {sub?.grade != null && (
                  <div className="mb-4 p-3 bg-muted rounded-lg">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Оценка</p>
                    <p className="text-2xl font-bold text-accent">{sub.grade}/100</p>
                    {sub.feedback && (
                      <p className="text-xs text-muted-foreground mt-2">{sub.feedback}</p>
                    )}
                  </div>
                )}

                {sub?.fileName && (
                  <div className="mb-4 p-3 bg-muted rounded-lg">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Загруженный файл</p>
                    <p className="text-sm text-foreground truncate">{sub.fileName}</p>
                  </div>
                )}

                <label className="block w-full">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFileUpload(lab.id, e.target.files[0]);
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
                    {isUploading ? "Загрузка…" : "📁 Загрузить файл"}
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
