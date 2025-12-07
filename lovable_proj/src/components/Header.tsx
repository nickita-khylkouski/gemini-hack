import { Sprout, Bell, Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onAddPlant?: () => void;
  onSearch?: () => void;
}

const Header = ({ onAddPlant, onSearch }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-50 glass-card rounded-none border-x-0 border-t-0 py-4 px-6 mb-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-earth flex items-center justify-center">
            <Sprout className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-bold text-foreground">
              GrowWise
            </h1>
            <p className="text-xs text-muted-foreground">AI Garden Monitor</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            variant="glass"
            size="icon"
            onClick={onSearch}
            className="hidden sm:flex"
          >
            <Search className="w-5 h-5" />
          </Button>
          <Button variant="glass" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-secondary rounded-full border-2 border-card" />
          </Button>
          <Button variant="earth" onClick={onAddPlant} className="hidden sm:flex">
            <Plus className="w-4 h-4 mr-2" />
            Add Plant
          </Button>
          <Button variant="earth" size="icon" onClick={onAddPlant} className="sm:hidden">
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
