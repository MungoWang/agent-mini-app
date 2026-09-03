/**
 * @exampleOf Card
 * @title Card
 * @scenario The default content container: header (title + description), body, optional footer. Start here for any panel before writing custom borders/padding.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@monkey-mini-app/ui";

export default function Card01Example() {
  return (
    <>
<Card>
            <CardHeader>
              <CardTitle>Card</CardTitle>
            </CardHeader>
            <CardContent>Interactive container.</CardContent>
          </Card>
    </>
  );
}
