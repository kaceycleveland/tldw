# TLDW Embeddings Database Schema

This document outlines the database schema for storing and managing vector embeddings generated from the Gemini API in the TLDW Chrome extension.

**Important:** The application is currently hardcoded to use the `gemini-embedding-001` model exclusively. This ensures consistency across all embeddings and optimal performance.

## Overview

The embeddings system is designed to:
- Store 768-dimensional vector embeddings from the Gemini gemini-embedding-001 model
- Enable semantic similarity search across extracted web content
- Provide duplicate detection functionality
- Support efficient vector operations using pgvector extension
- Maintain proper security with Row Level Security (RLS)

## Schema Components

### Extensions

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

The `pgvector` extension provides:
- Vector data types with configurable dimensions
- Vector similarity operators (cosine, L2, inner product)
- HNSW and IVFFlat indexes for fast similarity search

### Custom Types

#### embedding_model
Tracks which Gemini model generated the embedding (currently only gemini-embedding-001 is supported):
```sql
CREATE TYPE embedding_model AS ENUM (
  'gemini-embedding-001',
  'text-embedding-004',
  'text-embedding-preview-0409', 
  'textembedding-gecko@001',
  'textembedding-gecko@003'
);
```

**Note:** Only `gemini-embedding-001` is currently used in the application. Other models are kept for backward compatibility.

#### embedding_task_type
Corresponds to Gemini API task types:
```sql
CREATE TYPE embedding_task_type AS ENUM (
  'RETRIEVAL_QUERY',      -- For search queries
  'RETRIEVAL_DOCUMENT',   -- For documents to be searched
  'SEMANTIC_SIMILARITY',  -- For similarity comparison
  'CLASSIFICATION',       -- For text classification
  'CLUSTERING'           -- For content clustering
);
```

### Tables

#### embeddings
Core table for storing vector embeddings:

```sql
CREATE TABLE public.embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  extraction_id UUID REFERENCES public.extractions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Vector storage (768 dimensions for Gemini gemini-embedding-001)
  embedding vector(768) NOT NULL,
  
  -- Metadata
  model embedding_model NOT NULL DEFAULT 'gemini-embedding-001',
  task_type embedding_task_type NOT NULL DEFAULT 'SEMANTIC_SIMILARITY',
  content_hash TEXT NOT NULL, -- SHA-256 hash for deduplication
  
  -- Source content
  source_text TEXT NOT NULL,
  text_length INTEGER NOT NULL,
  
  -- Processing metadata
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(extraction_id, task_type)
);
```

### Indexes

#### Vector Similarity Index
HNSW (Hierarchical Navigable Small World) index for fast approximate nearest neighbor search:

```sql
CREATE INDEX idx_embeddings_hnsw_cosine 
  ON public.embeddings USING hnsw (embedding vector_cosine_ops) 
  WITH (m = 16, ef_construction = 64);
```

**Index Parameters:**
- `m = 16`: Number of bi-directional links for each node (trade-off between speed and recall)
- `ef_construction = 64`: Size of dynamic candidate list during index construction

#### Supporting Indexes
```sql
CREATE INDEX idx_embeddings_user_id ON public.embeddings(user_id);
CREATE INDEX idx_embeddings_extraction_id ON public.embeddings(extraction_id);
CREATE INDEX idx_embeddings_content_hash ON public.embeddings(content_hash);
CREATE INDEX idx_embeddings_created_at ON public.embeddings(created_at DESC);
CREATE INDEX idx_embeddings_model_task ON public.embeddings(model, task_type);
```

## Functions

### 1. find_similar_content
Find semantically similar content using cosine similarity:

```sql
SELECT * FROM public.find_similar_content(
  query_embedding := '[0.1, 0.2, 0.3, ...]'::vector(768),
  similarity_threshold := 0.8,
  max_results := 10,
  target_user_id := auth.uid()
);
```

**Parameters:**
- `query_embedding`: 768-dimensional vector to search for
- `similarity_threshold`: Minimum cosine similarity (0-1, default 0.8)
- `max_results`: Maximum number of results (default 10)
- `target_user_id`: User ID to search within (default current user)

### 2. find_duplicate_content
Detect potential duplicates using both hash matching and semantic similarity:

```sql
SELECT * FROM public.find_duplicate_content(
  content_hash := 'sha256_hash_of_content',
  query_embedding := '[0.1, 0.2, 0.3, ...]'::vector(768),
  similarity_threshold := 0.95,
  target_user_id := auth.uid()
);
```

**Returns:**
- Exact duplicates (matching content hash) first
- Then semantic duplicates above threshold
- `is_exact_duplicate` boolean flag

### 3. get_embedding_stats
Get embedding statistics for a user:

```sql
SELECT * FROM public.get_embedding_stats(auth.uid());
```

**Returns:**
- Total number of embeddings
- Models used
- Average text length
- Date range of embeddings

### 4. batch_similarity_search
Search multiple query embeddings efficiently:

```sql
SELECT * FROM public.batch_similarity_search(
  query_embeddings := ARRAY[
    '[0.1, 0.2, ...]'::vector(768),
    '[0.2, 0.3, ...]'::vector(768)
  ],
  similarity_threshold := 0.7,
  max_results_per_query := 5
);
```

### 5. cluster_embeddings
Cluster user's embeddings using k-means approximation:

```sql
SELECT * FROM public.cluster_embeddings(
  num_clusters := 5,
  target_user_id := auth.uid()
);
```

## Views

### embeddings_with_metadata
Comprehensive view joining embeddings with extraction and user data:

```sql
SELECT * FROM public.embeddings_with_metadata 
WHERE user_id = auth.uid()
ORDER BY embedding_created_at DESC;
```

## Usage Examples

### 1. Store an Embedding

```typescript
import { supabase } from './lib/supabase';
import crypto from 'crypto';

async function storeEmbedding(
  extractionId: string,
  content: string, 
  embedding: number[]
) {
  const contentHash = crypto
    .createHash('sha256')
    .update(content)
    .digest('hex');

  const { data, error } = await supabase
    .from('embeddings')
    .insert({
      extraction_id: extractionId,
      embedding: `[${embedding.join(',')}]`,
      content_hash: contentHash,
      source_text: content,
      text_length: content.length,
      model: 'gemini-embedding-001',
      task_type: 'SEMANTIC_SIMILARITY'
    });

  if (error) throw error;
  return data;
}
```

### 2. Search for Similar Content

```typescript
async function findSimilarContent(
  queryEmbedding: number[],
  threshold: number = 0.8
) {
  const { data, error } = await supabase
    .rpc('find_similar_content', {
      query_embedding: `[${queryEmbedding.join(',')}]`,
      similarity_threshold: threshold,
      max_results: 10
    });

  if (error) throw error;
  return data;
}
```

### 3. Check for Duplicates

```typescript
async function checkForDuplicates(
  content: string,
  embedding: number[]
) {
  const contentHash = crypto
    .createHash('sha256')
    .update(content)
    .digest('hex');

  const { data, error } = await supabase
    .rpc('find_duplicate_content', {
      content_hash: contentHash,
      query_embedding: `[${embedding.join(',')}]`,
      similarity_threshold: 0.95
    });

  if (error) throw error;
  return data;
}
```

### 4. Batch Processing

```typescript
async function processBatch(contents: string[]) {
  // Generate embeddings using Gemini API
  const embeddings = await Promise.all(
    contents.map(content => generateEmbedding(content))
  );

  // Store embeddings
  const results = await Promise.all(
    contents.map((content, index) => 
      storeEmbedding(extractionIds[index], content, embeddings[index])
    )
  );

  return results;
}
```

## Security Considerations

### Row Level Security (RLS)
All tables have RLS enabled with policies ensuring users can only access their own data:

```sql
-- Example policy
CREATE POLICY "Users can view own embeddings" ON public.embeddings
  FOR SELECT USING (auth.uid() = user_id);
```

### Function Security
All functions use `SECURITY DEFINER` and validate user access:

```sql
CREATE OR REPLACE FUNCTION public.find_similar_content(
  -- parameters
  target_user_id uuid DEFAULT auth.uid()
)
LANGUAGE sql
SECURITY DEFINER  -- Function runs with owner privileges
```

## Performance Optimization

### Index Tuning
- **HNSW Index**: Optimized for read-heavy workloads with occasional writes
- **ef_construction = 64**: Balances build time vs. search quality
- **m = 16**: Good default for most use cases

### Query Optimization
- Use appropriate similarity thresholds (0.7-0.9 for most cases)
- Limit result sets to avoid large data transfers
- Consider pagination for large result sets

### Monitoring
Monitor these metrics:
- Index usage statistics
- Query performance
- Vector search recall rates
- Storage usage growth

## Integration with Gemini API

### Generating Embeddings

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-embedding-001' 
  });
  
  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text }] },
    taskType: 'SEMANTIC_SIMILARITY'
  });
  
  return result.embedding.values;
}
```

### Error Handling

```typescript
async function safeGenerateEmbedding(text: string) {
  try {
    const embedding = await generateEmbedding(text);
    return { success: true, embedding, error: null };
  } catch (error) {
    console.error('Embedding generation failed:', error);
    return { success: false, embedding: null, error };
  }
}
```

## Maintenance

### Regular Tasks
1. **Vacuum and Analyze**: Keep statistics updated for optimal query planning
2. **Monitor Index Usage**: Ensure HNSW indexes are being used effectively
3. **Archive Old Embeddings**: Implement retention policies as needed
4. **Update Statistics**: Run ANALYZE on tables after bulk operations

### Troubleshooting
- **Slow Similarity Search**: Check if HNSW index is being used (`EXPLAIN ANALYZE`)
- **High Memory Usage**: Consider reducing `ef_construction` or `m` parameters
- **Poor Recall**: Increase similarity threshold or index parameters

## Future Enhancements

1. **Multi-Model Support**: Store embeddings from multiple models simultaneously
2. **Hierarchical Clustering**: Implement more sophisticated clustering algorithms  
3. **Embedding Versions**: Track embedding model versions for migration
4. **Real-time Updates**: Implement triggers for automatic re-embedding on content changes
5. **Federated Search**: Support searching across multiple users (with permissions)