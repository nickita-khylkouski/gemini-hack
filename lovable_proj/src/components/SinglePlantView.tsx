import { useState, useRef } from "react";
import { Camera, Upload, Leaf, Thermometer, Droplets, Sun, AlertTriangle, TrendingUp, Microscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import basilPlant1 from "@/assets/basil-plant-1.jpg";
import basilRoots1 from "@/assets/basil-roots-1.jpg";

interface AnalysisResult {
  leaf_count: number | null;
  average_color: string;
  has_infection: boolean;
  infection_details: string | null;
  plant_angle: number;
  growth_stage: string;
  health_score: number;
  observations: string;
  recommendations: string[];
}

interface SensorData {
  temperature: number;
  moisture: number;
  sunlight: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
}

interface SinglePlantViewProps {
  onAnalysisComplete?: () => void;
}

const SinglePlantView = ({ onAnalysisComplete }: SinglePlantViewProps) => {
  const [overgroundImage, setOvergroundImage] = useState<string | null>(basilPlant1);
  const [undergroundImage, setUndergroundImage] = useState<string | null>(basilRoots1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const overgroundInputRef = useRef<HTMLInputElement>(null);
  const undergroundInputRef = useRef<HTMLInputElement>(null);

  // Simulated sensor data (would come from actual sensors)
  const [sensorData] = useState<SensorData>({
    temperature: 24,
    moisture: 62,
    sunlight: 85,
    nitrogen: 42,
    phosphorus: 38,
    potassium: 55,
    ph: 6.5,
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "overground" | "underground") => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if (type === "overground") {
          setOvergroundImage(base64);
        } else {
          setUndergroundImage(base64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async (imageBase64: string, imageType: "overground" | "underground") => {
    try {
      const { data, error } = await supabase.functions.invoke("analyze-plant", {
        body: { imageBase64, imageType, sensorData },
      });

      if (error) throw error;
      return data.analysis;
    } catch (error) {
      console.error("Analysis error:", error);
      throw error;
    }
  };

  const handleAnalyze = async () => {
    if (!overgroundImage && !undergroundImage) {
      toast.error("Please upload at least one image to analyze");
      return;
    }

    setIsAnalyzing(true);
    toast.loading("Analyzing plant with Gemini AI...");

    try {
      let result: AnalysisResult | null = null;

      if (overgroundImage) {
        result = await analyzeImage(overgroundImage, "overground");
      }

      if (undergroundImage && !result) {
        result = await analyzeImage(undergroundImage, "underground");
      }

      setAnalysis(result);
      toast.dismiss();
      toast.success("Analysis complete!");
      onAnalysisComplete?.();
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to analyze plant. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const stageColors: Record<string, string> = {
    seedling: "bg-primary/20 text-primary",
    vegetative: "bg-primary/30 text-primary",
    flowering: "bg-accent/20 text-accent",
    fruiting: "bg-terracotta/20 text-terracotta",
    "harvest-ready": "bg-sunlight/20 text-sunlight",
    decline: "bg-destructive/20 text-destructive",
  };

  const stageEmojis: Record<string, string> = {
    seedling: "🌱",
    vegetative: "🌿",
    flowering: "🌸",
    fruiting: "🍎",
    "harvest-ready": "🌾",
    decline: "🍂",
  };

  return (
    <div className="space-y-6">
      {/* Image Upload Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Overground Image */}
        <Card className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Leaf className="w-5 h-5 text-primary" />
            <h3 className="font-serif text-lg font-semibold">Above Ground</h3>
          </div>
          <div
            className={cn(
              "relative aspect-video rounded-xl overflow-hidden bg-muted cursor-pointer transition-all hover:ring-2 hover:ring-primary/50",
              overgroundImage && "ring-2 ring-primary"
            )}
            onClick={() => overgroundInputRef.current?.click()}
          >
            {overgroundImage ? (
              <img src={overgroundImage} alt="Above ground" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                <Upload className="w-10 h-10 text-muted-foreground/50" />
                <span className="text-sm text-muted-foreground">Click to upload</span>
              </div>
            )}
          </div>
          <input
            ref={overgroundInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleImageUpload(e, "overground")}
          />
        </Card>

        {/* Underground Image */}
        <Card className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Microscope className="w-5 h-5 text-soil" />
            <h3 className="font-serif text-lg font-semibold">Below Ground (Roots)</h3>
          </div>
          <div
            className={cn(
              "relative aspect-video rounded-xl overflow-hidden bg-soil/10 cursor-pointer transition-all hover:ring-2 hover:ring-soil/50",
              undergroundImage && "ring-2 ring-soil"
            )}
            onClick={() => undergroundInputRef.current?.click()}
          >
            {undergroundImage ? (
              <img src={undergroundImage} alt="Below ground" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                <Camera className="w-10 h-10 text-muted-foreground/50" />
                <span className="text-sm text-muted-foreground">Click to upload root image</span>
              </div>
            )}
          </div>
          <input
            ref={undergroundInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleImageUpload(e, "underground")}
          />
        </Card>
      </div>

      {/* Sensor Data */}
      <Card className="glass-card p-6">
        <h3 className="font-serif text-lg font-semibold mb-4">Live Sensor Data</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="flex flex-col items-center p-3 rounded-xl bg-terracotta/10">
            <Thermometer className="w-5 h-5 text-terracotta mb-1" />
            <span className="text-lg font-semibold">{sensorData.temperature}°C</span>
            <span className="text-xs text-muted-foreground">Temp</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-xl bg-water/10">
            <Droplets className="w-5 h-5 text-water mb-1" />
            <span className="text-lg font-semibold">{sensorData.moisture}%</span>
            <span className="text-xs text-muted-foreground">Moisture</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-xl bg-sunlight/10">
            <Sun className="w-5 h-5 text-sunlight mb-1" />
            <span className="text-lg font-semibold">{sensorData.sunlight}%</span>
            <span className="text-xs text-muted-foreground">Light</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-xl bg-primary/10">
            <span className="text-xs font-medium text-primary mb-1">N</span>
            <span className="text-lg font-semibold">{sensorData.nitrogen}</span>
            <span className="text-xs text-muted-foreground">Nitrogen</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-xl bg-accent/10">
            <span className="text-xs font-medium text-accent mb-1">P</span>
            <span className="text-lg font-semibold">{sensorData.phosphorus}</span>
            <span className="text-xs text-muted-foreground">Phosphorus</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-xl bg-terracotta/10">
            <span className="text-xs font-medium text-terracotta mb-1">K</span>
            <span className="text-lg font-semibold">{sensorData.potassium}</span>
            <span className="text-xs text-muted-foreground">Potassium</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-xl bg-soil/10">
            <span className="text-xs font-medium text-soil mb-1">pH</span>
            <span className="text-lg font-semibold">{sensorData.ph}</span>
            <span className="text-xs text-muted-foreground">Soil pH</span>
          </div>
        </div>
      </Card>

      {/* Analyze Button */}
      <Button
        onClick={handleAnalyze}
        disabled={isAnalyzing || (!overgroundImage && !undergroundImage)}
        className="w-full h-14 text-lg font-semibold"
        variant="earth"
      >
        {isAnalyzing ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
            Analyzing with Gemini AI...
          </>
        ) : (
          <>
            <TrendingUp className="w-5 h-5 mr-2" />
            Analyze Plant Health
          </>
        )}
      </Button>

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-6 animate-fade-in">
          {/* Health Score & Stage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="glass-card p-6">
              <h3 className="font-serif text-lg font-semibold mb-4">Health Score</h3>
              <div className="flex items-center gap-4">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-muted"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${(analysis.health_score / 100) * 251.2} 251.2`}
                      className={cn(
                        analysis.health_score >= 70 ? "text-primary" :
                        analysis.health_score >= 40 ? "text-sunlight" : "text-destructive"
                      )}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold">{analysis.health_score}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Overall plant health</p>
                  <p className={cn(
                    "font-semibold",
                    analysis.health_score >= 70 ? "text-primary" :
                    analysis.health_score >= 40 ? "text-sunlight" : "text-destructive"
                  )}>
                    {analysis.health_score >= 70 ? "Healthy" :
                     analysis.health_score >= 40 ? "Needs Attention" : "Critical"}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="glass-card p-6">
              <h3 className="font-serif text-lg font-semibold mb-4">Growth Stage</h3>
              <div className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-full text-lg font-medium",
                stageColors[analysis.growth_stage] || "bg-muted"
              )}>
                <span className="text-2xl">{stageEmojis[analysis.growth_stage] || "🌱"}</span>
                <span className="capitalize">{analysis.growth_stage}</span>
              </div>
              <div className="mt-4 flex gap-1">
                {["seedling", "vegetative", "flowering", "fruiting", "harvest-ready"].map((stage, i) => (
                  <div
                    key={stage}
                    className={cn(
                      "h-2 flex-1 rounded-full",
                      analysis.growth_stage === stage ? "bg-primary" :
                      ["seedling", "vegetative", "flowering", "fruiting", "harvest-ready"].indexOf(analysis.growth_stage) > i
                        ? "bg-primary/50" : "bg-muted"
                    )}
                  />
                ))}
              </div>
            </Card>
          </div>

          {/* Detailed Analysis */}
          <Card className="glass-card p-6">
            <h3 className="font-serif text-lg font-semibold mb-4">Detailed Analysis</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-muted/50">
                <p className="text-sm text-muted-foreground">Leaf Count</p>
                <p className="text-2xl font-bold">{analysis.leaf_count ?? "N/A"}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50">
                <p className="text-sm text-muted-foreground">Dominant Color</p>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="w-6 h-6 rounded-full border border-border"
                    style={{ backgroundColor: analysis.average_color }}
                  />
                  <span className="text-sm font-mono">{analysis.average_color}</span>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-muted/50">
                <p className="text-sm text-muted-foreground">Plant Angle</p>
                <p className="text-2xl font-bold">{analysis.plant_angle}°</p>
              </div>
              <div className={cn(
                "p-4 rounded-xl",
                analysis.has_infection ? "bg-destructive/10" : "bg-primary/10"
              )}>
                <p className="text-sm text-muted-foreground">Infection Status</p>
                <div className="flex items-center gap-2 mt-1">
                  {analysis.has_infection ? (
                    <>
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      <span className="font-semibold text-destructive">Detected</span>
                    </>
                  ) : (
                    <>
                      <Leaf className="w-5 h-5 text-primary" />
                      <span className="font-semibold text-primary">Healthy</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {analysis.infection_details && (
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-semibold text-destructive">Infection Details</p>
                    <p className="text-sm mt-1">{analysis.infection_details}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 rounded-xl bg-muted/50">
              <p className="text-sm text-muted-foreground mb-2">Observations</p>
              <p className="text-foreground">{analysis.observations}</p>
            </div>
          </Card>

          {/* Recommendations */}
          {analysis.recommendations && analysis.recommendations.length > 0 && (
            <Card className="glass-card p-6">
              <h3 className="font-serif text-lg font-semibold mb-4">Care Recommendations</h3>
              <div className="space-y-3">
                {analysis.recommendations.map((rec, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-xl bg-primary/5">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
                      {index + 1}
                    </div>
                    <p className="text-foreground flex-1">{rec}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default SinglePlantView;
