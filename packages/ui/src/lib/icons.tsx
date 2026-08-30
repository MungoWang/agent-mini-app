/**
 * Icon namespace re-export from lucide-react.
 *
 * Apps import it from the UI library (never from lucide-react directly):
 *
 *   import { Icon } from "@monkey-mini-app/ui";
 *   <Icon.HelpCircle size={16} strokeWidth={2} />
 *
 * The namespace keeps the whole lucide set available so authors aren't limited
 * to a curated list; discovery is steered by skills/references/icons.md (a short
 * "when to use" reference), not by dumping every icon name here. `Icon` accepts
 * any lucide React component name (PascalCase).
 */
import * as Icon from "lucide-react";

export { Icon };
