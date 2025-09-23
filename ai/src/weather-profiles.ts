export interface WeatherProfile {
  colors: string[];
  avoidColors?: string[];
  materials: string[];
  avoidItems?: string[];
  suggestItems: string[];
  requireItems?: string[];
}

export const weatherProfiles: Record<string, WeatherProfile> = {
  hot: { // > 85°F
    colors: ['white', 'beige', 'pastels', 'light_blue'],
    avoidColors: ['black', 'dark_brown'],
    materials: ['cotton', 'linen', 'lightweight'],
    avoidItems: ['sweater', 'jacket', 'boots'],
    suggestItems: ['shorts', 't-shirt', 'sandals', 'sunglasses']
  },
  warm: { // 70-85°F
    colors: ['any'],
    materials: ['cotton', 'light_wool', 'denim'],
    suggestItems: ['light_jacket', 'jeans', 'sneakers']
  },
  cool: { // 50-70°F
    colors: ['earth_tones', 'jewel_tones'],
    materials: ['denim', 'wool', 'knit'],
    suggestItems: ['cardigan', 'light_sweater', 'closed_shoes']
  },
  cold: { // < 50°F
    colors: ['dark_colors', 'rich_tones'],
    materials: ['wool', 'fleece', 'heavy_cotton'],
    requireItems: ['coat', 'closed_shoes'],
    suggestItems: ['scarf', 'gloves', 'boots']
  },
  rainy: {
    colors: ['navy', 'black', 'gray'],
    avoidColors: ['white', 'light_colors'],
    materials: ['waterproof', 'water_resistant'],
    avoidItems: ['suede', 'canvas'],
    requireItems: ['waterproof_jacket', 'water_resistant_shoes'],
    suggestItems: ['darker_shades', 'umbrella']
  }
};

export function getWeatherProfile(temperature: number, condition: string): WeatherProfile {
  let profile: WeatherProfile;
  
  if (temperature > 85) {
    profile = weatherProfiles.hot;
  } else if (temperature > 70) {
    profile = weatherProfiles.warm;
  } else if (temperature > 50) {
    profile = weatherProfiles.cool;
  } else {
    profile = weatherProfiles.cold;
  }
  
  // Merge with condition-specific profile if applicable
  if (condition.toLowerCase().includes('rain')) {
    profile = {
      ...profile,
      ...weatherProfiles.rainy,
      suggestItems: [...profile.suggestItems, ...weatherProfiles.rainy.suggestItems],
      materials: [...profile.materials, ...weatherProfiles.rainy.materials]
    };
  }
  
  return profile;
}
