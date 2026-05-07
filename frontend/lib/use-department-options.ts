"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { ALL_DEPARTMENTS } from "@/lib/gov-catalog";

export function useDepartmentOptions(extraDepartments: string[] = []) {
  const [catalogDepartments, setCatalogDepartments] = useState<string[]>([
    ...ALL_DEPARTMENTS,
  ]);

  useEffect(() => {
    void Promise.resolve().then(async () => {
      try {
        const options = await api.auth.options();
        const names = options.departments.map((department) => department.name);
        if (names.length > 0) {
          setCatalogDepartments(names);
        }
      } catch {
        // Keep shared frontend fallback catalog when the backend is unavailable.
      }
    });
  }, []);

  return useMemo(
    () =>
      Array.from(
        new Set([
          ...catalogDepartments,
          ...extraDepartments.filter(Boolean),
        ]),
      ),
    [catalogDepartments, extraDepartments],
  );
}
