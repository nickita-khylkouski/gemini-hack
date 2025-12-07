import { Camera, Sun, Droplets, ThermometerSun } from "lucide-react";
import { cn } from "@/lib/utils";

type PlantStage = "seedling" | "vegetative" | "budding" | "flowering" | "blooming" | "fruiting" | "dormant";

interface PlantCardProps {
  name: string;
  species: string;
  overgroundImage?: string;
  undergroundImage?: string;
  sunlight: number;
  moisture: number;
  temperature: number;
  lastUpdated: string;
  health: "healthy" | "attention" | "critical";
  stage: PlantStage;
}

const stageConfig: Record<PlantStage, { icon: string; color: string }> = {
  seedling: { icon: "🌱", color: "bg-primary/20 text-primary" },
  vegetative: { icon: "🌿", color: "bg-primary/20 text-primary" },
  budding: { icon: "🌷", color: "bg-sunlight/20 text-terracotta" },
  flowering: { icon: "🌸", color: "bg-accent/20 text-accent" },
  blooming: { icon: "🌺", color: "bg-accent/20 text-accent" },
  fruiting: { icon: "🍎", color: "bg-terracotta/20 text-terracotta" },
  dormant: { icon: "🍂", color: "bg-soil/20 text-soil" },
};

const PlantCard = ({
  name,
  species,
  overgroundImage,
  undergroundImage,
  sunlight,
  moisture,
  temperature,
  lastUpdated,
  health,
  stage,
}: PlantCardProps) => {
  const healthColors = {
    healthy: "bg-primary/20 text-primary border-primary/30",
    attention: "bg-sunlight/20 text-terracotta border-sunlight/30",
    critical: "bg-destructive/20 text-destructive border-destructive/30",
  };

  return (
    <div className="glass-card p-5 animate-fade-in group hover:shadow-lg transition-all duration-300">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-serif text-xl font-semibold text-foreground">{name}</h3>
          <p className="text-sm text-muted-foreground">{species}</p>
        </div>
        <span
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium border capitalize",
            healthColors[health]
          )}
        >
          {health}
        </span>
      </div>

      {/* Plant Stage */}
      <div className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-4",
        stageConfig[stage].color
      )}>
        <span>{stageConfig[stage].icon}</span>
        <span className="capitalize">{stage}</span>
      </div>

      {/* Image Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
          {overgroundImage ? (
            <img
              src={overgroundImage}
              alt="Above ground"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Camera className="w-8 h-8 text-muted-foreground/50" />
            </div>
          )}
          <span className="absolute bottom-2 left-2 text-xs bg-card/80 backdrop-blur-sm px-2 py-1 rounded-lg text-foreground">
            Above
          </span>
        </div>
        <div className="relative aspect-square rounded-xl overflow-hidden bg-soil/20">
          {undergroundImage ? (
            <img
              src={undergroundImage}
              alt="Below ground"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Camera className="w-8 h-8 text-muted-foreground/50" />
            </div>
          )}
          <span className="absolute bottom-2 left-2 text-xs bg-card/80 backdrop-blur-sm px-2 py-1 rounded-lg text-foreground">
            Roots
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center p-3 rounded-xl bg-sunlight/10">
          <Sun className="w-5 h-5 text-sunlight mb-1" />
          <span className="text-lg font-semibold text-foreground">{sunlight}%</span>
          <span className="text-xs text-muted-foreground">Light</span>
        </div>
        <div className="flex flex-col items-center p-3 rounded-xl bg-water/10">
          <Droplets className="w-5 h-5 text-water mb-1" />
          <span className="text-lg font-semibold text-foreground">{moisture}%</span>
          <span className="text-xs text-muted-foreground">Moisture</span>
        </div>
        <div className="flex flex-col items-center p-3 rounded-xl bg-terracotta/10">
          <ThermometerSun className="w-5 h-5 text-terracotta mb-1" />
          <span className="text-lg font-semibold text-foreground">{temperature}°C</span>
          <span className="text-xs text-muted-foreground">Temp</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-4 text-center">
        Last updated: {lastUpdated}
      </p>
    </div>
  );
};

export default PlantCard;
