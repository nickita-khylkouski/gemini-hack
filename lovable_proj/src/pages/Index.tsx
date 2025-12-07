import { useState, useEffect } from "react";
import Header from "@/components/Header";
import SinglePlantView from "@/components/SinglePlantView";
import WeatherWidget from "@/components/WeatherWidget";
import SunlightTracker from "@/components/SunlightTracker";
import AIChat, { PlantContext } from "@/components/AIChat";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [sensorData] = useState({
    temperature: 24,
    moisture: 62,
    sunlight: 85,
    nitrogen: 42,
    phosphorus: 38,
    potassium: 55,
    ph: 6.5,
  });

  const [analysis, setAnalysis] = useState<PlantContext["analysis"] | null>(null);
  const [latestAnalyses, setLatestAnalyses] = useState<any[]>([]);

  const weatherData = {
    location: "San Francisco, CA",
    temperature: 18,
    condition: "sunny" as const,
    humidity: 65,
    forecast: [
      { day: "Mon", temp: 19, condition: "sunny" as const },
      { day: "Tue", temp: 17, condition: "cloudy" as const },
      { day: "Wed", temp: 15, condition: "rainy" as const },
      { day: "Thu", temp: 18, condition: "cloudy" as const },
      { day: "Fri", temp: 20, condition: "sunny" as const },
    ],
  };

  const sunlightData = {
    currentHours: 6.5,
    targetHours: 8,
    sunrise: "6:42 AM",
    sunset: "7:18 PM",
  };

  // Fetch latest analyses from database
  const fetchLatestAnalyses = async () => {
    const { data, error } = await supabase
      .from("plant_analyses")
      .select("*")
      .order("captured_at", { ascending: false })
      .limit(10);

    if (!error && data) {
      setLatestAnalyses(data);
      // Set the most recent analysis
      if (data.length > 0) {
        const latest = data[0];
        const rawAnalysis = latest.raw_analysis as Record<string, unknown> | null;
        setAnalysis({
          leaf_count: latest.leaf_count,
          average_color: latest.average_color || "#4ade80",
          has_infection: latest.has_infection || false,
          infection_details: latest.infection_details,
          plant_angle: latest.plant_angle || 0,
          growth_stage: latest.growth_stage || "vegetative",
          health_score: (rawAnalysis?.health_score as number) || 75,
          observations: (rawAnalysis?.observations as string) || "",
          recommendations: (rawAnalysis?.recommendations as string[]) || [],
        });
      }
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    fetchLatestAnalyses();

    const channel = supabase
      .channel("plant-analyses-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "plant_analyses",
        },
        () => {
          fetchLatestAnalyses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Build plant context for chat
  const plantContext: PlantContext = {
    sensorData,
    analysis: analysis || undefined,
    weather: {
      location: weatherData.location,
      temperature: weatherData.temperature,
      condition: weatherData.condition,
      humidity: weatherData.humidity,
    },
    sunlight: sunlightData,
    latestAnalyses,
  };

  const handleAddPlant = () => {
    toast.info("Single plant mode - upload images to analyze");
  };

  const handleSearch = () => {
    toast.info("Search feature coming soon!");
  };

  const handleSendMessage = async (
    message: string,
    history: { role: "user" | "assistant"; content: string }[],
    context: PlantContext
  ) => {
    const { data, error } = await supabase.functions.invoke("plant-chat", {
      body: {
        messages: [...history, { role: "user", content: message }],
        plantContext: context,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return data.content;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onAddPlant={handleAddPlant} onSearch={handleSearch} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        {/* Welcome Section */}
        <section className="mb-8">
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-2">
            Plant Health Analyzer 🌱
          </h2>
          <p className="text-muted-foreground">
            Upload plant images for AI-powered analysis. Get insights on growth stage, health, and care recommendations.
          </p>
        </section>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Plant Analysis */}
          <div className="lg:col-span-2">
            <SinglePlantView onAnalysisComplete={fetchLatestAnalyses} />
          </div>

          {/* Right Column - Widgets */}
          <div className="space-y-6">
            <WeatherWidget weather={weatherData} />
            <SunlightTracker
              currentHours={sunlightData.currentHours}
              targetHours={sunlightData.targetHours}
              sunrise={sunlightData.sunrise}
              sunset={sunlightData.sunset}
            />
          </div>
        </div>

        {/* AI Chat Section */}
        <section className="mt-8">
          <h3 className="font-serif text-2xl font-bold text-foreground mb-4">
            Ask GrowWise AI
          </h3>
          <AIChat onSendMessage={handleSendMessage} plantContext={plantContext} />
        </section>
      </main>
    </div>
  );
};

export default Index;
