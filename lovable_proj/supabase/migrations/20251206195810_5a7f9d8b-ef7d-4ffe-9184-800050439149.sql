-- Create plant_analyses table to store Gemini analysis results
CREATE TABLE public.plant_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  image_url TEXT,
  image_type TEXT NOT NULL DEFAULT 'overground' CHECK (image_type IN ('overground', 'underground')),
  leaf_count INTEGER,
  average_color TEXT,
  has_infection BOOLEAN DEFAULT false,
  infection_details TEXT,
  plant_angle NUMERIC,
  growth_stage TEXT CHECK (growth_stage IN ('seedling', 'vegetative', 'flowering', 'fruiting', 'harvest-ready', 'decline')),
  soil_nitrogen NUMERIC,
  soil_phosphorus NUMERIC,
  soil_potassium NUMERIC,
  soil_ph NUMERIC,
  soil_moisture NUMERIC,
  temperature NUMERIC,
  raw_analysis JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS but allow public read/write for demo purposes
ALTER TABLE public.plant_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
ON public.plant_analyses
FOR SELECT
USING (true);

CREATE POLICY "Allow public insert access"
ON public.plant_analyses
FOR INSERT
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.plant_analyses;