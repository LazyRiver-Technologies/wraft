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
    
    # Split the raw text into Document objects
    docs = text_splitter.create_documents([raw_text])
    
    # Tiktoken encoder for exact token counting (rather than // 4 heuristic)
    import tiktoken
    encoder = tiktoken.encoding_for_model("gpt-3.5-turbo")
    
    chunks = []
    for i, doc in enumerate(docs):
        text_content = doc.page_content.strip()
        if not text_content:
            continue
            
        exact_token_count = len(encoder.encode(text_content))
        
        chunks.append(Chunk(
            content=text_content,
            chunk_index=i,
            token_count=exact_token_count,
            metadata=metadata.copy()
        ))
        
    return chunks
