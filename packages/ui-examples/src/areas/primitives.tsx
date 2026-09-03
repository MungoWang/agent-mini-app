import Alert01Example from "../components/alert/alert-01";
import AspectRatio01Example from "../components/aspect-ratio/aspect-ratio-01";
import Attachment01Example from "../components/attachment/attachment-01";
import Breadcrumb01Example from "../components/breadcrumb/breadcrumb-01";
import Bubble01Example from "../components/bubble/bubble-01";
import ButtonGroup01Example from "../components/button-group/button-group-01";
import Card01Example from "../components/card/card-01";
import Empty01Example from "../components/empty/empty-01";
import Item01Example from "../components/item/item-01";
import Marker01Example from "../components/marker/marker-01";
import MiscPrimitives01Example from "../components/misc-primitives/misc-primitives-01";
import MiscPrimitives02Example from "../components/misc-primitives/misc-primitives-02";
import MiscPrimitives03Example from "../components/misc-primitives/misc-primitives-03";
import Pagination01Example from "../components/pagination/pagination-01";
import Progress01Example from "../components/progress/progress-01";
import Separator01Example from "../components/separator/separator-01";
import Skeleton01Example from "../components/skeleton/skeleton-01";
import Spinner01Example from "../components/spinner/spinner-01";
import Table01Example from "../components/table/table-01";
import Toggle01Example from "../components/toggle/toggle-01";
import ToggleGroup01Example from "../components/toggle-group/toggle-group-01";
import { Example } from "../shared/example";

export function PrimitiveExamples() {
  return (
    <>
      <Example id="button" title="Button / ButtonGroup">
        <ButtonGroup01Example />
      </Example>
      <Example id="badge-avatar-kbd" title="Badge / Avatar / Kbd">
        <MiscPrimitives01Example />
      </Example>
      <Example id="alert-empty-skeleton-alert" title="Alert">
        <Alert01Example />
      </Example>
      <Example id="alert-empty-skeleton-empty" title="Empty">
        <Empty01Example />
      </Example>
      <Example id="alert-empty-skeleton-skeleton" title="Skeleton">
        <Skeleton01Example />
      </Example>
      <Example id="alert-empty-skeleton-spinner" title="Spinner">
        <Spinner01Example />
      </Example>
      <Example id="alert-empty-skeleton-progress" title="Progress">
        <Progress01Example />
      </Example>
      <Example id="tabs-accordion-collapsible" title="Tabs / Accordion / Collapsible">
        <MiscPrimitives02Example />
      </Example>
      <Example id="toggle-toggle" title="Toggle">
        <Toggle01Example />
      </Example>
      <Example id="toggle-toggle-group" title="ToggleGroup">
        <ToggleGroup01Example />
      </Example>
      <Example id="table-card-separator-breadcrumb" title="Breadcrumb">
        <Breadcrumb01Example />
      </Example>
      <Example id="table-card-separator-card" title="Card">
        <Card01Example />
      </Example>
      <Example id="table-card-separator-separator" title="Separator">
        <Separator01Example />
      </Example>
      <Example id="table-card-separator-table" title="Table">
        <Table01Example />
      </Example>
      <Example id="pagination" title="Pagination">
        <Pagination01Example />
      </Example>
      <Example id="chat-surface-bubble" title="Bubble">
        <Bubble01Example />
      </Example>
      <Example id="chat-surface-marker" title="Marker">
        <Marker01Example />
      </Example>
      <Example id="chat-surface-attachment" title="Attachment">
        <Attachment01Example />
      </Example>
      <Example id="chat-surface-item" title="Item">
        <Item01Example />
      </Example>
      <Example id="aspect-ratio" title="AspectRatio">
        <AspectRatio01Example />
      </Example>
      <Example id="scroll-resizable" title="ScrollArea / Resizable / InputGroup / Calendar / Message">
        <MiscPrimitives03Example />
      </Example>
    </>
  );
}
