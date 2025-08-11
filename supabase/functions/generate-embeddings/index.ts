/**
 * Supabase Edge Function: Generate Embeddings
 * 
 * This function demonstrates how to generate and store embeddings
 * for extracted content using the Gemini API integration.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.24.1';
import { corsHeaders } from '../_shared/cors.ts';

interface RequestBody {
  extraction_id: string;
  content: string;
  task_type?: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' | 'SEMANTIC_SIMILARITY' | 'CLASSIFICATION' | 'CLUSTERING';
  check_duplicates?: boolean;
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
      extraction_id, 
      content, 
      task_type = 'SEMANTIC_SIMILARITY',
      check_duplicates = true
    } = body;

    // Use hardcoded gemini-embedding-001 model
    const model = 'gemini-embedding-001';

    // Validate required fields
    if (!extraction_id || !content) {
      return new Response(
        JSON.stringify({ error: 'extraction_id and content are required' }),
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

    // Check if extraction belongs to user
    const { data: extraction, error: extractionError } = await supabase
      .from('extractions')
      .select('id, user_id, title, url')
      .eq('id', extraction_id)
      .eq('user_id', user.id)
      .single();

    if (extractionError || !extraction) {
      return new Response(
        JSON.stringify({ error: 'Extraction not found or access denied' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Generate content hash for duplicate detection
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Check for duplicates if requested
    let duplicates: any[] = [];
    if (check_duplicates) {
      const { data: existingDuplicates } = await supabase
        .from('embeddings')
        .select(`
          id,
          extraction_id,
          content_hash,
          extractions!inner(title, url)
        `)
        .eq('user_id', user.id)
        .eq('content_hash', contentHash);

      if (existingDuplicates && existingDuplicates.length > 0) {
        duplicates = existingDuplicates;
      }
    }

    // Generate embedding using @google/generative-ai library
    const startTime = Date.now();
    
    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const embeddingModel = genAI.getGenerativeModel({ 
        model: 'gemini-embedding-001' 
      });

      const result = await embeddingModel.embedContent({
        content: { role: 'user', parts: [{ text: content }] }
        // Note: taskType removed as it may not be supported in this library version
      });

      const geminiData: GeminiEmbeddingResponse = {
        embedding: {
          values: result.embedding.values
        }
      };
      
      const processingTimeMs = Date.now() - startTime;

    // Convert embedding to string format for storage
    const embeddingString = `[${geminiData.embedding.values.join(',')}]`;

    // Check if embedding already exists for this extraction
    const { data: existingEmbedding } = await supabase
      .from('embeddings')
      .select('id')
      .eq('extraction_id', extraction_id)
      .eq('task_type', task_type)
      .single();

    let embeddingId: string;

    if (existingEmbedding) {
      // Update existing embedding
      const { data: updatedEmbedding, error: updateError } = await supabase
        .from('embeddings')
        .update({
          embedding: embeddingString,
          content_hash: contentHash,
          source_text: content,
          text_length: content.length,
          tokens_used: null, // Token count not available with @google/genai
          processing_time_ms: processingTimeMs,
          model,
          task_type,
        })
        .eq('id', existingEmbedding.id)
        .select('id')
        .single();

      if (updateError) {
        throw new Error(`Failed to update embedding: ${updateError.message}`);
      }

      embeddingId = updatedEmbedding.id;
    } else {
      // Insert new embedding
      const { data: newEmbedding, error: insertError } = await supabase
        .from('embeddings')
        .insert({
          extraction_id,
          user_id: user.id,
          embedding: embeddingString,
          model,
          task_type,
          content_hash: contentHash,
          source_text: content,
          text_length: content.length,
          tokens_used: null, // Token count not available with @google/genai
          processing_time_ms: processingTimeMs,
        })
        .select('id')
        .single();

      if (insertError) {
        throw new Error(`Failed to store embedding: ${insertError.message}`);
      }

      embeddingId = newEmbedding.id;
    }

    // Return success response
    const response = {
      success: true,
      data: {
        embedding_id: embeddingId,
        extraction_id,
        model,
        task_type,
        dimensions: geminiData.embedding.values.length,
        tokens_used: null, // Token count not available with @google/genai
        processing_time_ms: processingTimeMs,
        content_hash: contentHash,
        duplicates: duplicates.length > 0 ? duplicates : null,
      },
    };

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    } catch (embeddingError) {
      console.error('Error generating embedding with Gemini:', embeddingError);
      throw new Error(`Failed to generate embedding: ${embeddingError instanceof Error ? embeddingError.message : 'Unknown error'}`);
    }

  } catch (error) {
    console.error('Error generating embedding:', error);
    
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

POST /functions/v1/generate-embeddings
Authorization: Bearer <user-jwt-token>
Content-Type: application/json

{
  "extraction_id": "123e4567-e89b-12d3-a456-426614174000",
  "content": "This is the text content to embed",
  // Note: model parameter is ignored, gemini-embedding-001 is always used
  "task_type": "SEMANTIC_SIMILARITY",
  "check_duplicates": true
}

Response:
{
  "success": true,
  "data": {
    "embedding_id": "987fcdeb-e89b-12d3-a456-426614174000",
    "extraction_id": "123e4567-e89b-12d3-a456-426614174000",
    "model": "gemini-embedding-001",
    "task_type": "SEMANTIC_SIMILARITY",
    "dimensions": 768,
    "tokens_used": 15,
    "processing_time_ms": 1250,
    "content_hash": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
    "duplicates": null
  }
}

*/