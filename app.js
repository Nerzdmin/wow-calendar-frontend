const API_BASE = "http://YOUR_SERVER_IP:5000/api"; // Replace with your server IP

const { createApp, ref, reactive, onMounted, computed } = Vue;

const app = createApp({
    setup() {
        const loggedIn = ref(false);
        const loading = ref(true);
        const events = ref([]);
        const dungeons = ref([]);
        const subtitle = ref("Schedule your dungeon runs and raids");
        const token = ref(localStorage.getItem('wow_token') || '');
        
        // Check existing token
        if (token.value) {
            loggedIn.value = true;
            loadEvents();
            loadDungeons();
        }
        loading.value = false;
        
        // API request helper
        async function apiRequest(url, method = 'GET', data = null) {
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (loggedIn.value) {
                headers['Authorization'] = `Bearer ${token.value}`;
            }
            
            const config = {
                method,
                headers
            };
            
            if (data) {
                config.body = JSON.stringify(data);
            }
            
            try {
                const response = await fetch(`${API_BASE}${url}`, config);
                
                if (response.status === 401) {
                    logout();
                    return null;
                }
                
                return await response.json();
            } catch (error) {
                console.error('API error:', error);
                return null;
            }
        }
        
        // Load events from API
        async function loadEvents() {
            const data = await apiRequest('/events');
            if (data) events.value = data;
        }
        
        // Load dungeons from API
        async function loadDungeons() {
            const data = await apiRequest('/dungeons');
            if (data) dungeons.value = data;
        }
        
        // Login function
        async function login(password) {
            const response = await apiRequest('/login', 'POST', { password });
            
            if (response && response.token) {
                token.value = response.token;
                localStorage.setItem('wow_token', token.value);
                loggedIn.value = true;
                loadEvents();
                loadDungeons();
                return true;
            }
            
            return false;
        }
        
        // Logout function
        function logout() {
            localStorage.removeItem('wow_token');
            token.value = '';
            loggedIn.value = false;
            events.value = [];
        }
        
        // Add new event
        async function addEvent(eventData) {
            const response = await apiRequest('/events', 'POST', eventData);
            if (response && response.status === 'success') {
                loadEvents();
                return true;
            }
            return false;
        }
        
        // Delete event
        async function deleteEvent(eventId) {
            const response = await apiRequest(`/events/${eventId}`, 'DELETE');
            if (response && response.status === 'success') {
                loadEvents();
                return true;
            }
            return false;
        }
        
        // Add signup to event
        async function addSignup(eventId, playerName, lootTarget) {
            const response = await apiRequest('/signups', 'POST', {
                event_id: eventId,
                player_name: playerName,
                loot_target: lootTarget || ''
            });
            
            return response && response.status === 'success';
        }
        
        return {
            loggedIn,
            loading,
            events,
            dungeons,
            subtitle,
            login,
            logout,
            addEvent,
            deleteEvent,
            addSignup,
            loadEvents
        };
    }
});

// Login Component
app.component('login-form', {
    template: `
        <div class="password-section">
            <h2>Enter Guild Password</h2>
            <form @submit.prevent="handleLogin">
                <div class="form-group">
                    <input type="password" v-model="password" placeholder="Shared guild password" required>
                </div>
                <button type="submit" class="btn">Enter Calendar</button>
                <div v-if="error" class="error-message">{{ error }}</div>
            </form>
        </div>
    `,
    setup(props, { root }) {
        const password = ref('');
        const error = ref('');
        
        const handleLogin = async () => {
            error.value = '';
            const success = await root.login(password.value);
            
            if (!success) {
                error.value = "Invalid password";
            }
        };
        
        return {
            password,
            error,
            handleLogin
        };
    }
});

// Calendar Component
app.component('calendar-view', {
    template: `
        <div>
            <div class="calendar-header">
                <h2>Guild Event Calendar</h2>
                <div class="calendar-tools">
                    <button class="btn btn-secondary" @click="showAddEvent = true">
                        <i class="fa-solid fa-calendar-plus"></i> Schedule Event
                    </button>
                    <button class="btn btn-logout" @click="logout">
                        <i class="fa-solid fa-right-from-bracket"></i> Logout
                    </button>
                </div>
            </div>
            
            <div class="event-list">
                <div v-for="event in root.events" :key="event.id" class="event-card" :class="event.type">
                    <!-- Event display code from original calendar.html -->
                </div>
                
                <div v-if="root.events.length === 0" class="no-events">
                    <i class="fa-solid fa-calendar-xmark"></i>
                    <h4>No events scheduled yet!</h4>
                    <p>Schedule your first dungeon run</p>
                </div>
            </div>
            
            <add-event-form 
                v-if="showAddEvent" 
                :dungeons="root.dungeons" 
                @close="showAddEvent = false"
                @add-event="handleAddEvent"
            ></add-event-form>
        </div>
    `,
    setup(props, { root }) {
        const showAddEvent = ref(false);
        
        const logout = () => {
            root.logout();
        };
        
        const handleAddEvent = async (eventData) => {
            const success = await root.addEvent(eventData);
            showAddEvent.value = !success;
        };
        
        return {
            showAddEvent,
            logout,
            handleAddEvent
        };
    }
});

// Add Event Component
app.component('add-event-form', {
    template: `
        <div class="modal-overlay" @click.self="close">
            <div class="event-form">
                <h2>Schedule New Event</h2>
                <form @submit.prevent="submitEvent">
                    <!-- Form fields from original add_event.html -->
                </form>
            </div>
        </div>
    `,
    props: ['dungeons'],
    setup(props, { emit }) {
        const eventData = reactive({
            dungeon: '',
            loot: '',
            event_date: '',
            event_time: '',
            player_name: '',
            event_type: 'dungeon',
            notes: ''
        });
        
        // Initialize date/time
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        now.setHours(now.getHours() + 1);
        const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        eventData.event_date = today;
        eventData.event_time = timeString;
        
        const submitEvent = () => {
            // Combine date and time
            const dateTime = `${eventData.event_date}T${eventData.event_time}`;
            
            emit('add-event', {
                ...eventData,
                event_date: dateTime
            });
        };
        
        const close = () => {
            emit('close');
        };
        
        return {
            eventData,
            submitEvent,
            close
        };
    }
});

app.mount('#app');
