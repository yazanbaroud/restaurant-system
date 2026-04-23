import { MenuCategory } from './enums';

export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  category: MenuCategory;
  isAvailable: boolean;
  images: string[];
}
