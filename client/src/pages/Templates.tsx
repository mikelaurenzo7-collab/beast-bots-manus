import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import NavBar from "../components/NavBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Star, Users, Clock, Copy } from "lucide-react";
import { toast } from "sonner";
import { WORKFLOW_TEMPLATES } from "../../../shared/templates";

export default function Templates() {
  const { isAuthenticated, loading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = ["productivity", "marketing", "development", "sales", "support"];

  const filteredTemplates = WORKFLOW_TEMPLATES.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleUseTemplate = (templateId: string) => {
    toast.success("Template loaded in Composer! (Coming soon)");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!isAuthenticated) return <div className="min-h-screen flex items-center justify-center">Please sign in</div>;

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="container py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-display font-bold mb-3">Workflow Templates</h1>
          <p className="text-lg text-muted-foreground">
            Pre-configured automation workflows to get started instantly
          </p>
        </div>

        {/* Search & Filter */}
        <div className="mb-8 space-y-4">
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              onClick={() => setSelectedCategory(null)}
              size="sm"
            >
              All
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                onClick={() => setSelectedCategory(cat)}
                size="sm"
                className="capitalize"
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="p-6 hover:shadow-pop transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="text-3xl">{template.icon}</div>
                <Badge className="capitalize">{template.difficulty}</Badge>
              </div>

              <h3 className="text-lg font-semibold mb-2">{template.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{template.description}</p>

              {/* Workflow Diagram */}
              <div className="mb-4 p-3 bg-secondary rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-2">Workflow</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {template.agents.map((agent, idx) => (
                    <div key={agent} className="flex items-center gap-1">
                      <div className="px-2 py-1 bg-background rounded text-xs font-medium truncate">
                        {agent.replace("-beast", "")}
                      </div>
                      {idx < template.agents.length - 1 && (
                        <div className="text-xs text-muted-foreground">→</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mb-4">
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  <span>{template.rating}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>{template.uses > 999 ? (template.uses / 1000).toFixed(1) + 'k' : template.uses}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{template.estimatedTime}</span>
                </div>
              </div>

              <Button onClick={() => handleUseTemplate(template.id)} className="w-full">
                <Copy className="w-4 h-4 mr-2" />
                Use Template
              </Button>
            </Card>
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No templates found matching your search</p>
          </div>
        )}
      </div>
    </div>
  );
}
