// src/components/Home.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function Home({ user, auth, db }) {
    const [familyCount, setFamilyCount] = useState(0);
    const [lastEdited, setLastEdited] = useState(null);

    const signOut = () => {
        auth.signOut();
    };

    useEffect(() => {
        // Here you would typically fetch summary data about the family tree
        // For example, count of people, last edited time, etc.
        const fetchSummaryData = async () => {
            try {
                // Get actual count of family members
                const snapshot = await db.collection('familyMembers')
                    .where('userId', '==', user.uid)
                    .get();

                setFamilyCount(snapshot.size);

                // Get last edit time
                if (snapshot.size > 0) {
                    const sortedMembers = snapshot.docs
                        .map(doc => doc.data())
                        .filter(member => member.updatedAt)
                        .sort((a, b) => b.updatedAt.toDate() - a.updatedAt.toDate());

                    if (sortedMembers.length > 0 && sortedMembers[0].updatedAt) {
                        setLastEdited(sortedMembers[0].updatedAt.toDate().toLocaleString());
                    }
                }
            } catch (error) {
                console.error("Error fetching family data:", error);
            }
        };

        fetchSummaryData();
    }, [user, db]);

    return (
        <div className="home-container">
            <header>
                <h1>Family Tree</h1>
                <div className="user-info">
                    <span>Hello, {user.displayName}</span>
                    <button onClick={signOut}>Sign Out</button>
                </div>
            </header>

            <div className="dashboard">
                <div className="summary-card">
                    <h2>Your Family Tree</h2>
                    <p>{familyCount} family members</p>
                    {lastEdited && <p>Last edited: {lastEdited}</p>}
                </div>

                <div className="action-buttons">
                    <Link to="/tree" className="btn primary">
                        View Family Tree
                    </Link>
                    <Link to="/person" className="btn secondary">
                        Add Family Member
                    </Link>
                    <Link to="/members" className="btn secondary">
                        Manage Members
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default Home;