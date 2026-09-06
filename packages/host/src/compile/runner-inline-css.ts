/**
 * The host's own stylesheet inside every mini-app document.
 *
 * A leaf module with no imports on purpose: `compile/platform-keyframes.ts` derives the
 * platform's reserved `@keyframes` names from this text, and `http/app-runner-html.ts`
 * interpolates it into the runner. If either side owned the constant, the other would have
 * to import across the http↔compile boundary and that is a cycle. Keeping the data in a
 * leaf is what lets both read it.
 *
 * The list is derived rather than hand-written so it cannot drift: add a keyframe here and
 * it becomes reserved on the next reload, with nothing else to remember to update.
 */
export const RUNNER_INLINE_CSS = `html,body,#root{margin:0;height:100%;background:var(--background,#fff);color:var(--foreground,#111);font-family:var(--font-sans,ui-sans-serif,system-ui,sans-serif);}
  .err{padding:24px;color:#b91c1c;white-space:pre-wrap;}
  #root.boot{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;}
  #root.boot .art{position:relative;width:88px;height:72px;color:var(--foreground,#111);}
  #root.boot .art svg{display:block;width:88px;height:64px;}
  #root.boot .dots{display:flex;gap:5px;justify-content:center;margin-top:2px;}
  #root.boot .dots i{width:6px;height:6px;border-radius:50%;background:var(--primary,#2563eb);opacity:.35;animation:mma-dot 1s ease-in-out infinite;}
  #root.boot .dots i:nth-child(2){animation-delay:.15s;}
  #root.boot .dots i:nth-child(3){animation-delay:.3s;}
  @keyframes mma-dot{0%,80%,100%{transform:translateY(0);opacity:.3}40%{transform:translateY(-5px);opacity:1}}`;
