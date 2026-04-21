import { useState, useCallback } from "react";
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  MiniMap,
} from "reactflow";
import "reactflow/dist/style.css";
import { useAuth } from "@/_core/hooks/useAuth";
import NavBar from "../components/NavBar";
import { toast } from "sonner";
import { Plus, Save, Play, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BEASTS } from "../../../shared/agents";
type Beast = typeof BEASTS[0];

type WorkflowNode = Node<{
  label: string;
  agentSlug?: string;
  config?: Record<string, unknown>;
}>;

type WorkflowEdge = Edge<{
  mapping?: Record<string, string>;
}>;

export default function WorkflowComposer() {
  const { isAuthenticated, loading } = useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [workflowName, setWorkflowName] = useState("New Workflow");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [nodeIdCounter, setNodeIdCounter] = useState(0);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds: any) => addEdge(connection, eds));
    },
    [setEdges]
  );

  const addAgentNode = (agentSlug: string) => {
    const agent = BEASTS.find((b: Beast) => b.slug === agentSlug);
    if (!agent) return;

    const newNode: WorkflowNode = {
      id: `agent-${nodeIdCounter}`,
      data: {
        label: agent.name,
        agentSlug: agent.slug,
        config: {},
      },
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      type: "default",
    };

    setNodes((nds: WorkflowNode[]) => [...nds, newNode]);
    setNodeIdCounter((c) => c + 1);
    setShowAgentPicker(false);
    toast.success(`Added ${agent.name} to workflow`);
  };

  const removeNode = (nodeId: string) => {
    setNodes((nds: WorkflowNode[]) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds: WorkflowEdge[]) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  };

  const saveWorkflow = async () => {
    if (nodes.length === 0) {
      toast.error("Add at least one agent to your workflow");
      return;
    }
    toast.success("Workflow saved! (Feature coming soon)");
  };

  const executeWorkflow = async () => {
    if (nodes.length === 0) {
      toast.error("Add agents to execute");
      return;
    }
    toast.success("Workflow execution started! (Feature coming soon)");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!isAuthenticated) return <div className="min-h-screen flex items-center justify-center">Please sign in</div>;

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar */}
        <div className="w-80 border-r bg-card p-6 overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-display font-bold mb-2">Workflow Composer</h2>
            <p className="text-sm text-muted-foreground">Chain Beast Bots together to automate complex workflows</p>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="text-sm font-medium">Workflow Name</label>
              <Input
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="My Awesome Workflow"
                className="mt-1"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={saveWorkflow} variant="outline" className="flex-1">
                <Save size={16} className="mr-2" />
                Save
              </Button>
              <Button onClick={executeWorkflow} className="flex-1">
                <Play size={16} className="mr-2" />
                Execute
              </Button>
            </div>
          </div>

          <div className="mb-6">
            <Button onClick={() => setShowAgentPicker(true)} className="w-full">
              <Plus size={16} className="mr-2" />
              Add Agent
            </Button>
          </div>

          {nodes.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Workflow Nodes ({nodes.length})</h3>
              <div className="space-y-2">
                {nodes.map((node: any) => (
                  <div key={node.id} className="flex items-center justify-between p-2 bg-background rounded border">
                    <span className="text-sm truncate">{node.data?.label}</span>
                    <button
                      onClick={() => removeNode(node.id)}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-900">
              <strong>Tip:</strong> Drag agents onto the canvas, then connect them by dragging from output to input ports. Data flows left to right.
            </p>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
      </div>

      {/* Agent Picker Dialog */}
      <Dialog open={showAgentPicker} onOpenChange={setShowAgentPicker}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select an Agent</DialogTitle>
            <DialogDescription>Choose a Beast Bot to add to your workflow</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {BEASTS.map((agent: Beast) => (
              <button
                key={agent.slug}
                onClick={() => addAgentNode(agent.slug)}
                className="p-3 text-left border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="font-semibold text-sm">{agent.name}</div>
                <div className="text-xs text-muted-foreground">{agent.category}</div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
