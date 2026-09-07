import asyncio
import hashlib
import logging
import re
import urllib.parse
from typing import List, Tuple, Optional
import httpx

logger = logging.getLogger(__name__)

# Extensions to skip when discovering internal pages
EXCLUDED_EXTENSIONS = (
    '.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif', '.ico',
    '.pdf', '.zip', '.tar', '.gz', '.mp3', '.mp4', '.avi', '.mov',
    '.css', '.js', '.xml', '.txt', '.json', '.woff', '.woff2', '.ttf'
)

# Paths or tokens to skip (admin, authentication, media folders)
EXCLUDED_PATH_TOKENS = (
    'wp-content', 'wp-includes', 'wp-json', 'wp-admin', 'wp-login',
    '/cdn-cgi/', '/login', '/signup', '/signin', '/register',
    '/cart', '/checkout', '/my-account', '#', 'javascript:'
)

PRIORITY_KEYWORDS = [
    'team', 'doctor', 'dentist', 'staff', 'physician', 'about',
    'service', 'treatment', 'procedure', 'specialist', 'specialty',
    'contact', 'hour', 'location', 'pricing', 'price', 'fee', 'cost',
    'faq', 'question', 'appointment', 'booking', 'people', 'award',
    'testimonial', 'review', 'facility', 'clinic'
]


async def extract_url(url: str) -> Tuple[str, str]:
    """
    Extracts clean text from a single URL using Jina Reader API.
    This handles Javascript rendering and extracts clean markdown automatically.
    """
    jina_url = f"https://r.jina.ai/{url}"
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        headers = {
            "Accept": "text/plain",
            "X-Return-Format": "markdown"
        }
        response = await client.get(jina_url, headers=headers)
        
        if response.status_code >= 400:
            raise ValueError(f"Jina Reader API returned status {response.status_code} for URL {url}")
            
        raw_text = response.text.strip()
        
    if not raw_text:
        raise ValueError(f"No content extracted from {url}")
        
    checksum = hashlib.sha256(raw_text.encode('utf-8')).hexdigest()
    return raw_text, checksum


async def _fetch_single_page(client: httpx.AsyncClient, page_url: str) -> Optional[Tuple[str, str, str]]:
    """Helper to fetch a single page with error handling and checksum generation."""
    try:
        jina_url = f"https://r.jina.ai/{page_url}"
        headers = {
            "Accept": "text/plain",
            "X-Return-Format": "markdown"
        }
        response = await client.get(jina_url, headers=headers, timeout=25.0)
        if response.status_code == 200 and response.text.strip():
            text = response.text.strip()
            checksum = hashlib.sha256(text.encode('utf-8')).hexdigest()
            return page_url, text, checksum
    except Exception as e:
        logger.warning(f"Could not extract subpage {page_url}: {e}")
    return None


async def extract_website(url: str, max_subpages: int = 8) -> List[Tuple[str, str, str]]:
    """
    Intelligently crawls a website starting from the given URL.
    1. Fetches the primary landing page via Jina Reader.
    2. Identifies internal links from the markdown content.
    3. Scores and prioritizes essential business subpages (team, services, contact, about, etc.).
    4. Concurrently fetches the top subpages up to max_subpages.
    Returns a list of (page_url, page_markdown, checksum).
    """
    # Normalize starting URL
    normalized_url = url.strip()
    if not re.match(r"^https?://", normalized_url, re.IGNORECASE):
        normalized_url = f"https://{normalized_url}"
        
    parsed_base = urllib.parse.urlparse(normalized_url)
    base_domain = parsed_base.netloc.lower()
    
    async with httpx.AsyncClient(timeout=35.0) as client:
        # 1. Fetch main page
        main_page = await _fetch_single_page(client, normalized_url)
        if not main_page:
            # Fallback to direct extract_url for full error message if needed
            raw_text, checksum = await extract_url(normalized_url)
            return [(normalized_url, raw_text, checksum)]
            
        results: List[Tuple[str, str, str]] = [main_page]
        _, main_text, _ = main_page
        
        # 2. Extract internal links from markdown: [anchor text](link_url)
        markdown_links = re.findall(r"\[([^\]]+)\]\((https?://[^\s\)]+)\)", main_text)
        
        candidates: dict[str, tuple[int, str]] = {}
        for anchor_text, raw_link in markdown_links:
            p = urllib.parse.urlparse(raw_link)
            
            # Ensure internal domain
            if p.netloc.lower() != base_domain:
                continue
                
            clean_path = p.path.rstrip('/')
            
            # Skip empty, root-only, or anchor-only
            if not clean_path or clean_path in ('', '#'):
                continue
                
            # Skip excluded extensions and paths
            path_lower = clean_path.lower()
            if any(path_lower.endswith(ext) for ext in EXCLUDED_EXTENSIONS):
                continue
            if any(token in path_lower for token in EXCLUDED_PATH_TOKENS):
                continue
                
            canonical_url = urllib.parse.urlunparse((p.scheme, p.netloc, clean_path, '', '', ''))
            
            # Skip if it matches the main URL
            if canonical_url.rstrip('/') == normalized_url.rstrip('/'):
                continue
                
            if canonical_url not in candidates:
                # Score candidate by business relevance
                score = 5
                combined_snippet = f"{path_lower} {anchor_text.lower()}"
                for kw in PRIORITY_KEYWORDS:
                    if kw in combined_snippet:
                        score += 15
                candidates[canonical_url] = (score, anchor_text.strip())
                
        if not candidates:
            return results
            
        # 3. Sort candidates by score descending and take top max_subpages
        sorted_candidates = sorted(candidates.items(), key=lambda item: item[1][0], reverse=True)[:max_subpages]
        logger.info(f"Crawling {len(sorted_candidates)} prioritized subpages for {normalized_url}")
        
        # 4. Concurrently fetch prioritized subpages
        tasks = [_fetch_single_page(client, target_url) for target_url, _ in sorted_candidates]
        subpage_results = await asyncio.gather(*tasks)
        
        for sub in subpage_results:
            if sub:
                results.append(sub)
                
        logger.info(f"Total pages successfully indexed for {normalized_url}: {len(results)}")
        return results

