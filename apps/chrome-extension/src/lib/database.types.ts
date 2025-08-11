export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      embeddings: {
        Row: {
          id: string
          extraction_id: string | null
          user_id: string | null
          embedding: string // vector(768) stored as string
          model: Database['public']['Enums']['embedding_model']
          task_type: Database['public']['Enums']['embedding_task_type']
          content_hash: string
          source_text: string
          text_length: number
          tokens_used: number | null
          processing_time_ms: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          extraction_id?: string | null
          user_id?: string | null
          embedding: string
          model?: Database['public']['Enums']['embedding_model']
          task_type?: Database['public']['Enums']['embedding_task_type']
          content_hash: string
          source_text: string
          text_length: number
          tokens_used?: number | null
          processing_time_ms?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          extraction_id?: string | null
          user_id?: string | null
          embedding?: string
          model?: Database['public']['Enums']['embedding_model']
          task_type?: Database['public']['Enums']['embedding_task_type']
          content_hash?: string
          source_text?: string
          text_length?: number
          tokens_used?: number | null
          processing_time_ms?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "embeddings_extraction_id_fkey"
            columns: ["extraction_id"]
            isOneToOne: false
            referencedRelation: "extractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embeddings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      extraction_tags: {
        Row: {
          created_at: string | null
          extraction_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          extraction_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          extraction_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extraction_tags_extraction_id_fkey"
            columns: ["extraction_id"]
            isOneToOne: false
            referencedRelation: "extractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      extractions: {
        Row: {
          created_at: string | null
          extraction_type: string | null
          id: string
          key_points: string[] | null
          original_content: string | null
          source_metadata: Json | null
          summary: string | null
          title: string | null
          updated_at: string | null
          url: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          extraction_type?: string | null
          id?: string
          key_points?: string[] | null
          original_content?: string | null
          source_metadata?: Json | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          url: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          extraction_type?: string | null
          id?: string
          key_points?: string[] | null
          original_content?: string | null
          source_metadata?: Json | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          url?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          preferences: Json | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          preferences?: Json | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          preferences?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      embeddings_with_metadata: {
        Row: {
          id: string
          extraction_id: string | null
          user_id: string | null
          embedding: string
          model: Database['public']['Enums']['embedding_model']
          task_type: Database['public']['Enums']['embedding_task_type']
          content_hash: string
          source_text: string
          text_length: number
          tokens_used: number | null
          processing_time_ms: number | null
          embedding_created_at: string | null
          embedding_updated_at: string | null
          url: string | null
          title: string | null
          original_content: string | null
          summary: string | null
          key_points: string[] | null
          extraction_type: string | null
          source_metadata: Json | null
          extraction_created_at: string | null
          email: string | null
          full_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      find_similar_content: {
        Args: {
          query_embedding: string
          similarity_threshold?: number
          max_results?: number
          target_user_id?: string
        }
        Returns: {
          extraction_id: string
          similarity_score: number
          title: string | null
          url: string | null
          summary: string | null
          created_at: string | null
        }[]
      }
      find_duplicate_content: {
        Args: {
          content_hash: string
          query_embedding: string
          similarity_threshold?: number
          target_user_id?: string
        }
        Returns: {
          extraction_id: string
          similarity_score: number
          title: string | null
          url: string | null
          is_exact_duplicate: boolean
        }[]
      }
      get_embedding_stats: {
        Args: {
          target_user_id?: string
        }
        Returns: {
          total_embeddings: number
          models_used: string[] | null
          avg_text_length: number | null
          oldest_embedding: string | null
          newest_embedding: string | null
        }[]
      }
      batch_similarity_search: {
        Args: {
          query_embeddings: string[]
          similarity_threshold?: number
          max_results_per_query?: number
          target_user_id?: string
        }
        Returns: {
          query_index: number
          extraction_id: string
          similarity_score: number
          title: string | null
          url: string | null
        }[]
      }
      cluster_embeddings: {
        Args: {
          num_clusters?: number
          target_user_id?: string
        }
        Returns: {
          extraction_id: string
          cluster_id: number
          distance_to_centroid: number
          title: string | null
          url: string | null
        }[]
      }
    }
    Enums: {
      embedding_model: 'gemini-embedding-001' | 'text-embedding-004' | 'text-embedding-preview-0409' | 'textembedding-gecko@001' | 'textembedding-gecko@003'
      embedding_task_type: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' | 'SEMANTIC_SIMILARITY' | 'CLASSIFICATION' | 'CLUSTERING'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      embedding_model: {
        'gemini-embedding-001': 'gemini-embedding-001',
        'text-embedding-004': 'text-embedding-004',
        'text-embedding-preview-0409': 'text-embedding-preview-0409',
        'textembedding-gecko@001': 'textembedding-gecko@001',
        'textembedding-gecko@003': 'textembedding-gecko@003',
      },
      embedding_task_type: {
        RETRIEVAL_QUERY: 'RETRIEVAL_QUERY',
        RETRIEVAL_DOCUMENT: 'RETRIEVAL_DOCUMENT',
        SEMANTIC_SIMILARITY: 'SEMANTIC_SIMILARITY',
        CLASSIFICATION: 'CLASSIFICATION',
        CLUSTERING: 'CLUSTERING',
      },
    },
  },
} as const

