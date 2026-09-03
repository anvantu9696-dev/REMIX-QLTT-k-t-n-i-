import React, { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
  MarkerType,
  Background,
  Controls,
  Handle,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Trash2, Building2, Zap, Radio } from 'lucide-react';

const GridNode = ({ data, selected }: any) => {
  const { id, type, name, onAddNode, onRemoveNode, isFirst, isLast } = data;
  
  return (
    <div className={`relative group bg-white border-2 rounded-xl p-4 shadow-sm w-52 flex flex-col items-center justify-center transition-all ${selected ? 'border-blue-500 ring-4 ring-blue-100 shadow-md' : 'border-slate-300'}`}>
      
      {/* Nút Remove */}
      {type !== 'substation' && (
        <button 
          onClick={() => onRemoveNode(id)}
          className="absolute -top-3 -right-3 p-1.5 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-200"
        >
          <Trash2 size={14} />
        </button>
      )}

      {/* Nút (+) Left */}
      {!isFirst && (
        <button
          onClick={() => onAddNode(id, 'left')}
          className="absolute -left-4 top-1/2 -translate-y-1/2 p-1 bg-blue-100 text-blue-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-blue-200 z-10"
        >
          <Plus size={16} />
        </button>
      )}

      {/* Nút (+) Right */}
      {!isLast && (
        <button
          onClick={() => onAddNode(id, 'right')}
          className="absolute -right-4 top-1/2 -translate-y-1/2 p-1 bg-blue-100 text-blue-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-blue-200 z-10"
        >
          <Plus size={16} />
        </button>
      )}

      {/* Content */}
      <div className="text-slate-600 mb-2">
        {type === 'substation' ? <Building2 size={24} /> : type === 'feeder' ? <Zap size={24} /> : <Radio size={24} />}
      </div>
      <div className="font-bold text-slate-800 text-sm text-center break-words w-full">{name}</div>
      <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{type}</div>

      {/* Handles */}
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-slate-400 !border-none" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-slate-400 !border-none" />
    </div>
  );
};

const nodeTypes = {
  gridNode: GridNode
};

type SeqItem = { id: string; type: string; name: string };

function DynamicGraphInner() {
  const [sequence, setSequence] = useState<SeqItem[]>([
    { id: 'sub-A', type: 'substation', name: 'Trạm A' },
    { id: 'sub-B', type: 'substation', name: 'Trạm B' }
  ]);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();

  const handleAddNode = useCallback((targetId: string, side: 'left' | 'right') => {
    setSequence(prev => {
      const idx = prev.findIndex(item => item.id === targetId);
      if (idx === -1) return prev;
      
      const newItem: SeqItem = {
        id: `device-${Date.now()}`,
        type: 'device',
        name: `Thiết bị mới ${Math.floor(Math.random() * 1000)}`
      };
      
      const newSeq = [...prev];
      if (side === 'left') {
        newSeq.splice(idx, 0, newItem);
      } else {
        newSeq.splice(idx + 1, 0, newItem);
      }
      return newSeq;
    });
  }, []);

  const handleRemoveNode = useCallback((targetId: string) => {
    setSequence(prev => prev.filter(item => item.id !== targetId));
  }, []);

  useEffect(() => {
    const newNodes = sequence.map((item, index) => ({
      id: item.id,
      type: 'gridNode',
      position: { x: index * 300, y: 150 },
      data: {
        ...item,
        isFirst: index === 0,
        isLast: index === sequence.length - 1,
        onAddNode: handleAddNode,
        onRemoveNode: handleRemoveNode
      }
    }));
    
    const newEdges = [];
    for (let i = 0; i < sequence.length - 1; i++) {
      newEdges.push({
        id: `edge-${sequence[i].id}-${sequence[i+1].id}`,
        source: sequence[i].id,
        target: sequence[i+1].id,
        animated: true,
        style: { stroke: '#94a3b8', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' }
      });
    }

    setNodes(newNodes as any);
    setEdges(newEdges as any);
    
    setTimeout(() => {
      fitView({ duration: 800, padding: 0.2 });
    }, 50);
  }, [sequence, handleAddNode, handleRemoveNode, setNodes, setEdges, fitView]);

  return (
    <div className="w-full h-[calc(100vh-80px)] bg-slate-50 border border-slate-200 rounded-xl overflow-hidden p-4">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-800">Sơ Đồ Mạch Vòng</h2>
        <p className="text-sm text-slate-500">Thêm thiết bị tuần tự bằng cách nhấn dấu (+) ở 2 phía của node.</p>
      </div>
      <div className="w-full h-[85%] border-2 border-slate-200 rounded-2xl bg-white shadow-inner">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
        >
          <Background gap={24} size={2} color="#cbd5e1" />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

export const DynamicGraphPage = () => {
  return (
    <ReactFlowProvider>
      <DynamicGraphInner />
    </ReactFlowProvider>
  );
}
