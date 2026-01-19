'use client';

import { useState, useEffect } from 'react';
import { Search, Layout, X, Plus, Eye, Code } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  files: { path: string; content: string; language: string }[];
}

interface Category {
  id: string;
  name: string;
  count: number;
}

interface TemplateBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (files: { path: string; content: string; language: string }[]) => void;
}

export function TemplateBrowser({ isOpen, onClose, onSelectTemplate }: TemplateBrowserProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      setTemplates(data.templates || []);
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter((template) => {
    const matchesCategory = !selectedCategory || template.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleUseTemplate = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate.files);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-4xl border border-gray-800 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Layout className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Component Templates</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 border-r border-gray-800 p-3 space-y-1 overflow-auto">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                !selectedCategory
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
            >
              All Templates
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex justify-between',
                  selectedCategory === category.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
              >
                <span>{category.name}</span>
                <span className="opacity-60">{category.count}</span>
              </button>
            ))}
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search */}
            <div className="p-4 border-b border-gray-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Template Grid */}
            <div className="flex-1 overflow-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin w-8 h-8 border-2 border-gray-600 border-t-blue-500 rounded-full" />
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Layout className="w-12 h-12 mb-3 opacity-50" />
                  <p>No templates found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {filteredTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={cn(
                        'text-left p-4 rounded-lg border transition-all',
                        selectedTemplate?.id === template.id
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-medium text-white">{template.name}</h3>
                        <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded">
                          {template.category}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                        {template.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {template.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 text-xs bg-gray-700/50 text-gray-400 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {selectedTemplate && (
              <div className="p-4 border-t border-gray-800 flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{selectedTemplate.name}</p>
                  <p className="text-sm text-gray-400">
                    {selectedTemplate.files.length} file{selectedTemplate.files.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="px-4 py-2 text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUseTemplate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Use Template
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
