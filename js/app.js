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
        weather: 'https://api.open-meteo.com/v1/forecast', // Free weather API
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
     * Fetch weather for a given location
     */
    async fetchWeather(latitude, longitude) {
        const cacheKey = `weather_${latitude}_${longitude}`;
        const cached = CacheManager.get(cacheKey);

        if (cached) {
            console.log('Using cached weather data');
            return cached;
        }

        try {
            const params = new URLSearchParams({
                latitude,
                longitude,
                current: 'temperature_2m,weather_code,wind_speed_10m',
                daily: 'weather_code,temperature_2m_max,temperature_2m_min',
                timezone: 'auto',
            });

            const response = await fetch(`${CONFIG.API.weather}?${params}`, {
                signal: AbortSignal.timeout(CONFIG.API.timeout),
            });

            if (!response.ok) throw new Error('Weather API error');

            const data = await response.json();
            CacheManager.set(cacheKey, data);
            return data;
        } catch (error) {
            console.error('Weather fetch failed:', error);
            return null;
        }
    },

    /**
     * Interpret weather code
     */
    getWeatherDescription(code) {
        const weatherCodes = {
            0: '☀️ Clear',
            1: '⛅ Partly Cloudy',
            2: '☁️ Cloudy',
            3: '☁️ Overcast',
            45: '🌫️ Foggy',
            48: '🌫️ Frosting Fog',
            51: '🌧️ Light Rain',
            61: '🌧️ Moderate Rain',
            80: '⛈️ Showers',
            95: '⛈️ Thunderstorm',
        };
        return weatherCodes[code] || '❓ Unknown';
    },

    /**
     * Display weather cards
     */
    displayWeather(data, location = 'Your Location') {
        if (!data) {
            document.getElementById('weatherContainer').innerHTML = `
                <div class="weather-card" style="grid-column: 1/-1;">
                    <p>Unable to fetch weather data. Please check your connection.</p>
                </div>
            `;
            return;
        }

        const { current, daily } = data;
        const weatherHTML = `
            <div class="weather-card">
                <h5>${location}</h5>
                <p style="font-size: 1.5rem; margin: 0.5rem 0;">
                    ${this.getWeatherDescription(current.weather_code)}
                </p>
                <p><strong>Temperature:</strong> ${current.temperature_2m}°C</p>
                <p><strong>Wind Speed:</strong> ${current.wind_speed_10m} km/h</p>
            </div>
            <div class="weather-card">
                <h5>7-Day Forecast</h5>
                <p><strong>Max:</strong> ${daily.temperature_2m_max[0]}°C</p>
                <p><strong>Min:</strong> ${daily.temperature_2m_min[0]}°C</p>
                <p style="font-size: 0.9rem; color: #A0AEC0;">
                    Good beach cleanup weather? ${current.temperature_2m > 15 ? '✅ Yes!' : '⚠️ Bundle up!'}
                </p>
            </div>
        `;

        document.getElementById('weatherContainer').innerHTML = weatherHTML;
    },
};

// ============================================
// Geolocation Module
// ============================================

const GeolocationModule = {
    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
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
                    // Fallback to default location (Santa Monica Beach)
                    resolve({ latitude: 34.0195, longitude: -118.4912 });
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

        // Fetch and display weather
        try {
            const location = await GeolocationModule.getCurrentLocation();
            console.log('📍 Location obtained:', location);

            const weather = await WeatherModule.fetchWeather(location.latitude, location.longitude);
            WeatherModule.displayWeather(weather);
        } catch (error) {
            console.error('App initialization error:', error);
            // Fetch weather for default location
            const weather = await WeatherModule.fetchWeather(34.0195, -118.4912);
            WeatherModule.displayWeather(weather, 'Santa Monica Beach');
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
