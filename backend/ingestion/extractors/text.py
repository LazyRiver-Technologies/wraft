import hashlib

def extract_text(raw_text: str) -> tuple[str, str]:
    """
    Extracts text by stripping whitespace and returns the raw text and its sha256 checksum.
    """
    stripped_text = raw_text.strip()
    checksum = hashlib.sha256(stripped_text.encode('utf-8')).hexdigest()
    return stripped_text, checksum
