import { Tabs, TabsContent, TabsList, TabsTrigger } from "@monkey-mini-app/ui/components/tabs"
import { CodeBlock } from "@monkey-mini-app/ui/products/code-block"

/**
 * Side-by-side HTTP request/response panel.
 * @when Debugging one API call: method, url, bodies. Multiple calls streaming → `LogViewer`.
 * @example
 * <RequestInspector method="POST" url="/api/x" response="{\"ok\":true}" />
 * @family Discovery & inspect
 */
export function RequestInspector({
  method,
  url,
  request,
  response,
}: {
  method: string
  url: string
  request?: string
  response?: string
}) {
  return (
    <div data-testid="request-inspector" className="flex flex-col gap-2">
      <div className="font-mono text-sm">
        <span className="font-medium">{method}</span> {url}
      </div>
      <Tabs defaultValue="response">
        <TabsList>
          <TabsTrigger value="request">Request</TabsTrigger>
          <TabsTrigger value="response">Response</TabsTrigger>
        </TabsList>
        <TabsContent value="request">
          <CodeBlock code={request ?? ""} language="json" />
        </TabsContent>
        <TabsContent value="response">
          <CodeBlock code={response ?? ""} language="json" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
