/**
 * Weather API for outdoor MLB games.
 * Uses Open-Meteo (100% free, no API key needed).
 * MLB stadiums are mostly outdoor; NBA is always indoor.
 */

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';

// MLB outdoor stadiums with coordinates (excludes domed stadiums)
const OUTDOOR_STADIUMS: Record<string, { lat: number; lon: number; dome: boolean }> = {
  'New York Yankees': { lat: 40.829, lon: -73.926, dome: false },
  'New York Mets': { lat: 40.757, lon: -73.846, dome: false },
  'Boston Red Sox': { lat: 42.346, lon: -71.097, dome: false },
  'Los Angeles Dodgers': { lat: 34.074, lon: -118.240, dome: false },
  'San Francisco Giants': { lat: 37.778, lon: -122.389, dome: false },
  'Chicago Cubs': { lat: 41.948, lon: -87.656, dome: false },
  'Chicago White Sox': { lat: 41.830, lon: -87.634, dome: false },
  'Philadelphia Phillies': { lat: 39.906, lon: -75.166, dome: false },
  'Atlanta Braves': { lat: 33.891, lon: -84.468, dome: false },
  'Washington Nationals': { lat: 38.873, lon: -77.007, dome: false },
  'Cleveland Guardians': { lat: 41.496, lon: -81.685, dome: false },
  'Detroit Tigers': { lat: 42.339, lon: -83.049, dome: false },
  'Baltimore Orioles': { lat: 39.284, lon: -76.622, dome: false },
  'Cincinnati Reds': { lat: 39.097, lon: -84.507, dome: false },
  'Pittsburgh Pirates': { lat: 40.447, lon: -80.006, dome: false },
  'St. Louis Cardinals': { lat: 38.623, lon: -90.193, dome: false },
  'Kansas City Royals': { lat: 39.051, lon: -94.480, dome: false },
  'Colorado Rockies': { lat: 39.756, lon: -104.994, dome: false },
  'San Diego Padres': { lat: 32.707, lon: -117.157, dome: false },
  'Arizona Diamondbacks': { lat: 33.445, lon: -112.067, dome: true }, // Chase Field retractable
  'Minnesota Twins': { lat: 44.982, lon: -93.278, dome: false },
  'Los Angeles Angels': { lat: 33.800, lon: -117.883, dome: false },
  'Oakland Athletics': { lat: 37.751, lon: -122.201, dome: false },
  'Seattle Mariners': { lat: 47.591, lon: -122.332, dome: true }, // T-Mobile Park retractable
  'Texas Rangers': { lat: 32.751, lon: -97.083, dome: true }, // Globe Life Field
  'Tampa Bay Rays': { lat: 27.768, lon: -82.653, dome: true }, // Tropicana
  'Milwaukee Brewers': { lat: 43.028, lon: -87.971, dome: true }, // retractable
  'Houston Astros': { lat: 29.757, lon: -95.355, dome: true }, // Minute Maid
  'Miami Marlins': { lat: 25.778, lon: -80.220, dome: true }, // LoanDepot Park
  'Toronto Blue Jays': { lat: 43.641, lon: -79.389, dome: true }, // Rogers Centre
};

export interface WeatherData {
  team_name: string;
  is_outdoor: boolean;
  temperature_f: number;
  wind_mph: number;
  precipitation_chance: number;
  conditions: string;
  impact: 'favorable' | 'neutral' | 'unfavorable';
  description: string;
}

/**
 * Check if a game is outdoor and get weather impact.
 */
export async function fetchGameWeather(homeTeam: string, gameTime: string): Promise<WeatherData | null> {
  const stadium = OUTDOOR_STADIUMS[homeTeam];
  if (!stadium) return null;

  if (stadium.dome) {
    return {
      team_name: homeTeam,
      is_outdoor: false,
      temperature_f: 72,
      wind_mph: 0,
      precipitation_chance: 0,
      conditions: 'Domo cerrado',
      impact: 'neutral',
      description: 'Estadio con domo - clima no afecta',
    };
  }

  try {
    const date = new Date(gameTime);
    const dateStr = date.toISOString().slice(0, 10);
    const hour = date.getUTCHours();

    const url = `${OPEN_METEO}?latitude=${stadium.lat}&longitude=${stadium.lon}&hourly=temperature_2m,wind_speed_10m,precipitation_probability&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=3`;

    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data = await res.json() as {
      hourly: {
        time: string[];
        temperature_2m: number[];
        wind_speed_10m: number[];
        precipitation_probability: number[];
      };
    };

    // Find the hour closest to game time
    const targetHour = `${dateStr}T${hour.toString().padStart(2, '0')}:00`;
    const idx = data.hourly.time.findIndex((t) => t === targetHour);
    const i = idx >= 0 ? idx : 0;

    const temp = data.hourly.temperature_2m[i] ?? 72;
    const wind = data.hourly.wind_speed_10m[i] ?? 0;
    const precip = data.hourly.precipitation_probability[i] ?? 0;

    // Determine impact on game
    let impact: 'favorable' | 'neutral' | 'unfavorable' = 'neutral';
    let conditions = '';

    if (precip > 50) {
      impact = 'unfavorable';
      conditions = `Lluvia ${precip}%`;
    } else if (wind > 20) {
      impact = 'unfavorable';
      conditions = `Viento fuerte ${wind.toFixed(0)}mph`;
    } else if (temp < 45) {
      impact = 'unfavorable';
      conditions = `Frio ${temp.toFixed(0)}°F`;
    } else if (temp > 95) {
      impact = 'unfavorable';
      conditions = `Calor extremo ${temp.toFixed(0)}°F`;
    } else if (wind > 10 && wind <= 20) {
      conditions = `Viento ${wind.toFixed(0)}mph, ${temp.toFixed(0)}°F`;
    } else {
      impact = 'favorable';
      conditions = `${temp.toFixed(0)}°F, viento ${wind.toFixed(0)}mph`;
    }

    const desc = `${conditions}. ${precip > 0 ? `${precip}% prob lluvia.` : ''} ${wind > 15 ? 'Viento fuerte favorece under.' : ''}`.trim();

    return {
      team_name: homeTeam,
      is_outdoor: true,
      temperature_f: temp,
      wind_mph: wind,
      precipitation_chance: precip,
      conditions,
      impact,
      description: desc,
    };
  } catch {
    return null;
  }
}
