"use client";

import { useEffect, useState } from "react";
import type { Article } from "@/types/database";
import { fetchLatestArticles } from "@/lib/dashboard-api";
import { useToast } from "@/providers/ToastProvider";
import { LatestNewsWidget } from "@/components/dashboard/LatestNewsWidget";
import { WidgetSkeleton } from "@/components/dashboard/WidgetSkeleton";
import type { DashboardWidgetProps } from "@/lib/dashboard-widgets";

export function LatestNewsSelfWidget({
  index,
  className,
}: DashboardWidgetProps) {
  const toast = useToast();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchLatestArticles(controller.signal)
      .then((res) => {
        setArticles(res);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded(true);
        toast.error(
          err instanceof Error ? err.message : "Hírek betöltése sikertelen",
        );
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) return <WidgetSkeleton className={className} rows={4} />;
  return (
    <LatestNewsWidget articles={articles} index={index} className={className} />
  );
}
