// Advanced Garden Game
const MAX_GARDEN_NAME_LENGTH = 40;
const SLOT_CUSTOM_NAME_KEY_PREFIX = 'gardenSlotCustomName_';

function sanitizeGardenName(name, fallback = '') {
    if (typeof name !== 'string') {
        return fallback;
    }

    const trimmed = name.trim();
    if (!trimmed) {
        return fallback;
    }

    const collapsedWhitespace = trimmed.replace(/\s+/g, ' ');
    const stripped = collapsedWhitespace.replace(/[<>]/g, '');
    return stripped.slice(0, MAX_GARDEN_NAME_LENGTH);
}

class GardenGame {
    constructor(saveSlot, options = {}) {
        this.saveSlot = saveSlot;
        const providedName = sanitizeGardenName(options.gardenName, '');
        this.gardenName = providedName;
        this._initialGardenName = this.gardenName;
        this.eventListeners = [];
        
        // Make this game instance globally available
        window.game = this;
        
        // Core game properties
        this.money = 100;
        this.water = 50;
        this.fertilizer = 20;
        this.score = 0;
        this.weather = 'sunny';
        this.weatherChangeInterval = 5 * 60 * 1000; // 5 minutes
        this.lastWeatherChange = Date.now();
        
        // Seasonal system
        this.currentSeason = 'spring';
        this.seasonDay = 1;
        this.seasonLength = 5; // real-life days per season (5 days = 1 season)
        this.seasonMultiplier = 1.0;
        this.seasonStartTime = null; // Will be set on first updateSeason() call
        
        // Plant growth stages
        this.growthStages = ['seed', 'sprout', 'small', 'medium', 'mature'];
        this.stageMultipliers = [0.1, 0.3, 0.6, 0.8, 1.0]; // harvest value multipliers
        
                    // Garden expansion
        this.gardenSize = 8;
        this.maxGardenSize = 16; // Increased from 12 to 16
        this.expansionCost = 5000;
        
        // Garden statistics
        this.stats = {
            totalPlantsHarvested: 0,
            totalMoneyEarned: 0,
            totalWaterUsed: 0,
            totalFertilizerUsed: 0,
            plantsByType: {},
            bestHarvest: 0,
            longestPlaySession: 0,
            totalRebirths: 0,
            sessionStartTime: Date.now(),
            adminPanelUsed: false,
            adminPanelUsageCount: 0
        };

        // Rebirth system
        this.rebirths = 0;
        this.rebirthPoints = 0;
        this.bestRebirthScore = 0;
        this.currentRunStartTime = this.stats.sessionStartTime;
        this.rebirthNotificationShown = false;
        this.prestigeUpgradeCatalog = this.createPrestigeUpgradeCatalog();
        this.prestigeUpgradeMap = this.prestigeUpgradeCatalog.reduce((map, upgrade) => {
            map[upgrade.id] = upgrade;
            return map;
        }, {});
        this.prestigeUpgrades = this.createDefaultPrestigeUpgrades();
        this.prestigePanelExpanded = false;
        
        // Garden challenges
        this.challenges = {
            daily: [],
            weekly: null,
            completed: []
        };
        this.lastChallengeUpdate = Date.now();
        
        // Visual feedback
        this.particles = [];
        this.animations = [];

        // Hover tooltip state
        this.hoverTooltip = null;
        this.currentHoverKey = null;
        this.touchHoverTimer = null;
        this.touchHoverActive = false;
        this.lastTouchPointer = { clientX: 0, clientY: 0 };

        // Quick tool menu state
        this.toolQuickMenu = null;
        this.toolboxButton = null;
        this.toolQuickMenuVisible = false;
        this.lastQuickMenuPosition = { x: 0, y: 0 };
        this.quickToolOptions = [
            { id: 'water', label: 'Water', icon: '💧' },
            { id: 'fertilizer', label: 'Fertilizer', icon: '🌱' },
            { id: 'harvest', label: 'Harvest', icon: '✂️' },
            { id: 'shovel', label: 'Shovel', icon: '⛏️' }
        ];

        // Cached canvas patterns/textures for grass tiles
        this.grassPatternCache = {}; // Cache by tile size for crisp pixel-art
        this.grassWorldScale = null;

        // External per-cell tile texture (user-provided PNG)
        // The file exists at Coding Shit/Halle10Months/src/GRASS+.png
        this.tileTexturePath = '../src/GRASS+.png';
        this.tileTextureImage = null;
        this.tileTextureLoaded = false;
        this._tileTextureAttempted = false;

        // Alert message state
        this.messageContainer = null;
        this.activeMessages = [];
        
        // Sound effects (will be implemented)
        this.soundEnabled = true;
        
        // Plant types with seasonal availability
        this.plantTypes = {
            // Spring seeds
            'carrot': { name: 'Carrot', cost: 5, growthTime: 10000, harvestValue: 8, season: 'spring', stages: ['🌱', '🌿', '🥕', '🥕', '🥕'] },
            'lettuce': { name: 'Lettuce', cost: 3, growthTime: 8000, harvestValue: 5, season: 'spring', stages: ['🌱', '🌿', '🥬', '🥬', '🥬'] },
            'radish': { name: 'Radish', cost: 4, growthTime: 12000, harvestValue: 7, season: 'spring', stages: ['🌱', '🌿', '🌶️', '🌶️', '🌶️'] },
            'spinach': { name: 'Spinach', cost: 6, growthTime: 15000, harvestValue: 10, season: 'spring', stages: ['🌱', '🌿', '🥬', '🥬', '🥬'] },
            'peas': { name: 'Peas', cost: 7, growthTime: 18000, harvestValue: 12, season: 'spring', stages: ['🌱', '🌿', '🟢', '🟢', '🟢'] },

            // Summer seeds
            'tomato': { name: 'Tomato', cost: 8, growthTime: 20000, harvestValue: 15, season: 'summer', stages: ['🌱', '🌿', '🍅', '🍅', '🍅'] },
            'corn': { name: 'Corn', cost: 12, growthTime: 25000, harvestValue: 20, season: 'summer', stages: ['🌱', '🌿', '🌽', '🌽', '🌽'] },
            'cucumber': { name: 'Cucumber', cost: 6, growthTime: 16000, harvestValue: 11, season: 'summer', stages: ['🌱', '🌿', '🥒', '🥒', '🥒'] },
            'zucchini': { name: 'Zucchini', cost: 9, growthTime: 22000, harvestValue: 16, season: 'summer', stages: ['🌱', '🌿', '🥒', '🥒', '🥒'] },
            'bell_pepper': { name: 'Bell Pepper', cost: 10, growthTime: 22000, harvestValue: 18, season: 'summer', stages: ['🌱', '🌿', '🫑', '🫑', '🫑'] },
            'avocado': { name: 'Avocado', cost: 14, growthTime: 32000, harvestValue: 26, season: 'summer', stages: ['🌱', '🌿', '🥑', '🥑', '🥑'] },
            'eggplant': { name: 'Eggplant', cost: 11, growthTime: 24000, harvestValue: 19, season: 'summer', stages: ['🌱', '🌿', '🍆', '🍆', '🍆'] },
            'hot_pepper': { name: 'Hot Pepper', cost: 9, growthTime: 22000, harvestValue: 18, season: 'summer', stages: ['🌱', '🌿', '🌶️', '🌶️', '🌶️'] },

            // Fall seeds
            'pumpkin': { name: 'Pumpkin', cost: 25, growthTime: 35000, harvestValue: 45, season: 'fall', stages: ['🌱', '🌿', '🎃', '🎃', '🎃'] },
            'squash': { name: 'Squash', cost: 15, growthTime: 28000, harvestValue: 25, season: 'fall', stages: ['🌱', '🌿', '🍠', '🍠', '🍠'] },
            'broccoli': { name: 'Broccoli', cost: 11, growthTime: 24000, harvestValue: 19, season: 'fall', stages: ['🌱', '🌿', '🥦', '🥦', '🥦'] },
            'cauliflower': { name: 'Cauliflower', cost: 14, growthTime: 26000, harvestValue: 22, season: 'fall', stages: ['🌱', '🌿', '🥦', '🥦', '🥦'] },
            'cabbage': { name: 'Cabbage', cost: 8, growthTime: 20000, harvestValue: 14, season: 'fall', stages: ['🌱', '🌿', '🥬', '🥬', '🥬'] },
            'sweet_potato': { name: 'Sweet Potato', cost: 9, growthTime: 24000, harvestValue: 16, season: 'fall', stages: ['🌱', '🌿', '🍠', '🍠', '🍠'] },

            // Winter seeds (greenhouse)
            'winter_greens': { name: 'Winter Greens', cost: 20, growthTime: 30000, harvestValue: 35, season: 'winter', stages: ['🌱', '🌿', '🥬', '🥬', '🥬'] },
            'herbs': { name: 'Herbs', cost: 15, growthTime: 25000, harvestValue: 28, season: 'winter', stages: ['🌿', '🌿', '🌿', '🌿', '🌿'] },

            // Year-round seeds
            'onion': { name: 'Onion', cost: 4, growthTime: 14000, harvestValue: 6, season: 'all', stages: ['🌱', '🌿', '🧅', '🧅', '🧅'] },
            'garlic': { name: 'Garlic', cost: 5, growthTime: 16000, harvestValue: 8, season: 'all', stages: ['🌱', '🌿', '🧄', '🧄', '🧄'] },
            'potato': { name: 'Potato', cost: 7, growthTime: 18000, harvestValue: 12, season: 'all', stages: ['🌱', '🌿', '🥔', '🥔', '🥔'] },
            'celery': { name: 'Celery', cost: 6, growthTime: 15000, harvestValue: 9, season: 'all', stages: ['🌱', '🌿', '🥬', '🥬', '🥬'] },
            'mushroom': { name: 'Mushroom', cost: 12, growthTime: 20000, harvestValue: 18, season: 'all', stages: ['🍄', '🍄', '🍄', '🍄', '🍄'] },

            // Orchard fruits
            'apple': { name: 'Apple', cost: 12, growthTime: 26000, harvestValue: 22, season: 'all', stages: ['🌱', '🌿', '🍎', '🍎', '🍎'] },
            'green_apple': { name: 'Green Apple', cost: 12, growthTime: 26000, harvestValue: 22, season: 'all', stages: ['🌱', '🌿', '🍏', '🍏', '🍏'] },
            'pear': { name: 'Pear', cost: 13, growthTime: 28000, harvestValue: 23, season: 'all', stages: ['🌱', '🌿', '🍐', '🍐', '🍐'] },
            'peach': { name: 'Peach', cost: 14, growthTime: 28000, harvestValue: 24, season: 'all', stages: ['🌱', '🌿', '🍑', '🍑', '🍑'] },
            'cherries': { name: 'Cherries', cost: 10, growthTime: 22000, harvestValue: 20, season: 'all', stages: ['🌱', '🌿', '🍒', '🍒', '🍒'] },
            'strawberry': { name: 'Strawberry', cost: 9, growthTime: 20000, harvestValue: 19, season: 'spring', stages: ['🌱', '🌿', '🍓', '🍓', '🍓'] },
            'orange': { name: 'Orange', cost: 11, growthTime: 26000, harvestValue: 22, season: 'summer', stages: ['🌱', '🌿', '🍊', '🍊', '🍊'] },
            'lemon': { name: 'Lemon', cost: 9, growthTime: 22000, harvestValue: 18, season: 'summer', stages: ['🌱', '🌿', '🍋', '🍋', '🍋'] },
            'banana': { name: 'Banana', cost: 11, growthTime: 26000, harvestValue: 23, season: 'summer', stages: ['🌱', '🌿', '🍌', '🍌', '🍌'] },

            // Rare seeds (available in multiple seasons)
            'watermelon': { name: 'Watermelon', cost: 22, growthTime: 32000, harvestValue: 38, season: 'summer', stages: ['🌱', '🌿', '🍉', '🍉', '🍉'], isRare: true },
            'melon': { name: 'Melon', cost: 18, growthTime: 30000, harvestValue: 30, season: 'summer', stages: ['🌱', '🌿', '🍈', '🍈', '🍈'], isRare: true },
            'blueberry': { name: 'Blueberry', cost: 17, growthTime: 26000, harvestValue: 29, season: 'summer', stages: ['🌱', '🌿', '🫐', '🫐', '🫐'], isRare: true },
            'kiwi': { name: 'Kiwi', cost: 22, growthTime: 34000, harvestValue: 38, season: 'fall', stages: ['🌱', '🌿', '🥝', '🥝', '🥝'], isRare: true },
            'coconut': { name: 'Coconut', cost: 24, growthTime: 36000, harvestValue: 42, season: 'summer', stages: ['🌱', '🌿', '🥥', '🥥', '🥥'], isRare: true },
            'olive': { name: 'Olive', cost: 21, growthTime: 32000, harvestValue: 36, season: 'fall', stages: ['🌱', '🌿', '🫒', '🫒', '🫒'], isRare: true },
            'asparagus': { name: 'Asparagus', cost: 13, growthTime: 26000, harvestValue: 21, season: 'spring', stages: ['🌱', '🌿', '🥬', '🥬', '🥬'], isRare: true },
            'artichoke': { name: 'Artichoke', cost: 16, growthTime: 32000, harvestValue: 28, season: 'fall', stages: ['🌱', '🌿', '🥬', '🥬', '🥬'], isRare: true },

            // Legendary seeds (available year-round but expensive)
            'grapes': { name: 'Grapes', cost: 22, growthTime: 34000, harvestValue: 36, season: 'all', stages: ['🌱', '🌿', '🍇', '🍇', '🍇'], isLegendary: true },
            'pineapple': { name: 'Pineapple', cost: 30, growthTime: 50000, harvestValue: 50, season: 'all', stages: ['🌱', '🌿', '🍍', '🍍', '🍍'], isLegendary: true },
            'mango': { name: 'Mango', cost: 28, growthTime: 48000, harvestValue: 45, season: 'all', stages: ['🌱', '🌿', '🥭', '🥭', '🥭'], isLegendary: true },
            'dragonfruit': { name: 'Dragonfruit', cost: 35, growthTime: 60000, harvestValue: 60, season: 'all', stages: ['🌱', '🌿', '🐲', '🐲', '🐉'], isLegendary: true }
        };
        
        // Game state
        this.selectedSeed = null;
        this.selectedSprinkler = null;
        this.selectedDecoration = null;
        this.currentTool = 'water';
        this.isRunning = true;
        
        // Garden grid setup
        this.gridSize = this.gardenSize;
        this.cellSize = Math.floor(600 / this.gridSize);
        
        // Adjust cell size for mobile devices
        if (window.innerWidth <= 768) {
            this.cellSize = Math.max(75, Math.floor(window.innerWidth * 0.8 / this.gridSize));
        }
        
        this.garden = this.initializeGarden();
        
        // Initialize canvas and context
        const canvasElement = document.getElementById('gardenCanvas');
        if (canvasElement) {
            this.canvas = canvasElement;
            this.ctx = this.canvas.getContext('2d');
        } else {
            this.canvas = null;
            this.ctx = null;
        }
        
        // Tool levels and upgrade costs
        this.toolLevels = {
            water: 1,
            fertilizer: 1,
            shovel: 1,
            harvest: 1
        };

        // Unified upgrade pricing model (much more expensive for game-changing tools)
        // cost(next level) = base * growth^(currentLevel - 1)
        this.toolUpgradeConfig = {
            // Expensive curve (one notch harsher)
            water:      { base: 200, growth: 2.6 },
            fertilizer: { base: 350, growth: 2.8 },
            harvest:    { base: 250, growth: 2.6 },
            shovel:     { base: 50,  growth: 1.6 }
        };

        this.toolUpgradeCosts = { water: 0, fertilizer: 0, shovel: 0, harvest: 0 };
        this.recomputeAllToolUpgradeCosts();

        // Base shop prices for essentials (used by dynamic pricing helpers)
        // Keep these modest; tool levels reduce price via getToolPriceMultiplier()
        this.waterPriceBase = Number.isFinite(this.waterPriceBase) ? this.waterPriceBase : 5;
        this.fertilizerPriceBase = Number.isFinite(this.fertilizerPriceBase) ? this.fertilizerPriceBase : 10;
        
        // Tool cooldowns
        this.toolCooldowns = {
            water: 0,
            fertilizer: 0
        };
        
        // Plant effects
        this.plantEffects = {
            watered: {},
            fertilized: {}
        };
        
        // Weather system
        this.weatherEffects = {
            sunny: { growthMultiplier: 1.0, name: 'Sunny' },
            rainy: { growthMultiplier: 1.5, name: 'Rainy' },
            cloudy: { growthMultiplier: 0.8, name: 'Cloudy' },
            stormy: { growthMultiplier: 2.0, name: 'Stormy' }
        };
        
        // Sprinkler system
        this.sprinklerTypes = {
            basic: { price: 50, range: 1, growthBonus: 0.2, waterBonus: 0, fertilizerBonus: 0, color: '#87CEEB', icon: '💧', description: '+20% growth, 1 tile range', duration: 120000 },
            advanced: { price: 150, range: 2, growthBonus: 0.4, waterBonus: 0.1, fertilizerBonus: 0, color: '#4A90E2', icon: '🌊', description: '+40% growth, +10% water efficiency, 2 tile range', duration: 180000 },
            premium: { price: 300, range: 2, growthBonus: 0.6, waterBonus: 0.2, fertilizerBonus: 0.1, color: '#9B59B6', icon: '🌈', description: '+60% growth, +20% water, +10% fertilizer, 2 tile range', duration: 240000 },
            legendary: { price: 500, range: 3, growthBonus: 0.8, waterBonus: 0.3, fertilizerBonus: 0.2, color: '#E74C3C', icon: '⭐', description: '+80% growth, +30% water, +20% fertilizer, 3 tile range', duration: 300000 }
        };
        
        // Decoration system
        this.decorations = {
            // Paths & Ground Decorations
            'stone_path': { name: 'Stone Path', cost: 25, type: 'path', icon: '🛣️', bonus: 'none', description: 'Beautiful stone pathway' },
            'wooden_path': { name: 'Wooden Path', cost: 15, type: 'path', icon: '🛤️', bonus: 'none', description: 'Rustic wooden walkway' },

            // Statues & Ornaments
            'garden_gnome': { name: 'Garden Gnome', cost: 100, type: 'statue', icon: '🧙', bonus: '+10% harvest value', description: 'Magical garden guardian' },
            'bird_bath': { name: 'Bird Bath', cost: 75, type: 'statue', icon: '🛁', bonus: '+15% water efficiency', description: 'Attracts helpful birds' },
            'sundial': { name: 'Sundial', cost: 200, type: 'statue', icon: '⏰', bonus: '+20% growth boost', description: 'Ancient time-keeping wisdom' },
            'crystal_fountain': { name: 'Crystal Fountain', cost: 250, type: 'statue', icon: '💎', bonus: '+15% water efficiency', description: 'Sparkling centerpiece' },

            // Fences & Borders
            'picket_fence': { name: 'Picket Fence', cost: 30, type: 'fence', icon: '🏡', bonus: '+5% plant protection', description: 'Classic garden border' },
            'stone_wall': { name: 'Stone Wall', cost: 80, type: 'fence', icon: '🧱', bonus: '+10% plant protection', description: 'Sturdy garden defense' },

            // Lighting & Ambience
            'fairy_lights': { name: 'Fairy Lights', cost: 60, type: 'decoration', icon: '✨', bonus: '+10% growth boost', description: 'Twinkling night ambience' },
            'fairy_lanterns': { name: 'Fairy Lanterns', cost: 90, type: 'decoration', icon: '🏮', bonus: '+12% growth boost', description: 'Soft glowing lights' },
            'butterfly_arch': { name: 'Butterfly Arch', cost: 220, type: 'decoration', icon: '🦋', bonus: '+20% growth boost', description: 'Welcoming pollinators' },

            // Seasonal Decorations
            'christmas_lights': { name: 'Christmas Lights', cost: 150, type: 'seasonal', icon: '🎄', bonus: '+25% winter growth', season: 'winter', description: 'Festive winter cheer' },
            'halloween_pumpkins': { name: 'Halloween Pumpkins', cost: 100, type: 'seasonal', icon: '🎃', bonus: '+20% harvest value', season: 'fall', description: 'Spooky fall decoration' },
            'spring_tulips': { name: 'Spring Tulips', cost: 60, type: 'seasonal', icon: '🌷', bonus: '+15% spring growth', season: 'spring', description: 'Fresh spring blooms' },
            'summer_sunflowers': { name: 'Summer Sunflowers', cost: 70, type: 'seasonal', icon: '🌻', bonus: '+15% summer growth', season: 'summer', description: 'Bright summer beauty' },
            'autumn_wreath': { name: 'Autumn Wreath', cost: 60, type: 'seasonal', icon: '🍂', bonus: '+15% harvest value', season: 'fall', description: 'Warm fall welcome' },

            // Flower Power (global boosts)
            'flower_bed': { name: 'Flower Bed', cost: 50, type: 'flower', icon: '🌸', bonus: '+10% growth boost', description: 'Attracts beneficial insects' },
            'blooming_meadow': { name: 'Blooming Meadow', cost: 180, type: 'flower', icon: '🌼', bonus: 'Global +35% growth boost', description: 'Global +35% growth boost', scope: 'global' },
            'rose_arcade': { name: 'Rose Arcade', cost: 220, type: 'flower', icon: '🌹', bonus: 'Global +30% harvest value', description: 'Global +30% harvest value', scope: 'global' },
            'hibiscus_sanctuary': { name: 'Hibiscus Sanctuary', cost: 240, type: 'flower', icon: '🌺', bonus: 'Global +25% water efficiency', description: 'Global +25% water efficiency', scope: 'global' },
            'rosette_topiary': { name: 'Rosette Topiary', cost: 210, type: 'flower', icon: '🏵️', bonus: 'Global +25% plant protection', description: 'Global +25% plant protection', scope: 'global' },
            'bouquet_cart': { name: 'Bouquet Cart', cost: 230, type: 'flower', icon: '💐', bonus: 'Global +20% growth boost', description: 'Global +20% growth boost', scope: 'global' },
            'lotus_pond': { name: 'Lotus Pond', cost: 300, type: 'flower', icon: '🪷', bonus: 'Global +40% growth aura', description: 'Global +40% growth aura', scope: 'global' },
            'hyacinth_grove': { name: 'Hyacinth Grove', cost: 250, type: 'flower', icon: '🪻', bonus: 'Global +30% water efficiency', description: 'Global +30% water efficiency', scope: 'global' },
            'white_blossom_circle': { name: 'White Blossom Circle', cost: 200, type: 'flower', icon: '💮', bonus: 'Global +20% plant protection', description: 'Global +20% plant protection', scope: 'global' },
            'eternal_bloom': { name: 'Eternal Bloom', cost: 260, type: 'flower', icon: '🥀', bonus: 'Global +25% harvest value', description: 'Global +25% harvest value', scope: 'global' }
        };
        
        // Auto-save system
        this.lastAutoSave = Date.now();
        this.autoSaveInterval = 60000; // 1 minute
        
        // Sound system
        this.audioContext = null;
        this.initializeSound();
        
        // Shop inventory (will be initialized in initializeFreshGame)
        this.shopInventory = {};
        
        // Restock system
        this.lastRestockTime = Date.now();
        this.restockInterval = 300000; // 5 minutes
        this.rareRestockChance = 0.25; // 25% chance for rare seeds
        this.legendaryRestockChance = 0.12; // 12% chance for legendary seeds
        
    // Softlock relief cadence and cap (guarantee blessing within 10–30s when softlocked)
    this.softlockCheckInterval = 10 * 1000; // every 10 seconds
    this.lastSoftlockCheck = Date.now();
    this.softlockMissCounter = 0; // counts consecutive eligible checks without blessing

    // Passive growth tuning
    this.passiveGrowthEnabled = true; // Allow slow growth without boosters
    this.passiveGrowthBaseMs = 60 * 1000; // Base: ~1 minute per stage (before multipliers)
    this.passiveIgnoreSeedMultiplier = true; // Universal rate across plants
    this.passiveIgnoreEnvMultipliers = true; // Ignore weather/season for passive growth
        

        
        // Only load game and initialize UI if we have a canvas (not for background processing)
        if (this.canvas) {
            this.loadGame();
            this.initializeEventListeners();
            this.initializeHoverTooltip();
            this.initializeAdminPanel();
            // Quick Seeds bar near the garden
            this.initializeQuickSeedsBar();
            // Bonuses UI and responsive layout around the garden
            this.initializeBonusesUI();
            this.setupResponsiveLayout();
            // Single pass UI initialization (removed duplicate calls)
            this.updateUI();
            this.updateToolDisplay();
            this.updateSprinklerDisplay();
            this.updateAchievementsDisplay();
            this.gameLoop();
        }
        
        // Initialize challenges
        this.generateChallenges();
    }
    
    initializeQuickSeedsBar() {
        this.seedRecent = Array.isArray(this.seedRecent) ? this.seedRecent : [];

        const qs = document.getElementById('quickSeedsBar');
        const qsList = document.getElementById('qsList');
        if (!qs || !qsList) return;

        const collapseBtn = document.getElementById('qsCollapseBtn');
        collapseBtn?.addEventListener('click', () => {
            const list = document.getElementById('qsList');
            if (!list) return;
            const expanded = collapseBtn.getAttribute('aria-expanded') !== 'false';
            if (expanded) {
                list.style.display = 'none';
                collapseBtn.textContent = '+';
                collapseBtn.setAttribute('aria-expanded', 'false');
            } else {
                list.style.display = 'grid';
                collapseBtn.textContent = '−';
                collapseBtn.setAttribute('aria-expanded', 'true');
            }
        });

        // Keyboard: 1–9 select visible seeds; F toggles favorite for selected seed
        document.addEventListener('keydown', (e) => {
            if (!this.canvas) return;
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
            if (e.key >= '1' && e.key <= '9') {
                const idx = Number(e.key) - 1;
                const items = Array.from(document.querySelectorAll('#qsList .qs-item'));
                const target = items[idx];
                if (target) {
                    const seed = target.getAttribute('data-seed');
                    if (seed) this.selectSeed(seed);
                }
            }
        });

        this.updateQuickSeedsBar();
    }

    getQuickSeedsList() {
        // Favorites (if any) should appear first in original favorite order
        const allSeeds = Object.keys(this.plantTypes);
        const hasInventory = this.shopInventory && Object.keys(this.shopInventory).length > 0;
        const available = allSeeds.filter(s => {
            if (!this.isSeedAvailable(s)) return false;
            // Only show seeds that are in stock when inventory is present
            if (hasInventory) {
                const inv = this.shopInventory[s];
                return !!inv && Number(inv.stock) > 0;
            }
            return true; // before inventory is ready, allow display
        });
        const favorites = (this.seedFavorites || []).filter(f => available.includes(f));

        // Remaining seeds excluding favorites, sorted by price ascending for discoverability
        const remaining = available.filter(s => !favorites.includes(s));
        const priced = remaining.map(s => ({ id: s, price: this.plantTypes[s]?.cost || 0 }));
        priced.sort((a, b) => (a.price || 0) - (b.price || 0));

        const ordered = [...favorites, ...priced.map(p => p.id)];
        return ordered.slice(0, 18);
    }

    updateQuickSeedsBar() {
        const qsList = document.getElementById('qsList');
        if (!qsList) return;
        const seeds = this.getQuickSeedsList();
        const html = seeds.map((seed) => {
            const plant = this.plantTypes[seed];
            const selected = this.selectedSeed === seed ? ' is-selected' : '';
            const isFav = (this.seedFavorites||[]).includes(seed);
            return `
                <button class="qs-item${selected}" type="button" data-seed="${seed}" role="listitem" aria-pressed="${this.selectedSeed === seed ? 'true' : 'false'}" title="${plant.name} ($${plant.cost})">
                    <span class="qs-icon">${plant.stages?.[2] || '🌱'}</span>
                    <span class="qs-name">${plant.name}</span>
                    <span class="qs-meta">$${plant.cost}</span>
                    <span class="qs-fav" data-fav="${isFav ? '1' : '0'}" aria-label="${isFav ? 'Unfavorite' : 'Favorite'} seed">${isFav ? '⭐' : '☆'}</span>
                </button>
            `;
        }).join('');
        qsList.innerHTML = html || '<div class="qs-empty">No seeds available right now.</div>';
        
        // Direct binding on buttons (defensive against any overlay/scroll quirks)
        const btns = qsList.querySelectorAll('.qs-item');
        btns.forEach((btn) => {
            btn.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                // Favorite toggle if star clicked
                const favEl = ev.target.closest('.qs-fav');
                if (favEl) {
                    const seed = btn.getAttribute('data-seed');
                    if (seed) this.toggleFavoriteSeed(seed);
                    return;
                }
                const seed = btn.getAttribute('data-seed');
                if (!seed) return;
                this.selectSeed(seed);
                this.seedRecent = [seed, ...(this.seedRecent||[]).filter(s => s!==seed)].slice(0, 8);
                this.saveGame();
                this.updateQuickSeedsBar();
            }, { once: true });
        });
        
        // Use event delegation for robust handling
        if (!qsList._qsDelegated) {
            qsList.addEventListener('click', (e) => {
                // Normalize target to an Element (Text nodes don't have .closest)
                const t = e.target && e.target.nodeType === 1 ? e.target : (e.target && e.target.parentElement ? e.target.parentElement : null);
                if (!t) return;
                const item = t.closest('.qs-item');
                if (item && qsList.contains(item)) {
                    e.preventDefault();
                    e.stopPropagation();
                    const seed = item.getAttribute('data-seed');
                    if (!seed) return;
                    const favEl = e.target && e.target.closest && e.target.closest('.qs-fav');
                    if (favEl) {
                        this.toggleFavoriteSeed(seed);
                        return;
                    }
                    this.selectSeed(seed);
                    this.seedRecent = [seed, ...(this.seedRecent||[]).filter(s => s!==seed)].slice(0, 8);
                    this.saveGame();
                    this.updateQuickSeedsBar();
                }
            });
            // Mark to avoid attaching multiple times
            qsList._qsDelegated = true;
        }
    }

    toggleFavoriteSeed(seed) {
        this.seedFavorites = Array.isArray(this.seedFavorites) ? this.seedFavorites : [];
        const i = this.seedFavorites.indexOf(seed);
        if (i >= 0) this.seedFavorites.splice(i, 1); else this.seedFavorites.unshift(seed);
        this.seedFavorites = Array.from(new Set(this.seedFavorites)).slice(0, 20);
        this.saveGame();
        this.updateQuickSeedsBar();
        this.refreshSeedItemsFavoriteIndicators();
    }

    refreshSeedItemsFavoriteIndicators() {
        const favoritesSet = new Set(this.seedFavorites || []);
        document.querySelectorAll('.seed-item').forEach(el => {
            const seed = el.getAttribute('data-seed');
            if (!seed) return;
            let favBtn = el.querySelector('.favorite-btn');
            if (!favBtn) return; // created elsewhere
            const isFav = favoritesSet.has(seed);
            favBtn.textContent = isFav ? '⭐' : '☆';
            favBtn.setAttribute('aria-label', isFav ? `Unfavorite ${seed}` : `Favorite ${seed}`);
            favBtn.dataset.fav = isFav ? '1' : '0';
        });
    }
    
    // ===== SEASONAL SYSTEM =====
    updateSeason() {
        // For new games, always start from Spring Day 1
        if (!this.seasonStartTime) {
            this.seasonStartTime = Date.now();
            this.currentSeason = 'spring';
            this.seasonDay = 1;
            this.updateSeasonMultiplier();
            return;
        }
        
        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        const daysSinceStart = Math.floor((now - this.seasonStartTime) / dayInMs);
        const seasonDay = (daysSinceStart % this.seasonLength) + 1;
        
        const seasons = ['spring', 'summer', 'fall', 'winter'];
        const seasonIndex = Math.floor(daysSinceStart / this.seasonLength) % 4;
        const newSeason = seasons[seasonIndex];
        
        if (newSeason !== this.currentSeason) {
            this.currentSeason = newSeason;
            this.seasonDay = 1;
            this.updateSeasonMultiplier();
            this.showMessage(`Season changed to ${this.currentSeason}!`, 'info');
            this.updateSeasonDisplay();
        } else {
            this.seasonDay = seasonDay;
        }
    }
    
    updateSeasonMultiplier() {
        const seasonMultipliers = {
            spring: 1.2, // 20% faster growth
            summer: 1.0, // Normal growth
            fall: 0.8,   // 20% slower growth
            winter: 0.6  // 40% slower growth
        };
        this.seasonMultiplier = seasonMultipliers[this.currentSeason] || 1.0;
    }
    
    isSeedAvailable(seedType) {
        const plant = this.plantTypes[seedType];
        if (!plant) return false;
        
        if (plant.season === 'all') return true;
        return plant.season === this.currentSeason;
    }
    
    // ===== PLANT GROWTH STAGES =====
    getPlantGrowthStage(plant) {
        if (!plant) return 0;
        
        // Plants now only grow through watering and fertilizing
        // Return the stored growth stage instead of calculating from time
        return plant.growthStage || 0;
    }
    
    getHarvestValue(plant) {
        const plantData = this.plantTypes[plant.type];
        if (!plantData) return 0;
        
        const baseValue = plantData.harvestValue;
        const stage = this.getPlantGrowthStage(plant);
        const stageMultiplier = this.stageMultipliers[stage] || 1.0;
        const decorationBonus = (plant.bonuses?.harvestValue || 0) / 100;
        const toolBonus = this.harvestBonus || 0;
        const rebirthMultiplier = 1 + this.getRebirthHarvestBonus();
        const prestigeMultiplier = 1 + this.getPrestigeHarvestBonus();
        return Math.floor(baseValue * stageMultiplier * (1 + decorationBonus) * (1 + toolBonus) * rebirthMultiplier * prestigeMultiplier);
    }

    formatKeyLabel(key) {
        if (!key) {
            return '';
        }
        return key
            .split('_')
            .filter(Boolean)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }

    formatPlantStageLabel(plant) {
        const totalStages = this.growthStages.length;
        const stageIndex = Math.min(Math.max(this.getPlantGrowthStage(plant), 0), totalStages - 1);
        const progressText = `${stageIndex + 1}/${totalStages}`;
        if (plant.isFullyGrown || stageIndex === totalStages - 1) {
            return `Fully Grown (${progressText})`;
        }
        const stageName = this.growthStages[stageIndex] || 'Stage';
        const formattedStage = stageName.charAt(0).toUpperCase() + stageName.slice(1);
        return `${formattedStage} (${progressText})`;
    }

    initializeHoverTooltip() {
        if (this.hoverTooltip && document.body.contains(this.hoverTooltip)) {
            return this.hoverTooltip;
        }

        let tooltip = document.getElementById('gardenTooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'gardenTooltip';
            tooltip.className = 'garden-tooltip';
            tooltip.setAttribute('role', 'status');
            tooltip.setAttribute('aria-live', 'polite');
            document.body.appendChild(tooltip);
        }

        tooltip.classList.remove('is-visible');
        tooltip.setAttribute('aria-hidden', 'true');

        this.hoverTooltip = tooltip;
        return tooltip;
    }

    showGardenTooltip(content, clientX, clientY) {
        const tooltip = this.initializeHoverTooltip();
        tooltip.innerHTML = content;
        tooltip.style.left = '-9999px';
        tooltip.style.top = '-9999px';
        tooltip.classList.add('is-visible');
        tooltip.removeAttribute('aria-hidden');
        this.positionGardenTooltip(clientX, clientY);
    }

    positionGardenTooltip(clientX, clientY) {
        const tooltip = this.hoverTooltip;
        if (!tooltip || typeof clientX !== 'number' || typeof clientY !== 'number') {
            return;
        }

        const tooltipRect = tooltip.getBoundingClientRect();
        const offset = 18;
        let left = clientX + offset;
        let top = clientY + offset;

        if (left + tooltipRect.width > window.innerWidth - 12) {
            left = window.innerWidth - tooltipRect.width - 12;
        }

        if (top + tooltipRect.height > window.innerHeight - 12) {
            top = clientY - offset - tooltipRect.height;
            if (top < 12) {
                top = 12;
            }
        }

        if (left < 12) {
            left = 12;
        }

        tooltip.style.left = `${Math.round(left)}px`;
        tooltip.style.top = `${Math.round(top)}px`;
    }

    hideGardenTooltip() {
        if (this.hoverTooltip) {
            this.hoverTooltip.classList.remove('is-visible');
            this.hoverTooltip.setAttribute('aria-hidden', 'true');
        }
        // Stop live tooltip updates
        this.stopTooltipProgressUpdater();
        this.currentHoverKey = null;
    }

    initializeToolQuickMenu() {
        if (!this.canvas) {
            return null;
        }

        if (this.toolQuickMenu && document.body.contains(this.toolQuickMenu)) {
            this.highlightQuickMenuSelection();
            return this.toolQuickMenu;
        }

        let menu = document.getElementById('toolQuickMenu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'toolQuickMenu';
            document.body.appendChild(menu);
        }

        menu.className = 'tool-quick-menu';
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-hidden', 'true');
        menu.style.left = '-9999px';
        menu.style.top = '-9999px';

        if (menu.dataset.quickMenuReady !== 'true') {
            menu.innerHTML = '';
            const fragment = document.createDocumentFragment();
            this.quickToolOptions.forEach(({ id, label, icon }) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'tool-quick-menu__item';
                button.dataset.tool = id;
                button.setAttribute('role', 'menuitem');
                button.innerHTML = `<span class='tool-quick-menu__icon'>${icon}</span><span class='tool-quick-menu__label'>${label}</span>`;
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.selectTool(id);
                });
                fragment.appendChild(button);
            });
            menu.appendChild(fragment);

            menu.addEventListener('contextmenu', (event) => event.preventDefault());
            menu.addEventListener('pointerdown', (event) => event.stopPropagation());
            menu.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    this.hideToolQuickMenu();
                }
            });

            menu.dataset.quickMenuReady = 'true';
        }

        this.toolQuickMenu = menu;
        this.highlightQuickMenuSelection();
        return menu;
    }

    highlightQuickMenuSelection() {
        if (!this.toolQuickMenu) {
            return;
        }

        const buttons = Array.from(this.toolQuickMenu.querySelectorAll('.tool-quick-menu__item'));
        buttons.forEach((button) => {
            const toolId = button.dataset.tool;
            if (toolId === this.currentTool) {
                button.classList.add('is-active');
            } else {
                button.classList.remove('is-active');
            }
        });
    }

    showToolQuickMenu(options = {}) {
        const menu = this.initializeToolQuickMenu();
        if (!menu) {
            return;
        }

        menu.style.left = '-9999px';
        menu.style.top = '-9999px';
        menu.classList.add('is-visible');
        menu.removeAttribute('aria-hidden');
        this.highlightQuickMenuSelection();

        const menuRect = menu.getBoundingClientRect();
        const padding = 12;
        let left;
        let top;

        if (options.anchorRect) {
            left = options.anchorRect.left + (options.anchorRect.width / 2) - (menuRect.width / 2);
            top = options.anchorRect.bottom + 10;
            if (top + menuRect.height > window.innerHeight - padding) {
                top = options.anchorRect.top - menuRect.height - 10;
            }
        } else {
            left = (typeof options.clientX === 'number' ? options.clientX : this.lastQuickMenuPosition.x) - (menuRect.width / 2);
            top = typeof options.clientY === 'number' ? options.clientY : this.lastQuickMenuPosition.y;
        }

        if (left + menuRect.width > window.innerWidth - padding) {
            left = window.innerWidth - menuRect.width - padding;
        }
        if (left < padding) {
            left = padding;
        }

        if (top + menuRect.height > window.innerHeight - padding) {
            top = window.innerHeight - menuRect.height - padding;
        }
        if (top < padding) {
            top = padding;
        }

        menu.style.left = `${Math.round(left)}px`;
        menu.style.top = `${Math.round(top)}px`;
        this.toolQuickMenuVisible = true;
        this.lastQuickMenuPosition = { x: left, y: top };

        if (options.fromToolbox && this.toolboxButton) {
            this.toolboxButton.setAttribute('aria-expanded', 'true');
        } else if (this.toolboxButton) {
            this.toolboxButton.setAttribute('aria-expanded', 'false');
        }
    }

    hideToolQuickMenu() {
        if (!this.toolQuickMenu) {
            if (this.toolboxButton) {
                this.toolboxButton.setAttribute('aria-expanded', 'false');
            }
            return;
        }

        this.toolQuickMenu.classList.remove('is-visible');
        this.toolQuickMenu.setAttribute('aria-hidden', 'true');
        this.toolQuickMenu.style.left = '-9999px';
        this.toolQuickMenu.style.top = '-9999px';
        this.toolQuickMenuVisible = false;

        if (this.toolboxButton) {
            this.toolboxButton.setAttribute('aria-expanded', 'false');
        }
    }

    updateHoverTooltipForCell(row, col, pointer) {
        if (!this.garden[row] || !this.garden[row][col]) {
            this.hideGardenTooltip();
            return;
        }

        const pointerX = pointer?.clientX;
        const pointerY = pointer?.clientY;
        if (typeof pointerX !== 'number' || typeof pointerY !== 'number') {
            this.hideGardenTooltip();
            return;
        }

        const cell = this.garden[row][col];
        const sprinklerAtCell = this.sprinklers.find(s => s.row === row && s.col === col);

        let tooltipKey = null;
        let tooltipContent = '';

        if (cell.plant) {
            const plantData = this.plantTypes[cell.plant.type];
            if (!plantData) {
                this.hideGardenTooltip();
                return;
            }

            const harvestValue = Math.max(0, this.getHarvestValue(cell.plant));
            const stageLabel = this.formatPlantStageLabel(cell.plant);
            const wateredFlag = cell.watered ? 1 : 0;
            const fertilizedFlag = cell.fertilized ? 1 : 0;
            tooltipKey = `plant:${row}:${col}:${cell.plant.type}:${cell.plant.growthStage}:${cell.plant.isFullyGrown ? 1 : 0}:${harvestValue}:${wateredFlag}:${fertilizedFlag}`;

            const statusLabels = [];
            if (cell.watered) {
                statusLabels.push('Watered');
            }
            if (cell.fertilized) {
                statusLabels.push('Fertilized');
            }
            const statusLine = statusLabels.length
                ? `<div class="garden-tooltip__status">${statusLabels.join(' & ')}</div>`
                : '';

            // Compute overall progress toward full maturity (0..1)
            const overallProgress = this.getPlantOverallProgress(row, col);
            const percent = Math.max(0, Math.min(100, Math.round(overallProgress * 100)));

            const progressMarkup = `
                <div class="garden-tooltip__progress" aria-label="Growth Progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
                    <div class="progress-track">
                        <div class="progress-fill" style="width:${percent}%"></div>
                    </div>
                    <div class="progress-label">${percent}% to full growth</div>
                </div>
            `;

            const plantLines = [
                `<div class="garden-tooltip__name">${plantData.name}</div>`,
                `<div class="garden-tooltip__meta">${stageLabel}</div>`,
                progressMarkup,
                statusLine,
                `<div class="garden-tooltip__value">Harvest Price: $${harvestValue.toLocaleString()}</div>`
            ];
            tooltipContent = plantLines.filter(Boolean).join('');
            // Start live progress updates while tooltip is visible
            this.startTooltipProgressUpdater(row, col);
        } else if (cell.decoration) {
            this.stopTooltipProgressUpdater();
            const decorationType = typeof cell.decoration === 'string' ? cell.decoration : cell.decoration.type;
            const decorationState = typeof cell.decoration === 'object' ? cell.decoration : { type: decorationType };
            const decorationData = this.decorations[decorationType];
            if (!decorationData) {
                this.hideGardenTooltip();
                return;
            }

            tooltipKey = `decoration:${row}:${col}:${decorationType}:${decorationState.active ? 1 : 0}`;
            const typeLabel = this.formatKeyLabel(decorationData.type) || 'Decoration';
            const bonusText = decorationData.bonus && decorationData.bonus.toLowerCase() !== 'none'
                ? decorationData.bonus
                : '';
            const descriptionText = decorationData.description || '';
            const decorationLines = [
                `<div class="garden-tooltip__name">${decorationData.icon ? `${decorationData.icon} ` : ''}${decorationData.name}</div>`,
                `<div class="garden-tooltip__meta">${typeLabel} Decoration</div>`,
                bonusText ? `<div class="garden-tooltip__note">${bonusText}</div>` : '',
                descriptionText ? `<div class="garden-tooltip__note">${descriptionText}</div>` : ''
            ];
            tooltipContent = decorationLines.filter(Boolean).join('');
        } else if (sprinklerAtCell) {
            const sprinklerData = this.sprinklerTypes[sprinklerAtCell.type];
            if (!sprinklerData) {
                this.hideGardenTooltip();
                return;
            }

            tooltipKey = `sprinkler:${row}:${col}:${sprinklerAtCell.type}`;
            const bonuses = [];
            if (sprinklerData.waterBonus) {
                bonuses.push(`Water +${Math.round(sprinklerData.waterBonus * 100)}%`);
            }
            if (sprinklerData.fertilizerBonus) {
                bonuses.push(`Fertilizer +${Math.round(sprinklerData.fertilizerBonus * 100)}%`);
            }

            const sprinklerLines = [
                `<div class="garden-tooltip__name">${sprinklerData.icon ? `${sprinklerData.icon} ` : ''}${this.formatKeyLabel(sprinklerAtCell.type)} Sprinkler</div>`,
                `<div class="garden-tooltip__meta">Range: ${sprinklerData.range} · Growth +${Math.round(sprinklerData.growthBonus * 100)}%</div>`,
                bonuses.length ? `<div class="garden-tooltip__note">${bonuses.join(' · ')}</div>` : ''
            ];
            tooltipContent = sprinklerLines.filter(Boolean).join('');
            this.stopTooltipProgressUpdater();
        } else {
            this.hideGardenTooltip();
            return;
        }

        if (!tooltipContent) {
            this.hideGardenTooltip();
            return;
        }

        if (this.currentHoverKey === tooltipKey && this.hoverTooltip?.classList.contains('is-visible')) {
            this.positionGardenTooltip(pointerX, pointerY);
        } else {
            this.currentHoverKey = tooltipKey;
            this.showGardenTooltip(tooltipContent, pointerX, pointerY);
        }
    }

    startTooltipProgressUpdater(row, col) {
        try {
            if (!this.hoverTooltip) return;
            this.tooltipProgressCell = { row, col };
            if (this.tooltipProgressTimer) return; // already running
            this.tooltipProgressTimer = setInterval(() => {
                if (!this.hoverTooltip || !this.hoverTooltip.classList.contains('is-visible')) {
                    this.stopTooltipProgressUpdater();
                    return;
                }
                const cellRef = this.tooltipProgressCell;
                if (!cellRef) return;
                const progressWrap = this.hoverTooltip.querySelector('.garden-tooltip__progress');
                if (!progressWrap) return;
                const fillEl = progressWrap.querySelector('.progress-fill');
                const labelEl = progressWrap.querySelector('.progress-label');
                const barEl = progressWrap;
                const value = Math.round(Math.max(0, Math.min(100, this.getPlantOverallProgress(cellRef.row, cellRef.col) * 100)));
                if (fillEl) fillEl.style.width = value + '%';
                if (labelEl) labelEl.textContent = `${value}% to full growth`;
                if (barEl) barEl.setAttribute('aria-valuenow', String(value));
            }, 200);
        } catch (e) {
            // fail safe: stop timer on error
            this.stopTooltipProgressUpdater();
        }
    }

    stopTooltipProgressUpdater() {
        if (this.tooltipProgressTimer) {
            clearInterval(this.tooltipProgressTimer);
            this.tooltipProgressTimer = null;
        }
        this.tooltipProgressCell = null;
    }

    // Compute 0..1 overall growth progress including fractional stage progress when possible
    getPlantOverallProgress(row, col) {
        const cell = this.garden?.[row]?.[col];
        if (!cell || !cell.plant) return 0;
        const totalStages = Math.max(1, this.growthStages.length);
        const maxIndex = totalStages - 1;
        const stageIndex = Math.min(Math.max(this.getPlantGrowthStage(cell.plant), 0), maxIndex);
        if (cell.plant.isFullyGrown || stageIndex >= maxIndex) return 1;

        const now = Date.now();
        let fractional = 0;

        // Try to infer fractional progress from the active growth mode
        // 1) Watered window
        if (cell.watered && cell.waterGrowthStart && cell.waterGrowthDuration && (now - cell.waterGrowthStart) < cell.waterGrowthDuration) {
            let growthTimePerStage = 2000; // base per water
            const seedType = cell.plant.type;
            if (!this.passiveIgnoreSeedMultiplier) {
                growthTimePerStage *= this.getSeedGrowthMultiplier(seedType);
            } else {
                // keep water growth as-is with seed multipliers – it's an active boost
                growthTimePerStage *= this.getSeedGrowthMultiplier(seedType);
            }
            const decorationGrowthBonus = (cell.plant.bonuses?.growth || 0) / 100;
            if (decorationGrowthBonus > 0) growthTimePerStage /= (1 + decorationGrowthBonus);
            const last = cell.lastWaterGrowthCheck || cell.waterGrowthStart;
            fractional = Math.max(0, Math.min(1, (now - last) / growthTimePerStage));
        }
        // 2) Fertilized window
        else if (cell.fertilized && cell.fertilizerGrowthStart && cell.fertilizerGrowthDuration && (now - cell.fertilizerGrowthStart) < cell.fertilizerGrowthDuration) {
            let growthTimePerStage = 1500; // base per fertilizer
            const seedType = cell.plant.type;
            growthTimePerStage *= this.getSeedGrowthMultiplier(seedType);
            const decorationGrowthBonus = (cell.plant.bonuses?.growth || 0) / 100;
            if (decorationGrowthBonus > 0) growthTimePerStage /= (1 + decorationGrowthBonus);
            const last = cell.lastFertilizerGrowthCheck || cell.fertilizerGrowthStart;
            fractional = Math.max(0, Math.min(1, (now - last) / growthTimePerStage));
        }
        // 3) Sprinkler growth (if in range)
        else {
            const sprinklerBonus = this.getSprinklerBonus(row, col);
            if (sprinklerBonus > 0 && cell.lastSprinklerGrowth) {
                let growthTimePerStage = 30000 / (1 + sprinklerBonus);
                const seedType = cell.plant.type;
                growthTimePerStage *= this.getSeedGrowthMultiplier(seedType);
                const decorationGrowthBonus = (cell.plant.bonuses?.growth || 0) / 100;
                if (decorationGrowthBonus > 0) growthTimePerStage /= (1 + decorationGrowthBonus);
                fractional = Math.max(0, Math.min(1, (now - cell.lastSprinklerGrowth) / growthTimePerStage));
            }
            // 4) Passive growth fallback
            else if (this.passiveGrowthEnabled) {
                let growthTimePerStage = Number.isFinite(this.passiveGrowthBaseMs) && this.passiveGrowthBaseMs > 0 ? this.passiveGrowthBaseMs : 60000;
                if (!this.passiveIgnoreSeedMultiplier) {
                    const seedType = cell.plant.type;
                    growthTimePerStage *= this.getSeedGrowthMultiplier(seedType);
                }
                if (!this.passiveIgnoreEnvMultipliers) {
                    const weatherMult = (this.weatherEffects[this.weather]?.growthMultiplier) || 1.0;
                    const seasonMult = this.seasonMultiplier || 1.0;
                    growthTimePerStage /= weatherMult;
                    growthTimePerStage /= seasonMult;
                }
                const anchor = cell.lastPassiveGrowth || cell.plantedAt || cell.plant.plantedAt || now;
                fractional = Math.max(0, Math.min(1, (now - anchor) / growthTimePerStage));
            }
        }

        const overall = (stageIndex + Math.max(0, Math.min(1, fractional))) / maxIndex;
        return Math.max(0, Math.min(1, overall));
    }

    getPointerPosition(event) {
        if (!event) {
            return null;
        }

        if (event.touches && event.touches.length > 0) {
            return {
                clientX: event.touches[0].clientX,
                clientY: event.touches[0].clientY
            };
        }

        if (event.changedTouches && event.changedTouches.length > 0) {
            return {
                clientX: event.changedTouches[0].clientX,
                clientY: event.changedTouches[0].clientY
            };
        }

        if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
            return {
                clientX: event.clientX,
                clientY: event.clientY
            };
        }

        return null;
    }

    getCellFromClientPosition(clientX, clientY) {
        if (!this.canvas || typeof clientX !== 'number' || typeof clientY !== 'number') {
            return null;
        }

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width ? this.canvas.width / rect.width : 1;
        const scaleY = rect.height ? this.canvas.height / rect.height : 1;
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        const gridWidth = this.gridSize * this.cellSize;
        const gridHeight = this.gridSize * this.cellSize;
        const offsetX = (this.canvas.width - gridWidth) / 2;
        const offsetY = (this.canvas.height - gridHeight) / 2;

        const adjustedX = x - offsetX;
        const adjustedY = y - offsetY;

        const col = Math.floor(adjustedX / this.cellSize);
        const row = Math.floor(adjustedY / this.cellSize);
        const withinGrid = row >= 0 && row < this.gridSize && col >= 0 && col < this.gridSize;

        return { row, col, withinGrid, adjustedX, adjustedY };
    }

    cancelTouchHover() {
        if (this.touchHoverTimer) {
            clearTimeout(this.touchHoverTimer);
            this.touchHoverTimer = null;
        }
        this.touchHoverActive = false;
        this.hideGardenTooltip();
    }
    
    // ===== GARDEN EXPANSION =====
    expandGarden() {
        const oldSize = this.gardenSize;
        if (oldSize >= this.maxGardenSize) {
            this.showMessage('Garden is already at maximum size!', 'error');
            return false;
        }
        
        if (this.money < this.expansionCost) {
            this.showMessage(`Not enough money! Need $${this.expansionCost}`, 'error');
            return false;
        }
        
        this.money -= this.expansionCost;
        // Expand by two tiles on every side (total +4 per dimension), but cap at maxGardenSize
        const proposed = oldSize + 4;
        const newSize = Math.min(this.maxGardenSize, proposed);
        this.gardenSize = newSize;
        this.gridSize = newSize;
        
        // Expand the garden array while preserving existing plants, centered in the new grid
        const oldGarden = this.garden;
        this.garden = this.initializeGarden();
        const delta = newSize - oldSize;
        const offset = Math.floor(delta / 2);
        for (let row = 0; row < oldSize; row++) {
            for (let col = 0; col < oldSize; col++) {
                const src = oldGarden[row][col];
                if (!src) continue;
                const dstRow = row + offset;
                const dstCol = col + offset;
                if (dstRow >= 0 && dstRow < newSize && dstCol >= 0 && dstCol < newSize) {
                    this.garden[dstRow][dstCol] = {
                        plant: src.plant,
                        decoration: src.decoration,
                        watered: src.watered,
                        wateredAt: src.wateredAt,
                        waterCooldown: src.waterCooldown,
                        fertilized: src.fertilized,
                        fertilizedAt: src.fertilizedAt,
                        fertilizerCooldown: src.fertilizerCooldown,
                        plantedAt: src.plantedAt
                    };
                }
            }
        }

        // Shift existing sprinkler coordinates so the layout grows in all directions evenly
        if (Array.isArray(this.sprinklers) && this.sprinklers.length) {
            this.sprinklers = this.sprinklers.map(s => ({
                ...s,
                row: Math.min(newSize - 1, Math.max(0, s.row + offset)),
                col: Math.min(newSize - 1, Math.max(0, s.col + offset))
            }));
        }
        
        // Update expansion cost for next expansion
        this.expansionCost = Math.floor(this.expansionCost * 1.3);
        
        // Update expansion challenge progress
        this.updateChallengeProgress('expansion', 1);
        
        // Resize canvas and cell size to tightly fit the new grid without large borders
        this.adjustCanvasForMobile();
        this.showMessage(`Garden expanded to ${this.gardenSize}x${this.gardenSize}!`, 'success');
        this.updateUI();
        this.draw();
        this.saveGame();
        return true;
    }
    
    // ===== GARDEN CHALLENGES =====
    generateChallenges() {
        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000;
        const currentDay = Math.floor(now / dayInMs);

        if (!this.challenges || typeof this.challenges !== 'object') {
            this.challenges = { daily: [], weekly: null, completed: [] };
        }

        if (!Array.isArray(this.challenges.daily)) {
            const legacyDaily = this.challenges.daily;
            this.challenges.daily = [];
            if (legacyDaily && typeof legacyDaily === 'object') {
                const legacyCollected = legacyDaily.collected !== undefined ? legacyDaily.collected : legacyDaily.rewardCollected;
                const migratedDaily = {
                    ...legacyDaily,
                    id: legacyDaily.id || `daily-${currentDay}-${Math.random().toString(36).slice(2, 8)}`,
                    completed: !!legacyDaily.completed
                };
                if (legacyCollected !== undefined) {
                    migratedDaily.collected = legacyCollected;
                }
                this.challenges.daily.push(migratedDaily);
            }
        }

        if (!Array.isArray(this.challenges.completed)) {
            this.challenges.completed = [];
        }

        this.challenges.daily = this.challenges.daily
            .filter(challenge => challenge && challenge.day === currentDay)
            .map(challenge => {
                const collectedFlag = challenge.collected !== undefined ? !!challenge.collected : !!challenge.completed;
                return {
                    ...challenge,
                    type: 'daily',
                    id: challenge.id || `daily-${currentDay}-${Math.random().toString(36).slice(2, 8)}`,
                    progress: Math.min(challenge.progress || 0, challenge.target),
                    completed: !!challenge.completed,
                    collected: collectedFlag
                };
            });

        const existingTypes = new Set(this.challenges.daily.map(challenge => challenge.challengeType));
        while (this.challenges.daily.length < 3) {
            const newChallenge = this.createDailyChallenge(currentDay, existingTypes);
            existingTypes.add(newChallenge.challengeType);
            this.challenges.daily.push(newChallenge);
        }

        const weekInMs = 7 * dayInMs;
        const currentWeek = Math.floor(now / weekInMs);

        if (!this.challenges.weekly || this.challenges.weekly.week !== currentWeek) {
            this.challenges.weekly = this.createWeeklyChallenge(currentWeek);
        } else {
            const weeklyCollected = this.challenges.weekly.collected !== undefined ? !!this.challenges.weekly.collected : !!this.challenges.weekly.completed;
            this.challenges.weekly = {
                ...this.challenges.weekly,
                type: 'weekly',
                id: this.challenges.weekly.id || `weekly-${currentWeek}-${Math.random().toString(36).slice(2, 8)}`,
                progress: Math.min(this.challenges.weekly.progress || 0, this.challenges.weekly.target),
                completed: !!this.challenges.weekly.completed,
                collected: weeklyCollected,
                week: currentWeek
            };
        }
    }

    createDailyChallenge(currentDay, existingTypes = new Set()) {
        const challenges = [
            { challengeType: 'harvest', target: 20, description: 'Harvest 20 plants', reward: 75 },
            { challengeType: 'plant', target: 25, description: 'Plant 25 seeds', reward: 60 },
            { challengeType: 'water', target: 30, description: 'Water 30 plants', reward: 55 },
            { challengeType: 'money', target: 400, description: 'Earn $400', reward: 80 },
            { challengeType: 'rare', target: 4, description: 'Harvest 4 rare plants', reward: 120 },
            { challengeType: 'fertilize', target: 10, description: 'Fertilize 10 plants', reward: 70 }
        ];

        const available = challenges.filter(challenge => !existingTypes.has(challenge.challengeType));
        const pool = available.length > 0 ? available : challenges;
        const challenge = pool[Math.floor(Math.random() * pool.length)];

        return {
            id: `daily-${currentDay}-${Math.random().toString(36).slice(2, 8)}`,
            type: 'daily',
            challengeType: challenge.challengeType,
            target: challenge.target,
            description: challenge.description,
            reward: challenge.reward,
            day: currentDay,
            progress: 0,
            completed: false,
            collected: false
        };
    }

    createWeeklyChallenge(currentWeek) {
        const challenges = [
            { challengeType: 'harvest', target: 120, description: 'Harvest 120 plants', reward: 600 },
            { challengeType: 'plant', target: 160, description: 'Plant 160 seeds', reward: 500 },
            { challengeType: 'money', target: 3000, description: 'Earn $3000', reward: 700 },
            { challengeType: 'legendary', target: 8, description: 'Harvest 8 legendary plants', reward: 900 },
            { challengeType: 'expansion', target: 2, description: 'Expand your garden twice', reward: 800 }
        ];

        const challenge = challenges[Math.floor(Math.random() * challenges.length)];
        return {
            id: `weekly-${currentWeek}-${Math.random().toString(36).slice(2, 8)}`,
            type: 'weekly',
            challengeType: challenge.challengeType,
            target: challenge.target,
            description: challenge.description,
            reward: challenge.reward,
            week: currentWeek,
            progress: 0,
            completed: false,
            collected: false
        };
    }

    updateChallengeProgress(type, amount = 1) {
        if (!this.challenges) {
            return;
        }

        const applyProgress = (challenge) => {
            if (!challenge || challenge.challengeType !== type || challenge.completed) {
                return;
            }
            challenge.progress = Math.min((challenge.progress || 0) + amount, challenge.target);
            if (challenge.progress >= challenge.target) {
                this.completeChallenge(challenge);
            }
        };

        if (Array.isArray(this.challenges.daily)) {
            this.challenges.daily.forEach(applyProgress);
        }

        if (this.challenges.weekly) {
            applyProgress(this.challenges.weekly);
        }
    }

    completeChallenge(challenge) {
        if (!challenge || challenge.completed) {
            return;
        }

        challenge.completed = true;
        this.showMessage('Challenge complete! Tap to collect your reward.', 'success');
        this.updateChallengesDisplay();
        this.saveGame();
    }

    collectChallengeReward(challengeId, type) {
        let challenge = null;
        if (type === 'daily' && Array.isArray(this.challenges.daily)) {
            challenge = this.challenges.daily.find(item => item.id === challengeId);
        } else if (type === 'weekly' && this.challenges.weekly && this.challenges.weekly.id === challengeId) {
            challenge = this.challenges.weekly;
        }

        if (!challenge || !challenge.completed || challenge.collected) {
            return;
        }

        challenge.collected = true;
        this.money += challenge.reward;
        this.stats.totalMoneyEarned = (this.stats.totalMoneyEarned || 0) + challenge.reward;

        if (Array.isArray(this.challenges.completed)) {
            this.challenges.completed.push({ ...challenge, collectedAt: Date.now() });
            if (this.challenges.completed.length > 50) {
                this.challenges.completed = this.challenges.completed.slice(-50);
            }
        }

        this.showMessage(`Collected $${challenge.reward} from ${type} challenge!`, 'success');
        this.updateUI();
        this.saveGame();
    }
    
    // ===== VISUAL FEEDBACK =====
    addParticle(x, y, type, value) {
        this.particles.push({
            x: x,
            y: y,
            type: type,
            value: value,
            life: 90, // 90 frames for longer visibility
            maxLife: 90,
            vx: (Math.random() - 0.5) * 3,
            vy: -3 - Math.random() * 2,
            scale: 1 + Math.random() * 0.5 // Random size variation
        });
    }

    // Apply all currently placed global decoration bonuses to a specific cell's plant
    applyAllGlobalBonusesToCell(row, col) {
        const cell = this.garden?.[row]?.[col];
        if (!cell || !cell.plant) return;
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const deco = this.garden?.[y]?.[x]?.decoration;
                if (!deco) continue;
                const data = this.decorations?.[deco.type];
                if (!data || data.bonus === 'none') continue;
                if (data.scope === 'global') {
                    this.applyPlantBonus(row, col, data.bonus);
                }
            }
        }
    }

    // Gentle, soft particle burst for subtle, round feedback at (x, y)
    // kind: 'plant' | 'water' | 'fertilizer' | 'harvest' | 'sprinkler' | 'decoration' | 'remove'
    // count: small number of dots to spawn
    spawnGentleBurst(x, y, kind = 'plant', count = 12) {
        const palette = this.getBurstPalette(kind);
        // Cap count for mobile and when particle buffer is large
        const maxParticles = this.isMobileDevice ? 120 : 250;
        if (Array.isArray(this.particles) && this.particles.length > maxParticles) {
            return; // avoid overdraw on mobile/low-end
        }
        const capped = this.isMobileDevice ? Math.min(count, 8) : count;
        for (let i = 0; i < capped; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.2 + Math.random() * 1.8; // higher velocity outward
            const life = 50 + Math.floor(Math.random() * 20); // 50–70 frames
            const radius = (this.isMobileDevice ? 1.4 : 1.8) + Math.random() * (this.isMobileDevice ? 1.6 : 2.2); // smaller on mobile
            const color = palette[(Math.random() * palette.length) | 0];
            this.particles.push({
                x,
                y,
                type: 'soft',
                life,
                maxLife: life,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                ax: 0,
                ay: 0.01, // a hint of floaty drift
                radius,
                color,
                softness: this.isMobileDevice ? (4 + Math.random() * 6) : (10 + Math.random() * 10)
            });
        }
    }

    // Pastel palettes per interaction kind
    getBurstPalette(kind) {
        switch (kind) {
            case 'water':
                return ['#7EC8E3', '#9ED9F5', '#B3E5FC'];
            case 'fertilizer':
                return ['#99D98C', '#B5E48C', '#A7D47D'];
            case 'harvest':
                return ['#FFD166', '#FFE08A', '#FFECB3'];
            case 'sprinkler':
                return ['#4895EF', '#4CC9F0', '#90E0EF'];
            case 'decoration':
                return ['#F7A8B8', '#FFCCD5', '#FFC4E1'];
            case 'remove':
                return ['#C7BEB3', '#A68A64', '#B8A89A'];
            case 'plant':
            default:
                return ['#7ED957', '#A1E89B', '#C6F6C8'];
        }
    }
    
    updateParticles() {
        this.particles = this.particles.filter(particle => {
            // basic physics
            if (typeof particle.ax === 'number') particle.vx += particle.ax;
            if (typeof particle.ay === 'number') particle.vy += particle.ay;
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life--;
            return particle.life > 0;
        });
    }
    
    drawParticles() {
        if (!this.ctx) return;
        
        this.particles.forEach(particle => {
            const alpha = particle.life / particle.maxLife;
            this.ctx.save();
            this.ctx.globalAlpha = alpha;
            
            // Different colors and styles for different particle types
            switch (particle.type) {
                case 'soft': {
                    // soft pastel dots, more opaque and higher velocity already handled
                    const r = particle.radius || 2.5;
                    const color = particle.color || '#ffffff';
                    // Use normal compositing for a more solid look
                    this.ctx.globalCompositeOperation = 'source-over';
                    // Force near-opaque alpha to reduce translucency
                    this.ctx.globalAlpha = 0.95;
                    this.ctx.fillStyle = color;
                    // Reduce or remove heavy blur on mobile to improve perf
                    if (this.isMobileDevice) {
                        this.ctx.shadowColor = 'transparent';
                        this.ctx.shadowBlur = 0;
                    } else {
                        this.ctx.shadowColor = color;
                        this.ctx.shadowBlur = Math.max(4, (particle.softness || 12) * 0.5);
                    }
                    this.ctx.beginPath();
                    this.ctx.arc(particle.x, particle.y, r, 0, Math.PI * 2);
                    this.ctx.fill();
                    break;
                }
                case 'money':
                    this.ctx.fillStyle = '#FFD700';
                    this.ctx.strokeStyle = '#FFA500';
                    this.ctx.lineWidth = 2;
                    this.ctx.font = `${Math.floor(16 * (particle.scale || 1))}px Arial`;
                    this.ctx.fillText(`+$${particle.value}`, particle.x, particle.y);
                    this.ctx.strokeText(`+$${particle.value}`, particle.x, particle.y);
                    break;
                case 'water':
                    this.ctx.fillStyle = '#87CEEB';
                    this.ctx.font = `${Math.floor(20 * (particle.scale || 1))}px Arial`;
                    this.ctx.fillText('💧', particle.x, particle.y);
                    break;
                case 'fertilizer':
                    this.ctx.fillStyle = '#FFD700';
                    this.ctx.font = `${Math.floor(20 * (particle.scale || 1))}px Arial`;
                    this.ctx.fillText('🌱', particle.x, particle.y);
                    break;
                case 'plant':
                    this.ctx.fillStyle = '#32CD32';
                    this.ctx.font = `${Math.floor(20 * (particle.scale || 1))}px Arial`;
                    this.ctx.fillText('🌱', particle.x, particle.y);
                    break;
                case 'upgrade':
                    this.ctx.fillStyle = '#FF6B6B';
                    this.ctx.font = `${Math.floor(24 * (particle.scale || 1))}px Arial`;
                    this.ctx.fillText('⬆️', particle.x, particle.y);
                    break;
                case 'sprinkler':
                    this.ctx.fillStyle = '#4A90E2';
                    this.ctx.font = `${Math.floor(20 * (particle.scale || 1))}px Arial`;
                    this.ctx.fillText('💧', particle.x, particle.y);
                    break;
                case 'decoration':
                    this.ctx.fillStyle = '#FF69B4';
                    this.ctx.font = `${Math.floor(24 * (particle.scale || 1))}px Arial`;
                    this.ctx.fillText(particle.value, particle.x, particle.y);
                    break;
                case 'damage':
                    this.ctx.fillStyle = '#FF4444';
                    this.ctx.font = `${Math.floor(20 * (particle.scale || 1))}px Arial`;
                    this.ctx.fillText('💥', particle.x, particle.y);
                    break;
                default:
                    this.ctx.fillStyle = '#00FF00';
                    this.ctx.font = `${Math.floor(16 * (particle.scale || 1))}px Arial`;
                    this.ctx.fillText(`+${particle.value}`, particle.x, particle.y);
            }
            
            this.ctx.restore();
        });
    }
    
    // ===== GARDEN STATISTICS =====
    updateStats(type, amount = 1) {
        switch (type) {
            case 'harvest':
                this.stats.totalPlantsHarvested += amount;
                break;
            case 'money':
                this.stats.totalMoneyEarned += amount;
                if (amount > this.stats.bestHarvest) {
                    this.stats.bestHarvest = amount;
                }
                break;
            case 'water':
                this.stats.totalWaterUsed += amount;
                break;
            case 'fertilizer':
                this.stats.totalFertilizerUsed += amount;
                break;
            case 'plant':
                const plantType = amount;
                this.stats.plantsByType[plantType] = (this.stats.plantsByType[plantType] || 0) + 1;
                break;
        }
    }
    
    updateSessionTime() {
        const now = Date.now();
        const sessionTime = now - this.stats.sessionStartTime;
        if (sessionTime > this.stats.longestPlaySession) {
            this.stats.longestPlaySession = sessionTime;
        }
    }
    
    // ===== SOUND EFFECTS =====
    initializeSound() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            this.soundEnabled = false;
        }
    }
    
    playSound(type) {
        if (!this.soundEnabled || !this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        const sounds = {
            harvest: { frequency: 800, duration: 0.2 },
            plant: { frequency: 600, duration: 0.15 },
            water: { frequency: 400, duration: 0.1 },
            money: { frequency: 1000, duration: 0.3 },
            upgrade: { frequency: 1200, duration: 0.4 }
        };
        
        const sound = sounds[type];
        if (sound) {
            oscillator.frequency.setValueAtTime(sound.frequency, this.audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + sound.duration);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + sound.duration);
        }
    }
    
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        this.showMessage(`Sound ${this.soundEnabled ? 'enabled' : 'disabled'}!`, 'success');
        this.saveGame();
        
        // Update button text
        const soundBtn = document.getElementById('soundBtn');
        if (soundBtn) {
            soundBtn.textContent = this.soundEnabled ? '🔊 Sound' : '🔇 Sound';
        }
    }
    
    initializeGarden() {
        const garden = [];
        for (let row = 0; row < this.gridSize; row++) {
            garden[row] = [];
            for (let col = 0; col < this.gridSize; col++) {
                garden[row][col] = {
                    plant: null,
                    sprinkler: null,
                    decoration: null,
                    watered: false,
                    wateredAt: null,
                    waterCooldown: 0,
                    fertilized: false,
                    fertilizedAt: null,
                    fertilizerCooldown: 0,
                    plantedAt: null
                };
            }
        }
        return garden;
    }
    
    initializeEventListeners() {
        if (!this.canvas) {
            return;
        }
        
        // Remove any existing event listeners first
        this.removeEventListeners();
        
        // Adjust canvas size for mobile devices
        this.adjustCanvasForMobile();

        // Prepare quick tool access UI
        this.initializeToolQuickMenu();
        this.toolboxButton = document.getElementById('toolboxToggle') || null;
        if (this.toolboxButton) {
            this.toolboxButton.setAttribute('aria-expanded', this.toolQuickMenuVisible ? 'true' : 'false');
        }
        this.hideToolQuickMenu();
        
        // Helper function to add event listeners and track them
        const addBtnListener = (element, event, handler) => {
            if (element) {
                // Remove any existing listeners first to prevent duplicates
                element.removeEventListener(event, handler);
                element.addEventListener(event, handler);
                this.eventListeners.push({ element, event, handler });
            }
        };
        
        // Canvas event listeners
        addBtnListener(this.canvas, 'click', (e) => this.handleCanvasClick(e));
        addBtnListener(this.canvas, 'mousemove', (e) => this.handleMouseMove(e));
        addBtnListener(this.canvas, 'mouseleave', () => this.hideGardenTooltip());
        addBtnListener(this.canvas, 'contextmenu', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const pointer = this.getPointerPosition(event);
            if (!pointer) {
                this.hideToolQuickMenu();
                return;
            }
            const cellInfo = this.getCellFromClientPosition(pointer.clientX, pointer.clientY);
            if (!cellInfo || !cellInfo.withinGrid) {
                this.hideToolQuickMenu();
                return;
            }
            this.hideGardenTooltip();
            this.showToolQuickMenu({ clientX: pointer.clientX, clientY: pointer.clientY });
        });
        
        // Touch event listeners for mobile
        let touchStartTime = 0;
        let touchStartPos = { x: 0, y: 0 };
        const TOUCH_HOLD_DELAY = 450;
        
        addBtnListener(this.canvas, 'touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            touchStartPos.x = touch.clientX - rect.left;
            touchStartPos.y = touch.clientY - rect.top;
            touchStartTime = Date.now();
            this.lastTouchPointer = { clientX: touch.clientX, clientY: touch.clientY };

            this.cancelTouchHover();
            this.touchHoverTimer = setTimeout(() => {
                this.touchHoverTimer = null;
                this.touchHoverActive = true;
                const pointer = { ...this.lastTouchPointer };
                const cellInfo = this.getCellFromClientPosition(pointer.clientX, pointer.clientY);
                if (cellInfo && cellInfo.withinGrid) {
                    this.updateHoverTooltipForCell(cellInfo.row, cellInfo.col, pointer);
                }
            }, TOUCH_HOLD_DELAY);
        });
        
        addBtnListener(this.canvas, 'touchmove', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const touch = e.touches[0];
            if (touch) {
                this.lastTouchPointer = { clientX: touch.clientX, clientY: touch.clientY };
            }
            this.handleMouseMove(e);
        });
        
        addBtnListener(this.canvas, 'touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.cancelTouchHover();
            
            // Only trigger click if it's a short tap (not a scroll)
            const touchEndTime = Date.now();
            const touchDuration = touchEndTime - touchStartTime;
            const touch = e.changedTouches[0];
            
            if (touchDuration < 300 && touch) { // Less than 300ms = tap
                const rect = this.canvas.getBoundingClientRect();
                const x = touch.clientX - rect.left;
                const y = touch.clientY - rect.top;
                
                // Check if touch ended near where it started (to avoid scroll-triggered clicks)
                const distance = Math.sqrt(
                    Math.pow(x - touchStartPos.x, 2) + Math.pow(y - touchStartPos.y, 2)
                );
                
                if (distance < 20) { // Less than 20px movement = tap
                    this.handleCanvasClick({ 
                        clientX: touch.clientX, 
                        clientY: touch.clientY,
                        touches: [touch]
                    });
                }
            }
        });

        addBtnListener(this.canvas, 'touchcancel', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.cancelTouchHover();
        });
        
        // Fallback touch event for better mobile compatibility
        addBtnListener(this.canvas, 'click', (e) => {
            // This will handle both mouse clicks and touch events that bubble up
        });
        
        // Sidebar accordion interactions
        const accordionButtons = Array.from(document.querySelectorAll('.accordion-trigger'));
        accordionButtons.forEach((button) => {
            const controlsId = button.getAttribute('aria-controls');
            if (!controlsId) {
                return;
            }

            const panel = document.getElementById(controlsId);
            if (!panel) {
                return;
            }

            const setAccordionState = (isExpanded) => {
                button.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
                panel.classList.toggle('is-open', isExpanded);
                panel.setAttribute('aria-hidden', isExpanded ? 'false' : 'true');
                if (isExpanded) {
                    panel.removeAttribute('hidden');
                } else {
                    panel.setAttribute('hidden', '');
                }
            };

            const initialExpanded = button.getAttribute('aria-expanded') === 'true';
            setAccordionState(initialExpanded);

            addBtnListener(button, 'click', () => {
                const isCurrentlyExpanded = button.getAttribute('aria-expanded') === 'true';
                setAccordionState(!isCurrentlyExpanded);
            });
        });

        // Tooltip interactions for info buttons
        const tooltipButtons = Array.from(document.querySelectorAll('.info-trigger'));

        const closeAllTooltips = () => {
            tooltipButtons.forEach((btn) => {
                const tooltipId = btn.getAttribute('aria-controls');
                const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
                btn.setAttribute('aria-expanded', 'false');
                if (tooltip) {
                    tooltip.classList.remove('is-visible');
                    tooltip.setAttribute('hidden', '');
                }
            });
        };

        tooltipButtons.forEach((button) => {
            const tooltipId = button.getAttribute('aria-controls');
            const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
            if (!tooltip) {
                return;
            }

            tooltip.setAttribute('hidden', '');
            tooltip.classList.remove('is-visible');
            button.setAttribute('aria-expanded', 'false');

            addBtnListener(button, 'click', (event) => {
                event.preventDefault();
                const isExpanded = button.getAttribute('aria-expanded') === 'true';
                if (!isExpanded) {
                    closeAllTooltips();
                    button.setAttribute('aria-expanded', 'true');
                    tooltip.classList.add('is-visible');
                    tooltip.removeAttribute('hidden');
                } else {
                    button.setAttribute('aria-expanded', 'false');
                    tooltip.classList.remove('is-visible');
                    tooltip.setAttribute('hidden', '');
                }
            });
        });

        addBtnListener(document, 'click', (event) => {
            if (event.target.closest('.info-trigger') || event.target.closest('.tooltip-card')) {
                return;
            }
            closeAllTooltips();
        });

        addBtnListener(document, 'keydown', (event) => {
            if (event.key === 'Escape') {
                closeAllTooltips();
                this.hideToolQuickMenu();
            }
        });

        addBtnListener(document, 'click', (event) => {
            if (!this.toolQuickMenuVisible) {
                return;
            }
            const clickedMenu = this.toolQuickMenu && this.toolQuickMenu.contains(event.target);
            const clickedToggle = this.toolboxButton && this.toolboxButton.contains(event.target);
            if (clickedMenu || clickedToggle) {
                return;
            }
            this.hideToolQuickMenu();
        });

        addBtnListener(window, 'resize', () => this.hideToolQuickMenu());

        // Seed selection
        // Enhance seed items with favorite buttons and selection behavior
        this.enhanceSeedItems();
        document.querySelectorAll('.seed-item').forEach(item => {
            addBtnListener(item, 'click', (e) => {
                if (e && e.target && (e.target.classList.contains('favorite-btn') || e.target.closest('.favorite-btn'))) {
                    return; // handled by favorite button
                }
                this.selectSeed(item.dataset.seed);
            });
        });

        // Seed search and shop controls
        const seedSearchInput = document.getElementById('seedSearchInput');
        if (seedSearchInput) {
            addBtnListener(seedSearchInput, 'input', (e) => {
                const q = (e.target && e.target.value) || '';
                this.filterSeeds(q);
            });
        }
        const collapseAllBtn = document.getElementById('shopCollapseAllBtn');
        const expandAllBtn = document.getElementById('shopExpandAllBtn');
        if (collapseAllBtn) {
            addBtnListener(collapseAllBtn, 'click', () => this.setAllShopAccordions(false));
        }
        if (expandAllBtn) {
            addBtnListener(expandAllBtn, 'click', () => this.setAllShopAccordions(true));
        }

        if (this.toolboxButton) {
            addBtnListener(this.toolboxButton, 'click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (this.toolQuickMenuVisible && this.toolboxButton.getAttribute('aria-expanded') === 'true') {
                    this.hideToolQuickMenu();
                } else {
                    const rect = this.toolboxButton.getBoundingClientRect();
                    this.showToolQuickMenu({ anchorRect: rect, fromToolbox: true });
                }
            });
        }
        
        // Tool selection
        addBtnListener(document.getElementById('water-btn'), 'click', () => {
            this.selectTool('water');
        });
        addBtnListener(document.getElementById('fertilizer-btn'), 'click', () => {
            this.selectTool('fertilizer');
        });
        addBtnListener(document.getElementById('harvest-btn'), 'click', () => {
            this.selectTool('harvest');
        });
        addBtnListener(document.getElementById('shovel-btn'), 'click', () => {
            this.selectTool('shovel');
        });
        
        // Tool upgrade buttons
        addBtnListener(document.getElementById('upgrade-water-btn'), 'click', () => this.upgradeTool('water'));
        addBtnListener(document.getElementById('upgrade-fertilizer-btn'), 'click', () => this.upgradeTool('fertilizer'));
        addBtnListener(document.getElementById('upgrade-shovel-btn'), 'click', () => this.upgradeTool('shovel'));
        
        // Garden expansion button
        addBtnListener(document.getElementById('expandBtn'), 'click', () => this.expandGarden());
        addBtnListener(document.getElementById('expandShopBtn'), 'click', () => this.expandGarden());
        addBtnListener(document.getElementById('upgrade-harvest-btn'), 'click', () => this.upgradeTool('harvest'));
        addBtnListener(document.getElementById('rebirthBtn'), 'click', () => this.handleRebirthClick());
        
        // Sound toggle button
        addBtnListener(document.getElementById('soundBtn'), 'click', () => this.toggleSound());

        // Rename garden button
        addBtnListener(document.getElementById('renameGardenBtn'), 'click', () => this.promptRenameGarden());
        
        const prestigeToggle = document.getElementById('prestigeToggle');
        if (prestigeToggle) {
            addBtnListener(prestigeToggle, 'click', () => {
                this.prestigePanelExpanded = !this.prestigePanelExpanded;
                this.updatePrestigePanelVisibility();
            });
        }

        addBtnListener(document.getElementById('prestigeRebirthShortcut'), 'click', () => this.handleRebirthClick());
        addBtnListener(document.getElementById('prestigeRespecBtn'), 'click', () => this.respecPrestigeUpgrades());

        this.updatePrestigePanelVisibility();

        // Sprinkler shop
        document.querySelectorAll('.sprinkler-item').forEach(item => {
            addBtnListener(item, 'click', () => {
                this.buySprinkler(item.dataset.sprinkler);
            });
        });
        
        // Sprinkler tool buttons
        addBtnListener(document.getElementById('sprinkler-basic-btn'), 'click', () => this.selectSprinkler('basic'));
        addBtnListener(document.getElementById('sprinkler-advanced-btn'), 'click', () => this.selectSprinkler('advanced'));
        addBtnListener(document.getElementById('sprinkler-premium-btn'), 'click', () => this.selectSprinkler('premium'));
        addBtnListener(document.getElementById('sprinkler-legendary-btn'), 'click', () => this.selectSprinkler('legendary'));
        
        // Admin panel modal
        this.initializeAdminModal();
        this.initializeDecorationShop();
        
        // Add window resize listener for responsive canvas
        addBtnListener(window, 'resize', () => {
            this.adjustCanvasForMobile();
            this.draw(); // Redraw with new canvas size
        });
        
        // Test if event listeners are working
        console.log('Event listeners added. Testing...');
        setTimeout(() => {
            console.log('Testing button elements...');
            const waterBtn = document.getElementById('water-btn');
            const harvestBtn = document.getElementById('harvest-btn');
            console.log('Water button found:', !!waterBtn);
            console.log('Harvest button found:', !!harvestBtn);
        }, 1000);

        this.initializeHoverTooltip();
        // Ensure bonuses UI listeners are bound after DOM is ready
        this.initializeBonusesUI();
    }

    enhanceSeedItems() {
        // Add a small favorite toggle button to each seed item if missing
        const favoritesSet = new Set(this.seedFavorites || []);
        document.querySelectorAll('.seed-item').forEach((el) => {
            if (el.querySelector('.favorite-btn')) return;
            const seed = el.getAttribute('data-seed');
            if (!seed) return;
            const fav = document.createElement('button');
            const isFav = favoritesSet.has(seed);
            fav.type = 'button';
            fav.className = 'favorite-btn';
            fav.dataset.fav = isFav ? '1' : '0';
            fav.setAttribute('aria-label', isFav ? `Unfavorite ${seed}` : `Favorite ${seed}`);
            fav.title = isFav ? 'Unfavorite' : 'Favorite';
            fav.textContent = isFav ? '⭐' : '☆';
            fav.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleFavoriteSeed(seed);
                // labels updated by toggleFavoriteSeed -> refreshSeedItemsFavoriteIndicators
            });
            // Place the star at the end of the item
            el.appendChild(fav);
        });
    }

    setAllShopAccordions(expand) {
        try {
            const accordions = Array.from(document.querySelectorAll('#shopAccordion .accordion-item > .accordion-trigger'));
            accordions.forEach(btn => {
                const id = btn.getAttribute('aria-controls');
                const panel = id ? document.getElementById(id) : null;
                if (!panel) return;
                const shouldExpand = !!expand;
                btn.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');
                panel.classList.toggle('is-open', shouldExpand);
                panel.setAttribute('aria-hidden', shouldExpand ? 'false' : 'true');
                if (shouldExpand) {
                    panel.removeAttribute('hidden');
                } else {
                    panel.setAttribute('hidden', '');
                }
            });
        } catch (e) {
            // no-op
        }
    }

    filterSeeds(query) {
        try {
            const q = (query || '').toString().trim().toLowerCase();
            const items = Array.from(document.querySelectorAll('.seed-shop .seed-item'));
            const cats = Array.from(document.querySelectorAll('.seed-shop .seed-category'));
            items.forEach(item => {
                const nameEl = item.querySelector('.seed-name');
                const name = (nameEl?.textContent || item.getAttribute('data-seed') || '').toLowerCase();
                const match = !q || name.includes(q);
                item.style.display = match ? '' : 'none';
            });
            // Hide categories with no visible items
            cats.forEach(cat => {
                const visible = cat.querySelector('.seed-item[style*="display: none"]') ?
                    Array.from(cat.querySelectorAll('.seed-item')).some(x => x.style.display !== 'none') :
                    true;
                // More robust: compute directly
                const anyVisible = Array.from(cat.querySelectorAll('.seed-item')).some(x => x.style.display !== 'none');
                cat.style.display = anyVisible ? '' : 'none';
            });
        } catch (e) {
            // ignore filter errors
        }
    }

    // ===== BONUSES FAB + POPUP UI =====
    initializeBonusesUI() {
        try {
            this.bonusesFabEl = document.getElementById('bonusesFab') || null;
            this.bonusesPopupEl = document.getElementById('bonusesPopup') || null;
            this.bonusesPopupBodyEl = document.getElementById('bonusesPopupBody') || null;
            this.bonusesCloseEl = document.getElementById('closeBonusesPopup') || null;

            // Fallback: create the UI if markup is missing
            if (!this.bonusesFabEl || !this.bonusesPopupEl || !this.bonusesPopupBodyEl) {
                const container = document.querySelector('.garden-area');
                if (container) {
                    if (!this.bonusesFabEl) {
                        const btn = document.createElement('button');
                        btn.id = 'bonusesFab';
                        btn.className = 'bonuses-fab';
                        btn.type = 'button';
                        btn.title = 'Show Active Bonuses';
                        btn.setAttribute('aria-label', 'Show Active Bonuses');
                        btn.setAttribute('aria-haspopup', 'dialog');
                        btn.setAttribute('aria-controls', 'bonusesPopup');
                        btn.setAttribute('aria-expanded', 'false');
                        btn.textContent = '+';
                        container.appendChild(btn);
                    }
                    if (!this.bonusesPopupEl) {
                        const pop = document.createElement('div');
                        pop.id = 'bonusesPopup';
                        pop.className = 'bonuses-popup';
                        pop.setAttribute('role', 'dialog');
                        pop.setAttribute('aria-modal', 'false');
                        pop.setAttribute('hidden', '');
                        pop.style.display = 'none';
                        pop.innerHTML = `
                            <div class="bonuses-popup-header">
                                <h3 class="bonuses-popup-title">🌟 Active Bonuses</h3>
                                <button id="closeBonusesPopup" class="close-btn" type="button" aria-label="Close">&times;</button>
                            </div>
                            <div id="bonusesPopupBody" class="bonuses-popup-body"></div>
                        `;
                        container.appendChild(pop);
                    }
                    // Requery references
                    this.bonusesFabEl = document.getElementById('bonusesFab');
                    this.bonusesPopupEl = document.getElementById('bonusesPopup');
                    this.bonusesPopupBodyEl = document.getElementById('bonusesPopupBody');
                    this.bonusesCloseEl = document.getElementById('closeBonusesPopup');
                }
            }

            this.bonusesUIReady = !!(this.bonusesFabEl && this.bonusesPopupEl && this.bonusesPopupBodyEl);
            console.log('[BonusesUI] init', {
                fab: !!this.bonusesFabEl,
                popup: !!this.bonusesPopupEl,
                body: !!this.bonusesPopupBodyEl,
                ready: this.bonusesUIReady
            });

            const add = (el, ev, fn) => {
                if (!el) return;
                el.removeEventListener(ev, fn);
                el.addEventListener(ev, fn);
                this.eventListeners.push({ element: el, event: ev, handler: fn });
            };

            add(this.bonusesFabEl, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const willOpen = this.bonusesPopupEl?.hasAttribute('hidden');
                this.toggleBonusesPopup(!!willOpen);
            });

            add(this.bonusesCloseEl, 'click', (e) => {
                e.preventDefault();
                this.toggleBonusesPopup(false);
            });

            // Click outside to close
            add(document, 'click', (e) => {
                const clickedFab = e.target.closest && e.target.closest('#bonusesFab');
                if (clickedFab) {
                    // Delegate open/close in case direct listener didn't bind
                    const willOpen = this.bonusesPopupEl?.hasAttribute('hidden');
                    this.toggleBonusesPopup(!!willOpen);
                    return;
                }
                if (!this.bonusesPopupEl || this.bonusesPopupEl.hasAttribute('hidden')) return;
                const withinPopup = e.target.closest && e.target.closest('#bonusesPopup');
                if (!withinPopup) {
                    this.toggleBonusesPopup(false);
                }
            });

            // Escape to close
            add(document, 'keydown', (e) => {
                if (e.key === 'Escape') {
                    this.toggleBonusesPopup(false);
                }
            });

            // Keyboard shortcut: B to toggle bonuses
            add(document, 'keydown', (e) => {
                const target = e.target;
                const isTyping = target && (
                    target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable
                );
                if (isTyping) return;
                if (e.key === 'b' || e.key === 'B') {
                    e.preventDefault();
                    console.log('[BonusesUI] B pressed');
                    const willOpen = this.bonusesPopupEl?.hasAttribute('hidden');
                    this.toggleBonusesPopup(!!willOpen);
                }
            });

            // Keep content fresh
            this.updateBonusesPopup();
        } catch (_) {
            // no-op
        }
    }

    toggleBonusesPopup(open) {
        if (!this.bonusesPopupEl || !this.bonusesFabEl) return;
        if (open) {
            this.updateBonusesPopup();
            this.bonusesPopupEl.removeAttribute('hidden');
            this.bonusesPopupEl.style.display = 'block';
            this.bonusesFabEl.setAttribute('aria-expanded', 'true');
        } else {
            this.bonusesPopupEl.setAttribute('hidden', '');
            this.bonusesPopupEl.style.display = 'none';
            this.bonusesFabEl.setAttribute('aria-expanded', 'false');
        }
    }

    updateBonusesPopup() {
        if (!this.bonusesPopupBodyEl) return;
        const html = this.buildBonusesPopupHTML();
        this.bonusesPopupBodyEl.innerHTML = html;
    }

    buildBonusesPopupHTML() {
        const { totals, items } = this.computeGlobalBonusesSummary();
        const itemKeys = Object.keys(items);

        // Compute per-source contributions
        const dec = {
            growth: totals.growth || 0,
            harvest: totals.harvest || 0,
            water: totals.water || 0,
            protection: totals.protection || 0
        };
        const upgradesHarvest = Math.round(((this.harvestBonus || 0) * 100));
        const prestigeHarvest = Math.round((this.getPrestigeHarvestBonus() || 0) * 100);
        const rebirthHarvest = Math.round((this.getRebirthHarvestBonus() || 0) * 100);
        const seedDiscount = Math.round((this.getPrestigeSeedDiscount() || 0) * 100);

        const totalHarvestAllSources = dec.harvest + upgradesHarvest + prestigeHarvest + rebirthHarvest;

        const itemsList = itemKeys.length
            ? `<div class="bonuses-section-title">Global Decorations</div>
               <ul class="bonuses-list">
               ${itemKeys.map(key => {
                    const it = items[key];
                    // Parse percent from bonus string then multiply by count
                    const m = String(it.bonus || '').match(/(\d+)%/);
                    const per = m ? parseInt(m[1], 10) : 0;
                    const totalPct = per * (it.count || 0);
                    const left = `<span class="bonus-name">${it.icon || '🌸'} ${it.name} × <span class="bonus-count">${it.count}</span></span>`;
                    const right = `<span class="bonus-total">+${totalPct}%</span>`;
                    return `<li>${left}<span>${right}</span></li>`;
               }).join('')}
               </ul>`
            : '<div class="bonuses-section-title">Global Decorations</div><p style="color: var(--color-text-secondary);">No global decorations placed yet.</p>';

        const categoryTotals = `
            <div class="bonuses-section-title">Category Totals</div>
            <div class="bonuses-totals">
                <div class="row"><span class="label">Growth</span><span class="value">+${dec.growth}%</span></div>
                <div class="row"><span class="label">Harvest</span><span class="value">+${totalHarvestAllSources}%</span></div>
                <div class="row"><span class="label">Water efficiency</span><span class="value">+${dec.water}%</span></div>
                <div class="row"><span class="label">Protection</span><span class="value">+${dec.protection}%</span></div>
                <div class="row"><span class="label">Seed discount</span><span class="value">${seedDiscount}%</span></div>
            </div>`;

        const bySource = `
            <div class="bonuses-section-title">Totals by Source</div>
            <div class="bonuses-by-source">
                <div class="source">
                    <div class="source-title">Global Decorations</div>
                    <div class="source-lines">
                        <div>Growth: +${dec.growth}%</div>
                        <div>Harvest: +${dec.harvest}%</div>
                        <div>Water efficiency: +${dec.water}%</div>
                        <div>Protection: +${dec.protection}%</div>
                    </div>
                </div>
                <div class="source">
                    <div class="source-title">Upgrades</div>
                    <div class="source-lines">
                        <div>Harvest: +${upgradesHarvest}%</div>
                    </div>
                </div>
                <div class="source">
                    <div class="source-title">Prestige</div>
                    <div class="source-lines">
                        <div>Harvest: +${prestigeHarvest}%</div>
                        <div>Seed discount: ${seedDiscount}%</div>
                    </div>
                </div>
                <div class="source">
                    <div class="source-title">Rebirth</div>
                    <div class="source-lines">
                        <div>Harvest: +${rebirthHarvest}%</div>
                    </div>
                </div>
            </div>`;

        return [itemsList, '<div class="bonuses-divider"></div>', categoryTotals, '<div class="bonuses-divider"></div>', bySource].join('');
    }
    
    adjustCanvasForMobile() {
        if (!this.canvas) return;
        
        // Calculate responsive canvas size that respects viewport width and height
        const isLandscape = window.matchMedia && window.matchMedia('(orientation: landscape)').matches;
        // In landscape, allow a larger canvas, limited by viewport height to avoid overflow
        const maxCanvasSize = isLandscape
            ? Math.max(600, Math.min(900, Math.floor((window.innerHeight || 600) * 0.9)))
            : 600;
        const minCanvasSize = 240;
        const widthBased = Math.floor(window.innerWidth * 0.9);
        const heightBased = Math.floor(window.innerHeight * (isLandscape ? 0.9 : 0.65));

        let canvasSize = Math.min(maxCanvasSize, Math.max(minCanvasSize, widthBased));

        if (window.innerWidth <= 768) {
            const safeHeight = Math.max(minCanvasSize, heightBased || minCanvasSize);
            canvasSize = Math.min(canvasSize, safeHeight);
        }

        canvasSize = Math.max(minCanvasSize, Math.min(maxCanvasSize, canvasSize));

        // Align canvas dimensions with the grid so all tiles stay visible
        let cellSize = Math.floor(canvasSize / this.gridSize);
        if (cellSize < 1) {
            cellSize = 1;
        }
        canvasSize = cellSize * this.gridSize;

        this.canvas.width = canvasSize;
        this.canvas.height = canvasSize;
        this.canvas.style.maxWidth = `${canvasSize}px`;
        this.canvas.style.width = '100%';
        this.canvas.style.height = 'auto';
        
        // Recalculate cell size based on new canvas size
        this.cellSize = cellSize;
    }
    
    initializeAdminModal() {
        const adminBtn = document.getElementById('adminBtn');
        const adminModal = document.getElementById('adminModal');
        const closeAdminBtn = document.getElementById('closeAdminBtn');
        const adminTabs = document.querySelectorAll('.admin-tab');
        const adminTabContents = document.querySelectorAll('.admin-tab-content');
        
        // Helper function to add event listeners and track them
        const addBtnListener = (element, event, handler) => {
            if (element) {
                // Remove any existing listeners first to prevent duplicates
                element.removeEventListener(event, handler);
                element.addEventListener(event, handler);
                this.eventListeners.push({ element, event, handler });
            }
        };
        
        // Open admin modal
                      addBtnListener(adminBtn, 'click', () => {
                          // Show warning about admin panel usage being tracked
                          const confirmed = confirm('⚠️ ADMIN PANEL ACCESS\n\nUsing admin commands will be recorded in your game statistics.\n\nThis shows that you\'ve used creative mode features for experimentation and fun!\n\nContinue to admin panel?');
                          if (confirmed) {
                              adminModal.style.display = 'block';
                              document.body.style.overflow = 'hidden'; // Prevent background scrolling
                          }
        });
        
        // Close admin modal
        addBtnListener(closeAdminBtn, 'click', () => {
            adminModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
        
        // Close modal when clicking outside
        addBtnListener(adminModal, 'click', (e) => {
            if (e.target === adminModal) {
                adminModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
        
        // Tab switching
        adminTabs.forEach(tab => {
            addBtnListener(tab, 'click', () => {
                const targetTab = tab.dataset.tab;
                
                // Remove active class from all tabs and contents
                adminTabs.forEach(t => t.classList.remove('active'));
                adminTabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding content
                tab.classList.add('active');
                document.getElementById(`${targetTab}-tab`).classList.add('active');
            });
        });
        
        // Make admin functions globally accessible
        this.makeAdminFunctionsGlobal();
        
    }

    // ===== PRICING HELPERS =====
    // Returns a multiplier based on tool level to reduce shop prices
    // Each level beyond 1 reduces price by 15%, floored at 20% of base; final price has a hard floor of $1
    getToolPriceMultiplier(tool) {
        const lvl = Math.max(1, (this.toolLevels && this.toolLevels[tool]) || 1);
        const reductionPerLevel = 0.15; // 15% per level beyond level 1
        // e.g., L1=1.0, L2=0.85, L3=0.70, ... with a floor multiplier of 0.2
        const mult = 1 - reductionPerLevel * (lvl - 1);
        return Math.max(0.2, mult);
    }

    getWaterPurchasePrice() {
        const unit = Math.floor(this.waterPriceBase * this.getToolPriceMultiplier('water'));
        return Math.max(1, unit);
    }

    getFertilizerPurchasePrice() {
        const unit = Math.floor(this.fertilizerPriceBase * this.getToolPriceMultiplier('fertilizer'));
        return Math.max(1, unit);
    }
    
    initializeDecorationShop() {
        const decorationItems = document.querySelectorAll('.decoration-item');
        const categoryBtns = document.querySelectorAll('.category-btn');
        
        // Helper function to add event listeners and track them
        const addBtnListener = (element, event, handler) => {
            if (element) {
                element.removeEventListener(event, handler);
                element.addEventListener(event, handler);
                this.eventListeners.push({ element, event, handler });
            }
        };

        const clearDecorationSelection = (options = {}) => {
            const { instant = false } = options;
            decorationItems.forEach((item) => {
                item.classList.remove('selected');
                const details = item.querySelector('.decoration-details');
                if (!details) {
                    return;
                }

                const removeDetails = () => {
                    if (details._openTransitionHandler) {
                        details.removeEventListener('transitionend', details._openTransitionHandler);
                        details._openTransitionHandler = null;
                    }
                    details.style.transition = '';
                    details.style.maxHeight = '';
                    details.style.overflow = '';
                    details.dataset.state = 'collapsed';
                    if (details.parentNode) {
                        details.parentNode.removeChild(details);
                    }
                };

                if (instant) {
                    removeDetails();
                    return;
                }

                const startHeight = details.scrollHeight;
                details.style.transition = 'max-height 0.3s ease, opacity 0.25s ease, margin-top 0.2s ease, padding-top 0.2s ease, border-top-color 0.2s ease';
                if (details.dataset.state !== 'opening') {
                    details.style.maxHeight = `${startHeight}px`;
                }
                details.style.overflow = 'hidden';
                details.dataset.state = 'closing';

                requestAnimationFrame(() => {
                    details.classList.remove('is-expanded');
                    details.style.maxHeight = '0px';
                });

                const handleClose = (event) => {
                    if (event.propertyName === 'max-height') {
                        details.removeEventListener('transitionend', handleClose);
                        removeDetails();
                    }
                };

                details.addEventListener('transitionend', handleClose);
            });
            this.selectedDecoration = null;
        };

        const renderDecorationDetails = (item, decorationData) => {
            const details = document.createElement('div');
            details.className = 'decoration-details';
            details.dataset.state = 'collapsed';
            details._openTransitionHandler = null;

            const costLine = document.createElement('div');
            costLine.className = 'decoration-details__line';
            costLine.innerHTML = `
                <span class='decoration-details__label'>Cost</span>
                <span class='decoration-details__value'>$${decorationData.cost}</span>
            `;
            details.appendChild(costLine);

            if (decorationData.bonus && decorationData.bonus.toLowerCase() !== 'none') {
                const bonusLine = document.createElement('div');
                bonusLine.className = 'decoration-details__line';
                bonusLine.innerHTML = `
                    <span class='decoration-details__label'>Bonus</span>
                    <span class='decoration-details__bonus'>${decorationData.bonus}</span>
                `;
                details.appendChild(bonusLine);

                if (decorationData.scope === 'global') {
                    const note = document.createElement('div');
                    note.className = 'decoration-details__note';
                    note.textContent = 'Applies to your entire garden.';
                    details.appendChild(note);
                }
            }

            const bonusText = (decorationData.bonus || '').trim().toLowerCase();
            const descriptionText = (decorationData.description || '').trim();

            if (descriptionText && descriptionText.toLowerCase() !== bonusText) {
                const descriptionNote = document.createElement('div');
                descriptionNote.className = 'decoration-details__note';
                descriptionNote.textContent = decorationData.description;
                details.appendChild(descriptionNote);
            }

            item.appendChild(details);
            return details;
        };

        // Decoration item selection
        decorationItems.forEach(item => {
            if (item.dataset.decorationInitialized === 'true') {
                return;
            }

            const handleDecorationClick = () => {
                const decorationType = item.dataset.decoration;
                const decorationData = this.decorations[decorationType];
                
                if (decorationData) {
                    if (this.selectedDecoration === decorationType) {
                        clearDecorationSelection();
                        this.currentTool = 'water';
                        this.updateToolDisplay();
                        this.updateShopDisplay();
                        return;
                    }

                    clearDecorationSelection();
                    this.selectedDecoration = decorationType;
                    item.querySelectorAll('.decoration-details').forEach(existing => {
                        existing.remove();
                    });

                    const details = renderDecorationDetails(item, decorationData);
                    item.classList.add('selected');

                    requestAnimationFrame(() => {
                        details.style.transition = 'max-height 0.3s ease, opacity 0.25s ease, margin-top 0.2s ease, padding-top 0.2s ease, border-top-color 0.2s ease';
                        details.style.maxHeight = '0px';
                        details.style.overflow = 'hidden';

                        requestAnimationFrame(() => {
                            details.classList.add('is-expanded');
                            details.dataset.state = 'opening';
                            const targetHeight = details.scrollHeight;
                            details.style.maxHeight = `${targetHeight}px`;

                            const handleOpenTransitionEnd = (event) => {
                                if (event.propertyName !== 'max-height') {
                                    return;
                                }
                                details.removeEventListener('transitionend', handleOpenTransitionEnd);
                                details._openTransitionHandler = null;
                                if (details.dataset.state === 'opening') {
                                    details.dataset.state = 'open';
                                    details.style.maxHeight = 'none';
                                    details.style.overflow = 'visible';
                                }
                            };

                            details._openTransitionHandler = handleOpenTransitionEnd;
                            details.addEventListener('transitionend', handleOpenTransitionEnd);
                        });
                    });

                    // Update current tool to decoration mode
                    this.currentTool = 'decoration';
                    this.updateToolDisplay();

                    // Clear other selections
                    this.selectedSeed = null;
                    this.selectedSprinkler = null;
                    document.querySelectorAll('.seed-item').forEach(seed => seed.classList.remove('selected'));
                    document.querySelectorAll('.sprinkler-tool').forEach(sprinkler => sprinkler.classList.remove('active'));
                    document.querySelectorAll('.tool-btn').forEach(tool => tool.classList.remove('active'));

                }
            };

            addBtnListener(item, 'click', handleDecorationClick);
            item.dataset.decorationInitialized = 'true';
        });
        
        // Category filtering
        categoryBtns.forEach(btn => {
            if (btn.dataset.categoryInitialized === 'true') {
                return;
            }

            const handleCategoryClick = () => {
                const category = btn.dataset.category;
                
                // Update active category button
                categoryBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Filter decoration items
                decorationItems.forEach(item => {
                    const itemCategory = item.dataset.category;
                    if (category === 'all' || itemCategory === category) {
                        item.style.display = 'grid';
                    } else {
                        item.style.display = 'none';
                    }
                });
                
                // Reset selection when filtering changes the view
                clearDecorationSelection({ instant: true });
            };

            addBtnListener(btn, 'click', handleCategoryClick);
            btn.dataset.categoryInitialized = 'true';
        });
    }
    
    initializeMultiplayer() {
        console.log('Multiplayer features are disabled in this single-player build.');
    }
    
    addMultiplayerEventListeners() {
        const addBtnListener = (element, event, handler) => {
            if (element) {
                element.removeEventListener(event, handler);
                element.addEventListener(event, handler);
                this.eventListeners.push({ element, event, handler });
            }
        };
        
        // Friends button
        addBtnListener(document.getElementById('friendsBtn'), 'click', () => {
            this.toggleFriendsList();
        });
        
        // Chat button
        addBtnListener(document.getElementById('chatBtn'), 'click', () => {
            this.toggleChatPanel();
        });
        
        // Visit garden button
        addBtnListener(document.getElementById('visitBtn'), 'click', () => {
            this.requestGardenVisit();
        });
        
        // Send chat message
        addBtnListener(document.getElementById('sendChatBtn'), 'click', () => {
            this.sendChatMessage();
        });
        
        // Chat input enter key
        addBtnListener(document.getElementById('chatInput'), 'keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });
    }
    
    // Logout button is now handled in the header
    
    updateMultiplayerUI() {
        if (!this.multiplayer) return;
        
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            if (this.multiplayer.isConnected) {
                statusElement.textContent = '🟢 Connected';
                statusElement.style.color = '#4CAF50';
            } else {
                statusElement.textContent = '🔴 Disconnected';
                statusElement.style.color = '#f44336';
            }
        }
        
        // Always refresh friends list to ensure online status is up to date
        // This ensures that when friends come online/offline, the status is immediately reflected
            this.loadFriendsList();
    }
    
    toggleFriendsList() {
        const friendsList = document.getElementById('friendsList');
        const chatPanel = document.getElementById('chatPanel');
        
        if (friendsList.style.display === 'none') {
            friendsList.style.display = 'block';
            chatPanel.style.display = 'none';
            this.loadFriendsList();
        } else {
            friendsList.style.display = 'none';
        }
    }
    
    toggleChatPanel() {
        const friendsList = document.getElementById('friendsList');
        const chatPanel = document.getElementById('chatPanel');
        
        if (chatPanel.style.display === 'none') {
            chatPanel.style.display = 'block';
            friendsList.style.display = 'none';
            this.loadChatMessages();
            
            // Start auto-refresh timer for chat (every 5 seconds)
            this.startChatAutoRefresh();
        } else {
            chatPanel.style.display = 'none';
            // Stop auto-refresh when chat is closed
            this.stopChatAutoRefresh();
        }
    }
    
    startChatAutoRefresh() {
        // Clear any existing timer
        this.stopChatAutoRefresh();
        
        // Start new timer that refreshes chat every 5 seconds
        this.chatRefreshTimer = setInterval(() => {
            // Only refresh if chat panel is visible and user is not typing
            const chatPanel = document.getElementById('chatPanel');
            const chatInput = document.getElementById('chatInput');
            
            if (chatPanel && chatPanel.style.display !== 'none') {
                // Check if user is currently typing (input has focus and value)
                const isTyping = chatInput && document.activeElement === chatInput && chatInput.value.length > 0;
                
                if (!isTyping) {
                    this.loadChatMessages();
                }
            }
        }, 5000); // 5 seconds
    }
    
    stopChatAutoRefresh() {
        if (this.chatRefreshTimer) {
            clearInterval(this.chatRefreshTimer);
            this.chatRefreshTimer = null;
        }
    }
    
    loadFriendsList() {
        if (!this.multiplayer) return;
        
        const friendsContainer = document.getElementById('friendsContainer');
        if (friendsContainer) {
            // Preserve the current input field value before refreshing
            const currentInput = document.getElementById('friendUsername');
            const preservedValue = currentInput ? currentInput.value : '';
            
            friendsContainer.innerHTML = '<p>Loading friends...</p>';
            
            // Get friends from multiplayer manager
            this.multiplayer.getFriends().then(friends => {
                console.log('Raw friends data:', friends); // Debug log
                console.log('Current user:', this.multiplayer?.currentUser); // Debug log
                
                if (!friends || friends.length === 0) {
                    friendsContainer.innerHTML = `
                        <p>No friends found. Add some friends to get started!</p>
                        <div class="add-friend-section">
                            <input type="text" id="friendUsername" placeholder="Enter username to add">
                            <button id="addFriendBtn">Add Friend</button>
                        </div>
                    `;
                    return;
                }
                
                // Remove duplicates based on user ID only (not status/request_type)
                const uniqueFriends = friends.filter((friend, index, self) => {
                    const friendId = friend.id || friend.user_id;
                    // Find the first occurrence of this user ID
                    const firstIndex = self.findIndex(f => (f.id || f.user_id) === friendId);
                    // Only keep the first occurrence (index === firstIndex)
                    return index === firstIndex;
                });
                
                console.log('Unique friends after deduplication:', uniqueFriends); // Debug log
                
                console.log('Unique friends after deduplication:', uniqueFriends); // Debug log
                
                let friendsHtml = '';
                
                // Show accepted friends
                const acceptedFriends = uniqueFriends.filter(friend => {
                    const isAccepted = (friend.status === 'accepted') || (friend.request_type === 'accepted');
                    return isAccepted;
                });
                if (acceptedFriends.length > 0) {
                    // Separate online and offline friends
                    const onlineFriends = acceptedFriends.filter(friend => {
                        // Don't show current user in friends list
                        if (friend.id === this.multiplayer?.currentUser?.id) {
                            return false;
                        }
                        // Check real-time online status - server returns both 'online' and 'isOnline'
                        const isOnline = friend.online === true || friend.isOnline === true || friend.is_online === 1;
                        return isOnline;
                    });
                    
                    const offlineFriends = acceptedFriends.filter(friend => {
                        // Don't show current user in friends list
                        if (friend.id === this.multiplayer?.currentUser?.id) {
                            return false;
                        }
                        // Check real-time online status - server returns both 'online' and 'isOnline'
                        const isOnline = friend.online === true || friend.isOnline === true || friend.is_online === 1;
                        return !isOnline;
                    });
                    
                    // Show online friends first
                    if (onlineFriends.length > 0) {
                        friendsHtml += '<h4>🟢 Online Friends</h4>';
                        friendsHtml += onlineFriends.map(friend => {
                            const friendId = friend.id || friend.user_id;
                            // Try multiple possible username fields
                            const friendName = friend.username || friend.name || friend.from_name || friend.by_name || 'Unknown User';
                            return `<div class="friend-item">
                                <div class="friend-info">
                                    <span class="friend-name">${friendName}</span>
                                    <span class="friend-status online">🟢</span>
                                </div>
                                <div class="friend-actions">
                                    <button class="unfriend-btn-small" data-friend-id="${friendId}" data-action="unfriend">Unfriend</button>
                                </div>
                            </div>`;
                        }).join('');
                    }
                    
                    // Show offline friends
                    if (offlineFriends.length > 0) {
                        friendsHtml += '<h4>🔴 Offline Friends</h4>';
                        friendsHtml += offlineFriends.map(friend => {
                            const friendId = friend.id || friend.user_id;
                            // Try multiple possible username fields
                            const friendName = friend.username || friend.name || friend.from_name || friend.by_name || 'Unknown User';
                            return `<div class="friend-item">
                                <div class="friend-info">
                                    <span class="friend-name">${friendName}</span>
                                    <span class="friend-status offline">🔴</span>
                                </div>
                                <div class="friend-actions">
                                    <button class="unfriend-btn-small" data-friend-id="${friendId}" data-action="unfriend">Unfriend</button>
                                </div>
                            </div>`;
                        }).join('');
                    }
                }
                
                // Show pending friend requests (only received requests, not sent ones)
                const pendingRequests = uniqueFriends.filter(friend => {
                    // Only show received requests, not sent ones
                    const isPendingReceived = friend.status === 'pending' && friend.request_type === 'received';
                    return isPendingReceived;
                });
                if (pendingRequests.length > 0) {
                    friendsHtml += '<h4>⏳ Pending Requests</h4>';
                    pendingRequests.forEach(friend => {
                        const friendId = friend.id || friend.user_id || friend.from_id;
                        // Try multiple possible username fields
                        const friendName = friend.username || friend.name || friend.from_name || friend.by_name || 'Unknown User';
                        friendsHtml += `
                            <div class="friend-item pending">
                                <div class="friend-info">
                                    <span class="friend-name">${friendName}</span>
                                    <span class="friend-status">⏳ Pending</span>
                                </div>
                                <div class="friend-actions">
                                    <button class="accept-btn-small" data-friend-id="${friendId}" data-action="accept">Accept</button>
                                    <button class="reject-btn-small" data-friend-id="${friendId}" data-action="reject">Reject</button>
                                </div>
                            </div>
                        `;
                    });
                }
                
                // Always show the add friend section
                const isConnected = this.multiplayer && this.multiplayer.isConnected;
                const addFriendSection = `
                    <div class="add-friend-section">
                        <input type="text" id="friendUsername" placeholder="Enter username to add" ${!isConnected ? 'disabled' : ''}>
                        <button id="addFriendBtn" ${!isConnected ? 'disabled' : ''}>
                            ${isConnected ? 'Add Friend' : 'Connecting...'}
                        </button>
                        <button id="testFriendsBtn" style="margin-left: 10px; background: #ff9800;">Test Friends API</button>
                    </div>
                `;
                
                if (friendsHtml) {
                    friendsContainer.innerHTML = friendsHtml + addFriendSection;
                } else {
                    friendsContainer.innerHTML = `
                        <p>No friends found. Add some friends to get started!</p>
                        ${addFriendSection}
                    `;
                }
                
                // Restore the input field value if it was preserved
                const newInput = document.getElementById('friendUsername');
                if (newInput && preservedValue) {
                    newInput.value = preservedValue;
                }
                
                // Add event listener after creating the button
                const addFriendBtn = document.getElementById('addFriendBtn');
                if (addFriendBtn) {
                    addFriendBtn.addEventListener('click', () => {
                        this.sendFriendRequest();
                    });
                }
                
                // Add event listener for test friends button
                const testFriendsBtn = document.getElementById('testFriendsBtn');
                if (testFriendsBtn) {
                    testFriendsBtn.addEventListener('click', () => {
                        this.testFriendsAPI();
                    });
                }
                
                // Add event listeners for accept/reject buttons
                const acceptButtons = document.querySelectorAll('.accept-btn-small');
                const rejectButtons = document.querySelectorAll('.reject-btn-small');
                
                acceptButtons.forEach(button => {
                    button.addEventListener('click', (e) => {
                        const friendId = e.target.getAttribute('data-friend-id');
                        
                        // Try to find the game object if window.game doesn't exist
                        let gameObj = window.game;
                        if (!gameObj) {
                            // Look for the game object in different places
                            gameObj = window.currentGame || window.gardenGame;
                        }
                        
                        if (gameObj && friendId) {
                            gameObj.respondToFriendRequest(friendId, true);
                        } else {
                            console.error('❌ Cannot call respondToFriendRequest - game object or friendId missing');
                            // Show user-friendly error
                            alert('Game not ready. Please wait a moment and try again.');
                        }
                    });
                });
                
                rejectButtons.forEach(button => {
                    button.addEventListener('click', (e) => {
                        const friendId = e.target.getAttribute('data-friend-id');
                        
                        // Try to find the game object if window.game doesn't exist
                        let gameObj = window.game;
                        if (!gameObj) {
                            // Look for the game object in different places
                            gameObj = window.currentGame || window.gardenGame;
                        }
                        
                        if (gameObj && friendId) {
                            gameObj.respondToFriendRequest(friendId, false);
                        } else {
                            console.error('❌ Cannot call respondToFriendRequest - game object or friendId missing');
                            // Show user-friendly error
                            alert('Game not ready. Please wait a moment and try again.');
                        }
                    });
                });
                
                // Add event listeners for unfriend buttons
                const unfriendButtons = document.querySelectorAll('.unfriend-btn-small');
                unfriendButtons.forEach(button => {
                    button.addEventListener('click', (e) => {
                        const friendId = e.target.getAttribute('data-friend-id');
                        
                        // Try to find the game object if window.game doesn't exist
                        let gameObj = window.game;
                        if (!gameObj) {
                            // Look for the game object in different places
                            gameObj = window.currentGame || window.gardenGame;
                        }
                        
                        if (gameObj && friendId) {
                            gameObj.unfriendUser(friendId);
                        } else {
                            console.error('❌ Cannot call unfriendUser - game object or friendId missing');
                            // Show user-friendly error
                            alert('Game not ready. Please wait a moment and try again.');
                        }
                    });
                });

            });
        }
    }
    
    testFriendsAPI() {
        if (!this.multiplayer) return;
        
        this.multiplayer.getFriends().then(friends => {
            console.log('Friends API test result:', friends);
        }).catch(error => {
            console.error('Error testing friends API:', error);
        });
    }
    
    loadChatMessages() {
        if (!this.multiplayer) return;
        
        const chatMessagesDiv = document.getElementById('chatMessages');
        if (chatMessagesDiv) {
            // Display recent chat messages
            const messages = this.multiplayer.chatMessages || [];
            if (messages.length > 0) {
                const messagesHtml = messages.map(msg => {
                    // Add [DEV] tag for AviDev only
                    let displayName = msg.senderName || msg.username;
                    let isDev = false;
                    if (displayName === 'AviDev') {
                        displayName = `[DEV] ${displayName}`;
                        isDev = true;
                    }
                    
                    return `<div class="chat-message">
                        <span class="chat-username ${isDev ? 'dev-username' : ''}">${displayName}:</span>
                        <span class="chat-text">${msg.message}</span>
                    </div>`;
                }).join('');
                
                // Add auto-update info message at the bottom
                const autoUpdateMessage = '<div class="chat-auto-update-info">💬 Chat updates automatically when you\'re not typing</div>';
                chatMessagesDiv.innerHTML = messagesHtml + autoUpdateMessage;
                chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
            } else {
                chatMessagesDiv.innerHTML = '<p>No messages yet. Start chatting!</p><div class="chat-auto-update-info">💬 Chat updates automatically when you\'re not typing</div>';
            }
        }
    }
    
    sendChatMessage() {
        if (!this.multiplayer) return;
        
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();
        
        if (message) {
            // Send as global message (no specific receiver)
            this.multiplayer.sendMessage(message);
            chatInput.value = '';
            
            // Update chat display after a short delay to allow server response
            setTimeout(() => {
                this.loadChatMessages();
            }, 100);
        }
    }
    
    requestGardenVisit() {
        if (!this.multiplayer) {
            this.showMessage('Multiplayer not available', 'error');
            return;
        }
        
        if (!this.multiplayer.isConnected) {
            this.showMessage('Not connected to multiplayer server', 'error');
            return;
        }
        
        // Get friends list
        this.multiplayer.getFriends().then(friends => {
            if (!friends || friends.length === 0) {
                this.showMessage('You need friends to visit gardens! Add some friends first.', 'info');
                return;
            }
            
            // Create friend selection dialog
            this.showFriendSelectionDialog(friends);
        }).catch(error => {
            console.error('Error getting friends:', error);
            this.showMessage('Failed to load friends list', 'error');
        });
    }
    
    showFriendSelectionDialog(friends) {
        if (!friends || friends.length === 0) {
            this.showMessage('No friends available to visit', 'info');
            return;
        }
        
        // Remove duplicates based on user ID only
        const uniqueFriends = friends.filter((friend, index, self) => {
            const friendId = friend.id || friend.user_id;
            return index === self.findIndex(f => (f.id || f.user_id) === friendId);
        });
        
        // Only show accepted friends for garden visits
        const acceptedFriends = uniqueFriends.filter(friend => {
            const isAccepted = (friend.status === 'accepted') || (friend.request_type === 'accepted');
            return isAccepted;
        });
        
        if (acceptedFriends.length === 0) {
            this.showMessage('No accepted friends available to visit', 'info');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'friend-selection-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;
        
        let friendsListHTML = '';
        acceptedFriends.forEach(friend => {
            // Don't show current user
            if (friend.id === this.multiplayer?.currentUser?.id || friend.user_id === this.multiplayer?.currentUser?.id) {
                return;
            }
            
            const status = friend.isOnline ? '🟢 Online' : '🔴 Offline';
            const statusColor = friend.isOnline ? '#4CAF50' : '#f44336';
            const friendId = friend.id || friend.user_id;
            // Try multiple possible username fields
            const friendName = friend.username || friend.name || friend.from_name || friend.by_name || 'Unknown User';
            
            friendsListHTML += `
                <div class="friend-item" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 15px;
                    margin: 10px 0;
                    background: white;
                    border-radius: 10px;
                    border: 2px solid #e0e0e0;
                    transition: all 0.3s;
                " onmouseover="this.style.borderColor='#4CAF50'" onmouseout="this.style.borderColor='#e0e0e0'">
                    <div>
                        <strong style="font-size: 1.1em;">${friendName}</strong>
                        <div style="color: ${statusColor}; font-size: 0.9em;">${status}</div>
                    </div>
                    <button onclick="if(window.game) window.game.visitFriendGarden('${friendId}', '${friendName}')" 
                            style="
                                background: #4CAF50;
                                color: white;
                                border: none;
                                padding: 10px 20px;
                                border-radius: 8px;
                                cursor: pointer;
                                font-size: 1rem;
                                transition: all 0.3s;
                            " 
                            onmouseover="this.style.background='#45a049'" 
                            onmouseout="this.style.background='#4CAF50'">
                        🏡 Visit Garden
                    </button>
                </div>
            `;
        });
        
        if (!friendsListHTML) {
            this.showMessage('No friends available to visit', 'info');
            return;
        }
        
        modal.innerHTML = `
            <div style="
                background: white;
                padding: 25px;
                border-radius: 15px;
                max-width: 500px;
                max-height: 80vh;
                overflow-y: auto;
                position: relative;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #2c5530;">🏡 Visit Friend's Garden</h2>
                    <button onclick="this.closest('.friend-selection-modal').remove()" style="
                        background: #f44336;
                        color: white;
                        border: none;
                        border-radius: 50%;
                        width: 30px;
                        height: 30px;
                        cursor: pointer;
                        font-size: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">×</button>
                </div>
                
                <p style="color: #666; margin-bottom: 20px;">
                    Select a friend whose garden you'd like to visit:
                </p>
                
                <div class="friends-list">
                    ${friendsListHTML}
                </div>
                
                <div style="margin-top: 20px; text-align: center;">
                    <button onclick="this.closest('.friend-selection-modal').remove()" style="
                        background: #666;
                        color: white;
                        border: none;
                        padding: 12px 25px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 1rem;
                    ">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    visitFriendGarden(friendId, friendName) {
        // Close the selection dialog
        const modal = document.querySelector('.friend-selection-modal');
        if (modal) {
            modal.remove();
        }
        
        // Show loading message
        this.showMessage(`Requesting to visit ${friendName}'s garden...`, 'info');
        
        // Request the garden visit
        this.multiplayer.requestGardenVisit(friendId);
    }
    
    sendFriendRequest() {
        console.log('Multiplayer object:', this.multiplayer);
        console.log('Multiplayer connected:', this.multiplayer?.isConnected);
        
        // Check if multiplayer exists and is connected
        if (!this.multiplayer) {
            console.error('❌ Multiplayer not initialized');
            this.showMessage('Multiplayer not initialized. Please refresh the page.', 'error');
            return;
        }
        
        if (!this.multiplayer.isConnected) {
            console.error('❌ Multiplayer not connected');
            this.showMessage('Multiplayer not connected. Please wait...', 'error');
            return;
        }
        
        // Check if sendFriendRequest method exists
        if (typeof this.multiplayer.sendFriendRequest !== 'function') {
            console.error('❌ sendFriendRequest method not found');
            this.showMessage('Friend system not ready. Please wait...', 'error');
            return;
        }
        
        const usernameInput = document.getElementById('friendUsername');
        if (!usernameInput) {
            console.error('❌ Friend input not found');
            this.showMessage('Friend input not found. Please refresh the page.', 'error');
            return;
        }
        
        const username = usernameInput.value.trim();
        console.log('Username to add:', username);
        
        if (username) {
            try {
                this.multiplayer.sendFriendRequest(username);
                usernameInput.value = '';
                this.showMessage(`Friend request sent to ${username}!`, 'success');
            } catch (error) {
                console.error('❌ Error sending friend request:', error);
                this.showMessage('Failed to send friend request. Please try again.', 'error');
            }
        } else {
            this.showMessage('Please enter a username', 'error');
        }
    }
    
    showFriendRequestNotification(data) {
        const notification = document.createElement('div');
        notification.className = 'friend-request-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <h4>👥 Friend Request</h4>
                <p>${data.fromName} wants to be your friend!</p>
                <div class="notification-buttons">
                                                    <button onclick="if(window.game) window.game.respondToFriendRequest('${data.fromId}', true)" class="accept-btn">Accept</button>
                                <button onclick="if(window.game) window.game.respondToFriendRequest('${data.fromId}', false)" class="reject-btn">Reject</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 30 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 30000);
    }
    
    respondToFriendRequest(fromId, accepted) {
        
        if (!this.multiplayer) {
            console.error('❌ Multiplayer not initialized');
            return;
        }
        
        if (!this.multiplayer.isConnected) {
            console.error('❌ Multiplayer not connected');
            this.showMessage('Multiplayer not connected. Please wait...', 'error');
            return;
        }
        
        this.multiplayer.respondToFriendRequest(fromId, accepted);
        
        // Remove the notification
        const notification = document.querySelector('.friend-request-notification');
        if (notification) {
            notification.parentNode.removeChild(notification);
        }
        
        const status = accepted ? 'accepted' : 'rejected';
        const message = accepted 
            ? `🎉 Friend request accepted! You are now friends with this user.`
            : `❌ Friend request rejected.`;
        this.showMessage(message, accepted ? 'success' : 'info');
        
        // Refresh the friends list to show updated status
        setTimeout(() => {
            this.loadFriendsList();
        }, 500);
        
        // Also refresh after a longer delay to ensure server updates are processed
        setTimeout(() => {
            this.loadFriendsList();
        }, 2000);
    }
    
    unfriendUser(friendId) {
        
        if (!this.multiplayer) {
            console.error('❌ Multiplayer not initialized');
            return;
        }
        
        if (!this.multiplayer.isConnected) {
            console.error('❌ Multiplayer not connected');
            this.showMessage('Multiplayer not connected. Please wait...', 'error');
            return;
        }
        
        // Confirm the action
        if (!confirm('Are you sure you want to unfriend this user?')) {
            return;
        }
        
        this.multiplayer.unfriendUser(friendId);
        
        this.showMessage('User unfriended!', 'success');
        
        // Refresh the friends list to show updated status
        setTimeout(() => {
            this.loadFriendsList();
        }, 500);
        
        // Also refresh after a longer delay to ensure server updates are processed
        setTimeout(() => {
            this.loadFriendsList();
        }, 2000);
    }
    
    makeAdminFunctionsGlobal() {
        // Helper function to track admin command usage
        const trackAdminCommand = () => {
            if (!this.stats.adminPanelUsed) {
                this.stats.adminPanelUsed = true;
            }
            this.stats.adminPanelUsageCount++;
            this.saveGame();
        };
        // Resources functions
        window.addMoney = () => {
            const amount = parseInt(document.getElementById('addMoneyInput').value) || 0;
            if (amount > 0) {
                // Track admin command usage
                trackAdminCommand();
                
                // Completely stop background processing to prevent interference
                if (window.menuSystem) {
                    window.menuSystem.stopBackgroundProcessing();
                }
                
                this.money += amount;
                this.updateUI();
                this.updateShopDisplay();
                this.showMessage(`Added $${amount}!`, 'success');
                document.getElementById('addMoneyInput').value = '';
                
                // Force immediate save to prevent data loss
                this.saveGame();
                
                // Add a timestamp to prevent background processing from overwriting this change
                localStorage.setItem(`adminChange_${this.saveSlot}`, Date.now().toString());
                

            }
        };
        
        window.setMoney = () => {
            const amount = parseInt(document.getElementById('setMoneyInput').value) || 0;
            
            // Track admin command usage
            trackAdminCommand();
            
            // Completely stop background processing to prevent interference
            if (window.menuSystem) {
                window.menuSystem.stopBackgroundProcessing();
            }
            
            this.money = amount;
            

            
            this.updateUI();
            this.updateShopDisplay();
            this.showMessage(`Money set to $${amount}!`, 'success');
            document.getElementById('setMoneyInput').value = '';
            
            // Force immediate save to prevent data loss
            this.saveGame();
            
            // Add a timestamp to prevent background processing from overwriting this change
            localStorage.setItem(`adminChange_${this.saveSlot}`, Date.now().toString());
        };
        
        window.addWater = () => {
            const amount = parseInt(document.getElementById('addWaterInput').value) || 0;
            if (amount > 0) {
                // Track admin command usage
                trackAdminCommand();
                
                // Completely stop background processing to prevent interference
                if (window.menuSystem) {
                    window.menuSystem.stopBackgroundProcessing();
                }
                
                this.water += amount;
                
                this.updateUI();
                this.updateShopDisplay();
                this.showMessage(`Added ${amount} water!`, 'success');
                document.getElementById('addWaterInput').value = '';
                
                // Force immediate save to prevent data loss
                this.saveGame();
                
                // Add a timestamp to prevent background processing from overwriting this change
                localStorage.setItem(`adminChange_${this.saveSlot}`, Date.now().toString());
            }
        };
        
        window.setWater = () => {
            const amount = parseInt(document.getElementById('setWaterInput').value) || 0;
            
            // Track admin command usage
            trackAdminCommand();
            
            // Completely stop background processing to prevent interference
            if (window.menuSystem) {
                window.menuSystem.stopBackgroundProcessing();
            }
            
            this.water = amount;
            
            this.updateUI();
            this.updateShopDisplay();
            this.showMessage(`Water set to ${amount}!`, 'success');
            document.getElementById('setWaterInput').value = '';
            
            // Force immediate save to prevent data loss
            this.saveGame();
            
            // Add a timestamp to prevent background processing from overwriting this change
            localStorage.setItem(`adminChange_${this.saveSlot}`, Date.now().toString());
        };
        
        window.addFertilizer = () => {
            const amount = parseInt(document.getElementById('addFertilizerInput').value) || 0;
            if (amount > 0) {
                // Track admin command usage
                trackAdminCommand();
                
                // Completely stop background processing to prevent interference
                if (window.menuSystem) {
                    window.menuSystem.stopBackgroundProcessing();
                }
                
                this.fertilizer += amount;
                
                this.updateUI();
                this.updateShopDisplay();
                this.showMessage(`Added ${amount} fertilizer!`, 'success');
                document.getElementById('addFertilizerInput').value = '';
                
                // Force immediate save to prevent data loss
                this.saveGame();
                
                // Add a timestamp to prevent background processing from overwriting this change
                localStorage.setItem(`adminChange_${this.saveSlot}`, Date.now().toString());
            }
        };
        
        window.setFertilizer = () => {
            const amount = parseInt(document.getElementById('setFertilizerInput').value) || 0;
            
            // Track admin command usage
            trackAdminCommand();
            
            // Completely stop background processing to prevent interference
            if (window.menuSystem) {
                window.menuSystem.stopBackgroundProcessing();
            }
            
            this.fertilizer = amount;
            
            this.updateUI();
            this.updateShopDisplay();
            this.showMessage(`Fertilizer set to ${amount}!`, 'success');
            document.getElementById('setFertilizerInput').value = '';
            
            // Force immediate save to prevent data loss
            this.saveGame();
            
            // Add a timestamp to prevent background processing from overwriting this change
            localStorage.setItem(`adminChange_${this.saveSlot}`, Date.now().toString());
        };
        
        window.addScore = () => {
            const amount = parseInt(document.getElementById('addScoreInput').value) || 0;
            if (amount > 0) {
                // Track admin command usage
                trackAdminCommand();
                
                // Completely stop background processing to prevent interference
                if (window.menuSystem) {
                    window.menuSystem.stopBackgroundProcessing();
                }
                
                this.score += amount;
                
                this.updateUI();
                this.updateShopDisplay();
                this.showMessage(`Added ${amount} score!`, 'success');
                document.getElementById('addScoreInput').value = '';
                
                // Force immediate save to prevent data loss
                this.saveGame();
                
                // Add a timestamp to prevent background processing from overwriting this change
                localStorage.setItem(`adminChange_${this.saveSlot}`, Date.now().toString());
            }
        };
        
        window.setScore = () => {
            const amount = parseInt(document.getElementById('setScoreInput').value) || 0;
            
            // Track admin command usage
            trackAdminCommand();
            
            // Completely stop background processing to prevent interference
            if (window.menuSystem) {
                window.menuSystem.stopBackgroundProcessing();
            }
            
            this.score = amount;
            
            this.updateUI();
            this.updateShopDisplay();
            this.showMessage(`Score set to ${amount}!`, 'success');
            document.getElementById('setScoreInput').value = '';
            
            // Force immediate save to prevent data loss
            this.saveGame();
            
            // Add a timestamp to prevent background processing from overwriting this change
            localStorage.setItem(`adminChange_${this.saveSlot}`, Date.now().toString());
        };
        
        // Shop functions
        window.setStock = () => {
            const seedType = document.getElementById('seedTypeSelect').value;
            const amount = parseInt(document.getElementById('setStockInput').value) || 0;
            
            if (seedType && this.shopInventory[seedType]) {
                this.shopInventory[seedType].stock = amount;
                
                this.updateShopDisplay();
                this.showMessage(`${seedType} stock set to ${amount}!`, 'success');
                document.getElementById('setStockInput').value = '';
                this.saveGame();
            } else {
                this.showMessage('Invalid seed type!', 'error');
            }
        };
        
        window.setRarity = () => {
    const seedTypeElement = document.getElementById('seedTypeSelect');
    const rarityElement = document.getElementById('raritySelect');
    
    if (!seedTypeElement || !rarityElement) {
        this.showMessage('Error: Admin panel elements not found!', 'error');
        return;
    }
    
    const seedType = seedTypeElement.value;
    const rarity = rarityElement.value;
    
    if (seedType && this.plantTypes[seedType]) {
        // Remove existing rarity flags
        delete this.plantTypes[seedType].isRare;
        delete this.plantTypes[seedType].isLegendary;
        
        // Set new rarity
        if (rarity === 'rare') {
            this.plantTypes[seedType].isRare = true;
        } else if (rarity === 'legendary') {
            this.plantTypes[seedType].isLegendary = true;
        } else if (rarity === 'common') {
            // Already removed flags above
        } else {
            this.showMessage(`Invalid rarity: ${rarity}!`, 'error');
            return;
        }
        
        // Update the visual appearance in the shop
        this.updateSeedRarityDisplay(seedType, rarity);
        
        this.updateShopDisplay();
        this.showMessage(`${seedType} rarity set to ${rarity}!`, 'success');
        this.saveGame();
    } else {
        this.showMessage(`Invalid seed type: ${seedType}!`, 'error');
    }
};
        
        window.restockAll = () => {
            Object.keys(this.shopInventory).forEach(seedType => {
                this.shopInventory[seedType].stock = this.shopInventory[seedType].maxStock;
            });
            
            this.updateShopDisplay();
            this.showMessage('All seeds restocked!', 'success');
            this.saveGame();
        };
        
        window.restockNow = () => {
            this.lastRestockTime = Date.now() - this.restockInterval; // restockInterval is already in milliseconds
            
            this.checkRestock();
            this.showMessage('Shop restocked!', 'success');
            this.saveGame();
        };
        
        // Tool functions
        window.upgradeTool = () => {
            const toolType = document.getElementById('toolTypeSelect').value;
            if (toolType && this.toolLevels[toolType]) {
                // Track admin command usage
                trackAdminCommand();
                
                // Admin command: upgrade tool without money cost
                if (this.toolLevels[toolType] < 5) {
                    this.toolLevels[toolType]++;
                    // Recompute next cost from unified pricing model
                    this.recomputeToolUpgradeCost(toolType);
                    
                    // Add resource bonuses for water and fertilizer tools
                    if (toolType === 'water') {
                        this.water += 10;
                    } else if (toolType === 'fertilizer') {
                        this.fertilizer += 5;
                    } else if (toolType === 'harvest') {
                        this.harvestBonus += 0.1;
                    }
                    
                    this.updateToolDisplay();
                    this.showMessage(`${toolType} tool upgraded to level ${this.toolLevels[toolType]}!`, 'success');
                    
                    this.saveGame();
                } else {
                    this.showMessage(`${toolType} tool is already at maximum level!`, 'error');
                }
            } else {
                this.showMessage('Invalid tool type!', 'error');
            }
        };
        
        // Sprinkler functions
        window.addSprinkler = () => {
            const sprinklerType = document.getElementById('sprinklerTypeSelect').value;
            const amount = parseInt(document.getElementById('addSprinklerInput').value) || 1;
            
            if (sprinklerType && this.sprinklerInventory[sprinklerType] !== undefined) {
                // Track admin command usage
                trackAdminCommand();
                
                this.sprinklerInventory[sprinklerType] += amount;
                
                this.updateSprinklerDisplay();
                this.showMessage(`Added ${amount} ${sprinklerType} sprinkler(s)!`, 'success');
                document.getElementById('addSprinklerInput').value = '';
                this.saveGame();
            } else {
                this.showMessage('Invalid sprinkler type!', 'error');
            }
        };
        
        window.clearSprinklers = () => {
            // Track admin command usage
            trackAdminCommand();
            
            this.sprinklers = [];
            
            this.updateSprinklerDisplay();
            this.showMessage('All sprinklers cleared!', 'success');
            this.saveGame();
        };
        
        // Purchase functions
        window.buyWater = () => {
            const waterCost = this.getWaterPurchasePrice();
            if (this.money >= waterCost) {
                this.money -= waterCost;
                this.water += 1;
                this.updateUI();
                this.showMessage(`💧 Water purchased for $${waterCost}! You can now water your plants.`, 'success');
                this.playSound('success');
                this.saveGame();
            } else {
                this.showMessage(`Not enough money to buy water! Cost: $${waterCost}`, 'error');
                this.playSound('error');
            }
        };
        
        window.buyFertilizer = () => {
            const fertilizerCost = this.getFertilizerPurchasePrice();
            if (this.money >= fertilizerCost) {
                this.money -= fertilizerCost;
                this.fertilizer += 1;
                this.updateUI();
                this.showMessage(`🌱 Fertilizer purchased for $${fertilizerCost}! You can now fertilize your plants.`, 'success');
                this.playSound('success');
                this.saveGame();
            } else {
                this.showMessage(`Not enough money to buy fertilizer! Cost: $${fertilizerCost}`, 'error');
                this.playSound('error');
            }
        };
        
        // Weather functions
        window.setWeather = () => {
            const weather = document.getElementById('weatherSelect').value;
            if (weather && ['sunny', 'rainy', 'cloudy', 'stormy'].includes(weather)) {
                this.weather = weather;
                
                this.updateUI();
                this.showMessage(`Weather set to ${weather}!`, 'success');
                this.saveGame();
            } else {
                this.showMessage('Invalid weather type!', 'error');
            }
        };
        
        window.setWeatherTime = () => {
            const minutes = parseInt(document.getElementById('weatherTimeInput').value) || 5;
            this.weatherChangeInterval = minutes * 60 * 1000;
            
            this.showMessage(`Weather change interval set to ${minutes} minutes!`, 'success');
            document.getElementById('weatherTimeInput').value = '';
            this.saveGame();
        };
        
        window.setRestockTime = () => {
            const inputElement = document.getElementById('restockTimeInput');
            if (!inputElement) {
                this.showMessage('Error: Restock time input not found!', 'error');
                return;
            }
            
            const minutes = parseInt(inputElement.value) || 5;
            this.restockInterval = minutes * 60 * 1000; // Convert minutes to milliseconds
            
            this.showMessage(`Restock interval set to ${minutes} minutes!`, 'success');
            inputElement.value = '';
            this.saveGame();
        };
        
        // Achievement functions
        window.unlockAchievement = () => {
            const achievement = document.getElementById('achievementSelect').value;
            if (achievement && this.achievements[achievement]) {
                this.unlockAchievement(achievement);
                this.showMessage(`Achievement "${achievement}" unlocked!`, 'success');
                this.saveGame();
            } else {
                this.showMessage('Invalid achievement!', 'error');
            }
        };
        
        window.showAchievements = () => {
            this.updateAchievementsDisplay();
            this.showMessage('Achievements updated!', 'success');
        };
        
        // Garden functions
        window.clearGarden = () => {
            // Reset garden size and expansion pricing as part of admin clear
            this.gardenSize = 8;
            this.gridSize = this.gardenSize;
            this.expansionCost = 1500;
            this.garden = this.initializeGarden();
            this.sprinklers = []; // Clear all sprinklers
            this.adjustCanvasForMobile();
            this.showMessage('Garden reset to 8x8 and sprinklers cleared!', 'success');
            this.saveGame();
            // Update the UI to reflect the cleared garden
            this.updateUI();
            this.draw(); // Redraw the canvas to show the cleared garden
        };
        
        // Sound functions
        window.toggleSound = () => {
            this.soundEnabled = !this.soundEnabled;
            this.showMessage(`Sound ${this.soundEnabled ? 'enabled' : 'disabled'}!`, 'success');
            this.saveGame();
        };
        
        // Save function - FIXED to properly reference current game instance
        window.saveGame = () => {
            if (window.menuSystem && window.menuSystem.currentGame) {
                window.menuSystem.currentGame.saveGame();
                window.menuSystem.currentGame.showMessage('Game saved manually!', 'success');
            } else {
                console.error('No current game instance found for saveGame');
            }
        };
        
        window.restartBackgroundProcessing = () => {
            if (window.menuSystem) {
                // Clear admin change timestamps for all slots when manually restarting
                for (let slot = 1; slot <= 3; slot++) {
                    localStorage.removeItem(`adminChange_${slot}`);
                }
                window.menuSystem.startBackgroundProcessing();
                this.showMessage('Background processing restarted!', 'success');
            }
        };
        
        // Add manual background processing control
        window.enableBackgroundProcessing = () => {
            if (window.menuSystem) {
                window.menuSystem.startBackgroundProcessing();
                this.showMessage('Background processing enabled!', 'success');
            }
        };
        
        window.disableBackgroundProcessing = () => {
            if (window.menuSystem) {
                window.menuSystem.stopBackgroundProcessing();
                this.showMessage('Background processing disabled!', 'success');
            }
        };
        

        
        // Add function to clear corrupted save data
        window.clearCorruptedSaves = () => {
            console.log('Clearing all corrupted save data...');
            let clearedCount = 0;
            for (let slot = 1; slot <= 3; slot++) {
                const saveData = localStorage.getItem(`gardenGameSave_${slot}`);
                if (saveData) {
                    try {
                        const data = JSON.parse(saveData);
                        if (data.saveSlot !== slot) {
                            console.log(`Clearing corrupted save data for slot ${slot} (contains data for slot ${data.saveSlot})`);
                            localStorage.removeItem(`gardenGameSave_${slot}`);
                            clearedCount++;
                        }
                    } catch (error) {
                        console.log(`Clearing corrupted save data for slot ${slot} (JSON parse error)`);
                        localStorage.removeItem(`gardenGameSave_${slot}`);
                        clearedCount++;
                    }
                }
            }
            this.showMessage(`Cleared ${clearedCount} corrupted save files!`, 'success');
            
            // Update the menu display
            if (window.menuSystem) {
                window.menuSystem.updateSaveSlots();
            }
        };
        
        // Add function to reset current slot
        window.resetCurrentSlot = () => {
            if (confirm('Are you sure you want to reset the current slot? This will clear all progress.')) {
                localStorage.removeItem(`gardenGameSave_${this.saveSlot}`);
                this.showMessage(`Slot ${this.saveSlot} reset!`, 'success');
                this.loadGame(); // Reload the current game
            }
        };
        
        // Add function to fix current slot if corrupted
        window.fixCurrentSlot = () => {
            const saveData = localStorage.getItem(`gardenGameSave_${this.saveSlot}`);
            if (saveData) {
                try {
                    const data = JSON.parse(saveData);
                    if (data.saveSlot !== this.saveSlot) {
                        // Clear the corrupted data and start fresh
                        localStorage.removeItem(`gardenGameSave_${this.saveSlot}`);
                        this.showMessage(`Slot ${this.saveSlot} fixed! Starting fresh.`, 'success');
                        this.loadGame(); // Reload with fresh data
                    } else {
                        this.showMessage(`Slot ${this.saveSlot} is not corrupted.`, 'info');
                    }
                } catch (error) {
                    localStorage.removeItem(`gardenGameSave_${this.saveSlot}`);
                    this.showMessage(`Slot ${this.saveSlot} fixed! Starting fresh.`, 'success');
                    this.loadGame(); // Reload with fresh data
                }
            } else {
                this.showMessage(`Slot ${this.saveSlot} is empty, no fix needed.`, 'info');
            }
        };
        
        // Add function to show background processing status
        window.showBackgroundStatus = () => {
            const isRunning = window.menuSystem && window.menuSystem.backgroundInterval !== null;
            const status = isRunning ? 'ENABLED' : 'DISABLED';
            const color = isRunning ? '#d63031' : '#00b894';
            this.showMessage(`Background processing: ${status}`, isRunning ? 'error' : 'success');
        };
        
        // Emergency recovery command
        window.emergencyReset = () => {
            if (window.menuSystem && window.menuSystem.currentGame) {
                const game = window.menuSystem.currentGame;
                
                // Stop the current game
                game.stopGame();
                
                // Clear any stuck states
                game.selectedSeed = null;
                game.selectedSprinkler = null;
                game.selectedDecoration = null;
                game.currentTool = 'water';
                
                // Clear performance monitoring
                game.lastPerformanceCheck = null;
                game.performanceCheckCount = 0;
                
                // Clear particles and animations
                if (game.particles) game.particles = [];
                if (game.animations) game.animations = [];
                
                // Restart the game
                game.isRunning = true;
                game.gameLoop();
                
                // Force UI update
                game.updateUI();
                game.updateShopDisplay();
                
                window.menuSystem.currentGame.showMessage('Emergency reset completed! Game should be working again.', 'success');
            } else {
                alert('Error: No game instance found. Please start a game first.');
            }
        };
        
        // Debug function to check current state
        window.debugState = () => {
            if (window.menuSystem && window.menuSystem.currentGame) {
                const game = window.menuSystem.currentGame;
                // Debug state information available in console
                game.showMessage('Debug info logged to console', 'info');
            } else {
                alert('Error: No game instance found. Please start a game first.');
            }
        };
        
        // ===== ADVANCED ADMIN FUNCTIONS =====
        
        // Challenge Management
        window.generateNewChallenges = () => {
            if (window.menuSystem && window.menuSystem.currentGame) {
                window.menuSystem.currentGame.generateChallenges();
                window.menuSystem.currentGame.updateChallengesDisplay();
                window.menuSystem.currentGame.showMessage('New challenges generated!', 'success');
            } else {
                console.error('No current game instance found');
                alert('Error: No game instance found. Please start a game first.');
            }
        };
        
        window.completeAllChallenges = () => {
            if (window.menuSystem && window.menuSystem.currentGame) {
                const { currentGame } = window.menuSystem;
                if (Array.isArray(currentGame.challenges.daily)) {
                    currentGame.challenges.daily.forEach(challenge => {
                        if (!challenge.completed) {
                            challenge.progress = challenge.target;
                            currentGame.completeChallenge(challenge);
                        }
                    });
                }
                if (currentGame.challenges.weekly && !currentGame.challenges.weekly.completed) {
                    currentGame.challenges.weekly.progress = currentGame.challenges.weekly.target;
                    currentGame.completeChallenge(currentGame.challenges.weekly);
                }
                currentGame.updateChallengesDisplay();
                currentGame.showMessage('All challenges completed!', 'success');
            } else {
                console.error('No current game instance found');
                alert('Error: No game instance found. Please start a game first.');
            }
        };
        
        window.resetChallenges = () => {
            if (window.menuSystem && window.menuSystem.currentGame) {
                window.menuSystem.currentGame.challenges = {
                    daily: [],
                    weekly: null,
                    completed: []
                };
                window.menuSystem.currentGame.generateChallenges();
                window.menuSystem.currentGame.updateChallengesDisplay();
                window.menuSystem.currentGame.showMessage('Challenges reset!', 'success');
            } else {
                console.error('No current game instance found');
                alert('Error: No game instance found. Please start a game first.');
            }
        };
        
        // Garden Management
        window.growAllPlants = () => {
            if (window.menuSystem && window.menuSystem.currentGame) {
                // Track admin command usage
                trackAdminCommand();
                
                let grownCount = 0;
                for (let x = 0; x < window.menuSystem.currentGame.gardenSize; x++) {
                    for (let y = 0; y < window.menuSystem.currentGame.gardenSize; y++) {
                        const cell = window.menuSystem.currentGame.garden[x][y];
                        if (cell && cell.plant && cell.plant.type) {
                            // Set plant to fully mature (last growth stage)
                            const maxStage = window.menuSystem.currentGame.growthStages.length - 1;
                            if (cell.plant.growthStage < maxStage) {
                                cell.plant.growthStage = maxStage;
                                cell.plant.isFullyGrown = true;
                                grownCount++;
                            }
                        }
                    }
                }
                window.menuSystem.currentGame.updateUI();
                window.menuSystem.currentGame.draw();
                window.menuSystem.currentGame.showMessage(`Grew ${grownCount} plants to full maturity!`, 'success');
            } else {
                console.error('No current game instance found');
                alert('Error: No game instance found. Please start a game first.');
            }
        };
        
        window.harvestAllPlants = () => {
            if (window.menuSystem && window.menuSystem.currentGame) {
                // Track admin command usage
                trackAdminCommand();
                
                try {
                    let harvestedCount = 0;
                    let totalValue = 0;
                    for (let x = 0; x < window.menuSystem.currentGame.gardenSize; x++) {
                        for (let y = 0; y < window.menuSystem.currentGame.gardenSize; y++) {
                            const cell = window.menuSystem.currentGame.garden[x][y];
                            if (cell && cell.plant && cell.plant.type && window.menuSystem.currentGame.getPlantGrowthStage(cell.plant) >= window.menuSystem.currentGame.growthStages.length - 1) {
                                const value = window.menuSystem.currentGame.getHarvestValue(cell.plant);
                                totalValue += value;
                                
                                // Clear the cell completely (same as individual harvestPlant)
                                window.menuSystem.currentGame.garden[x][y] = {
                                    plant: null,
                                    watered: false,
                                    wateredAt: null,
                                    waterCooldown: 0,
                                    fertilized: false,
                                    fertilizedAt: null,
                                    fertilizerCooldown: 0,
                                    plantedAt: null
                                };
                                harvestedCount++;
                            }
                        }
                    }
                    window.menuSystem.currentGame.money += totalValue;
                    window.menuSystem.currentGame.score += totalValue;
                    
                    // Force save and update
                    window.menuSystem.currentGame.saveGame();
                    window.menuSystem.currentGame.updateUI();
                    window.menuSystem.currentGame.updateShopDisplay();
                    window.menuSystem.currentGame.draw();
                    
                    window.menuSystem.currentGame.showMessage(`Harvested ${harvestedCount} plants for $${totalValue}!`, 'success');
                } catch (error) {
                    console.error('Error in harvestAllPlants:', error);
                    window.menuSystem.currentGame.showMessage('Error during harvest. Try the emergency reset.', 'error');
                }
            } else {
                console.error('No current game instance found');
                alert('Error: No game instance found. Please start a game first.');
            }
        };
        
        window.waterAllPlants = () => {
            if (window.menuSystem && window.menuSystem.currentGame) {
                // Track admin command usage
                trackAdminCommand();
                
                try {
                    let wateredCount = 0;
                    let totalPlants = 0;
                    const now = Date.now();
                    
                    for (let x = 0; x < window.menuSystem.currentGame.gardenSize; x++) {
                        for (let y = 0; y < window.menuSystem.currentGame.gardenSize; y++) {
                            const cell = window.menuSystem.currentGame.garden[x][y];
                            if (cell && cell.plant && cell.plant.type) {
                                totalPlants++;
                                // Check if plant is not fully grown by comparing growth stage
                                const growthStage = window.menuSystem.currentGame.getPlantGrowthStage(cell.plant);
                                const maxStage = window.menuSystem.currentGame.growthStages.length - 1;
                                
                                if (growthStage < maxStage) {
                                    // Use the same system as regular watering
                                    cell.watered = true;
                                    cell.wateredAt = now;
                                    cell.waterCooldown = now + 8000;
                                    wateredCount++;
                                }
                            }
                        }
                    }
                    

                    
                    window.menuSystem.currentGame.updateUI();
                    window.menuSystem.currentGame.draw();
                    window.menuSystem.currentGame.showMessage(`Watered ${wateredCount} plants!`, 'success');
                } catch (error) {
                    console.error('Error in waterAllPlants:', error);
                    window.menuSystem.currentGame.showMessage('Error during watering. Try the emergency reset.', 'error');
                }
            } else {
                console.error('No current game instance found');
                alert('Error: No game instance found. Please start a game first.');
            }
        };
        
        window.fertilizeAllPlants = () => {
            if (window.menuSystem && window.menuSystem.currentGame) {
                // Track admin command usage
                trackAdminCommand();
                
                try {
                    let fertilizedCount = 0;
                    let totalPlants = 0;
                    const now = Date.now();
                    
                    for (let x = 0; x < window.menuSystem.currentGame.gardenSize; x++) {
                        for (let y = 0; y < window.menuSystem.currentGame.gardenSize; y++) {
                            const cell = window.menuSystem.currentGame.garden[x][y];
                            if (cell && cell.plant && cell.plant.type) {
                                totalPlants++;
                                // Check if plant is not fully grown by comparing growth stage
                                const growthStage = window.menuSystem.currentGame.getPlantGrowthStage(cell.plant);
                                const maxStage = window.menuSystem.currentGame.growthStages.length - 1;
                                
                                if (growthStage < maxStage) {
                                    // Use the same system as regular fertilizing
                                    cell.fertilized = true;
                                    cell.fertilizedAt = now;
                                    cell.fertilizerCooldown = now + 12000;
                                    fertilizedCount++;
                                }
                            }
                        }
                    }
                    
                    
                    
                    window.menuSystem.currentGame.updateUI();
                    window.menuSystem.currentGame.draw();
                    window.menuSystem.currentGame.showMessage(`Fertilized ${fertilizedCount} plants!`, 'success');

                } catch (error) {
                    console.error('Error in fertilizeAllPlants:', error);
                    window.menuSystem.currentGame.showMessage('Error during fertilizing. Try the emergency reset.', 'error');
                }
            } else {
                console.error('No current game instance found');
                alert('Error: No game instance found. Please start a game first.');
            }
        };
        
        // Statistics & Data
        window.showDetailedStats = () => {
            const stats = {
                'Total Plants Harvested': this.stats.totalPlantsHarvested || 0,
                'Total Money Earned': `$${this.stats.totalMoneyEarned || 0}`,
                'Total Water Used': this.stats.totalWaterUsed || 0,
                'Total Fertilizer Used': this.stats.totalFertilizerUsed || 0,
                'Best Harvest Value': `$${this.stats.bestHarvest || 0}`,
                'Longest Play Session': `${Math.floor((this.stats.longestPlaySession || 0) / 60000)} minutes`,
                'Different Plants Planted': this.stats.plantsByType ? Object.keys(this.stats.plantsByType).length : 0,
                'Current Season': this.currentSeason || 'spring',
                'Season Day': this.seasonDay || 1,
                'Garden Size': `${this.gardenSize}x${this.gardenSize}`,
                'Active Sprinklers': this.sprinklers ? this.sprinklers.length : 0,
                'Completed Challenges': this.challenges.completed ? this.challenges.completed.length : 0,
                'Tool Levels': this.toolLevels,
                'Achievements Unlocked': Object.values(this.achievements).filter(a => a.unlocked).length,
                'Admin Panel Used': this.stats.adminPanelUsed ? 'Yes' : 'No',
                'Admin Panel Usage Count': this.stats.adminPanelUsageCount || 0
            };
            
            alert('Detailed statistics logged to console. Press F12 to view.');
            this.showMessage('Statistics logged to console!', 'info');
        };
        
        window.resetStats = () => {
            if (confirm('Are you sure you want to reset all statistics and garden data?')) {
                // Reset statistics
                this.stats = {
                    totalPlantsHarvested: 0,
                    totalMoneyEarned: 0,
                    totalWaterUsed: 0,
                    totalFertilizerUsed: 0,
                    plantsByType: {},
                    bestHarvest: 0,
                    longestPlaySession: 0,
                    sessionStartTime: Date.now(),
                    adminPanelUsed: false,
                    adminPanelUsageCount: 0
                };
                
                // Reset garden to initial state
                this.gardenSize = 8;
                this.gridSize = 8;
                this.cellSize = Math.floor(600 / this.gridSize);
                this.expansionCost = 1500;
                this.garden = this.initializeGarden();
                this.sprinklers = [];
                
                // Reset game state
                this.money = 100;
                this.water = 50;
                this.fertilizer = 25;
                this.score = 0;
                this.selectedSeed = null;
                this.selectedTool = null;
                this.selectedSprinkler = null;
                
                // Reset tools to level 1
                this.tools = {
                    water: 1,
                    fertilizer: 1,
                    harvest: 1
                };
                
                // Reset shop inventory with proper structure
                this.shopInventory = {
                    carrot: { stock: 7, maxStock: 10, restockAmount: 5 },
                    lettuce: { stock: 8, maxStock: 10, restockAmount: 5 },
                    tomato: { stock: 6, maxStock: 8, restockAmount: 4 },
                    corn: { stock: 4, maxStock: 6, restockAmount: 3 },
                    cucumber: { stock: 6, maxStock: 8, restockAmount: 4 },
                    zucchini: { stock: 5, maxStock: 7, restockAmount: 3 },
                    radish: { stock: 8, maxStock: 10, restockAmount: 5 },
                    spinach: { stock: 7, maxStock: 9, restockAmount: 4 },
                    peas: { stock: 8, maxStock: 10, restockAmount: 5 },
                    onion: { stock: 6, maxStock: 8, restockAmount: 4 },
                    garlic: { stock: 5, maxStock: 7, restockAmount: 3 },
                    potato: { stock: 6, maxStock: 8, restockAmount: 4 },
                    celery: { stock: 6, maxStock: 8, restockAmount: 4 },
                    bell_pepper: { stock: 4, maxStock: 6, restockAmount: 3 },
                    hot_pepper: { stock: 5, maxStock: 7, restockAmount: 3 },
                    avocado: { stock: 4, maxStock: 6, restockAmount: 3 },
                    eggplant: { stock: 4, maxStock: 6, restockAmount: 3 },
                    sweet_potato: { stock: 5, maxStock: 7, restockAmount: 3 },
                    mushroom: { stock: 4, maxStock: 6, restockAmount: 3 },
                    winter_greens: { stock: 4, maxStock: 6, restockAmount: 3 },
                    herbs: { stock: 6, maxStock: 8, restockAmount: 4 },
                    broccoli: { stock: 3, maxStock: 5, restockAmount: 2 },
                    cauliflower: { stock: 2, maxStock: 4, restockAmount: 2 },
                    cabbage: { stock: 5, maxStock: 7, restockAmount: 3 },
                    squash: { stock: 5, maxStock: 7, restockAmount: 3 },
                    pumpkin: { stock: 2, maxStock: 3, restockAmount: 1 },
                    watermelon: { stock: 2, maxStock: 3, restockAmount: 1 },
                    melon: { stock: 3, maxStock: 4, restockAmount: 2 },
                    blueberry: { stock: 3, maxStock: 4, restockAmount: 2 },
                    strawberry: { stock: 6, maxStock: 8, restockAmount: 4 },
                    banana: { stock: 6, maxStock: 8, restockAmount: 4 },
                    apple: { stock: 6, maxStock: 8, restockAmount: 4 },
                    green_apple: { stock: 5, maxStock: 7, restockAmount: 3 },
                    pear: { stock: 5, maxStock: 7, restockAmount: 3 },
                    peach: { stock: 5, maxStock: 7, restockAmount: 3 },
                    cherries: { stock: 6, maxStock: 8, restockAmount: 4 },
                    orange: { stock: 6, maxStock: 8, restockAmount: 4 },
                    lemon: { stock: 6, maxStock: 8, restockAmount: 4 },
                    kiwi: { stock: 2, maxStock: 3, restockAmount: 1 },
                    coconut: { stock: 1, maxStock: 2, restockAmount: 1 },
                    olive: { stock: 2, maxStock: 3, restockAmount: 1 },
                    asparagus: { stock: 3, maxStock: 4, restockAmount: 2 },
                    artichoke: { stock: 2, maxStock: 3, restockAmount: 1 },
                    grapes: { stock: 3, maxStock: 4, restockAmount: 2 },
                    pineapple: { stock: 1, maxStock: 2, restockAmount: 1 },
                    mango: { stock: 2, maxStock: 3, restockAmount: 1 },
                    dragonfruit: { stock: 1, maxStock: 1, restockAmount: 1 }
                };
                
                this.updateStatsDisplay();
                this.updateUI();
                this.saveGame();
                this.showMessage('Statistics and garden reset!', 'success');
            }
        };
        
        window.showGrowthRates = () => {
            this.showGrowthRates();
        };
        
        window.exportSaveData = () => {
            const saveData = {
                slot: this.saveSlot,
                data: localStorage.getItem(`gardenGameSave_${this.saveSlot}`),
                exportTime: new Date().toISOString()
            };
            const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `garden-game-slot-${this.saveSlot}-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.showMessage('Save data exported!', 'success');
        };
        
        window.importSaveData = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const importData = JSON.parse(e.target.result);
                            if (importData.slot && importData.data) {
                                localStorage.setItem(`gardenGameSave_${importData.slot}`, importData.data);
                                this.showMessage(`Save data imported for slot ${importData.slot}!`, 'success');
                                if (importData.slot == this.saveSlot) {
                                    this.loadGame();
                                }
                            } else {
                                this.showMessage('Invalid save data format!', 'error');
                            }
                        } catch (error) {
                            this.showMessage('Error importing save data!', 'error');
                        }
                    };
                    reader.readAsText(file);
                }
            };
            input.click();
        };
        


        
        window.setSeason = () => {
            const season = prompt('Enter season (spring/summer/fall/winter):');
            if (season && ['spring', 'summer', 'fall', 'winter'].includes(season)) {
                this.currentSeason = season;
                this.seasonDay = 1;
                this.updateSeasonMultiplier();
                this.updateSeasonDisplay(); // Force immediate season display update
                this.updateUI();
                this.saveGame(); // Save the season change
                this.showMessage(`Season set to ${season}!`, 'success');
            } else {
                this.showMessage('Invalid season!', 'error');
            }
        };
        
        // System
        window.clearAllSlots = () => {
            if (confirm('Are you sure you want to clear ALL save slots? This cannot be undone!')) {
                // Get current user info and token
                const token = localStorage.getItem('garden_game_token');
                const currentUser = window.multiplayer?.currentUser;
                
                if (token && currentUser) {
                    // Clear gardens from database first
                    fetch(`/api/admin/users/${currentUser.id}/clear-gardens`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.message) {
                            console.log('✅ Gardens cleared from database:', data.gardensCleared);
                        } else {
                            console.warn('⚠️ Could not clear gardens from database:', data.error);
                        }
                    })
                    .catch(error => {
                        console.error('❌ Error clearing gardens from database:', error);
                    })
                    .finally(() => {
                        // Always clear local storage regardless of server response
                        for (let slot = 1; slot <= 3; slot++) {
                            localStorage.removeItem(`gardenGameSave_${slot}`);
                        }
                        this.showMessage('All slots cleared!', 'success');
                        if (window.menuSystem) {
                            window.menuSystem.updateSaveSlots();
                        }
                        
                        // Refresh admin panel stats if we're in admin panel
                        if (typeof loadStats === 'function') {
                            loadStats();
                        }
                    });
                } else {
                    // Fallback: just clear local storage if no token/user info
                    for (let slot = 1; slot <= 3; slot++) {
                        localStorage.removeItem(`gardenGameSave_${slot}`);
                    }
                    this.showMessage('All slots cleared!', 'success');
                    if (window.menuSystem) {
                        window.menuSystem.updateSaveSlots();
                    }
                }
            }
        };
        
        window.backupGame = () => {
            const backup = {};
            for (let slot = 1; slot <= 3; slot++) {
                const saveData = localStorage.getItem(`gardenGameSave_${slot}`);
                if (saveData) {
                    backup[`slot_${slot}`] = saveData;
                }
            }
            backup.backupTime = new Date().toISOString();
            backup.backupVersion = '1.0';
            
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `garden-game-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.showMessage('Game backup created!', 'success');
        };
        
        window.restoreGame = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const backup = JSON.parse(e.target.result);
                            let restoredCount = 0;
                            for (let slot = 1; slot <= 3; slot++) {
                                if (backup[`slot_${slot}`]) {
                                    localStorage.setItem(`gardenGameSave_${slot}`, backup[`slot_${slot}`]);
                                    restoredCount++;
                                }
                            }
                            this.showMessage(`${restoredCount} slots restored from backup!`, 'success');
                            if (window.menuSystem) {
                                window.menuSystem.updateSaveSlots();
                            }
                        } catch (error) {
                            this.showMessage('Error restoring backup!', 'error');
                        }
                    };
                    reader.readAsText(file);
                }
            };
            input.click();
        };
    }
    
    selectSeed(seedType) {
        const plantData = this.plantTypes[seedType];
        const inventory = this.shopInventory[seedType];
        
        if (!plantData) {
            console.error(`No plant data found for ${seedType}`);
            this.showMessage(`Error: Invalid seed type ${seedType}!`, 'error');
            return;
        }
        
        if (!inventory) {
            console.error(`No inventory found for ${seedType}`);
            this.showMessage(`Error: No inventory data for ${seedType}!`, 'error');
            return;
        }
        
        // Allow selection regardless of current money or stock; enforce on planting instead
        // Keep a gentle heads-up if the seed can't be planted right now
        if (!this.isSeedAvailable(seedType)) {
            this.showMessage(`${plantData.name} is not available in ${this.currentSeason}.`, 'error');
        } else if (inventory.stock <= 0) {
            this.showMessage(`${plantData.name} is out of stock.`, 'error');
        } else if (this.money < plantData.cost) {
            this.showMessage(`Selected ${plantData.name}, but you're short on money.`, 'info');
        }

        this.selectedSeed = seedType;
        
        // Clear all previous selections in shop/tool areas
        document.querySelectorAll('.seed-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.sprinkler-tool').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add selection highlight in the shop list if present
        const seedElement = document.querySelector(`[data-seed="${seedType}"]`);
        if (seedElement) {
            seedElement.classList.add('selected');
        }
        
        // Update displays to reflect selection
        this.updateShopDisplay();
        try { this.updateQuickSeedsBar(); } catch (_) {}
    }
    
    selectTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const toolBtn = document.getElementById(`${tool}-btn`);
        if (toolBtn) {
            toolBtn.classList.add('active');
        } else {
            console.error('Tool button not found:', `${tool}-btn`);
        }
        this.selectedSeed = null;
        this.selectedSprinkler = null;
        this.selectedDecoration = null; // Clear decoration selection when selecting tools
        document.querySelectorAll('.seed-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelectorAll('.sprinkler-tool').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.decoration-item').forEach(item => {
            item.classList.remove('selected');
        });
        this.highlightQuickMenuSelection();
        // Update shop display when clearing seed selection
        this.updateShopDisplay();
        try { this.updateQuickSeedsBar(); } catch (_) {}
        this.hideToolQuickMenu();
    }
    
    selectSprinkler(sprinklerType) {
        this.selectedSprinkler = sprinklerType;
        this.currentTool = 'sprinkler';
        this.selectedSeed = null;
        this.selectedDecoration = null; // Clear decoration selection when selecting sprinklers
        
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.sprinkler-tool').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const sprinklerBtn = document.getElementById(`sprinkler-${sprinklerType}-btn`);
        if (sprinklerBtn) {
            sprinklerBtn.classList.add('active');
        }
        
        document.querySelectorAll('.seed-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelectorAll('.decoration-item').forEach(item => {
            item.classList.remove('selected');
        });
        // Update shop display when clearing seed selection
        this.updateShopDisplay();
        try { this.updateQuickSeedsBar(); } catch (_) {}
    }
    
    handleCanvasClick(e) {
        if (!this.canvas) {
            return;
        }

        this.hideToolQuickMenu();
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width ? this.canvas.width / rect.width : 1;
        const scaleY = rect.height ? this.canvas.height / rect.height : 1;
        
        // Handle both mouse and touch events
        let x, y;
        if (e.touches && e.touches[0]) {
            // Touch event
            x = (e.touches[0].clientX - rect.left) * scaleX;
            y = (e.touches[0].clientY - rect.top) * scaleY;
        } else {
            // Mouse event
            x = (e.clientX - rect.left) * scaleX;
            y = (e.clientY - rect.top) * scaleY;
        }
        
        // Calculate the grid offset
        const gridWidth = this.gridSize * this.cellSize;
        const gridHeight = this.gridSize * this.cellSize;
        const offsetX = (this.canvas.width - gridWidth) / 2;
        const offsetY = (this.canvas.height - gridHeight) / 2;
        
        // Adjust click coordinates for the offset
        const adjustedX = x - offsetX;
        const adjustedY = y - offsetY;
        
        const col = Math.floor(adjustedX / this.cellSize);
        const row = Math.floor(adjustedY / this.cellSize);
        
        if (row >= 0 && row < this.gridSize && col >= 0 && col < this.gridSize) {
            this.handleCellClick(row, col);
        }
    }
    
    handleMouseMove(e) {
        if (!this.canvas) {
            return;
        }
        const pointer = this.getPointerPosition(e);
        if (!pointer) {
            this.hideGardenTooltip();
            return;
        }

        const cellInfo = this.getCellFromClientPosition(pointer.clientX, pointer.clientY);
        const isTouchEvent = Boolean(e && e.touches && e.touches.length);
        if (isTouchEvent) {
            this.lastTouchPointer = { clientX: pointer.clientX, clientY: pointer.clientY };
        }

        this.canvas.style.cursor = 'pointer';

        if (!cellInfo || !cellInfo.withinGrid) {
            if (!isTouchEvent) {
                this.canvas.style.cursor = 'default';
            }
            if (!isTouchEvent || this.touchHoverActive) {
                this.hideGardenTooltip();
            }
            return;
        }

        const { row, col } = cellInfo;
        const cell = this.garden[row][col];
        const hasSprinklerHere = this.hasSprinkler(row, col);

        if (this.currentTool === 'harvest' && cell.plant && cell.plant.isFullyGrown) {
            this.canvas.style.cursor = 'crosshair';
        } else if (this.selectedSeed && !cell.plant && !hasSprinklerHere) {
            this.canvas.style.cursor = 'grab';
        } else if (this.currentTool === 'water' && cell.plant && !cell.watered && cell.waterCooldown <= Date.now()) {
            this.canvas.style.cursor = 'grab';
        } else if (this.currentTool === 'fertilizer' && cell.plant && !cell.fertilized && cell.fertilizerCooldown <= Date.now()) {
            this.canvas.style.cursor = 'grab';
        } else if (this.currentTool === 'shovel' && (cell.plant || hasSprinklerHere)) {
            this.canvas.style.cursor = 'crosshair';
        } else if (this.currentTool === 'sprinkler' && this.selectedSprinkler && !cell.plant && !hasSprinklerHere) {
            this.canvas.style.cursor = 'grab';
        }

        if (!isTouchEvent || this.touchHoverActive) {
            this.updateHoverTooltipForCell(row, col, pointer);
        }
    }
    
    handleCellClick(row, col) {
        const cell = this.garden[row][col];
        const hasSprinklerHere = this.hasSprinkler(row, col);
        
        if (this.selectedSeed && !cell.plant && !hasSprinklerHere) {
            this.plantSeed(row, col);
        } else if (this.currentTool === 'harvest' && cell.plant) {
            this.harvestPlant(row, col);
        } else if (this.currentTool === 'water' && cell.plant && !cell.watered && cell.waterCooldown <= Date.now()) {
            this.waterPlant(row, col);
        } else if (this.currentTool === 'fertilizer' && cell.plant && !cell.fertilized && cell.fertilizerCooldown <= Date.now()) {
            this.fertilizePlant(row, col);
        } else if (this.currentTool === 'shovel' && (cell.plant || hasSprinklerHere)) {
            if (cell.plant) {
                this.removePlant(row, col);
            } else {
                this.removeSprinkler(row, col);
            }
        } else if (this.currentTool === 'sprinkler' && this.selectedSprinkler && !cell.plant && !hasSprinklerHere) {
            this.placeSprinkler(row, col);
        } else if (this.selectedDecoration && !cell.plant && !hasSprinklerHere && !cell.decoration) {
            this.placeDecoration(row, col);
        } else if (this.currentTool === 'shovel' && cell.decoration) {
            this.removeDecoration(row, col);
        } else if (cell.plant) {
            // Show bonus info when clicking on plants without a specific action
            this.showBonusInfo(row, col);
            
            // Also show damage info if plant was recently damaged
            if (cell.plant.recentlyDamaged) {
                this.showMessage(`🌱 This plant was recently damaged by a storm!`, 'warning');
                // Clear the recently damaged flag after showing the message
                setTimeout(() => {
                    if (cell.plant) {
                        cell.plant.recentlyDamaged = false;
                    }
                }, 3000);
            }
        }
    }
    
    hasSprinkler(row, col) {
        return this.sprinklers.some(s => s.row === row && s.col === col);
    }
    
    getSprinklerBonus(row, col) {
        let totalBonus = 0;
        this.sprinklers.forEach(sprinkler => {
            const distance = Math.max(Math.abs(sprinkler.row - row), Math.abs(sprinkler.col - col));
            if (distance <= this.sprinklerTypes[sprinkler.type].range) {
                totalBonus += this.sprinklerTypes[sprinkler.type].growthBonus;
            }
        });
        return totalBonus;
    }
    
    getSprinklerWaterBonus(row, col) {
        let totalBonus = 0;
        this.sprinklers.forEach(sprinkler => {
            const distance = Math.max(Math.abs(sprinkler.row - row), Math.abs(sprinkler.col - col));
            if (distance <= this.sprinklerTypes[sprinkler.type].range) {
                totalBonus += this.sprinklerTypes[sprinkler.type].waterBonus;
            }
        });
        return totalBonus;
    }
    
    getSprinklerFertilizerBonus(row, col) {
        let totalBonus = 0;
        this.sprinklers.forEach(sprinkler => {
            const distance = Math.max(Math.abs(sprinkler.row - row), Math.abs(sprinkler.col - col));
            if (distance <= this.sprinklerTypes[sprinkler.type].range) {
                totalBonus += this.sprinklerTypes[sprinkler.type].fertilizerBonus;
            }
        });
        return totalBonus;
    }
    
    // Function to handle continuous growth from watering and fertilizing
    checkContinuousGrowth(row, col) {
        const cell = this.garden[row][col];
        if (!cell || !cell.plant || cell.plant.isFullyGrown) return;
        
        const now = Date.now();
        const plantData = this.plantTypes[cell.plant.type];
        if (!plantData) return;
        
        // Check water-based continuous growth
        if (cell.watered && cell.waterGrowthStart && cell.waterGrowthDuration) {
            const waterGrowthElapsed = now - cell.waterGrowthStart;
            if (waterGrowthElapsed < cell.waterGrowthDuration) {
                // Calculate growth progress (1 stage per 2 seconds when watered)
                let growthTimePerStage = 2000; // 2 seconds per stage (base)
                
                // Apply custom growth rate multiplier
                const seedType = cell.plant.type;
                const growthMultiplier = this.getSeedGrowthMultiplier(seedType);
                growthTimePerStage *= growthMultiplier;

                const decorationGrowthBonus = (cell.plant.bonuses?.growth || 0) / 100;
                if (decorationGrowthBonus > 0) {
                    growthTimePerStage /= (1 + decorationGrowthBonus);
                }
                
                const lastWaterGrowthCheck = cell.lastWaterGrowthCheck || cell.waterGrowthStart;
                const timeSinceLastCheck = now - lastWaterGrowthCheck;
                const growthProgress = timeSinceLastCheck / growthTimePerStage;
                

                
                if (growthProgress >= 1) {
                    // Advance growth stage
                    if (cell.plant.growthStage < this.growthStages.length - 1) {
                        cell.plant.growthStage++;
                        cell.lastWaterGrowthCheck = now;
                        
                        // Check if fully mature
                        if (cell.plant.growthStage >= this.growthStages.length - 1) {
                            cell.plant.isFullyGrown = true;
                            this.maybeUnlockSpeedGrower(row, col);
                        }
                        
                        this.saveGame();
                        this.updateUI();
                        this.draw(); // Force immediate redraw to show growth
                    }
                }
            } else {
                // Water growth period ended
                cell.watered = false;
                cell.waterGrowthStart = null;
                cell.waterGrowthDuration = null;
                cell.lastWaterGrowthCheck = null;
            }
        }
        
        // Check fertilizer-based continuous growth
        if (cell.fertilized && cell.fertilizerGrowthStart && cell.fertilizerGrowthDuration) {
            const fertilizerGrowthElapsed = now - cell.fertilizerGrowthStart;
            if (fertilizerGrowthElapsed < cell.fertilizerGrowthDuration) {
                // Calculate growth progress (1 stage per 1.5 seconds when fertilized)
                let growthTimePerStage = 1500; // 1.5 seconds per stage (base)
                
                // Apply custom growth rate multiplier
                const seedType = cell.plant.type;
                const growthMultiplier = this.getSeedGrowthMultiplier(seedType);
                growthTimePerStage *= growthMultiplier;

                const decorationGrowthBonus = (cell.plant.bonuses?.growth || 0) / 100;
                if (decorationGrowthBonus > 0) {
                    growthTimePerStage /= (1 + decorationGrowthBonus);
                }
                
                const lastFertilizerGrowthCheck = cell.lastFertilizerGrowthCheck || cell.fertilizerGrowthStart;
                const timeSinceLastCheck = now - lastFertilizerGrowthCheck;
                const growthProgress = timeSinceLastCheck / growthTimePerStage;
                

                
                if (growthProgress >= 1) {
                    // Advance growth stage
                    if (cell.plant.growthStage < this.growthStages.length - 1) {
                        cell.plant.growthStage++;
                        cell.lastFertilizerGrowthCheck = now;
                        
                        // Check if fully mature
                        if (cell.plant.growthStage >= this.growthStages.length - 1) {
                            cell.plant.isFullyGrown = true;
                            this.maybeUnlockSpeedGrower(row, col);
                        }
                        
                        this.saveGame();
                        this.updateUI();
                        this.draw(); // Force immediate redraw to show growth
                    }
                }
            } else {
                // Fertilizer growth period ended
                cell.fertilized = false;
                cell.fertilizerGrowthStart = null;
                cell.fertilizerGrowthDuration = null;
                cell.lastFertilizerGrowthCheck = null;
            }
        }
    }
    
    // Passive growth: slow stage advancement even without water/fertilizer/sprinkler
    // Intentionally conservative so boosters remain meaningfully faster
    checkPassiveGrowth(row, col) {
        const cell = this.garden[row][col];
        if (!cell || !cell.plant || cell.plant.isFullyGrown) return;
        if (!this.passiveGrowthEnabled) return;
        
        // Skip if any active boosted growth is ongoing (water/fertilizer window)
        const now = Date.now();
        const waterActive = cell.watered && cell.waterGrowthStart && cell.waterGrowthDuration && (now - cell.waterGrowthStart) < cell.waterGrowthDuration;
        const fertActive = cell.fertilized && cell.fertilizerGrowthStart && cell.fertilizerGrowthDuration && (now - cell.fertilizerGrowthStart) < cell.fertilizerGrowthDuration;
        if (waterActive || fertActive) return;
        
        // Skip passive tick if sprinkler growth applies to this tile
        const sprinklerBonus = this.getSprinklerBonus(row, col);
        if (sprinklerBonus > 0) return;
        
        const plantData = this.plantTypes[cell.plant.type];
        if (!plantData) return;
        
        // Base time per stage for passive growth
        let growthTimePerStage = Number.isFinite(this.passiveGrowthBaseMs) && this.passiveGrowthBaseMs > 0
            ? this.passiveGrowthBaseMs
            : 2 * 60 * 1000; // fallback: 2 minutes
        
        // Apply seed-specific growth multiplier only if enabled
        if (!this.passiveIgnoreSeedMultiplier) {
            const seedType = cell.plant.type;
            const growthMultiplier = this.getSeedGrowthMultiplier(seedType);
            growthTimePerStage *= growthMultiplier;
        }
        
        // Apply decorations that boost growth (same semantics as other growth paths)
        const decorationGrowthBonus = (cell.plant.bonuses?.growth || 0) / 100;
        if (decorationGrowthBonus > 0) {
            growthTimePerStage /= (1 + decorationGrowthBonus);
        }
        
        // Apply weather and seasonal multipliers only if enabled (higher means faster growth => divide time)
        if (!this.passiveIgnoreEnvMultipliers) {
            const weatherMult = (this.weatherEffects[this.weather]?.growthMultiplier) || 1.0;
            const seasonMult = this.seasonMultiplier || 1.0;
            growthTimePerStage /= weatherMult;
            growthTimePerStage /= seasonMult;
        }
        
        // Track per-cell passive timing
        if (!cell.lastPassiveGrowth) {
            cell.lastPassiveGrowth = now;
            return;
        }
        
        const elapsed = now - cell.lastPassiveGrowth;
        if (elapsed >= growthTimePerStage) {
            if (cell.plant.growthStage < this.growthStages.length - 1) {
                cell.plant.growthStage++;
                cell.lastPassiveGrowth = now;
                
                // Fully grown check
                if (cell.plant.growthStage >= this.growthStages.length - 1) {
                    cell.plant.isFullyGrown = true;
                    this.maybeUnlockSpeedGrower(row, col);
                }
                
                // Persist and reflect
                this.saveGame();
                this.updateUI();
                this.draw();
            }
        }
    }
    
    // Helper functions to identify seed rarity
    isRareSeed(seedType) {
        const rareSeeds = ['watermelon', 'melon', 'blueberry', 'kiwi', 'coconut', 'olive', 'asparagus', 'artichoke'];
        return rareSeeds.includes(seedType);
    }
    
    isLegendarySeed(seedType) {
        const legendarySeeds = ['dragonfruit', 'pineapple', 'mango', 'grapes'];
        return legendarySeeds.includes(seedType);
    }
    
    // Admin function to check current growth rates for all seeds
    showGrowthRates() {
        const allSeeds = Object.keys(this.plantTypes);
        allSeeds.forEach(seedType => {
            const multiplier = this.getSeedGrowthMultiplier(seedType);
            const waterTime = (2000 * multiplier / 1000).toFixed(1);
            const fertilizerTime = (1500 * multiplier / 1000).toFixed(1);
            const sprinklerTime = (30000 * multiplier / 1000).toFixed(0);
            
            console.log(`${seedType}: ${multiplier}x (Water: ${waterTime}s, Fertilizer: ${fertilizerTime}s, Sprinkler: ${sprinklerTime}s)`);
        });
        
        this.showMessage('Growth rates logged to console!', 'info');
    }
    
    // New flexible growth rate system - customize individual seed growth speeds
    getSeedGrowthMultiplier(seedType) {
        // Custom growth multipliers for individual seeds
        const customGrowthRates = {
            // Fast growing seeds (0.5x time = 2x faster)
            'carrot': 0.5,
            'lettuce': 0.5,
            'radish': 0.5,
            'spinach': 0.6,
            'tomato': 0.7,
            
            // Normal growing seeds (1.0x time = standard speed)
            'corn': 1.0,
            'potato': 1.0,
            'bell_pepper': 1.0,
            'hot_pepper': 0.9,
            'cucumber': 1.0,
            'onion': 1.0,
            'garlic': 1.0,
            'broccoli': 1.0,
            'cauliflower': 1.0,
            'cabbage': 1.0,
            'squash': 1.0,
            'winter_greens': 1.0,
            'herbs': 1.0,
            'peas': 1.0,
            'mushroom': 0.9,
            
            // Slow growing seeds (1.5x time = 1.5x slower)
            'pumpkin': 1.5,
            'sweet_potato': 1.4,
            'eggplant': 1.5,
            'avocado': 1.6,
            
            // Rare seeds - individual growth rates
            'watermelon': 2.5,
            'melon': 2.2,
            'blueberry': 2.0,
            'kiwi': 1.8,
            'coconut': 2.6,
            'olive': 2.4,
            'asparagus': 2.0,
            'artichoke': 2.8,
            
            // Legendary seeds - individual growth rates
            'dragonfruit': 4.0,   // Slowest legendary (very rare)
            'pineapple': 3.5,     // Very slow growing
            'mango': 2.8,         // Faster than other legendary seeds
            'grapes': 3.6,

            // Orchard fruits
            'apple': 1.6,
            'green_apple': 1.6,
            'pear': 1.7,
            'peach': 1.7,
            'cherries': 1.3,
            'strawberry': 1.2,
            'orange': 1.5,
            'lemon': 1.2,
            'banana': 1.8
        };
        
        // Return custom rate if defined, otherwise use rarity-based fallback
        if (customGrowthRates.hasOwnProperty(seedType)) {
            return customGrowthRates[seedType];
        }
        
        // Fallback to old rarity system for any undefined seeds
        if (this.isLegendarySeed(seedType)) {
            return 3.0;
        } else if (this.isRareSeed(seedType)) {
            return 2.0;
        }
        
        return 1.0; // Default normal speed
    }
    
    // New function to check if sprinklers should advance plant growth
    checkSprinklerGrowth(row, col) {
        const cell = this.garden[row][col];
        if (!cell || !cell.plant || cell.plant.isFullyGrown) return;
        
        const plantData = this.plantTypes[cell.plant.type];
        if (!plantData) return;
        
        // Check if plant is within sprinkler range
        const sprinklerBonus = this.getSprinklerBonus(row, col);
        if (sprinklerBonus > 0) {
            // Calculate continuous growth based on time
            const now = Date.now();
            
            // Initialize lastSprinklerGrowth if it doesn't exist
            if (!cell.lastSprinklerGrowth) {
                cell.lastSprinklerGrowth = now;
                return; // Skip this frame to start timing from now
            }
            
            const timeSinceLastCheck = now - cell.lastSprinklerGrowth;
            
            // Growth rate: 1 stage per 30 seconds with sprinkler (base)
            let growthTimePerStage = 30000; // 30 seconds per stage (base)
            
            // Apply sprinkler growth bonus (faster growth with better sprinklers)
            growthTimePerStage = growthTimePerStage / (1 + sprinklerBonus);
            
            // Apply custom growth rate multiplier
            const seedType = cell.plant.type;
            const growthMultiplier = this.getSeedGrowthMultiplier(seedType);
            growthTimePerStage *= growthMultiplier;

            const decorationGrowthBonus = (cell.plant.bonuses?.growth || 0) / 100;
            if (decorationGrowthBonus > 0) {
                growthTimePerStage /= (1 + decorationGrowthBonus);
            }
            
            const growthProgress = timeSinceLastCheck / growthTimePerStage;
            
            if (growthProgress >= 1) {
                // Advance growth stage
                if (cell.plant.growthStage < this.growthStages.length - 1) {
                    cell.plant.growthStage++;
                    cell.lastSprinklerGrowth = now;
                    
                    // Show growth message
                    this.showMessage(`${plantData.name} grew from sprinkler!`, 'success');
                    console.log(`${plantData.name} grew to stage ${cell.plant.growthStage + 1}/${this.growthStages.length} from sprinkler`);
                    
                    // Check if fully mature
                    if (cell.plant.growthStage >= this.growthStages.length - 1) {
                        cell.plant.isFullyGrown = true;
                        this.maybeUnlockSpeedGrower(row, col);
                    }
                    
                    // Save game and update UI
                    this.saveGame();
                    this.updateUI();
                    this.draw(); // Force immediate redraw to show growth
                }
            }
        }
    }
    
    // Check sprinkler growth for all plants in the garden
    checkAllSprinklerGrowth() {
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                this.checkSprinklerGrowth(row, col);
            }
        }
    }
    
    // Unlock Speed Grower if a plant reached maturity within 30 seconds of planting
    maybeUnlockSpeedGrower(row, col) {
        try {
            if (!this.achievements || !this.achievements.speedGrower || this.achievements.speedGrower.unlocked) return;
            const cell = this.garden?.[row]?.[col];
            if (!cell || !cell.plant || !cell.plant.isFullyGrown) return;
            const plantedAt = Number(cell.plantedAt || cell.plant.plantedAt);
            if (!Number.isFinite(plantedAt) || plantedAt <= 0) return;
            const now = Date.now();
            if ((now - plantedAt) <= 30000) {
                this.unlockAchievement('speedGrower');
                this.achievementStats.speedGrowerUnlocked = true;
            }
        } catch (e) {
            console.warn('maybeUnlockSpeedGrower error:', e);
        }
    }
    
    plantSeed(row, col) {
        const seedType = this.selectedSeed;
        
        // Validate seed selection
        if (!seedType) {
            this.showMessage('No seed selected!', 'error');
            this.playSound('error');
            return;
        }
        
        const seedData = this.plantTypes[seedType];
        const inventory = this.shopInventory[seedType];
        const baseCost = this.getSeedBaseCost(seedData);
        const effectiveCost = this.getDiscountedSeedCost(baseCost);
        
        // Validate seed data
        if (!seedData) {
            console.error(`No plant data found for ${seedType}`);
            this.showMessage(`Error: Invalid seed type ${seedType}!`, 'error');
            this.playSound('error');
            return;
        }
        
        if (!inventory) {
            console.error(`No inventory found for ${seedType}`);
            this.showMessage(`Error: No inventory data for ${seedType}!`, 'error');
            this.playSound('error');
            return;
        }
        
        // Check seasonal availability
        if (!this.isSeedAvailable(seedType)) {
            this.showMessage(`${seedData.name} is not available in ${this.currentSeason}!`, 'error');
            this.playSound('error');
            return;
        }
        
        // Validate stock
        if (inventory.stock <= 0) {
            this.showMessage(`${seedData.name} is out of stock!`, 'error');
            this.playSound('error');
            return;
        }
        
        // Validate money
        if (this.money < effectiveCost) {
            this.showMessage(`Not enough money! Need $${effectiveCost.toLocaleString()}`, 'error');
            this.playSound('error');
            return;
        }
        
        // Check if there's already a plant here
        const cell = this.garden[row][col];
        if (cell.plant) {
            this.showMessage('There\'s already a plant here!', 'error');
            this.playSound('error');
            return;
        }
        
        // Check if there's a sprinkler here
        if (this.hasSprinkler(row, col)) {
            this.showMessage('Cannot plant on a sprinkler!', 'error');
            this.playSound('error');
            return;
        }
        
        // All validations passed, proceed with planting
        
        // Deduct money and reduce stock
            this.money -= effectiveCost;
            inventory.stock--;
            
        // Create the plant with growth stages
        const plantObject = {
                    type: seedType,
                    stage: 0,
                    plantedAt: Date.now(),
            isFullyGrown: false,
            growthStage: 0,
            purchaseCost: effectiveCost
        };
        
        // Create the garden cell with the plant
        this.garden[row][col] = {
            plant: plantObject,
                watered: false,
                wateredAt: null,
                waterCooldown: 0,
                fertilized: false,
                fertilizedAt: null,
                fertilizerCooldown: 0,
                plantedAt: Date.now()
            };
        
        // Apply any existing global decoration bonuses to this new plant so globals affect newly planted seeds
        this.applyAllGlobalBonusesToCell(row, col);
        
        // Verify the plant was actually created
        if (!this.garden[row][col].plant) {
            this.showMessage(`Error: Failed to plant ${seedData.name}!`, 'error');
            return;
        }
            
            this.showMessage(`Planted ${seedData.name}!`, 'success');
            this.playSound('plant');
            this.achievementStats.plantsPlanted++;
            this.achievementStats.differentPlantsPlanted.add(seedType);
            
            // Update daily challenge progress for planting
            this.updateChallengeProgress('plant', 1);
            
            // Add plant particle effect
            const x = (col * this.cellSize) + (this.cellSize / 2);
            const y = (row * this.cellSize) + (this.cellSize / 2);
            this.addParticle(x, y, 'plant', '');
            // Gentle soft burst
            this.spawnGentleBurst(x, y, 'plant', 12);
        
        // Save immediately to ensure plant is persisted
        this.saveGame();
        
        // Update UI immediately and force redraw
            this.updateUI();
        this.draw(); // Force immediate redraw to show the new plant
        
        // Keep seed selected for continued planting
        // (Removed seed selection clearing to allow multiple plantings of same seed)
        
        // Update shop display to reflect stock changes
            this.updateShopDisplay();
            
        // Force another save and update after a brief delay to ensure everything is saved
        setTimeout(() => {
            this.saveGame();
            this.updateShopDisplay();
            this.draw(); // Force another redraw
        }, 100);
    }
    
    waterPlant(row, col) {
        const cell = this.garden[row][col];
        const now = Date.now();
        
        if (cell.waterCooldown > now) {
            const remainingTime = Math.ceil((cell.waterCooldown - now) / 1000);
            this.showMessage(`Water cooldown: ${remainingTime}s remaining`, 'error');
            return;
        }
        
        const plantWaterBonus = (cell.plant?.bonuses?.waterEfficiency || 0) / 100;
        const sprinklerWaterBonus = this.getSprinklerWaterBonus(row, col);
        const totalWaterBonus = sprinklerWaterBonus + plantWaterBonus;
        const waterUsed = Math.max(0, Math.ceil(1 - totalWaterBonus));

        if (this.water <= 0 && waterUsed > 0) {
            this.showMessage('No water left!', 'error');
            this.playSound('error');
            return;
        }
        
        if (this.water > 0 || waterUsed === 0) {
            if (waterUsed > 0) {
                this.water -= waterUsed;
                this.updateStats('water', waterUsed);
            }
            
            const effectiveWaterBonus = totalWaterBonus;
            const bonusSegments = [];
            if (sprinklerWaterBonus > 0) {
                bonusSegments.push(`${Math.round(sprinklerWaterBonus * 100)}% from sprinklers`);
            }
            if (plantWaterBonus > 0) {
                bonusSegments.push(`${Math.round(plantWaterBonus * 100)}% from decorations`);
            }
            const bonusText = bonusSegments.length ? ` (${bonusSegments.join(' + ')})` : '';
            
            const growthDuration = Math.round(8000 * (1 + effectiveWaterBonus));
            
            cell.watered = true;
            cell.wateredAt = now;
            cell.waterCooldown = now + 8000;
            
            // Start continuous growth when watered
            if (cell.plant && cell.plant.growthStage < this.growthStages.length - 1) {
                const plantData = this.plantTypes[cell.plant.type];
                this.showMessage(`${plantData.name} watered! Will grow continuously for ${(growthDuration / 1000).toFixed(1)} seconds!${bonusText}`, 'success');
                
                // Set up continuous growth tracking
                cell.waterGrowthStart = now;
                cell.waterGrowthDuration = growthDuration;
            } else {
                const plantData = this.plantTypes[cell.plant.type];
                this.showMessage(`${plantData.name} watered! (Already fully grown)${bonusText}`, 'success');
            }
            
            // Update daily challenge progress for watering
            this.updateChallengeProgress('water', 1);
            
            this.playSound('water');
            this.achievementStats.plantsWatered++;
            
            // Add water particle effect
            const x = (col * this.cellSize) + (this.cellSize / 2);
            const y = (row * this.cellSize) + (this.cellSize / 2);
            this.addParticle(x, y, 'water', '');
            // Gentle soft burst
            this.spawnGentleBurst(x, y, 'water', 12);
            
            this.updateUI();
            this.saveGame();
        }
    }
    
    fertilizePlant(row, col) {
        const cell = this.garden[row][col];
        const now = Date.now();
        
        if (cell.fertilizerCooldown > now) {
            const remainingTime = Math.ceil((cell.fertilizerCooldown - now) / 1000);
            this.showMessage(`Fertilizer cooldown: ${remainingTime}s remaining`, 'error');
            return;
        }
        
            const fertilizerBonus = this.getSprinklerFertilizerBonus(row, col);
            const fertilizerUsed = fertilizerBonus > 0 ? 0 : 1; // Existing behavior: any bonus grants free fertilizer

            if (this.fertilizer <= 0 && fertilizerUsed > 0) {
                this.showMessage('No fertilizer left!', 'error');
                this.playSound('error');
                return;
            }

            if (this.fertilizer > 0 || fertilizerUsed === 0) {
                const fertilizerEfficiency = 1 + fertilizerBonus; // e.g., 1.1 for 10% bonus

                if (fertilizerUsed > 0) {
                    this.fertilizer -= fertilizerUsed;
                    this.updateStats('fertilizer', fertilizerUsed);
                }
            
            cell.fertilized = true;
            cell.fertilizedAt = now;
            cell.fertilizerCooldown = now + 12000;
            
            // Start continuous growth when fertilized
            if (cell.plant && cell.plant.growthStage < this.growthStages.length - 1) {
                const plantData = this.plantTypes[cell.plant.type];
                const bonusText = fertilizerBonus > 0 ? ` (${Math.round(fertilizerBonus * 100)}% fertilizer efficiency from sprinkler!)` : '';
                this.showMessage(`${plantData.name} fertilized! Will grow continuously for 12 seconds!${bonusText}`, 'success');
                
                // Set up continuous growth tracking
                cell.fertilizerGrowthStart = now;
                cell.fertilizerGrowthDuration = 12000; // 12 seconds of continuous growth
            } else {
                const plantData = this.plantTypes[cell.plant.type];
                const bonusText = fertilizerBonus > 0 ? ` (${Math.round(fertilizerBonus * 100)}% fertilizer efficiency from sprinkler!)` : '';
                this.showMessage(`${plantData.name} fertilized! (Already fully grown)${bonusText}`, 'success');
            }
            
            this.playSound('fertilizer');
            this.achievementStats.plantsFertilized++;
            
            // Add fertilizer particle effect
            const x = (col * this.cellSize) + (this.cellSize / 2);
            const y = (row * this.cellSize) + (this.cellSize / 2);
            this.addParticle(x, y, 'fertilizer', '');
            // Gentle soft burst
            this.spawnGentleBurst(x, y, 'fertilizer', 12);

            this.updateChallengeProgress('fertilize', 1);
            
            this.updateUI();
            this.saveGame();
        }
    }
    
    harvestPlant(row, col) {
        const cell = this.garden[row][col];
        if (cell.plant) {
            const plantData = this.plantTypes[cell.plant.type];
            
            // Calculate harvest value with growth stages and bonus from upgraded harvest tool
            const baseValue = plantData.harvestValue;
            const growthStage = this.getPlantGrowthStage(cell.plant);
            const stageMultiplier = this.stageMultipliers[growthStage] || 1.0;
            const bonusMultiplier = 1 + this.harvestBonus;
            const rebirthMultiplier = 1 + this.getRebirthHarvestBonus();
            const prestigeMultiplier = 1 + this.getPrestigeHarvestBonus();
            const harvestDecorationBonus = (cell.plant.bonuses?.harvestValue || 0) / 100;
            const baseHarvest = Math.floor(baseValue * stageMultiplier);
            const finalValue = Math.floor(baseHarvest * bonusMultiplier * rebirthMultiplier * prestigeMultiplier * (1 + harvestDecorationBonus));
            
            this.money += finalValue;
            this.score += finalValue;
            this.achievementStats.totalHarvests++;
            this.achievementStats.totalMoney += finalValue;
            
            // Update statistics
            this.updateStats('harvest', 1);
            this.updateStats('money', finalValue);
            this.updateStats('plant', cell.plant.type);
            
            // Update challenge progress
            this.updateChallengeProgress('harvest', 1);
            this.updateChallengeProgress('money', finalValue);
            
            // Update rare/legendary challenge progress
            if (plantData.isRare) {
                this.updateChallengeProgress('rare', 1);
                this.achievementStats.rareHarvests++;
            }
            if (plantData.isLegendary) {
                this.updateChallengeProgress('legendary', 1);
                this.achievementStats.legendaryHarvests++;
            }
            
            // Add particle effect
            const x = (col * this.cellSize) + (this.cellSize / 2);
            const y = (row * this.cellSize) + (this.cellSize / 2);
            this.addParticle(x, y, 'money', finalValue);
            // Gentle soft burst
            this.spawnGentleBurst(x, y, 'harvest', 14);
            
            // Show bonus message if harvest tool is upgraded
            if (this.harvestBonus > 0 || harvestDecorationBonus > 0 || this.rebirths > 0 || this.getPrestigeHarvestBonus() > 0) {
                const bonusAmount = finalValue - baseHarvest;
                const bonusBreakdown = [];
                if (this.harvestBonus > 0) {
                    bonusBreakdown.push(`${Math.round(this.harvestBonus * 100)}% tool bonus`);
                }
                if (harvestDecorationBonus > 0) {
                    bonusBreakdown.push(`${Math.round(harvestDecorationBonus * 100)}% decoration bonus`);
                }
                if (this.rebirths > 0) {
                    bonusBreakdown.push(`${Math.round(this.getRebirthHarvestBonus() * 100)}% rebirth boost`);
                }
                if (this.getPrestigeHarvestBonus() > 0) {
                    bonusBreakdown.push(`${Math.round(this.getPrestigeHarvestBonus() * 100)}% prestige bonus`);
                }
                const breakdownText = bonusBreakdown.length ? ` (+$${bonusAmount} from ${bonusBreakdown.join(' & ')})` : '';
                this.showMessage(`Harvested ${plantData.name} for $${finalValue}!${breakdownText}`, 'success');
            } else {
                this.showMessage(`Harvested ${plantData.name} for $${finalValue}!`, 'success');
            }
            this.playSound('harvest');
            this.playSound('money');
            
            // Clear the cell completely
            this.garden[row][col] = {
                plant: null,
                watered: false,
                wateredAt: null,
                waterCooldown: 0,
                fertilized: false,
                fertilizedAt: null,
                fertilizerCooldown: 0,
                plantedAt: null
            };
            
            this.updateUI();
            this.saveGame();
        }
    }
    
    removePlant(row, col) {
        const cell = this.garden[row][col];
        if (cell.plant) {
            const plantData = this.plantTypes[cell.plant.type];
            const baseCost = this.getSeedBaseCost(plantData);
            const purchaseCost = cell.plant?.purchaseCost ?? baseCost;
            const refundAmount = this.grantShovelRefund(purchaseCost, row, col);
            const refundRatePercent = Math.round(this.getShovelRefundRate() * 100);
            const refundText = refundAmount > 0 ? ` Returned ${refundRatePercent}% ($${refundAmount}).` : '';
            this.showMessage(`Removed ${plantData.name}!${refundText}`, refundAmount > 0 ? 'success' : 'info');
            
            this.garden[row][col] = {
                plant: null,
                watered: false,
                wateredAt: null,
                waterCooldown: 0,
                fertilized: false,
                fertilizedAt: null,
                fertilizerCooldown: 0,
                plantedAt: null
            };
            // Gentle soft burst for shovel/remove
            const x = (col * this.cellSize) + (this.cellSize / 2);
            const y = (row * this.cellSize) + (this.cellSize / 2);
            this.spawnGentleBurst(x, y, 'remove', 10);
            
            this.updateUI();
            this.saveGame();
        }
    }
    
    updatePlants() {
        this.updatePlantsSilent();
    }
    
    updatePlantsSilent() {
        const now = Date.now();
        
        // Check for expired sprinklers
        this.sprinklers = this.sprinklers.filter(sprinkler => {
            if (now >= sprinkler.expiresAt) {
                const sprinklerData = this.sprinklerTypes[sprinkler.type];
                const durationMinutes = Math.floor(sprinklerData.duration / 60000);
                this.showMessage(`${sprinkler.type} sprinkler expired after ${durationMinutes} minutes!`, 'info');
                return false; // Remove expired sprinkler
            }
            return true; // Keep active sprinkler
        });
        
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const cell = this.garden[row][col];
                if (cell.plant && !cell.plant.isFullyGrown) {
                    const plantData = this.plantTypes[cell.plant.type];
                    const timeSincePlanted = now - cell.plantedAt;
                    const growthProgress = timeSincePlanted / plantData.growthTime;
                    
                    if (cell.watered && cell.wateredAt && (now - cell.wateredAt) > 15000) {
                        cell.watered = false;
                        cell.wateredAt = null;
                    }
                    
                    if (cell.fertilized && cell.fertilizedAt && (now - cell.fertilizedAt) > 20000) {
                        cell.fertilized = false;
                        cell.fertilizedAt = null;
                    }
                    
                    let growthMultiplier = 0.3;
                    if (cell.watered) growthMultiplier = 1.8;
                    if (cell.fertilized) growthMultiplier = 2.5;
                    if (cell.watered && cell.fertilized) growthMultiplier = 3.2;
                    
                    // Apply sprinkler effects
                    const sprinklerBonus = this.getSprinklerBonus(row, col);
                    growthMultiplier += sprinklerBonus;
                    
                    // Apply weather effects
                    growthMultiplier *= this.weatherEffects[this.weather].growthMultiplier;
                    
                    // Apply seasonal effects
                    growthMultiplier *= this.seasonMultiplier;
                    
                    // Plants now only grow when watered or fertilized
                    // No automatic growth updates in the game loop
                    
                    // Check if plant is fully mature for achievement tracking
                    const currentStage = this.getPlantGrowthStage(cell.plant);
                    if (currentStage >= this.growthStages.length - 1 && !cell.plant.isFullyGrown) {
                        cell.plant.isFullyGrown = true;
                    }
                    
                    // Check for continuous growth from watering and fertilizing
                    this.checkContinuousGrowth(row, col);
                    
                    // Check for sprinkler growth
                    this.checkSprinklerGrowth(row, col);
                    
                    // Check for slow passive growth (no boosters)
                    this.checkPassiveGrowth(row, col);
                }
            }
        }
    }
    
    checkRestock() {
        this.checkRestockSilent();
    }
    
    checkRestockSilent() {
        const now = Date.now();
        const timeSinceLastRestock = now - this.lastRestockTime;
        
        if (timeSinceLastRestock >= this.restockInterval) {
            this.restockShopSilent();
            this.lastRestockTime = now;
            this.updateShopDisplay(); // Force update the shop display
        }
    }
    
    restockShop() {
        this.restockShopSilent();
        this.updateShopDisplay();
        this.showMessage('Shop restocked!', 'info');
    }
    
    restockShopSilent() {
        let restockedSeeds = [];
        
        for (const [seedType, inventory] of Object.entries(this.shopInventory)) {
            const plantData = this.plantTypes[seedType];
            
            if (inventory.stock < inventory.maxStock) {
                let shouldRestock = true;
                let restockAmount = inventory.restockAmount;
                
                // Check rare and legendary restock chances
                if (plantData.isRare && Math.random() > this.rareRestockChance) {
                    shouldRestock = false;
                }
                if (plantData.isLegendary && Math.random() > this.legendaryRestockChance) {
                    shouldRestock = false;
                }
                
                if (shouldRestock) {
                    // For rare and legendary seeds, give higher quantities when they do restock
                    if (plantData.isRare) {
                        restockAmount = inventory.restockAmount * 3; // Triple the amount
                    } else if (plantData.isLegendary) {
                        restockAmount = inventory.restockAmount * 5; // 5x the amount
                    }
                    
                    // Ensure we don't exceed max stock
                    restockAmount = Math.min(
                        restockAmount,
                        inventory.maxStock - inventory.stock
                    );
                    
                    if (restockAmount > 0) {
                        const oldStock = inventory.stock;
                        inventory.stock += restockAmount;
                        restockedSeeds.push(`${plantData.name} (${oldStock}→${inventory.stock})`);
                    }
                }
            }
        }
        
        if (restockedSeeds.length > 0) {
            this.showMessage(`Shop restocked: ${restockedSeeds.join(', ')}`, 'info');
            
            // Force immediate shop display update
            setTimeout(() => {
                this.updateShopDisplay();
            }, 100);
        }
    }
    
    draw() {
        if (!this.canvas || !this.ctx) {
            return;
        }
        
        // Ensure globalAlpha is reset to 1 at the start of each draw cycle
        this.ctx.globalAlpha = 1;
        
        // Calculate the actual grid dimensions
        const gridWidth = this.gridSize * this.cellSize;
        const gridHeight = this.gridSize * this.cellSize;
        
        // Calculate center position to center the grid in the canvas
        const offsetX = (this.canvas.width - gridWidth) / 2;
        const offsetY = (this.canvas.height - gridHeight) / 2;
        
        // Fill the entire canvas background
        this.ctx.fillStyle = '#f8f9fa';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Ensure the external per-cell tile texture is loading
        if (!this.tileTextureLoaded && !this._tileTextureAttempted) {
            // Fire and forget; on load we'll trigger a redraw
            this.loadGrassTileTexture();
        }

        if (this.tileTextureLoaded && this.tileTextureImage) {
            // Draw the provided tile image into each grid cell (crisp, per-tile texture)
            this.ctx.save();
            const hadSmoothing = typeof this.ctx.imageSmoothingEnabled === 'boolean' ? this.ctx.imageSmoothingEnabled : undefined;
            if (typeof this.ctx.imageSmoothingEnabled === 'boolean') this.ctx.imageSmoothingEnabled = false;

            const sx = 0, sy = 0, sw = this.tileTextureImage.naturalWidth || 16, sh = this.tileTextureImage.naturalHeight || 16;
            for (let row = 0; row < this.gridSize; row++) {
                for (let col = 0; col < this.gridSize; col++) {
                    const dx = offsetX + col * this.cellSize;
                    const dy = offsetY + row * this.cellSize;
                    this.ctx.drawImage(this.tileTextureImage, sx, sy, sw, sh, dx, dy, this.cellSize, this.cellSize);
                }
            }

            if (hadSmoothing !== undefined) this.ctx.imageSmoothingEnabled = hadSmoothing;
            this.ctx.restore();
        } else {
            // Fallback: solid green until the image loads to avoid any pattern repeat artifacts
            this.ctx.fillStyle = '#79c76b';
            this.ctx.fillRect(offsetX, offsetY, gridWidth, gridHeight);
        }
        
        // Slightly more visible grid lines (still subtle) and pixel-crisp alignment
        const crisp = (v) => Math.round(v) + 0.5; // align 1px strokes to device pixels
    this.ctx.strokeStyle = 'rgba(34, 139, 34, 0.55)'; // slightly stronger for more clarity
        this.ctx.lineWidth = 1;
        
        // Draw grid lines only within the grid area, offset by the center position
        for (let i = 0; i <= this.gridSize; i++) {
            const vx = crisp(offsetX + i * this.cellSize);
            const hy = crisp(offsetY + i * this.cellSize);
            
            // Vertical line
            this.ctx.beginPath();
            this.ctx.moveTo(vx, crisp(offsetY));
            this.ctx.lineTo(vx, crisp(offsetY + gridHeight));
            this.ctx.stroke();
            
            // Horizontal line
            this.ctx.beginPath();
            this.ctx.moveTo(crisp(offsetX), hy);
            this.ctx.lineTo(crisp(offsetX + gridWidth), hy);
            this.ctx.stroke();
        }
        
        // Draw plants first
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const cell = this.garden[row][col];
                const x = offsetX + col * this.cellSize;
                const y = offsetY + row * this.cellSize;
                
                if (cell.plant) {
                    this.drawPlant(row, col, cell, offsetX, offsetY);
                }
            }
        }
        
        // Draw sprinklers last (as overlays) - but only for empty cells
        this.sprinklers.forEach(sprinkler => {
            const cell = this.garden[sprinkler.row][sprinkler.col];
            if (!cell.plant) {
                this.drawSprinkler(sprinkler.row, sprinkler.col, sprinkler.type, offsetX, offsetY);
            }
        });
        
        // Draw decorations
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const cell = this.garden[row][col];
                if (cell.decoration) {
                    this.drawDecoration(row, col, cell.decoration, offsetX, offsetY);
                }
            }
        }
        
        // Draw particles
        this.drawParticles();
        
        // Update season display in HTML (seasonal info is now in HTML, not canvas)
        this.updateSeasonDisplay();
        
        // Ensure globalAlpha is reset to 1 at the end of each draw cycle
        this.ctx.globalAlpha = 1;
    }
    
        // Create or reuse a repeating pixel-art grass pattern for the grid background
        getGrassPattern(tilePx = 16) {
            if (!this.ctx) return null;
            // Convert requested pixel size to an integer scale of an 8x8 pixel-art tile
            const scale = Math.max(1, Math.floor((tilePx | 0) / 8));
            const size = 8 * scale; // final tile dimension in pixels
            const cacheKey = `s${scale}`;
            if (this.grassPatternCache && this.grassPatternCache[cacheKey]) return this.grassPatternCache[cacheKey];

            const cvs = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(size, size) : document.createElement('canvas');
            cvs.width = size;
            cvs.height = size;
            const g = cvs.getContext('2d');
            if (!g) return null;

            // Keep it pixelated
            if (typeof g.imageSmoothingEnabled === 'boolean') g.imageSmoothingEnabled = false;

            const s = scale; // pixel block size for each of the 8x8 pattern pixels

            // Palette: base, light, dark
            const base = '#79c76b';
            const light = '#8fd77f';
            const dark = '#5ea452';

            // 8x8 pixel-art pattern indices (0=base, 1=light, 2=dark)
            const map = [
                [0,1,0,0,1,0,0,2],
                [0,0,2,0,0,1,0,0],
                [1,0,0,1,0,0,2,0],
                [0,2,0,0,1,0,0,1],
                [0,0,1,0,0,2,0,0],
                [2,0,0,1,0,0,1,0],
                [0,1,0,0,2,0,0,1],
                [0,0,2,0,0,1,0,0]
            ];

            // Paint base first for solid background
            g.fillStyle = base;
            g.fillRect(0, 0, size, size);

            // Paint light and dark pixels scaled by s for crisp edges
            for (let y = 0; y < 8; y++) {
                for (let x = 0; x < 8; x++) {
                    const idx = map[y][x];
                    if (idx === 1) {
                        g.fillStyle = light;
                        g.fillRect(x * s, y * s, s, s);
                    } else if (idx === 2) {
                        g.fillStyle = dark;
                        g.fillRect(x * s, y * s, s, s);
                    }
                }
            }

            const pattern = this.ctx.createPattern(cvs, 'repeat');
            if (!this.grassPatternCache) this.grassPatternCache = {};
            this.grassPatternCache[cacheKey] = pattern;
            return pattern;
        }

        // Load external grass tile image once; resolves true if loaded, false if failed
        async loadGrassTileTexture(src = this.tileTexturePath) {
            if (this.tileTextureLoaded) return true;
            if (this._tileTextureAttempted && !this.tileTextureImage) return false;
            this._tileTextureAttempted = true;
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.tileTextureImage = img;
                    this.tileTextureLoaded = true;
                    try { requestAnimationFrame(() => this.draw()); } catch (_) {}
                    resolve(true);
                };
                img.onerror = () => {
                    // If plus sign path failed, try URL-encoded fallback once
                    if (src.includes('+')) {
                        const alt = src.replace('+', '%2B');
                        // Avoid infinite loop by calling a fresh Image inside this branch
                        const img2 = new Image();
                        img2.onload = () => {
                            this.tileTextureImage = img2;
                            this.tileTextureLoaded = true;
                            try { requestAnimationFrame(() => this.draw()); } catch (_) {}
                            resolve(true);
                        };
                        img2.onerror = () => {
                            this.tileTextureImage = null;
                            this.tileTextureLoaded = false;
                            resolve(false);
                        };
                        try {
                            img2.decoding = 'async';
                            img2.src = encodeURI(alt);
                            return;
                        } catch (e) {
                            // fall through to failure
                        }
                    }
                    this.tileTextureImage = null;
                    this.tileTextureLoaded = false;
                    resolve(false);
                };
                try {
                    img.decoding = 'async';
                    img.src = encodeURI(src);
                } catch (e) {
                    this.tileTextureImage = null;
                    resolve(false);
                }
            });
        }
    
    drawPlant(row, col, cell, offsetX, offsetY) {
        if (!this.ctx) {
            return;
        }
        
        if (!cell.plant || !cell.plant.type) {
            return;
        }
        
        const x = offsetX + col * this.cellSize + this.cellSize / 2;
        const y = offsetY + row * this.cellSize + this.cellSize / 2;
        const plantData = this.plantTypes[cell.plant.type];
        
        if (!plantData) {
            return;
        }
        
        // Draw soil
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(offsetX + col * this.cellSize + 2, offsetY + row * this.cellSize + this.cellSize * 0.7, 
                         this.cellSize - 4, this.cellSize * 0.3);
        
        this.ctx.font = `${this.cellSize * 0.6}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Determine plant color based on state
        if (cell.plant.isFullyGrown) {
            this.ctx.fillStyle = plantData.color;
        } else if (cell.fertilized) {
            this.ctx.fillStyle = '#FFD700';
        } else if (cell.watered) {
            this.ctx.fillStyle = '#228B22';
        } else {
            this.ctx.fillStyle = '#8FBC8F';
        }
        
        // Draw the plant stage - use growthStage for visual display
        const stage = this.getPlantGrowthStage(cell.plant);
        if (plantData.stages && plantData.stages[stage]) {
            this.ctx.fillText(plantData.stages[stage], x, y);
        } else {
            // Fallback to a simple plant emoji if stages are not available
            this.ctx.fillText('🌱', x, y);
        }
        
        if (cell.watered) {
            this.ctx.fillStyle = '#87CEEB';
            this.ctx.globalAlpha = 0.7;
            this.ctx.fillRect(offsetX + col * this.cellSize + 2, offsetY + row * this.cellSize + 2, 
                             this.cellSize - 4, 4);
            this.ctx.globalAlpha = 1;
        }
        
        if (cell.fertilized) {
            this.ctx.fillStyle = '#FFD700';
            this.ctx.globalAlpha = 0.7;
            this.ctx.fillRect(offsetX + col * this.cellSize + 2, offsetY + row * this.cellSize + this.cellSize - 6, 
                             this.cellSize - 4, 4);
            this.ctx.globalAlpha = 1;
        }
        
        if (cell.waterCooldown > Date.now()) {
            this.ctx.strokeStyle = '#FF6B6B';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(offsetX + col * this.cellSize + 1, offsetY + row * this.cellSize + 1, 
                               this.cellSize - 2, this.cellSize - 2);
        }
        
        if (cell.plant.isFullyGrown) {
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(offsetX + col * this.cellSize + 4, offsetY + row * this.cellSize + 4, 
                               this.cellSize - 8, this.cellSize - 8);
        }
        
        // Check if this plant is affected by a sprinkler and show indicator
        const affectedBySprinkler = this.sprinklers.some(sprinkler => {
            const distance = Math.max(Math.abs(sprinkler.row - row), Math.abs(sprinkler.col - col));
            return distance <= this.sprinklerTypes[sprinkler.type].range;
        });
        
        if (affectedBySprinkler) {
            // Show a tiny sprinkler indicator in the corner
            const sprinkler = this.sprinklers.find(s => {
                const distance = Math.max(Math.abs(s.row - row), Math.abs(s.col - col));
                return distance <= this.sprinklerTypes[s.type].range;
            });
            if (sprinkler) {
                const sprinklerData = this.sprinklerTypes[sprinkler.type];
                this.ctx.fillStyle = sprinklerData.color;
                this.ctx.globalAlpha = 0.8;
                this.ctx.beginPath();
                this.ctx.arc(offsetX + col * this.cellSize + this.cellSize - 3, 
                             offsetY + row * this.cellSize + 3, 2, 0, 2 * Math.PI);
                this.ctx.fill();
                this.ctx.globalAlpha = 1;
            }
        }
    }
    
    drawSprinkler(row, col, type, offsetX, offsetY) {
        if (!this.ctx) {
            return;
        }
        
        const x = offsetX + col * this.cellSize + this.cellSize / 2;
        const y = offsetY + row * this.cellSize + this.cellSize / 2;
        const sprinklerData = this.sprinklerTypes[type];
        
        // Find the sprinkler data to get expiration info
        const sprinkler = this.sprinklers.find(s => s.row === row && s.col === col);
        const now = Date.now();
        const timeLeft = sprinkler ? sprinkler.expiresAt - now : 0;
        const timeLeftMinutes = Math.floor(timeLeft / 60000);
        const timeLeftSeconds = Math.floor((timeLeft % 60000) / 1000);
        
        // Check if there's a plant in this cell
        const cell = this.garden[row][col];
        const hasPlant = cell && cell.plant;
        
        // Only draw sprinkler background if there's no plant
        if (!hasPlant) {
        this.ctx.fillStyle = sprinklerData.color;
            this.ctx.globalAlpha = 0.6;
            this.ctx.fillRect(offsetX + col * this.cellSize + 2, offsetY + row * this.cellSize + 2, 
                             this.cellSize - 4, this.cellSize - 4);
        this.ctx.globalAlpha = 1;
        }
        
        // Draw sprinkler icon - only show if no plant, or as tiny indicator if plant present
        if (!hasPlant) {
        this.ctx.font = `${this.cellSize * 0.4}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = 'white';
        this.ctx.fillText(sprinklerData.icon, x, y);
        } else {
            // Just show a tiny dot in the corner when plant is present
            this.ctx.fillStyle = sprinklerData.color;
            this.ctx.globalAlpha = 0.9;
            this.ctx.beginPath();
            this.ctx.arc(offsetX + col * this.cellSize + this.cellSize - 4, 
                         offsetY + row * this.cellSize + 4, 2, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
        }
        
        // Draw timer if less than 1 minute remaining
        if (timeLeft > 0 && timeLeft < 60000) {
            this.ctx.font = `${this.cellSize * 0.15}px Arial`;
            this.ctx.fillStyle = '#FF6B6B';
            this.ctx.fillText(`${timeLeftSeconds}s`, x, y + this.cellSize * 0.4);
        } else if (timeLeft > 0 && timeLeft < 300000) { // Less than 5 minutes
            this.ctx.font = `${this.cellSize * 0.15}px Arial`;
            this.ctx.fillStyle = '#FFA500';
            this.ctx.fillText(`${timeLeftMinutes}m`, x, y + this.cellSize * 0.4);
        }
        
        // Draw range indicator
        this.ctx.strokeStyle = sprinklerData.color;
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.2;
        
        // Draw range circle
        this.ctx.beginPath();
        this.ctx.arc(x, y, sprinklerData.range * this.cellSize, 0, 2 * Math.PI);
        this.ctx.stroke();
        
        // Reset globalAlpha
        this.ctx.globalAlpha = 1;
    }
    
    drawDecoration(row, col, decoration, offsetX, offsetY) {
        if (!this.ctx) {
            return;
        }
        
        const decorationData = this.decorations[decoration.type];
        if (!decorationData) {
            return;
        }
        
        const x = offsetX + col * this.cellSize + this.cellSize / 2;
        const y = offsetY + row * this.cellSize + this.cellSize / 2;
        
        // Draw decoration background
        this.ctx.fillStyle = '#f8f9fa';
        this.ctx.globalAlpha = 0.8;
        this.ctx.fillRect(offsetX + col * this.cellSize + 2, offsetY + row * this.cellSize + 2, 
                         this.cellSize - 4, this.cellSize - 4);
        this.ctx.globalAlpha = 1;
        
        // Draw decoration icon
        this.ctx.font = `${this.cellSize * 0.6}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#6c757d';
        this.ctx.fillText(decorationData.icon, x, y);
        
        // Add glow effect for active decorations
        if (decoration.active) {
            this.ctx.shadowColor = '#FFD700';
            this.ctx.shadowBlur = 5;
            this.ctx.fillText(decorationData.icon, x, y);
            this.ctx.shadowBlur = 0;
        }
        
        // Add border for seasonal decorations
        if (decorationData.type === 'seasonal') {
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(offsetX + col * this.cellSize + 1, offsetY + row * this.cellSize + 1, 
                               this.cellSize - 2, this.cellSize - 2);
        }
        
        // Draw decoration range indicator
        if (decorationData.bonus && decorationData.bonus !== 'none') {
            this.ctx.strokeStyle = '#28a745';
            this.ctx.lineWidth = 1;
            const range = decorationData.range ?? 1;
            
            if (decorationData.scope === 'global') {
                this.ctx.globalAlpha = 0.35;
                this.ctx.beginPath();
                this.ctx.arc(x, y, this.cellSize * 0.45, 0, 2 * Math.PI);
                this.ctx.stroke();
            } else {
                this.ctx.globalAlpha = 0.2;
                this.ctx.strokeRect(
                    offsetX + (col - range) * this.cellSize,
                    offsetY + (row - range) * this.cellSize,
                    this.cellSize * (range * 2 + 1),
                    this.cellSize * (range * 2 + 1)
                );
            }
            
            this.ctx.globalAlpha = 1;
        }
    }
    
    drawRangeIndicator(row, col, type, offsetX, offsetY) {
        if (!this.ctx) return;
        
        const x = offsetX + col * this.cellSize + this.cellSize / 2;
        const y = offsetY + row * this.cellSize + this.cellSize / 2;
        const sprinklerData = this.sprinklerTypes[type];
        
        // Draw range indicator
        this.ctx.strokeStyle = sprinklerData.color;
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.3;
        
        // Draw range circle
        this.ctx.beginPath();
        this.ctx.arc(x, y, sprinklerData.range * this.cellSize, 0, 2 * Math.PI);
        this.ctx.stroke();
        
        // Reset globalAlpha
        this.ctx.globalAlpha = 1;
    }
    
    // Function to show which plants are affected by bonuses
    showBonusInfo(row, col) {
        const cell = this.garden[row][col];
        if (!cell.plant) return;
        
        const plant = cell.plant;
        const bonusInfo = [];
        const globalBonuses = new Set();
        
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const nearbyCell = this.garden[y][x];
                if (!nearbyCell.decoration) continue;
                const decorationData = this.decorations[nearbyCell.decoration.type];
                if (!decorationData || !decorationData.bonus || decorationData.bonus === 'none') continue;
                
                if (decorationData.scope === 'global') {
                    globalBonuses.add(`${decorationData.name}: ${decorationData.bonus}`);
                } else if (Math.abs(y - row) <= (decorationData.range ?? 1) && Math.abs(x - col) <= (decorationData.range ?? 1)) {
                    bonusInfo.push(`${decorationData.name}: ${decorationData.bonus}`);
                }
            }
        }
        
        bonusInfo.push(...globalBonuses);
        
        // Check for sprinkler bonuses
        this.sprinklers.forEach(sprinkler => {
            const distance = Math.max(Math.abs(sprinkler.row - row), Math.abs(sprinkler.col - col));
            if (distance <= this.sprinklerTypes[sprinkler.type].range) {
                const sprinklerData = this.sprinklerTypes[sprinkler.type];
                bonusInfo.push(`${sprinkler.type} sprinkler: +${Math.round(sprinklerData.growthBonus * 100)}% growth`);
            }
        });
        
        if (bonusInfo.length > 0) {
            this.showMessage(`Plant bonuses: ${bonusInfo.join(', ')}`, 'info');
        }
    }
    
    drawSeasonalInfo() {
        if (!this.ctx) return;
        
        // Draw season indicator in top-right corner to avoid interference with plants
        this.ctx.save();
        this.ctx.fillStyle = '#333';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'top';
        
        var seasonColors = {
            spring: '#90EE90',
            summer: '#FFD700',
            fall: '#FF8C00',
            winter: '#87CEEB'
        };
        
        var seasonEmojis = {
            spring: '🌸',
            summer: '☀️',
            fall: '🍂',
            winter: '❄️'
        };
        
        // Season display is now handled by HTML elements, not canvas drawing
        
        this.ctx.restore();
    }
    
    updateSeasonDisplay() {
        const seasonTextElement = document.getElementById('seasonText');
        const growthMultiplierElement = document.getElementById('growthMultiplier');
        
        if (seasonTextElement && growthMultiplierElement) {
            const seasonEmojis = {
                spring: '🌸',
                summer: '☀️',
                fall: '🍂',
                winter: '❄️'
            };
            
            const seasonText = seasonEmojis[this.currentSeason] + ' ' + this.currentSeason.charAt(0).toUpperCase() + this.currentSeason.slice(1) + ' (Day ' + this.seasonDay + ')';
            seasonTextElement.textContent = seasonText;
            
            // Force a reflow to ensure the DOM updates
            seasonTextElement.offsetHeight;
            
            // Update growth multiplier display
            if (this.seasonMultiplier !== 1.0) {
                const multiplierText = 'Growth: ' + (this.seasonMultiplier > 1 ? '+' : '') + Math.round((this.seasonMultiplier - 1) * 100) + '%';
                growthMultiplierElement.textContent = multiplierText;
                growthMultiplierElement.className = this.seasonMultiplier > 1 ? 'growth-multiplier' : 'growth-multiplier negative';
                growthMultiplierElement.style.display = 'block';
            } else {
                growthMultiplierElement.style.display = 'none';
            }
            
            // Force a reflow for the multiplier element too
            growthMultiplierElement.offsetHeight;
        }
        // Refresh Quick Seeds to reflect seasonal availability
        try { this.updateQuickSeedsBar(); } catch (_) {}
    }
    
    updateUI() {
        // Force immediate update of all UI elements
        this.updateGardenTitle();
        if (!this.bonusesUIReady) {
            this.initializeBonusesUI();
        }

        const moneyElement = document.getElementById('money');
        const waterElement = document.getElementById('water');
        const fertilizerElement = document.getElementById('fertilizer');
        const scoreElement = document.getElementById('score');
        
        if (moneyElement) {
            moneyElement.textContent = this.money;
        }
        if (waterElement) {
            waterElement.textContent = this.water;
        }
        if (fertilizerElement) {
            fertilizerElement.textContent = this.fertilizer;
        }
        if (scoreElement) {
            scoreElement.textContent = this.score;
        }
        
        this.updateRebirthUI();

        // Update weather display
        const weatherElement = document.getElementById('weather');
        if (weatherElement) {
            weatherElement.textContent = this.weatherEffects[this.weather].name;
        }
        
        // Update achievement count
        const unlockedCount = Object.values(this.achievements).filter(a => a.unlocked).length;
        const totalCount = Object.keys(this.achievements).length;
        const achievementElement = document.getElementById('achievements');
        if (achievementElement) {
            achievementElement.textContent = `${unlockedCount}/${totalCount}`;
        }
        
        // Force a reflow to ensure the DOM updates
        if (moneyElement) moneyElement.offsetHeight;
        
        this.updateShopDisplay();
        this.updateChallengesDisplay();
        this.updateStatsDisplay();
        this.updateSeasonDisplay();
        
        // Update sound button text
        const soundBtn = document.getElementById('soundBtn');
        if (soundBtn) {
            soundBtn.textContent = this.soundEnabled ? '🔊 Sound' : '🔇 Sound';
        }
        // Refresh bonuses in case values changed
        this.updateBonusesPopup();

        // Keep Expand Garden price label in sync with current expansionCost
        const expandPriceEl = document.getElementById('expandGardenPriceLabel');
        if (expandPriceEl) {
            expandPriceEl.textContent = `$${this.expansionCost}`;
        }
        // Keep Quick Seeds in sync with inventory/selection changes
        try { this.updateQuickSeedsBar(); } catch (_) {}
    }

    // ===== Responsive layout: move secondary panels under the garden on wide screens =====
    setupResponsiveLayout() {
        const under = document.getElementById('underGarden');
        const sidebar = document.querySelector('.sidebar');
        if (!under || !sidebar) return;

        // Cache original parent markers once
        const ids = ['achievementsSection', 'challengesSection', 'statsSection'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.dataset.originalParent) {
                el.dataset.originalParent = 'sidebar';
            }
        });

        const reflow = () => {
            const wide = window.innerWidth >= 1200;
            const targets = ids
                .map(id => document.getElementById(id))
                .filter(Boolean);
            if (wide) {
                // Move into the under-garden area if not already there
                targets.forEach(el => {
                    if (el.parentElement !== under) under.appendChild(el);
                });
            } else {
                // Move back to the sidebar (after prestige section if present)
                const prestige = document.getElementById('prestigeSection');
                const insertAfter = prestige && prestige.parentElement === sidebar ? prestige : null;
                targets.forEach(el => {
                    if (el.parentElement !== sidebar) {
                        if (insertAfter && insertAfter.nextSibling) {
                            sidebar.insertBefore(el, insertAfter.nextSibling);
                        } else if (insertAfter) {
                            sidebar.appendChild(el);
                        } else {
                            sidebar.appendChild(el);
                        }
                    }
                });
            }
        };

        // Initial and reactive
        reflow();
        window.addEventListener('resize', reflow);
        window.addEventListener('orientationchange', reflow);
    }

    defaultGardenName() {
        return `Garden Slot ${this.saveSlot}`;
    }

    updateGardenTitle() {
        const titleElement = document.getElementById('gardenTitle');
        if (!titleElement) {
            return;
        }

        const resolvedName = this.gardenName && this.gardenName.trim().length > 0
            ? this.gardenName
            : this.defaultGardenName();

        titleElement.textContent = resolvedName;
        titleElement.setAttribute('title', resolvedName);
    }

    setGardenName(rawName, options = {}) {
        const { shouldSave = true, showFeedback = false } = options;
        const previousResolved = this.gardenName && this.gardenName.trim().length > 0
            ? this.gardenName
            : this.defaultGardenName();

        const sanitized = sanitizeGardenName(rawName, '');
        const finalName = sanitized && sanitized.length > 0 ? sanitized : this.defaultGardenName();
        const nameChanged = finalName !== previousResolved;

        this.gardenName = finalName;
        this.updateGardenTitle();

        if (shouldSave && nameChanged) {
            this.saveGame();
            if (window.menuSystem && typeof window.menuSystem.updateSaveSlots === 'function') {
                window.menuSystem.updateSaveSlots();
            }
        }

        if (showFeedback && nameChanged) {
            const message = sanitized
                ? `Garden renamed to "${finalName}"!`
                : 'Garden name reset to default.';
            this.showMessage(message, sanitized ? 'success' : 'info');
        }

        return this.gardenName;
    }

    promptRenameGarden() {
        const currentLabel = this.gardenName && this.gardenName.trim().length > 0
            ? this.gardenName
            : this.defaultGardenName();
    const response = window.prompt('Name your garden (leave blank for default):', currentLabel);
        if (response === null) {
            return;
        }
        this.setGardenName(response, { shouldSave: true, showFeedback: true });
    }
    
    updateSeedRarityDisplay(seedType, rarity) {
        const seedElement = document.querySelector(`[data-seed="${seedType}"]`);
        if (!seedElement) {
            this.showMessage(`Warning: Seed element not found for ${seedType}`, 'warning');
            return;
        }

        const nameElement = seedElement.querySelector('.seed-name');
        if (!nameElement) {
            this.showMessage(`Warning: Name element not found for ${seedType}`, 'warning');
            return;
        }

        const shopContainer = seedElement.closest('.seed-shop');
        if (!shopContainer) {
            this.showMessage(`Warning: Shop container not found for ${seedType}`, 'warning');
            return;
        }

        const plantData = this.plantTypes[seedType];
        const baseName = plantData?.name || nameElement.textContent.replace(/\s*\(RARE\)$/, '').replace(/\s*\(LEGENDARY\)$/, '');

        const findListForHeader = (headerText) => {
            const header = Array.from(shopContainer.querySelectorAll('h4')).find(h4 => h4.textContent.includes(headerText));
            if (!header) {
                return null;
            }
            const immediateList = header.nextElementSibling;
            if (immediateList && immediateList.classList?.contains('seed-list')) {
                return immediateList;
            }
            if (header.parentElement?.classList?.contains('seed-category')) {
                return header.parentElement.querySelector('.seed-list') || header.parentElement;
            }
            return null;
        };

        const moveToList = (headerText) => {
            const listElement = findListForHeader(headerText);
            if (listElement) {
                listElement.appendChild(seedElement);
                return true;
            }
            return false;
        };

        seedElement.classList.remove('rare-seed', 'legendary-seed');
        seedElement.remove();

        if (rarity === 'rare') {
            nameElement.textContent = `${baseName} (RARE)`;
            seedElement.classList.add('rare-seed');
            if (!moveToList('⭐ Rare Seeds')) {
                shopContainer.appendChild(seedElement);
            }
        } else if (rarity === 'legendary') {
            nameElement.textContent = `${baseName} (LEGENDARY)`;
            seedElement.classList.add('legendary-seed');
            if (!moveToList('🌟 Legendary Seeds')) {
                shopContainer.appendChild(seedElement);
            }
        } else {
            nameElement.textContent = baseName;
            if (!moveToList('🌱 Basic Seeds')) {
                shopContainer.insertBefore(seedElement, shopContainer.firstChild);
            }
        }
    }

    updateShopDisplay() {
            
                    // First, ensure all seed elements are visible and reset their state
        document.querySelectorAll('.seed-item').forEach(element => {
                element.style.display = 'block';
                element.classList.remove('out-of-stock');
            });
            
            // Update existing seed items in the HTML
            Object.keys(this.shopInventory).forEach(seedType => {
                const seedData = this.plantTypes[seedType];
                const inventory = this.shopInventory[seedType];
                
                // Check if inventory structure is valid
                if (!inventory || typeof inventory !== 'object') {
                    return;
                }
                
                if (seedData && inventory) {
                    const seedElement = document.querySelector(`[data-seed="${seedType}"]`);
                    if (seedElement) {
                    // Check if seed is available in current season
                    const isAvailable = this.isSeedAvailable(seedType);
                    
                    // Show/hide seed based on seasonal availability
                    if (isAvailable) {
                        seedElement.style.display = 'block';
                        seedElement.classList.remove('rare-seed', 'legendary-seed');
                        if (seedData.isLegendary) {
                            seedElement.classList.add('legendary-seed');
                        } else if (seedData.isRare) {
                            seedElement.classList.add('rare-seed');
                        }
                        
                        // Update the stock display
                        const stockElement = seedElement.querySelector('.seed-stock');
                        if (stockElement) {
                            stockElement.textContent = `Stock: ${inventory.stock}`;
                        }
                        
                        // Update the price display
                        const priceElement = seedElement.querySelector('.seed-price');
                        if (priceElement) {
                            const baseCost = this.getSeedBaseCost(seedData);
                            const discountedCost = this.getDiscountedSeedCost(baseCost);
                            const baseDisplay = `$${Number(baseCost || 0).toLocaleString()}`;
                            const discountedDisplay = `$${Number(discountedCost || 0).toLocaleString()}`;
                            const hasDiscount = discountedCost < baseCost;
                            if (hasDiscount) {
                                const discountPercent = Math.round(this.getPrestigeSeedDiscount() * 100);
                                priceElement.textContent = `${discountedDisplay} (-${discountPercent}%)`;
                            } else {
                                priceElement.textContent = baseDisplay;
                            }
                        }
                        
                        // Update the name display
                        const nameElement = seedElement.querySelector('.seed-name');
                        if (nameElement) {
                            let displayName = seedData.name;
                            if (seedData.isLegendary) {
                                displayName += ' (LEGENDARY)';
                            } else if (seedData.isRare) {
                                displayName += ' (RARE)';
                            }
                            nameElement.textContent = displayName;
                        }
                        
                        // Handle out of stock styling
                        if (inventory.stock <= 0) {
                            seedElement.classList.add('out-of-stock');
                            seedElement.style.pointerEvents = 'none';
                            seedElement.style.cursor = 'not-allowed';
                        } else {
                            seedElement.classList.remove('out-of-stock');
                            seedElement.style.pointerEvents = 'auto';
                            seedElement.style.cursor = 'pointer';
                        }
                        
                        // Remove any existing buy buttons
                        const existingBuyButton = seedElement.querySelector('.buy-button');
                        if (existingBuyButton) {
                            existingBuyButton.remove();
                        }
                    } else {
                        seedElement.style.display = 'none';
                    }
                }
            }
        });
        
        // Force a reflow to ensure the DOM updates
        document.body.offsetHeight;
        

        
        // Ensure seed elements are clickable
        document.querySelectorAll('.seed-item').forEach(item => {
            if (item.hasAttribute('data-seed') && !item.classList.contains('out-of-stock')) {
                item.style.pointerEvents = 'auto';
                item.style.cursor = 'pointer';
            }
        });
        
        // Update essentials (water/fertilizer) dynamic prices in the UI
        try {
            const waterLabel = document.getElementById('waterPriceLabel');
            if (waterLabel) {
                const price = this.getWaterPurchasePrice();
                waterLabel.textContent = `$${Number(price).toLocaleString()}`;
            }
            const fertLabel = document.getElementById('fertilizerPriceLabel');
            if (fertLabel) {
                const price = this.getFertilizerPurchasePrice();
                fertLabel.textContent = `$${Number(price).toLocaleString()}`;
            }
        } catch (e) {
            // Non-fatal UI update issue
        }
        // Also refresh Quick Seeds bar whenever shop/inventory visuals update
        try { this.updateQuickSeedsBar(); } catch (_) {}
    }
    

    
    updateChallengesDisplay() {
        const challengesList = document.getElementById('challenges-list');
        if (!challengesList) {
            console.log('Challenges list element not found!');
            return;
        }

        challengesList.innerHTML = '';

        const renderChallenge = (challenge, title, icon) => {
            const challengeElement = document.createElement('div');
            challengeElement.className = 'challenge-item';
            if (challenge.type) {
                challengeElement.classList.add(`${challenge.type}-challenge`);
            }
            if (challenge.completed) {
                challengeElement.classList.add('completed-challenge');
            }
            if (challenge.collected) {
                challengeElement.classList.add('reward-collected');
            }

            const header = document.createElement('div');
            header.className = 'challenge-header';

            const iconSpan = document.createElement('span');
            iconSpan.className = 'challenge-icon';
            iconSpan.textContent = icon;

            const titleSpan = document.createElement('span');
            titleSpan.className = 'challenge-title';
            titleSpan.textContent = title;

            header.appendChild(iconSpan);
            header.appendChild(titleSpan);

            if (challenge.collected) {
                const trophy = document.createElement('span');
                trophy.className = 'challenge-completed';
                trophy.textContent = '🏆';
                header.appendChild(trophy);
            } else if (challenge.completed) {
                const check = document.createElement('span');
                check.className = 'challenge-completed';
                check.textContent = '✅';
                header.appendChild(check);
            }

            const description = document.createElement('div');
            description.className = 'challenge-description';
            description.textContent = challenge.description;

            const progressWrapper = document.createElement('div');
            progressWrapper.className = 'challenge-progress';

            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';

            const progressFill = document.createElement('div');
            progressFill.className = 'progress-fill';
            const progressRatio = challenge.target > 0 ? Math.min((challenge.progress || 0) / challenge.target, 1) : 0;
            progressFill.style.width = `${progressRatio * 100}%`;

            progressBar.appendChild(progressFill);

            const progressText = document.createElement('span');
            progressText.className = 'progress-text';
            progressText.textContent = `${challenge.progress || 0}/${challenge.target}`;

            progressWrapper.appendChild(progressBar);
            progressWrapper.appendChild(progressText);

            const reward = document.createElement('div');
            reward.className = 'challenge-reward';
            reward.textContent = `Reward: $${challenge.reward}`;

            challengeElement.appendChild(header);
            challengeElement.appendChild(description);
            challengeElement.appendChild(progressWrapper);
            challengeElement.appendChild(reward);

            if (challenge.completed && !challenge.collected) {
                const status = document.createElement('div');
                status.className = 'challenge-status';
                status.textContent = 'Complete! Collect your reward.';
                challengeElement.appendChild(status);

                const collectBtn = document.createElement('button');
                collectBtn.className = 'collect-reward-btn';
                collectBtn.textContent = 'Collect Reward';
                collectBtn.addEventListener('click', () => this.collectChallengeReward(challenge.id, challenge.type));
                challengeElement.appendChild(collectBtn);
            } else if (challenge.collected) {
                const collectedStatus = document.createElement('div');
                collectedStatus.className = 'challenge-status collected-status';
                collectedStatus.textContent = 'Reward collected!';
                challengeElement.appendChild(collectedStatus);
            }

            return challengeElement;
        };

        if (Array.isArray(this.challenges.daily) && this.challenges.daily.length > 0) {
            const dailyHeader = document.createElement('h4');
            dailyHeader.textContent = '📅 Daily Challenges';
            dailyHeader.className = 'challenges-subheader';
            challengesList.appendChild(dailyHeader);

            this.challenges.daily.forEach((challenge, index) => {
                const title = `Daily Challenge ${index + 1}`;
                challengesList.appendChild(renderChallenge(challenge, title, '📅'));
            });
        }

        if (this.challenges.weekly) {
            const weeklyHeader = document.createElement('h4');
            weeklyHeader.textContent = '📆 Weekly Challenge';
            weeklyHeader.className = 'challenges-subheader';
            challengesList.appendChild(weeklyHeader);

            challengesList.appendChild(renderChallenge(this.challenges.weekly, 'Weekly Challenge', '📆'));
        }
    }
    
    updateStatsDisplay() {
        const statsList = document.getElementById('stats-list');
        if (!statsList) return;
        
        // Clear existing content
        statsList.innerHTML = '';
        
        // Create stat items
        const statItems = [
            { label: '🌱 Total Plants Harvested', value: this.stats.totalPlantsHarvested || 0 },
            { label: '💰 Total Money Earned', value: `$${this.stats.totalMoneyEarned || 0}` },
            { label: '💧 Total Water Used', value: this.stats.totalWaterUsed || 0 },
            { label: '🌿 Total Fertilizer Used', value: this.stats.totalFertilizerUsed || 0 },
            { label: '🏆 Best Harvest Value', value: `$${this.stats.bestHarvest || 0}` },
            { label: '♻️ Total Rebirths', value: this.stats.totalRebirths || 0 },
            { label: '⏱️ Longest Play Session', value: `${Math.floor((this.stats.longestPlaySession || 0) / 60000)}m` },
            { label: '🌱 Different Plants Planted', value: this.stats.plantsByType ? Object.keys(this.stats.plantsByType).length : 0 },
            { label: '🌤️ Current Season', value: this.currentSeason || 'spring' },
            { label: '📅 Season Day', value: this.seasonDay || 1 },
            { label: '🏡 Garden Size', value: `${this.gardenSize}x${this.gardenSize}` },
            { label: '💧 Active Sprinklers', value: this.sprinklers ? this.sprinklers.length : 0 },
            { label: '🎯 Completed Challenges', value: this.challenges.completed ? this.challenges.completed.length : 0 },
            { label: '⚡ Admin Panel Used', value: this.stats.adminPanelUsed ? 'Yes' : 'No' },
            { label: '🔢 Admin Panel Usage Count', value: this.stats.adminPanelUsageCount || 0 }
        ];
        
        statItems.forEach(stat => {
            const statElement = document.createElement('div');
            statElement.className = 'stat-item';
            statElement.innerHTML = `
                <span class="stat-label">${stat.label}</span>
                <span class="stat-value">${stat.value}</span>
            `;
            statsList.appendChild(statElement);
        });
    }

    getMessageContainer() {
        if (this.messageContainer && document.body.contains(this.messageContainer)) {
            return this.messageContainer;
        }

        const container = document.createElement('div');
        container.id = 'gardenAlerts';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 12px;
            z-index: 1500;
            pointer-events: none;
        `;
        document.body.appendChild(container);
        this.messageContainer = container;
        return container;
    }

    dismissActiveMessage(entry) {
        if (!entry) {
            return;
        }

        if (entry.timeoutId) {
            clearTimeout(entry.timeoutId);
            entry.timeoutId = null;
        }

        if (entry.element && entry.element.parentNode) {
            entry.element.parentNode.removeChild(entry.element);
        }

        this.activeMessages = this.activeMessages.filter(item => item !== entry);

        if (this.messageContainer && this.messageContainer.childElementCount === 0) {
            if (this.messageContainer.parentNode) {
                this.messageContainer.parentNode.removeChild(this.messageContainer);
            }
            this.messageContainer = null;
        }
    }
    
    showMessage(message, type = 'info', silent = false) {
        // If silent mode is enabled, don't show notifications
        if (silent) return;
        
        const container = this.getMessageContainer();
        const key = `${type}:${message}`;
        const existingEntry = this.activeMessages.find(item => item && item.key === key);

        if (existingEntry) {
            existingEntry.count += 1;
            const effectiveMessage = existingEntry.count > 1 ? `${existingEntry.baseMessage} (${existingEntry.count})` : existingEntry.baseMessage;
            existingEntry.element.textContent = effectiveMessage;
            if (existingEntry.timeoutId) {
                clearTimeout(existingEntry.timeoutId);
            }
            existingEntry.timeoutId = setTimeout(() => this.dismissActiveMessage(existingEntry), 3000);
            return;
        }

        const messageEl = document.createElement('div');
        messageEl.textContent = message;
        messageEl.style.cssText = `
            min-width: 220px;
            max-width: 320px;
            padding: 15px 20px;
            border-radius: 12px;
            color: white;
            font-weight: 600;
            background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : type === 'warning' ? '#ffc107' : '#17a2b8'};
            box-shadow: 0 14px 32px rgba(112, 95, 135, 0.22);
            pointer-events: auto;
        `;

        container.appendChild(messageEl);

        const entry = {
            key,
            count: 1,
            baseMessage: message,
            element: messageEl,
            timeoutId: null
        };

        entry.timeoutId = setTimeout(() => this.dismissActiveMessage(entry), 3000);
        this.activeMessages.push(entry);
    }
    
    gameLoop() {
        if (!this.isRunning) return;
        
        // Performance monitoring - check for potential issues
        this.checkPerformance();
        
        // CRITICAL: Only process if this is the active game instance
        if (window.menuSystem && window.menuSystem.currentGame && window.menuSystem.currentGame !== this) {
            console.log(`Game loop skipped for slot ${this.saveSlot} - not the active game`);
            return;
        }
        
        // If the tab is hidden, drastically reduce work but keep minimal timers
        if (document.hidden) {
            try {
                const now = Date.now();
                if (!this._lastBgTick || (now - this._lastBgTick) >= 1000) {
                    this._lastBgTick = now;
                    // Keep session time and autosave progressing in the background
                    this.updateSessionTime();
                    this.checkAutoSave();
                }
            } catch (_) {}
            this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
            return;
        }
        
        try {
            // Update season
            this.updateSeason();
        
        this.updatePlants();
        this.checkRestock();
        this.updateWeather();
        this.checkStormDamage();
        this.checkAutoSave();
        this.checkAchievements();
            this.generateChallenges();
            
            // Check sprinkler growth for all plants
            this.checkAllSprinklerGrowth();
            
            // Periodically check for softlock and bless the player with a cheap fruit if needed
            this.checkSoftlockRelief();
            
            // Note: updateShopDisplay is now only called when needed, not in the game loop
            
            // Update particles
            this.updateParticles();
            
            // Update session time
            this.updateSessionTime();
        
        // Only draw if we have a canvas (for background processing, canvas might be null)
        if (this.canvas && this.ctx) {
            this.draw();
            }
        } catch (error) {
            console.error(`Error in game loop for slot ${this.saveSlot}:`, error);
            // Try to recover from the error
            this.handleGameLoopError(error);
        }
        
        this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
    }

    // Softlock relief: grant a fully grown cheap fruit on a random empty tile
    // Runs every softlockCheckInterval (10s). If softlocked, 50% chance each check,
    // but forces a blessing on the 3rd consecutive eligible check to cap wait at <=30s.
    checkSoftlockRelief() {
        const now = Date.now();
        if (!this.lastSoftlockCheck) this.lastSoftlockCheck = 0;
        if ((now - this.lastSoftlockCheck) < (this.softlockCheckInterval || 180000)) {
            return;
        }
        this.lastSoftlockCheck = now;

        // Determine if the player is softlocked: no affordable seeds and at least one empty tile
        const hasEmptyTile = (() => {
            for (let r = 0; r < this.gridSize; r++) {
                for (let c = 0; c < this.gridSize; c++) {
                    const cell = this.garden[r][c];
                    if (!cell.plant && !this.hasSprinkler(r, c)) return true;
                }
            }
            return false;
        })();
        if (!hasEmptyTile) {
            this.softlockMissCounter = 0;
            return;
        }

        // Is there any seed the player can afford right now?
        const canAffordAny = (() => {
            let affordable = false;
            for (const [seedType, inv] of Object.entries(this.shopInventory)) {
                const plantData = this.plantTypes[seedType];
                if (!plantData || !inv || inv.stock <= 0) continue;
                if (!this.isSeedAvailable(seedType)) continue;
                const baseCost = this.getSeedBaseCost(plantData);
                const price = this.getDiscountedSeedCost(baseCost);
                if (this.money >= price) { affordable = true; break; }
            }
            return affordable;
        })();

        // Not softlocked if we can afford something; reset miss counter
        if (canAffordAny) {
            this.softlockMissCounter = 0;
            return;
        }

        // Softlocked path: increment consecutive miss counter
        if (!Number.isFinite(this.softlockMissCounter)) this.softlockMissCounter = 0;
        this.softlockMissCounter += 1;

        // Chance gating to feel occasional, but force on the 3rd eligible check
        const shouldBless = (this.softlockMissCounter >= 3) || (Math.random() < 0.5);
        if (!shouldBless) {
            return;
        }

        // Choose a very cheap fruit type; prefer lettuce if available, else carrot, else any
        const candidateTypes = ['lettuce', 'carrot'];
        let chosenType = candidateTypes.find(t => this.plantTypes[t]);
        if (!chosenType) {
            // Fallback to any defined plant type
            const keys = Object.keys(this.plantTypes || {});
            if (!keys.length) return;
            chosenType = keys[0];
        }

        // Pick a random empty tile
        const empties = [];
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const cell = this.garden[r][c];
                if (!cell.plant && !this.hasSprinkler(r, c)) empties.push([r, c]);
            }
        }
        if (!empties.length) {
            this.softlockMissCounter = 0;
            return;
        }
        const [row, col] = empties[Math.floor(Math.random() * empties.length)];

        const plantObject = {
            type: chosenType,
            stage: this.growthStages.length - 1,
            plantedAt: now,
            isFullyGrown: true,
            growthStage: this.growthStages.length - 1,
            purchaseCost: 0
        };

        this.garden[row][col] = {
            plant: plantObject,
            watered: false,
            wateredAt: null,
            waterCooldown: 0,
            fertilized: false,
            fertilizedAt: null,
            fertilizerCooldown: 0,
            plantedAt: now
        };

        const plantName = this.plantTypes[chosenType]?.name || chosenType;
        this.showMessage(`✨ A blessing arrives: ${plantName}!`, 'success');
        // Reset the miss counter after a successful blessing
        this.softlockMissCounter = 0;
        this.saveGame();
        this.updateUI();
        this.draw();
    }
    
    checkPerformance() {
        // Check if the game has been running too long without a break
        const now = Date.now();
        if (!this.lastPerformanceCheck) {
            this.lastPerformanceCheck = now;
            this.performanceCheckCount = 0;
        }
        
        this.performanceCheckCount++;
        
        // Every 1000 frames (about 16 seconds at 60fps), do a performance check
        if (this.performanceCheckCount >= 1000) {
            const timeSinceLastCheck = now - this.lastPerformanceCheck;
            const expectedTime = 1000 * (1000 / 60); // Expected time for 1000 frames at 60fps
            
            // If we're running significantly slower than expected, there might be a performance issue
            if (timeSinceLastCheck > expectedTime * 1.5) {
                console.warn(`Performance issue detected in slot ${this.saveSlot}. Expected ${expectedTime}ms, got ${timeSinceLastCheck}ms`);
                this.optimizePerformance();
            }
            
            this.lastPerformanceCheck = now;
            this.performanceCheckCount = 0;
        }
        
        // Check for memory leaks - if we have too many event listeners
        if (this.eventListeners && this.eventListeners.length > 200) {
            console.warn(`Too many event listeners (${this.eventListeners.length}) in slot ${this.saveSlot}. Cleaning up...`);
            this.cleanupEventListeners();
        }
    }
    
    handleGameLoopError(error) {
        console.error(`Handling game loop error for slot ${this.saveSlot}:`, error);
        
        // Try to save the current state before attempting recovery
        try {
            this.saveGame();
        } catch (saveError) {
            console.error(`Failed to save game after error:`, saveError);
        }
        
        // Attempt to recover by reinitializing critical components
        try {
            // Reinitialize canvas if needed
            if (!this.canvas || !this.ctx) {
                this.initializeCanvas();
            }
            
            // Clear any stuck states
            this.selectedSeed = null;
            this.selectedSprinkler = null;
            this.currentTool = 'water';
            
            // Force a UI update
            this.updateUI();
            
            console.log(`Recovery attempt completed for slot ${this.saveSlot}`);
        } catch (recoveryError) {
            console.error(`Failed to recover from game loop error:`, recoveryError);
            // If recovery fails, stop the game to prevent further issues
            this.stopGame();
        }
    }
    
    optimizePerformance() {
        console.log(`Optimizing performance for slot ${this.saveSlot}`);
        
        // Clear any accumulated particles that might be causing slowdown
        if (this.particles && this.particles.length > 50) {
            this.particles = this.particles.slice(-20); // Keep only the last 20 particles
        }
        
        // Clear any old animations
        if (this.animations && this.animations.length > 10) {
            this.animations = this.animations.slice(-5); // Keep only the last 5 animations
        }
        
        // Force garbage collection hint (if available)
        if (window.gc) {
            window.gc();
        }
    }
    
    cleanupEventListeners() {
        console.log(`Cleaning up event listeners for slot ${this.saveSlot}`);
        
        // Remove old event listeners, keeping only the most recent ones
        if (this.eventListeners && this.eventListeners.length > 50) {
            const recentListeners = this.eventListeners.slice(-30); // Keep only the last 30
            
            // Remove the old ones
            this.eventListeners.slice(0, -30).forEach(({ element, event, handler }) => {
                if (element && element.removeEventListener) {
                    element.removeEventListener(event, handler);
                }
            });
            
            this.eventListeners = recentListeners;
        }
        
        // Re-initialize critical event listeners that might have been removed
        this.initializeEventListeners();
    }
    
    removeEventListeners() {
        console.log(`Removing event listeners for slot ${this.saveSlot}`);
        
        // Remove all tracked event listeners
        this.eventListeners.forEach(({ element, event, handler }) => {
            if (element && element.removeEventListener) {
                element.removeEventListener(event, handler);
            }
        });
        
        // Clear the event listeners array
        this.eventListeners = [];
        console.log(`Event listeners removed for slot ${this.saveSlot}`);
    }
    
    stopGame() {
        console.log(`Stopping game instance ${this.instanceId} for slot ${this.saveSlot}`);
        this.isRunning = false;
        
        // Clear any timers or intervals
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
        }
        
        // Remove all event listeners
        this.removeEventListeners();

        // Reset hover UI state
        this.cancelTouchHover();
        this.hideGardenTooltip();
        this.hideToolQuickMenu();
        
        // Clear UI state
        this.selectedSeed = null;
        this.selectedSprinkler = null;
        this.currentTool = 'water';
        
        console.log(`Game instance ${this.instanceId} for slot ${this.saveSlot} stopped`);
    }
    
    saveGame() {
        console.log(`saveGame called for slot ${this.saveSlot} at ${new Date().toLocaleTimeString()}`);
        
        // Validate the current state before saving
        if (!this.saveSlot || this.saveSlot < 1 || this.saveSlot > 3) {
            console.error(`Invalid saveSlot in saveGame: ${this.saveSlot}`);
            return;
        }
        
        // Validate money is not negative
        if (this.money < 0) {
            console.error(`Invalid money value: ${this.money}, setting to 0`);
            this.money = 0;
        }
        
        // Validate sprinkler inventory is not negative
        Object.keys(this.sprinklerInventory).forEach(type => {
            if (this.sprinklerInventory[type] < 0) {
                console.error(`Invalid sprinkler inventory for ${type}: ${this.sprinklerInventory[type]}, setting to 0`);
                this.sprinklerInventory[type] = 0;
            }
        });
        
        const nameForStorage = sanitizeGardenName(this.gardenName, this.defaultGardenName());
        this.gardenName = nameForStorage;
        this.updateGardenTitle();

        const saveData = {
            saveSlot: this.saveSlot, // Include saveSlot in the save data for verification
            money: this.money,
            water: this.water,
            fertilizer: this.fertilizer,
            score: this.score,
            gardenName: nameForStorage,
            garden: this.garden,
            shopInventory: this.shopInventory,
            lastRestockTime: this.lastRestockTime,
            restockInterval: this.restockInterval,
            toolLevels: this.toolLevels,
            toolUpgradeCosts: this.toolUpgradeCosts,
            harvestBonus: this.harvestBonus,
            weather: this.weather,
            achievements: this.achievements,
            achievementStats: {
                ...this.achievementStats,
                differentPlantsPlanted: Array.from(this.achievementStats.differentPlantsPlanted)
            },
            sprinklerInventory: this.sprinklerInventory,
            sprinklers: this.sprinklers,
            soundEnabled: this.soundEnabled,
            rebirths: this.rebirths,
            rebirthPoints: this.rebirthPoints,
            bestRebirthScore: this.bestRebirthScore,
            currentRunStartTime: this.currentRunStartTime,
            prestigeUpgrades: this.prestigeUpgrades,

            // New features
            currentSeason: this.currentSeason,
            seasonDay: this.seasonDay,
            seasonMultiplier: this.seasonMultiplier,
            seasonStartTime: this.seasonStartTime,
            gardenSize: this.gardenSize,
            expansionCost: this.expansionCost,
            stats: this.stats,
            challenges: this.challenges,
            lastChallengeUpdate: this.lastChallengeUpdate,

            // Quick Seeds preferences
            seedRecent: Array.isArray(this.seedRecent) ? this.seedRecent : [],

            saveTime: Date.now()
        };
        
        const saveKey = `gardenGameSave_${this.saveSlot}`;
        console.log(`Saving to localStorage key: ${saveKey}`);
        console.log(`Save data slot verification: ${saveData.saveSlot}`);
        
        localStorage.setItem(saveKey, JSON.stringify(saveData));
        
        // Also save a timestamp for when this save was created
        localStorage.setItem(`lastSaveTime_${this.saveSlot}`, Date.now().toString());
        
        console.log(`Game saved to slot ${this.saveSlot} at ${new Date().toLocaleTimeString()}`);
        console.log(`Save data: money=${this.money}, sprinklerInventory=`, this.sprinklerInventory);
        
        // Send garden data to multiplayer server if connected
        if (window.multiplayer && window.multiplayer.isConnected) {
            try {
                const gardenData = {
                    garden: this.garden,
                    money: this.money,
                    score: this.score,
                    achievements: this.achievements,
                    stats: this.stats,
                    currentSeason: this.currentSeason,
                    seasonDay: this.seasonDay,
                    gardenSize: this.gardenSize
                };
                window.multiplayer.sendGardenUpdate(gardenData);
                console.log('🌐 Garden data sent to multiplayer server');
            } catch (error) {
                console.error('Error sending garden data to server:', error);
            }
        }
        
        // Verify the save was successful by reading it back
        const savedData = localStorage.getItem(saveKey);
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                if (parsedData.saveSlot !== this.saveSlot) {
                    console.error(`Save verification failed! Saved slot ${parsedData.saveSlot} doesn't match current slot ${this.saveSlot}`);
                } else {
                    console.log(`Save verification successful for slot ${this.saveSlot}`);
                }
            } catch (error) {
                console.error(`Error verifying save data:`, error);
            }
        } else {
            console.error(`Save verification failed! No data found in localStorage for key ${saveKey}`);
        }
    }
    
    saveGameWithProtection() {
        console.log(`[${new Date().toLocaleTimeString()}] saveGameWithProtection called for slot ${this.saveSlot}`);
        
        // Set a protection timestamp to prevent background processing from overwriting
        localStorage.setItem(`adminChange_${this.saveSlot}`, Date.now().toString());
        
        // Call the regular saveGame method
        this.saveGame();
        
        // Set another protection timestamp after saving
        localStorage.setItem(`lastSaveTime_${this.saveSlot}`, Date.now().toString());
        
        console.log(`[${new Date().toLocaleTimeString()}] Save protection applied for slot ${this.saveSlot}`);
    }
    
    clearUIState() {
        // Reset all UI elements to default/zero values
        if (document.getElementById('money')) {
            document.getElementById('money').textContent = '0';
        }
        if (document.getElementById('water')) {
            document.getElementById('water').textContent = '0';
        }
        if (document.getElementById('fertilizer')) {
            document.getElementById('fertilizer').textContent = '0';
        }
        if (document.getElementById('score')) {
            document.getElementById('score').textContent = '0';
        }
        if (document.getElementById('weather')) {
            document.getElementById('weather').textContent = 'Sunny';
        }
        if (document.getElementById('rebirthCount')) {
            document.getElementById('rebirthCount').textContent = '0';
        }
        if (document.getElementById('rebirthSummary')) {
            document.getElementById('rebirthSummary').textContent = 'Cycle 0 · Next target: 5,000 score';
        }
        const rebirthBtn = document.getElementById('rebirthBtn');
        if (rebirthBtn) {
            rebirthBtn.disabled = true;
            rebirthBtn.textContent = '♻️ Rebirth Locked';
        }
        
        // Clear achievements display
        const achievementsList = document.getElementById('achievements-list');
        if (achievementsList) {
            achievementsList.innerHTML = '';
        }
        
        // Clear shop items
        const shopContainer = document.getElementById('shop-container');
        if (shopContainer) {
            shopContainer.innerHTML = '';
        }
        
        // Clear tool upgrades
        const toolUpgradesContainer = document.getElementById('tool-upgrades-container');
        if (toolUpgradesContainer) {
            toolUpgradesContainer.innerHTML = '';
        }
        
        // Clear any existing notifications
        const existingMessages = document.querySelectorAll('[style*="position: fixed"][style*="top: 20px"][style*="right: 20px"]');
        existingMessages.forEach(msg => {
            if (msg.parentNode) {
                msg.parentNode.removeChild(msg);
            }
        });
        
        // Clear all UI selections
        document.querySelectorAll('.seed-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.sprinkler-tool').forEach(btn => {
            btn.classList.remove('active');
        });
        
        console.log('UI state cleared completely');
    }

    createDefaultShopInventory() {
        return {
            carrot: { stock: 7, maxStock: 10, restockAmount: 5 },
            lettuce: { stock: 8, maxStock: 10, restockAmount: 5 },
            tomato: { stock: 6, maxStock: 8, restockAmount: 4 },
            corn: { stock: 4, maxStock: 6, restockAmount: 3 },
            cucumber: { stock: 6, maxStock: 8, restockAmount: 4 },
            zucchini: { stock: 5, maxStock: 7, restockAmount: 3 },
            radish: { stock: 8, maxStock: 10, restockAmount: 5 },
            spinach: { stock: 7, maxStock: 9, restockAmount: 4 },
            peas: { stock: 8, maxStock: 10, restockAmount: 5 },
            onion: { stock: 6, maxStock: 8, restockAmount: 4 },
            garlic: { stock: 5, maxStock: 7, restockAmount: 3 },
            potato: { stock: 6, maxStock: 8, restockAmount: 4 },
            celery: { stock: 6, maxStock: 8, restockAmount: 4 },
            bell_pepper: { stock: 4, maxStock: 6, restockAmount: 3 },
            hot_pepper: { stock: 5, maxStock: 7, restockAmount: 3 },
            avocado: { stock: 4, maxStock: 6, restockAmount: 3 },
            eggplant: { stock: 4, maxStock: 6, restockAmount: 3 },
            sweet_potato: { stock: 5, maxStock: 7, restockAmount: 3 },
            mushroom: { stock: 4, maxStock: 6, restockAmount: 3 },
            winter_greens: { stock: 4, maxStock: 6, restockAmount: 3 },
            herbs: { stock: 6, maxStock: 8, restockAmount: 4 },
            broccoli: { stock: 3, maxStock: 5, restockAmount: 2 },
            cauliflower: { stock: 2, maxStock: 4, restockAmount: 2 },
            cabbage: { stock: 5, maxStock: 7, restockAmount: 3 },
            squash: { stock: 5, maxStock: 7, restockAmount: 3 },
            pumpkin: { stock: 2, maxStock: 3, restockAmount: 1 },
            watermelon: { stock: 2, maxStock: 3, restockAmount: 1 },
            melon: { stock: 3, maxStock: 4, restockAmount: 2 },
            blueberry: { stock: 3, maxStock: 4, restockAmount: 2 },
            strawberry: { stock: 6, maxStock: 8, restockAmount: 4 },
            banana: { stock: 6, maxStock: 8, restockAmount: 4 },
            apple: { stock: 6, maxStock: 8, restockAmount: 4 },
            green_apple: { stock: 5, maxStock: 7, restockAmount: 3 },
            pear: { stock: 5, maxStock: 7, restockAmount: 3 },
            peach: { stock: 5, maxStock: 7, restockAmount: 3 },
            cherries: { stock: 6, maxStock: 8, restockAmount: 4 },
            orange: { stock: 6, maxStock: 8, restockAmount: 4 },
            lemon: { stock: 6, maxStock: 8, restockAmount: 4 },
            kiwi: { stock: 2, maxStock: 3, restockAmount: 1 },
            coconut: { stock: 1, maxStock: 2, restockAmount: 1 },
            olive: { stock: 2, maxStock: 3, restockAmount: 1 },
            asparagus: { stock: 3, maxStock: 4, restockAmount: 2 },
            artichoke: { stock: 2, maxStock: 3, restockAmount: 1 },
            grapes: { stock: 3, maxStock: 4, restockAmount: 2 },
            pineapple: { stock: 1, maxStock: 2, restockAmount: 1 },
            mango: { stock: 2, maxStock: 3, restockAmount: 1 },
            dragonfruit: { stock: 1, maxStock: 1, restockAmount: 1 }
        };
    }

    createDefaultSprinklerInventory() {
        return {
            basic: 0,
            advanced: 0,
            premium: 0,
            legendary: 0
        };
    }

    createPrestigeUpgradeCatalog() {
        return [
            {
                id: 'harvestMastery',
                name: 'Harvest Mastery',
                icon: '🌾',
                description: 'Each level adds +5% permanent harvest value.',
                baseCost: 4,
                costGrowth: 2,
                maxLevel: 10
            },
            {
                id: 'seedEconomy',
                name: 'Seed Saver',
                icon: '',
                description: 'Each level reduces seed prices by 4% (up to 24%).',
                baseCost: 3,
                costGrowth: 1,
                maxLevel: 6
            },
            {
                id: 'starterKit',
                name: 'Starter Kit',
                icon: '🎁',
                description: 'Each level grants +$150, +40 water, +25 fertilizer at the start of a run.',
                baseCost: 5,
                costGrowth: 3,
                maxLevel: 5
            }
        ];
    }

    createDefaultPrestigeUpgrades() {
        const upgrades = {};
        if (Array.isArray(this.prestigeUpgradeCatalog)) {
            this.prestigeUpgradeCatalog.forEach(upgrade => {
                upgrades[upgrade.id] = { level: 0 };
            });
        }
        return upgrades;
    }

    normalizePrestigeUpgrades(rawUpgrades = {}) {
        const normalized = this.createDefaultPrestigeUpgrades();
        Object.keys(normalized).forEach(id => {
            const stored = rawUpgrades?.[id];
            let level = 0;
            if (stored && typeof stored === 'object') {
                level = stored.level;
            } else if (typeof stored === 'number') {
                level = stored;
            }

            if (!Number.isFinite(level)) {
                level = 0;
            }

            level = Math.max(0, Math.floor(level));
            const maxLevel = this.prestigeUpgradeMap?.[id]?.maxLevel ?? 0;
            if (maxLevel > 0) {
                level = Math.min(level, maxLevel);
            }
            normalized[id].level = level;
        });
        return normalized;
    }

    getRebirthTargetScore() {
        const baseTarget = 5000;
        const scalingFactor = 1.75;
        return Math.floor(baseTarget * Math.pow(scalingFactor, this.rebirths));
    }

    getRebirthHarvestIncrement() {
        return 0.25;
    }

    getRebirthHarvestBonus() {
        return this.rebirths * this.getRebirthHarvestIncrement();
    }

    getRebirthStartingResourceMultiplier() {
        return 1 + (this.rebirths * 0.15);
    }

    getPrestigeUpgradeLevel(upgradeId) {
        return this.prestigeUpgrades?.[upgradeId]?.level ?? 0;
    }

    // Global multiplier to make prestige upgrades cheaper in tokens
    // Assumption: reduce costs by 30% (multiplier = 0.7). Adjust here if needed.
    getPrestigeCostMultiplier() {
        return 0.7;
    }

    getPrestigeUpgradeCost(upgradeId) {
        const config = this.prestigeUpgradeMap?.[upgradeId];
        if (!config) {
            return Number.POSITIVE_INFINITY;
        }
        const level = this.getPrestigeUpgradeLevel(upgradeId);
        const rawCost = config.baseCost + (config.costGrowth * level);
        const scaled = rawCost * this.getPrestigeCostMultiplier();
        return Math.max(1, Math.floor(scaled));
    }

    getPrestigeSeedDiscount() {
        const level = this.getPrestigeUpgradeLevel('seedEconomy');
        if (level <= 0) {
            return 0;
        }
        return Math.min(level * 0.04, 0.4);
    }

    getPrestigeSeedCostMultiplier() {
        return Math.max(0.3, 1 - this.getPrestigeSeedDiscount());
    }

    getDiscountedSeedCost(baseCost) {
        const cost = Number.isFinite(baseCost) ? baseCost : 0;
        const multiplier = this.getPrestigeSeedCostMultiplier();
        return Math.max(1, Math.round(cost * multiplier));
    }

    getSeedBaseCost(seedData) {
        if (!seedData || typeof seedData !== 'object') {
            return 0;
        }
        if (Number.isFinite(seedData.cost)) {
            return seedData.cost;
        }
        if (Number.isFinite(seedData.price)) {
            return seedData.price;
        }
        return 0;
    }

    getPrestigeHarvestBonus() {
        const level = this.getPrestigeUpgradeLevel('harvestMastery');
        if (level <= 0) {
            return 0;
        }
        return level * 0.05;
    }

    getPrestigeStartingResources() {
        const level = this.getPrestigeUpgradeLevel('starterKit');
        if (level <= 0) {
            return { money: 0, water: 0, fertilizer: 0 };
        }
        return {
            money: level * 150,
            water: level * 40,
            fertilizer: level * 25
        };
    }

    getPrestigeEffectDetails(upgradeId, level) {
        const resolvedLevel = Math.max(0, level);
        const formatNumber = (value) => Number(value || 0).toLocaleString();

        switch (upgradeId) {
            case 'harvestMastery': {
                const total = Math.round(resolvedLevel * 5);
                return resolvedLevel > 0 ? `+${total}% harvest value` : 'No harvest bonus yet';
            }
            case 'seedEconomy': {
                const total = Math.round(resolvedLevel * 4);
                return resolvedLevel > 0 ? `${total}% seed discount` : 'No seed discount yet';
            }
            case 'starterKit': {
                if (resolvedLevel <= 0) {
                    return 'No starting resource bonus yet';
                }
                const money = formatNumber(resolvedLevel * 150);
                const water = formatNumber(resolvedLevel * 40);
                const fertilizer = formatNumber(resolvedLevel * 25);
                return `Start with +$${money}, +${water} water, +${fertilizer} fertilizer`;
            }
            default:
                return '';
        }
    }

    calculatePrestigeRefundTotal() {
        if (!this.prestigeUpgrades || !this.prestigeUpgradeMap) {
            return 0;
        }

        let total = 0;
        Object.keys(this.prestigeUpgrades).forEach(upgradeId => {
            const config = this.prestigeUpgradeMap[upgradeId];
            if (!config) {
                return;
            }
            const level = this.getPrestigeUpgradeLevel(upgradeId);
            if (level <= 0) {
                return;
            }

            const n = level;
            const base = Number(config.baseCost || 0);
            const growth = Number(config.costGrowth || 0);
            const refund = (n / 2) * ((2 * base) + ((n - 1) * growth));
            // Scale refund by the same cost multiplier to match current pricing
            total += refund * this.getPrestigeCostMultiplier();
        });

        return Math.max(0, Math.floor(total));
    }

    respecPrestigeUpgrades() {
        const refundable = this.calculatePrestigeRefundTotal();
        if (refundable <= 0) {
            this.showMessage('No prestige upgrades to respec right now.', 'info');
            return;
        }

        const confirmed = window.confirm('Respec prestige upgrades? This will refund all spent tokens and reset upgrade levels.');
        if (!confirmed) {
            return;
        }

        this.prestigeUpgrades = this.createDefaultPrestigeUpgrades();
        this.rebirthPoints = Math.max(0, (this.rebirthPoints || 0) + refundable);
        this.saveGame();
        this.updatePrestigeStoreUI();
        this.showMessage(`Prestige upgrades reset. Refunded ${refundable.toLocaleString()} token${refundable === 1 ? '' : 's'}.`, 'success');
    }

    canRebirth() {
        return this.score >= this.getRebirthTargetScore();
    }

    handleRebirthClick() {
        if (!this.canRebirth()) {
            const remaining = Math.max(0, this.getRebirthTargetScore() - this.score);
            this.showMessage(`Keep growing! ${remaining.toLocaleString()} more score needed.`, 'info');
            return;
        }

        const confirmation = window.confirm('♻️ Ready to rebirth? This will reset your garden, seeds, and upgrades in exchange for a permanent harvest boost.');
        if (confirmation) {
            this.performRebirth();
        }
    }

    performRebirth() {
        const currentTarget = this.getRebirthTargetScore();
        const runScore = this.score;
        const runStart = this.stats.sessionStartTime || this.currentRunStartTime || Date.now();
        const now = Date.now();
        const runDuration = now - runStart;

        if (runDuration > (this.stats.longestPlaySession || 0)) {
            this.stats.longestPlaySession = runDuration;
        }

        this.bestRebirthScore = Math.max(this.bestRebirthScore || 0, runScore);

        const rewardPoints = Math.max(1, Math.floor(runScore / Math.max(1, currentTarget)));
    this.rebirthPoints = Math.floor((this.rebirthPoints || 0) + rewardPoints);

        this.rebirths += 1;
        this.stats.totalRebirths = (this.stats.totalRebirths || 0) + 1;

        this.currentRunStartTime = now;
        this.stats.sessionStartTime = now;
        this.rebirthNotificationShown = false;

    this.gardenSize = 8;
    this.gridSize = this.gardenSize;
    this.cellSize = Math.floor(600 / this.gridSize);
    this.expansionCost = 1500;
        this.garden = this.initializeGarden();

        this.shopInventory = this.createDefaultShopInventory();
        this.sprinklerInventory = this.createDefaultSprinklerInventory();
        this.sprinklers = [];
        this.lastRestockTime = now;

    this.toolLevels = { water: 1, fertilizer: 1, shovel: 1, harvest: 1 };
    this.recomputeAllToolUpgradeCosts();
        this.harvestBonus = 0;

        this.selectedSeed = null;
        this.selectedSprinkler = null;
        this.selectedDecoration = null;
        this.currentTool = 'water';
        this.toolCooldowns = { water: 0, fertilizer: 0 };
        this.plantEffects = { watered: {}, fertilized: {} };

        const resourceMultiplier = this.getRebirthStartingResourceMultiplier();
    const prestigeStartingBonus = this.getPrestigeStartingResources();
    this.money = Math.floor(100 * resourceMultiplier) + (prestigeStartingBonus.money || 0);
    this.water = Math.floor(50 * resourceMultiplier) + (prestigeStartingBonus.water || 0);
    this.fertilizer = Math.floor(20 * resourceMultiplier) + (prestigeStartingBonus.fertilizer || 0);
        this.score = 0;

        this.currentSeason = 'spring';
        this.seasonDay = 1;
        this.seasonMultiplier = 1.0;
        this.seasonStartTime = null;
        this.weather = 'sunny';
        this.lastWeatherChange = now;

        this.challenges = { daily: [], weekly: null, completed: [] };
        this.lastChallengeUpdate = now;
        this.generateChallenges();

        this.particles = [];
        this.animations = [];

    // Recalculate canvas for the reset size
    this.adjustCanvasForMobile();
    this.updateUI();
        this.updateToolDisplay();
        this.updateSprinklerDisplay();
        this.updateAchievementsDisplay();
        this.saveGame();

    const totalBonusPercent = Math.round(this.getRebirthHarvestBonus() * 100);
    const nextBonusPercent = Math.round(this.getRebirthHarvestIncrement() * 100);
    const tokenText = rewardPoints === 1 ? '1 token' : `${rewardPoints} tokens`;
    this.showMessage(`Rebirth complete! Permanent harvest bonus is now +${totalBonusPercent}%. You earned ${tokenText}. Next rebirth adds another +${nextBonusPercent}%.`, 'success');
        this.playSound('achievement');
    }

    updateRebirthUI() {
        const countElement = document.getElementById('rebirthCount');
        if (countElement) {
            countElement.textContent = this.rebirths;
        }

        const summaryElement = document.getElementById('rebirthSummary');
        if (summaryElement) {
            const targetScore = this.getRebirthTargetScore();
            const remaining = Math.max(0, targetScore - this.score);
            const parts = [`Cycle ${this.rebirths}`];

            if (this.canRebirth()) {
                parts.push('Ready to rebirth!');
            } else {
                parts.push(`Next target: ${targetScore.toLocaleString()} score`);
                if (remaining > 0) {
                    parts.push(`${remaining.toLocaleString()} to go`);
                }
            }

            const permanentBonus = Math.round(this.getRebirthHarvestBonus() * 100);
            if (permanentBonus > 0) {
                parts.push(`Bonus: +${permanentBonus}% harvest`);
            }

            const prestigeHarvest = Math.round(this.getPrestigeHarvestBonus() * 100);
            if (prestigeHarvest > 0) {
                parts.push(`Prestige harvest: +${prestigeHarvest}%`);
            }

            const seedDiscount = Math.round(this.getPrestigeSeedDiscount() * 100);
            if (seedDiscount > 0) {
                parts.push(`Seed discount: ${seedDiscount}%`);
            }

            const starterLevel = this.getPrestigeUpgradeLevel('starterKit');
            if (starterLevel > 0) {
                const starterBonus = this.getPrestigeStartingResources();
                const moneyBoost = Number(starterBonus.money || 0).toLocaleString();
                parts.push(`Starter boost: +$${moneyBoost} cash`);
            }

            parts.push(`Tokens: ${Number(this.rebirthPoints || 0).toLocaleString()}`);

            if ((this.bestRebirthScore || 0) > 0) {
                parts.push(`Best run: ${this.bestRebirthScore.toLocaleString()}`);
            }

            summaryElement.textContent = parts.join(' · ');
        }

        const buttonElement = document.getElementById('rebirthBtn');
        if (buttonElement) {
            if (this.canRebirth()) {
                buttonElement.disabled = false;
                buttonElement.textContent = `♻️ Rebirth for +${Math.round(this.getRebirthHarvestIncrement() * 100)}% harvest`;
            } else {
                const remaining = Math.max(0, this.getRebirthTargetScore() - this.score);
                buttonElement.disabled = true;
                buttonElement.textContent = `♻️ Rebirth Locked (${remaining.toLocaleString()} score to go)`;
            }
        }

        if (this.canRebirth()) {
            if (!this.rebirthNotificationShown) {
                this.rebirthNotificationShown = true;
                this.showMessage('♻️ Rebirth ready! Reset your garden whenever you are prepared.', 'success');
            }
        } else {
            this.rebirthNotificationShown = false;
        }

        this.updatePrestigeStoreUI();
    }

    updatePrestigePanelVisibility(forceExpanded) {
        if (typeof forceExpanded === 'boolean') {
            this.prestigePanelExpanded = forceExpanded;
        }

        const prestigeToggle = document.getElementById('prestigeToggle');
        const prestigePanel = document.getElementById('prestigePanel');

        if (!prestigeToggle || !prestigePanel) {
            return;
        }

        const expanded = !!this.prestigePanelExpanded;
        prestigeToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        prestigeToggle.textContent = expanded ? 'Hide Hub' : 'Show Hub';
        prestigeToggle.setAttribute('aria-label', expanded ? 'Hide prestige hub' : 'Show prestige hub');
        prestigePanel.hidden = !expanded;
        prestigePanel.style.display = expanded ? '' : 'none';
        prestigePanel.classList.toggle('is-open', expanded);
        const prestigeSection = prestigeToggle.closest('.prestige-section');
        if (prestigeSection) {
            prestigeSection.classList.toggle('collapsed', !expanded);
        }
    }

    updatePrestigeStoreUI() {
        const tokenDisplay = document.getElementById('rebirthTokenCount');
        if (tokenDisplay) {
            tokenDisplay.textContent = Number(this.rebirthPoints || 0).toLocaleString();
        }

        const cycleCountElement = document.getElementById('prestigeCycleCount');
        if (cycleCountElement) {
            cycleCountElement.textContent = Number(this.rebirths || 0).toLocaleString();
        }

        const bestScoreElement = document.getElementById('prestigeBestScore');
        if (bestScoreElement) {
            bestScoreElement.textContent = Number(this.bestRebirthScore || 0).toLocaleString();
        }

        const nextTargetElement = document.getElementById('prestigeNextTarget');
        if (nextTargetElement) {
            nextTargetElement.textContent = this.getRebirthTargetScore().toLocaleString();
        }

        const cycleSummary = document.getElementById('prestigeCycleSummary');
        if (cycleSummary) {
            const bonusPercent = Math.round(this.getRebirthHarvestBonus() * 100);
            cycleSummary.textContent = `Cycle ${Number(this.rebirths || 0).toLocaleString()} · Harvest bonus +${bonusPercent}%`;
        }

        const rebirthShortcut = document.getElementById('prestigeRebirthShortcut');
        if (rebirthShortcut) {
            if (this.canRebirth()) {
                rebirthShortcut.disabled = false;
                rebirthShortcut.textContent = 'Start New Cycle';
                rebirthShortcut.title = 'Reset now to begin a fresh cycle with your prestige bonuses.';
            } else {
                const remaining = Math.max(0, this.getRebirthTargetScore() - this.score);
                rebirthShortcut.disabled = true;
                rebirthShortcut.textContent = `Need ${remaining.toLocaleString()} score`;
                rebirthShortcut.title = 'Keep playing to reach the next cycle threshold.';
            }
        }

        const respecButton = document.getElementById('prestigeRespecBtn');
        if (respecButton) {
            const refundable = this.calculatePrestigeRefundTotal();
            const hasRefund = refundable > 0;
            respecButton.disabled = !hasRefund;
            respecButton.textContent = hasRefund
                ? `Respec Upgrades (+${refundable.toLocaleString()} tokens)`
                : 'Respec Unavailable';
            respecButton.title = hasRefund
                ? 'Reset prestige upgrades and reclaim your spent tokens.'
                : 'Spend tokens on upgrades before respeccing.';
        }

        if (!this.prestigeUpgrades) {
            this.prestigeUpgrades = this.createDefaultPrestigeUpgrades();
        }

        const listElement = document.getElementById('prestigeUpgradeList');
        if (!listElement || !Array.isArray(this.prestigeUpgradeCatalog)) {
            return;
        }

        listElement.innerHTML = '';

        const fragment = document.createDocumentFragment();
        this.prestigeUpgradeCatalog.forEach(upgrade => {
            const level = this.getPrestigeUpgradeLevel(upgrade.id);
            const cappedLevel = Math.min(level, upgrade.maxLevel);
            const isMaxed = cappedLevel >= upgrade.maxLevel;
            const cost = this.getPrestigeUpgradeCost(upgrade.id);
            const affordable = (this.rebirthPoints || 0) >= cost;
            const currentEffect = this.getPrestigeEffectDetails(upgrade.id, level);
            const nextEffect = isMaxed ? 'Max level reached' : this.getPrestigeEffectDetails(upgrade.id, level + 1);

            const card = document.createElement('div');
            card.className = 'prestige-upgrade-card';

            const header = document.createElement('div');
            header.className = 'prestige-upgrade-header';

            const title = document.createElement('div');
            title.className = 'prestige-upgrade-title';

            const icon = document.createElement('span');
            icon.className = 'icon';
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = upgrade.icon || '♻️';

            const titleText = document.createElement('span');
            titleText.textContent = upgrade.name;

            title.appendChild(icon);
            title.appendChild(titleText);

            const levelLabel = document.createElement('span');
            levelLabel.className = 'prestige-upgrade-level';
            levelLabel.textContent = `Lv.${cappedLevel}/${upgrade.maxLevel}`;

            header.appendChild(title);
            header.appendChild(levelLabel);

            const body = document.createElement('div');
            body.className = 'prestige-upgrade-body';

            const description = document.createElement('p');
            description.textContent = upgrade.description;

            const currentLine = document.createElement('p');
            currentLine.innerHTML = `<strong>Current:</strong> ${currentEffect}`;

            const nextLine = document.createElement('p');
            nextLine.innerHTML = isMaxed ? '<strong>Next:</strong> —' : `<strong>Next:</strong> ${nextEffect}`;

            body.appendChild(description);
            body.appendChild(currentLine);
            body.appendChild(nextLine);

            const actions = document.createElement('div');
            actions.className = 'prestige-upgrade-actions';

            const costLabel = document.createElement('span');
            costLabel.className = 'prestige-upgrade-cost';
            costLabel.textContent = isMaxed ? 'No cost' : `Cost: ${cost} token${cost === 1 ? '' : 's'}`;
            actions.appendChild(costLabel);

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'prestige-upgrade-btn';
            button.dataset.upgradeId = upgrade.id;

            if (isMaxed) {
                button.textContent = 'Maxed';
                button.disabled = true;
                button.title = 'Fully upgraded';
            } else {
                button.textContent = affordable ? `Spend ${cost} token${cost === 1 ? '' : 's'}` : `Need ${cost} token${cost === 1 ? '' : 's'}`;
                button.disabled = !affordable;
                button.title = affordable ? 'Spend prestige tokens for this upgrade' : 'Rebirth to earn more tokens';
                if (affordable) {
                    button.addEventListener('click', () => this.purchasePrestigeUpgrade(upgrade.id));
                }
            }

            actions.appendChild(button);

            card.appendChild(header);
            card.appendChild(body);
            card.appendChild(actions);

            fragment.appendChild(card);
        });

        listElement.appendChild(fragment);

        this.updatePrestigePanelVisibility();
        // Also refresh active bonuses summary on any UI rebuild
        this.updateActiveBonusesDisplay();
        this.updateBonusesPopup();
    }

    purchasePrestigeUpgrade(upgradeId) {
        const config = this.prestigeUpgradeMap?.[upgradeId];
        if (!config) {
            return;
        }

        if (!this.prestigeUpgrades[upgradeId]) {
            this.prestigeUpgrades[upgradeId] = { level: 0 };
        }

        const currentLevel = this.getPrestigeUpgradeLevel(upgradeId);
        if (currentLevel >= config.maxLevel) {
            this.showMessage(`${config.name} is already at maximum level.`, 'info');
            return;
        }

        const cost = this.getPrestigeUpgradeCost(upgradeId);
        const tokens = this.rebirthPoints || 0;
        if (tokens < cost) {
            const missing = cost - tokens;
            this.showMessage(`Need ${missing} more token${missing === 1 ? '' : 's'} for ${config.name}.`, 'error');
            return;
        }

        this.rebirthPoints = Math.max(0, Math.floor(tokens - cost));
    const newLevel = Math.min(currentLevel + 1, config.maxLevel);
    this.prestigeUpgrades[upgradeId].level = newLevel;

        const effectSummary = this.getPrestigeEffectDetails(upgradeId, newLevel);
        this.showMessage(`${config.name} upgraded to Lv.${newLevel}! ${effectSummary}.`, 'success');
        this.playSound('achievement');

        this.updateRebirthUI();
        this.updateShopDisplay();
        this.updateBonusesPopup();
        this.saveGame();
    }


    initializeFreshGame() {
        console.log(`Initializing fresh game for slot ${this.saveSlot}`);

        const pendingName = this._initialGardenName ?? this.gardenName;
        this.setGardenName(pendingName, { shouldSave: false });
        this._initialGardenName = null;
        
        // CRITICAL: Clear any existing save data for this slot from localStorage
        const saveKey = `gardenGameSave_${this.saveSlot}`;
        localStorage.removeItem(saveKey);
        console.log(`Cleared existing save data for slot ${this.saveSlot} from localStorage`);

    const runStart = Date.now();
    this.rebirths = 0;
    this.rebirthPoints = 0;
    this.bestRebirthScore = 0;
    this.currentRunStartTime = runStart;
    this.rebirthNotificationShown = false;
    this.prestigeUpgrades = this.createDefaultPrestigeUpgrades();
        
        // Initialize fresh garden
        this.garden = this.initializeGarden();
        
        // Initialize fresh inventories with correct structure
        this.shopInventory = this.createDefaultShopInventory();
        this.sprinklerInventory = this.createDefaultSprinklerInventory();
        
        // Reset other game state
        this.money = 100;
        this.water = 50;
        this.fertilizer = 20;
    const prestigeStartingBonus = this.getPrestigeStartingResources();
    this.money += prestigeStartingBonus.money || 0;
    this.water += prestigeStartingBonus.water || 0;
    this.fertilizer += prestigeStartingBonus.fertilizer || 0;
        this.score = 0;
        this.sprinklers = [];
    this.lastRestockTime = runStart;
    this.weather = 'sunny';
    this.lastWeatherChange = runStart;
        
        // Reset tool levels and upgrade costs
        this.toolLevels = {
            water: 1,
            fertilizer: 1,
            shovel: 1,
            harvest: 1
        };
        // Use unified pricing model for next-level costs
        this.recomputeAllToolUpgradeCosts();
        
        // Harvest bonus from upgraded harvest tool
        this.harvestBonus = 0;
        this.toolCooldowns = { water: 0, fertilizer: 0 };
        this.plantEffects = { watered: {}, fertilized: {} };
    this.selectedSeed = null;
    this.selectedSprinkler = null;
    this.selectedDecoration = null;
    this.currentTool = 'water';
        

        
        // Initialize new features
        this.currentSeason = 'spring';
        this.seasonDay = 1;
        this.seasonMultiplier = 1.0;
        this.seasonStartTime = null; // Will be set on first updateSeason() call
    this.gardenSize = 8;
    this.expansionCost = 1500;
        
        // Initialize statistics
        this.stats = {
            totalPlantsHarvested: 0,
            totalMoneyEarned: 0,
            totalWaterUsed: 0,
            totalFertilizerUsed: 0,
            plantsByType: {},
            bestHarvest: 0,
            longestPlaySession: 0,
            totalRebirths: 0,
            sessionStartTime: runStart,
            adminPanelUsed: false,
            adminPanelUsageCount: 0
        };
        
        // Initialize challenges
        this.challenges = {
            daily: [],
            weekly: null,
            completed: []
        };
    this.lastChallengeUpdate = runStart;
        
        // Initialize visual feedback
        this.particles = [];
        this.animations = [];
        
        // Reset achievements with correct structure
        this.achievements = {
            firstHarvest: { unlocked: false, name: 'First Harvest', description: 'Harvest your first crop' },
            moneyMaker: { unlocked: false, name: 'Money Maker', description: 'Earn $100 total' },
            plantMaster: { unlocked: false, name: 'Plant Master', description: 'Plant 10 different crops' },
            waterWizard: { unlocked: false, name: 'Water Wizard', description: 'Water 20 plants' },
            fertilizerFanatic: { unlocked: false, name: 'Fertilizer Fanatic', description: 'Use fertilizer 15 times' },
            speedGrower: { unlocked: false, name: 'Speed Grower', description: 'Grow a crop in under 30 seconds' },
            rareCollector: { unlocked: false, name: 'Rare Collector', description: 'Harvest 5 rare crops' },
            legendaryFarmer: { unlocked: false, name: 'Legendary Farmer', description: 'Harvest 3 legendary crops' }
        };
        
        this.achievementStats = {
            totalHarvests: 0,
            totalMoney: 0,
            plantsPlanted: 0,
            plantsWatered: 0,
            plantsFertilized: 0,
            rareHarvests: 0,
            legendaryHarvests: 0,
            differentPlantsPlanted: new Set(),
            speedGrowerUnlocked: false
        };
        
        // Save the fresh game immediately
        this.saveGame();
        console.log(`Fresh game initialized and saved for slot ${this.saveSlot}`);
        
        // Generate challenges for the new game
        this.generateChallenges();
        
        // Update UI
        if (this.canvas) {
            this.updateUI();
            this.updateShopDisplay();
            this.updateToolDisplay();
            this.updateSprinklerDisplay();
            this.updateAchievementsDisplay();
            this.updateChallengesDisplay();
            this.updateSeasonDisplay();
        }
    }
    
    loadGame(slot) {
        console.log(`Loading game for slot ${slot}`);
        
        // Validate slot number
        if (slot < 1 || slot > 3) {
            console.error(`Invalid slot number: ${slot}`);
            return;
        }
        
        // CRITICAL: Stop background processing immediately to prevent interference
        this.stopBackgroundProcessing();
        
        // CRITICAL: Clear all background games to prevent any interference
        this.backgroundGames.clear();
        
        if (this.currentGame) {
            console.log(`Stopping current game instance for slot ${this.currentGame.saveSlot}`);
            // Properly stop the old game instance
            this.currentGame.isRunning = false;
            this.currentGame.stopGame();
            
            // Clear any admin change timestamps from the old slot to prevent interference
            if (this.currentGame.saveSlot) {
                localStorage.removeItem(`adminChange_${this.currentGame.saveSlot}`);
            }
            
            // CRITICAL: Force garbage collection by clearing all references
            this.currentGame.garden = null;
            this.currentGame.shopInventory = null;
            this.currentGame.sprinklerInventory = null;
            this.currentGame.sprinklers = null;
            this.currentGame.achievementStats = null;
            
            // Clear the old game instance completely
            this.currentGame = null;
        }
        
        // CRITICAL: Clear any existing event listeners to prevent duplicates
        const menuBtn = document.getElementById('menuBtn');
        const saveBtn = document.getElementById('saveBtn');
        
        // Remove existing event listeners by cloning and replacing elements
        if (menuBtn) {
            const newMenuBtn = menuBtn.cloneNode(true);
            menuBtn.parentNode.replaceChild(newMenuBtn, menuBtn);
        }
        if (saveBtn) {
            const newSaveBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        }
        
        // Hide menu and show game
        document.getElementById('mainMenu').style.display = 'none';
        document.getElementById('gameContainer').style.display = 'block';
        
        // CRITICAL: Clear any existing notifications from previous slots
        const existingMessages = document.querySelectorAll('[style*="position: fixed"][style*="top: 20px"][style*="right: 20px"]');
        existingMessages.forEach(msg => {
            if (msg.parentNode) {
                msg.parentNode.removeChild(msg);
            }
        });
        
        // CRITICAL: Clear any existing UI state to prevent bleeding
        this.clearUIState();
        
        // CRITICAL: Force a longer delay to ensure all cleanup is complete
        setTimeout(() => {
            // Create new game instance with the correct slot
            console.log(`About to create GardenGame with slot: ${slot}`);
            this.currentGame = new GardenGame(slot, { gardenName: initialName });
            console.log(`Created new GardenGame instance for slot ${slot} with name "${this.currentGame.gardenName}"`);
            
            // Verify the game was created with the correct slot
            if (this.currentGame.saveSlot !== slot) {
                console.error(`Game created with wrong slot! Expected: ${slot}, Got: ${this.currentGame.saveSlot}`);
                console.error(`This could cause the slot loading issue you're experiencing`);
                // Force the correct slot and reload
                this.currentGame.saveSlot = slot;
                this.currentGame.loadGame(); // Reload with correct slot
                console.log(`Forced saveSlot to ${slot} and reloaded`);
            }
            
            console.log(`Current game slot is now: ${this.currentGame.saveSlot}`);
            console.log(`Current game instance ID: ${this.currentGame.instanceId}`);
            
            // Add event listeners to the new elements
            const newMenuBtn = document.getElementById('menuBtn');
            const newSaveBtn = document.getElementById('saveBtn');
            
            if (newMenuBtn) {
                newMenuBtn.addEventListener('click', () => {
                    this.returnToMenu();
                });
            }
            
            if (newSaveBtn) {
                newSaveBtn.addEventListener('click', () => {
                    this.currentGame.saveGame();
                    this.currentGame.showMessage('Game saved manually!', 'success');
                    this.updateSaveSlots();
                });
            }
            
            // Force update the save slots display to reflect the current state
            this.updateSaveSlots();
            
            // CRITICAL: Keep background processing disabled to prevent state bleeding
            console.log(`Background processing remains disabled to prevent cross-slot interference`);
        }, 200); // Increased delay to ensure cleanup is complete
    }
    
    // Sound System
    initializeSound() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.log('Audio not supported');
        }
    }
    
    playSound(type) {
        if (!this.soundEnabled || !this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        const sounds = {
            plant: { frequency: 440, duration: 0.1 },
            harvest: { frequency: 880, duration: 0.2 },
            water: { frequency: 330, duration: 0.15 },
            fertilizer: { frequency: 550, duration: 0.15 },
            money: { frequency: 660, duration: 0.1 },
            error: { frequency: 220, duration: 0.3 },
            achievement: { frequency: 1100, duration: 0.5 }
        };
        
        const sound = sounds[type];
        if (sound) {
            oscillator.frequency.setValueAtTime(sound.frequency, this.audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + sound.duration);
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + sound.duration);
        }
    }
    
    // Tool Upgrade System
    getToolUpgradeCostForNext(toolType) {
        const level = (this.toolLevels && this.toolLevels[toolType]) || 1;
        const cfg = (this.toolUpgradeConfig && this.toolUpgradeConfig[toolType]) || { base: 100, growth: 2 };
        const cost = Math.floor(cfg.base * Math.pow(cfg.growth, Math.max(0, level - 1)));
        return Math.max(1, cost);
    }

    recomputeToolUpgradeCost(toolType) {
        if (!this.toolUpgradeCosts) this.toolUpgradeCosts = {};
        this.toolUpgradeCosts[toolType] = this.getToolUpgradeCostForNext(toolType);
    }

    recomputeAllToolUpgradeCosts() {
        const tools = ['water', 'fertilizer', 'harvest', 'shovel'];
        tools.forEach(t => this.recomputeToolUpgradeCost(t));
        return this.toolUpgradeCosts;
    }

    upgradeTool(toolType) {
        const currentLevel = this.toolLevels[toolType];
        
        if (currentLevel >= 5) {
            this.showMessage(`${toolType} tool is already at maximum level!`, 'error');
            return;
        }
        
        const upgradeCost = this.getToolUpgradeCostForNext(toolType);
        
        // Check if player has enough money
        if (this.money < upgradeCost) {
            this.showMessage(`Not enough money! Need $${upgradeCost}`, 'error');
            return;
        }
        
        // Deduct money and upgrade tool
        this.money -= upgradeCost;
        this.toolLevels[toolType]++;

        // Compute cost for the next level from the unified model
        this.recomputeToolUpgradeCost(toolType);
        
        // Add resource bonuses for water and fertilizer tools
        if (toolType === 'water') {
            this.water += 10;
        } else if (toolType === 'fertilizer') {
            this.fertilizer += 5;
        } else if (toolType === 'harvest') {
            // Increase harvest bonus by 10% per level
            this.harvestBonus += 0.1;
        }

        const newLevel = this.toolLevels[toolType];
        let upgradeMessage = `${toolType} tool upgraded to level ${newLevel}!`;
        if (toolType === 'shovel') {
            const refundPercent = Math.round(this.getShovelRefundRate() * 100);
            upgradeMessage += ` Salvage refunds now ${refundPercent}%.`;
        }

        this.showMessage(upgradeMessage, 'success');
        this.playSound('achievement');
        
        // Add upgrade particle effect (show in center of screen)
        const x = this.canvas.width / 2;
        const y = this.canvas.height / 2;
        this.addParticle(x, y, 'upgrade', toolType);
        
        this.updateToolDisplay();
        this.updateUI();
        this.updateBonusesPopup();
        this.saveGame();
    }

    getShovelRefundRate() {
        const shovelLevel = (this.toolLevels && this.toolLevels.shovel) || 1;
        const ratePerLevel = 0.1;
        const calculatedRate = shovelLevel * ratePerLevel;
        return Math.min(calculatedRate, 0.5);
    }

    calculateShovelRefund(cost) {
        if (!cost) {
            return 0;
        }
        const refundRate = this.getShovelRefundRate();
        if (refundRate <= 0) {
            return 0;
        }
        return Math.max(1, Math.round(cost * refundRate));
    }

    grantShovelRefund(cost, row, col) {
        const refundAmount = this.calculateShovelRefund(cost);
        if (refundAmount <= 0) {
            return 0;
        }
        this.money += refundAmount;
        const x = (col * this.cellSize) + (this.cellSize / 2);
        const y = (row * this.cellSize) + (this.cellSize / 2);
        this.addParticle(x, y, 'money', refundAmount);
        this.playSound('money');
        return refundAmount;
    }
    
    updateToolDisplay() {
        // Update tool level displays
        Object.keys(this.toolLevels).forEach(tool => {
            const levelElement = document.querySelector(`#${tool}-btn .tool-level`);
            if (levelElement) {
                levelElement.textContent = `Lv.${this.toolLevels[tool]}`;
            }
        });
        
        // Update upgrade button costs and states
        Object.keys(this.toolUpgradeCosts).forEach(tool => {
            const upgradeBtn = document.getElementById(`upgrade-${tool}-btn`);
            if (upgradeBtn) {
                const costElement = upgradeBtn.querySelector('.upgrade-cost');
                if (costElement) {
                    if (this.toolLevels[tool] >= 5) {
                        costElement.textContent = 'MAX';
                        upgradeBtn.disabled = true;
                    } else {
                        costElement.textContent = `$${this.toolUpgradeCosts[tool]}`;
                        upgradeBtn.disabled = false;
                    }
                }
            }
        });
    }
    
    // Sprinkler System
    buySprinkler(sprinklerType) {
        const sprinklerData = this.sprinklerTypes[sprinklerType];
        
        console.log(`[${new Date().toLocaleTimeString()}] Attempting to buy ${sprinklerType} sprinkler. Current money: $${this.money}, Cost: $${sprinklerData.price}`);
        console.log(`[${new Date().toLocaleTimeString()}] Current sprinkler inventory:`, this.sprinklerInventory);
        
        // Validate sprinkler type exists
        if (!sprinklerData) {
            console.error(`Invalid sprinkler type: ${sprinklerType}`);
            this.showMessage('Invalid sprinkler type!', 'error');
            return;
        }
        
        // Validate money is sufficient
        if (this.money < sprinklerData.price) {
            console.log(`[${new Date().toLocaleTimeString()}] Not enough money to buy ${sprinklerType} sprinkler. Have: $${this.money}, Need: $${sprinklerData.price}`);
            this.showMessage('Not enough money!', 'error');
            return;
        }
        
        // Validate money is not negative
        if (this.money < 0) {
            console.error(`[${new Date().toLocaleTimeString()}] Money is negative: $${this.money}, setting to 0`);
            this.money = 0;
            this.showMessage('Money error detected and fixed!', 'error');
            return;
        }
        
        // Store the old values for comparison
        const oldMoney = this.money;
        const oldInventory = { ...this.sprinklerInventory };
        
        // Perform the purchase
        this.money -= sprinklerData.price;
        this.sprinklerInventory[sprinklerType]++;
        
        console.log(`[${new Date().toLocaleTimeString()}] Successfully bought ${sprinklerType} sprinkler. Money: $${oldMoney} -> $${this.money}, Inventory: ${oldInventory[sprinklerType]} -> ${this.sprinklerInventory[sprinklerType]}`);
        
        // Update UI immediately
        this.showMessage(`Bought ${sprinklerType} sprinkler!`, 'success');
        this.playSound('money');
        this.updateSprinklerDisplay();
        this.updateUI();
        
        // Force immediate save with protection
        this.saveGameWithProtection();
        
        // Verify the save was successful
        setTimeout(() => {
            const savedData = localStorage.getItem(`gardenGameSave_${this.saveSlot}`);
            if (savedData) {
                try {
                    const parsed = JSON.parse(savedData);
                    if (parsed.money !== this.money || parsed.sprinklerInventory[sprinklerType] !== this.sprinklerInventory[sprinklerType]) {
                        console.error(`[${new Date().toLocaleTimeString()}] Save verification failed! Expected money: $${this.money}, saved: $${parsed.money}`);
                        console.error(`[${new Date().toLocaleTimeString()}] Expected ${sprinklerType} inventory: ${this.sprinklerInventory[sprinklerType]}, saved: ${parsed.sprinklerInventory[sprinklerType]}`);
                        // Force a re-save
                        this.saveGameWithProtection();
                    } else {
                        console.log(`[${new Date().toLocaleTimeString()}] Save verification successful for ${sprinklerType} purchase`);
                    }
                } catch (error) {
                    console.error(`[${new Date().toLocaleTimeString()}] Error verifying save:`, error);
                }
            }
        }, 100);
    }
    
    buyWater() {
        const waterCost = this.getWaterPurchasePrice();
        if (this.money >= waterCost) {
            this.money -= waterCost;
            this.water += 1;
            this.updateUI();
            this.showMessage(`💧 Water purchased for $${waterCost}! You can now water your plants.`, 'success');
            this.playSound('success');
            this.saveGame();
        } else {
            this.showMessage(`Not enough money to buy water! Cost: $${waterCost}`, 'error');
            this.playSound('error');
        }
    }
    
    buyFertilizer() {
        const fertilizerCost = this.getFertilizerPurchasePrice();
        if (this.money >= fertilizerCost) {
            this.money -= fertilizerCost;
            this.fertilizer += 1;
            this.updateUI();
            this.showMessage(`🌱 Fertilizer purchased for $${fertilizerCost}! You can now fertilize your plants.`, 'success');
            this.playSound('success');
            this.saveGame();
        } else {
            this.showMessage(`Not enough money to buy fertilizer! Cost: $${fertilizerCost}`, 'error');
            this.playSound('error');
        }
    }
    
    placeSprinkler(row, col) {
        console.log(`[${new Date().toLocaleTimeString()}] Attempting to place sprinkler at (${row}, ${col})`);
        console.log(`[${new Date().toLocaleTimeString()}] Selected sprinkler: ${this.selectedSprinkler}`);
        console.log(`[${new Date().toLocaleTimeString()}] Current sprinkler inventory:`, this.sprinklerInventory);
        
        // Validate selected sprinkler
        if (!this.selectedSprinkler) {
            console.error(`[${new Date().toLocaleTimeString()}] No sprinkler selected`);
            this.showMessage('No sprinkler selected!', 'error');
            return;
        }
        
        // Validate sprinkler type exists
        if (!this.sprinklerTypes[this.selectedSprinkler]) {
            console.error(`[${new Date().toLocaleTimeString()}] Invalid sprinkler type: ${this.selectedSprinkler}`);
            this.showMessage('Invalid sprinkler type!', 'error');
            return;
        }
        
        // Validate inventory
        if (!this.sprinklerInventory[this.selectedSprinkler] || this.sprinklerInventory[this.selectedSprinkler] <= 0) {
            console.error(`[${new Date().toLocaleTimeString()}] No ${this.selectedSprinkler} sprinklers available. Inventory: ${this.sprinklerInventory[this.selectedSprinkler]}`);
            this.showMessage('No sprinklers available!', 'error');
            return;
        }
        
        // Validate coordinates
        if (row < 0 || row >= this.gridSize || col < 0 || col >= this.gridSize) {
            console.error(`[${new Date().toLocaleTimeString()}] Invalid coordinates: (${row}, ${col})`);
            this.showMessage('Invalid placement location!', 'error');
            return;
        }
        
        // Check if there's already a plant at this location
        const cell = this.garden[row][col];
        if (cell.plant) {
            console.log(`[${new Date().toLocaleTimeString()}] Cannot place sprinkler on plant at (${row}, ${col})`);
            this.showMessage('Cannot place sprinkler on a plant!', 'error');
            return;
        }
        
        // Check if there's already a sprinkler at this location
        const existingSprinkler = this.sprinklers.find(s => s.row === row && s.col === col);
        if (existingSprinkler) {
            console.log(`[${new Date().toLocaleTimeString()}] Cannot place sprinkler on existing sprinkler at (${row}, ${col})`);
            this.showMessage('Cannot place sprinkler on another sprinkler!', 'error');
            return;
        }
        
        // Store old values for comparison
        const oldInventory = this.sprinklerInventory[this.selectedSprinkler];
        const oldSprinklerCount = this.sprinklers.length;
        
        console.log(`[${new Date().toLocaleTimeString()}] Placing ${this.selectedSprinkler} sprinkler at (${row}, ${col}). Inventory before: ${oldInventory}`);
        
        // Place the sprinkler
        const sprinklerData = this.sprinklerTypes[this.selectedSprinkler];
        const now = Date.now();
        const newSprinkler = {
            type: this.selectedSprinkler,
            row: row,
            col: col,
            placedAt: now,
            expiresAt: now + sprinklerData.duration
        };
        
        this.sprinklers.push(newSprinkler);
        this.sprinklerInventory[this.selectedSprinkler]--;
        
        console.log(`[${new Date().toLocaleTimeString()}] Successfully placed sprinkler. Inventory after: ${this.sprinklerInventory[this.selectedSprinkler]}, Total sprinklers: ${this.sprinklers.length}`);
        
        // Update UI
        this.showMessage(`${this.selectedSprinkler} sprinkler placed!`, 'success');
        this.playSound('plant');
        
        // Add sprinkler particle effect
        const x = (col * this.cellSize) + (this.cellSize / 2);
        const y = (row * this.cellSize) + (this.cellSize / 2);
        this.addParticle(x, y, 'sprinkler', '');
    // Gentle soft burst
    this.spawnGentleBurst(x, y, 'sprinkler', 12);
        
        this.updateSprinklerDisplay();
        
        // Force immediate save with protection
        this.saveGameWithProtection();
        
        // Verify the save was successful
        setTimeout(() => {
            const savedData = localStorage.getItem(`gardenGameSave_${this.saveSlot}`);
            if (savedData) {
                try {
                    const parsed = JSON.parse(savedData);
                    if (parsed.sprinklerInventory[this.selectedSprinkler] !== this.sprinklerInventory[this.selectedSprinkler] || 
                        parsed.sprinklers.length !== this.sprinklers.length) {
                        console.error(`[${new Date().toLocaleTimeString()}] Save verification failed for sprinkler placement!`);
                        console.error(`Expected ${this.selectedSprinkler} inventory: ${this.sprinklerInventory[this.selectedSprinkler]}, saved: ${parsed.sprinklerInventory[this.selectedSprinkler]}`);
                        console.error(`Expected sprinkler count: ${this.sprinklers.length}, saved: ${parsed.sprinklers.length}`);
                        // Force a re-save
                        this.saveGameWithProtection();
                    } else {
                        console.log(`[${new Date().toLocaleTimeString()}] Save verification successful for sprinkler placement`);
                    }
                } catch (error) {
                    console.error(`[${new Date().toLocaleTimeString()}] Error verifying save:`, error);
                }
            }
        }, 100);
    }
    
    removeSprinkler(row, col) {
        const sprinklerIndex = this.sprinklers.findIndex(s => s.row === row && s.col === col);
        if (sprinklerIndex !== -1) {
            const sprinkler = this.sprinklers[sprinklerIndex];
            this.sprinklerInventory[sprinkler.type]++;
            this.sprinklers.splice(sprinklerIndex, 1);
            this.showMessage(`${sprinkler.type} sprinkler removed!`, 'info');
            // Gentle soft burst for remove
            const x = (col * this.cellSize) + (this.cellSize / 2);
            const y = (row * this.cellSize) + (this.cellSize / 2);
            this.spawnGentleBurst(x, y, 'remove', 10);
            this.updateSprinklerDisplay();
            this.saveGame();
        }
    }
    
    placeDecoration(row, col) {
        console.log(`Attempting to place decoration at (${row}, ${col})`);
        console.log(`Selected decoration: ${this.selectedDecoration}`);
        
        // Validate selected decoration
        if (!this.selectedDecoration) {
            console.error('No decoration selected');
            this.showMessage('No decoration selected!', 'error');
            return;
        }
        
        // Validate decoration type exists
        if (!this.decorations[this.selectedDecoration]) {
            console.error(`Invalid decoration type: ${this.selectedDecoration}`);
            this.showMessage('Invalid decoration type!', 'error');
            return;
        }
        
        // Validate coordinates
        if (row < 0 || row >= this.gridSize || col < 0 || col >= this.gridSize) {
            console.error(`Invalid coordinates: (${row}, ${col})`);
            this.showMessage('Invalid placement location!', 'error');
            return;
        }
        
        // Check if there's already something at this location
        const cell = this.garden[row][col];
        if (cell.plant || cell.sprinkler || cell.decoration) {
            console.log(`Cannot place decoration at (${row}, ${col}) - space occupied`);
            this.showMessage('Cannot place decoration here - space occupied!', 'error');
            return;
        }
        
        // Check if player has enough money
        const decorationData = this.decorations[this.selectedDecoration];
        if (this.money < decorationData.cost) {
            console.log(`Not enough money for ${this.selectedDecoration}. Need: ${decorationData.cost}, Have: ${this.money}`);
            this.showMessage(`Not enough money! Need $${decorationData.cost}`, 'error');
            return;
        }
        
        // Check seasonal restrictions
        if (decorationData.season && decorationData.season !== this.currentSeason && decorationData.season !== 'all') {
            console.log(`Cannot place ${this.selectedDecoration} in ${this.currentSeason} season`);
            this.showMessage(`This decoration is only available in ${decorationData.season}!`, 'error');
            return;
        }
        
        console.log(`Placing ${this.selectedDecoration} at (${row}, ${col})`);
        
        // Place the decoration
        this.garden[row][col].decoration = {
            type: this.selectedDecoration,
            placedAt: Date.now(),
            active: true
        };
        
        // Deduct money
        this.money -= decorationData.cost;
        
        // Apply decoration bonuses to nearby plants
        this.applyDecorationBonuses(row, col);
        
        // Update UI
        this.showMessage(`${decorationData.name} placed!`, 'success');
        this.playSound('plant');
        
        // Add decoration particle effect
        const x = (col * this.cellSize) + (this.cellSize / 2);
        const y = (row * this.cellSize) + (this.cellSize / 2);
        this.addParticle(x, y, 'decoration', decorationData.icon);
    // Gentle soft burst
    this.spawnGentleBurst(x, y, 'decoration', 12);
        
        this.updateUI();
        this.updateActiveBonusesDisplay();
        this.updateBonusesPopup();
        this.saveGame();
    }
    
    removeDecoration(row, col) {
        const cell = this.garden[row][col];
        if (cell.decoration) {
            const placedDecoration = cell.decoration;
            const decorationData = this.decorations[placedDecoration.type];

            // Remove decoration bonuses before clearing cell state
            this.removeDecorationBonuses(row, col, placedDecoration);

            const refundAmount = this.grantShovelRefund(decorationData.cost, row, col);
            const refundRatePercent = Math.round(this.getShovelRefundRate() * 100);
            const refundText = refundAmount > 0 ? ` Returned ${refundRatePercent}% ($${refundAmount}).` : '';

            this.garden[row][col].decoration = null;

            this.showMessage(`${decorationData.name} removed!${refundText}`, refundAmount > 0 ? 'success' : 'info');
            // Gentle soft burst for remove
            const x = (col * this.cellSize) + (this.cellSize / 2);
            const y = (row * this.cellSize) + (this.cellSize / 2);
            this.spawnGentleBurst(x, y, 'remove', 10);
            this.updateActiveBonusesDisplay();
            this.updateBonusesPopup();
            this.updateUI();
            this.saveGame();
        }
    }
    
    applyDecorationBonuses(row, col) {
        const decoration = this.garden[row][col].decoration;
        if (!decoration) return;
        
        const decorationData = this.decorations[decoration.type];
        if (!decorationData || decorationData.bonus === 'none') return;
        
        const range = decorationData.range ?? 1;

        if (decorationData.scope === 'global') {
            for (let y = 0; y < this.gridSize; y++) {
                for (let x = 0; x < this.gridSize; x++) {
                    if (this.garden[y][x].plant) {
                        this.applyPlantBonus(y, x, decorationData.bonus);
                    }
                }
            }
            return;
        }

        // Apply to local area around the decoration
        for (let y = Math.max(0, row - range); y <= Math.min(this.gridSize - 1, row + range); y++) {
            for (let x = Math.max(0, col - range); x <= Math.min(this.gridSize - 1, col + range); x++) {
                if (this.garden[y][x].plant) {
                    this.applyPlantBonus(y, x, decorationData.bonus);
                }
            }
        }
    }
    
    removeDecorationBonuses(row, col, decorationOverride = null) {
        const decoration = decorationOverride || this.garden[row][col].decoration;
        if (!decoration) return;
        
        const decorationData = this.decorations[decoration.type];
        if (!decorationData || decorationData.bonus === 'none') return;
        
        const range = decorationData.range ?? 1;

        if (decorationData.scope === 'global') {
            for (let y = 0; y < this.gridSize; y++) {
                for (let x = 0; x < this.gridSize; x++) {
                    if (this.garden[y][x].plant) {
                        this.removePlantBonus(y, x, decorationData.bonus);
                    }
                }
            }
            return;
        }

        for (let y = Math.max(0, row - range); y <= Math.min(this.gridSize - 1, row + range); y++) {
            for (let x = Math.max(0, col - range); x <= Math.min(this.gridSize - 1, col + range); x++) {
                if (this.garden[y][x].plant) {
                    this.removePlantBonus(y, x, decorationData.bonus);
                }
            }
        }
    }
    
    applyPlantBonus(row, col, bonus) {
        const plant = this.garden[row][col].plant;
        if (!plant) return;
        
        // Initialize plant bonuses if they don't exist
        if (!plant.bonuses) {
            plant.bonuses = {};
        }
        
        // Apply the specific bonus
        if (bonus.includes('plant protection')) {
            const protectionAmount = parseInt(bonus.match(/(\d+)%/)[1]);
            plant.bonuses.protection = (plant.bonuses.protection || 0) + protectionAmount;
            console.log(`Applied ${protectionAmount}% plant protection to plant at (${row}, ${col})`);
        } else if (bonus.includes('growth')) {
            const growthAmount = parseInt(bonus.match(/(\d+)%/)[1]);
            plant.bonuses.growth = (plant.bonuses.growth || 0) + growthAmount;
            console.log(`Applied ${growthAmount}% growth bonus to plant at (${row}, ${col})`);
        } else if (bonus.includes('harvest value')) {
            const harvestAmount = parseInt(bonus.match(/(\d+)%/)[1]);
            plant.bonuses.harvestValue = (plant.bonuses.harvestValue || 0) + harvestAmount;
            console.log(`Applied ${harvestAmount}% harvest value bonus to plant at (${row}, ${col})`);
        } else if (bonus.includes('water efficiency')) {
            const waterAmount = parseInt(bonus.match(/(\d+)%/)[1]);
            plant.bonuses.waterEfficiency = (plant.bonuses.waterEfficiency || 0) + waterAmount;
            console.log(`Applied ${waterAmount}% water efficiency bonus to plant at (${row}, ${col})`);
        }
    }
    
    removePlantBonus(row, col, bonus) {
        const plant = this.garden[row][col].plant;
        if (!plant || !plant.bonuses) return;
        
        // Remove the specific bonus
        if (bonus.includes('plant protection')) {
            const protectionAmount = parseInt(bonus.match(/(\d+)%/)[1]);
            plant.bonuses.protection = Math.max(0, (plant.bonuses.protection || 0) - protectionAmount);
            console.log(`Removed ${protectionAmount}% plant protection from plant at (${row}, ${col})`);
        } else if (bonus.includes('growth')) {
            const growthAmount = parseInt(bonus.match(/(\d+)%/)[1]);
            plant.bonuses.growth = Math.max(0, (plant.bonuses.growth || 0) - growthAmount);
            console.log(`Removed ${growthAmount}% growth bonus from plant at (${row}, ${col})`);
        } else if (bonus.includes('harvest value')) {
            const harvestAmount = parseInt(bonus.match(/(\d+)%/)[1]);
            plant.bonuses.harvestValue = Math.max(0, (plant.bonuses.harvestValue || 0) - harvestAmount);
            console.log(`Removed ${harvestAmount}% harvest value bonus from plant at (${row}, ${col})`);
        } else if (bonus.includes('water efficiency')) {
            const waterAmount = parseInt(bonus.match(/(\d+)%/)[1]);
            plant.bonuses.waterEfficiency = Math.max(0, (plant.bonuses.waterEfficiency || 0) - waterAmount);
            console.log(`Removed ${waterAmount}% water efficiency bonus from plant at (${row}, ${col})`);
        }
    }
    
    // Storm damage system
    checkStormDamage() {
        if (this.weather !== 'stormy') return;
        
        // Only check for storm damage every 30 seconds during stormy weather
        const now = Date.now();
        if (!this.lastStormDamageCheck) {
            this.lastStormDamageCheck = now;
        }
        
        if (now - this.lastStormDamageCheck < 30000) return; // 30 seconds
        this.lastStormDamageCheck = now;
        
        console.log(`Storm damage check triggered at ${new Date().toLocaleTimeString()}`);
        
        let damagedPlants = 0;
        let protectedPlants = 0;
        
        // Check all plants in the garden
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const cell = this.garden[row][col];
                if (cell.plant) {
                    const protection = cell.plant.bonuses?.protection || 0;
                    
                    // 15% chance of storm damage per plant (reduced by protection)
                    const damageChance = Math.max(0, 15 - protection);
                    const random = Math.random() * 100;
                    
                    if (random < damageChance) {
                        // Plant gets damaged
                        console.log(`Storm damage check: Plant at (${row}, ${col}) hit! Random: ${random.toFixed(1)}, Damage chance: ${damageChance}%`);
                        this.damagePlant(row, col);
                        damagedPlants++;
                    } else if (protection > 0 && random >= 15) {
                        // Only count as protected if they would have been damaged without protection
                        // (random >= 15 means they would have been damaged without protection)
                        protectedPlants++;
                    }
                }
            }
        }
        
        // Show feedback to player
        if (damagedPlants > 0 || protectedPlants > 0) {
            let message = '';
            if (damagedPlants > 0) {
                message += `⛈️ Storm damaged ${damagedPlants} unprotected plants!`;
                this.addParticle('damage', this.canvas.width / 2, this.canvas.height / 2);
            }
            if (protectedPlants > 0) {
                if (message) message += ' ';
                message += `🛡️ ${protectedPlants} plants were protected by fences!`;
            }
            this.showMessage(message, damagedPlants > 0 ? 'warning' : 'info');
        }
    }
    
    damagePlant(row, col) {
        const plant = this.garden[row][col].plant;
        if (!plant) return;
        
        // Reduce plant growth stage by 1 (but not below seed stage)
        const currentStage = plant.growthStage || 0;
        if (currentStage > 0) {
            plant.growthStage = currentStage - 1;
            plant.recentlyDamaged = true; // Mark as recently damaged
            
            // Update isFullyGrown status
            const maxStage = this.growthStages.length - 1;
            plant.isFullyGrown = (plant.growthStage >= maxStage);
            
            console.log(`Plant at (${row}, ${col}) was damaged by storm, regressed to stage ${plant.growthStage}, isFullyGrown: ${plant.isFullyGrown}`);
            
            // Add visual feedback
            this.addParticle('damage', 
                col * this.cellSize + this.cellSize / 2, 
                row * this.cellSize + this.cellSize / 2
            );
            
            // Force a redraw to show the stage change immediately
            this.draw();
        }
    }
    
    updateSprinklerDisplay() {
        // Update sprinkler shop counts
        Object.keys(this.sprinklerInventory).forEach(type => {
            const countElement = document.getElementById(`sprinkler-${type}-count`);
            if (countElement) {
                countElement.textContent = this.sprinklerInventory[type];
            }
            
            const toolCountElement = document.getElementById(`sprinkler-${type}-tool-count`);
            if (toolCountElement) {
                toolCountElement.textContent = this.sprinklerInventory[type];
            }
        });
    }
    
    updateAchievementsDisplay() {
        const achievementsList = document.getElementById('achievements-list');
        if (!achievementsList) return;
        
        achievementsList.innerHTML = '';
        
        const achievementIcons = {
            firstHarvest: '🌾',
            moneyMaker: '💰',
            plantMaster: '🌱',
            waterWizard: '💧',
            fertilizerFanatic: '🌿',
            speedGrower: '⚡',
            rareCollector: '⭐',
            legendaryFarmer: '🌟'
        };
        
        const achievementRequirements = {
            firstHarvest: 'Harvest your first crop',
            moneyMaker: 'Earn $100 total',
            plantMaster: 'Plant 10 different crops',
            waterWizard: 'Water 20 plants',
            fertilizerFanatic: 'Use fertilizer 15 times',
            speedGrower: 'Grow a crop in under 30 seconds',
            rareCollector: 'Harvest 5 rare crops',
            legendaryFarmer: 'Harvest 3 legendary crops'
        };
        
        Object.keys(this.achievements).forEach(achievementId => {
            const achievement = this.achievements[achievementId];
            const icon = achievementIcons[achievementId] || '🏆';
            const requirement = achievementRequirements[achievementId] || achievement.description;
            
            const achievementElement = document.createElement('div');
            achievementElement.className = `achievement-item ${achievement.unlocked ? 'unlocked' : 'locked'}`;
            
            achievementElement.innerHTML = `
                <div class="achievement-icon">${icon}</div>
                <div class="achievement-info">
                    <div class="achievement-name">${achievement.name}</div>
                    <div class="achievement-description">${requirement}</div>
                </div>
                <div class="achievement-status">${achievement.unlocked ? 'UNLOCKED' : 'LOCKED'}</div>
            `;
            
            achievementsList.appendChild(achievementElement);
        });
    }

    // ===== ACTIVE BONUSES DISPLAY =====
    computeGlobalBonusesSummary() {
        const totals = { growth: 0, harvest: 0, water: 0, protection: 0 };
        const items = {};
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const deco = this.garden?.[r]?.[c]?.decoration;
                if (!deco) continue;
                const data = this.decorations?.[deco.type];
                if (!data || data.bonus === 'none') continue;
                if (data.scope !== 'global') continue;

                // Track items count by type
                if (!items[deco.type]) {
                    items[deco.type] = { name: data.name || deco.type, icon: data.icon || '🌸', count: 0, bonus: data.bonus };
                }
                items[deco.type].count += 1;

                // Parse percent from bonus string
                const match = String(data.bonus).match(/(\d+)%/);
                const pct = match ? parseInt(match[1], 10) : 0;
                if (/harvest value/i.test(data.bonus)) totals.harvest += pct;
                else if (/water efficiency/i.test(data.bonus)) totals.water += pct;
                else if (/protection/i.test(data.bonus)) totals.protection += pct;
                else if (/growth/i.test(data.bonus)) totals.growth += pct;
            }
        }
        return { totals, items };
    }

    updateActiveBonusesDisplay() {
        const list = document.getElementById('activeBonusesList');
        if (!list) return;
        const { totals, items } = this.computeGlobalBonusesSummary();
        const entries = [];

        const makeLine = (label, value, icon) => (
            value > 0 ? `<li><span class="bonus-icon">${icon}</span> ${label}: <strong>+${value}%</strong></li>` : ''
        );

        entries.push(
            makeLine('Growth', totals.growth, '🌱'),
            makeLine('Harvest', totals.harvest, '💰'),
            makeLine('Water efficiency', totals.water, '💧'),
            makeLine('Protection', totals.protection, '🛡️')
        );

        // List active global decorations with counts
        const itemKeys = Object.keys(items);
        if (itemKeys.length) {
            entries.push('<li class="bonus-divider" aria-hidden="true"></li>');
            itemKeys.forEach(key => {
                const it = items[key];
                entries.push(`<li><span class="bonus-icon">${it.icon}</span> ${it.name} × ${it.count}</li>`);
            });
        } else {
            if (!entries.some(Boolean)) {
                entries.push('<li>No global bonuses yet</li>');
            }
        }

        list.innerHTML = entries.filter(Boolean).join('');
    }
    
    // Weather System
    updateWeather() {
        const oldWeather = this.weather;
        this.updateWeatherSilent();
        
        // Show weather change message if weather actually changed
        if (oldWeather !== this.weather) {
            const weatherName = this.weatherEffects[this.weather].name;
            this.showMessage(`🌤️ Weather changed to ${weatherName}!`, 'info');
            
            // Special warning for stormy weather
            if (this.weather === 'stormy') {
                this.showMessage(`⛈️ Stormy weather can damage unprotected plants!`, 'warning');
            }
        }
    }
    
    updateWeatherSilent() {
        const now = Date.now();
        if (now - this.lastWeatherChange >= this.weatherChangeInterval) {
            const weatherTypes = Object.keys(this.weatherEffects);
            const currentIndex = weatherTypes.indexOf(this.weather);
            const nextIndex = (currentIndex + 1) % weatherTypes.length;
            this.weather = weatherTypes[nextIndex];
            this.lastWeatherChange = now;
            
            // Don't show weather change message in silent mode
            // this.showMessage(`Weather changed to ${this.weatherEffects[this.weather].name}!`, 'info');
            // this.updateUI();
        }
    }
    
    // Auto-save System
    checkAutoSave() {
        this.checkAutoSaveSilent();
    }
    
    checkAutoSaveSilent() {
        const now = Date.now();
        if (now - this.lastAutoSave >= this.autoSaveInterval) {
            this.saveGame();
            this.lastAutoSave = now;
        }
    }
    
    // Achievement System
    checkAchievements() {
        this.checkAchievementsSilent();
    }
    
    checkAchievementsSilent() {
        // First Harvest
        if (this.achievementStats.totalHarvests >= 1) {
            this.unlockAchievement('firstHarvest');
        }
        
        // Money Maker
        if (this.achievementStats.totalMoney >= 100) {
            this.unlockAchievement('moneyMaker');
        }
        
        // Water Wizard
        if (this.achievementStats.plantsWatered >= 20) {
            this.unlockAchievement('waterWizard');
        }
        
        // Plant Master
        if (this.achievementStats.differentPlantsPlanted.size >= 10) {
            this.unlockAchievement('plantMaster');
        }
        
        // Fertilizer Fanatic
        if (this.achievementStats.plantsFertilized >= 15) {
            this.unlockAchievement('fertilizerFanatic');
        }
        
        // Rare Collector
        if (this.achievementStats.rareHarvests >= 5) {
            this.unlockAchievement('rareCollector');
        }
        
        // Legendary Farmer
        if (this.achievementStats.legendaryHarvests >= 3) {
            this.unlockAchievement('legendaryFarmer');
        }
        
        // Speed Grower achievement is handled when a plant becomes fully grown within time limit
    }
    
    unlockAchievement(achievementId) {
        // Guard against invalid ids
        if (!this.achievements || !this.achievements[achievementId]) return;
        // If already unlocked, do nothing
        if (this.achievements[achievementId].unlocked) return;
        
        this.unlockAchievementSilent(achievementId);
        this.showMessage(`Achievement Unlocked: ${this.achievements[achievementId].name}!`, 'success');
        this.playSound('achievement');
        this.updateAchievementsDisplay();
        this.updateUI();
        // Persist immediately so unlock survives reloads
        this.saveGame();
    }
    
    unlockAchievementSilent(achievementId) {
        this.achievements[achievementId].unlocked = true;
    }
    
    // Admin Panel
    initializeAdminPanel() {
        window.admin = {
            setRestockTime: (minutes) => {
                this.restockInterval = minutes * 60000;
                this.lastRestockTime = Date.now();
                console.log(`Restock time set to ${minutes} minutes`);
            },
            restockNow: () => {
                this.restockShop();
                this.lastRestockTime = Date.now();
                console.log('Shop restocked manually');
            },
            setStock: (seedType, amount) => {
                if (this.shopInventory[seedType]) {
                    this.shopInventory[seedType].stock = amount;
                    this.updateShopDisplay();
                    console.log(`${seedType} stock set to ${amount}`);
                } else {
                    console.log('Available seeds:', Object.keys(this.shopInventory));
                }
            },
            addMoney: (amount) => {
                this.money += amount;
                this.updateUI();
                console.log(`Added $${amount}`);
            },
            addWater: (amount) => {
                this.water += amount;
                this.updateUI();
                console.log(`Added ${amount} water`);
            },
            setMoney: (amount) => {
                this.money = amount;
                this.updateUI();
                console.log(`Money set to $${amount}`);
            },
            setWater: (amount) => {
                this.water = amount;
                this.updateUI();
                console.log(`Water set to ${amount}`);
            },
            setRareChance: (chance) => {
                this.rareRestockChance = chance;
                console.log(`✅ Rare restock chance set to ${chance}`);
            },
            setLegendaryChance: (chance) => {
                this.legendaryRestockChance = chance;
                console.log(`✅ Legendary restock chance set to ${chance}`);
            },
            setSeedRarity: (seedType, rarity) => {
                if (this.plantTypes[seedType]) {
                    // Remove existing rarity flags
                    delete this.plantTypes[seedType].isRare;
                    delete this.plantTypes[seedType].isLegendary;
                    
                    // Set new rarity
                    if (rarity === 'rare' || rarity === "rare") {
                        this.plantTypes[seedType].isRare = true;
                        console.log(`✅ ${seedType} set to RARE`);
                    } else if (rarity === 'legendary' || rarity === "legendary") {
                        this.plantTypes[seedType].isLegendary = true;
                        console.log(`✅ ${seedType} set to LEGENDARY`);
                    } else if (rarity === 'common' || rarity === "common") {
                        console.log(`✅ ${seedType} set to COMMON`);
                    } else {
                        console.log(`❌ Invalid rarity: "${rarity}". Use 'common', 'rare', or 'legendary'`);
                        console.log(`❌ Example: admin.setSeedRarity("tomato", "rare")`);
                        return;
                    }
                    
                    // Update UI to reflect the new rarity
                    this.updateShopDisplay();
                    console.log(`🔄 UI updated to show new rarity for ${seedType}`);
                } else {
                    console.log(`❌ Seed type '${seedType}' not found. Use admin.listSeeds() to see available seeds.`);
                }
            },
            getSeedRarity: (seedType) => {
                if (this.plantTypes[seedType]) {
                    const plant = this.plantTypes[seedType];
                    if (plant.isLegendary) {
                        console.log(`🌟 ${seedType} is LEGENDARY`);
                    } else if (plant.isRare) {
                        console.log(`⭐ ${seedType} is RARE`);
                    } else {
                        console.log(`🌱 ${seedType} is COMMON`);
                    }
                } else {
                    console.log(`❌ Seed type '${seedType}' not found.`);
                }
            },
            getStatus: () => {
                console.log('Game Status:', {
                    money: this.money,
                    water: this.water,
                    fertilizer: this.fertilizer,
                    score: this.score,
                    weather: this.weather,
                    toolLevels: this.toolLevels
                });
            },
            help: () => {
                console.log('🌱 GARDEN GAME ADMIN COMMANDS 🌱');
                console.log('=====================================');
                console.log('');
                console.log('💰 MONEY & RESOURCES:');
                console.log('  admin.addMoney(amount) - Add money');
                console.log('  admin.setMoney(amount) - Set money');
                console.log('  admin.addWater(amount) - Add water');
                console.log('  admin.setWater(amount) - Set water');
                console.log('  admin.addFertilizer(amount) - Add fertilizer');
                console.log('  admin.setFertilizer(amount) - Set fertilizer');

                console.log('');
                console.log('🌿 SHOP & SEEDS:');
                console.log('  admin.setStock(seedType, amount) - Set seed stock');
                console.log('  admin.restockNow() - Restock shop immediately');
                console.log('  admin.setRestockTime(minutes) - Set restock interval');
                console.log('  admin.restockAll() - Restock all seeds to max');
                console.log('  admin.listSeeds() - List all available seeds');
                console.log('');
                console.log('🎯 RARITY SETTINGS:');
                console.log('  admin.setRareChance(chance) - Set rare restock chance (0-1)');
                console.log('  admin.setLegendaryChance(chance) - Set legendary restock chance (0-1)');
                console.log('  admin.setSeedRarity(seedType, rarity) - Set seed rarity (common/rare/legendary)');
                console.log('  admin.getSeedRarity(seedType) - Check seed rarity');
                console.log('');
                console.log('🔧 TOOLS & UPGRADES:');
                console.log('  admin.upgradeTool(toolType) - Upgrade a tool (water/fertilizer/shovel/harvest)');
                console.log('');
                console.log('🌤️ WEATHER & ENVIRONMENT:');
                console.log('  admin.setWeather(weatherType) - Set weather (sunny/rainy/cloudy/stormy)');
                console.log('  admin.setWeatherTime(minutes) - Set weather change interval');
                console.log('');
                console.log('💧 SPRINKLER SYSTEM:');
                console.log('  admin.addSprinkler(type, amount) - Add sprinklers (basic/advanced/premium/legendary)');
                console.log('  admin.setSprinkler(type, amount) - Set sprinkler count');
                console.log('  admin.clearSprinklers() - Remove all sprinklers');
                console.log('  admin.listSprinklers() - List sprinkler types');
                console.log('');
                console.log('🏡 GARDEN MANAGEMENT:');
                console.log('  admin.clearGarden() - Clear all plants');
                console.log('');
                console.log('🎵 SOUND & SAVE:');
                console.log('  admin.toggleSound() - Toggle sound on/off');
                console.log('  admin.save() - Save game manually');
                console.log('');
                console.log('🏆 ACHIEVEMENTS:');
                console.log('  admin.showAchievements() - Show achievements');
                console.log('  admin.unlockAchievement(achievementId) - Unlock specific achievement');
                console.log('');
                console.log('🐢 PASSIVE GROWTH:');
                console.log('  admin.togglePassiveGrowth() - Enable/disable passive growth');
                console.log('  admin.setPassiveGrowth(minutes) - Set passive growth base minutes per stage');
                console.log('');
                console.log('📊 INFORMATION:');
                console.log('  admin.getStatus() - Show game status');
                console.log('  admin.help() - Show this help menu');
                console.log('');
                console.log('💡 EXAMPLES:');
                console.log('  admin.addMoney(1000) - Add $1000');

                console.log('  admin.setStock("carrot", 10) - Set carrot stock to 10');
                console.log('  admin.addSprinkler("basic", 5) - Add 5 basic sprinklers');
                console.log('  admin.setWeather("stormy") - Set weather to stormy');
                console.log('  admin.setWeatherTime(10) - Set weather to change every 10 minutes');
                console.log('  admin.upgradeTool("water") - Upgrade water tool');
                console.log('  admin.setSeedRarity("tomato", "rare") - Make tomato rare');
                console.log('  admin.setRareChance(0.25) - Set rare restock to 25%');
                console.log('  admin.getSeedRarity("pumpkin") - Check pumpkin rarity');
                console.log('  admin.unlockAchievement("speedGrower") - Unlock Speed Grower achievement');
                console.log('');
                console.log('=====================================');
            },
            togglePassiveGrowth: () => {
                this.passiveGrowthEnabled = !this.passiveGrowthEnabled;
                console.log(`✅ Passive growth ${this.passiveGrowthEnabled ? 'ENABLED' : 'DISABLED'}`);
            },
            setPassiveGrowth: (minutes) => {
                const m = Number(minutes);
                if (!Number.isFinite(m) || m <= 0) {
                    console.log('❌ setPassiveGrowth(minutes): minutes must be > 0');
                    return;
                }
                this.passiveGrowthBaseMs = Math.round(m * 60 * 1000);
                console.log(`✅ Passive growth base set to ${m} minute(s) per stage`);
            },
            restockAll: () => {
                Object.keys(this.shopInventory).forEach(seedType => {
                    this.shopInventory[seedType].stock = this.shopInventory[seedType].maxStock;
                });
                this.updateShopDisplay();
                console.log('✅ All seeds restocked to maximum');
            },
            clearGarden: () => {
                for (let row = 0; row < this.gridSize; row++) {
                    for (let col = 0; col < this.gridSize; col++) {
                        this.garden[row][col] = {
                            plant: null,
                            watered: false,
                            wateredAt: null,
                            waterCooldown: 0,
                            fertilized: false,
                            fertilizedAt: null,
                            fertilizerCooldown: 0,
                            plantedAt: null
                        };
                    }
                }
                // Clear all sprinklers
                this.sprinklers = [];
                console.log('✅ Garden cleared (plants and sprinklers removed)');
            },
            listSeeds: () => {
                console.log('🌱 Available seeds:');
                Object.keys(this.shopInventory).forEach(seedType => {
                    const inventory = this.shopInventory[seedType];
                    const plantData = this.plantTypes[seedType];
                    let rarity = '';
                    if (plantData.isLegendary) rarity = ' [LEGENDARY]';
                    else if (plantData.isRare) rarity = ' [RARE]';
                    console.log(`  ${seedType}${rarity}: ${inventory.stock}/${inventory.maxStock} stock - $${plantData.price}`);
                });
            },
            addFertilizer: (amount) => {
                this.fertilizer += amount;
                this.updateUI();
                console.log(`✅ Added ${amount} fertilizer`);
            },
            setFertilizer: (amount) => {
                this.fertilizer = amount;
                this.updateUI();
                console.log(`✅ Fertilizer set to ${amount}`);
            },

            setRareChance: (chance) => {
                this.rareRestockChance = chance;
                console.log(`✅ Rare restock chance set to ${chance}`);
            },
            setLegendaryChance: (chance) => {
                this.legendaryRestockChance = chance;
                console.log(`✅ Legendary restock chance set to ${chance}`);
            },
            upgradeTool: (toolType) => {
                if (this.toolLevels[toolType] < 5) {
                    this.toolLevels[toolType]++;
                    this.toolUpgradeCosts[toolType] = Math.floor(this.toolUpgradeCosts[toolType] * 1.5);
                    console.log(`✅ ${toolType} tool upgraded to level ${this.toolLevels[toolType]}`);
                    this.updateToolDisplay();
                } else {
                    console.log(`❌ ${toolType} tool is already at maximum level`);
                }
            },
            toggleSound: () => {
                this.soundEnabled = !this.soundEnabled;
                console.log(`🔊 Sound ${this.soundEnabled ? 'enabled' : 'disabled'}`);
            },
            save: () => {
                this.saveGame();
                console.log('💾 Game saved manually');
            },
            showAchievements: () => {
                console.log('🏆 Achievements:');
                Object.keys(this.achievements).forEach(id => {
                    const achievement = this.achievements[id];
                    const status = achievement.unlocked ? '✅ UNLOCKED' : '🔒 LOCKED';
                    console.log(`  ${achievement.name}: ${status} - ${achievement.description}`);
                });
            },
            unlockAchievement: (achievementId) => {
                if (this.achievements[achievementId]) {
                    if (!this.achievements[achievementId].unlocked) {
                        this.unlockAchievement(achievementId);
                        console.log(`✅ Achievement "${this.achievements[achievementId].name}" unlocked!`);
                    } else {
                        console.log(`ℹ️ Achievement "${this.achievements[achievementId].name}" is already unlocked`);
                    }
                } else {
                    console.log('❌ Available achievements:');
                    Object.keys(this.achievements).forEach(id => {
                        console.log(`  ${id}: ${this.achievements[id].name}`);
                    });
                }
            },
            setWeather: (weatherType) => {
                if (this.weatherEffects[weatherType]) {
                    this.weather = weatherType;
                    console.log(`🌤️ Weather set to ${weatherType}`);
                    this.updateUI();
                    console.log(`🔄 UI updated to show ${weatherType} weather`);
                } else {
                    console.log('❌ Available weather types:', Object.keys(this.weatherEffects));
                }
            },
            setWeatherTime: (minutes) => {
                this.weatherChangeInterval = minutes * 60000;
                this.lastWeatherChange = Date.now();
                console.log(`🌤️ Weather change interval set to ${minutes} minutes`);
            },
            addSprinkler: (type, amount) => {
                if (this.sprinklerTypes[type]) {
                    this.sprinklerInventory[type] += amount;
                    this.updateSprinklerDisplay();
                    console.log(`✅ Added ${amount} ${type} sprinklers`);
                } else {
                    console.log('❌ Available sprinkler types:', Object.keys(this.sprinklerTypes));
                }
            },
            setSprinkler: (type, amount) => {
                if (this.sprinklerTypes[type]) {
                    this.sprinklerInventory[type] = amount;
                    this.updateSprinklerDisplay();
                    console.log(`✅ ${type} sprinklers set to ${amount}`);
                } else {
                    console.log('❌ Available sprinkler types:', Object.keys(this.sprinklerTypes));
                }
            },
            clearSprinklers: () => {
                this.sprinklers = [];
                console.log('✅ All sprinklers removed');
            },
            listSprinklers: () => {
                console.log('💧 Sprinkler types:');
                Object.keys(this.sprinklerTypes).forEach(type => {
                    const data = this.sprinklerTypes[type];
                    const durationMinutes = Math.floor(data.duration / 60000);
                    console.log(`  ${type}: $${data.price} - ${data.description} (${durationMinutes} min duration)`);
                });
            }
        };
    }
    
    loadGame() {
        console.log(`GardenGame.loadGame() called for slot ${this.saveSlot}`);
        
        const saveKey = `gardenGameSave_${this.saveSlot}`;
        const saveData = localStorage.getItem(saveKey);
        
        if (saveData) {
            try {
                const data = JSON.parse(saveData);
                
                // Validate that the save data belongs to this slot
                if (data.saveSlot !== this.saveSlot) {
                    console.error(`Save data mismatch! Expected slot ${this.saveSlot}, but data contains slot ${data.saveSlot}`);
                    console.log(`Clearing corrupted save data and starting fresh`);
                    localStorage.removeItem(saveKey);
                    this.initializeFreshGame();
                    return;
                }
                
                // Load game state with deep copying to prevent shared references
                this.money = Math.max(0, data.money || 100);
                this.water = Math.max(0, data.water || 50);
                this.fertilizer = Math.max(0, data.fertilizer || 20);
                this.score = Math.max(0, data.score || 0);
                
                // Deep copy garden data to prevent cross-slot interference
                if (data.garden) {
                    this.garden = JSON.parse(JSON.stringify(data.garden));
                }
                
                // Deep copy shop inventory to prevent cross-slot interference
                if (data.shopInventory) {
                    this.shopInventory = JSON.parse(JSON.stringify(data.shopInventory));
                    // Validate shop inventory data
                    Object.keys(this.shopInventory).forEach(seedType => {
                        if (this.shopInventory[seedType].stock < 0) {
                            this.shopInventory[seedType].stock = 0;
                        }
                    });
                }
                
                this.lastRestockTime = data.lastRestockTime || Date.now();
                if (data.restockInterval) this.restockInterval = data.restockInterval;
                
                // Load tool data
                if (data.toolLevels) this.toolLevels = data.toolLevels;
                // Ignore legacy saved upgrade costs; recompute from new model for balance
                this.recomputeAllToolUpgradeCosts();
                if (data.harvestBonus !== undefined) this.harvestBonus = data.harvestBonus;
                
                // Load weather data
                if (data.weather) this.weather = data.weather;
                
                // Load achievements
                if (data.achievements) this.achievements = data.achievements;
                if (data.achievementStats) {
                    this.achievementStats = data.achievementStats;
                    if (Array.isArray(this.achievementStats.differentPlantsPlanted)) {
                        this.achievementStats.differentPlantsPlanted = new Set(this.achievementStats.differentPlantsPlanted);
                    } else if (!this.achievementStats.differentPlantsPlanted) {
                        this.achievementStats.differentPlantsPlanted = new Set();
                    }
                }
                
                // Deep copy sprinkler inventory to prevent cross-slot interference
                if (data.sprinklerInventory) {
                    this.sprinklerInventory = JSON.parse(JSON.stringify(data.sprinklerInventory));
                    // Validate sprinkler inventory data
                    Object.keys(this.sprinklerInventory).forEach(type => {
                        if (this.sprinklerInventory[type] < 0) {
                            this.sprinklerInventory[type] = 0;
                        }
                    });
                }
                
                // Deep copy sprinklers to prevent cross-slot interference
                if (data.sprinklers) {
                    this.sprinklers = JSON.parse(JSON.stringify(data.sprinklers));
                    // Handle both old and new sprinkler formats
                    this.sprinklers = this.sprinklers.map(sprinkler => {
                        if (sprinkler.expiresAt) {
                            return sprinkler; // Already has timer data
                        } else {
                            // Convert old format to new format with timer
                            const sprinklerData = this.sprinklerTypes[sprinkler.type];
                            const now = Date.now();
                            return {
                                ...sprinkler,
                                placedAt: now,
                                expiresAt: now + sprinklerData.duration
                            };
                        }
                    });
                }
                
                if (data.soundEnabled !== undefined) this.soundEnabled = data.soundEnabled;
                const savedRebirths = Number(data.rebirths);
                this.rebirths = Number.isFinite(savedRebirths) && savedRebirths >= 0 ? savedRebirths : 0;

                const savedTokens = Number(data.rebirthPoints);
                this.rebirthPoints = Number.isFinite(savedTokens) && savedTokens >= 0 ? savedTokens : 0;

                const savedBestScore = Number(data.bestRebirthScore);
                this.bestRebirthScore = Number.isFinite(savedBestScore) && savedBestScore >= 0 ? savedBestScore : 0;

                const savedRunStart = Number(data.currentRunStartTime);
                this.currentRunStartTime = Number.isFinite(savedRunStart) && savedRunStart > 0 ? savedRunStart : Date.now();
                this.rebirthNotificationShown = false;
                this.prestigeUpgrades = this.normalizePrestigeUpgrades(data.prestigeUpgrades);
                

                
                // Load new features
                if (data.currentSeason) this.currentSeason = data.currentSeason;
                if (data.seasonDay) this.seasonDay = data.seasonDay;
                if (data.seasonMultiplier) this.seasonMultiplier = data.seasonMultiplier;
                if (data.seasonStartTime) this.seasonStartTime = data.seasonStartTime;
                if (data.gardenSize) {
                    this.gardenSize = data.gardenSize;
                    this.gridSize = this.gardenSize;
                    this.cellSize = Math.floor(600 / this.gridSize);
                }
                if (data.expansionCost) this.expansionCost = data.expansionCost;
                if (data.stats) this.stats = data.stats;
                if (this.stats && this.stats.totalRebirths === undefined) {
                    this.stats.totalRebirths = this.rebirths;
                }
                if (this.stats && (!this.stats.sessionStartTime || Number.isNaN(this.stats.sessionStartTime))) {
                    this.stats.sessionStartTime = this.currentRunStartTime;
                }
                if (data.challenges) this.challenges = data.challenges;
                if (data.lastChallengeUpdate) this.lastChallengeUpdate = data.lastChallengeUpdate;

                // Load Quick Seeds preferences
                if (Array.isArray(data.seedRecent)) this.seedRecent = data.seedRecent; else this.seedRecent = this.seedRecent || [];

                
                this.setGardenName(data.gardenName, { shouldSave: false });
                console.log(`Successfully loaded game for slot ${this.saveSlot}`);
                
                // Generate challenges if they don't exist
                this.generateChallenges();
                
                // Ensure upgrade costs reflect new balance
                this.recomputeAllToolUpgradeCosts();

                // Update UI if canvas is available
                if (this.canvas) {
                    this.updateUI();
                    this.updateToolDisplay();
                    this.updateSprinklerDisplay();
                    this.updateAchievementsDisplay();
                    this.updateChallengesDisplay();
                    this.updateSeasonDisplay();
                    try { this.updateQuickSeedsBar(); } catch (_) {}
                }
                
            } catch (error) {
                console.error(`Error loading game for slot ${this.saveSlot}:`, error);
                console.log(`Clearing corrupted save data and starting fresh`);
                localStorage.removeItem(saveKey);
                this.initializeFreshGame();
            }
        } else {
            console.log(`No save data found for slot ${this.saveSlot}, starting fresh game`);
            this.initializeFreshGame();
        }
    }
    
    // Get garden data for multiplayer sharing
    getGardenData() {
        return {
            money: this.money,
            water: this.water,
            fertilizer: this.fertilizer,
            score: this.score,
            weather: this.weather,
            currentSeason: this.currentSeason,
            seasonDay: this.seasonDay,
            garden: this.garden,
            stats: this.stats,
            rebirths: this.rebirths,
            gardenName: this.gardenName,
            saveSlot: this.saveSlot
        };
    }
    
    // Logout method to clear multiplayer state when switching accounts
    logout() {
        // Clear multiplayer state to prevent account mixing
        if (this.multiplayer) {
            this.multiplayer.resetState();
        }
        
        // Clear any local game state
        this.saveGame();
        
        console.log('🌱 GardenGame logout - multiplayer state cleared');
    }
    

}

// Menu System
class MenuSystem {
    constructor() {
        this.currentGame = null;
        this.backgroundGames = new Map(); // Store background game instances
        this.backgroundInterval = null;
        this.pendingNewSlot = null;
        this.overwriteModal = document.getElementById('overwriteConfirmModal');
        this.overwriteSlotLabel = document.getElementById('overwriteSlotLabel');
        this.overwriteSlotDetail = document.getElementById('overwriteSlotDetail');
        this.overwriteConfirmBtn = document.getElementById('overwriteConfirmBtn');
        this.overwriteCancelBtn = document.getElementById('overwriteCancelBtn');
        this.handleOverwriteKeydown = null;
    this.overwriteTriggerButton = null;
        this.initializeOverwriteModal();
        this.initializeMenu();
        // Background processing completely disabled to prevent state bleeding
        console.log('Background processing disabled by default to prevent cross-slot interference');
    }
    
    initializeMenu() {
        this.updateSaveSlots();
        this.addMenuEventListeners();
    }

    initializeOverwriteModal() {
        if (!this.overwriteModal) {
            return;
        }

        this.overwriteTriggerButton = null;
        this.hideOverwriteModal({ immediate: true, shouldRestoreFocus: false });

        if (this.overwriteConfirmBtn) {
            this.overwriteConfirmBtn.addEventListener('click', () => {
                const targetSlot = this.pendingNewSlot;
                this.hideOverwriteModal({ shouldRestoreFocus: false });
                if (typeof targetSlot === 'number') {
                    console.log(`Confirmed new game overwrite for slot ${targetSlot}`);
                    this.startNewGame(targetSlot);
                }
            });
        }

        if (this.overwriteCancelBtn) {
            this.overwriteCancelBtn.addEventListener('click', () => {
                this.hideOverwriteModal();
            });
        }

        this.overwriteModal.addEventListener('click', (event) => {
            if (event.target === this.overwriteModal) {
                this.hideOverwriteModal();
            }
        });

        this.overwriteModal.addEventListener('keydown', (event) => {
            if (event.key !== 'Tab' || !this.isOverwriteModalVisible()) {
                return;
            }

            const focusable = Array.from(this.overwriteModal.querySelectorAll('button'));
            if (focusable.length === 0) {
                event.preventDefault();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;

            if (event.shiftKey) {
                if (active === first || !this.overwriteModal.contains(active)) {
                    event.preventDefault();
                    last.focus();
                }
            } else if (active === last) {
                event.preventDefault();
                first.focus();
            }
        });

        if (this.handleOverwriteKeydown) {
            document.removeEventListener('keydown', this.handleOverwriteKeydown);
        }

        this.handleOverwriteKeydown = (event) => {
            if (event.key === 'Escape' && this.isOverwriteModalVisible()) {
                this.hideOverwriteModal();
            }
        };

        document.addEventListener('keydown', this.handleOverwriteKeydown);
    }

    isOverwriteModalVisible() {
        return !!(this.overwriteModal && this.overwriteModal.classList.contains('is-visible'));
    }

    showOverwriteModal(slot, triggerButton = null) {
        if (!this.overwriteModal) {
            this.startNewGame(slot);
            return;
        }

        const slotElement = document.querySelector(`[data-slot="${slot}"]`);
        const defaultLabel = `Garden Slot ${slot}`;
        const customName = slotElement?.dataset?.customName?.trim() || '';
        const storedName = slotElement?.dataset?.gardenName?.trim() || '';
        const displayName = customName || storedName || defaultLabel;

        if (this.overwriteSlotLabel) {
            this.overwriteSlotLabel.textContent = displayName;
        }

        if (this.overwriteSlotDetail) {
            const lastSavedRaw = slotElement?.querySelector('.slot-date')?.textContent?.trim() || '';
            const hasMeaningfulSave = lastSavedRaw && !lastSavedRaw.endsWith('—');
            if (hasMeaningfulSave) {
                this.overwriteSlotDetail.textContent = lastSavedRaw;
                this.overwriteSlotDetail.removeAttribute('hidden');
            } else {
                this.overwriteSlotDetail.textContent = '';
                this.overwriteSlotDetail.setAttribute('hidden', '');
            }
        }

        this.pendingNewSlot = slot;
        this.overwriteTriggerButton = triggerButton || null;
        this.overwriteModal.removeAttribute('hidden');
        this.overwriteModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        requestAnimationFrame(() => {
            if (!this.overwriteModal) {
                return;
            }
            this.overwriteModal.classList.add('is-visible');
            if (this.overwriteConfirmBtn) {
                this.overwriteConfirmBtn.focus();
            }
        });
    }

    hideOverwriteModal({ immediate = false, shouldRestoreFocus = true } = {}) {
        if (!this.overwriteModal) {
            this.pendingNewSlot = null;
            this.overwriteTriggerButton = null;
            return;
        }

        const restoreFocus = () => {
            if (shouldRestoreFocus && this.overwriteTriggerButton && typeof this.overwriteTriggerButton.focus === 'function') {
                this.overwriteTriggerButton.focus();
            }
            this.overwriteTriggerButton = null;
        };

        const finalize = () => {
            this.overwriteModal.classList.remove('is-visible');
            this.overwriteModal.setAttribute('hidden', '');
            this.overwriteModal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            this.pendingNewSlot = null;
            restoreFocus();
        };

        if (immediate) {
            finalize();
            return;
        }

        if (!this.isOverwriteModalVisible()) {
            finalize();
            return;
        }

        this.overwriteModal.classList.remove('is-visible');
        this.overwriteModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        this.pendingNewSlot = null;

        setTimeout(() => {
            if (this.overwriteModal && !this.overwriteModal.classList.contains('is-visible')) {
                this.overwriteModal.setAttribute('hidden', '');
                restoreFocus();
            }
        }, 220);
    }

    handleNewGameClick(slot, triggerButton) {
        console.log(`New game requested for slot ${slot}`);
        const slotElement = document.querySelector(`[data-slot="${slot}"]`);
        const hasSave = !!(slotElement && slotElement.classList.contains('has-save'));

        if (hasSave) {
            this.showOverwriteModal(slot, triggerButton);
            return;
        }

        this.startNewGame(slot);
    }
    
    getSlotCustomName(slot) {
        const key = `${SLOT_CUSTOM_NAME_KEY_PREFIX}${slot}`;
        const stored = localStorage.getItem(key);
        return sanitizeGardenName(stored, '');
    }

    setSlotCustomName(slot, name) {
        const key = `${SLOT_CUSTOM_NAME_KEY_PREFIX}${slot}`;
        const sanitized = sanitizeGardenName(name, '');

        if (sanitized) {
            localStorage.setItem(key, sanitized);
        } else {
            localStorage.removeItem(key);
        }

        return sanitized;
    }

    updateStoredGardenName(slot, customName) {
        const saveKey = `gardenGameSave_${slot}`;
        const serialized = localStorage.getItem(saveKey);
        if (!serialized) {
            return;
        }

        try {
            const data = JSON.parse(serialized);
            const resolved = customName && customName.length > 0
                ? customName
                : `Garden Slot ${slot}`;
            data.gardenName = resolved;
            localStorage.setItem(saveKey, JSON.stringify(data));
        } catch (error) {
            console.warn(`Unable to update stored garden name for slot ${slot}:`, error);
        }
    }

    enterSlotRenameMode(slotElement) {
        if (!slotElement) {
            return;
        }

        const slot = parseInt(slotElement.dataset.slot, 10);
        if (Number.isNaN(slot) || slot < 1 || slot > 3) {
            console.error(`Invalid slot number for inline rename: ${slot}`);
            return;
        }

        const nameWrapper = slotElement.querySelector('.slot-name');
        const nameInput = slotElement.querySelector('.slot-name-input');
        if (!nameWrapper || !nameInput) {
            console.error('Inline rename controls not found for slot', slot);
            return;
        }

        const defaultLabel = `Garden Slot ${slot}`;
        const existingCustom = slotElement.dataset.customName || '';
        const existingStored = slotElement.dataset.gardenName || '';
        const initialValue = existingCustom || existingStored || defaultLabel;

        nameInput.setAttribute('maxlength', MAX_GARDEN_NAME_LENGTH);
        nameInput.placeholder = defaultLabel;
        nameInput.value = initialValue;

        let renameFinalized = false;

        const cleanup = () => {
            nameWrapper.classList.remove('editing');
            slotElement.classList.remove('renaming');
            nameInput.removeEventListener('blur', handleBlur);
            nameInput.removeEventListener('keydown', handleKeydown);
        };

        const finalizeRename = (customValue) => {
            const appliedName = this.setSlotCustomName(slot, customValue);
            const hasActiveGame = this.currentGame && this.currentGame.saveSlot === slot;

            if (hasActiveGame) {
                this.currentGame.setGardenName(appliedName, { shouldSave: true, showFeedback: false });
            } else {
                this.updateStoredGardenName(slot, appliedName);
            }
        };

        const commit = () => {
            if (renameFinalized) {
                return;
            }
            renameFinalized = true;
            const sanitized = sanitizeGardenName(nameInput.value, '');
            const normalized = sanitized && sanitized !== defaultLabel ? sanitized : '';
            cleanup();
            finalizeRename(normalized);
            if (document.activeElement === nameInput) {
                nameInput.blur();
            }
            this.updateSaveSlots();
        };

        const cancel = () => {
            if (renameFinalized) {
                return;
            }
            renameFinalized = true;
            cleanup();
            if (document.activeElement === nameInput) {
                nameInput.blur();
            }
            this.updateSaveSlots();
        };

        const handleBlur = () => commit();
        const handleKeydown = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                commit();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                cancel();
            }
        };

        nameWrapper.classList.add('editing');
        slotElement.classList.add('renaming');

        nameInput.addEventListener('blur', handleBlur);
        nameInput.addEventListener('keydown', handleKeydown);

        requestAnimationFrame(() => {
            nameInput.focus();
            nameInput.select();
        });
    }

    updateSaveSlots() {
        for (let slot = 1; slot <= 3; slot++) {
            const saveKey = `gardenGameSave_${slot}`;
            const saveData = localStorage.getItem(saveKey);
            const slotElement = document.querySelector(`[data-slot="${slot}"]`);

            if (!slotElement) {
                continue;
            }

            const statusElement = slotElement.querySelector('.slot-status');
            const dateElement = slotElement.querySelector('.slot-date');
            const loadBtn = slotElement.querySelector('.load-btn');
            const nameWrapper = slotElement.querySelector('.slot-name');
            const slotNameDisplay = slotElement.querySelector('.slot-name-display');
            const slotNameInput = slotElement.querySelector('.slot-name-input');
            const headerElement = slotElement.querySelector('h3');

            if (headerElement) {
                headerElement.textContent = `Garden Slot ${slot}`;
            }

            const defaultLabel = `Garden Slot ${slot}`;
            const customName = this.getSlotCustomName(slot);

            slotElement.classList.remove('has-save');
            slotElement.classList.remove('has-name');
            slotElement.dataset.gardenName = '';
            slotElement.dataset.customName = customName || '';

            if (nameWrapper) {
                nameWrapper.classList.remove('editing');
            }
            slotElement.classList.remove('renaming');

            if (slotNameDisplay) {
                slotNameDisplay.textContent = '';
                slotNameDisplay.removeAttribute('title');
            }
            if (slotNameInput) {
                slotNameInput.value = '';
                slotNameInput.placeholder = defaultLabel;
                slotNameInput.setAttribute('maxlength', MAX_GARDEN_NAME_LENGTH);
            }
            if (statusElement) {
                statusElement.textContent = 'Empty';
            }
            if (dateElement) {
                dateElement.textContent = '';
            }
            if (loadBtn) {
                loadBtn.disabled = true;
            }

            let resolvedName = customName || '';
            let hasDisplayName = !!resolvedName;

            if (saveData) {
                try {
                    const data = JSON.parse(saveData);
                    const storedName = sanitizeGardenName(data.gardenName, '');

                    const moneyValue = Number.isFinite(data.money) ? data.money : 0;
                    const scoreValue = Number.isFinite(data.score) ? data.score : 0;
                    if (statusElement) {
                        statusElement.textContent = `Money: $${moneyValue} | Score: ${scoreValue}`;
                    }

                    let formattedDateText = '';
                    const candidates = [];

                    if (data.saveTime !== undefined) {
                        const numericSaveTime = typeof data.saveTime === 'number' ? data.saveTime : Number(data.saveTime);
                        candidates.push(numericSaveTime);
                    }

                    // Legacy saves may not include saveTime, so fall back to the lastSaveTime helper key.
                    const lastSaveTime = Number(localStorage.getItem(`lastSaveTime_${slot}`));
                    candidates.push(lastSaveTime);

                    for (const candidate of candidates) {
                        if (!Number.isFinite(candidate) || candidate <= 0) {
                            continue;
                        }

                        const candidateDate = new Date(candidate);
                        if (!Number.isNaN(candidateDate.getTime())) {
                            formattedDateText = `${candidateDate.toLocaleDateString()} ${candidateDate.toLocaleTimeString()}`;
                            break;
                        }
                    }

                    if (dateElement) {
                        dateElement.textContent = formattedDateText ? `Last saved: ${formattedDateText}` : 'Last saved: —';
                    }

                    if (loadBtn) {
                        loadBtn.disabled = false;
                    }

                    if (!hasDisplayName && storedName && storedName !== defaultLabel) {
                        resolvedName = storedName;
                        hasDisplayName = true;
                    }

                    slotElement.classList.add('has-save');
                } catch (error) {
                    if (statusElement) {
                        statusElement.textContent = 'Corrupted Save';
                    }
                    if (dateElement) {
                        dateElement.textContent = '';
                    }
                    if (loadBtn) {
                        loadBtn.disabled = true;
                    }
                    if (slotNameDisplay) {
                        slotNameDisplay.textContent = '';
                        slotNameDisplay.removeAttribute('title');
                    }
                    slotElement.dataset.gardenName = '';
                    slotElement.classList.remove('has-save');
                    slotElement.classList.remove('has-name');
                    continue;
                }
            }

            if (slotNameDisplay) {
                if (hasDisplayName) {
                    slotNameDisplay.textContent = resolvedName;
                    slotNameDisplay.setAttribute('title', resolvedName);
                } else {
                    slotNameDisplay.textContent = '';
                    slotNameDisplay.removeAttribute('title');
                }
            }

            if (slotNameInput) {
                slotNameInput.value = hasDisplayName ? resolvedName : '';
                slotNameInput.placeholder = defaultLabel;
                slotNameInput.setAttribute('maxlength', MAX_GARDEN_NAME_LENGTH);
            }

            slotElement.dataset.gardenName = hasDisplayName ? resolvedName : '';
            slotElement.dataset.customName = customName || '';
            slotElement.classList.toggle('has-name', hasDisplayName);
        }
    }
    
    addMenuEventListeners() {
        console.log('Adding menu event listeners...');
        
        const newButtons = document.querySelectorAll('.new-btn');
        console.log(`Found ${newButtons.length} new buttons`);
        
        newButtons.forEach((btn, index) => {
            console.log(`Adding click listener to new button ${index + 1}`);
            btn.addEventListener('click', (e) => {
                console.log('New button clicked!');
                const saveSlot = e.currentTarget.closest('.save-slot');
                if (!saveSlot) {
                    console.error('Could not find save-slot parent element');
                    return;
                }
                const slot = parseInt(saveSlot.dataset.slot);
                if (isNaN(slot) || slot < 1 || slot > 3) {
                    console.error(`Invalid slot number: ${slot}`);
                    return;
                }
                this.handleNewGameClick(slot, e.currentTarget);
            });
        });
        
        const loadButtons = document.querySelectorAll('.load-btn');
        console.log(`Found ${loadButtons.length} load buttons`);
        
        loadButtons.forEach((btn, index) => {
            console.log(`Adding click listener to load button ${index + 1}`);
            btn.addEventListener('click', (e) => {
                console.log('Load button clicked!');
                const saveSlot = e.currentTarget.closest('.save-slot');
                if (!saveSlot) {
                    console.error('Could not find save-slot parent element');
                    return;
                }
                const slot = parseInt(saveSlot.dataset.slot);
                if (isNaN(slot) || slot < 1 || slot > 3) {
                    console.error(`Invalid slot number: ${slot}`);
                    return;
                }
                console.log(`Loading game for slot ${slot}`);
                this.loadGame(slot);
            });
        });

        const renameButtons = document.querySelectorAll('.slot-rename-btn');
        console.log(`Found ${renameButtons.length} rename buttons`);

        renameButtons.forEach((btn, index) => {
            console.log(`Adding click listener to rename button ${index + 1}`);
            btn.addEventListener('click', (e) => {
                const saveSlot = e.currentTarget.closest('.save-slot');
                if (!saveSlot) {
                    console.error('Could not find save-slot parent element for rename');
                    return;
                }

                const slot = parseInt(saveSlot.dataset.slot, 10);
                if (Number.isNaN(slot) || slot < 1 || slot > 3) {
                    console.error(`Invalid slot number for rename: ${slot}`);
                    return;
                }
                this.enterSlotRenameMode(saveSlot);
            });
        });
        
        console.log('Menu event listeners added successfully');
    }
    
    loadGame(slot) {
        console.log(`Loading game for slot ${slot}`);
        
        // Validate slot number
        if (slot < 1 || slot > 3) {
            console.error(`Invalid slot number: ${slot}`);
            return;
        }
        
        // Check if there's save data for this slot
        const saveKey = `gardenGameSave_${slot}`;
        const saveData = localStorage.getItem(saveKey);
        
        if (!saveData) {
            console.error(`No save data found for slot ${slot}`);
            alert(`No save data found for slot ${slot}. Please start a new game first.`);
            return;
        }
        
        // CRITICAL: Stop background processing immediately to prevent interference
        this.stopBackgroundProcessing();
        
        // CRITICAL: Clear all background games to prevent any interference
        this.backgroundGames.clear();
        
        if (this.currentGame) {
            console.log(`Stopping current game instance for slot ${this.currentGame.saveSlot}`);
            // Properly stop the old game instance
            this.currentGame.isRunning = false;
            this.currentGame.stopGame();
            
            // Clear any admin change timestamps from the old slot to prevent interference
            if (this.currentGame.saveSlot) {
                localStorage.removeItem(`adminChange_${this.currentGame.saveSlot}`);
            }
            
            // CRITICAL: Force garbage collection by clearing all references
            this.currentGame.garden = null;
            this.currentGame.shopInventory = null;
            this.currentGame.sprinklerInventory = null;
            this.currentGame.sprinklers = null;
            this.currentGame.achievementStats = null;
            
            // Clear the old game instance completely
            this.currentGame = null;
        }
        
        // CRITICAL: Clear any existing event listeners to prevent duplicates
        const menuBtn = document.getElementById('menuBtn');
        const saveBtn = document.getElementById('saveBtn');
        
        // Remove existing event listeners by cloning and replacing elements
        if (menuBtn) {
            const newMenuBtn = menuBtn.cloneNode(true);
            menuBtn.parentNode.replaceChild(newMenuBtn, menuBtn);
        }
        if (saveBtn) {
            const newSaveBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        }
        
        // Hide menu and show game
        document.getElementById('mainMenu').style.display = 'none';
        document.getElementById('gameContainer').style.display = 'block';
        
        // CRITICAL: Clear any existing notifications from previous slots
        const existingMessages = document.querySelectorAll('[style*="position: fixed"][style*="top: 20px"][style*="right: 20px"]');
        existingMessages.forEach(msg => {
            if (msg.parentNode) {
                msg.parentNode.removeChild(msg);
            }
        });
        
        // CRITICAL: Clear any existing UI state to prevent bleeding
        this.clearUIState();
        
        // CRITICAL: Force a longer delay to ensure all cleanup is complete
        setTimeout(() => {
        // Create new game instance with the correct slot
        console.log(`About to create GardenGame with slot: ${slot}`);
        this.currentGame = new GardenGame(slot);
        console.log(`Created new GardenGame instance for slot ${slot}`);
        
        // Verify the game was created with the correct slot
        if (this.currentGame.saveSlot !== slot) {
            console.error(`Game created with wrong slot! Expected: ${slot}, Got: ${this.currentGame.saveSlot}`);
            console.error(`This could cause the slot loading issue you're experiencing`);
                // Force the correct slot and reload
            this.currentGame.saveSlot = slot;
                this.currentGame.loadGame(); // Reload with correct slot
                console.log(`Forced saveSlot to ${slot} and reloaded`);
        }
        
        console.log(`Current game slot is now: ${this.currentGame.saveSlot}`);
        console.log(`Current game instance ID: ${this.currentGame.instanceId}`);
        
        // Add event listeners to the new elements
        const newMenuBtn = document.getElementById('menuBtn');
        const newSaveBtn = document.getElementById('saveBtn');
        
        if (newMenuBtn) {
            newMenuBtn.addEventListener('click', () => {
                this.returnToMenu();
            });
        }
        
        if (newSaveBtn) {
            newSaveBtn.addEventListener('click', () => {
                this.currentGame.saveGame();
                this.currentGame.showMessage('Game saved manually!', 'success');
                this.updateSaveSlots();
            });
        }
        
        // Force update the save slots display to reflect the current state
        this.updateSaveSlots();
        
            // CRITICAL: Keep background processing disabled to prevent state bleeding
            console.log(`Background processing remains disabled to prevent cross-slot interference`);
        }, 200); // Increased delay to ensure cleanup is complete
    }
    
    startNewGame(slot) {
        console.log(`Starting new game for slot ${slot}`);
        
        // Validate slot number
        if (slot < 1 || slot > 3) {
            console.error(`Invalid slot number: ${slot}`);
            return;
        }
        
        const saveKey = `gardenGameSave_${slot}`;
        let previousName = '';
        const existingSaveData = localStorage.getItem(saveKey);
        if (existingSaveData) {
            try {
                const parsed = JSON.parse(existingSaveData);
                previousName = parsed && parsed.gardenName ? parsed.gardenName : '';
            } catch (error) {
                console.warn(`Unable to parse existing save name for slot ${slot}:`, error);
            }
        }

        if (!previousName) {
            previousName = this.getSlotCustomName(slot) || '';
        }

        const sanitizedPrevious = sanitizeGardenName(previousName, '');
        const defaultLabel = `Garden Slot ${slot}`;
        const initialCustomName = sanitizedPrevious && sanitizedPrevious !== defaultLabel
            ? sanitizedPrevious
            : '';
        const initialName = this.setSlotCustomName(slot, initialCustomName);

        // CRITICAL: Clear existing save data for this slot
        localStorage.removeItem(saveKey);
        console.log(`Cleared existing save data for slot ${slot} before starting new game`);
        const loggedName = initialName && initialName.length > 0 ? initialName : defaultLabel;
        console.log(`New garden name for slot ${slot}: ${loggedName}`);
        
        // CRITICAL: Stop background processing immediately to prevent interference
        this.stopBackgroundProcessing();
        
        // CRITICAL: Clear all background games to prevent any interference
        this.backgroundGames.clear();
        
            if (this.currentGame) {
            console.log(`Stopping current game instance for slot ${this.currentGame.saveSlot}`);
            // Properly stop the old game instance
            this.currentGame.isRunning = false;
            this.currentGame.stopGame();
            
            // Clear any admin change timestamps from the old slot to prevent interference
            if (this.currentGame.saveSlot) {
                localStorage.removeItem(`adminChange_${this.currentGame.saveSlot}`);
            }
            
            // CRITICAL: Force garbage collection by clearing all references
            this.currentGame.garden = null;
            this.currentGame.shopInventory = null;
            this.currentGame.sprinklerInventory = null;
            this.currentGame.sprinklers = null;
            this.currentGame.achievementStats = null;
            
            // Clear the old game instance completely
            this.currentGame = null;
        }
        
        // CRITICAL: Clear any existing event listeners to prevent duplicates
        const menuBtn = document.getElementById('menuBtn');
        const saveBtn = document.getElementById('saveBtn');
        
        // Remove existing event listeners by cloning and replacing elements
        if (menuBtn) {
            const newMenuBtn = menuBtn.cloneNode(true);
            menuBtn.parentNode.replaceChild(newMenuBtn, menuBtn);
        }
        if (saveBtn) {
            const newSaveBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        }
        
        // Hide menu and show game
        document.getElementById('mainMenu').style.display = 'none';
        document.getElementById('gameContainer').style.display = 'block';
        
        // CRITICAL: Clear any existing notifications from previous slots
        const existingMessages = document.querySelectorAll('[style*="position: fixed"][style*="top: 20px"][style*="right: 20px"]');
        existingMessages.forEach(msg => {
            if (msg.parentNode) {
                msg.parentNode.removeChild(msg);
            }
        });
        
        // CRITICAL: Clear any existing UI state to prevent bleeding
        this.clearUIState();
        
        // CRITICAL: Force a longer delay to ensure all cleanup is complete
        setTimeout(() => {
            // Create new game instance with the correct slot
            console.log(`About to create GardenGame with slot: ${slot}`);
            this.currentGame = new GardenGame(slot, { gardenName: initialName });
            const resolvedName = this.currentGame.gardenName || this.currentGame.defaultGardenName();
            console.log(`Created new GardenGame instance for slot ${slot} with name "${resolvedName}"`);
            
            // Verify the game was created with the correct slot
            if (this.currentGame.saveSlot !== slot) {
                console.error(`Game created with wrong slot! Expected: ${slot}, Got: ${this.currentGame.saveSlot}`);
                console.error(`This could cause the slot loading issue you're experiencing`);
                // Force the correct slot and reload
                this.currentGame.saveSlot = slot;
                this.currentGame.loadGame(); // Reload with correct slot
                console.log(`Forced saveSlot to ${slot} and reloaded`);
            }
            
            console.log(`Current game slot is now: ${this.currentGame.saveSlot}`);
            console.log(`Current game instance ID: ${this.currentGame.instanceId}`);
            
            // Add event listeners to the new elements
            const newMenuBtn = document.getElementById('menuBtn');
            const newSaveBtn = document.getElementById('saveBtn');
            
            if (newMenuBtn) {
                newMenuBtn.addEventListener('click', () => {
                    this.returnToMenu();
                });
            }
            
            if (newSaveBtn) {
                newSaveBtn.addEventListener('click', () => {
                    this.currentGame.saveGame();
                    this.currentGame.showMessage('Game saved manually!', 'success');
                    this.updateSaveSlots();
                });
            }
            
            // Force update the save slots display to reflect the current state
            this.updateSaveSlots();
            
            // CRITICAL: Keep background processing disabled to prevent state bleeding
            console.log(`Background processing remains disabled to prevent cross-slot interference`);
        }, 200); // Increased delay to ensure cleanup is complete
    }
    
    returnToMenu() {
        if (this.currentGame) {
            this.currentGame.stopGame();
        }
        document.getElementById('gameContainer').style.display = 'none';
        document.getElementById('mainMenu').style.display = 'flex';
        this.currentGame = null;
        window.game = null; // Clear global game reference
        this.updateSaveSlots();
    }
    
    showAccountSettings() {
        // Get current user info from localStorage
        const token = localStorage.getItem('garden_game_token');
        const username = localStorage.getItem('garden_game_username');
        
        // Add debugging
        console.log('showAccountSettings called');
        console.log('Token from localStorage:', token ? 'Present' : 'Missing');
        console.log('Username from localStorage:', username || 'Missing');
        
        if (!token || !username) {
            console.log('Authentication check failed - token or username missing');
            alert('You must be logged in to access account settings.');
            return;
        }
        
        // Additional check - verify token is valid by checking if it's not empty/null
        if (token === 'null' || token === 'undefined' || token.trim() === '') {
            console.log('Token is invalid (null/undefined/empty)');
            alert('You must be logged in to access account settings.');
            return;
        }
        
        console.log('Authentication check passed, showing account settings modal');
        
        // Create account settings modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 15px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        `;
        
        content.innerHTML = `
            <h2 style="margin-bottom: 20px; color: #2c3e50;">👤 Account Settings</h2>
            
            <!-- Account Information Section -->
            <div style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <h3 style="margin-bottom: 15px; color: #2c3e50;">📋 Account Information</h3>
                <div id="accountInfo" style="margin-bottom: 15px;">
                    <p><strong>Username:</strong> ${username}</p>
                    <p><strong>Account Status:</strong> <span style="color: #27ae60;">Active</span></p>
                    <p><strong>Member Since:</strong> <span id="memberSince">Loading...</span></p>
                    <p><strong>Last Login:</strong> <span id="lastLogin">Loading...</span></p>
                </div>
                <button id="refreshInfoBtn" style="background: #3498db; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 14px;">
                    🔄 Refresh Info
                </button>
            </div>
            
            <!-- Email Settings Section -->
            <div style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <h3 style="margin-bottom: 15px; color: #2c3e50;">📧 Email Settings</h3>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Current Email:</label>
                    <input type="email" id="emailInput" placeholder="Enter your email address" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 10px;">
                </div>
                <button id="updateEmailBtn" style="background: #27ae60; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">
                    💾 Update Email
                </button>
            </div>
            
            <!-- Password Change Section -->
            <div style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <h3 style="margin-bottom: 15px; color: #2c3e50;">🔐 Change Password</h3>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Current Password:</label>
                    <input type="password" id="currentPassword" placeholder="Enter current password" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 10px;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">New Password:</label>
                    <input type="password" id="newPassword" placeholder="Enter new password (min 6 characters)" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 10px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Confirm New Password:</label>
                    <input type="password" id="confirmPassword" placeholder="Confirm new password" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                </div>
                <button id="changePasswordBtn" style="background: #e74c3c; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">
                    🔒 Change Password
                </button>
            </div>
            

            
            <!-- Data Management Section -->
            <div style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <h3 style="margin-bottom: 15px; color: #2c3e50;">💾 Data Management</h3>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button id="exportDataBtn" style="background: #3498db; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">
                        📤 Export Game Data
                    </button>
                    <button id="importDataBtn" style="background: #e67e22; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">
                        📥 Import Game Data
                    </button>
                </div>
            </div>
            
            <!-- Account Actions Section -->
            <div style="margin-bottom: 25px; padding: 15px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                <h3 style="margin-bottom: 15px; color: #856404;">⚠️ Account Actions</h3>
                <button id="deleteAccountBtn" style="background: #e74c3c; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">
                    🗑️ Delete Account
                </button>
            </div>
            
            <div style="text-align: center;">
                <button id="closeAccountBtn" style="background: #95a5a6; color: white; border: none; padding: 12px 25px; border-radius: 8px; cursor: pointer; font-size: 16px;">
                    Close
                </button>
            </div>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // Load account information
        this.loadAccountInfo(token);
        
        // Add event listeners
        const closeBtn = content.querySelector('#closeAccountBtn');
        const refreshInfoBtn = content.querySelector('#refreshInfoBtn');
        const updateEmailBtn = content.querySelector('#updateEmailBtn');
        const changePasswordBtn = content.querySelector('#changePasswordBtn');
        const exportBtn = content.querySelector('#exportDataBtn');
        const importBtn = content.querySelector('#importDataBtn');
        const deleteAccountBtn = content.querySelector('#deleteAccountBtn');
        
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        refreshInfoBtn.addEventListener('click', () => {
            this.loadAccountInfo(token);
        });
        
        updateEmailBtn.addEventListener('click', () => {
            this.updateEmail(token, content);
        });
        
        changePasswordBtn.addEventListener('click', () => {
            this.changePassword(token, content);
        });
        
        exportBtn.addEventListener('click', () => {
            if (this.currentGame) {
                this.currentGame.exportSaveData();
            } else {
                alert('No active game to export.');
            }
        });
        
        importBtn.addEventListener('click', () => {
            if (this.currentGame) {
                this.currentGame.importSaveData();
            } else {
                alert('No active game to import data into.');
            }
        });
        
        deleteAccountBtn.addEventListener('click', () => {
            if (confirm('⚠️ WARNING: This action cannot be undone! Are you sure you want to delete your account? This will permanently remove all your data.')) {
                alert('To delete your account, please contact support at gardengamemain@gmail.com with your username and reason for deletion.');
            }
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }
    
    loadAccountInfo(token) {
        fetch('/api/auth/profile', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Error loading account info:', data.error);
                document.getElementById('memberSince').textContent = 'Error loading data';
                document.getElementById('lastLogin').textContent = 'Error loading data';
                return;
            }
            
            // Format dates
            const createdDate = data.created_at ? new Date(data.created_at).toLocaleDateString() : 'Unknown';
            const lastLoginDate = data.last_login ? new Date(data.last_login).toLocaleDateString() : 'Never';
            
            document.getElementById('memberSince').textContent = createdDate;
            document.getElementById('lastLogin').textContent = lastLoginDate;
            
            // Set email if available
            if (data.email) {
                document.getElementById('emailInput').value = data.email;
            }
        })
        .catch(error => {
            console.error('Error loading account info:', error);
            document.getElementById('memberSince').textContent = 'Error loading data';
            document.getElementById('lastLogin').textContent = 'Error loading data';
        });
    }
    
    updateEmail(token, modalContent) {
        const email = modalContent.querySelector('#emailInput').value.trim();
        
        if (!email) {
            alert('Please enter a valid email address.');
            return;
        }
        
        if (!email.includes('@')) {
            alert('Please enter a valid email address.');
            return;
        }
        
        fetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: email })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert('Error updating email: ' + data.error);
            } else {
                alert('Email updated successfully!');
            }
        })
        .catch(error => {
            console.error('Error updating email:', error);
            alert('Error updating email. Please try again.');
        });
    }
    
    changePassword(token, modalContent) {
        const currentPassword = modalContent.querySelector('#currentPassword').value;
        const newPassword = modalContent.querySelector('#newPassword').value;
        const confirmPassword = modalContent.querySelector('#confirmPassword').value;
        
        if (!currentPassword || !newPassword || !confirmPassword) {
            alert('Please fill in all password fields.');
            return;
        }
        
        if (newPassword.length < 6) {
            alert('New password must be at least 6 characters long.');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            alert('New passwords do not match.');
            return;
        }
        
        fetch('/api/auth/change-password', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currentPassword: currentPassword,
                newPassword: newPassword
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert('Error changing password: ' + data.error);
            } else {
                alert('Password changed successfully!');
                // Clear password fields
                modalContent.querySelector('#currentPassword').value = '';
                modalContent.querySelector('#newPassword').value = '';
                modalContent.querySelector('#confirmPassword').value = '';
            }
        })
        .catch(error => {
            console.error('Error changing password:', error);
            alert('Error changing password. Please try again.');
        });
    }
    
    showSupport() {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 15px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        `;
        
        content.innerHTML = `
            <h2 style="margin-bottom: 20px; color: #2c3e50;">📧 Support</h2>
            <div style="margin-bottom: 20px;">
                <p style="margin-bottom: 15px;">Need help with your garden? We're here to assist you!</p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="margin-bottom: 10px; color: #2c3e50;">📧 Contact Support</h3>
                    <p style="margin-bottom: 10px;"><strong>Email:</strong> <a href="mailto:gardengamemain@gmail.com" style="color: #3498db; text-decoration: none;">gardengamemain@gmail.com</a></p>
                    <p style="margin-bottom: 10px;"><strong>Response Time:</strong> Usually within 24 hours</p>
                </div>
                <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="margin-bottom: 10px; color: #27ae60;">❓ Common Issues</h3>
                    <ul style="margin-left: 20px;">
                        <li>Plants not growing properly</li>
                        <li>Game not saving progress</li>
                        <li>Multiplayer connection issues</li>
                        <li>Account-related problems</li>
                    </ul>
                </div>
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px;">
                    <h3 style="margin-bottom: 10px; color: #856404;">💡 Tips</h3>
                    <p>When contacting support, please include:</p>
                    <ul style="margin-left: 20px;">
                        <li>Your username</li>
                        <li>Description of the issue</li>
                        <li>Steps to reproduce the problem</li>
                        <li>Browser and device information</li>
                    </ul>
                </div>
            </div>
            <div style="text-align: center;">
                <button id="closeSupportBtn" style="background: #95a5a6; color: white; border: none; padding: 12px 25px; border-radius: 8px; cursor: pointer; font-size: 16px;">
                    Close
                </button>
            </div>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // Add event listeners
        const closeBtn = content.querySelector('#closeSupportBtn');
        
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }
    
    logout() {
        // Show confirmation dialog
        const confirmed = confirm('Are you sure you want to logout? Your current game progress will be saved automatically.');
        
        if (confirmed) {
            // Save current game if active
            if (this.currentGame) {
                this.currentGame.saveGame();
            }
            
            // Clear authentication tokens
            localStorage.removeItem('garden_game_token');
            localStorage.removeItem('garden_game_username');
            
            // Clear any other game-related localStorage items
            localStorage.removeItem('garden_game_sound_enabled');
            
            // Redirect to login page
            window.location.href = '/login';
        }
    }
    
    clearUIState() {
        // Reset all UI elements to default/zero values
        if (document.getElementById('money')) {
            document.getElementById('money').textContent = '0';
        }
        if (document.getElementById('water')) {
            document.getElementById('water').textContent = '0';
        }
        if (document.getElementById('fertilizer')) {
            document.getElementById('fertilizer').textContent = '0';
        }
        if (document.getElementById('score')) {
            document.getElementById('score').textContent = '0';
        }
        if (document.getElementById('weather')) {
            document.getElementById('weather').textContent = 'Sunny';
        }
        
        // Clear achievements display
        const achievementsList = document.getElementById('achievements-list');
        if (achievementsList) {
            achievementsList.innerHTML = '';
        }
        
        // Clear shop items
        const shopContainer = document.getElementById('shop-container');
        if (shopContainer) {
            shopContainer.innerHTML = '';
        }
        
        // Clear tool upgrades
        const toolUpgradesContainer = document.getElementById('tool-upgrades-container');
        if (toolUpgradesContainer) {
            toolUpgradesContainer.innerHTML = '';
        }
        
        // Clear any existing notifications
        const existingMessages = document.querySelectorAll('[style*="position: fixed"][style*="top: 20px"][style*="right: 20px"]');
        existingMessages.forEach(msg => {
            if (msg.parentNode) {
                msg.parentNode.removeChild(msg);
            }
        });
    }
    
    startBackgroundProcessing() {
        // Process background games every 5 seconds
        this.backgroundInterval = setInterval(() => {
            this.processBackgroundGames();
        }, 5000);
    }
    
    stopBackgroundProcessing() {
        if (this.backgroundInterval) {
            clearInterval(this.backgroundInterval);
            this.backgroundInterval = null;
        }
        // Clear all background games
        this.backgroundGames.clear();
    }
    
    processBackgroundGames() {
        // If there's no current game, don't process anything
        if (!this.currentGame) {
            console.log('No current game, skipping background processing');
            return;
        }
        
        const activeSlot = this.currentGame.saveSlot;
        console.log(`Background processing: active slot is ${activeSlot} at ${new Date().toLocaleTimeString()}`);
        
        // Process all save slots except the current one
        for (let slot = 1; slot <= 3; slot++) {
            // Skip if this is the currently active game slot
            if (slot === activeSlot) {
                console.log(`Skipping background processing for active slot ${slot}`);
                continue;
            }
            
            // Skip if we have a background game instance for this slot that's still processing
            if (this.backgroundGames.has(slot)) {
                console.log(`Skipping background processing for slot ${slot} - already processing`);
                continue;
            }
            
            // Additional safety check - if there's no current game, don't process
            if (!this.currentGame) {
                console.log('No current game, stopping background processing');
                return;
            }
            
            // Extra safety check - ensure we're not processing the active slot
            if (this.currentGame.saveSlot === slot) {
                console.log(`Double-check: skipping background processing for active slot ${slot}`);
                continue;
            }
            
            // Final safety check - verify the current game instance is still valid
            if (!this.currentGame.instanceId) {
                console.log('Current game instance is invalid, stopping background processing');
                return;
            }
            
            const saveData = localStorage.getItem(`gardenGameSave_${slot}`);
            if (saveData) {
                try {
                    const data = JSON.parse(saveData);
                    this.processBackgroundGame(slot, data);
                } catch (error) {
                    console.error(`Error processing background game for slot ${slot}:`, error);
                    // Remove the background game instance on error to allow retry
                    this.backgroundGames.delete(slot);
                }
            }
        }
    }
    
    processBackgroundGame(slot, saveData) {
        // Critical check: Never process the active game slot in background
        if (this.currentGame && this.currentGame.saveSlot === slot) {
            console.log(`Skipping background processing for slot ${slot} - this is the active game`);
            return;
        }
        
        console.log(`Processing background game for slot ${slot}`);
        
        try {
            // Check if there was a recent admin change to this slot (within last 120 seconds)
            const adminChangeTime = localStorage.getItem(`adminChange_${slot}`);
            if (adminChangeTime) {
                const timeSinceAdminChange = Date.now() - parseInt(adminChangeTime);
                if (timeSinceAdminChange < 120000) { // 120 seconds (increased from 60)
                    console.log(`Skipping background processing for slot ${slot} due to recent admin change (${timeSinceAdminChange}ms ago)`);
                    return;
                }
            }
            
            // Check if the save data is recent (within last 60 seconds) before overwriting
            const lastSaveTime = localStorage.getItem(`lastSaveTime_${slot}`);
            if (lastSaveTime) {
                const timeSinceLastSave = Date.now() - parseInt(lastSaveTime);
                if (timeSinceLastSave < 60000) { // 60 seconds (increased from 30)
                    console.log(`Skipping save for slot ${slot} due to recent save (${timeSinceLastSave}ms ago)`);
                    return;
                }
            }
            
            // Create a temporary game instance for background processing
            const tempGame = new GardenGame(slot);
            tempGame.isRunning = false; // Ensure it doesn't start the game loop
            
            // Validate that the temp game was created with the correct slot
            if (tempGame.saveSlot !== slot) {
                console.error(`Background temp game created with wrong slot! Expected: ${slot}, Got: ${tempGame.saveSlot}`);
                tempGame.stopGame();
                return;
            }
            
            // Store the background game instance to prevent multiple instances
            this.backgroundGames.set(slot, tempGame);
            
            // Load the save data directly without calling loadGame() to avoid UI updates
            tempGame.money = Math.max(0, saveData.money || 100);
            tempGame.water = Math.max(0, saveData.water || 50);
            tempGame.fertilizer = Math.max(0, saveData.fertilizer || 20);
            tempGame.score = Math.max(0, saveData.score || 0);
            if (saveData.garden) tempGame.garden = saveData.garden;
            if (saveData.shopInventory) {
                tempGame.shopInventory = saveData.shopInventory;
                // Validate shop inventory data
                Object.keys(tempGame.shopInventory).forEach(seedType => {
                    if (tempGame.shopInventory[seedType].stock < 0) {
                        tempGame.shopInventory[seedType].stock = 0;
                    }
                });
            }
            tempGame.lastRestockTime = saveData.lastRestockTime || Date.now();
            if (saveData.toolLevels) tempGame.toolLevels = saveData.toolLevels;
            if (saveData.toolUpgradeCosts) tempGame.toolUpgradeCosts = saveData.toolUpgradeCosts;
            if (saveData.weather) tempGame.weather = saveData.weather;
            if (saveData.achievements) tempGame.achievements = saveData.achievements;
            if (saveData.achievementStats) {
                tempGame.achievementStats = saveData.achievementStats;
                if (Array.isArray(tempGame.achievementStats.differentPlantsPlanted)) {
                    tempGame.achievementStats.differentPlantsPlanted = new Set(tempGame.achievementStats.differentPlantsPlanted);
                } else if (!tempGame.achievementStats.differentPlantsPlanted) {
                    tempGame.achievementStats.differentPlantsPlanted = new Set();
                }
            }
            if (saveData.sprinklerInventory) {
                tempGame.sprinklerInventory = saveData.sprinklerInventory;
                // Validate sprinkler inventory data
                Object.keys(tempGame.sprinklerInventory).forEach(type => {
                    if (tempGame.sprinklerInventory[type] < 0) {
                        tempGame.sprinklerInventory[type] = 0;
                    }
                });
            }
            if (saveData.sprinklers) {
                // Handle both old and new sprinkler formats
                tempGame.sprinklers = saveData.sprinklers.map(sprinkler => {
                    if (sprinkler.expiresAt) {
                        return sprinkler; // Already has timer data
                    } else {
                        // Convert old format to new format with timer
                        const sprinklerData = tempGame.sprinklerTypes[sprinkler.type];
                        const now = Date.now();
                        return {
                            ...sprinkler,
                            placedAt: now,
                            expiresAt: now + sprinklerData.duration
                        };
                    }
                });
            }
            if (saveData.soundEnabled !== undefined) tempGame.soundEnabled = saveData.soundEnabled;
            
            // Process the game in silent mode (no notifications)
            tempGame.updatePlantsSilent();
            tempGame.checkRestockSilent();
            tempGame.updateWeatherSilent();
            tempGame.checkAutoSaveSilent();
            tempGame.checkAchievementsSilent();
            
            // Final check - ensure we're not overwriting the active game
            if (this.currentGame && this.currentGame.saveSlot === slot) {
                console.log(`Final check: skipping save for active slot ${slot}`);
                return;
            }
            
            // Save the updated game state
            tempGame.saveGame();
            
            // Clean up
            tempGame.stopGame();
        } catch (error) {
            console.error(`Error in background processing for slot ${slot}:`, error);
        } finally {
            // Always remove the background game instance when done
            this.backgroundGames.delete(slot);
        }
    }
    
    clearSlot(slot) {
        console.log(`Clearing save data for slot ${slot}`);
        
        // Validate slot number
        if (slot < 1 || slot > 3) {
            console.error(`Invalid slot number: ${slot}`);
            return;
        }
        
        // Clear the save data from localStorage
        const saveKey = `gardenGameSave_${slot}`;
        localStorage.removeItem(saveKey);
        
        // Clear any admin change timestamps
        localStorage.removeItem(`adminChange_${slot}`);
        
        console.log(`Cleared all save data for slot ${slot}`);
        
        // Update the save slots display
        this.updateSaveSlots();
        
        // Show confirmation message
        alert(`Slot ${slot} has been cleared!`);
    }
}

// Initialize the menu system when the page loads
let menuSystem;
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Initializing single-player garden game...');

    try {
        menuSystem = new MenuSystem();
        console.log('MenuSystem created successfully');
        // Make menuSystem globally accessible for admin functions
        window.menuSystem = menuSystem;
        console.log('MenuSystem added to window object');
    } catch (error) {
        console.error('Error creating MenuSystem:', error);
        alert('Error initializing game. Please refresh the page.');
    }
});

// Clean up background processing when page is unloaded
window.addEventListener('beforeunload', () => {
    if (menuSystem) {
        menuSystem.stopBackgroundProcessing();
    }
});

// Global fallback: ensure a working toggle via keyboard and direct button click
(() => {
    if (window.__bonusesGlobalFallbackReady) return;
    window.__bonusesGlobalFallbackReady = true;

    function toggleBonusesPopupRaw(open) {
        const pop = document.getElementById('bonusesPopup');
        const fab = document.getElementById('bonusesFab');
        if (!pop || !fab) return;
        const shouldOpen = (typeof open === 'boolean') ? open : pop.hasAttribute('hidden');
        if (shouldOpen) {
            pop.removeAttribute('hidden');
            pop.style.display = 'block';
            fab.setAttribute('aria-expanded', 'true');
            // Try to refresh content if the game instance exists
            try { window.game && typeof window.game.updateBonusesPopup === 'function' && window.game.updateBonusesPopup(); } catch (e) {}
        } else {
            pop.setAttribute('hidden', '');
            pop.style.display = 'none';
            fab.setAttribute('aria-expanded', 'false');
        }
    }
    window.toggleBonusesPopupRaw = toggleBonusesPopupRaw;

    // Keybinding: B
    document.addEventListener('keydown', (e) => {
        const t = e.target;
        const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
        if (typing) return;
        if (e.key === 'b' || e.key === 'B') {
            e.preventDefault();
            console.log('[BonusesUI][Global] B pressed');
            toggleBonusesPopupRaw();
        }
    });

    // Direct button binding as ultimate fallback
    const btn = document.getElementById('bonusesFab');
    if (btn && !btn.dataset.globalFallbackBound) {
        btn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            console.log('[BonusesUI][Global] FAB click');
            toggleBonusesPopupRaw();
        });
        btn.dataset.globalFallbackBound = 'true';
    }

    console.log('[BonusesUI][Global] Fallback hotkey and click binding ready');
})();
