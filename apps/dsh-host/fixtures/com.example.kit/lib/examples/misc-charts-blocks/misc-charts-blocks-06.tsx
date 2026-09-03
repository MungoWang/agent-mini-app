/**
 * @group charts-blocks
 * @title DescriptionList / RequestInspector / Terminal / FileTree / AttachmentGallery
 * @scenario Inspect/debug kit on one screen: DescriptionList for metadata, RequestInspector for a method/url/response, Terminal for command output, FileTree and AttachmentGallery for artifacts.
 */
import {
  AttachmentGallery,
  DescriptionList,
  FileTree,
  RequestInspector,
  Terminal,
} from "@monkey-mini-app/ui";

const REQUEST = JSON.stringify(
  {
    buildId: 4812,
    reason: "flaky: VehicleDamageSpec.TimeoutWhenQueueFull",
    keepArtifacts: true,
    notify: ["pwang12"],
  },
  null,
  2,
);

const RESPONSE = JSON.stringify(
  {
    ok: true,
    data: {
      buildId: 4813,
      status: "queued",
      runner: "macstadium-07",
      estimatedSeconds: 420,
    },
    traceId: "6f2c1a48d0b74e1f",
  },
  null,
  2,
);

export default function MiscChartsBlocks06Example() {
  return (
    <div className="flex flex-col gap-3">
      <DescriptionList
        items={[
          { label: "Pipeline", value: "gls-2.0 / api-cn-stg" },
          { label: "Build", value: "#4812 · failed after 7m 12s" },
          { label: "Commit", value: "a3f9c21 fix(veh): 排班道闸超时改 30s" },
          { label: "Triggered by", value: "pwang12 (manual retry #1)" },
        ]}
      />
      <RequestInspector
        method="POST"
        url="/api/v2/pipelines/gls-2.0/builds/4812/retry"
        request={REQUEST}
        response={RESPONSE}
      />
      <Terminal
        lines={[
          "$ pnpm vitest run tests/vehicle-damage.spec.ts",
          "",
          " RUN  v4.1.10  packages/api",
          " ✓ tests/vehicle-damage.spec.ts > list damages by lane",
          " × tests/vehicle-damage.spec.ts > timeout when queue is full",
          "   → expected 200 to be 202 // retried 3 times in 30s",
          "",
          " Test Files  1 failed | 41 passed (42)",
          "      Tests  1 failed | 588 passed (589)",
          "   Duration  31.44s (transform 4.2s, setup 0ms, collect 18.9s)",
        ]}
      />
      <FileTree
        nodes={[
          {
            id: "artifacts",
            label: "artifacts/",
            children: [
              { id: "logs", label: "logs/", children: [{ id: "api", label: "api-cn-stg.log" }] },
              { id: "cov", label: "coverage/" },
              { id: "xml", label: "junit.xml" },
            ],
          },
        ]}
      />
      <AttachmentGallery
        files={[{ name: "failure-screen.png" }, { name: "api-cn-stg.log" }, { name: "junit.xml" }]}
      />
    </div>
  );
}
