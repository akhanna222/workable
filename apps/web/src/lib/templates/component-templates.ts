// Pre-built Component Templates Library
export interface ComponentTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  preview: string; // Preview image URL or base64
  files: {
    path: string;
    content: string;
    language: string;
  }[];
  dependencies?: string[];
  tags: string[];
}

export type TemplateCategory =
  | 'landing'
  | 'dashboard'
  | 'ecommerce'
  | 'blog'
  | 'portfolio'
  | 'saas'
  | 'components'
  | 'forms'
  | 'navigation';

export const COMPONENT_TEMPLATES: ComponentTemplate[] = [
  // Landing Page Templates
  {
    id: 'landing-hero-gradient',
    name: 'Gradient Hero Section',
    category: 'landing',
    description: 'Modern hero section with gradient background and CTA buttons',
    preview: '/templates/hero-gradient.png',
    tags: ['hero', 'landing', 'gradient', 'cta'],
    files: [
      {
        path: 'src/components/Hero.tsx',
        language: 'typescript',
        content: `import { ArrowRight } from 'lucide-react';

export function Hero() {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-20" />
      <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500 rounded-full blur-[128px] opacity-30" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500 rounded-full blur-[128px] opacity-30" />

      <div className="relative max-w-7xl mx-auto px-6 py-24 sm:py-32 lg:py-40">
        <div className="text-center">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white tracking-tight">
            Build Something
            <span className="block bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Amazing Today
            </span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
            Transform your ideas into reality with our powerful platform.
            Start building your next big project in minutes.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="px-8 py-4 bg-white text-gray-900 font-semibold rounded-full hover:bg-gray-100 transition-colors flex items-center gap-2">
              Get Started <ArrowRight className="w-5 h-5" />
            </button>
            <button className="px-8 py-4 border border-white/30 text-white font-semibold rounded-full hover:bg-white/10 transition-colors">
              Learn More
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}`,
      },
    ],
  },

  // Dashboard Templates
  {
    id: 'dashboard-stats-cards',
    name: 'Stats Cards Dashboard',
    category: 'dashboard',
    description: 'Dashboard with stats cards, charts placeholder, and recent activity',
    preview: '/templates/dashboard-stats.png',
    tags: ['dashboard', 'stats', 'cards', 'analytics'],
    files: [
      {
        path: 'src/components/Dashboard.tsx',
        language: 'typescript',
        content: `import { TrendingUp, TrendingDown, Users, DollarSign, ShoppingCart, Activity } from 'lucide-react';

const stats = [
  { name: 'Total Revenue', value: '$45,231', change: '+20.1%', trend: 'up', icon: DollarSign },
  { name: 'Active Users', value: '2,345', change: '+15.2%', trend: 'up', icon: Users },
  { name: 'Total Orders', value: '1,234', change: '-5.4%', trend: 'down', icon: ShoppingCart },
  { name: 'Conversion Rate', value: '3.24%', change: '+2.1%', trend: 'up', icon: Activity },
];

export function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <div key={stat.name} className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <stat.icon className="w-6 h-6 text-blue-600" />
                </div>
                <span className={\`flex items-center text-sm font-medium \${
                  stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }\`}>
                  {stat.trend === 'up' ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                  {stat.change}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
              <p className="text-gray-500 text-sm">{stat.name}</p>
            </div>
          ))}
        </div>

        {/* Chart placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Overview</h2>
            <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
              Chart Placeholder
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">New order #100{i}</p>
                    <p className="text-xs text-gray-500">{i} hour ago</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}`,
      },
    ],
  },

  // E-commerce Templates
  {
    id: 'ecommerce-product-grid',
    name: 'Product Grid',
    category: 'ecommerce',
    description: 'Responsive product grid with hover effects and quick actions',
    preview: '/templates/product-grid.png',
    tags: ['ecommerce', 'products', 'grid', 'shop'],
    files: [
      {
        path: 'src/components/ProductGrid.tsx',
        language: 'typescript',
        content: `import { Heart, ShoppingCart, Star } from 'lucide-react';

const products = [
  { id: 1, name: 'Premium Headphones', price: 299, rating: 4.5, image: 'https://placehold.co/400x400/2563eb/white?text=Product', category: 'Electronics' },
  { id: 2, name: 'Wireless Mouse', price: 79, rating: 4.8, image: 'https://placehold.co/400x400/7c3aed/white?text=Product', category: 'Electronics' },
  { id: 3, name: 'Mechanical Keyboard', price: 149, rating: 4.6, image: 'https://placehold.co/400x400/059669/white?text=Product', category: 'Electronics' },
  { id: 4, name: 'USB-C Hub', price: 49, rating: 4.3, image: 'https://placehold.co/400x400/dc2626/white?text=Product', category: 'Accessories' },
  { id: 5, name: 'Monitor Stand', price: 89, rating: 4.7, image: 'https://placehold.co/400x400/ca8a04/white?text=Product', category: 'Accessories' },
  { id: 6, name: 'Webcam HD', price: 129, rating: 4.4, image: 'https://placehold.co/400x400/0891b2/white?text=Product', category: 'Electronics' },
];

export function ProductGrid() {
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Featured Products</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-2xl overflow-hidden shadow-sm group">
              <div className="relative aspect-square overflow-hidden">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <button className="absolute top-4 right-4 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-100 transition-colors">
                  <Heart className="w-5 h-5 text-gray-600" />
                </button>
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="w-full py-3 bg-white text-gray-900 font-semibold rounded-lg flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors">
                    <ShoppingCart className="w-5 h-5" />
                    Add to Cart
                  </button>
                </div>
              </div>
              <div className="p-4">
                <span className="text-sm text-gray-500">{product.category}</span>
                <h3 className="font-semibold text-gray-900 mt-1">{product.name}</h3>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xl font-bold text-gray-900">\${product.price}</span>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm text-gray-600">{product.rating}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}`,
      },
    ],
  },

  // Navigation Templates
  {
    id: 'nav-modern-header',
    name: 'Modern Header Navigation',
    category: 'navigation',
    description: 'Responsive header with dropdown menus and mobile hamburger',
    preview: '/templates/nav-header.png',
    tags: ['navigation', 'header', 'responsive', 'menu'],
    files: [
      {
        path: 'src/components/Header.tsx',
        language: 'typescript',
        content: `import { useState } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';

const navigation = [
  { name: 'Home', href: '#' },
  {
    name: 'Products',
    href: '#',
    children: [
      { name: 'All Products', href: '#' },
      { name: 'Categories', href: '#' },
      { name: 'New Arrivals', href: '#' },
    ],
  },
  { name: 'About', href: '#' },
  { name: 'Contact', href: '#' },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Brand
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navigation.map((item) => (
              <div key={item.name} className="relative">
                {item.children ? (
                  <button
                    className="flex items-center gap-1 text-gray-600 hover:text-gray-900 font-medium"
                    onMouseEnter={() => setActiveDropdown(item.name)}
                    onMouseLeave={() => setActiveDropdown(null)}
                  >
                    {item.name}
                    <ChevronDown className="w-4 h-4" />
                  </button>
                ) : (
                  <a href={item.href} className="text-gray-600 hover:text-gray-900 font-medium">
                    {item.name}
                  </a>
                )}

                {/* Dropdown */}
                {item.children && activeDropdown === item.name && (
                  <div
                    className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2"
                    onMouseEnter={() => setActiveDropdown(item.name)}
                    onMouseLeave={() => setActiveDropdown(null)}
                  >
                    {item.children.map((child) => (
                      <a
                        key={child.name}
                        href={child.href}
                        className="block px-4 py-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      >
                        {child.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <div className="hidden md:block">
            <button className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
              Get Started
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="block py-2 text-gray-600 hover:text-gray-900"
              >
                {item.name}
              </a>
            ))}
            <button className="w-full mt-4 px-6 py-2 bg-blue-600 text-white font-medium rounded-lg">
              Get Started
            </button>
          </div>
        )}
      </nav>
    </header>
  );
}`,
      },
    ],
  },

  // Form Templates
  {
    id: 'form-contact',
    name: 'Contact Form',
    category: 'forms',
    description: 'Beautiful contact form with validation styling',
    preview: '/templates/contact-form.png',
    tags: ['form', 'contact', 'input', 'validation'],
    files: [
      {
        path: 'src/components/ContactForm.tsx',
        language: 'typescript',
        content: `import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';

export function ContactForm() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setLoading(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Thank you!</h3>
        <p className="text-gray-600">We'll get back to you within 24 hours.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-8">
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Get in Touch</h2>
      <p className="text-gray-600 mb-8">We'd love to hear from you. Send us a message!</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="John"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="Doe"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <input
            type="email"
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            placeholder="john@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
          <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all">
            <option>General Inquiry</option>
            <option>Support</option>
            <option>Sales</option>
            <option>Partnership</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
          <textarea
            required
            rows={5}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
            placeholder="Your message..."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Send Message
            </>
          )}
        </button>
      </form>
    </div>
  );
}`,
      },
    ],
  },

  // SaaS Templates
  {
    id: 'saas-pricing-table',
    name: 'Pricing Table',
    category: 'saas',
    description: 'Modern pricing table with popular plan highlight',
    preview: '/templates/pricing-table.png',
    tags: ['pricing', 'saas', 'plans', 'subscription'],
    files: [
      {
        path: 'src/components/PricingTable.tsx',
        language: 'typescript',
        content: `import { Check } from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    price: 9,
    description: 'Perfect for individuals',
    features: ['5 Projects', '10GB Storage', 'Basic Analytics', 'Email Support'],
    popular: false,
  },
  {
    name: 'Professional',
    price: 29,
    description: 'For growing teams',
    features: ['Unlimited Projects', '100GB Storage', 'Advanced Analytics', 'Priority Support', 'API Access', 'Custom Integrations'],
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 99,
    description: 'For large organizations',
    features: ['Everything in Pro', 'Unlimited Storage', 'Dedicated Support', 'SSO & SAML', 'Custom Contracts', 'SLA Guarantee'],
    popular: false,
  },
];

export function PricingTable() {
  return (
    <div className="py-24 px-4 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
          <p className="text-xl text-gray-600">Choose the plan that's right for you</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={\`relative bg-white rounded-2xl p-8 shadow-sm \${
                plan.popular ? 'ring-2 ring-blue-600 scale-105' : ''
              }\`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-600 text-white text-sm font-medium rounded-full">
                  Most Popular
                </div>
              )}

              <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
              <p className="text-gray-500 mt-1">{plan.description}</p>

              <div className="mt-6 mb-8">
                <span className="text-5xl font-bold text-gray-900">\${plan.price}</span>
                <span className="text-gray-500">/month</span>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                className={\`w-full py-3 font-semibold rounded-lg transition-colors \${
                  plan.popular
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }\`}
              >
                Get Started
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}`,
      },
    ],
  },
];

// Get templates by category
export function getTemplatesByCategory(category: TemplateCategory): ComponentTemplate[] {
  return COMPONENT_TEMPLATES.filter(t => t.category === category);
}

// Search templates
export function searchTemplates(query: string): ComponentTemplate[] {
  const lowerQuery = query.toLowerCase();
  return COMPONENT_TEMPLATES.filter(
    t =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

// Get all categories
export function getTemplateCategories(): { id: TemplateCategory; name: string; count: number }[] {
  const categories: { id: TemplateCategory; name: string }[] = [
    { id: 'landing', name: 'Landing Pages' },
    { id: 'dashboard', name: 'Dashboards' },
    { id: 'ecommerce', name: 'E-commerce' },
    { id: 'blog', name: 'Blog' },
    { id: 'portfolio', name: 'Portfolio' },
    { id: 'saas', name: 'SaaS' },
    { id: 'components', name: 'Components' },
    { id: 'forms', name: 'Forms' },
    { id: 'navigation', name: 'Navigation' },
  ];

  return categories.map(cat => ({
    ...cat,
    count: COMPONENT_TEMPLATES.filter(t => t.category === cat.id).length,
  }));
}
