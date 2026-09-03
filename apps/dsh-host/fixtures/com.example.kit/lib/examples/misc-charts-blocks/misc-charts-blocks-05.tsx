/**
 * @group charts-blocks
 * @title ActivityFeed / NotificationCenter / CommentThread / TestStepList
 * @scenario Feed-style blocks: ActivityFeed, NotificationCenter and CommentThread share an items-in / rows-out shape; TestStepList shows pass/fail steps per case.
 */
import { ActivityFeed, CommentThread, NotificationCenter, TestStepList } from "@monkey-mini-app/ui";

export default function MiscChartsBlocks05Example() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <ActivityFeed items={[{ id: "1", title: "Deployed", time: "10:00" }]} />
        <NotificationCenter items={[{ id: "1", title: "Build failed", body: "login-spec" }]} />
        <CommentThread comments={[{ id: "1", author: "Ada", body: "Looks good", time: "now" }]} />
        <TestStepList
          steps={[
            { id: "1", title: "Login", status: "pass" },
            { id: "2", title: "Checkout", status: "fail" },
          ]}
        />
      </div>
    </>
  );
}
