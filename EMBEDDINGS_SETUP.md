# TLDW Embeddings System Setup Guide

This guide provides step-by-step instructions for setting up the embeddings system in your TLDW Chrome extension project.

## Prerequisites

1. **Supabase Project**: Active Supabase project with PostgreSQL database
2. **Gemini API Key**: Google AI Studio API key with Gemini API access
3. **Node.js**: Version 18+ for local development
4. **Supabase CLI**: For running migrations and deploying Edge Functions

## 1. Database Setup

### Enable pgvector Extension

First, enable the pgvector extension in your Supabase database:

```sql
-- Run this in your Supabase SQL editor
CREATE EXTENSION IF NOT EXISTS vector;
```

### Run Migration

Apply the embeddings migration to set up tables, functions, and indexes:

```bash
# From your project root
supabase db push
```

This will apply the migration file: `supabase/migrations/20250809000000_add_embeddings_support.sql`

### Verify Setup

Check that the migration was successful:

```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'embeddings';

-- Verify functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name LIKE '%embedding%';

-- Verify indexes exist
SELECT indexname FROM pg_indexes 
WHERE tablename = 'embeddings';
```

## 2. Environment Variables

### Supabase Environment Variables

Add the following to your Supabase project's environment variables:

```bash
# In Supabase Dashboard > Settings > Environment Variables
GEMINI_API_KEY=your_gemini_api_key_here
```

### Local Development (.env.local)

Create or update your local environment file:

```bash
# .env.local
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GEMINI_API_KEY=your_gemini_api_key
```

## 3. Deploy Edge Functions

Deploy the Edge Functions for embeddings operations:

```bash
# Deploy individual functions
supabase functions deploy generate-embeddings
supabase functions deploy similarity-search

# Or deploy all functions
supabase functions deploy
```

### Set Edge Function Environment Variables

```bash
# Set environment variables for Edge Functions
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here
```

## 4. Update Database Types

Regenerate TypeScript types to include the new embeddings schema:

```bash
# Generate updated types
supabase gen types typescript --local > src/lib/database.types.ts
```

The types have already been manually updated in this project, but you should regenerate them after any schema changes.

## 5. Usage Examples

### Frontend Integration

```typescript
import { EmbeddingService } from './lib/embeddings';
import { supabase } from './lib/supabase';

// Initialize embedding service
const embeddingService = new EmbeddingService(supabase, import.meta.env.VITE_GEMINI_API_KEY);

// Generate and store embedding for extracted content
async function processExtraction(extractionId: string, content: string) {
  try {
    // Check for duplicates first
    const duplicates = await embeddingService.findDuplicates(content, 0.95);
    
    if (duplicates.length > 0 && duplicates[0].is_exact_duplicate) {
      console.log('Exact duplicate found:', duplicates[0]);
      return;
    }

    // Generate and store embedding
    const embeddingId = await embeddingService.embedAndStore(extractionId, content);
    console.log('Embedding created:', embeddingId);
    
  } catch (error) {
    console.error('Failed to process embedding:', error);
  }
}

// Search for similar content
async function searchSimilarContent(query: string) {
  try {
    const results = await embeddingService.findSimilarContent(query, 0.7, 10);
    return results;
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}
```

### Using Edge Functions Directly

```typescript
// Generate embedding using Edge Function
async function generateEmbeddingViaEdgeFunction(extractionId: string, content: string) {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('User not authenticated');
  }

  const response = await fetch('/functions/v1/generate-embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      extraction_id: extractionId,
      content: content,
      check_duplicates: true,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate embedding');
  }

  return await response.json();
}

// Search using Edge Function
async function searchViaEdgeFunction(query: string) {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('User not authenticated');
  }

  const response = await fetch('/functions/v1/similarity-search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      query: query,
      similarity_threshold: 0.7,
      max_results: 10,
      include_content: true,
    }),
  });

  if (!response.ok) {
    throw new Error('Search failed');
  }

  return await response.json();
}
```

## 6. Performance Tuning

### Index Optimization

The HNSW index parameters can be tuned based on your use case:

```sql
-- For better search quality (slower build time)
CREATE INDEX idx_embeddings_hnsw_high_quality 
  ON public.embeddings USING hnsw (embedding vector_cosine_ops) 
  WITH (m = 32, ef_construction = 128);

-- For faster indexing (lower search quality)
CREATE INDEX idx_embeddings_hnsw_fast_build 
  ON public.embeddings USING hnsw (embedding vector_cosine_ops) 
  WITH (m = 8, ef_construction = 32);
```

### Monitor Performance

```sql
-- Check index usage
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats 
WHERE tablename = 'embeddings';

-- Monitor query performance
EXPLAIN ANALYZE 
SELECT extraction_id, (1 - (embedding <=> '[0.1,0.2,...]'::vector)) as similarity
FROM embeddings
WHERE user_id = 'user-id'
ORDER BY embedding <=> '[0.1,0.2,...]'::vector
LIMIT 10;
```

## 7. Monitoring and Maintenance

### Regular Maintenance Tasks

1. **Update Statistics**: Run `ANALYZE embeddings;` after bulk operations
2. **Monitor Storage**: Track vector storage growth
3. **Index Health**: Monitor index fragmentation and rebuild if needed

### Monitoring Queries

```sql
-- Get embedding statistics
SELECT * FROM get_embedding_stats();

-- Check vector index effectiveness
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename = 'embeddings';

-- Monitor API usage patterns
SELECT 
  model,
  task_type,
  COUNT(*) as count,
  AVG(processing_time_ms) as avg_processing_time,
  AVG(tokens_used) as avg_tokens
FROM embeddings
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY model, task_type;
```

## 8. Security Considerations

### Row Level Security (RLS)

The embeddings system uses RLS to ensure data isolation:

- Users can only access their own embeddings
- All database functions respect user boundaries
- Edge Functions validate user authentication

### API Key Security

- Store Gemini API keys in Supabase secrets, never in client code
- Use Edge Functions for server-side API calls
- Implement rate limiting on Edge Functions if needed

### Content Privacy

- Embeddings contain semantic information about content
- Consider data retention policies for embeddings
- Implement proper deletion cascades

## 9. Troubleshooting

### Common Issues

1. **pgvector Extension Not Found**
   ```bash
   # Enable in Supabase SQL editor
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. **HNSW Index Build Fails**
   ```sql
   -- Check for null or invalid vectors
   SELECT COUNT(*) FROM embeddings WHERE embedding IS NULL;
   SELECT COUNT(*) FROM embeddings WHERE array_length(embedding::float[], 1) != 768;
   ```

3. **Slow Similarity Search**
   ```sql
   -- Verify index is being used
   EXPLAIN (ANALYZE, BUFFERS) 
   SELECT * FROM find_similar_content('[0.1,0.2,...]'::vector(768), 0.7, 10);
   ```

4. **Gemini API Errors**
   - Check API key validity
   - Verify rate limits
   - Monitor token usage

### Debug Queries

```sql
-- Find embeddings with issues
SELECT id, extraction_id, text_length, array_length(embedding::float[], 1) as dimensions
FROM embeddings
WHERE array_length(embedding::float[], 1) != 768 OR embedding IS NULL;

-- Check for orphaned embeddings
SELECT e.id, e.extraction_id
FROM embeddings e
LEFT JOIN extractions ex ON ex.id = e.extraction_id
WHERE ex.id IS NULL;

-- Monitor recent embedding generation
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as embeddings_created,
  AVG(processing_time_ms) as avg_processing_time
FROM embeddings
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;
```

## 10. Advanced Features

### Clustering Analysis

```typescript
// Use clustering to organize content
const clusters = await embeddingService.clusterEmbeddings(5);

// Group results by cluster
const groupedClusters = clusters.reduce((acc, item) => {
  if (!acc[item.cluster_id]) {
    acc[item.cluster_id] = [];
  }
  acc[item.cluster_id].push(item);
  return acc;
}, {} as Record<number, typeof clusters>);
```

### Batch Processing

```typescript
// Process multiple extractions efficiently
const batchItems = extractions.map(ext => ({
  extractionId: ext.id,
  content: ext.summary || ext.original_content || '',
}));

const results = await embeddingService.batchEmbedAndStore(batchItems);
console.log(`Processed ${results.filter(r => r.success).length}/${results.length} embeddings`);
```

### Custom Similarity Thresholds

```typescript
// Use different thresholds for different use cases
const duplicateThreshold = EmbeddingUtils.getRecommendedThreshold('duplicate_detection'); // 0.95
const searchThreshold = EmbeddingUtils.getRecommendedThreshold('semantic_search'); // 0.7
const clusterThreshold = EmbeddingUtils.getRecommendedThreshold('clustering'); // 0.6
```

This completes the setup guide for the TLDW embeddings system. The system provides production-ready vector similarity search with proper security, performance optimization, and comprehensive error handling.