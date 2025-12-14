
export interface Recipe {
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  prepTime: string;
  cookTime: string;
  servings: string;
}

export interface ChefTips {
  cookingTip: string;
  beveragePairing: string;
}

export interface SavedRecipe {
  id: string;
  recipe: Recipe;
  chefTips: ChefTips | null;
  timestamp: number;
}
