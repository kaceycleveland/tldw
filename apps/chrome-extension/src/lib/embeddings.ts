/**
 * Embeddings utilities for TLDW Chrome Extension
 * Handles integration with Gemini API and Supabase vector storage
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Database } from './database.types';
import crypto from 'crypto';

type EmbeddingModel = Database['public']['Enums']['embedding_model'];
type EmbeddingTaskType = Database['public']['Enums']['embedding_task_type'];

// Type definitions for embedding results

interface EmbeddingResult {
  embedding: number[];
  tokensUsed?: number;
  processingTimeMs: number;
}

interface SimilarityResult {
  extraction_id: string;
  similarity_score: number;
  title: string | null;
  url: string | null;
  summary: string | null;
  created_at: string | null;
}

interface DuplicateResult {
  extraction_id: string;
  similarity_score: number;
  title: string | null;
  url: string | null;
  is_exact_duplicate: boolean;
}

/**
 * Embedding service for handling vector operations
 */
export class EmbeddingService {
  private supabase: ReturnType<typeof createClient<Database>>;
  private genAI: GoogleGenerativeAI;

  constructor(supabase: ReturnType<typeof createClient<Database>>, geminiApiKey: string) {
    this.supabase = supabase;
    this.genAI = new GoogleGenerativeAI(geminiApiKey);
  }

  /**
   * Generate embedding using Gemini API (hardcoded to use gemini-embedding-001)
   */
  async generateEmbedding(
    text: string,
    _model?: EmbeddingModel, // Ignored - gemini-embedding-001 is always used
    _taskType?: EmbeddingTaskType // Ignored - library doesn't support taskType in this version
  ): Promise<EmbeddingResult> {
    const startTime = Date.now();

    try {
      const embeddingModel = this.genAI.getGenerativeModel({ 
        model: 'gemini-embedding-001' 
      });

      const result = await embeddingModel.embedContent({
        content: { role: 'user', parts: [{ text }] }
        // Note: taskType removed as it may not be supported in this library version
      });

      const processingTimeMs = Date.now() - startTime;

      return {
        embedding: result.embedding.values,
        tokensUsed: undefined, // Token count not available with @google/genai
        processingTimeMs,
      };
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Store embedding in Supabase
   */
  async storeEmbedding(
    extractionId: string,
    content: string,
    embedding: number[],
    _model?: EmbeddingModel, // Ignored - gemini-embedding-001 is always used
    taskType: EmbeddingTaskType = 'SEMANTIC_SIMILARITY',
    tokensUsed?: number,
    processingTimeMs?: number
  ): Promise<string> {
    // Generate content hash for deduplication
    const contentHash = crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');

    // Convert embedding array to string format for storage
    const embeddingString = `[${embedding.join(',')}]`;

    const { data, error } = await this.supabase
      .from('embeddings')
      .insert({
        extraction_id: extractionId,
        embedding: embeddingString,
        model: 'gemini-embedding-001' as EmbeddingModel,
        task_type: taskType,
        content_hash: contentHash,
        source_text: content,
        text_length: content.length,
        tokens_used: tokensUsed,
        processing_time_ms: processingTimeMs,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to store embedding: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Generate and store embedding in one operation
   */
  async embedAndStore(
    extractionId: string,
    content: string,
    _model?: EmbeddingModel, // Ignored - gemini-embedding-001 is always used
    taskType: EmbeddingTaskType = 'SEMANTIC_SIMILARITY'
  ): Promise<string> {
    const result = await this.generateEmbedding(content, undefined, taskType);
    return await this.storeEmbedding(
      extractionId,
      content,
      result.embedding,
      undefined,
      taskType,
      result.tokensUsed,
      result.processingTimeMs
    );
  }

  /**
   * Find similar content using vector similarity search
   */
  async findSimilarContent(
    queryText: string,
    similarityThreshold: number = 0.8,
    maxResults: number = 10,
    _model?: EmbeddingModel // Ignored - gemini-embedding-001 is always used
  ): Promise<SimilarityResult[]> {
    // Generate embedding for query
    const { embedding } = await this.generateEmbedding(queryText, undefined, 'RETRIEVAL_QUERY');
    const embeddingString = `[${embedding.join(',')}]`;

    const { data, error } = await this.supabase
      .rpc('find_similar_content', {
        query_embedding: embeddingString,
        similarity_threshold: similarityThreshold,
        max_results: maxResults,
      });

    if (error) {
      throw new Error(`Similarity search failed: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Check for duplicate content
   */
  async findDuplicates(
    content: string,
    similarityThreshold: number = 0.95,
    _model?: EmbeddingModel // Ignored - gemini-embedding-001 is always used
  ): Promise<DuplicateResult[]> {
    // Generate content hash and embedding
    const contentHash = crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');

    const { embedding } = await this.generateEmbedding(content, undefined, 'SEMANTIC_SIMILARITY');
    const embeddingString = `[${embedding.join(',')}]`;

    const { data, error } = await this.supabase
      .rpc('find_duplicate_content', {
        content_hash: contentHash,
        query_embedding: embeddingString,
        similarity_threshold: similarityThreshold,
      });

    if (error) {
      throw new Error(`Duplicate detection failed: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Batch process multiple texts
   */
  async batchEmbedAndStore(
    items: Array<{
      extractionId: string;
      content: string;
      model?: EmbeddingModel;
      taskType?: EmbeddingTaskType;
    }>
  ): Promise<Array<{ extractionId: string; embeddingId: string; success: boolean; error?: string }>> {
    const results: Array<{ extractionId: string; embeddingId: string; success: boolean; error?: string }> = [];

    // Process in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (item) => {
        try {
          const embeddingId = await this.embedAndStore(
            item.extractionId,
            item.content,
            item.model,
            item.taskType
          );
          
          return {
            extractionId: item.extractionId,
            embeddingId,
            success: true,
          };
        } catch (error) {
          return {
            extractionId: item.extractionId,
            embeddingId: '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            extractionId: batch[index].extractionId,
            embeddingId: '',
            success: false,
            error: result.reason?.message || 'Promise rejected',
          });
        }
      });

      // Small delay between batches to be respectful to the API
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Get embedding statistics for current user
   */
  async getStats(): Promise<{
    total_embeddings: number;
    models_used: string[] | null;
    avg_text_length: number | null;
    oldest_embedding: string | null;
    newest_embedding: string | null;
  } | null> {
    const { data, error } = await this.supabase
      .rpc('get_embedding_stats');

    if (error) {
      throw new Error(`Failed to get stats: ${error.message}`);
    }

    return data?.[0] || null;
  }

  /**
   * Cluster user's embeddings
   */
  async clusterEmbeddings(numClusters: number = 5): Promise<Array<{
    extraction_id: string;
    cluster_id: number;
    distance_to_centroid: number;
    title: string | null;
    url: string | null;
  }>> {
    const { data, error } = await this.supabase
      .rpc('cluster_embeddings', {
        num_clusters: numClusters,
      });

    if (error) {
      throw new Error(`Clustering failed: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get embeddings with metadata for a specific extraction
   */
  async getEmbeddingByExtraction(extractionId: string): Promise<Database['public']['Views']['embeddings_with_metadata']['Row'] | null> {
    const { data, error } = await this.supabase
      .from('embeddings_with_metadata')
      .select('*')
      .eq('extraction_id', extractionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No embedding found
      }
      throw new Error(`Failed to get embedding: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete embedding by extraction ID
   */
  async deleteEmbedding(extractionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('embeddings')
      .delete()
      .eq('extraction_id', extractionId);

    if (error) {
      throw new Error(`Failed to delete embedding: ${error.message}`);
    }
  }

  /**
   * Update embedding content (re-embed if content changed)
   */
  async updateEmbedding(
    extractionId: string,
    newContent: string,
    _model?: EmbeddingModel, // Ignored - gemini-embedding-001 is always used
    taskType: EmbeddingTaskType = 'SEMANTIC_SIMILARITY'
  ): Promise<void> {
    // Check if embedding exists
    const existing = await this.getEmbeddingByExtraction(extractionId);
    if (!existing) {
      throw new Error('Embedding not found');
    }

    // Generate new embedding
    const result = await this.generateEmbedding(newContent, undefined, taskType);
    
    // Generate new content hash
    const contentHash = crypto
      .createHash('sha256')
      .update(newContent)
      .digest('hex');

    // Update embedding
    const embeddingString = `[${result.embedding.join(',')}]`;
    
    const { error } = await this.supabase
      .from('embeddings')
      .update({
        embedding: embeddingString,
        content_hash: contentHash,
        source_text: newContent,
        text_length: newContent.length,
        tokens_used: result.tokensUsed,
        processing_time_ms: result.processingTimeMs,
        model: 'gemini-embedding-001' as EmbeddingModel,
        task_type: taskType,
      })
      .eq('extraction_id', extractionId);

    if (error) {
      throw new Error(`Failed to update embedding: ${error.message}`);
    }
  }
}

/**
 * Utility functions for working with embeddings
 */
export const EmbeddingUtils = {
  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  },

  /**
   * Parse embedding string back to number array
   */
  parseEmbedding(embeddingString: string): number[] {
    try {
      return JSON.parse(embeddingString) as number[];
    } catch (error) {
      throw new Error('Invalid embedding string format');
    }
  },

  /**
   * Validate embedding dimensions
   */
  validateEmbedding(embedding: number[], expectedDimensions: number = 768): boolean {
    return Array.isArray(embedding) && 
           embedding.length === expectedDimensions &&
           embedding.every(val => typeof val === 'number' && !isNaN(val));
  },

  /**
   * Normalize embedding vector
   */
  normalizeEmbedding(embedding: number[]): number[] {
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
  },

  /**
   * Get recommended similarity thresholds by use case
   */
  getRecommendedThreshold(useCase: 'duplicate_detection' | 'semantic_search' | 'clustering'): number {
    switch (useCase) {
      case 'duplicate_detection':
        return 0.95; // Very high threshold for near-duplicates
      case 'semantic_search':
        return 0.7;  // Moderate threshold for related content
      case 'clustering':
        return 0.6;  // Lower threshold for grouping similar content
      default:
        return 0.8;
    }
  },
};

/**
 * Error types for embedding operations
 */
export class EmbeddingError extends Error {
  constructor(message: string, public code: string, public originalError?: Error) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

export class GeminiAPIError extends EmbeddingError {
  constructor(message: string, originalError?: Error) {
    super(message, 'GEMINI_API_ERROR', originalError);
    this.name = 'GeminiAPIError';
  }
}

export class VectorStorageError extends EmbeddingError {
  constructor(message: string, originalError?: Error) {
    super(message, 'VECTOR_STORAGE_ERROR', originalError);
    this.name = 'VectorStorageError';
  }
}