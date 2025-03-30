// src/components/MembersList.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function MembersList({ user, db }) {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('lastName');
    const [sortDirection, setSortDirection] = useState('asc');
    const navigate = useNavigate();

    useEffect(() => {
        fetchMembers();
    }, [db, user]);

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const snapshot = await db.collection('familyMembers')
                .where('userId', '==', user.uid)
                .get();

            let membersList = [];
            snapshot.forEach(doc => {
                membersList.push({ id: doc.id, ...doc.data() });
            });

            setMembers(membersList);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching members:", error);
            setLoading(false);
        }
    };

    const handleEdit = (id) => {
        navigate(`/person/${id}`);
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this family member? This action cannot be undone.")) {
            try {
                // Delete the person document
                await db.collection('familyMembers').doc(id).delete();

                // Delete associated relationships
                const relSnapshot = await db.collection('relationships')
                    .where('userId', '==', user.uid)
                    .where('personId', '==', id)
                    .get();

                const batch = db.batch();
                relSnapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });

                // Also delete relationships where this person is the related person
                const relatedSnapshot = await db.collection('relationships')
                    .where('userId', '==', user.uid)
                    .where('relatedPersonId', '==', id)
                    .get();

                relatedSnapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });

                await batch.commit();

                // Refresh the list
                fetchMembers();
            } catch (error) {
                console.error("Error deleting family member:", error);
                alert("Failed to delete family member. Please try again.");
            }
        }
    };

    const handleSort = (field) => {
        if (sortBy === field) {
            // Toggle direction if clicking the same field
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // New field, default to ascending
            setSortBy(field);
            setSortDirection('asc');
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "";
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString();
        } catch (e) {
            return dateStr;
        }
    };

    // Filter and sort members
    const filteredAndSortedMembers = members
        .filter(member => {
            const fullName = `${member.firstName || ''} ${member.lastName || ''}`.toLowerCase();
            return fullName.includes(searchTerm.toLowerCase());
        })
        .sort((a, b) => {
            let aValue = a[sortBy] || '';
            let bValue = b[sortBy] || '';

            // Special handling for dates
            if (sortBy === 'birthDate' || sortBy === 'deathDate') {
                aValue = aValue ? new Date(aValue) : new Date(0);
                bValue = bValue ? new Date(bValue) : new Date(0);
            } else {
                aValue = typeof aValue === 'string' ? aValue.toLowerCase() : aValue;
                bValue = typeof bValue === 'string' ? bValue.toLowerCase() : bValue;
            }

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

    if (loading) {
        return <div className="loading">Loading family members...</div>;
    }

    return (
        <div className="members-list-container">
            <header>
                <h1>Family Members</h1>
                <div className="actions">
                    <Link to="/" className="btn">Back to Home</Link>
                    <Link to="/person" className="btn primary">Add Family Member</Link>
                </div>
            </header>

            <div className="search-bar">
                <input
                    type="text"
                    placeholder="Search by name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {members.length === 0 ? (
                <div className="empty-state">
                    <p>No family members added yet. Click "Add Family Member" to get started.</p>
                </div>
            ) : (
                <table className="members-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('firstName')}>
                                First Name
                                {sortBy === 'firstName' && (
                                    <span className="sort-indicator">
                                        {sortDirection === 'asc' ? ' ↑' : ' ↓'}
                                    </span>
                                )}
                            </th>
                            <th onClick={() => handleSort('lastName')}>
                                Last Name
                                {sortBy === 'lastName' && (
                                    <span className="sort-indicator">
                                        {sortDirection === 'asc' ? ' ↑' : ' ↓'}
                                    </span>
                                )}
                            </th>
                            <th onClick={() => handleSort('birthDate')}>
                                Birth Date
                                {sortBy === 'birthDate' && (
                                    <span className="sort-indicator">
                                        {sortDirection === 'asc' ? ' ↑' : ' ↓'}
                                    </span>
                                )}
                            </th>
                            <th onClick={() => handleSort('deathDate')}>
                                Death Date
                                {sortBy === 'deathDate' && (
                                    <span className="sort-indicator">
                                        {sortDirection === 'asc' ? ' ↑' : ' ↓'}
                                    </span>
                                )}
                            </th>
                            <th onClick={() => handleSort('gender')}>
                                Gender
                                {sortBy === 'gender' && (
                                    <span className="sort-indicator">
                                        {sortDirection === 'asc' ? ' ↑' : ' ↓'}
                                    </span>
                                )}
                            </th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAndSortedMembers.map(member => (
                            <tr key={member.id}>
                                <td>{member.firstName || ''}</td>
                                <td>{member.lastName || ''}</td>
                                <td>{formatDate(member.birthDate)}</td>
                                <td>{formatDate(member.deathDate)}</td>
                                <td>{member.gender || ''}</td>
                                <td className="actions-cell">
                                    <button
                                        className="edit-btn"
                                        onClick={() => handleEdit(member.id)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        className="delete-btn"
                                        onClick={() => handleDelete(member.id)}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

export default MembersList;