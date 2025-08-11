/**
 * Supabase Edge Function: Similarity Search
 * 
 * This function performs semantic similarity search across user's embeddings
 * using the Gemini API to generate query embeddings.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.24.1';
import { corsHeaders } from '../_shared/cors.ts';

// Deno global type declaration for Edge Functions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

interface RequestBody {
  query: string;
  similarity_threshold?: number;
  max_results?: number;
  include_content?: boolean;
}

interface GeminiEmbeddingResponse {
  embedding: {
    values: number[];
  };
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse request body
    const body: RequestBody = await req.json();
    const { 
      query,
      similarity_threshold = 0.7,
      max_results = 10,
      include_content = false
    } = body;

    // Use hardcoded gemini-embedding-001 model
    const model = 'gemini-embedding-001';

    // Validate required fields
    if (!query || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Query text is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate parameters
    if (similarity_threshold < 0 || similarity_threshold > 1) {
      return new Response(
        JSON.stringify({ error: 'similarity_threshold must be between 0 and 1' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (max_results < 1 || max_results > 50) {
      return new Response(
        JSON.stringify({ error: 'max_results must be between 1 and 50' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey || !geminiApiKey) {
      throw new Error('Missing required environment variables');
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get user from request
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Generate embedding for the query using @google/generative-ai library
    const startTime = Date.now();
    let geminiData: GeminiEmbeddingResponse;
    let embeddingGenerationTime: number;
    let queryEmbedding: string;
    
    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const embeddingModel = genAI.getGenerativeModel({ 
        model: 'gemini-embedding-001' 
      });

      const result = await embeddingModel.embedContent({
        content: { role: 'user', parts: [{ text: query }] }
        // Note: taskType removed as it may not be supported in this library version
      });

      geminiData = {
        embedding: {
          values: result.embedding.values
        }
      };
      
      embeddingGenerationTime = Date.now() - startTime;

      // Convert embedding to string format for the database function
      queryEmbedding = `[${geminiData.embedding.values.join(',')}]`;
      
    } catch (embeddingError) {
      console.error('Error generating embedding with Gemini:', embeddingError);
      throw new Error(`Failed to generate embedding: ${embeddingError instanceof Error ? embeddingError.message : 'Unknown error'}`);
    }

    // Perform similarity search using the database function
    const searchStartTime = Date.now();
    
    const { data: searchResults, error: searchError } = await supabase
      .rpc('find_similar_content', {
        query_embedding: queryEmbedding,
        similarity_threshold,
        max_results,
        target_user_id: user.id,
      });

    if (searchError) {
      throw new Error(`Similarity search failed: ${searchError.message}`);
    }

    const searchTime = Date.now() - searchStartTime;

    // If include_content is true, fetch additional content details
    let enrichedResults = searchResults || [];

    if (include_content && enrichedResults.length > 0) {
      const extractionIds = enrichedResults.map((r: any) => r.extraction_id);
      
      const { data: extractionDetails } = await supabase
        .from('extractions')
        .select(`
          id,
          original_content,
          key_points,
          extraction_type,
          source_metadata
        `)
        .in('id', extractionIds);

      if (extractionDetails) {
        enrichedResults = enrichedResults.map((result: any) => {
          const details = extractionDetails.find((d: any) => d.id === result.extraction_id);
          return {
            ...result,
            original_content: details?.original_content || null,
            key_points: details?.key_points || null,
            extraction_type: details?.extraction_type || null,
            source_metadata: details?.source_metadata || null,
          };
        });
      }
    }

    // Return success response
    const response = {
      success: true,
      data: {
        query,
        results: enrichedResults,
        metadata: {
          total_results: enrichedResults.length,
          similarity_threshold,
          max_results,
          model,
          query_dimensions: geminiData.embedding.values.length,
          timing: {
            embedding_generation_ms: embeddingGenerationTime,
            search_ms: searchTime,
            total_ms: Date.now() - startTime,
          },
        },
      },
    };

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in similarity search:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

/* Example usage:

POST /functions/v1/similarity-search
Authorization: Bearer <user-jwt-token>
Content-Type: application/json

{
  "query": "machine learning algorithms",
  "similarity_threshold": 0.7,
  "max_results": 5,
  // Note: model parameter is ignored, gemini-embedding-001 is always used
  "include_content": true
}

Response:
{
  "success": true,
  "data": {
    "query": "machine learning algorithms",
    "results": [
      {
        "extraction_id": "123e4567-e89b-12d3-a456-426614174000",
        "similarity_score": 0.87,
        "title": "Introduction to Neural Networks",
        "url": "https://example.com/neural-networks",
        "summary": "A comprehensive guide to neural networks...",
        "created_at": "2024-01-15T10:30:00Z",
        "original_content": "Neural networks are a subset of machine learning...",
        "key_points": ["Supervised learning", "Backpropagation", "Deep learning"],
        "extraction_type": "webpage",
        "source_metadata": {}
      }
    ],
    "metadata": {
      "total_results": 1,
      "similarity_threshold": 0.7,
      "max_results": 5,
      "model": "gemini-embedding-001",
      "query_dimensions": 768,
      "timing": {
        "embedding_generation_ms": 1200,
        "search_ms": 45,
        "total_ms": 1245
      }
    }
  }
}

*/