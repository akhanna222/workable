'use client';

import { useState, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Key,
  Link,
  Copy,
  Download,
  Table,
  Database,
  Code,
  Play,
  ChevronDown,
  ChevronRight,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DatabaseSchema,
  Table as TableType,
  Column,
  ColumnType,
  COLUMN_TYPES,
  databaseBuilderService,
} from '@/lib/services/database-builder-service';

interface DatabaseBuilderProps {
  projectId: string;
  onSchemaChange?: (schema: DatabaseSchema) => void;
  onGenerateCode?: (code: string, type: 'sql' | 'typescript' | 'supabase') => void;
}

export function DatabaseBuilder({ projectId, onSchemaChange, onGenerateCode }: DatabaseBuilderProps) {
  const [schema, setSchema] = useState<DatabaseSchema>(() =>
    databaseBuilderService.createEmptySchema('My Database')
  );
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [editingColumn, setEditingColumn] = useState<{ tableId: string; columnId: string } | null>(null);
  const [showCodePreview, setShowCodePreview] = useState(false);
  const [codeType, setCodeType] = useState<'sql' | 'typescript' | 'supabase'>('sql');

  const updateSchema = useCallback((updates: Partial<DatabaseSchema>) => {
    const newSchema = { ...schema, ...updates, updatedAt: new Date() };
    setSchema(newSchema);
    onSchemaChange?.(newSchema);
  }, [schema, onSchemaChange]);

  const addTable = () => {
    const newTable: TableType = {
      id: crypto.randomUUID(),
      name: `table_${schema.tables.length + 1}`,
      columns: [
        {
          id: crypto.randomUUID(),
          name: 'id',
          type: 'uuid',
          isPrimaryKey: true,
          isNullable: false,
          isUnique: true,
        },
      ],
      position: { x: 50 + schema.tables.length * 50, y: 50 + schema.tables.length * 30 },
    };
    updateSchema({ tables: [...schema.tables, newTable] });
    setExpandedTables(prev => new Set([...prev, newTable.id]));
    setSelectedTable(newTable.id);
  };

  const deleteTable = (tableId: string) => {
    updateSchema({
      tables: schema.tables.filter(t => t.id !== tableId),
      relationships: schema.relationships.filter(
        r => r.sourceTable !== tableId && r.targetTable !== tableId
      ),
    });
    if (selectedTable === tableId) {
      setSelectedTable(null);
    }
  };

  const updateTable = (tableId: string, updates: Partial<TableType>) => {
    updateSchema({
      tables: schema.tables.map(t =>
        t.id === tableId ? { ...t, ...updates } : t
      ),
    });
  };

  const addColumn = (tableId: string) => {
    const table = schema.tables.find(t => t.id === tableId);
    if (!table) return;

    const newColumn: Column = {
      id: crypto.randomUUID(),
      name: `column_${table.columns.length + 1}`,
      type: 'text',
      isPrimaryKey: false,
      isNullable: true,
      isUnique: false,
    };

    updateTable(tableId, {
      columns: [...table.columns, newColumn],
    });
    setEditingColumn({ tableId, columnId: newColumn.id });
  };

  const updateColumn = (tableId: string, columnId: string, updates: Partial<Column>) => {
    const table = schema.tables.find(t => t.id === tableId);
    if (!table) return;

    updateTable(tableId, {
      columns: table.columns.map(c =>
        c.id === columnId ? { ...c, ...updates } : c
      ),
    });
  };

  const deleteColumn = (tableId: string, columnId: string) => {
    const table = schema.tables.find(t => t.id === tableId);
    if (!table) return;

    updateTable(tableId, {
      columns: table.columns.filter(c => c.id !== columnId),
    });
  };

  const loadTemplate = (type: 'blog' | 'ecommerce' | 'saas' | 'social') => {
    const newSchema = databaseBuilderService.createStarterSchema(type);
    setSchema(newSchema);
    onSchemaChange?.(newSchema);
    setExpandedTables(new Set(newSchema.tables.map(t => t.id)));
  };

  const generateCode = () => {
    let code = '';
    switch (codeType) {
      case 'sql':
        code = databaseBuilderService.generateSQL(schema);
        break;
      case 'typescript':
        code = databaseBuilderService.generateTypeScript(schema);
        break;
      case 'supabase':
        code = databaseBuilderService.generateSupabaseClient(schema);
        break;
    }
    onGenerateCode?.(code, codeType);
    return code;
  };

  const toggleTableExpand = (tableId: string) => {
    setExpandedTables(prev => {
      const next = new Set(prev);
      if (next.has(tableId)) {
        next.delete(tableId);
      } else {
        next.add(tableId);
      }
      return next;
    });
  };

  const copyToClipboard = async () => {
    const code = generateCode();
    await navigator.clipboard.writeText(code);
  };

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Toolbar */}
      <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-400" />
          <span className="font-medium text-white">Database Builder</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Templates */}
          <div className="relative group">
            <button className="px-3 py-1.5 text-sm text-gray-400 hover:text-white flex items-center gap-1">
              Templates
              <ChevronDown className="w-3 h-3" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 rounded-lg border border-gray-700 shadow-xl hidden group-hover:block z-10">
              {['blog', 'ecommerce', 'saas', 'social'].map(template => (
                <button
                  key={template}
                  onClick={() => loadTemplate(template as any)}
                  className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg"
                >
                  {template.charAt(0).toUpperCase() + template.slice(1)} Schema
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={addTable}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Table
          </button>

          <button
            onClick={() => setShowCodePreview(!showCodePreview)}
            className={cn(
              'px-3 py-1.5 text-sm rounded flex items-center gap-1',
              showCodePreview
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            )}
          >
            <Code className="w-4 h-4" />
            {showCodePreview ? 'Hide Code' : 'Show Code'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Table List */}
        <div className="w-80 bg-gray-900 border-r border-gray-800 overflow-y-auto">
          <div className="p-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Tables ({schema.tables.length})</h3>

            {schema.tables.length === 0 ? (
              <div className="text-center py-8">
                <Table className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No tables yet</p>
                <p className="text-gray-600 text-xs mt-1">Add a table or load a template</p>
              </div>
            ) : (
              <div className="space-y-2">
                {schema.tables.map(table => (
                  <div
                    key={table.id}
                    className={cn(
                      'rounded-lg border transition-colors',
                      selectedTable === table.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-800 bg-gray-800/50 hover:border-gray-700'
                    )}
                  >
                    {/* Table Header */}
                    <div
                      className="flex items-center gap-2 p-3 cursor-pointer"
                      onClick={() => {
                        setSelectedTable(table.id);
                        toggleTableExpand(table.id);
                      }}
                    >
                      <button className="text-gray-500">
                        {expandedTables.has(table.id) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      <Table className="w-4 h-4 text-blue-400" />
                      <input
                        type="text"
                        value={table.name}
                        onChange={e => updateTable(table.id, { name: e.target.value })}
                        className="flex-1 bg-transparent text-white text-sm font-medium focus:outline-none"
                        onClick={e => e.stopPropagation()}
                      />
                      <span className="text-xs text-gray-500">{table.columns.length} cols</span>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          deleteTable(table.id);
                        }}
                        className="p-1 text-gray-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Columns */}
                    {expandedTables.has(table.id) && (
                      <div className="border-t border-gray-800 px-3 py-2">
                        {table.columns.map(column => (
                          <ColumnRow
                            key={column.id}
                            column={column}
                            isEditing={editingColumn?.tableId === table.id && editingColumn.columnId === column.id}
                            onEdit={() => setEditingColumn({ tableId: table.id, columnId: column.id })}
                            onSave={() => setEditingColumn(null)}
                            onChange={updates => updateColumn(table.id, column.id, updates)}
                            onDelete={() => deleteColumn(table.id, column.id)}
                          />
                        ))}
                        <button
                          onClick={() => addColumn(table.id)}
                          className="w-full mt-2 py-1.5 text-xs text-gray-500 hover:text-blue-400 flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Add Column
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Code Preview / Visual Canvas */}
        <div className="flex-1 overflow-auto">
          {showCodePreview ? (
            <div className="h-full flex flex-col">
              {/* Code Type Tabs */}
              <div className="flex items-center gap-1 p-2 bg-gray-900 border-b border-gray-800">
                {(['sql', 'typescript', 'supabase'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setCodeType(type)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded transition-colors',
                      codeType === type
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    )}
                  >
                    {type === 'sql' ? 'SQL' : type === 'typescript' ? 'TypeScript' : 'Supabase'}
                  </button>
                ))}
                <div className="flex-1" />
                <button
                  onClick={copyToClipboard}
                  className="px-3 py-1.5 text-sm text-gray-400 hover:text-white flex items-center gap-1"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
                <button
                  onClick={() => onGenerateCode?.(generateCode(), codeType)}
                  className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-1"
                >
                  <Play className="w-4 h-4" />
                  Use Code
                </button>
              </div>

              {/* Code Display */}
              <pre className="flex-1 p-4 overflow-auto text-sm text-gray-300 font-mono bg-gray-950">
                {generateCode()}
              </pre>
            </div>
          ) : (
            <div className="h-full p-4">
              {/* Visual representation coming soon */}
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Database className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Visual Schema Designer</p>
                  <p className="text-sm mt-2">
                    Use the table list on the left to design your schema,
                    <br />
                    then click "Show Code" to generate SQL
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Column Row Component
function ColumnRow({
  column,
  isEditing,
  onEdit,
  onSave,
  onChange,
  onDelete,
}: {
  column: Column;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onChange: (updates: Partial<Column>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 text-sm group">
      {/* Primary Key Indicator */}
      {column.isPrimaryKey && (
        <Key className="w-3 h-3 text-yellow-500" />
      )}
      {column.references && (
        <Link className="w-3 h-3 text-blue-400" />
      )}
      {!column.isPrimaryKey && !column.references && (
        <div className="w-3" />
      )}

      {/* Column Name */}
      {isEditing ? (
        <input
          type="text"
          value={column.name}
          onChange={e => onChange({ name: e.target.value })}
          className="flex-1 bg-gray-800 px-2 py-0.5 rounded text-white text-xs"
          autoFocus
        />
      ) : (
        <span className="flex-1 text-gray-300 text-xs">{column.name}</span>
      )}

      {/* Column Type */}
      {isEditing ? (
        <select
          value={column.type}
          onChange={e => onChange({ type: e.target.value as ColumnType })}
          className="bg-gray-800 px-2 py-0.5 rounded text-gray-400 text-xs"
        >
          {COLUMN_TYPES.map(type => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-gray-500 text-xs">{column.type}</span>
      )}

      {/* Nullable */}
      {isEditing && (
        <label className="flex items-center gap-1 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={column.isNullable}
            onChange={e => onChange({ isNullable: e.target.checked })}
            className="w-3 h-3"
          />
          null
        </label>
      )}

      {/* Actions */}
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
        {isEditing ? (
          <button onClick={onSave} className="p-1 text-green-400">
            <Check className="w-3 h-3" />
          </button>
        ) : (
          <button onClick={onEdit} className="p-1 text-gray-500 hover:text-white">
            <Edit2 className="w-3 h-3" />
          </button>
        )}
        {!column.isPrimaryKey && (
          <button onClick={onDelete} className="p-1 text-gray-500 hover:text-red-400">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
