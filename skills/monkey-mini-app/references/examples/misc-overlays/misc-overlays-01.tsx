/**
 * @group overlays
 * @title Sheet / Drawer
 * @scenario Two side surfaces: Sheet (persistent app side panel, desktop) vs Drawer (bottom-anchored, touch-first). Same trigger/content API.
 */
import { Button, Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@monkey-mini-app/ui";

export default function MiscOverlays01Example() {
  return (
    <>
        <div className="flex gap-2">
          <Sheet>
            <SheetTrigger render={<Button variant="outline" />}>Open sheet</SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Inspector</SheetTitle>
              </SheetHeader>
            </SheetContent>
          </Sheet>
          <Drawer>
            <DrawerTrigger render={<Button variant="outline" />}>Open drawer</DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Drawer</DrawerTitle>
              </DrawerHeader>
            </DrawerContent>
          </Drawer>
        </div>
    </>
  );
}
