from dataclasses import dataclass, field
from typing import List, Dict, Optional
from langchain_text_splitters import RecursiveCharacterTextSplitter

@dataclass
class Chunk:
    content: str
    chunk_index: int
    token_count: int
    metadata: Dict = field(default_factory=dict)

def chunk_text(raw_text: str, metadata: Optional[Dict] = None, chunk_size: int = 300, chunk_overlap: int = 50) -> List[Chunk]:
    """
    Chunks text using a robust recursive character text splitter backed by Tiktoken.
    This guarantees that chunks remain within token limits without breaking semantic word boundaries.
    """
    if metadata is None:
        metadata = {}

    # Initialize the robust Tiktoken-backed Langchain splitter
    text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
        model_name="gpt-3.5-turbo", # Default generic BPE model for standard token counting
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " ", ""]
    )
    
    import re
    # Clean noise: markdown images like ![Image 12: ...](http...) -> keep alt text if meaningful
    cleaned_text = re.sub(r'!\[(?:Image\s*\d*:?\s*)?([^\]]*)\]\([^\)]+\)', r'\1', raw_text)
    # Remove empty markdown links like [](http...)
    cleaned_text = re.sub(r'\[\s*\]\([^\)]+\)', '', cleaned_text)
    # Normalize excessive blank lines
    cleaned_text = re.sub(r'\n{3,}', '\n\n', cleaned_text).strip()

    # Split the cleaned text into Document objects
    docs = text_splitter.create_documents([cleaned_text])
    
    # Tiktoken encoder for exact token counting (rather than // 4 heuristic)
    import tiktoken
    encoder = tiktoken.encoding_for_model("gpt-3.5-turbo")
    
    chunks = []
    for i, doc in enumerate(docs):
        text_content = doc.page_content.strip()
        if not text_content:
            continue
            
        # Skip chunks that have almost no actual alphanumeric words (noise filtering)
        words = re.findall(r'[a-zA-Z0-9]{2,}', text_content)
        if len(words) < 5:
            continue

        exact_token_count = len(encoder.encode(text_content))
        
        chunks.append(Chunk(
            content=text_content,
            chunk_index=len(chunks),
            token_count=exact_token_count,
            metadata=metadata.copy()
        ))
        
    return chunks
