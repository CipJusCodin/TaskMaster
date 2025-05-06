// Global variables
let currentUser = null;
let loadingTimeoutId = null; // Added to track loading timeout

// Initialize the application
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    // Make sure loading is hidden initially
    forceHideLoading();
    
    // Set up Firebase auth state change listener
    auth.onAuthStateChanged(user => {
        try {
            if (user) {
                // User is signed in
                currentUser = {
                    id: user.uid,
                    name: user.email.split('@')[0], // Use email username as name
                    email: user.email,
                    avatar: null // No avatar for email login
                };
                
                // Load user info and tasks
                loadUserInfo();
                loadTasks().catch(error => {
                    console.error("Error loading tasks:", error);
                    forceHideLoading(); // Ensure loading is hidden if task loading fails
                });
                showApp();
                forceHideLoading(); // Ensure loading overlay is hidden after successful login
            } else {
                // User is signed out
                currentUser = null;
                tasks = [];
                forceHideLoading(); // Always hide loading when showing login screen
                showLogin();
            }
        } catch (error) {
            console.error("Auth state change error:", error);
            forceHideLoading(); // Ensure loading is hidden even if there's an error
            showError('Authentication error: ' + error.message);
        }
    });
    
    // Set up event listeners
    emailLoginButtonEl.addEventListener('click', signInWithEmail);
    logoutButtonEl.addEventListener('click', signOut);
    
    // Set up other UI event listeners
    setupUIEventListeners();
    
    // Safety timeout to ensure loading never gets stuck
    setTimeout(() => {
        forceHideLoading();
    }, 5000); // Reduced to 5 seconds for better UX
}

// Sign in with Email
function signInWithEmail() {
    const email = prompt('Enter your email:');
    const password = prompt('Enter your password:');
    
    if (email && password) {
        showLoading();
        
        // Clear any existing timeout
        if (loadingTimeoutId) {
            clearTimeout(loadingTimeoutId);
        }
        
        // Try to sign in
        auth.signInWithEmailAndPassword(email, password)
            .then(() => {
                // Success case is handled by auth state listener
                // But we should still hide loading here as a backup
                loadingTimeoutId = setTimeout(() => forceHideLoading(), 1000); // Reduced timeout
            })
            .catch(error => {
                forceHideLoading(); // Hide loading on error
                showError('Error signing in: ' + error.message);
            });
    }
}

// Sign out
function signOut() {
    showLoading(); // Show loading during sign out process
    
    // Clear any existing timeout
    if (loadingTimeoutId) {
        clearTimeout(loadingTimeoutId);
    }
    
    auth.signOut()
        .then(() => {
            // Success is handled by auth state listener, but add backup
            loadingTimeoutId = setTimeout(() => forceHideLoading(), 500); // Reduced timeout
        })
        .catch(error => {
            forceHideLoading(); // Hide loading if error occurs
            showError('Error signing out: ' + error.message);
        });
}

// Load user information
function loadUserInfo() {
    // Update UI with user info
    userNameEl.textContent = currentUser.name;
    userEmailEl.textContent = currentUser.email;
    
    // Use default avatar (no custom avatars for email login)
}

// Force hide loading - a more robust version of hideLoading
function forceHideLoading() {
    // Cancel any existing loading timeout
    if (loadingTimeoutId) {
        clearTimeout(loadingTimeoutId);
        loadingTimeoutId = null;
    }
    
    // Directly manipulate the DOM element for maximum reliability
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
        loadingOverlay.classList.add('hidden');
    }
    
    // Also call the regular function for consistency
    hideLoading();
}