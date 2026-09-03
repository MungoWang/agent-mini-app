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

export default function MiscChartsBlocks06Example() {
  return (
    <>
      <div className="flex flex-col gap-3">
        <DescriptionList
          items={[
            { label: "Owner", value: "Ada" },
            { label: "Env", value: "stg" },
          ]}
        />
        <RequestInspector method="GET" url="/runs" response='{"ok":true}' />
        <Terminal lines={["$ pnpm test", "ok"]} />
        <FileTree nodes={[{ id: "src", label: "src", children: [{ id: "a", label: "a.ts" }] }]} />
        <AttachmentGallery files={[{ name: "shot.png" }]} />
      </div>
    </>
  );
}
