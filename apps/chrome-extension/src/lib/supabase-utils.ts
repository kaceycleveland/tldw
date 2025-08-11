import { supabase, isSupabaseConfigured } from './supabase'
import type { User, AuthError, Session } from '@supabase/supabase-js'
import type { Database } from './database.types'

export interface AuthResult {
  user: User | null
  session: Session | null
  error: AuthError | null
}

// Type aliases for database tables
type Tables = Database['public']['Tables']
type ProfileRow = Tables['profiles']['Row']
type ProfileUpdate = Tables['profiles']['Update']
type ExtractionRow = Tables['extractions']['Row']
type ExtractionInsert = Tables['extractions']['Insert']
type ExtractionUpdate = Tables['extractions']['Update']
type TagRow = Tables['tags']['Row']
type TagInsert = Tables['tags']['Insert']
type TagUpdate = Tables['tags']['Update']
type ExtractionTagRow = Tables['extraction_tags']['Row']

// Authentication utilities
export const auth = {
  // Get current user
  async getCurrentUser(): Promise<User | null> {
    if (!isSupabaseConfigured()) return null
    
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  // Get current session
  async getCurrentSession(): Promise<Session | null> {
    if (!isSupabaseConfigured()) return null
    
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },

  // Sign in with email and password
  async signIn(email: string, password: string): Promise<AuthResult> {
    if (!isSupabaseConfigured()) {
      return { user: null, session: null, error: new Error('Supabase not configured') as AuthError }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    return {
      user: data.user,
      session: data.session,
      error
    }
  },

  // Sign up with email and password
  async signUp(email: string, password: string): Promise<AuthResult> {
    if (!isSupabaseConfigured()) {
      return { user: null, session: null, error: new Error('Supabase not configured') as AuthError }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })

    return {
      user: data.user,
      session: data.session,
      error
    }
  },

  // Sign out
  async signOut(): Promise<{ error: AuthError | null }> {
    if (!isSupabaseConfigured()) {
      return { error: new Error('Supabase not configured') as AuthError }
    }

    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // Listen to auth state changes
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    if (!isSupabaseConfigured()) return { data: { subscription: { unsubscribe: () => {} } } }
    
    return supabase.auth.onAuthStateChange(callback)
  }
}

// Profile utilities
export const profiles = {
  // Get current user's profile
  async getCurrentProfile(): Promise<{ data: ProfileRow | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: new Error('No authenticated user') }

    return await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
  },

  // Update current user's profile
  async updateProfile(updates: Partial<ProfileUpdate>): Promise<{ data: ProfileRow | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: new Error('No authenticated user') }

    return await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()
  }
}

// Extraction utilities
export const extractions = {
  // Get all extractions for the current user
  async getAll(): Promise<{ data: ExtractionRow[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    return await supabase
      .from('extractions')
      .select('*')
      .order('created_at', { ascending: false })
  },

  // Get a specific extraction
  async getById(id: string): Promise<{ data: ExtractionRow | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    return await supabase
      .from('extractions')
      .select('*')
      .eq('id', id)
      .single()
  },

  // Create a new extraction
  async create(extraction: Omit<ExtractionInsert, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<{ data: ExtractionRow | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: new Error('No authenticated user') }

    return await supabase
      .from('extractions')
      .insert({
        ...extraction,
        user_id: user.id
      })
      .select()
      .single()
  },

  // Update an extraction
  async update(id: string, updates: Partial<ExtractionUpdate>): Promise<{ data: ExtractionRow | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    return await supabase
      .from('extractions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
  },

  // Delete an extraction
  async delete(id: string): Promise<{ data: any; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    return await supabase
      .from('extractions')
      .delete()
      .eq('id', id)
  },

  // Search extractions by content
  async search(query: string): Promise<{ data: ExtractionRow[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    return await supabase
      .from('extractions')
      .select('*')
      .or(`title.ilike.%${query}%,summary.ilike.%${query}%,original_content.ilike.%${query}%`)
      .order('created_at', { ascending: false })
  }
}

// Tag utilities
export const tags = {
  // Get all tags for the current user
  async getAll(): Promise<{ data: TagRow[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    return await supabase
      .from('tags')
      .select('*')
      .order('name')
  },

  // Create a new tag
  async create(tag: Omit<TagInsert, 'id' | 'user_id' | 'created_at'>): Promise<{ data: TagRow | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: new Error('No authenticated user') }

    return await supabase
      .from('tags')
      .insert({
        ...tag,
        user_id: user.id
      })
      .select()
      .single()
  },

  // Update a tag
  async update(id: string, updates: Partial<TagUpdate>): Promise<{ data: TagRow | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    return await supabase
      .from('tags')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
  },

  // Delete a tag
  async delete(id: string): Promise<{ data: any; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    return await supabase
      .from('tags')
      .delete()
      .eq('id', id)
  },

  // Get tags for a specific extraction
  async getForExtraction(extractionId: string): Promise<{ data: TagRow[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data, error } = await supabase
      .from('extraction_tags')
      .select(`
        tag_id,
        tags (*)
      `)
      .eq('extraction_id', extractionId)

    if (error) return { data: null, error }
    
    // Transform the nested data structure
    const tags = data?.map(item => (item as any).tags).filter(Boolean) || []
    return { data: tags, error: null }
  },

  // Add tag to extraction
  async addToExtraction(extractionId: string, tagId: string): Promise<{ data: ExtractionTagRow | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    return await supabase
      .from('extraction_tags')
      .insert({
        extraction_id: extractionId,
        tag_id: tagId
      })
      .select()
      .single()
  },

  // Remove tag from extraction
  async removeFromExtraction(extractionId: string, tagId: string): Promise<{ data: any; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    return await supabase
      .from('extraction_tags')
      .delete()
      .eq('extraction_id', extractionId)
      .eq('tag_id', tagId)
  }
}

// Storage utilities (for file uploads)
export const storage = {
  // Upload a file
  async upload(bucket: string, path: string, file: File): Promise<{ data: any; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    return await supabase.storage.from(bucket).upload(path, file)
  },

  // Download a file
  async download(bucket: string, path: string): Promise<{ data: Blob | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    return await supabase.storage.from(bucket).download(path)
  },

  // Get public URL for a file
  getPublicUrl(bucket: string, path: string): { data: { publicUrl: string } } {
    if (!isSupabaseConfigured()) {
      return { data: { publicUrl: '' } }
    }

    return supabase.storage.from(bucket).getPublicUrl(path)
  },

  // Delete a file
  async remove(bucket: string, paths: string[]): Promise<{ data: any; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    return await supabase.storage.from(bucket).remove(paths)
  }
}