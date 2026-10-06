// ==========================================
// CloudDrive - Firebase Authentication
// ==========================================


// Load Firebase App first, then Firebase Auth
function loadScript(src) {
    return new Promise((resolve, reject) => {

        const script = document.createElement("script");

        script.src = src;

        script.onload = resolve;

        script.onerror = reject;

        document.head.appendChild(script);
    });
}


// ==========================================
// Start Firebase
// ==========================================

async function startFirebase() {

    try {

        // Load Firebase App
        await loadScript(
            "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js"
        );

        // Load Firebase Authentication
        await loadScript(
            "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth-compat.js"
        );


        // ==========================================
        // YOUR FIREBASE CONFIG
        // ==========================================

        const firebaseConfig = {

            apiKey: "AIzaSyC8Yf9bHtc0wggz3RdoDJoLVocuUN_daVM",

            authDomain: "clouddrive-8ff34.firebaseapp.com",

            projectId: "clouddrive-8ff34",

            storageBucket: "clouddrive-8ff34.firebasestorage.app",

            messagingSenderId: "681543855526",

            appId: "1:681543855526:web:430f85a7d0759ccf2ab367",

            measurementId: "G-V4M3EFB4B6"
        };


        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);


        // Firebase Authentication
        const auth = firebase.auth();


        // ==========================================
        // GET HTML ELEMENTS
        // ==========================================

        const signupPanel =
            document.getElementById("signupPanel");

        const loginPanel =
            document.getElementById("loginPanel");

        const signupForm =
            document.getElementById("signupForm");

        const loginForm =
            document.getElementById("loginForm");

        const showLogin =
            document.getElementById("showLogin");

        const showSignup =
            document.getElementById("showSignup");

        const message =
            document.getElementById("message");


        // ==========================================
        // SHOW LOGIN
        // ==========================================

        showLogin.addEventListener("click", function(event) {

            event.preventDefault();

            signupPanel.classList.add("hidden");

            loginPanel.classList.remove("hidden");

            message.textContent = "";

        });


        // ==========================================
        // SHOW SIGN UP
        // ==========================================

        showSignup.addEventListener("click", function(event) {

            event.preventDefault();

            loginPanel.classList.add("hidden");

            signupPanel.classList.remove("hidden");

            message.textContent = "";

        });


        // ==========================================
        // SIGN UP
        // ==========================================

        signupForm.addEventListener("submit", async function(event) {

            event.preventDefault();


            const email =
                document.getElementById("signupEmail")
                .value
                .trim();


            const password =
                document.getElementById("signupPassword")
                .value;


            const confirmPassword =
                document.getElementById("confirmPassword")
                .value;


            // Check passwords
            if (password !== confirmPassword) {

                message.textContent =
                    "Passwords do not match.";

                return;
            }


            // Check password length
            if (password.length < 6) {

                message.textContent =
                    "Password must be at least 6 characters.";

                return;
            }


            message.textContent =
                "Creating your account...";


            try {

                // Create Firebase account
                await auth.createUserWithEmailAndPassword(
                    email,
                    password
                );


                message.textContent =
                    "Account created successfully!";


                // Clear signup fields
                document.getElementById("signupEmail").value = "";

                document.getElementById("signupPassword").value = "";

                document.getElementById("confirmPassword").value = "";


                // Move to Login after 1 second
                setTimeout(function() {

                    signupPanel.classList.add("hidden");

                    loginPanel.classList.remove("hidden");

                    document.getElementById("email").value =
                        email;

                    document.getElementById("password").value =
                        "";

                    message.textContent =
                        "Account created. Please login.";

                }, 1000);


            } catch (error) {

                console.error(error);


                if (
                    error.code ===
                    "auth/email-already-in-use"
                ) {

                    message.textContent =
                        "This email is already registered.";

                }

                else if (
                    error.code ===
                    "auth/invalid-email"
                ) {

                    message.textContent =
                        "Please enter a valid email address.";

                }

                else if (
                    error.code ===
                    "auth/weak-password"
                ) {

                    message.textContent =
                        "Password must be at least 6 characters.";

                }

                else {

                    message.textContent =
                        "Firebase Error: " + error.message;

                }

            }

        });


        // ==========================================
        // LOGIN
        // ==========================================

        loginForm.addEventListener("submit", async function(event) {

            event.preventDefault();


            const email =
                document.getElementById("email")
                .value
                .trim();


            const password =
                document.getElementById("password")
                .value;


            message.textContent =
                "Logging in...";


            try {

                // Firebase login
                await auth.signInWithEmailAndPassword(
                    email,
                    password
                );


                message.textContent =
                    "Login successful!";


                // Go to dashboard
                setTimeout(function() {

                    window.location.href =
                        "dashboard.html";

                }, 800);


            } catch (error) {

                console.error(error);


                if (
                    error.code ===
                    "auth/invalid-credential"
                ) {

                    message.textContent =
                        "Invalid email or password.";

                }

                else if (
                    error.code ===
                    "auth/user-not-found"
                ) {

                    message.textContent =
                        "No account found with this email.";

                }

                else if (
                    error.code ===
                    "auth/wrong-password"
                ) {

                    message.textContent =
                        "Incorrect password.";

                }

                else {

                    message.textContent =
                        "Firebase Error: " + error.message;

                }

            }

        });


    } catch (error) {

        console.error(
            "Firebase failed to load:",
            error
        );


        message.textContent =
            "Firebase could not be loaded.";

    }

}


// Start Firebase
startFirebase();