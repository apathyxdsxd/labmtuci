import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
console.log('[DEBUG] DATABASE_URL loaded:', !!process.env.DATABASE_URL);
console.log('[DEBUG] DATABASE_URL value:', process.env.DATABASE_URL);
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // --- SEO: robots.txt ---
  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send(
      [
        "User-agent: *",
        "Allow: /",
        "Disallow: /api/",
        "Disallow: /student/dashboard",
        "Disallow: /teacher/journal",
        "Disallow: /admin",
        "",
        `Sitemap: ${process.env.APP_URL ?? "https://labmtuci.example.com"}/sitemap.xml`,
      ].join("\n"),
    );
  });

  // --- SEO: sitemap.xml (только публичные страницы) ---
  app.get("/sitemap.xml", (_req, res) => {
    const base = process.env.APP_URL ?? "https://labmtuci.example.com";
    const now = new Date().toISOString().split("T")[0];
    res.type("application/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${base}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`,
    );
  });

  // --- Сторонний API: погода Open-Meteo (без ключа) ---
  // Возвращает текущую температуру в Москве, что актуально для
  // студентов, планирующих поход в университет.
  app.get("/api/weather", async (_req, res) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=55.75&longitude=37.62&current=temperature_2m,weathercode&timezone=Europe%2FMoscow",
        { signal: controller.signal },
      );
      clearTimeout(timeout);

      if (!response.ok) {
        res.status(502).json({ error: "Weather API unavailable" });
        return;
      }

      const data = (await response.json()) as {
        current: { temperature_2m: number; weathercode: number };
      };

      res.json({
        temperature: data.current.temperature_2m,
        weatherCode: data.current.weathercode,
        city: "Москва",
      });
    } catch (err: any) {
      // Graceful degradation — сервис недоступен
      res.status(503).json({ error: "Weather service temporarily unavailable" });
    }
  });
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
