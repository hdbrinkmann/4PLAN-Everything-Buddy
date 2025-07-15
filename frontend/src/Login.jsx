import React from 'react';
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "./authConfig";
import './Login.css';

function Login() {
    const { instance } = useMsal();

    const handleLogin = () => {
        instance.loginRedirect(loginRequest).catch(e => {
            console.error(e);
        });
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <img src="/S4ULogo.png" alt="S4U Logo" className="login-logo" />
                <h1>Welcome to the 4PLAN Everything Buddy</h1>
                <p>Please sign in to continue</p>
                <button onClick={handleLogin} className="login-button">
                    Sign In with Microsoft
                </button>
            </div>
        </div>
    );
}

export default Login;
