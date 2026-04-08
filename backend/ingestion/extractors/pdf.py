import fitz  # PyMuPDF
import hashlib

def extract_pdf(file_bytes: bytes) -> tuple[str, str]:
    """
    Extracts text from a PDF file page by page, joining pages with "\n\n".
    Returns the raw_text and sha256 checksum.
    """
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as e:
        raise ValueError(f"Could not parse PDF: {str(e)}")

    pages_text = []
    for page in doc:
        text = page.get_text()
        if text:
            pages_text.append(text.strip())

    raw_text = "\n\n".join(pages_text)
    checksum = hashlib.sha256(raw_text.encode('utf-8')).hexdigest()
    
    return raw_text, checksum
