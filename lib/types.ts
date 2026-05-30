export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  custom_avatar_url: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_type: string | null;
  gender_presentation: string | null;
  skin_tone: string | null;
  hair_colour: string | null;
  hair_length: string | null;
  age_range: string | null;
  created_at: string;
}

export interface BodyProfile {
  custom_avatar_url: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_type: string | null;
  gender_presentation: string | null;
  skin_tone: string | null;
  hair_colour: string | null;
  hair_length: string | null;
  age_range: string | null;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  preferred_brands: string[];
  price_min: number;
  price_max: number;
  preferred_styles: string[];
  preferred_colours: string[];
  sizes: Record<string, string>;
  gender: string;
  updated_at: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  base_url: string | null;
  logo_url: string | null;
  price_tier: string | null;
  has_api: boolean;
  affiliate_base: string | null;
  scrape_config: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  parent_category: string | null;
  display_order: number | null;
}

export interface Product {
  id: string;
  source: string;
  brand_id: string;
  category_id: string;
  external_id: string | null;
  parent_product_id: string | null;
  name: string;
  subcategory: string | null;
  description: string | null;
  tagline: string | null;
  collection_name: string | null;
  collection_season: string | null;
  is_new_arrival: boolean;
  price: number;
  original_price: number | null;
  currency: string;
  is_on_sale: boolean;
  discount_percent: number | null;
  colours: string[];
  colour_codes: string[];
  sizes_available: string[];
  size_system: string | null;
  fit: string | null;
  dimensions: Record<string, unknown> | null;
  weight_grams: number | null;
  materials: string[];
  care_instructions: string[];
  country_of_origin: string | null;
  style_tags: string[];
  occasion_tags: string[];
  season_tags: string[];
  aesthetic_tags: string[];
  gender: string;
  images: string[];
  source_image_urls: string[];
  variants: Record<string, unknown> | null;
  shipping_info: Record<string, unknown> | null;
  stock_status: Record<string, unknown> | null;
  rating: number | null;
  review_count: number | null;
  rating_breakdown: Record<string, unknown> | null;
  product_url: string | null;
  affiliate_url: string | null;
  deep_link_ios: string | null;
  deep_link_android: string | null;
  styled_with: string[];
  sustainability_info: Record<string, unknown> | null;
  search_keywords: string[];
  raw_scraped_text: string | null;
  raw_product: Record<string, unknown> | null;
  scrape_confidence: number | null;
  combined_text: string | null;
  vector_timestamp: string | null;
  scraped_at: string | null;
  last_updated: string | null;
  is_active: boolean;
  jewellery_metal: string | null;
  jewellery_stone: string | null;
}

export interface OutfitSession {
  id: string;
  user_id: string;
  initial_prompt: string;
  filters: Record<string, unknown>;
  created_at: string;
}

export interface Outfit {
  id: string;
  session_id: string;
  prompt_used: string;
  ai_reasoning: string | null;
  total_price: number | null;
  preview_image: string | null;
  created_at: string;
}

export interface OutfitItem {
  id: string;
  outfit_id: string;
  product_id: string;
  role: string;
}

export interface SavedOutfit {
  id: string;
  user_id: string;
  outfit_id: string;
  notes: string | null;
  saved_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: "free" | "starter" | "pro";
  billing_interval: "monthly" | "yearly" | null;
  status: "active" | "past_due" | "canceled" | "trialing";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface Usage {
  id: string;
  user_id: string;
  period: string;
  generations: number;
  try_ons: number;
  saved_looks: number;
  created_at: string;
  updated_at: string;
}

export interface OutfitCardItem {
  product: ProductCandidate;
  role: string;
}

export interface OutfitWithItems extends Outfit {
  items: OutfitCardItem[];
}

export interface GenerateFilters {
  budget_min: number;
  budget_max: number;
  gender: "mens" | "womens" | "unisex";
  brands: string[];
  body_type?: string | null;
  age_range?: string | null;
  occasion?: string | null;
  season?: string | null;
  preferred_currency?: string;
}

export interface ParsedFilters {
  budget_max: number | null;
  budget_min: number | null;
  occasion: string | null;
  vibe_description: string;
  colours: string[];
  brands: string[];
  gender: "mens" | "womens" | "unisex";
  exclude_categories: string[];
  style_keywords: string[];
  season: string | null;
}

export interface ProductCandidate {
  id: string;
  name: string;
  brand_name: string;
  category_name: string;
  subcategory: string | null;
  description: string | null;
  price: number;           // already converted to user's preferred currency
  currency: string;        // user's preferred currency code (e.g. "GBP", "PKR")
  original_price: number;  // price in the product's original currency
  original_currency: string; // original currency code from the DB
  colours: string[];
  images: string[];
  style_tags: string[];
  occasion_tags: string[];
  aesthetic_tags: string[];
  fit: string | null;
  product_url: string | null;
  similarity: number;
}
