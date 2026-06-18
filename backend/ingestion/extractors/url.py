import hashlib
import httpx

async def extract_url(url: str) -> tuple[str, str]:
    """
    Extracts clean text from a URL using Jina Reader API.
    This handles Javascript rendering and extracts clean markdown automatically.
    """
    jina_url = f"https://r.jina.ai/{url}"
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        # Add headers to request just the text/markdown content without images
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
