"use client";

import { useState, useCallback } from "react";
import { PromptForm } from "@/components/prompt-form";
import { JobTracker } from "@/components/job-tracker";
import { Stagger, StaggerItem } from "@/components/motion/reveal";

/** Window 0: the prompt card on the left, the queue on the right. */
export function HomeView() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <Stagger className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <StaggerItem className="min-w-0">
        <PromptForm onCreated={handleCreated} />
      </StaggerItem>
      <StaggerItem className="min-w-0">
        <JobTracker refreshKey={refreshKey} />
      </StaggerItem>
    </Stagger>
  );
}
