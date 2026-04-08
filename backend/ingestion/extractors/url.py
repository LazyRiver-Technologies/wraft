import asyncio
import hashlib
import re
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright, Error as PlaywrightError

async def extract_url(url: str) -> tuple[str, str]:
    """
    Extracts clean text from a URL using headless Chromium via Playwright.
    Removes specific tags from HTML and collapses blank lines.
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            response = await page.goto(url, wait_until="networkidle", timeout=30000)
            
            if response is None:
                raise ValueError(f"Failed to fetch url: {url}, no response")
            
            if response.status >= 400:
                raise ValueError(f"Page returned status {response.status}")
                
            html_content = await page.content()
        except PlaywrightError as e:
            raise ValueError(f"Playwright error during fetch: {str(e)}")
        finally:
            await browser.close()

    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Remove unwanted tags entirely
    tags_to_remove = ['script', 'style', 'noscript', 'header', 'footer', 'nav', 'aside', 'form', 'iframe', 'svg', 'img']
    for tag in soup(tags_to_remove):
        tag.decompose()
        
    raw_text = soup.get_text(separator="\n", strip=True)
    
    # Collapse multiple blank lines into single blank lines
    # This means replacing sequences of more than 2 \n with 2 \n (one blank line)
    raw_text = re.sub(r'\n{3,}', '\n\n', raw_text)
    raw_text = raw_text.strip()
    
    checksum = hashlib.sha256(raw_text.encode('utf-8')).hexdigest()
    
    return raw_text, checksum
