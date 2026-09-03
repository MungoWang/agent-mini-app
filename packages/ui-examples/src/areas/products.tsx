import CodeBlock01Example from "../components/code-block/code-block-01";
import DiffViewer01Example from "../components/diff-viewer/diff-viewer-01";
import EventCalendar01Example from "../components/event-calendar/event-calendar-01";
import FileDropzone01Example from "../components/file-dropzone/file-dropzone-01";
import Gantt01Example from "../components/gantt/gantt-01";
import JsonViewer01Example from "../components/json-viewer/json-viewer-01";
import Kanban01Example from "../components/kanban/kanban-01";
import LogViewer01Example from "../components/log-viewer/log-viewer-01";
import SortableList01Example from "../components/sortable-list/sortable-list-01";
import Stepper01Example from "../components/stepper/stepper-01";
import Timeline01Example from "../components/timeline/timeline-01";
import TreeView01Example from "../components/tree-view/tree-view-01";
import { Example } from "../shared/example";

export function ProductExamples() {
  return (
    <>
      <Example id="stepper" title="Stepper" hint="Vertical and horizontal">
        <Stepper01Example />
      </Example>
      <Example id="timeline" title="Timeline">
        <Timeline01Example />
      </Example>
      <Example id="tree-sortable-tree-view" title="TreeView">
        <TreeView01Example />
      </Example>
      <Example id="tree-sortable-sortable-list" title="SortableList">
        <SortableList01Example />
      </Example>
      <Example id="kanban" title="Kanban" hint="Drag between columns · click a card for Jira details">
        <Kanban01Example />
      </Example>
      <Example id="calendar-gantt-event-calendar" title="EventCalendar" hint="Drag days or hours to create · All day uses date range picker">
        <EventCalendar01Example />
      </Example>
      <Example id="calendar-gantt-gantt" title="Gantt" hint="Drag days or hours to create · All day uses date range picker">
        <Gantt01Example />
      </Example>
      <Example id="dropzone" title="FileDropzone">
        <FileDropzone01Example />
      </Example>
      <Example id="inspectors-diff-viewer" title="DiffViewer">
        <DiffViewer01Example />
      </Example>
      <Example id="inspectors-json-viewer" title="JsonViewer">
        <JsonViewer01Example />
      </Example>
      <Example id="inspectors-code-block" title="CodeBlock">
        <CodeBlock01Example />
      </Example>
      <Example id="inspectors-log-viewer" title="LogViewer">
        <LogViewer01Example />
      </Example>
    </>
  );
}
