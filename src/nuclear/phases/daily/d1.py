from typing import Any, Dict, List
from nuclear.phases.daily.contracts import D1Output
from nuclear.phases.daily.whitelist_loader import load_d1a_news_domains, load_d1b_forum_domains
from nuclear.phases.daily.adapters.news_adapter import NewsAdapter, StubNewsAdapter
from nuclear.phases.daily.adapters.forum_adapter import ForumAdapter, StubForumAdapter

def run_d1(date: str, news_adapter: NewsAdapter = None, forum_adapter: ForumAdapter = None) -> D1Output:
    """
    D-1: News + Forum ingestion.
    Enforces whitelist and caps.
    """
    news_adapter = news_adapter or StubNewsAdapter()
    forum_adapter = forum_adapter or StubForumAdapter()
    
    # 1. Load whitelists
    news_domains = load_d1a_news_domains()
    forum_domains = load_d1b_forum_domains()
    
    # 2. Fetch raw items
    raw_news = news_adapter.fetch(date)
    raw_forums = forum_adapter.fetch(date)
    
    # 3. Filter & Cap News
    news_items = []
    source_counts: Dict[str, int] = {}
    for item in raw_news:
        domain = item.get("source_domain")
        if domain in news_domains:
            count = source_counts.get(domain, 0)
            if count < 50:
                news_items.append(item)
                source_counts[domain] = count + 1
                
    # 4. Filter & Cap Forums
    forum_items = []
    total_forums = 0
    for item in raw_forums:
        domain = item.get("source_domain")
        if domain in forum_domains:
            if total_forums < 300:
                forum_items.append(item)
                total_forums += 1
                
    return D1Output(
        date=date,
        news_items=news_items,
        forum_items=forum_items,
        signals={"risk_on_shift": False},
        whitelist_used={
            "news_whitelist_doc": "docs/d1a_news_whitelist.md",
            "forum_whitelist_doc": "docs/d1b_forum_whitelist.md"
        }
    )
