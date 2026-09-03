/**
 * @exampleOf Breadcrumb
 * @title Breadcrumb
 * @scenario Deep-navigation path where the current level is not a link and separators are automatic; use for drill-down pages (org / team / project / run).
 */
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@monkey-mini-app/ui";

export default function Breadcrumb01Example() {
  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Demo</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </>
  );
}
