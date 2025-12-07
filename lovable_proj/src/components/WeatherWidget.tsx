import { Cloud, CloudRain, Sun, Wind, Droplets } from "lucide-react";

interface WeatherData {
  location: string;
  temperature: number;
  condition: "sunny" | "cloudy" | "rainy" | "windy";
  humidity: number;
  forecast: {
    day: string;
    temp: number;
    condition: "sunny" | "cloudy" | "rainy" | "windy";
  }[];
}

interface WeatherWidgetProps {
  weather: WeatherData;
}

const WeatherWidget = ({ weather }: WeatherWidgetProps) => {
  const getWeatherIcon = (condition: string, size: "sm" | "lg" = "lg") => {
    const sizeClass = size === "lg" ? "w-16 h-16" : "w-6 h-6";
    const icons = {
      sunny: <Sun className={`${sizeClass} text-sunlight`} />,
      cloudy: <Cloud className={`${sizeClass} text-muted-foreground`} />,
      rainy: <CloudRain className={`${sizeClass} text-water`} />,
      windy: <Wind className={`${sizeClass} text-sage-dark`} />,
    };
    return icons[condition as keyof typeof icons] || icons.sunny;
  };

  return (
    <div className="glass-card p-6 animate-fade-in">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="font-serif text-lg font-semibold text-foreground mb-1">
            Weather Forecast
          </h3>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            📍 {weather.location}
          </p>
        </div>
        {getWeatherIcon(weather.condition)}
      </div>

      <div className="flex items-end gap-4 mb-6">
        <span className="text-5xl font-serif font-bold text-foreground">
          {weather.temperature}°
        </span>
        <div className="flex items-center gap-2 text-muted-foreground pb-2">
          <Droplets className="w-4 h-4 text-water" />
          <span className="text-sm">{weather.humidity}% humidity</span>
        </div>
      </div>

      {/* 5-day forecast */}
      <div className="flex gap-2">
        {weather.forecast.map((day, index) => (
          <div
            key={day.day}
            className="flex-1 flex flex-col items-center p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <span className="text-xs text-muted-foreground mb-2">{day.day}</span>
            {getWeatherIcon(day.condition, "sm")}
            <span className="text-sm font-medium text-foreground mt-2">
              {day.temp}°
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeatherWidget;
