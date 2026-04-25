export type MenuCategoryId = number;

export interface MenuCategoryRecord {
  id: MenuCategoryId;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  category: MenuCategoryId;
  categoryName?: string;
  isAvailable: boolean;
  images: string[];
  imageItems?: MenuItemImage[];
}

export interface MenuItemImage {
  id: number;
  menuItemId: number;
  imageUrl: string;
  isMainImage: boolean;
}

export interface CreateMenuItemInput {
  name: string;
  description: string;
  price: number;
  category: MenuCategoryId;
  isAvailable: boolean;
  images?: string[];
}

export interface UpdateMenuItemInput {
  name?: string;
  description?: string;
  price?: number;
  category?: MenuCategoryId;
  isAvailable?: boolean;
  images?: string[];
}

export interface CreateMenuCategoryInput {
  name: string;
  isActive: boolean;
}

export interface UpdateMenuCategoryInput {
  name: string;
  isActive: boolean;
}
