// All mock data removed — app uses Supabase live backend only
// Types are preserved for TypeScript compatibility

import { Product, ProductCategory, ProductCondition } from '@/contexts/MarketplaceContext';

export const mockProducts: Product[] = [];

export const CATEGORY_OPTIONS: ProductCategory[] = ['Electronics', 'Fashion', 'Home', 'Sports', 'Books', 'Other'];
export const CONDITION_OPTIONS: ProductCondition[] = ['New', 'Like New', 'Good', 'Fair', 'Used'];
