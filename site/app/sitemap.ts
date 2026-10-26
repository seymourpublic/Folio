import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

const routes = [
  { path: "", priority: 1 },
  { path: "/download", priority: 0.9 },
  { path: "/roadmap", priority: 0.7 },
  { path: "/docs", priority: 0.8 },
  { path: "/docs/installation", priority: 0.7 },
  { path: "/docs/user-guide", priority: 0.7 },
  { path: "/docs/keyboard-shortcuts", priority: 0.6 },
  { path: "/docs/faq", priority: 0.6 },
  { path: "/docs/troubleshooting", priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return routes.map((route) => ({
    url: `${site.url}${route.path}`,
    lastModified,
    changeFrequency: "monthly",
    priority: route.priority,
  }));
}
