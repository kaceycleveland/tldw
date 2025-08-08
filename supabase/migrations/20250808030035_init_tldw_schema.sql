-- Create tables for TLDW Chrome Extension

-- User profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policy for profiles - users can only access their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Extracted content table
CREATE TABLE IF NOT EXISTS public.extractions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  original_content TEXT,
  summary TEXT,
  key_points TEXT[],
  extraction_type TEXT DEFAULT 'webpage', -- 'webpage', 'video', 'pdf', etc.
  source_metadata JSONB DEFAULT '{}', -- For storing additional metadata like video duration, page info, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for extractions table
ALTER TABLE public.extractions ENABLE ROW LEVEL SECURITY;

-- Create policies for extractions - users can only access their own extractions
CREATE POLICY "Users can view own extractions" ON public.extractions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own extractions" ON public.extractions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own extractions" ON public.extractions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own extractions" ON public.extractions
  FOR DELETE USING (auth.uid() = user_id);

-- Tags table for organizing extractions
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6', -- Default blue color
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Enable RLS for tags table
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- Create policies for tags
CREATE POLICY "Users can view own tags" ON public.tags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tags" ON public.tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tags" ON public.tags
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags" ON public.tags
  FOR DELETE USING (auth.uid() = user_id);

-- Junction table for extraction-tag relationships (many-to-many)
CREATE TABLE IF NOT EXISTS public.extraction_tags (
  extraction_id UUID REFERENCES public.extractions(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (extraction_id, tag_id)
);

-- Enable RLS for extraction_tags table
ALTER TABLE public.extraction_tags ENABLE ROW LEVEL SECURITY;

-- Create policies for extraction_tags - users can only manage their own extraction-tag relationships
CREATE POLICY "Users can view own extraction tags" ON public.extraction_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.extractions e
      WHERE e.id = extraction_tags.extraction_id AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own extraction tags" ON public.extraction_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.extractions e
      WHERE e.id = extraction_tags.extraction_id AND e.user_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM public.tags t
      WHERE t.id = extraction_tags.tag_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own extraction tags" ON public.extraction_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.extractions e
      WHERE e.id = extraction_tags.extraction_id AND e.user_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_extractions_user_id ON public.extractions(user_id);
CREATE INDEX IF NOT EXISTS idx_extractions_created_at ON public.extractions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extractions_url ON public.extractions(url);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON public.tags(user_id);
CREATE INDEX IF NOT EXISTS idx_extraction_tags_extraction_id ON public.extraction_tags(extraction_id);
CREATE INDEX IF NOT EXISTS idx_extraction_tags_tag_id ON public.extraction_tags(tag_id);

-- Function to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at timestamps
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_extractions_updated_at
  BEFORE UPDATE ON public.extractions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();