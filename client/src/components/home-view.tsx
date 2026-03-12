"use client";

import { useState, useCallback } from "react";
import { PromptForm } from "@/components/prompt-form";
import { JobTracker } from "@/components/job-tracker";

export function HomeView() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <PromptForm onCreated={handleCreated} />
      </div>
      <div>
        <JobTracker refreshKey={refreshKey} />
      </div>
    </div>
  );
}
