// Shared types for the vendor food system

export type PriceType = "scoop" | "plate" | "both";
export type FoodStatus = "available" | "out_of_stock" | "preorder" | "hidden";
export type ExtraType = "required" | "optional";

export interface FoodExtra {
  id: string;
  name: string;
  price: number; // in naira (display currency)
  type: ExtraType;
  isAvailable: boolean;
}

export interface FoodItem {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string | null;
  category?: string;
  priceType: PriceType;
  scoopPrice?: number; // in naira
  platePrice?: number; // in naira
  status: FoodStatus;
  isPublished: boolean;
  preorderEnabled: boolean;
  preorderDate?: string;
  preorderTime?: string;
  extras: FoodExtra[];
  createdAt: string;
}

// Form state for the add-food step flow
export interface AddFoodFormData {
  name: string;
  imageFile: File | null;
  imagePreview: string | null;
  description: string;
  category: string;
  priceType: PriceType | null;
  scoopPrice: string;
  platePrice: string;
  hasExtras: boolean | null;
  requiredExtras: FoodExtra[];
  optionalExtras: FoodExtra[];
  isAvailable: boolean;
  preorderEnabled: boolean;
  preorderDate: string;
  preorderTime: string;
}

export const INITIAL_FORM_DATA: AddFoodFormData = {
  name: "",
  imageFile: null,
  imagePreview: null,
  description: "",
  category: "",
  priceType: null,
  scoopPrice: "",
  platePrice: "",
  hasExtras: null,
  requiredExtras: [],
  optionalExtras: [],
  isAvailable: true,
  preorderEnabled: false,
  preorderDate: "",
  preorderTime: "",
};

export const FOOD_CATEGORIES = [
  "Rice",
  "Soups",
  "Swallow",
  "Drinks",
  "Snacks",
  "Breakfast",
  "Sides",
  "Other",
];

// Mock data for development
export const MOCK_FOODS: FoodItem[] = [
  {
    id: "1",
    name: "Jollof Rice",
    description: "Smoky party-style jollof rice",
    imageUrl: null,
    category: "Rice",
    priceType: "both",
    scoopPrice: 500,
    platePrice: 2000,
    status: "available",
    isPublished: true,
    preorderEnabled: false,
    extras: [
      { id: "e1", name: "Chicken", price: 1000, type: "required", isAvailable: true },
      { id: "e2", name: "Beef", price: 1200, type: "required", isAvailable: true },
      { id: "e3", name: "Fish", price: 1500, type: "required", isAvailable: true },
      { id: "e4", name: "Extra Egg", price: 500, type: "optional", isAvailable: true },
      { id: "e5", name: "Plantain", price: 700, type: "optional", isAvailable: true },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Egusi Soup",
    description: "Thick melon seed soup with assorted meat",
    imageUrl: null,
    category: "Soups",
    priceType: "plate",
    platePrice: 1500,
    status: "available",
    isPublished: true,
    preorderEnabled: false,
    extras: [
      { id: "e6", name: "Pounded Yam", price: 400, type: "required", isAvailable: true },
      { id: "e7", name: "Amala", price: 300, type: "required", isAvailable: true },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: "3",
    name: "Chicken Suya",
    description: "Spicy grilled chicken with yaji pepper",
    imageUrl: null,
    category: "Snacks",
    priceType: "plate",
    platePrice: 2000,
    status: "preorder",
    isPublished: true,
    preorderEnabled: true,
    preorderDate: "Saturday, Sept 28",
    preorderTime: "12:00 PM",
    extras: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: "4",
    name: "Chapman",
    description: "Nigerian fruit cocktail",
    imageUrl: null,
    category: "Drinks",
    priceType: "plate",
    platePrice: 800,
    status: "out_of_stock",
    isPublished: true,
    preorderEnabled: false,
    extras: [],
    createdAt: new Date().toISOString(),
  },
];
