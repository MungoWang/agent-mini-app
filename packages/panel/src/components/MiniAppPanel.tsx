import { usePanelState } from "../store.ts";
import { ListRegion } from "./AppList.tsx";
import { Browse } from "./Browse.tsx";
import { Modal } from "./Modal.tsx";
import { Settings } from "./Settings.tsx";
import { Tabs } from "./Tabs.tsx";
import { Toolbar } from "./Toolbar.tsx";

export function MiniAppPanel() {
  const s = usePanelState();
  const listVisible = s.active === "all";
  return (
    <>
      <div className="mma-chrome">
        <Tabs />
        <Toolbar />
      </div>
      <div className="mma-stage">
        {listVisible ? <ListRegion /> : null}
        <div id="mma-frames" className="mma-frames" style={{ display: listVisible ? "none" : "block" }} />
      </div>
      <Settings />
      <Browse />
      <Modal />
    </>
  );
}
