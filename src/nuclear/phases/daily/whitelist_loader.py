import re
from pathlib import Path
from typing import Set

"""
M07 Whitelist Loader.
Parses markdown docs to extract authoritative domains.
"""

D1A_DOC = Path("docs/d1a_news_whitelist.md")
D1B_DOC = Path("docs/d1b_forum_whitelist.md")

def _extract_domains_from_md(path: Path) -> Set[str]:
    if not path.exists():
        raise RuntimeError(f"Required whitelist document missing: {path}")
    
    domains = set()
    # Simple regex for domains: looks for strings like reuters.com, ptt.cc etc.
    # We look for lines that ARE just a domain (with optional markdown list bullet)
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line.startswith("-"):
                continue
            
            # Match domain-like strings: optional whitespace/bullet, then domain
            match = re.search(r"([a-z0-9-]+(?:\.[a-z0-9-]+)+)", line, re.IGNORECASE)
            if match:
                domain = match.group(1).lower()
                if not domain.endswith(".md"):
                    domains.add(domain)
            
            # Special markers for major platforms
            lower_line = line.lower()
            if "reddit" in lower_line:
                domains.add("reddit.com")
            if "ptt" in lower_line:
                domains.add("ptt.cc")
            if "5ch" in lower_line:
                domains.add("5ch.net")
            if "stocktwits" in lower_line:
                domains.add("stocktwits.com")
    return domains

def load_d1a_news_domains() -> Set[str]:
    """Load authoritative news domains from docs/d1a_news_whitelist.md."""
    return _extract_domains_from_md(D1A_DOC)

def load_d1b_forum_domains() -> Set[str]:
    """Load authorized forum domains from docs/d1b_forum_whitelist.md."""
    return _extract_domains_from_md(D1B_DOC)
