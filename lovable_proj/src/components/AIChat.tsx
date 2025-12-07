import { useState, useRef, useEffect } from "react";
import { Send, Leaf, Sparkles, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface PlantContext {
  sensorData?: {
    temperature: number;
    moisture: number;
    sunlight: number;
    nitrogen: number;
    phosphorus: number;
    potassium: number;
    ph: number;
  };
  analysis?: {
    leaf_count: number | null;
    average_color: string;
    has_infection: boolean;
    infection_details: string | null;
    plant_angle: number;
    growth_stage: string;
    health_score: number;
    observations: string;
    recommendations: string[];
  };
  weather?: {
    location: string;
    temperature: number;
    condition: string;
    humidity: number;
  };
  sunlight?: {
    currentHours: number;
    targetHours: number;
    sunrise: string;
    sunset: string;
  };
  latestAnalyses?: any[];
}

interface AIChatProps {
  onSendMessage?: (message: string, history: Message[], context: PlantContext) => Promise<string>;
  isLoading?: boolean;
  plantContext?: PlantContext;
}

const AIChat = ({ onSendMessage, isLoading: externalLoading, plantContext }: AIChatProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm GrowWise, your AI gardening assistant. I can see your basil plant's sensor data and analysis results in real-time. Ask me anything about your plant's health, care tips, or growing conditions!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      if (onSendMessage) {
        const response = await onSendMessage(userMessage, messages, plantContext || {});
        setMessages((prev) => [...prev, { role: "assistant", content: response }]);
      } else {
        // Demo response when no API is connected
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "To get AI-powered responses, please connect to Lovable Cloud. I can then help you with plant identification, care tips, disease diagnosis, and more!",
          },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-card flex flex-col h-[500px] animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/50">
        <div className="w-10 h-10 rounded-full gradient-earth flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h3 className="font-serif font-semibold text-foreground">Garden AI</h3>
          <p className="text-xs text-muted-foreground">Powered by Gemini</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              "flex gap-3 animate-slide-in",
              message.role === "user" ? "flex-row-reverse" : ""
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                message.role === "user"
                  ? "bg-secondary"
                  : "gradient-earth"
              )}
            >
              {message.role === "user" ? (
                <User className="w-4 h-4 text-secondary-foreground" />
              ) : (
                <Leaf className="w-4 h-4 text-primary-foreground" />
              )}
            </div>
            <div
              className={cn(
                "max-w-[80%] p-3 rounded-2xl text-sm",
                message.role === "user"
                  ? "bg-secondary text-secondary-foreground rounded-tr-sm"
                  : "bg-muted text-foreground rounded-tl-sm"
              )}
            >
              {message.content}
            </div>
          </div>
        ))}
        {(isLoading || externalLoading) && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full gradient-earth flex items-center justify-center">
              <Leaf className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="bg-muted p-3 rounded-2xl rounded-tl-sm">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your plants..."
            className="flex-1 bg-muted/50 border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            disabled={isLoading || externalLoading}
          />
          <Button
            type="submit"
            variant="earth"
            size="icon"
            disabled={!input.trim() || isLoading || externalLoading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AIChat;
