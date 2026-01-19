// Database Builder Service - Visual schema design and SQL generation

export interface Column {
  id: string;
  name: string;
  type: ColumnType;
  isPrimaryKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
  defaultValue?: string;
  references?: {
    table: string;
    column: string;
  };
}

export type ColumnType =
  | 'uuid'
  | 'serial'
  | 'text'
  | 'varchar'
  | 'integer'
  | 'bigint'
  | 'decimal'
  | 'boolean'
  | 'timestamp'
  | 'timestamptz'
  | 'date'
  | 'time'
  | 'json'
  | 'jsonb'
  | 'array'
  | 'enum';

export interface Table {
  id: string;
  name: string;
  columns: Column[];
  position: { x: number; y: number };
}

export interface Relationship {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

export interface DatabaseSchema {
  id: string;
  name: string;
  tables: Table[];
  relationships: Relationship[];
  createdAt: Date;
  updatedAt: Date;
}

export const COLUMN_TYPES: { value: ColumnType; label: string; description: string }[] = [
  { value: 'uuid', label: 'UUID', description: 'Universally unique identifier' },
  { value: 'serial', label: 'Serial', description: 'Auto-incrementing integer' },
  { value: 'text', label: 'Text', description: 'Variable-length string' },
  { value: 'varchar', label: 'Varchar', description: 'Variable-length string with limit' },
  { value: 'integer', label: 'Integer', description: '32-bit integer' },
  { value: 'bigint', label: 'BigInt', description: '64-bit integer' },
  { value: 'decimal', label: 'Decimal', description: 'Exact numeric value' },
  { value: 'boolean', label: 'Boolean', description: 'True/false value' },
  { value: 'timestamp', label: 'Timestamp', description: 'Date and time' },
  { value: 'timestamptz', label: 'Timestamp TZ', description: 'Date and time with timezone' },
  { value: 'date', label: 'Date', description: 'Calendar date' },
  { value: 'time', label: 'Time', description: 'Time of day' },
  { value: 'json', label: 'JSON', description: 'JSON data' },
  { value: 'jsonb', label: 'JSONB', description: 'Binary JSON (faster)' },
];

class DatabaseBuilderService {
  // Generate SQL from schema
  generateSQL(schema: DatabaseSchema): string {
    const lines: string[] = [];

    lines.push(`-- Database Schema: ${schema.name}`);
    lines.push(`-- Generated at ${new Date().toISOString()}`);
    lines.push('');

    // Create tables
    for (const table of schema.tables) {
      lines.push(this.generateTableSQL(table));
      lines.push('');
    }

    // Add foreign keys
    for (const rel of schema.relationships) {
      lines.push(this.generateForeignKeySQL(rel));
    }

    // Add indexes for foreign keys
    lines.push('');
    lines.push('-- Indexes');
    for (const rel of schema.relationships) {
      lines.push(`CREATE INDEX IF NOT EXISTS idx_${rel.sourceTable}_${rel.sourceColumn} ON ${rel.sourceTable}(${rel.sourceColumn});`);
    }

    // Enable RLS
    lines.push('');
    lines.push('-- Row Level Security');
    for (const table of schema.tables) {
      lines.push(`ALTER TABLE ${table.name} ENABLE ROW LEVEL SECURITY;`);
    }

    return lines.join('\n');
  }

  private generateTableSQL(table: Table): string {
    const lines: string[] = [];
    lines.push(`CREATE TABLE IF NOT EXISTS ${table.name} (`);

    const columnDefs: string[] = [];
    const primaryKeys: string[] = [];

    for (const col of table.columns) {
      let def = `  ${col.name} ${this.mapColumnType(col.type)}`;

      if (col.isPrimaryKey) {
        primaryKeys.push(col.name);
        if (col.type === 'uuid') {
          def += ' DEFAULT gen_random_uuid()';
        }
      }

      if (!col.isNullable && !col.isPrimaryKey) {
        def += ' NOT NULL';
      }

      if (col.isUnique && !col.isPrimaryKey) {
        def += ' UNIQUE';
      }

      if (col.defaultValue && !col.isPrimaryKey) {
        def += ` DEFAULT ${col.defaultValue}`;
      }

      columnDefs.push(def);
    }

    // Add primary key constraint
    if (primaryKeys.length > 0) {
      columnDefs.push(`  PRIMARY KEY (${primaryKeys.join(', ')})`);
    }

    // Add created_at and updated_at if not present
    const hasCreatedAt = table.columns.some(c => c.name === 'created_at');
    const hasUpdatedAt = table.columns.some(c => c.name === 'updated_at');

    if (!hasCreatedAt) {
      columnDefs.push('  created_at TIMESTAMPTZ DEFAULT NOW()');
    }
    if (!hasUpdatedAt) {
      columnDefs.push('  updated_at TIMESTAMPTZ DEFAULT NOW()');
    }

    lines.push(columnDefs.join(',\n'));
    lines.push(');');

    return lines.join('\n');
  }

  private mapColumnType(type: ColumnType): string {
    const typeMap: Record<ColumnType, string> = {
      uuid: 'UUID',
      serial: 'SERIAL',
      text: 'TEXT',
      varchar: 'VARCHAR(255)',
      integer: 'INTEGER',
      bigint: 'BIGINT',
      decimal: 'DECIMAL(10,2)',
      boolean: 'BOOLEAN',
      timestamp: 'TIMESTAMP',
      timestamptz: 'TIMESTAMPTZ',
      date: 'DATE',
      time: 'TIME',
      json: 'JSON',
      jsonb: 'JSONB',
      array: 'TEXT[]',
      enum: 'TEXT',
    };
    return typeMap[type] || 'TEXT';
  }

  private generateForeignKeySQL(rel: Relationship): string {
    return `ALTER TABLE ${rel.sourceTable} ADD CONSTRAINT fk_${rel.sourceTable}_${rel.targetTable} FOREIGN KEY (${rel.sourceColumn}) REFERENCES ${rel.targetTable}(${rel.targetColumn}) ON DELETE CASCADE;`;
  }

  // Generate TypeScript types from schema
  generateTypeScript(schema: DatabaseSchema): string {
    const lines: string[] = [];

    lines.push('// Auto-generated TypeScript types from database schema');
    lines.push(`// Schema: ${schema.name}`);
    lines.push('');

    for (const table of schema.tables) {
      lines.push(this.generateTypeScriptInterface(table));
      lines.push('');
    }

    // Generate insert types (without auto-generated fields)
    lines.push('// Insert types (for creating new records)');
    for (const table of schema.tables) {
      lines.push(this.generateInsertType(table));
      lines.push('');
    }

    return lines.join('\n');
  }

  private generateTypeScriptInterface(table: Table): string {
    const pascalName = this.toPascalCase(table.name);
    const lines: string[] = [];

    lines.push(`export interface ${pascalName} {`);

    for (const col of table.columns) {
      const tsType = this.mapToTypeScript(col.type);
      const nullable = col.isNullable ? ' | null' : '';
      lines.push(`  ${col.name}: ${tsType}${nullable};`);
    }

    // Add timestamps
    if (!table.columns.some(c => c.name === 'created_at')) {
      lines.push('  created_at: string;');
    }
    if (!table.columns.some(c => c.name === 'updated_at')) {
      lines.push('  updated_at: string;');
    }

    lines.push('}');

    return lines.join('\n');
  }

  private generateInsertType(table: Table): string {
    const pascalName = this.toPascalCase(table.name);
    const lines: string[] = [];

    lines.push(`export interface ${pascalName}Insert {`);

    for (const col of table.columns) {
      // Skip auto-generated fields
      if (col.isPrimaryKey && (col.type === 'uuid' || col.type === 'serial')) {
        continue;
      }
      if (col.name === 'created_at' || col.name === 'updated_at') {
        continue;
      }

      const tsType = this.mapToTypeScript(col.type);
      const optional = col.isNullable || col.defaultValue ? '?' : '';
      lines.push(`  ${col.name}${optional}: ${tsType};`);
    }

    lines.push('}');

    return lines.join('\n');
  }

  private mapToTypeScript(type: ColumnType): string {
    const typeMap: Record<ColumnType, string> = {
      uuid: 'string',
      serial: 'number',
      text: 'string',
      varchar: 'string',
      integer: 'number',
      bigint: 'number',
      decimal: 'number',
      boolean: 'boolean',
      timestamp: 'string',
      timestamptz: 'string',
      date: 'string',
      time: 'string',
      json: 'Record<string, any>',
      jsonb: 'Record<string, any>',
      array: 'string[]',
      enum: 'string',
    };
    return typeMap[type] || 'unknown';
  }

  private toPascalCase(str: string): string {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  // Generate Supabase client code
  generateSupabaseClient(schema: DatabaseSchema): string {
    const lines: string[] = [];

    lines.push("import { createClient } from '@supabase/supabase-js';");
    lines.push('');
    lines.push('// Auto-generated Supabase client helpers');
    lines.push('');

    for (const table of schema.tables) {
      lines.push(this.generateTableHelpers(table));
      lines.push('');
    }

    return lines.join('\n');
  }

  private generateTableHelpers(table: Table): string {
    const pascalName = this.toPascalCase(table.name);
    const camelName = table.name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

    return `// ${pascalName} helpers
export const ${camelName}Service = {
  async getAll(supabase: ReturnType<typeof createClient>) {
    const { data, error } = await supabase.from('${table.name}').select('*');
    if (error) throw error;
    return data;
  },

  async getById(supabase: ReturnType<typeof createClient>, id: string) {
    const { data, error } = await supabase.from('${table.name}').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  async create(supabase: ReturnType<typeof createClient>, record: ${pascalName}Insert) {
    const { data, error } = await supabase.from('${table.name}').insert(record).select().single();
    if (error) throw error;
    return data;
  },

  async update(supabase: ReturnType<typeof createClient>, id: string, updates: Partial<${pascalName}Insert>) {
    const { data, error } = await supabase.from('${table.name}').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async delete(supabase: ReturnType<typeof createClient>, id: string) {
    const { error } = await supabase.from('${table.name}').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
};`;
  }

  // Create a new empty schema
  createEmptySchema(name: string): DatabaseSchema {
    return {
      id: crypto.randomUUID(),
      name,
      tables: [],
      relationships: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // Create a common starter schema
  createStarterSchema(type: 'blog' | 'ecommerce' | 'saas' | 'social'): DatabaseSchema {
    switch (type) {
      case 'blog':
        return this.createBlogSchema();
      case 'ecommerce':
        return this.createEcommerceSchema();
      case 'saas':
        return this.createSaaSSchema();
      case 'social':
        return this.createSocialSchema();
      default:
        return this.createEmptySchema('New Schema');
    }
  }

  private createBlogSchema(): DatabaseSchema {
    return {
      id: crypto.randomUUID(),
      name: 'Blog Schema',
      tables: [
        {
          id: '1',
          name: 'users',
          columns: [
            { id: '1', name: 'id', type: 'uuid', isPrimaryKey: true, isNullable: false, isUnique: true },
            { id: '2', name: 'email', type: 'text', isPrimaryKey: false, isNullable: false, isUnique: true },
            { id: '3', name: 'name', type: 'text', isPrimaryKey: false, isNullable: true, isUnique: false },
            { id: '4', name: 'avatar_url', type: 'text', isPrimaryKey: false, isNullable: true, isUnique: false },
          ],
          position: { x: 50, y: 50 },
        },
        {
          id: '2',
          name: 'posts',
          columns: [
            { id: '1', name: 'id', type: 'uuid', isPrimaryKey: true, isNullable: false, isUnique: true },
            { id: '2', name: 'title', type: 'text', isPrimaryKey: false, isNullable: false, isUnique: false },
            { id: '3', name: 'content', type: 'text', isPrimaryKey: false, isNullable: false, isUnique: false },
            { id: '4', name: 'slug', type: 'text', isPrimaryKey: false, isNullable: false, isUnique: true },
            { id: '5', name: 'published', type: 'boolean', isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: 'false' },
            { id: '6', name: 'author_id', type: 'uuid', isPrimaryKey: false, isNullable: false, isUnique: false, references: { table: 'users', column: 'id' } },
          ],
          position: { x: 350, y: 50 },
        },
        {
          id: '3',
          name: 'categories',
          columns: [
            { id: '1', name: 'id', type: 'uuid', isPrimaryKey: true, isNullable: false, isUnique: true },
            { id: '2', name: 'name', type: 'text', isPrimaryKey: false, isNullable: false, isUnique: true },
            { id: '3', name: 'slug', type: 'text', isPrimaryKey: false, isNullable: false, isUnique: true },
          ],
          position: { x: 650, y: 50 },
        },
      ],
      relationships: [
        { id: '1', sourceTable: 'posts', sourceColumn: 'author_id', targetTable: 'users', targetColumn: 'id', type: 'many-to-many' },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private createEcommerceSchema(): DatabaseSchema {
    return {
      id: crypto.randomUUID(),
      name: 'E-commerce Schema',
      tables: [
        {
          id: '1',
          name: 'customers',
          columns: [
            { id: '1', name: 'id', type: 'uuid', isPrimaryKey: true, isNullable: false, isUnique: true },
            { id: '2', name: 'email', type: 'text', isPrimaryKey: false, isNullable: false, isUnique: true },
            { id: '3', name: 'name', type: 'text', isPrimaryKey: false, isNullable: false, isUnique: false },
            { id: '4', name: 'stripe_customer_id', type: 'text', isPrimaryKey: false, isNullable: true, isUnique: true },
          ],
          position: { x: 50, y: 50 },
        },
        {
          id: '2',
          name: 'products',
          columns: [
            { id: '1', name: 'id', type: 'uuid', isPrimaryKey: true, isNullable: false, isUnique: true },
            { id: '2', name: 'name', type: 'text', isPrimaryKey: false, isNullable: false, isUnique: false },
            { id: '3', name: 'description', type: 'text', isPrimaryKey: false, isNullable: true, isUnique: false },
            { id: '4', name: 'price', type: 'decimal', isPrimaryKey: false, isNullable: false, isUnique: false },
            { id: '5', name: 'stock', type: 'integer', isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: '0' },
            { id: '6', name: 'image_url', type: 'text', isPrimaryKey: false, isNullable: true, isUnique: false },
          ],
          position: { x: 350, y: 50 },
        },
        {
          id: '3',
          name: 'orders',
          columns: [
            { id: '1', name: 'id', type: 'uuid', isPrimaryKey: true, isNullable: false, isUnique: true },
            { id: '2', name: 'customer_id', type: 'uuid', isPrimaryKey: false, isNullable: false, isUnique: false },
            { id: '3', name: 'status', type: 'text', isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: "'pending'" },
            { id: '4', name: 'total', type: 'decimal', isPrimaryKey: false, isNullable: false, isUnique: false },
          ],
          position: { x: 50, y: 300 },
        },
        {
          id: '4',
          name: 'order_items',
          columns: [
            { id: '1', name: 'id', type: 'uuid', isPrimaryKey: true, isNullable: false, isUnique: true },
            { id: '2', name: 'order_id', type: 'uuid', isPrimaryKey: false, isNullable: false, isUnique: false },
            { id: '3', name: 'product_id', type: 'uuid', isPrimaryKey: false, isNullable: false, isUnique: false },
            { id: '4', name: 'quantity', type: 'integer', isPrimaryKey: false, isNullable: false, isUnique: false },
            { id: '5', name: 'price', type: 'decimal', isPrimaryKey: false, isNullable: false, isUnique: false },
          ],
          position: { x: 350, y: 300 },
        },
      ],
      relationships: [
        { id: '1', sourceTable: 'orders', sourceColumn: 'customer_id', targetTable: 'customers', targetColumn: 'id', type: 'many-to-many' },
        { id: '2', sourceTable: 'order_items', sourceColumn: 'order_id', targetTable: 'orders', targetColumn: 'id', type: 'many-to-many' },
        { id: '3', sourceTable: 'order_items', sourceColumn: 'product_id', targetTable: 'products', targetColumn: 'id', type: 'many-to-many' },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private createSaaSSchema(): DatabaseSchema {
    return {
      id: crypto.randomUUID(),
      name: 'SaaS Schema',
      tables: [
        {
          id: '1',
          name: 'organizations',
          columns: [
            { id: '1', name: 'id', type: 'uuid', isPrimaryKey: true, isNullable: false, isUnique: true },
            { id: '2', name: 'name', type: 'text', isPrimaryKey: false, isNullable: false, isUnique: false },
            { id: '3', name: 'slug', type: 'text', isPrimaryKey: false, isNullable: false, isUnique: true },
            { id: '4', name: 'plan', type: 'text', isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: "'free'" },
          ],
          position: { x: 50, y: 50 },
        },
        {
          id: '2',
          name: 'members',
          columns: [
            { id: '1', name: 'id', type: 'uuid', isPrimaryKey: true, isNullable: false, isUnique: true },
            { id: '2', name: 'org_id', type: 'uuid', isPrimaryKey: false, isNullable: false, isUnique: false },
            { id: '3', name: 'user_id', type: 'uuid', isPrimaryKey: false, isNullable: false, isUnique: false },
            { id: '4', name: 'role', type: 'text', isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: "'member'" },
          ],
          position: { x: 350, y: 50 },
        },
        {
          id: '3',
          name: 'projects',
          columns: [
            { id: '1', name: 'id', type: 'uuid', isPrimaryKey: true, isNullable: false, isUnique: true },
            { id: '2', name: 'org_id', type: 'uuid', isPrimaryKey: false, isNullable: false, isUnique: false },
            { id: '3', name: 'name', type: 'text', isPrimaryKey: false, isNullable: false, isUnique: false },
            { id: '4', name: 'description', type: 'text', isPrimaryKey: false, isNullable: true, isUnique: false },
          ],
          position: { x: 50, y: 300 },
        },
      ],
      relationships: [
        { id: '1', sourceTable: 'members', sourceColumn: 'org_id', targetTable: 'organizations', targetColumn: 'id', type: 'many-to-many' },
        { id: '2', sourceTable: 'projects', sourceColumn: 'org_id', targetTable: 'organizations', targetColumn: 'id', type: 'many-to-many' },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private createSocialSchema(): DatabaseSchema {
    return {
      id: crypto.randomUUID(),
      name: 'Social Schema',
      tables: [
        {
          id: '1',
          name: 'profiles',
          columns: [
            { id: '1', name: 'id', type: 'uuid', isPrimaryKey: true, isNullable: false, isUnique: true },
            { id: '2', name: 'username', type: 'text', isPrimaryKey: false, isNullable: false, isUnique: true },
            { id: '3', name: 'display_name', type: 'text', isPrimaryKey: false, isNullable: true, isUnique: false },
            { id: '4', name: 'bio', type: 'text', isPrimaryKey: false, isNullable: true, isUnique: false },
            { id: '5', name: 'avatar_url', type: 'text', isPrimaryKey: false, isNullable: true, isUnique: false },
          ],
          position: { x: 50, y: 50 },
        },
        {
          id: '2',
          name: 'posts',
          columns: [
            { id: '1', name: 'id', type: 'uuid', isPrimaryKey: true, isNullable: false, isUnique: true },
            { id: '2', name: 'author_id', type: 'uuid', isPrimaryKey: false, isNullable: false, isUnique: false },
            { id: '3', name: 'content', type: 'text', isPrimaryKey: false, isNullable: false, isUnique: false },
            { id: '4', name: 'likes_count', type: 'integer', isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: '0' },
          ],
          position: { x: 350, y: 50 },
        },
        {
          id: '3',
          name: 'follows',
          columns: [
            { id: '1', name: 'id', type: 'uuid', isPrimaryKey: true, isNullable: false, isUnique: true },
            { id: '2', name: 'follower_id', type: 'uuid', isPrimaryKey: false, isNullable: false, isUnique: false },
            { id: '3', name: 'following_id', type: 'uuid', isPrimaryKey: false, isNullable: false, isUnique: false },
          ],
          position: { x: 50, y: 300 },
        },
        {
          id: '4',
          name: 'likes',
          columns: [
            { id: '1', name: 'id', type: 'uuid', isPrimaryKey: true, isNullable: false, isUnique: true },
            { id: '2', name: 'user_id', type: 'uuid', isPrimaryKey: false, isNullable: false, isUnique: false },
            { id: '3', name: 'post_id', type: 'uuid', isPrimaryKey: false, isNullable: false, isUnique: false },
          ],
          position: { x: 350, y: 300 },
        },
      ],
      relationships: [
        { id: '1', sourceTable: 'posts', sourceColumn: 'author_id', targetTable: 'profiles', targetColumn: 'id', type: 'many-to-many' },
        { id: '2', sourceTable: 'follows', sourceColumn: 'follower_id', targetTable: 'profiles', targetColumn: 'id', type: 'many-to-many' },
        { id: '3', sourceTable: 'follows', sourceColumn: 'following_id', targetTable: 'profiles', targetColumn: 'id', type: 'many-to-many' },
        { id: '4', sourceTable: 'likes', sourceColumn: 'user_id', targetTable: 'profiles', targetColumn: 'id', type: 'many-to-many' },
        { id: '5', sourceTable: 'likes', sourceColumn: 'post_id', targetTable: 'posts', targetColumn: 'id', type: 'many-to-many' },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

export const databaseBuilderService = new DatabaseBuilderService();
