// Starter fast-food library — ~20 chains' most macro-friendly go-to order,
// loaded via the "Load starter list" button in MacrosScreen (a client-side
// bulk insert through the authenticated Supabase client, not a SQL seed —
// SQL-editor sessions aren't signed in as a user, so auth.uid()-defaulted
// rows can't be seeded that way; see schema.sql's goal-seed comment for the
// same reason). Macros are reasonable public-nutrition-info estimates, not
// guaranteed exact — editable/removable from the screen like any other row.
export interface FastFoodSeedItem {
  restaurant_name: string;
  item_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  goal_tags: string[];
}

export const FAST_FOOD_SEED: FastFoodSeedItem[] = [
  { restaurant_name: "McDonald's", item_name: 'Grilled Chicken Snack Wrap', calories: 260, protein_g: 17, carbs_g: 26, fat_g: 10, goal_tags: ['high-protein-low-cal', 'best-value'] },
  { restaurant_name: "Chick-fil-A", item_name: 'Grilled Chicken Sandwich (no mayo)', calories: 320, protein_g: 28, carbs_g: 41, fat_g: 6, goal_tags: ['high-protein-low-cal'] },
  { restaurant_name: 'Chipotle', item_name: 'Chicken Bowl (rice, black beans, fajita veg, salsa)', calories: 555, protein_g: 42, carbs_g: 55, fat_g: 16, goal_tags: ['high-protein-low-cal', 'best-value'] },
  { restaurant_name: 'Subway', item_name: '6" Turkey on Wheat, no cheese/mayo', calories: 280, protein_g: 18, carbs_g: 46, fat_g: 3, goal_tags: ['high-protein-low-cal', 'best-value'] },
  { restaurant_name: 'Wendy\'s', item_name: 'Grilled Chicken Sandwich', calories: 370, protein_g: 34, carbs_g: 36, fat_g: 9, goal_tags: ['high-protein-low-cal'] },
  { restaurant_name: 'Taco Bell', item_name: 'Power Menu Bowl — Chicken', calories: 470, protein_g: 26, carbs_g: 46, fat_g: 20, goal_tags: ['best-value'] },
  { restaurant_name: 'Panera', item_name: 'Chicken Caesar Salad (no croutons)', calories: 380, protein_g: 33, carbs_g: 12, fat_g: 24, goal_tags: ['low-carb'] },
  { restaurant_name: 'In-N-Out', item_name: 'Protein Style Double-Double', calories: 520, protein_g: 33, carbs_g: 11, fat_g: 39, goal_tags: ['low-carb', 'high-protein-low-cal'] },
  { restaurant_name: 'Five Guys', item_name: 'Little Hamburger, no bun', calories: 480, protein_g: 27, carbs_g: 4, fat_g: 40, goal_tags: ['low-carb'] },
  { restaurant_name: 'Panda Express', item_name: 'Grilled Teriyaki Chicken + mixed veggies', calories: 330, protein_g: 36, carbs_g: 15, fat_g: 14, goal_tags: ['high-protein-low-cal'] },
  { restaurant_name: "Jimmy John's", item_name: 'Unwich Turkey Tom (lettuce wrap)', calories: 300, protein_g: 24, carbs_g: 8, fat_g: 19, goal_tags: ['low-carb'] },
  { restaurant_name: 'Starbucks', item_name: 'Sous Vide Egg White Bites + black coffee', calories: 170, protein_g: 13, carbs_g: 11, fat_g: 8, goal_tags: ['high-protein-low-cal', 'best-value'] },
  { restaurant_name: 'Dunkin\'', item_name: 'Egg White & Veggie Wake-Up Wrap', calories: 150, protein_g: 8, carbs_g: 17, fat_g: 6, goal_tags: ['best-value'] },
  { restaurant_name: "Raising Cane's", item_name: '3 Chicken Fingers, no sauce, no toast', calories: 380, protein_g: 42, carbs_g: 24, fat_g: 12, goal_tags: ['high-protein-low-cal'] },
  { restaurant_name: 'Popeyes', item_name: 'Blackened Chicken Tenders (3pc)', calories: 240, protein_g: 36, carbs_g: 3, fat_g: 9, goal_tags: ['low-carb', 'high-protein-low-cal'] },
  { restaurant_name: 'Qdoba', item_name: 'Chicken Protein Bowl (no rice, add fajita veg)', calories: 420, protein_g: 45, carbs_g: 18, fat_g: 19, goal_tags: ['low-carb', 'high-protein-low-cal'] },
  { restaurant_name: 'Jersey Mike\'s', item_name: 'Turkey Breast Mini Sub, no cheese', calories: 240, protein_g: 15, carbs_g: 34, fat_g: 4, goal_tags: ['best-value'] },
  { restaurant_name: "Wingstop", item_name: '6 Naked Tenders, no sauce', calories: 360, protein_g: 54, carbs_g: 6, fat_g: 12, goal_tags: ['low-carb', 'high-protein-low-cal'] },
  { restaurant_name: 'Chopt', item_name: 'Steakhouse Chop Salad (dressing on side)', calories: 460, protein_g: 38, carbs_g: 22, fat_g: 24, goal_tags: ['high-protein-low-cal'] },
  { restaurant_name: 'Sweetgreen', item_name: 'Harvest Bowl, half portion', calories: 420, protein_g: 22, carbs_g: 38, fat_g: 20, goal_tags: ['best-value'] },
];
