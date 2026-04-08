import logging
import xml.etree.ElementTree as ET
import httpx
from typing import List, Tuple
from ingestion.extractors.url import extract_url

logger = logging.getLogger(__name__)

async def extract_sitemap(sitemap_url: str) -> List[Tuple[str, str, str]]:
    """
    Extracts text from all URLs found in a sitemap.
    Handles nested sitemap indexes recursively.
    Returns a list of tuples: (page_url, raw_text, checksum).
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(sitemap_url, timeout=30.0)
            response.raise_for_status()
            xml_content = response.content
    except Exception as e:
        raise ValueError(f"Failed to fetch or parse sitemap {sitemap_url}: {str(e)}")

    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as e:
        raise ValueError(f"Failed to parse XML from sitemap {sitemap_url}: {str(e)}")

    results = []
    
    # XML namespaces are often used in sitemaps: xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
    # To handle tags with or without namespaces, we strip the namespace.
    tag_name = root.tag.split("}")[-1]

    if tag_name == "sitemapindex":
        for sitemap in root:
            loc = sitemap.find("{*}loc") if "}" in sitemap.tag else sitemap.find("loc")
            if loc is not None and loc.text:
                try:
                    # Recursively fetch nested sitemaps
                    nested_results = await extract_sitemap(loc.text.strip())
                    results.extend(nested_results)
                except Exception as e:
                    logger.error(f"Failed to extract nested sitemap {loc.text}: {e}")
                    
    elif tag_name == "urlset":
        for url_node in root:
            loc = url_node.find("{*}loc") if "}" in url_node.tag else url_node.find("loc")
            if loc is not None and loc.text:
                page_url = loc.text.strip()
                try:
                    raw_text, checksum = await extract_url(page_url)
                    results.append((page_url, raw_text, checksum))
                except Exception as e:
                    logger.error(f"Failed to extract URL {page_url} from sitemap: {e}")
                    
    else:
        raise ValueError(f"Unknown sitemap root tag: {tag_name}")

    return results
