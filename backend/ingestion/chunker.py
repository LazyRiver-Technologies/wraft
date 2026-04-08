from dataclasses import dataclass, field
from typing import List, Dict, Optional
import re

@dataclass
class Chunk:
    content: str
    chunk_index: int
    token_count: int
    metadata: Dict = field(default_factory=dict)

def chunk_text(raw_text: str, metadata: Optional[Dict] = None, chunk_size: int = 300, chunk_overlap: int = 50) -> List[Chunk]:
    """
    Chunks text by paragraphs and falls back to sentences if a paragraph is too long.
    Token approximation is simple length // 4.
    """
    if metadata is None:
        metadata = {}

    chunks = []
    chunk_index = 0
    current_chunk_text = ""

    # Approximate token count: 1 token ~= 4 chars
    def get_token_count(text: str) -> int:
        return len(text) // 4

    paragraphs = [p for p in raw_text.split('\n\n') if p.strip()]

    for paragraph in paragraphs:
        p_tokens = get_token_count(paragraph)
        
        # If the single paragraph exceeds the chunk size, we need to split it by sentences
        if p_tokens > chunk_size:
            # Simple sentence splitting using regex (look for punctuation followed by space)
            # This splits preserving the punctuation.
            sentences = re.split(r'(?<=[.?!])\s+', paragraph)
            
            for sentence in sentences:
                if not sentence.strip():
                    continue
                    
                sentence_tokens = get_token_count(sentence)
                current_tokens = get_token_count(current_chunk_text)
                
                # If adding the sentence exceeds chunk size, and we already have content, flush
                if current_tokens + sentence_tokens > chunk_size and current_chunk_text.strip():
                    chunks.append(Chunk(
                        content=current_chunk_text.strip(),
                        chunk_index=chunk_index,
                        token_count=get_token_count(current_chunk_text.strip()),
                        metadata=metadata.copy()
                    ))
                    chunk_index += 1
                    
                    # Compute overlap from the flushed chunk to seed the new chunk
                    overlap_chars = chunk_overlap * 4
                    current_chunk_text = current_chunk_text[-overlap_chars:].lstrip() if len(current_chunk_text) > overlap_chars else current_chunk_text
                    
                current_chunk_text += sentence + " "
                
        else:
            current_tokens = get_token_count(current_chunk_text)
            
            # If adding the paragraph exceeds chunk size, and we already have content, flush
            if current_tokens + p_tokens > chunk_size and current_chunk_text.strip():
                chunks.append(Chunk(
                    content=current_chunk_text.strip(),
                    chunk_index=chunk_index,
                    token_count=get_token_count(current_chunk_text.strip()),
                    metadata=metadata.copy()
                ))
                chunk_index += 1
                
                overlap_chars = chunk_overlap * 4
                current_chunk_text = current_chunk_text[-overlap_chars:].lstrip() if len(current_chunk_text) > overlap_chars else current_chunk_text
                
            current_chunk_text += paragraph + "\n\n"

    # Flush the last remaining chunk
    if current_chunk_text.strip():
        chunks.append(Chunk(
            content=current_chunk_text.strip(),
            chunk_index=chunk_index,
            token_count=get_token_count(current_chunk_text.strip()),
            metadata=metadata.copy()
        ))

    return chunks
