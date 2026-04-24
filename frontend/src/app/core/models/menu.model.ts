import { MenuCategory } from './enums';

export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  category: MenuCategory;
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
  category: MenuCategory;
  isAvailable: boolean;
  images?: string[];
}

export interface UpdateMenuItemInput {
  name?: string;
  description?: string;
  price?: number;
  category?: MenuCategory;
  isAvailable?: boolean;
  images?: string[];
}
