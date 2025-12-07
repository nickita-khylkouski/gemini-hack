import { useState } from "react";
import { Smile, Meh, Frown, Send, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FeedbackFormProps {
  plantName: string;
  onSubmit?: (feedback: { rating: number; notes: string }) => void;
}

const FeedbackForm = ({ plantName, onSubmit }: FeedbackFormProps) => {
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const ratings = [
    { value: 1, icon: Frown, label: "Struggling", color: "text-destructive" },
    { value: 2, icon: Meh, label: "Okay", color: "text-sunlight" },
    { value: 3, icon: Smile, label: "Thriving", color: "text-primary" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === null) {
      toast.error("Please select a health rating");
      return;
    }

    onSubmit?.({ rating, notes });
    toast.success("Feedback recorded!");
    setRating(null);
    setNotes("");
  };

  return (
    <div className="glass-card p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center">
          <Leaf className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-serif text-lg font-semibold text-foreground">
            Plant Check-in
          </h3>
          <p className="text-sm text-muted-foreground">
            How is {plantName} doing today?
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Rating Selection */}
        <div className="flex justify-center gap-4">
          {ratings.map(({ value, icon: Icon, label, color }) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className={cn(
                "flex flex-col items-center p-4 rounded-2xl transition-all duration-300",
                rating === value
                  ? "bg-primary/10 scale-105 shadow-lg"
                  : "bg-muted/50 hover:bg-muted"
              )}
            >
              <Icon
                className={cn(
                  "w-10 h-10 transition-colors",
                  rating === value ? color : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-sm mt-2 font-medium",
                  rating === value ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* Notes */}
        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-foreground mb-2"
          >
            Additional notes (optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any observations about leaves, growth, pests..."
            rows={3}
            className="w-full bg-muted/50 border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
          />
        </div>

        <Button type="submit" variant="earth" className="w-full">
          <Send className="w-4 h-4 mr-2" />
          Submit Feedback
        </Button>
      </form>
    </div>
  );
};

export default FeedbackForm;
