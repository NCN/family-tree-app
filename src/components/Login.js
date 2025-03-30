// src/components/Login.js
import React from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

function Login({ auth }) {
    const signInWithGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error signing in with Google:", error);
            alert("Failed to sign in with Google. Please try again.");
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h1>Family Tree</h1>
                <p>Preserve your family history in one place</p>
                <button className="google-btn" onClick={signInWithGoogle}>
                    Sign in with Google
                </button>
            </div>
        </div>
    );
}

export default Login;