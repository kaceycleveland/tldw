-- Add embeddings support for Gemini API integration
-- This migration adds vector similarity search capabilities using pgvector

-- Enable the pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Create enum for embedding models to track which model generated the embedding
CREATE TYPE embedding_model AS ENUM (
  'text-embedding-004',
  'text-embedding-preview-0409',
  'textembedding-gecko@001',
  'textembedding-gecko@003'
);

-- Create enum for embedding task types (from Gemini API)
CREATE TYPE embedding_task_type AS ENUM (
  'RETRIEVAL_QUERY',
  'RETRIEVAL_DOCUMENT', 
  'SEMANTIC_SIMILARITY',
  'CLASSIFICATION',
  'CLUSTERING'
);

-- Embeddings table to store vector representations of content
CREATE TABLE IF NOT EXISTS public.embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  extraction_id UUID REFERENCES public.extractions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Vector storage (768 dimensions for Gemini text-embedding-004)
  embedding vector(768) NOT NULL,
  
  -- Metadata about the embedding
  model embedding_model NOT NULL DEFAULT 'text-embedding-004',
  task_type embedding_task_type NOT NULL DEFAULT 'SEMANTIC_SIMILARITY',
  content_hash TEXT NOT NULL, -- SHA-256 hash of the content used for deduplication
  
  -- Text content that was embedded (for reference and debugging)
  source_text TEXT NOT NULL,
  text_length INTEGER NOT NULL,
  
  -- Processing metadata
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one embedding per extraction per task type
  UNIQUE(extraction_id, task_type)
);

-- Enable RLS for embeddings table
ALTER TABLE public.embeddings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for embeddings - users can only access their own embeddings
CREATE POLICY "Users can view own embeddings" ON public.embeddings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own embeddings" ON public.embeddings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own embeddings" ON public.embeddings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own embeddings" ON public.embeddings
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for efficient vector similarity searches
-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw_cosine 
  ON public.embeddings USING hnsw (embedding vector_cosine_ops) 
  WITH (m = 16, ef_construction = 64);

-- Additional indexes for filtering and performance
CREATE INDEX IF NOT EXISTS idx_embeddings_user_id ON public.embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_extraction_id ON public.embeddings(extraction_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_content_hash ON public.embeddings(content_hash);
CREATE INDEX IF NOT EXISTS idx_embeddings_created_at ON public.embeddings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_embeddings_model_task ON public.embeddings(model, task_type);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_embeddings_updated_at
  BEFORE UPDATE ON public.embeddings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to find semantically similar content using cosine similarity
CREATE OR REPLACE FUNCTION public.find_similar_content(
  query_embedding vector(768),
  similarity_threshold float DEFAULT 0.8,
  max_results integer DEFAULT 10,
  target_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE(
  extraction_id uuid,
  similarity_score float,
  title text,
  url text,
  summary text,
  created_at timestamptz
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    e.extraction_id,
    (1 - (emb.embedding <=> query_embedding)) as similarity_score,
    ex.title,
    ex.url,
    ex.summary,
    ex.created_at
  FROM public.embeddings emb
  JOIN public.extractions ex ON ex.id = emb.extraction_id
  WHERE emb.user_id = target_user_id
    AND (1 - (emb.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY emb.embedding <=> query_embedding
  LIMIT max_results;
$$;

-- Function to detect potential duplicates based on content similarity
CREATE OR REPLACE FUNCTION public.find_duplicate_content(
  content_hash text,
  query_embedding vector(768),
  similarity_threshold float DEFAULT 0.95,
  target_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE(
  extraction_id uuid,
  similarity_score float,
  title text,
  url text,
  is_exact_duplicate boolean
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    emb.extraction_id,
    (1 - (emb.embedding <=> query_embedding)) as similarity_score,
    ex.title,
    ex.url,
    (emb.content_hash = content_hash) as is_exact_duplicate
  FROM public.embeddings emb
  JOIN public.extractions ex ON ex.id = emb.extraction_id
  WHERE emb.user_id = target_user_id
    AND (
      emb.content_hash = content_hash 
      OR (1 - (emb.embedding <=> query_embedding)) >= similarity_threshold
    )
  ORDER BY 
    (emb.content_hash = content_hash) DESC, -- Exact matches first
    emb.embedding <=> query_embedding
  LIMIT 10;
$$;

-- Function to get embedding statistics for a user
CREATE OR REPLACE FUNCTION public.get_embedding_stats(
  target_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE(
  total_embeddings bigint,
  models_used text[],
  avg_text_length numeric,
  oldest_embedding timestamptz,
  newest_embedding timestamptz
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    COUNT(*) as total_embeddings,
    array_agg(DISTINCT model::text) as models_used,
    AVG(text_length) as avg_text_length,
    MIN(created_at) as oldest_embedding,
    MAX(created_at) as newest_embedding
  FROM public.embeddings
  WHERE user_id = target_user_id;
$$;

-- Function to perform batch similarity search across multiple query embeddings
CREATE OR REPLACE FUNCTION public.batch_similarity_search(
  query_embeddings vector(768)[],
  similarity_threshold float DEFAULT 0.7,
  max_results_per_query integer DEFAULT 5,
  target_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE(
  query_index integer,
  extraction_id uuid,
  similarity_score float,
  title text,
  url text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  query_embedding vector(768);
  i integer := 1;
BEGIN
  FOREACH query_embedding IN ARRAY query_embeddings
  LOOP
    RETURN QUERY
    SELECT 
      i as query_index,
      emb.extraction_id,
      (1 - (emb.embedding <=> query_embedding)) as similarity_score,
      ex.title,
      ex.url
    FROM public.embeddings emb
    JOIN public.extractions ex ON ex.id = emb.extraction_id
    WHERE emb.user_id = target_user_id
      AND (1 - (emb.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY emb.embedding <=> query_embedding
    LIMIT max_results_per_query;
    
    i := i + 1;
  END LOOP;
  
  RETURN;
END;
$$;

-- Function to cluster embeddings using k-means approximation
CREATE OR REPLACE FUNCTION public.cluster_embeddings(
  num_clusters integer DEFAULT 5,
  target_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE(
  extraction_id uuid,
  cluster_id integer,
  distance_to_centroid float,
  title text,
  url text
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH random_centroids AS (
    SELECT 
      row_number() OVER () as cluster_id,
      embedding as centroid
    FROM (
      SELECT embedding
      FROM public.embeddings
      WHERE user_id = target_user_id
      ORDER BY random()
      LIMIT num_clusters
    ) random_samples
  ),
  assignments AS (
    SELECT 
      emb.extraction_id,
      emb.embedding,
      ex.title,
      ex.url,
      (
        SELECT rc.cluster_id
        FROM random_centroids rc
        ORDER BY emb.embedding <=> rc.centroid
        LIMIT 1
      ) as cluster_id
    FROM public.embeddings emb
    JOIN public.extractions ex ON ex.id = emb.extraction_id
    WHERE emb.user_id = target_user_id
  )
  SELECT 
    a.extraction_id,
    a.cluster_id,
    (a.embedding <=> rc.centroid) as distance_to_centroid,
    a.title,
    a.url
  FROM assignments a
  JOIN random_centroids rc ON rc.cluster_id = a.cluster_id
  ORDER BY a.cluster_id, distance_to_centroid;
$$;

-- Create a view for easy access to embeddings with extraction metadata
CREATE OR REPLACE VIEW public.embeddings_with_metadata AS
SELECT 
  emb.id,
  emb.extraction_id,
  emb.user_id,
  emb.embedding,
  emb.model,
  emb.task_type,
  emb.content_hash,
  emb.source_text,
  emb.text_length,
  emb.tokens_used,
  emb.processing_time_ms,
  emb.created_at as embedding_created_at,
  emb.updated_at as embedding_updated_at,
  -- Extraction metadata
  ex.url,
  ex.title,
  ex.original_content,
  ex.summary,
  ex.key_points,
  ex.extraction_type,
  ex.source_metadata,
  ex.created_at as extraction_created_at,
  -- User metadata
  p.email,
  p.full_name
FROM public.embeddings emb
JOIN public.extractions ex ON ex.id = emb.extraction_id
JOIN public.profiles p ON p.id = emb.user_id;

-- Enable RLS for the view
ALTER VIEW public.embeddings_with_metadata SET (security_invoker = on);

-- Grant necessary permissions
GRANT SELECT ON public.embeddings TO authenticated;
GRANT INSERT ON public.embeddings TO authenticated;
GRANT UPDATE ON public.embeddings TO authenticated;
GRANT DELETE ON public.embeddings TO authenticated;

GRANT SELECT ON public.embeddings_with_metadata TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.find_similar_content TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_duplicate_content TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_embedding_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.batch_similarity_search TO authenticated;
GRANT EXECUTE ON FUNCTION public.cluster_embeddings TO authenticated;

-- Add helpful comments
COMMENT ON TABLE public.embeddings IS 'Stores vector embeddings generated from Gemini API for semantic similarity search and duplicate detection';
COMMENT ON COLUMN public.embeddings.embedding IS '768-dimensional vector embedding from Gemini text-embedding-004 model';
COMMENT ON COLUMN public.embeddings.content_hash IS 'SHA-256 hash of source content for exact duplicate detection';
COMMENT ON FUNCTION public.find_similar_content IS 'Find semantically similar content using cosine similarity';
COMMENT ON FUNCTION public.find_duplicate_content IS 'Detect potential duplicate content using both hash matching and semantic similarity';