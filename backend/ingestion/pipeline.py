import logging
from datetime import datetime, timezone
from supabase import AClient
import redis.asyncio as redis

from ingestion.extractors import extract_pdf, extract_url, extract_sitemap, extract_text
from ingestion.chunker import chunk_text
from ingestion.embedder import embed_chunks

logger = logging.getLogger(__name__)

async def run_ingestion_pipeline(source_id: str, db: AClient, redis_client: redis.Redis) -> None:
    """
    Executes the ingestion pipeline for a given data source.
    """
    try:
        # 1. Fetch the data_source
        source_res = await db.table("data_sources").select("*").eq("id", source_id).single().execute()
        source = source_res.data
        if not source:
            raise ValueError(f"Source with ID {source_id} not found.")

        # 2. Update status to processing
        await db.table("data_sources").update({"status": "processing"}).eq("id", source_id).execute()

        bot_id = source.get("bot_id")
        source_type = source.get("type")
        source_name = source.get("name")
        
        # 3. Call extractor based on source type
        extracted_content = [] # list of (url_or_name, raw_text, checksum)
        
        if source_type == "pdf":
            storage_path = source.get("storage_path")
            if not storage_path:
                raise ValueError("Missing storage_path for PDF source.")
                
            # Assume bucket name is 'documents' or it's handled via the storage structure. 
            # Often storage_path contains "bucket/file", but using "documents" as default.
            # You might need to adjust this bucket name to match your exact Supabase setup.
            bucket_name = "documents" 
            file_bytes = await db.storage.from_(bucket_name).download(storage_path)
            raw_text, checksum = extract_pdf(file_bytes)
            extracted_content.append((source_name, raw_text, checksum))
            
        elif source_type == "url":
            source_url = source.get("source_url")
            raw_text, checksum = await extract_url(source_url)
            extracted_content.append((source_url, raw_text, checksum))
            
        elif source_type == "sitemap":
            source_url = source.get("source_url")
            # Returns a list of (page_url, raw_text, checksum)
            results = await extract_sitemap(source_url)
            extracted_content.extend(results)
            
        elif source_type == "text":
            raw_text_input = source.get("raw_text")
            raw_text, checksum = extract_text(raw_text_input)
            extracted_content.append((source_name, raw_text, checksum))
        else:
            raise ValueError(f"Unknown source type: {source_type}")

        # In case of sitemap, we might have multiple checksums, but we'll do duplicate
        # check over the main source checksum. For single documents, it's just the one file.
        # However, to be robust, we'll assign the main source checksum as the first item's checksum.
        # Wait, the spec says "DUPLICATE CHECK: query data_sources table for any OTHER source with 
        # same bot_id and same checksum and status=ready".
        # We need to save the main source checksum to the db first or just use the extracted one.
        # For a sitemap, we can hash all child checksums to represent the parent. Let's use 
        # the checksum of the first item for single docs.
        main_checksum = extracted_content[0][2] if extracted_content else ""

        # 4. Duplicate Check
        dup_res = await db.table("data_sources").select("id").eq("bot_id", bot_id).eq("checksum", main_checksum).eq("status", "ready").neq("id", source_id).execute()
        if dup_res.data:
            # Duplicate found, mark as failed indicating it needs user confirmation
            await db.table("data_sources").update({
                "status": "failed",
                "error_msg": "duplicate_pending_confirmation",
                "checksum": main_checksum
            }).eq("id", source_id).execute()
            return

        # 5. Chunk the texts
        all_chunks = []
        for url_or_name, raw_text, _ in extracted_content:
            meta = {
                "source_id": source_id,
                "bot_id": bot_id,
                "type": source_type
            }
            if source_type == "sitemap" or source_type == "url":
                meta["url"] = url_or_name
            else:
                meta["source_name"] = url_or_name
                
            file_chunks = chunk_text(raw_text, metadata=meta)
            all_chunks.extend(file_chunks)

        if not all_chunks:
            raise ValueError("No content could be extracted or chunked from the source.")

        # 6. Embed all chunks (batched efficiently in embedder.py)
        texts_to_embed = [c.content for c in all_chunks]
        embeddings = await embed_chunks(texts_to_embed)

        if len(embeddings) != len(all_chunks):
            raise ValueError(f"Mismatch between number of chunks ({len(all_chunks)}) and embeddings ({len(embeddings)})")

        # 7. Delete any existing document_chunks rows for this source_id
        await db.table("document_chunks").delete().eq("source_id", source_id).execute()

        # 8. Batch insert all chunks
        chunk_rows = []
        for i, (chunk, embedding) in enumerate(zip(all_chunks, embeddings)):
            chunk_rows.append({
                "bot_id": bot_id,
                "source_id": source_id,
                "content": chunk.content,
                "embedding": embedding,
                "chunk_index": chunk.chunk_index,
                "token_count": chunk.token_count,
                "metadata": chunk.metadata
            })
            
        # Supabase API typically limits batch inserts to 1000 rows. We'll batch them safely.
        batch_size = 500
        for i in range(0, len(chunk_rows), batch_size):
            await db.table("document_chunks").insert(chunk_rows[i:i+batch_size]).execute()

        # 9. Update data_source
        now_str = datetime.now(timezone.utc).isoformat()
        await db.table("data_sources").update({
            "status": "ready",
            "chunk_count": len(all_chunks),
            "checksum": main_checksum,
            "updated_at": now_str
        }).eq("id", source_id).execute()

    except Exception as e:
        logger.error(f"Ingestion pipeline failed for source {source_id}: {str(e)}", exc_info=True)
        try:
            await db.table("data_sources").update({
                "status": "failed",
                "error_msg": str(e)
            }).eq("id", source_id).execute()
        except:
            pass # Eat fallback error so we can bubble the original exception
        raise e
