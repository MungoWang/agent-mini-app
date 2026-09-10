"use client";

import * as React from "react";
import type { ReactNode } from "react";

import { Scrollspy } from "@monkey-mini-app/ui/blocks/scrollspy";
import { useIsMobile } from "@monkey-mini-app/ui/hooks/use-mobile";
import { useLabels } from "@monkey-mini-app/ui/i18n/context";
import { cn } from "@monkey-mini-app/ui/lib/utils";

export type SettingsSection = {
  /** The anchor id. The preset puts it on the section **and** hands the same value to the jump
   *  list, so a nav that silently never highlights is not reachable from outside. */
  id: string;
  label: string;
  /** One line under the heading — what this section is for. */
  description?: string;
  content: ReactNode;
};

export type SettingsSplitProps = {
  /** The page's sections, in nav order. */
  sections: SettingsSection[];
  /** Anything above the jump list: page title, search, a plan badge. */
  nav?: ReactNode;
  /** Pinned to the bottom of the **content** pane — an unsaved-changes bar belongs to what it
   *  applies to, not to the window. */
  footer?: ReactNode;
  /** Jump-list width on wide screens, px. Default 224. */
  navWidth?: number;
  className?: string;
};

/**
 * Preferences / long-form page: a jump list that always matches the sections it scrolls to.
 *
 * Hand-rolled, this shape fails in three quiet ways: the nav's `href="#x"` and the section's
 * `id` drift apart and the highlight never moves; the whole page scrolls so the nav scrolls out
 * of view with the content it navigates; and a save bar placed after the content disappears
 * below the fold. Here the ids come from one array, the nav and the content are independent
 * scrollers, the jump list collapses to a pinned row when the panel is narrow, and `footer` is a
 * sibling of the scroller — always visible, never part of the scroll.
 *
 * @when Page shape: a settings page, integration config, or a long report with anchored sections
 * @example
 * <SettingsSplit
 *   sections={[
 *     { id: "general", label: "通用", content: <GeneralForm /> },
 *     { id: "hooks", label: "Webhook", description: "出站事件", content: <HooksForm /> },
 *   ]}
 *   nav={<PageHeader title="设置" />}
 *   footer={dirty ? <UnsavedBar onSave={save} /> : undefined}
 * />
 * @family Layout & structure
 */
export function SettingsSplit({
  sections,
  nav,
  footer,
  navWidth = 224,
  className,
}: SettingsSplitProps) {
  const isNarrow = useIsMobile();
  const t = useLabels("settingsSplit");

  // Scrollspy re-observes whenever this array identity changes, so derive it once per section list.
  const anchors = React.useMemo(
    () => sections.map(({ id, label }) => ({ id, label })),
    [sections],
  );

  const jumpList = <Scrollspy sections={anchors} />;

  const content = (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-testid="settings-split-content"
    >
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        data-testid="settings-split-scroll"
      >
        {sections.map((s) => (
          <section
            key={s.id}
            id={s.id}
            className="border-border scroll-mt-4 border-b px-6 py-6 last:border-b-0"
          >
            <h2 className="text-base font-semibold tracking-tight">
              {s.label}
            </h2>
            {s.description ? (
              <p className="text-muted-foreground mt-1 text-sm">
                {s.description}
              </p>
            ) : null}
            <div className="mt-4">{s.content}</div>
          </section>
        ))}
      </div>
      {footer ? (
        // Sibling of the scroller, not its last child: the bar cannot scroll out of view.
        <div
          className="border-border bg-background shrink-0 border-t px-6 py-3"
          data-testid="settings-split-footer"
        >
          {footer}
        </div>
      ) : null}
    </div>
  );

  if (isNarrow) {
    return (
      <div
        className={cn("flex h-full min-h-0 w-full flex-col", className)}
        data-testid="settings-split"
      >
        <div
          className="border-border bg-background shrink-0 overflow-x-auto border-b px-4 py-2"
          data-testid="settings-split-nav"
          aria-label={t.nav}
        >
          <div className="flex min-w-max items-center gap-4">
            {nav ? (
              <div className="text-muted-foreground text-xs">{nav}</div>
            ) : null}
            {jumpList}
          </div>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div
      className={cn("flex h-full min-h-0 w-full", className)}
      data-testid="settings-split"
      data-slot="settings-split-wide"
    >
      <aside
        className="border-border min-h-0 w-56 shrink-0 overflow-y-auto border-r px-4 py-6"
        data-testid="settings-split-nav"
        aria-label={t.nav}
        style={{ width: navWidth }}
      >
        {nav ? <div className="mb-4">{nav}</div> : null}
        {jumpList}
      </aside>
      {content}
    </div>
  );
}
