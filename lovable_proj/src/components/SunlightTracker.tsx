import { Sun, Sunrise, Sunset } from "lucide-react";

interface SunlightTrackerProps {
  currentHours: number;
  targetHours: number;
  sunrise: string;
  sunset: string;
}

const SunlightTracker = ({
  currentHours,
  targetHours,
  sunrise,
  sunset,
}: SunlightTrackerProps) => {
  const percentage = Math.min((currentHours / targetHours) * 100, 100);

  return (
    <div className="glass-card p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-lg font-semibold text-foreground">
          Daily Sunlight
        </h3>
        <Sun className="w-6 h-6 text-sunlight animate-pulse-soft" />
      </div>

      {/* Progress Ring */}
      <div className="relative w-32 h-32 mx-auto mb-6">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="url(#sunGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${percentage * 2.64} 264`}
            className="transition-all duration-1000 ease-out"
          />
          <defs>
            <linearGradient id="sunGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(45 90% 60%)" />
              <stop offset="100%" stopColor="hsl(25 45% 55%)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-serif font-bold text-foreground">
            {currentHours}h
          </span>
          <span className="text-xs text-muted-foreground">of {targetHours}h</span>
        </div>
      </div>

      {/* Sunrise/Sunset */}
      <div className="flex justify-between">
        <div className="flex items-center gap-2">
          <Sunrise className="w-5 h-5 text-terracotta-light" />
          <div>
            <p className="text-xs text-muted-foreground">Sunrise</p>
            <p className="text-sm font-medium text-foreground">{sunrise}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Sunset className="w-5 h-5 text-terracotta" />
          <div>
            <p className="text-xs text-muted-foreground">Sunset</p>
            <p className="text-sm font-medium text-foreground">{sunset}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SunlightTracker;
