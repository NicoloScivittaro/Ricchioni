export const CAR_STATS = {
  monsterTruck: {
    name: 'Monster Truck',
    description: 'Heavy hitter. Top speed beast with sluggish handling.',
    speed: 4,        // out of 5
    acceleration: 3, // out of 5
    handling: 2,     // out of 5
    // Actual physics values
    maxSpeed: 640,
    accelRate: 300,
    turnRate: 1.575,
    friction: 0.975,
    pickupRadius: 1.0,
    colors: { primary: '#1a1a1a', secondary: '#cc2222', accent: '#ff4444' }
  },
  sportsCar: {
    name: 'Sports Car',
    description: 'Nimble and quick. Corners like a dream.',
    speed: 3,
    acceleration: 4,
    handling: 4,
    maxSpeed: 590,
    accelRate: 380,
    turnRate: 2.14,
    friction: 0.975,
    pickupRadius: 1.0,
    colors: { primary: '#cc2222', secondary: '#ffffff', accent: '#ff6666' }
  },
  topHatCar: {
    name: 'Top Hat',
    description: 'Balanced ride with a wider power-up magnet.',
    speed: 3,
    acceleration: 3,
    handling: 3,
    maxSpeed: 600,
    accelRate: 340,
    turnRate: 1.91,
    friction: 0.975,
    pickupRadius: 1.5, // wider pickup radius bonus
    colors: { primary: '#ff3366', secondary: '#33ccff', accent: '#ffcc00' }
  }
};

export const CAR_KEYS = ['monsterTruck', 'sportsCar', 'topHatCar'];

export const SPEED_CLASS = {
  '50cc': { name: '50cc', speedMult: 0.30 },
  '100cc': { name: '100cc', speedMult: 0.60 },
  '150cc': { name: '150cc', speedMult: 1.00 },
  '300cc': { name: '300cc', speedMult: 3.00 }
};

export const SPEED_CLASS_KEYS = ['50cc', '100cc', '150cc', '300cc'];

export const DIFFICULTY = {
  easy: {
    name: 'Easy',
    baseSpeedMult: 0.50,
    rubberBandStrength: 1.0,
    mistakeChance: 0.35,
    powerUpDelay: 4000,
    powerUpWasteChance: 0.7
  },
  medium: {
    name: 'Medium',
    baseSpeedMult: 0.85,
    rubberBandStrength: 0.5,
    mistakeChance: 0.07,
    powerUpDelay: 1200,
    powerUpWasteChance: 0.15
  },
  hard: {
    name: 'Hard',
    baseSpeedMult: 0.95,
    rubberBandStrength: 0.25,
    mistakeChance: 0.02,
    powerUpDelay: 600,
    powerUpWasteChance: 0.05
  }
};
