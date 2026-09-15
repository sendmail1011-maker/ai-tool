import { XMLParser } from "fast-xml-parser";

export type NewsCategory = "taiwan" | "international";

export type NewsFeedSource = {
  name: string;
  category: NewsCategory;
  url: string;
};

// Free, publicly published RSS feeds only — no scraping of pages that don't
// offer one (e.g. cnyes has no public RSS feed, so it's not included here).
export const NEWS_FEED_SOURCES: NewsFeedSource[] = [
  {
    name: "經濟日報－證券",
    category: "taiwan",
    url: "https://money.udn.com/rssfeed/news/1001/5590?ch=money",
  },
  {
    name: "經濟日報－國際",
    category: "international",
    url: "https://money.udn.com/rssfeed/news/1001/5588?ch=money",
  },
  {
    name: "Yahoo股市－台股",
    category: "taiwan",
    url: "https://tw.stock.yahoo.com/rss?category=tw-market",
  },
  {
    name: "Yahoo股市－國際",
    category: "international",
    url: "https://tw.stock.yahoo.com/rss?category=intl-markets",
  },
  {
    name: "MoneyDJ理財網",
    category: "taiwan",
    url: "https://www.moneydj.com/kmdj/RssCenter.aspx?svc=NW&fno=1&arg=X0000000",
  },
];

export type FetchedNewsItem = {
  title: string;
  source: string;
  url: string;
  publishedAt: Date;
  summary?: string;
  category: NewsCategory;
};

type RssItem = {
  title?: unknown;
  link?: unknown;
  pubDate?: unknown;
  description?: unknown;
};

const xmlParser = new XMLParser({
  ignoreAttributes: true,
  isArray: (name) => name === "item",
});

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export async function fetchNewsFeed(source: NewsFeedSource): Promise<FetchedNewsItem[]> {
  const res = await fetch(source.url);
  if (!res.ok) {
    throw new Error(`${source.name} RSS request failed: ${res.status}`);
  }
  const xml = await res.text();
  const parsed = xmlParser.parse(xml);
  const items: RssItem[] = parsed?.rss?.channel?.item ?? [];

  const out: FetchedNewsItem[] = [];
  for (const item of items) {
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const link = typeof item.link === "string" ? item.link.trim() : "";
    if (!title || !link) continue;

    const pubDate = typeof item.pubDate === "string" ? new Date(item.pubDate) : new Date();
    const summary =
      typeof item.description === "string" ? stripHtml(item.description) : "";

    out.push({
      title,
      source: source.name,
      url: link,
      publishedAt: Number.isNaN(pubDate.getTime()) ? new Date() : pubDate,
      summary: summary || undefined,
      category: source.category,
    });
  }
  return out;
}

export type NewsFeedResult = {
  source: string;
  items: FetchedNewsItem[];
  error?: string;
};

export async function fetchAllNewsFeeds(): Promise<NewsFeedResult[]> {
  const results: NewsFeedResult[] = [];
  for (const source of NEWS_FEED_SOURCES) {
    try {
      results.push({ source: source.name, items: await fetchNewsFeed(source) });
    } catch (err) {
      results.push({
        source: source.name,
        items: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}
