import { Clock, Droplets, Scissors, Bug, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Reminder {
  id: string;
  type: "water" | "prune" | "pest" | "fertilize";
  plantName: string;
  dueIn: string;
  priority: "low" | "medium" | "high";
}

interface ReminderCardProps {
  reminders: Reminder[];
}

const ReminderCard = ({ reminders }: ReminderCardProps) => {
  const getIcon = (type: string) => {
    const icons = {
      water: <Droplets className="w-4 h-4 text-water" />,
      prune: <Scissors className="w-4 h-4 text-sage-dark" />,
      pest: <Bug className="w-4 h-4 text-terracotta" />,
      fertilize: <RefreshCw className="w-4 h-4 text-primary" />,
    };
    return icons[type as keyof typeof icons];
  };

  const priorityColors = {
    low: "border-l-sage",
    medium: "border-l-sunlight",
    high: "border-l-destructive",
  };

  return (
    <div className="glass-card p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-lg font-semibold text-foreground">
          Upcoming Tasks
        </h3>
        <Clock className="w-5 h-5 text-muted-foreground" />
      </div>

      <div className="space-y-3">
        {reminders.map((reminder, index) => (
          <div
            key={reminder.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl bg-muted/50 border-l-4 hover:bg-muted transition-colors animate-slide-in",
              priorityColors[reminder.priority]
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center">
              {getIcon(reminder.type)}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground capitalize">
                {reminder.type} {reminder.plantName}
              </p>
              <p className="text-xs text-muted-foreground">{reminder.dueIn}</p>
            </div>
          </div>
        ))}
      </div>

      {reminders.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No upcoming tasks
        </p>
      )}
    </div>
  );
};

export default ReminderCard;
