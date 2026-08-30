export type FeedItem = { title: string; url: string };

function stripCdata(value: string) {
  return value.replace(/<!\[CDATA\[|\]\]>/g, "").trim();
}

export function parseFeed(xml: string): FeedItem[] {
  const re = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/gi;
  return Array.from(String(xml).matchAll(re), (match) => ({
    title: stripCdata(match[1] || ""),
    url: stripCdata(match[2] || ""),
  }));
}
