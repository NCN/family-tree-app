// src/App.js
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import Login from './components/Login';
import Home from './components/Home';
import FamilyTree from './components/FamilyTree';
import PersonForm from './components/PersonForm';
import MembersList from './components/MembersList';
import './App.css';

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD-uFAtUTtqm93XB8q6hx50dPkIdqhBbvM",
  authDomain: "geneology-app.firebaseapp.com",
  projectId: "geneology-app",
  storageBucket: "geneology-app.firebasestorage.app",
  messagingSenderId: "197073150075",
  appId: "1:197073150075:web:094846bb91d3ad1f5b82de",
  measurementId: "G-GPGCNJ5MEE"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((authUser) => {
      if (authUser) {
        setUser(authUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <Router>
      <div className="app">
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to="/" /> : <Login auth={auth} />}
          />
          <Route
            path="/"
            element={user ? <Home user={user} auth={auth} db={db} /> : <Navigate to="/login" />}
          />
          <Route
            path="/tree"
            element={user ? <FamilyTree user={user} db={db} /> : <Navigate to="/login" />}
          />
          <Route
            path="/person/:id?"
            element={user ? <PersonForm user={user} db={db} /> : <Navigate to="/login" />}
          />
          <Route
            path="/members"
            element={user ? <MembersList user={user} db={db} /> : <Navigate to="/login" />}
          />
          {/* Add a fallback route */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;