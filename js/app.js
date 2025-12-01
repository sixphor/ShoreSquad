/**
 * ShoreSquad - Interactive App
 * Features: Weather API, Geolocation, Event Management, Dynamic UI
 * Performance optimized with debouncing, lazy loading, and caching
 */

// ============================================
// Configuration & Constants
// ============================================

const CONFIG = {
    API: {
        weather: 'https://api.data.gov.sg/v1/environment/2-hour-weather-forecast', // NEA 2-hour forecast
        weatherFull: 'https://api.data.gov.sg/v1/environment/4-day-weather-forecast', // NEA 4-day forecast
        timeout: 5000,
    },
    cache: {
        duration: 3600000, // 1 hour in ms
    },
    geolocation: {
        timeout: 8000,
        enableHighAccuracy: false,
    },
};

const BEACH_LOCATIONS = [
    { id: 1, name: 'Coral Bay', lat: 34.0195, lng: -118.4912, cleanup_date: '2025-01-15' },
    { id: 2, name: 'Crystal Cove', lat: 33.6010, lng: -117.7930, cleanup_date: '2025-01-22' },
    { id: 3, name: 'Laguna Shores', lat: 33.5427, lng: -117.7831, cleanup_date: '2025-01-29' },
    { id: 4, name: 'Pacific Edge', lat: 32.7157, lng: -117.2472, cleanup_date: '2025-02-05' },
];

const CREW_MEMBERS = [
    { id: 1, name: 'Alex Ocean', avatar: '👨‍🌾', impact: '45 cleanups', specialized: 'Marine Life' },
    { id: 2, name: 'Maya Wave', avatar: '👩‍💼', impact: '32 cleanups', specialized: 'Organizer' },
    { id: 3, name: 'Jordan Tide', avatar: '👨‍🏫', impact: '28 cleanups', specialized: 'Educator' },
    { id: 4, name: 'Taylor Shore', avatar: '👩‍⚕️', impact: '22 cleanups', specialized: 'Wellness' },
];

// ============================================
// Utility Functions
// ============================================

/**
 * Debounce function to limit API calls
 */
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
};

/**
 * Throttle function for scroll events
 */
const throttle = (func, limit) => {
    let inThrottle;
    return (...args) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
};

/**
 * Cache management with localStorage
 */
const CacheManager = {
    set: (key, value, duration = CONFIG.cache.duration) => {
        const expiry = Date.now() + duration;
        localStorage.setItem(key, JSON.stringify({ value, expiry }));
    },

    get: (key) => {
        const cached = localStorage.getItem(key);
        if (!cached) return null;

        const { value, expiry } = JSON.parse(cached);
        if (Date.now() > expiry) {
            localStorage.removeItem(key);
            return null;
        }
        return value;
    },

    clear: (key) => localStorage.removeItem(key),
};

// ============================================
// Weather Module
// ============================================

const WeatherModule = {
    /**
     * Fetch 4-day weather forecast from NEA with timeout
     */
    async fetchWeather() {
        const cacheKey = 'weather_forecast_nea';
        const cached = CacheManager.get(cacheKey);

        if (cached) {
            console.log('Using cached 4-day weather data');
            return cached;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.API.timeout);

            const response = await fetch(CONFIG.API.weatherFull, {
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.warn(`Weather API returned status ${response.status}`);
                return null;
            }

            const data = await response.json();
            
            // Validate structure
            if (!data || typeof data !== 'object') {
                console.warn('Invalid weather data structure');
                return null;
            }

            CacheManager.set(cacheKey, data);
            return data;
        } catch (error) {
            console.error('4-day forecast fetch failed:', error.message);
            return null;
        }
    },

    /**
     * Fetch 2-hour forecast from NEA with timeout
     */
    async fetch2HourForecast() {
        const cacheKey = 'weather_2hour_nea';
        const cached = CacheManager.get(cacheKey);

        if (cached) {
            console.log('Using cached 2-hour weather data');
            return cached;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.API.timeout);

            const response = await fetch(CONFIG.API.weather, {
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.warn(`2-hour forecast API returned status ${response.status}`);
                return null;
            }

            const data = await response.json();

            // Validate structure
            if (!data || typeof data !== 'object') {
                console.warn('Invalid 2-hour forecast data structure');
                return null;
            }

            CacheManager.set(cacheKey, data);
            return data;
        } catch (error) {
            console.error('2-hour forecast fetch failed:', error.message);
            return null;
        }
    },

    /**
     * Get weather emoji/icon based on forecast text
     */
    getWeatherEmoji(forecastText) {
        if (!forecastText) return '🌤️';
        
        const text = String(forecastText).toLowerCase();
        if (text.includes('rain') || text.includes('thunderstorm')) return '🌧️';
        if (text.includes('thundery')) return '⛈️';
        if (text.includes('showers')) return '🌧️';
        if (text.includes('cloudy') || text.includes('overcast')) return '☁️';
        if (text.includes('clear') || text.includes('sunny') || text.includes('fair')) return '☀️';
        if (text.includes('partly')) return '⛅';
        if (text.includes('fog')) return '🌫️';
        return '🌤️';
    },

    /**
     * Format date for display
     */
    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return 'Unknown Date';
            }
            return date.toLocaleDateString('en-SG', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
            });
        } catch (error) {
            console.warn('Date formatting failed:', error);
            return 'Unknown Date';
        }
    },

    /**
     * Display 4-day forecast
     */
    displayWeather(data) {
        const container = document.getElementById('weatherContainer');
        
        if (!container) {
            console.warn('Weather container not found');
            return;
        }

        if (!data || !Array.isArray(data.items) || data.items.length === 0) {
            container.innerHTML = `
                <div class="weather-card" style="grid-column: 1/-1;">
                    <p>📊 Weather data temporarily unavailable. Try again later.</p>
                </div>
            `;
            return;
        }

        try {
            const forecastsArray = data.items[0]?.forecasts || [];
            
            if (forecastsArray.length === 0) {
                container.innerHTML = `
                    <div class="weather-card" style="grid-column: 1/-1;">
                        <p>📊 No forecast data available.</p>
                    </div>
                `;
                return;
            }

            // Group forecasts by date
            const forecastByDate = {};
            forecastsArray.forEach((forecast) => {
                if (!forecast || !forecast.date) return;
                
                const date = String(forecast.date).trim();
                if (!forecastByDate[date]) {
                    forecastByDate[date] = [];
                }
                forecastByDate[date].push(forecast);
            });

            // Get unique dates (limit to 4 days)
            const dates = Object.keys(forecastByDate).slice(0, 4);

            if (dates.length === 0) {
                container.innerHTML = `
                    <div class="weather-card" style="grid-column: 1/-1;">
                        <p>📊 No date information in forecast.</p>
                    </div>
                `;
                return;
            }

            // Create weather cards
            const weatherHTML = dates
                .map((date) => {
                    const dayForecasts = forecastByDate[date] || [];
                    const forecastTexts = dayForecasts
                        .map((f) => f.forecast)
                        .filter(Boolean);
                    
                    // Extract temperature ranges (NEA returns {low, high} objects)
                    const tempLows = [];
                    const tempHighs = [];
                    dayForecasts.forEach((f) => {
                        if (f.temperature && typeof f.temperature === 'object') {
                            if (f.temperature.low !== undefined && f.temperature.low !== null) {
                                tempLows.push(Number(f.temperature.low));
                            }
                            if (f.temperature.high !== undefined && f.temperature.high !== null) {
                                tempHighs.push(Number(f.temperature.high));
                            }
                        }
                    });

                    // Extract humidity ranges
                    const humidityLows = [];
                    const humidityHighs = [];
                    dayForecasts.forEach((f) => {
                        if (f.relative_humidity && typeof f.relative_humidity === 'object') {
                            if (f.relative_humidity.low !== undefined && f.relative_humidity.low !== null) {
                                humidityLows.push(Number(f.relative_humidity.low));
                            }
                            if (f.relative_humidity.high !== undefined && f.relative_humidity.high !== null) {
                                humidityHighs.push(Number(f.relative_humidity.high));
                            }
                        }
                    });

                    // Extract wind ranges
                    const windLows = [];
                    const windHighs = [];
                    dayForecasts.forEach((f) => {
                        if (f.wind && typeof f.wind === 'object') {
                            if (f.wind.low !== undefined && f.wind.low !== null) {
                                windLows.push(Number(f.wind.low));
                            }
                            if (f.wind.high !== undefined && f.wind.high !== null) {
                                windHighs.push(Number(f.wind.high));
                            }
                        }
                    });

                    // Calculate ranges, filter out NaN values
                    const validTempLows = tempLows.filter(t => !isNaN(t));
                    const validTempHighs = tempHighs.filter(t => !isNaN(t));
                    const validHumidityLows = humidityLows.filter(h => !isNaN(h));
                    const validHumidityHighs = humidityHighs.filter(h => !isNaN(h));
                    const validWindLows = windLows.filter(w => !isNaN(w));
                    const validWindHighs = windHighs.filter(w => !isNaN(w));

                    const avgTempLow = validTempLows.length > 0 
                        ? (validTempLows.reduce((a, b) => a + b, 0) / validTempLows.length).toFixed(1)
                        : '--';
                    const avgTempHigh = validTempHighs.length > 0
                        ? (validTempHighs.reduce((a, b) => a + b, 0) / validTempHighs.length).toFixed(1)
                        : '--';
                    
                    const avgHumidityLow = validHumidityLows.length > 0
                        ? (validHumidityLows.reduce((a, b) => a + b, 0) / validHumidityLows.length).toFixed(0)
                        : '--';
                    const avgHumidityHigh = validHumidityHighs.length > 0
                        ? (validHumidityHighs.reduce((a, b) => a + b, 0) / validHumidityHighs.length).toFixed(0)
                        : '--';
                    
                    const avgWindLow = validWindLows.length > 0
                        ? (validWindLows.reduce((a, b) => a + b, 0) / validWindLows.length).toFixed(1)
                        : '--';
                    const avgWindHigh = validWindHighs.length > 0
                        ? (validWindHighs.reduce((a, b) => a + b, 0) / validWindHighs.length).toFixed(1)
                        : '--';

                    const conditions = new Set(forecastTexts);
                    const primaryCondition = Array.from(conditions)[0] || 'Fair';
                    const hasRain = Array.from(conditions).some((c) =>
                        String(c).toLowerCase().includes('rain')
                    );
                    const emoji = this.getWeatherEmoji(primaryCondition);

                    return `
                        <div class="weather-card">
                            <h5>${this.formatDate(date)}</h5>
                            <p style="font-size: 1.5rem; margin: 0.5rem 0;">
                                ${emoji} ${primaryCondition}
                            </p>
                            <p><strong>Temperature:</strong> ${avgTempLow}°C - ${avgTempHigh}°C</p>
                            <p><strong>Humidity:</strong> ${avgHumidityLow}% - ${avgHumidityHigh}%</p>
                            <p><strong>Conditions:</strong> ${Array.from(conditions).slice(0, 2).join(', ') || 'Fair'}</p>
                            <p style="font-size: 0.9rem; color: #A0AEC0;">
                                ${hasRain ? '⚠️ Bring rain gear' : '✅ Good cleanup weather'}
                            </p>
                        </div>
                    `;
                })
                .join('');

            container.innerHTML = weatherHTML;
        } catch (error) {
            console.error('Error displaying 4-day forecast:', error);
            container.innerHTML = `
                <div class="weather-card" style="grid-column: 1/-1;">
                    <p>⚠️ Error loading forecast. Please refresh.</p>
                </div>
            `;
        }
    },

    /**
     * Display 2-hour forecast as current conditions
     */
    displayCurrentWeather(data) {
        const container = document.getElementById('weatherContainer');
        
        if (!container || !data) {
            return;
        }

        try {
            const items = Array.isArray(data.items) ? data.items : [];
            if (items.length === 0) {
                return;
            }

            const current = items[0];
            const forecasts = Array.isArray(current.forecasts) ? current.forecasts : [];
            
            if (forecasts.length === 0) {
                return;
            }

            const currentForecast = forecasts[0];
            const forecast = currentForecast?.forecast || 'Fair';
            const emoji = this.getWeatherEmoji(forecast);
            
            const updateTime = current.update_timestamp 
                ? new Date(current.update_timestamp).toLocaleTimeString('en-SG', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                })
                : 'Just now';

            const currentHTML = `
                <div class="weather-card" style="grid-column: 1/-1; background: linear-gradient(135deg, #00D4AA 0%, #0099CC 100%); color: white;">
                    <h5 style="color: white; margin-bottom: var(--spacing-md);">Current Conditions (Next 2 Hours)</h5>
                    <p style="font-size: 1.8rem; margin: 0.5rem 0;">
                        ${emoji} ${forecast}
                    </p>
                    <p><strong>Updated:</strong> ${updateTime}</p>
                </div>
            `;

            // Insert at the beginning
            const existingHTML = container.innerHTML;
            container.innerHTML = currentHTML + existingHTML;
        } catch (error) {
            console.error('Error displaying current weather:', error);
        }
    },
};

// ============================================
// Geolocation Module
// ============================================

const GeolocationModule = {
    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                console.warn('Geolocation not supported, using default location');
                // Pasir Ris as default
                resolve({ latitude: 1.381497, longitude: 103.955574 });
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    });
                },
                (error) => {
                    console.warn('Geolocation error:', error);
                    // Fallback to Pasir Ris Beach
                    resolve({ latitude: 1.381497, longitude: 103.955574 });
                },
                CONFIG.geolocation
            );
        });
    },
};

// ============================================
// Events Module
// ============================================

const EventsModule = {
    displayEvents() {
        const eventsHTML = BEACH_LOCATIONS
            .map(
                (beach) => `
            <div class="event-card">
                <h4>🏖️ ${beach.name}</h4>
                <p><strong>📅 Date:</strong> ${new Date(beach.cleanup_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                })}</p>
                <p><strong>📍 Coordinates:</strong> ${beach.lat.toFixed(4)}°, ${beach.lng.toFixed(4)}°</p>
                <button class="btn-secondary" data-event-id="${beach.id}">Join This Cleanup</button>
            </div>
        `
            )
            .join('');

        document.getElementById('eventsContainer').innerHTML = eventsHTML;

        // Add event listeners
        document.querySelectorAll('[data-event-id]').forEach((btn) => {
            btn.addEventListener('click', () => this.joinEvent(btn.dataset.eventId));
        });
    },

    joinEvent(eventId) {
        const beach = BEACH_LOCATIONS.find((b) => b.id == eventId);
        if (beach) {
            alert(`🎉 You've joined the cleanup at ${beach.name}! See you on ${beach.cleanup_date}`);
        }
    },
};

// ============================================
// Crew Module
// ============================================

const CrewModule = {
    displayCrew() {
        const crewHTML = CREW_MEMBERS
            .map(
                (member) => `
            <div class="crew-card">
                <div class="avatar">${member.avatar}</div>
                <h4>${member.name}</h4>
                <p><strong>${member.impact}</strong></p>
                <p style="font-size: 0.9rem; color: #0099CC;">🎯 ${member.specialized}</p>
                <button class="btn-secondary" style="margin-top: 1rem;">View Profile</button>
            </div>
        `
            )
            .join('');

        document.getElementById('crewContainer').innerHTML = crewHTML;
    },
};

// ============================================
// UI Interactions
// ============================================

const UIModule = {
    init() {
        this.attachEventListeners();
        this.setupSmoothScroll();
    },

    attachEventListeners() {
        // Get Started button
        const getStartedBtn = document.getElementById('getStartedBtn');
        if (getStartedBtn) {
            getStartedBtn.addEventListener('click', () => {
                document.getElementById('map').scrollIntoView({ behavior: 'smooth' });
            });
        }

        // Join Squad CTA
        const joinBtn = document.querySelector('.btn-cta');
        if (joinBtn) {
            joinBtn.addEventListener('click', () => {
                alert('Welcome to ShoreSquad! 🌊 Create your account to get started.');
            });
        }

        // Map registration button
        const mapRegisterBtn = document.querySelector('.map-info .btn-primary');
        if (mapRegisterBtn) {
            mapRegisterBtn.addEventListener('click', () => {
                alert('🎉 You\'ve registered for the Pasir Ris cleanup on January 4, 2025! See you at 9:00 AM. 🌊');
            });
        }
    },

    setupSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
            anchor.addEventListener('click', function (e) {
                const href = this.getAttribute('href');
                if (href === '#') return;

                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    },
};

// ============================================
// App Initialization
// ============================================

const App = {
    async init() {
        console.log('🌊 ShoreSquad App Initializing...');

        // Initialize UI
        UIModule.init();

        // Display crew and events
        CrewModule.displayCrew();
        EventsModule.displayEvents();

        // Fetch and display weather from NEA
        try {
            console.log('📍 Fetching weather from NEA...');
            
            // Fetch 4-day forecast
            const forecast = await WeatherModule.fetchWeather();
            if (forecast) {
                WeatherModule.displayWeather(forecast);
            }

            // Fetch current 2-hour forecast
            const current = await WeatherModule.fetch2HourForecast();
            if (current && forecast) {
                WeatherModule.displayCurrentWeather(current);
            }
        } catch (error) {
            console.error('App initialization error:', error);
            document.getElementById('weatherContainer').innerHTML = `
                <div class="weather-card" style="grid-column: 1/-1;">
                    <p>⚠️ Weather data currently unavailable. Check back soon!</p>
                </div>
            `;
        }

        console.log('✅ ShoreSquad App Ready!');
    },
};

// ============================================
// DOM Content Loaded
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// ============================================
// Performance Monitoring
// ============================================

if (window.performance) {
    window.addEventListener('load', () => {
        const perfData = window.performance.timing;
        const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
        console.log(`⚡ Page loaded in ${pageLoadTime}ms`);
    });
}

// ============================================
// Service Worker (Future Enhancement)
// ============================================

// if ('serviceWorker' in navigator) {
//   navigator.serviceWorker.register('js/service-worker.js')
//     .catch(err => console.log('Service Worker registration failed:', err));
// }
