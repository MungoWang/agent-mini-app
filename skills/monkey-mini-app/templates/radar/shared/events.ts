// ⭐ key: names AND payloads live here so ui.tsx and api/ cannot drift.
//         Pure isomorphic: no React, no ctx, no DOM, no Node.
export const EV = {
  progress: "progress",
  latest: "latest",
} as const;

export type Events = {
  progress: {
    running: boolean;
    step: string;
    done: number;
    total: number;
    error?: string;
  };
  latest: {
    items: { title: string; link?: string }[];
    digest: { headline: string; bullets: string[] } | null;
    at: number;
  };
};

export type EventName = keyof Events;
export type Progress = Events["progress"];
export type Payload = Events["latest"];
