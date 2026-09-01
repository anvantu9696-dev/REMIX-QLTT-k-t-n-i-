
import React, { useState } from 'react';
import { TasksPage } from './TasksPage';
import { ChecklistsPage } from './ChecklistsPage';
import { Briefcase, CheckSquare } from 'lucide-react';

export const TasksAndInspectionsWrapper = () => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'inspections'>('tasks');

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 pt-3 flex space-x-6 shrink-0">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'tasks' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Luồng Công Việc</span>
        </button>
        <button
          onClick={() => setActiveTab('inspections')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'inspections' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Mẫu & Lịch Kiểm Tra</span>
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {activeTab === 'tasks' && <TasksPage />}
        {activeTab === 'inspections' && <ChecklistsPage />}
      </div>
    </div>
  );
};

