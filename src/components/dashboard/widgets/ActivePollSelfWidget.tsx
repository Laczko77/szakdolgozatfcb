"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPolls, type EnrichedPoll } from "@/lib/polls-api";
import { useToast } from "@/providers/ToastProvider";
import { ActivePollWidget } from "@/components/dashboard/ActivePollWidget";
import { WidgetSkeleton } from "@/components/dashboard/WidgetSkeleton";
import type { DashboardWidgetProps } from "@/lib/dashboard-widgets";

export function ActivePollSelfWidget({
  index,
  className,
}: DashboardWidgetProps) {
  const toast = useToast();
  const [poll, setPoll] = useState<EnrichedPoll | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(
    (signal?: AbortSignal) =>
      fetchPolls({ status: "active" }, signal).then((polls) => {
        setPoll(polls[0] ?? null);
        setLoaded(true);
      }),
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal).catch((err: unknown) => {
      if (controller.signal.aborted) return;
      setLoaded(true);
      toast.error(
        err instanceof Error
          ? err.message
          : "Aktív szavazás betöltése sikertelen",
      );
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  if (!loaded) return <WidgetSkeleton className={className} rows={3} />;

  return (
    <ActivePollWidget
      poll={poll}
      index={index}
      onVoteCast={() => {
        // Re-fetch the poll after a vote so the widget collapses
        // to its "voted" state.
        void refresh().catch(() => {
          /* swallow — child component already toasts on failure */
        });
      }}
      className={className}
    />
  );
}
