// Hearth AI — seed data: recipes, staples, templates, diets.
// Browser + node compatible.
(function () {
"use strict";

const DIETS = [
  { id: "none", name: "No restriction" },
  { id: "vegetarian", name: "Vegetarian" },
  { id: "vegan", name: "Vegan" },
  { id: "high-protein", name: "High protein" },
  { id: "low-carb", name: "Low carb" },
  { id: "gluten-free", name: "Gluten free" },
  { id: "family", name: "Family friendly" },
  { id: "quick", name: "Quick (under 30 min)" }
];

const AISLE_ORDER = ["Produce", "Meat & Seafood", "Dairy & Eggs", "Bakery", "Pantry", "Spices", "Frozen", "Beverages", "Household"];

// ingredient: {name, qty, unit, aisle}
const RECIPES = [
  { id: "overnight-oats", name: "Overnight Oats with Berries", meal: "breakfast",
    tags: ["vegetarian", "quick", "family"], timeMin: 10, servings: 2, kcal: 320, proteinG: 11,
    ingredients: [
      { name: "Rolled oats", qty: 1, unit: "cup", aisle: "Pantry" },
      { name: "Milk", qty: 1, unit: "cup", aisle: "Dairy & Eggs" },
      { name: "Greek yogurt", qty: 0.5, unit: "cup", aisle: "Dairy & Eggs" },
      { name: "Blueberries", qty: 0.5, unit: "cup", aisle: "Produce" },
      { name: "Honey", qty: 1, unit: "tbsp", aisle: "Pantry" }
    ],
    steps: ["Combine oats, milk and yogurt in a jar.", "Stir in honey and top with blueberries.", "Refrigerate overnight; serve cold."] },
  { id: "mediterranean-omelette", name: "Mediterranean Omelette", meal: "breakfast",
    tags: ["vegetarian", "high-protein", "quick", "gluten-free"], timeMin: 15, servings: 1, kcal: 380, proteinG: 24,
    ingredients: [
      { name: "Eggs", qty: 3, unit: "pcs", aisle: "Dairy & Eggs" },
      { name: "Cherry tomatoes", qty: 0.5, unit: "cup", aisle: "Produce" },
      { name: "Spinach", qty: 1, unit: "cup", aisle: "Produce" },
      { name: "Feta cheese", qty: 2, unit: "oz", aisle: "Dairy & Eggs" },
      { name: "Olive oil", qty: 1, unit: "tsp", aisle: "Pantry" }
    ],
    steps: ["Whisk eggs with a pinch of salt.", "Saute spinach and tomatoes in olive oil.", "Pour in eggs, cook until set, fold in feta."] },
  { id: "veggie-curry", name: "Chickpea Coconut Curry", meal: "dinner",
    tags: ["vegan", "gluten-free", "family"], timeMin: 35, servings: 4, kcal: 480, proteinG: 14,
    ingredients: [
      { name: "Chickpeas", qty: 2, unit: "cans", aisle: "Pantry" },
      { name: "Coconut milk", qty: 1, unit: "can", aisle: "Pantry" },
      { name: "Spinach", qty: 2, unit: "cups", aisle: "Produce" },
      { name: "Onion", qty: 1, unit: "pc", aisle: "Produce" },
      { name: "Curry powder", qty: 2, unit: "tbsp", aisle: "Spices" },
      { name: "Jasmine rice", qty: 1.5, unit: "cups", aisle: "Pantry" }
    ],
    steps: ["Saute onion until soft; add curry powder.", "Add chickpeas and coconut milk; simmer 20 min.", "Wilt in spinach; serve over rice."] },
  { id: "chicken-stirfry", name: "Chicken Vegetable Stir-Fry", meal: "dinner",
    tags: ["high-protein", "quick", "family"], timeMin: 25, servings: 4, kcal: 420, proteinG: 35,
    ingredients: [
      { name: "Chicken breast", qty: 1.5, unit: "lb", aisle: "Meat & Seafood" },
      { name: "Bell peppers", qty: 2, unit: "pcs", aisle: "Produce" },
      { name: "Broccoli", qty: 2, unit: "cups", aisle: "Produce" },
      { name: "Soy sauce", qty: 3, unit: "tbsp", aisle: "Pantry" },
      { name: "Jasmine rice", qty: 1.5, unit: "cups", aisle: "Pantry" }
    ],
    steps: ["Sear sliced chicken until cooked through.", "Add vegetables; stir-fry until crisp-tender.", "Toss with soy sauce; serve over rice."] },
  { id: "greek-salad-bowl", name: "Greek Salad Bowl", meal: "lunch",
    tags: ["vegetarian", "gluten-free", "quick"], timeMin: 15, servings: 2, kcal: 350, proteinG: 12,
    ingredients: [
      { name: "Cucumber", qty: 1, unit: "pc", aisle: "Produce" },
      { name: "Cherry tomatoes", qty: 1, unit: "cup", aisle: "Produce" },
      { name: "Red onion", qty: 0.25, unit: "pc", aisle: "Produce" },
      { name: "Feta cheese", qty: 3, unit: "oz", aisle: "Dairy & Eggs" },
      { name: "Kalamata olives", qty: 0.25, unit: "cup", aisle: "Pantry" },
      { name: "Olive oil", qty: 2, unit: "tbsp", aisle: "Pantry" }
    ],
    steps: ["Chop vegetables into bite-size pieces.", "Combine with olives and feta.", "Dress with olive oil and lemon."] },
  { id: "salmon-quinoa", name: "Herb Salmon with Quinoa", meal: "dinner",
    tags: ["high-protein", "gluten-free"], timeMin: 30, servings: 2, kcal: 520, proteinG: 38,
    ingredients: [
      { name: "Salmon fillets", qty: 2, unit: "pcs", aisle: "Meat & Seafood" },
      { name: "Quinoa", qty: 1, unit: "cup", aisle: "Pantry" },
      { name: "Asparagus", qty: 1, unit: "bunch", aisle: "Produce" },
      { name: "Lemon", qty: 1, unit: "pc", aisle: "Produce" },
      { name: "Olive oil", qty: 1, unit: "tbsp", aisle: "Pantry" }
    ],
    steps: ["Roast salmon at 400F for 12 minutes.", "Simmer quinoa 15 minutes; rest 5.", "Steam asparagus; finish with lemon."] },
  { id: "lentil-soup", name: "Red Lentil Soup", meal: "dinner",
    tags: ["vegan", "high-protein", "family", "gluten-free"], timeMin: 40, servings: 6, kcal: 310, proteinG: 16,
    ingredients: [
      { name: "Red lentils", qty: 2, unit: "cups", aisle: "Pantry" },
      { name: "Carrots", qty: 2, unit: "pcs", aisle: "Produce" },
      { name: "Onion", qty: 1, unit: "pc", aisle: "Produce" },
      { name: "Vegetable broth", qty: 6, unit: "cups", aisle: "Pantry" },
      { name: "Cumin", qty: 1, unit: "tsp", aisle: "Spices" }
    ],
    steps: ["Saute onion and carrots until soft.", "Add lentils, broth and cumin; simmer 25 min.", "Blend until smooth; season to taste."] },
  { id: "turkey-tacos", name: "Turkey Tacos", meal: "dinner",
    tags: ["high-protein", "family", "quick"], timeMin: 25, servings: 4, kcal: 450, proteinG: 32,
    ingredients: [
      { name: "Ground turkey", qty: 1.25, unit: "lb", aisle: "Meat & Seafood" },
      { name: "Taco shells", qty: 8, unit: "pcs", aisle: "Pantry" },
      { name: "Shredded lettuce", qty: 2, unit: "cups", aisle: "Produce" },
      { name: "Cheddar cheese", qty: 1, unit: "cup", aisle: "Dairy & Eggs" },
      { name: "Taco seasoning", qty: 1, unit: "packet", aisle: "Spices" },
      { name: "Salsa", qty: 0.5, unit: "cup", aisle: "Pantry" }
    ],
    steps: ["Brown turkey; stir in seasoning.", "Warm taco shells.", "Fill with turkey, lettuce, cheese and salsa."] },
  { id: "margherita-pizza", name: "Margherita Pizza", meal: "dinner",
    tags: ["vegetarian", "family"], timeMin: 45, servings: 4, kcal: 620, proteinG: 22,
    ingredients: [
      { name: "Pizza dough", qty: 1, unit: "ball", aisle: "Bakery" },
      { name: "Crushed tomatoes", qty: 0.75, unit: "cup", aisle: "Pantry" },
      { name: "Fresh mozzarella", qty: 8, unit: "oz", aisle: "Dairy & Eggs" },
      { name: "Fresh basil", qty: 0.25, unit: "cup", aisle: "Produce" },
      { name: "Olive oil", qty: 1, unit: "tbsp", aisle: "Pantry" }
    ],
    steps: ["Stretch dough; top with tomatoes and mozzarella.", "Bake at 475F for 12-14 minutes.", "Finish with basil and olive oil."] },
  { id: "tofu-buddha-bowl", name: "Tofu Buddha Bowl", meal: "lunch",
    tags: ["vegan", "gluten-free"], timeMin: 30, servings: 2, kcal: 440, proteinG: 18,
    ingredients: [
      { name: "Extra-firm tofu", qty: 14, unit: "oz", aisle: "Produce" },
      { name: "Sweet potato", qty: 1, unit: "pc", aisle: "Produce" },
      { name: "Kale", qty: 2, unit: "cups", aisle: "Produce" },
      { name: "Brown rice", qty: 1, unit: "cup", aisle: "Pantry" },
      { name: "Tahini", qty: 2, unit: "tbsp", aisle: "Pantry" }
    ],
    steps: ["Roast cubed tofu and sweet potato at 425F for 25 min.", "Massage kale; cook brown rice.", "Assemble bowls; drizzle with tahini."] },
  { id: "beef-chili", name: "Slow Beef Chili", meal: "dinner",
    tags: ["high-protein", "family", "gluten-free"], timeMin: 60, servings: 6, kcal: 480, proteinG: 34,
    ingredients: [
      { name: "Ground beef", qty: 1.5, unit: "lb", aisle: "Meat & Seafood" },
      { name: "Kidney beans", qty: 2, unit: "cans", aisle: "Pantry" },
      { name: "Crushed tomatoes", qty: 1, unit: "can", aisle: "Pantry" },
      { name: "Onion", qty: 1, unit: "pc", aisle: "Produce" },
      { name: "Chili powder", qty: 2, unit: "tbsp", aisle: "Spices" }
    ],
    steps: ["Brown beef with onion.", "Add beans, tomatoes and chili powder.", "Simmer 45 minutes, stirring occasionally."] },
  { id: "caprese-pasta", name: "Caprese Pasta", meal: "dinner",
    tags: ["vegetarian", "quick", "family"], timeMin: 20, servings: 4, kcal: 540, proteinG: 18,
    ingredients: [
      { name: "Penne pasta", qty: 12, unit: "oz", aisle: "Pantry" },
      { name: "Cherry tomatoes", qty: 2, unit: "cups", aisle: "Produce" },
      { name: "Fresh mozzarella", qty: 8, unit: "oz", aisle: "Dairy & Eggs" },
      { name: "Fresh basil", qty: 0.5, unit: "cup", aisle: "Produce" },
      { name: "Olive oil", qty: 2, unit: "tbsp", aisle: "Pantry" }
    ],
    steps: ["Boil pasta until al dente; reserve pasta water.", "Toss hot pasta with tomatoes and mozzarella.", "Add basil, olive oil and a splash of pasta water."] },
  { id: "egg-fried-rice", name: "Vegetable Egg Fried Rice", meal: "lunch",
    tags: ["vegetarian", "quick", "family"], timeMin: 20, servings: 3, kcal: 410, proteinG: 15,
    ingredients: [
      { name: "Cooked rice", qty: 3, unit: "cups", aisle: "Pantry" },
      { name: "Eggs", qty: 3, unit: "pcs", aisle: "Dairy & Eggs" },
      { name: "Frozen peas", qty: 1, unit: "cup", aisle: "Frozen" },
      { name: "Carrots", qty: 1, unit: "pc", aisle: "Produce" },
      { name: "Soy sauce", qty: 2, unit: "tbsp", aisle: "Pantry" }
    ],
    steps: ["Scramble eggs; set aside.", "Stir-fry vegetables in a hot wok.", "Add rice, soy sauce and eggs; toss well."] },
  { id: "chickpea-sandwich", name: "Chickpea Salad Sandwich", meal: "lunch",
    tags: ["vegan", "quick"], timeMin: 15, servings: 2, kcal: 380, proteinG: 13,
    ingredients: [
      { name: "Chickpeas", qty: 1, unit: "can", aisle: "Pantry" },
      { name: "Whole wheat bread", qty: 4, unit: "slices", aisle: "Bakery" },
      { name: "Celery", qty: 1, unit: "stalk", aisle: "Produce" },
      { name: "Vegan mayo", qty: 3, unit: "tbsp", aisle: "Pantry" },
      { name: "Dijon mustard", qty: 1, unit: "tsp", aisle: "Pantry" }
    ],
    steps: ["Mash chickpeas with mayo and mustard.", "Fold in diced celery.", "Serve on toasted bread."] }
];

const STAPLES = [
  { name: "Milk", aisle: "Dairy & Eggs", unit: "gallon", avgDays: 7 },
  { name: "Eggs", aisle: "Dairy & Eggs", unit: "dozen", avgDays: 10 },
  { name: "Bread", aisle: "Bakery", unit: "loaf", avgDays: 5 },
  { name: "Butter", aisle: "Dairy & Eggs", unit: "stick", avgDays: 21 },
  { name: "Olive oil", aisle: "Pantry", unit: "bottle", avgDays: 45 },
  { name: "Jasmine rice", aisle: "Pantry", unit: "bag", avgDays: 30 },
  { name: "Coffee", aisle: "Beverages", unit: "bag", avgDays: 14 },
  { name: "Rolled oats", aisle: "Pantry", unit: "canister", avgDays: 21 },
  { name: "Chicken broth", aisle: "Pantry", unit: "carton", avgDays: 14 },
  { name: "Paper towels", aisle: "Household", unit: "pack", avgDays: 21 }
];

const EMAIL_TEMPLATES = [
  { id: "meeting-followup", name: "Meeting follow-up",
    subject: "Great speaking today",
    body: "Hi {{name}},\n\nThanks for the time today. As discussed, {{summary}}.\n\nNext steps on my side:\n- {{next1}}\n- {{next2}}\n\nLet me know if I missed anything.\n\nBest,\n{{sender}}" },
  { id: "polite-decline", name: "Polite decline",
    subject: "Thanks for thinking of me",
    body: "Hi {{name}},\n\nThank you for the invitation to {{event}}. I won't be able to make it this time, but I appreciate you thinking of me.\n\nHope it goes well!\n\nBest,\n{{sender}}" },
  { id: "schedule-request", name: "Schedule a meeting",
    subject: "Meeting request: {{topic}}",
    body: "Hi {{name}},\n\nI'd like to set up some time to discuss {{topic}}. I'm generally free {{availability}} — does any of that work for you?\n\nHappy to work around your schedule.\n\nBest,\n{{sender}}" },
  { id: "thank-you", name: "Thank you note",
    subject: "Thank you",
    body: "Hi {{name}},\n\nJust wanted to say thank you for {{reason}}. It made a real difference and I appreciate it.\n\nGratefully,\n{{sender}}" },
  { id: "introduction", name: "Introduction request",
    subject: "Introduction: {{sender}} <> {{name}}",
    body: "Hi {{name}},\n\n{{connector}} suggested we connect. {{context}}\n\nWould you be open to a brief call next week?\n\nBest,\n{{sender}}" }
];

const TONES = [
  { id: "professional", name: "Professional", note: "Formal, polished, business-appropriate." },
  { id: "warm", name: "Warm", note: "Friendly and personable." },
  { id: "concise", name: "Concise", note: "Short and to the point." }
];

const CALL_SCRIPTS = [
  { id: "appointment-booking", name: "Book an appointment",
    sections: [
      { h: "Opening", t: "Hi, this is {{sender}}. I'm calling to book an appointment for {{purpose}}." },
      { h: "Details", t: "I'm generally available {{availability}}. Do any of those times work?" },
      { h: "Confirm", t: "Great — could you confirm the date, time, and anything I should bring?" },
      { h: "Close", t: "Thank you so much. I'll see you then." }
    ] },
  { id: "service-inquiry", name: "Service / quote inquiry",
    sections: [
      { h: "Opening", t: "Hi, this is {{sender}}. I'm looking into {{service}} and had a few questions." },
      { h: "Questions", t: "Could you tell me about pricing, availability, and typical timelines?" },
      { h: "Compare", t: "Do you offer written quotes? I'd like to compare a couple of options." },
      { h: "Close", t: "Thanks for the information — I'll follow up once I've decided." }
    ] },
  { id: "follow-up-call", name: "Follow-up call",
    sections: [
      { h: "Opening", t: "Hi {{name}}, this is {{sender}} following up on {{topic}}." },
      { h: "Purpose", t: "I wanted to check where things stand and see if you need anything from me." },
      { h: "Next step", t: "What would be a good next step and timeline?" },
      { h: "Close", t: "Appreciate the update — I'll note that down and talk soon." }
    ] }
];

const RESEARCH_DEPTHS = [
  { id: "quick", name: "Quick brief", note: "One page: summary, key points, next steps." },
  { id: "standard", name: "Standard brief", note: "Summary, background, options, recommendation." },
  { id: "deep", name: "Deep brief", note: "Full structure with risks, costs, timeline and sources to check." }
];

const HEALTH_TYPES = [
  { id: "sleep", name: "Sleep", unit: "hours", goal: 8, good: "7-9 hours" },
  { id: "steps", name: "Steps", unit: "steps", goal: 8000, good: "8,000+ steps" },
  { id: "water", name: "Water", unit: "glasses", goal: 8, good: "8 glasses" },
  { id: "mood", name: "Mood", unit: "/5", goal: 4, good: "4 or 5 out of 5" },
  { id: "weight", name: "Weight", unit: "lb", goal: null, good: "steady trend" }
];

const api = { DIETS, AISLE_ORDER, RECIPES, STAPLES, EMAIL_TEMPLATES, TONES, CALL_SCRIPTS, RESEARCH_DEPTHS, HEALTH_TYPES };

if (typeof window !== "undefined") window.HearthData = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
