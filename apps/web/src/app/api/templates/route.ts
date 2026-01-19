// Component Templates API
import { NextRequest, NextResponse } from 'next/server';
import {
  COMPONENT_TEMPLATES,
  getTemplatesByCategory,
  searchTemplates,
  getTemplateCategories,
} from '@/lib/templates/component-templates';

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get('category');
  const search = request.nextUrl.searchParams.get('search');
  const id = request.nextUrl.searchParams.get('id');

  try {
    // Get specific template by ID
    if (id) {
      const template = COMPONENT_TEMPLATES.find(t => t.id === id);
      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      return NextResponse.json({ template });
    }

    // Search templates
    if (search) {
      const templates = searchTemplates(search);
      return NextResponse.json({ templates });
    }

    // Get templates by category
    if (category) {
      const templates = getTemplatesByCategory(category as any);
      return NextResponse.json({ templates });
    }

    // Return all templates and categories
    return NextResponse.json({
      templates: COMPONENT_TEMPLATES,
      categories: getTemplateCategories(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
