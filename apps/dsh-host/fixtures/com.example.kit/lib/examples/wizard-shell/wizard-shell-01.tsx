/**
 * @exampleOf WizardShell
 * @title WizardShell
 * @scenario Three-step import in a fixed-height panel: the step rail tracks progress, the body scrolls, and Back/Next stay exactly where they were across every step change.
 * @hint Step 2 starts invalid — Next is disabled until the mapping is filled in
 */
import * as React from "react";

import { Button, Input, WizardShell } from "@monkey-mini-app/ui";

export default function WizardShell01Example() {
  const [step, setStep] = React.useState(0);
  const [file, setFile] = React.useState("");
  const [mapped, setMapped] = React.useState("");

  const steps = [
    { id: "pick", label: "Choose file", valid: file.trim().length > 0 },
    { id: "map", label: "Map columns", valid: mapped.trim().length > 0 },
    { id: "run", label: "Import", valid: true },
  ];

  const body =
    step === 0 ? (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">A workbook already on this machine.</p>
        <Input placeholder="ledger-2026-09.xlsx" value={file} onChange={(e) => setFile(e.target.value)} />
      </div>
    ) : step === 1 ? (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          Which column is the account id? Required before the import can run.
        </p>
        <Input placeholder="account_id" value={mapped} onChange={(e) => setMapped(e.target.value)} />
      </div>
    ) : (
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          Import <b>{file}</b>, mapping account from <b>{mapped}</b>.
        </p>
        <Button variant="outline" size="sm" className="w-fit">
          Advanced options
        </Button>
      </div>
    );

  return (
    <div className="h-[420px]">
      <WizardShell
        steps={steps}
        index={step}
        body={body}
        onBack={() => setStep((s) => Math.max(0, s - 1))}
        onNext={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
        onSubmit={() => setStep(0)}
      />
    </div>
  );
}
