import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@monkey-mini-app/ui";

export function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Card className="shadow-none">
      <CardHeader className="gap-1 border-b pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        {hint ? <CardDescription className="text-xs">{hint}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4 pt-4">{children}</CardContent>
    </Card>
  );
}
