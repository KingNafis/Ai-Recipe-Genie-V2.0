import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { IngredientInput } from './components/IngredientInput';
import { RecipeDisplay } from './components/RecipeDisplay';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorDisplay } from './components/ErrorDisplay';
import { Sidebar } from './components/Sidebar';
import { LoginModal } from './components/LoginModal';
import { generateRecipe, generateChefTips } from './services/geminiService';
import { storageService } from './services/storageService';
import type { Recipe, SavedRecipe, ChefTips } from './types';

const App: React.FC = () => {
  // Application State
  const [ingredients, setIngredients] = useState<string>('');
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([]);
  const [generatedRecipe, setGeneratedRecipe] = useState<Recipe | null>(null);
  const [chefTips, setChefTips] = useState<ChefTips | null>(null);
  const [currentRecipeId, setCurrentRecipeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Auth & UI State
  const [user, setUser] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedRecipe[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Initialize Auth - Load from Database
  useEffect(() => {
    const initAuth = async () => {
      try {
        const savedUser = await storageService.getUser();
        if (savedUser) {
          setUser(savedUser);
          const userHistory = await storageService.getHistory(savedUser);
          setHistory(userHistory);
        }
      } catch (err) {
        console.error("Failed to initialize database:", err);
      }
    };
    initAuth();
  }, []);

  const handleLogin = async (username: string) => {
    try {
      await storageService.login(username);
      setUser(username);
      const userHistory = await storageService.getHistory(username);
      setHistory(userHistory);
      setIsLoginModalOpen(false);
    } catch (err) {
      console.error("Login failed:", err);
      setError("Failed to log in. Please try again.");
    }
  };

  const handleLogout = async () => {
    try {
      await storageService.logout();
      setUser(null);
      setHistory([]);
      setGeneratedRecipe(null);
      setChefTips(null);
      setCurrentRecipeId(null);
      setIngredients('');
      setIsSidebarOpen(false);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleSelectHistoryItem = (item: SavedRecipe) => {
    setGeneratedRecipe(item.recipe);
    setChefTips(item.chefTips);
    setCurrentRecipeId(item.id);
    setError(null);
    setIngredients(item.recipe.ingredients.join(', '));
  };

  const handleDeleteRecipe = async (item: SavedRecipe) => {
    if (user) {
      try {
        const updatedHistory = await storageService.deleteRecipe(user, item.id);
        setHistory(updatedHistory);
        
        // If the deleted recipe is the one currently displayed, clear the display
        if (currentRecipeId === item.id) {
          setGeneratedRecipe(null);
          setChefTips(null);
          setCurrentRecipeId(null);
          setIngredients('');
        }
      } catch (err) {
        console.error("Failed to delete recipe:", err);
        setError("Could not delete recipe.");
      }
    }
  };

  const handleGenerateRecipe = useCallback(async () => {
    if (!ingredients.trim()) {
      setError('Please enter at least one ingredient.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedRecipe(null);
    setChefTips(null);
    setCurrentRecipeId(null);

    try {
      setLoadingMessage('Crafting your unique recipe...');
      const recipe = await generateRecipe(ingredients, dietaryPreferences);
      setGeneratedRecipe(recipe);

      setLoadingMessage('Consulting the chef for pro tips...');
      let tips: ChefTips | null = null;
      try {
        tips = await generateChefTips(recipe.title, recipe.ingredients);
        setChefTips(tips);
      } catch (tipError) {
        console.warn("Tips generation failed, continuing with recipe only.", tipError);
      }
      
      // Save to history if logged in
      if (user) {
        const newItem: SavedRecipe = {
          id: Date.now().toString(),
          recipe,
          chefTips: tips,
          timestamp: Date.now()
        };
        try {
          const updatedHistory = await storageService.saveRecipe(user, newItem);
          setHistory(updatedHistory);
          setCurrentRecipeId(newItem.id);
        } catch (saveError) {
          console.error("Failed to save to database:", saveError);
          // Don't show error to user since recipe was generated successfully
        }
      }

    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(`Failed to generate recipe. ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [ingredients, dietaryPreferences, user]);

  const handleStartOver = () => {
    setIngredients('');
    setDietaryPreferences([]);
    setGeneratedRecipe(null);
    setChefTips(null);
    setCurrentRecipeId(null);
    setError(null);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col md:flex-row font-sans text-stone-800 selection:bg-orange-100 selection:text-orange-800">
      
      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen}
        user={user}
        history={history}
        onLoginClick={() => setIsLoginModalOpen(true)}
        onLogoutClick={handleLogout}
        onSelectRecipe={handleSelectHistoryItem}
        onDeleteRecipe={handleDeleteRecipe}
        onNewRecipe={handleStartOver}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 transition-all">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-5xl mx-auto w-full">
          <div className={`bg-white rounded-3xl shadow-xl shadow-stone-200/50 border border-white/50 p-6 sm:p-10 transition-all duration-500 min-h-[500px] ${isLoading ? 'flex flex-col justify-center items-center' : 'space-y-8'}`}>
            {!generatedRecipe && !isLoading && (
              <IngredientInput
                ingredients={ingredients}
                setIngredients={setIngredients}
                dietaryPreferences={dietaryPreferences}
                setDietaryPreferences={setDietaryPreferences}
                onGenerate={handleGenerateRecipe}
              />
            )}

            {isLoading && <LoadingSpinner message={loadingMessage} />}

            {error && !isLoading && <ErrorDisplay message={error} />}
            
            {generatedRecipe && !isLoading && (
              <RecipeDisplay
                recipe={generatedRecipe}
                chefTips={chefTips}
                onStartOver={handleStartOver}
              />
            )}
          </div>
          
          <footer className="text-center text-stone-400 mt-12 text-sm pb-8">
            <p>Powered by KingNafis. Recipes are AI-generated and should be prepared with care.</p>
            <p className="mt-1">&copy; {new Date().getFullYear()} Nafis. All Rights Reserved.</p>
          </footer>
        </main>
      </div>

      <LoginModal 
        isOpen={isLoginModalOpen}
        onLogin={handleLogin}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
};

export default App;