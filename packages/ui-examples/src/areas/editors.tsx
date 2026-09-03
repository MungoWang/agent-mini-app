import CodeEditor01Example from "../components/code-editor/code-editor-01";
import JqlInput01Example from "../components/jql-input/jql-input-01";
import MarkdownEditor01Example from "../components/markdown-editor/markdown-editor-01";
import MiscEditors01Example from "../components/misc-editors/misc-editors-01";
import MiscEditors02Example from "../components/misc-editors/misc-editors-02";
import RichTextEditor01Example from "../components/rich-text-editor/rich-text-editor-01";
import { Example } from "../shared/example";

export function EditorExamples() {
  return (
    <>
      <Example id="rich-text-editor" title="RichTextEditor" hint="Tiptap — toolbar is live">
        <RichTextEditor01Example />
      </Example>
      <Example id="code-editor" title="CodeEditor" hint="CodeMirror 6">
        <CodeEditor01Example />
      </Example>
      <Example id="markdown-editor" title="MarkdownEditor" hint="Left CodeMirror, right live GFM preview">
        <MarkdownEditor01Example />
      </Example>
      <Example id="diff-viewer" title="DiffViewer" hint="PR-style hunks, line numbers, unified/split">
        <MiscEditors01Example />
      </Example>
      <Example id="jira-wiki" title="JiraWiki" hint="Left markup, right live preview">
        <MiscEditors02Example />
      </Example>
      <Example id="jql-input" title="JqlInput" hint="CodeMirror JQL · type to complete fields">
        <JqlInput01Example />
      </Example>
    </>
  );
}
