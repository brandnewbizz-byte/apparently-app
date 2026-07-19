import createContextHook from '@nkzw/create-context-hook';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { DatabaseService } from '@/lib/database';

export type ProductCondition = 'new' | 'like_new' | 'good' | 'fair' | 'used';
export type ProductCategory = 'electronics' | 'clothing' | 'home' | 'sports' | 'vehicles' | 'collectibles' | 'services' | 'other';

export interface ProductImage {
  id: string;
  uri: string;
  isVideo?: boolean;
}

export interface ProductInquiry {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  message: string;
  timestamp: string;
  isSwapOffer?: boolean;
  swapServiceId?: string;
  read: boolean;
}

export interface Product {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  sellerUsername: string;
  title: string;
  description: string;
  price: number;
  acceptsSwap: boolean;
  condition: ProductCondition;
  category: ProductCategory;
  images: ProductImage[];
  location: string;
  createdAt: string;
  updatedAt: string;
  views: number;
  saves: number;
  status: 'active' | 'sold' | 'reserved' | 'deleted';
  inquiries: ProductInquiry[];
}

interface MarketplaceState {
  products: Product[];
  myProducts: Product[];
  savedProducts: string[];
  isLoading: boolean;
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'views' | 'saves' | 'inquiries' | 'status'>) => void;
  updateProduct: (productId: string, updates: Partial<Product>) => void;
  deleteProduct: (productId: string) => void;
  markAsSold: (productId: string) => void;
  saveProduct: (productId: string) => void;
  unsaveProduct: (productId: string) => void;
  isSaved: (productId: string) => boolean;
  incrementViews: (productId: string) => void;
  addInquiry: (productId: string, inquiry: Omit<ProductInquiry, 'id' | 'timestamp' | 'read'>) => void;
  markInquiryAsRead: (productId: string, inquiryId: string) => void;
  getProductById: (productId: string) => Product | undefined;
  getProductsByCategory: (category: ProductCategory) => Product[];
  searchProducts: (query: string, category?: ProductCategory) => Product[];
  getMyStats: () => { totalViews: number; totalInquiries: number; unreadInquiries: number; totalSales: number };
}


const CURRENT_USER = {
  id: 'current-user',
  name: 'You',
  username: 'you',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
};

const mapDbProductToProduct = (p: any, inquiries: any[] = []): Product => ({
  id: p.id,
  sellerId: p.seller_id,
  sellerName: p.seller_name,
  sellerAvatar: p.seller_avatar,
  sellerUsername: p.seller_username,
  title: p.title,
  description: p.description,
  price: p.price,
  acceptsSwap: p.accepts_swap,
  condition: p.condition,
  category: p.category,
  images: p.images || [],
  location: p.location,
  createdAt: p.created_at,
  updatedAt: p.updated_at,
  views: p.views,
  saves: p.saves,
  status: p.status,
  inquiries: inquiries.map(i => ({
    id: i.id,
    userId: i.user_id,
    userName: i.user_name,
    userAvatar: i.user_avatar,
    message: i.message,
    timestamp: i.created_at,
    isSwapOffer: i.is_swap_offer,
    swapServiceId: i.swap_service_id,
    read: i.read,
  })),
});

export const [MarketplaceProvider, useMarketplace] = createContextHook<MarketplaceState>(() => {
  const queryClient = useQueryClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [savedProducts, setSavedProducts] = useState<string[]>([]);

  const productsQuery = useQuery({
    queryKey: ['marketplaceProducts'],
    queryFn: async ({ signal }) => {
      try {
        const dbProducts = await DatabaseService.fetchProducts(undefined, { signal });
        if (dbProducts && dbProducts.length > 0) {
          console.log('[MarketplaceContext] Fetched products from Supabase:', dbProducts.length);
          
          const productsWithInquiries = await Promise.all(
            dbProducts.map(async (p) => {
              const inquiries = await DatabaseService.fetchProductInquiries(p.id, { signal });
              return mapDbProductToProduct(p, inquiries);
            })
          );
          
          return productsWithInquiries;
        }
        
        console.log('[MarketplaceContext] No Supabase products');
        return [];
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          console.log('[MarketplaceContext] Products fetch aborted (navigation)');
          return [];
        }
        console.error('[MarketplaceContext] Error loading products:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const savedQuery = useQuery({
    queryKey: ['savedProducts'],
    queryFn: async () => {
      console.log('[MarketplaceContext] Saved products are backend-only (no local state)');
      return [] as string[];
    },
  });



  const createProductMutation = useMutation({
    mutationFn: async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'views' | 'saves' | 'inquiries' | 'status'>) => {
      const dbProduct = await DatabaseService.createProduct({
        seller_id: product.sellerId,
        seller_name: product.sellerName,
        seller_avatar: product.sellerAvatar,
        seller_username: product.sellerUsername,
        title: product.title,
        description: product.description,
        price: product.price,
        accepts_swap: product.acceptsSwap,
        condition: product.condition,
        category: product.category,
        images: product.images,
        location: product.location,
        status: 'active',
      });
      if (dbProduct) {
        console.log('[MarketplaceContext] Created product in Supabase:', dbProduct.id);
        return dbProduct;
      }
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplaceProducts'] });
    },
  });

  useEffect(() => {
    if (productsQuery.data) {
      setProducts(productsQuery.data);
    }
  }, [productsQuery.data]);

  useEffect(() => {
    if (savedQuery.data) {
      setSavedProducts(savedQuery.data);
    }
  }, [savedQuery.data]);

  const myProducts = products.filter(p => p.sellerId === CURRENT_USER.id && p.status !== 'deleted');

  const createProductMutate = createProductMutation.mutate;

  const addProduct = useCallback((product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'views' | 'saves' | 'inquiries' | 'status'>) => {
    console.log('[MarketplaceContext] Creating product (Supabase)...');
    createProductMutate(product);
  }, [createProductMutate]);

  const updateProduct = useCallback(async (productId: string, updates: Partial<Product>) => {
    console.log('[MarketplaceContext] Updating product (Supabase):', productId);

    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.price !== undefined) dbUpdates.price = updates.price;
    if (updates.acceptsSwap !== undefined) dbUpdates.accepts_swap = updates.acceptsSwap;
    if (updates.condition !== undefined) dbUpdates.condition = updates.condition;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.images !== undefined) dbUpdates.images = updates.images;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.views !== undefined) dbUpdates.views = updates.views;
    if (updates.saves !== undefined) dbUpdates.saves = updates.saves;
    
    await DatabaseService.updateProduct(productId, dbUpdates);
    queryClient.invalidateQueries({ queryKey: ['marketplaceProducts'] });
    console.log('[MarketplaceContext] Updated product:', productId);
  }, [queryClient]);

  const deleteProduct = useCallback(async (productId: string) => {
    await DatabaseService.updateProduct(productId, { status: 'deleted' });
    queryClient.invalidateQueries({ queryKey: ['marketplaceProducts'] });
    console.log('[MarketplaceContext] Deleted product:', productId);
  }, [queryClient]);

  const markAsSold = useCallback(async (productId: string) => {
    await DatabaseService.updateProduct(productId, { status: 'sold' });
    queryClient.invalidateQueries({ queryKey: ['marketplaceProducts'] });
    console.log('[MarketplaceContext] Marked as sold:', productId);
  }, [queryClient]);

  const saveProduct = useCallback(async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    await DatabaseService.updateProduct(productId, { saves: product.saves + 1 });
    queryClient.invalidateQueries({ queryKey: ['marketplaceProducts'] });
  }, [products, queryClient]);

  const unsaveProduct = useCallback(async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    await DatabaseService.updateProduct(productId, { saves: Math.max(0, product.saves - 1) });
    queryClient.invalidateQueries({ queryKey: ['marketplaceProducts'] });
  }, [products, queryClient]);

  const isSaved = useCallback((_productId: string) => {
    return false;
  }, []);

  const incrementViews = useCallback(async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    await DatabaseService.updateProduct(productId, { views: product.views + 1 });
    queryClient.invalidateQueries({ queryKey: ['marketplaceProducts'] });
  }, [products, queryClient]);

  const addInquiry = useCallback(async (productId: string, inquiry: Omit<ProductInquiry, 'id' | 'timestamp' | 'read'>) => {
    await DatabaseService.createProductInquiry({
      product_id: productId,
      user_id: inquiry.userId,
      user_name: inquiry.userName,
      user_avatar: inquiry.userAvatar,
      message: inquiry.message,
      is_swap_offer: inquiry.isSwapOffer,
      swap_service_id: inquiry.swapServiceId,
      read: false,
    });
    
    queryClient.invalidateQueries({ queryKey: ['marketplaceProducts'] });
    console.log('[MarketplaceContext] Added inquiry to product:', productId);
  }, [queryClient]);

  const markInquiryAsRead = useCallback((_productId: string, _inquiryId: string) => {
    console.log('[MarketplaceContext] markInquiryAsRead not implemented (backend-only)');
  }, []);

  const getProductById = useCallback((productId: string) => {
    return products.find(p => p.id === productId);
  }, [products]);

  const getProductsByCategory = useCallback((category: ProductCategory) => {
    return products.filter(p => p.category === category && p.status === 'active');
  }, [products]);

  const searchProducts = useCallback((query: string, category?: ProductCategory) => {
    const lowerQuery = query.toLowerCase();
    return products.filter(p => {
      if (p.status !== 'active') return false;
      if (category && p.category !== category) return false;
      return (
        p.title.toLowerCase().includes(lowerQuery) ||
        p.description.toLowerCase().includes(lowerQuery) ||
        p.sellerName.toLowerCase().includes(lowerQuery)
      );
    });
  }, [products]);

  const getMyStats = useCallback(() => {
    const myProds = products.filter(p => p.sellerId === CURRENT_USER.id);
    const totalViews = myProds.reduce((acc, p) => acc + p.views, 0);
    const totalInquiries = myProds.reduce((acc, p) => acc + p.inquiries.length, 0);
    const unreadInquiries = myProds.reduce((acc, p) => acc + p.inquiries.filter(i => !i.read).length, 0);
    const totalSales = myProds.filter(p => p.status === 'sold').length;
    return { totalViews, totalInquiries, unreadInquiries, totalSales };
  }, [products]);

  return {
    products: products.filter(p => p.status === 'active'),
    myProducts,
    savedProducts,
    isLoading: productsQuery.isLoading,
    addProduct,
    updateProduct,
    deleteProduct,
    markAsSold,
    saveProduct,
    unsaveProduct,
    isSaved,
    incrementViews,
    addInquiry,
    markInquiryAsRead,
    getProductById,
    getProductsByCategory,
    searchProducts,
    getMyStats,
  };
});
