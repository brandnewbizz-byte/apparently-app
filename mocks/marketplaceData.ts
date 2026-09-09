// All mock data removed — app uses Supabase live backend only
// Option arrays are preserved as static UI config (labels/emoji/descriptions)

import { Product, ProductCategory, ProductCondition } from '@/contexts/MarketplaceContext';

export const mockProducts: Product[] = [];

export interface CategoryOption {
  key: ProductCategory;
  label: string;
  emoji: string;
}

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { key: 'electronics', label: 'Electronics', emoji: '📱' },
  { key: 'clothing', label: 'Clothing', emoji: '👕' },
  { key: 'home', label: 'Home', emoji: '🏠' },
  { key: 'sports', label: 'Sports', emoji: '🏀' },
  { key: 'vehicles', label: 'Vehicles', emoji: '🚗' },
  { key: 'collectibles', label: 'Collectibles', emoji: '🪙' },
  { key: 'services', label: 'Services', emoji: '🛠️' },
  { key: 'other', label: 'Other', emoji: '📦' },
];

export interface ConditionOption {
  key: ProductCondition;
  label: string;
  description: string;
}

export const CONDITION_OPTIONS: ConditionOption[] = [
  { key: 'new', label: 'New', description: 'Brand new, never used, in original packaging' },
  { key: 'like_new', label: 'Like New', description: 'Used but in excellent, near-perfect condition' },
  { key: 'good', label: 'Good', description: 'Used, shows minor signs of wear' },
  { key: 'fair', label: 'Fair', description: 'Used, shows visible wear but fully functional' },
  { key: 'used', label: 'Used', description: 'Used with noticeable wear or cosmetic damage' },
];
