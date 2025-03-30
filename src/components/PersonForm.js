// src/components/PersonForm.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import firebase from 'firebase/compat/app';

function PersonForm({ user, db }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = !!id;

    const [formData, setFormData] = useState({
        firstName: '',
        middleName: '', // Added middle name field
        lastName: '',
        birthDate: '',
        deathDate: '',
        gender: '',
        bio: '',
        relationships: []
    });

    const [familyMembers, setFamilyMembers] = useState([]);
    const [loading, setLoading] = useState(isEditing);
    const [relationshipType, setRelationshipType] = useState('');
    const [relatedPersonId, setRelatedPersonId] = useState('');

    useEffect(() => {
        // Fetch all family members for relationship selection
        const fetchFamilyMembers = async () => {
            try {
                const snapshot = await db.collection('familyMembers')
                    .where('userId', '==', user.uid)
                    .get();

                let members = [];
                snapshot.forEach(doc => {
                    if (doc.id !== id) { // Exclude current person if editing
                        members.push({ id: doc.id, ...doc.data() });
                    }
                });

                setFamilyMembers(members);
            } catch (error) {
                console.error("Error fetching family members:", error);
            }
        };

        fetchFamilyMembers();

        // If editing, fetch person data and their relationships
        if (isEditing) {
            const fetchPerson = async () => {
                try {
                    const doc = await db.collection('familyMembers').doc(id).get();

                    if (doc.exists) {
                        const personData = doc.data();
                        setFormData(prev => ({
                            ...prev,
                            ...personData,
                            relationships: [] // Initialize with empty array, will populate below
                        }));

                        // Fetch relationships
                        const relSnapshot = await db.collection('relationships')
                            .where('userId', '==', user.uid)
                            .where('personId', '==', id)
                            .get();

                        let relationships = [];
                        relSnapshot.forEach(relDoc => {
                            relationships.push({
                                id: relDoc.id,
                                ...relDoc.data()
                            });
                        });

                        console.log("Fetched relationships:", relationships);

                        setFormData(prev => ({
                            ...prev,
                            relationships
                        }));
                    } else {
                        alert("Person not found!");
                        navigate('/');
                    }

                    setLoading(false);
                } catch (error) {
                    console.error("Error fetching person:", error);
                    setLoading(false);
                }
            };

            fetchPerson();
        }
    }, [db, id, isEditing, navigate, user.uid]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Get the opposite relationship type for bi-directional relationships
    const getOppositeRelationship = (type) => {
        switch (type) {
            case 'parent': return 'child';
            case 'child': return 'parent';
            case 'spouse': return 'spouse';
            case 'sibling': return 'sibling';
            default: return '';
        }
    };

    const addRelationship = () => {
        if (!relationshipType || !relatedPersonId) return;

        // Check if this relationship already exists
        const existingRelationship = formData.relationships.find(
            rel => rel.relatedPersonId === relatedPersonId && rel.type === relationshipType
        );

        if (existingRelationship) {
            alert("This relationship already exists.");
            return;
        }

        const newRelationship = {
            type: relationshipType,
            relatedPersonId,
            tempId: Date.now() // Used for UI purposes only
        };

        setFormData(prev => ({
            ...prev,
            relationships: [...prev.relationships, newRelationship]
        }));

        setRelationshipType('');
        setRelatedPersonId('');
    };

    const removeRelationship = (index) => {
        setFormData(prev => ({
            ...prev,
            relationships: prev.relationships.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const personData = {
                ...formData,
                userId: user.uid,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Don't store relationships in the person document
            const { relationships, ...personDataWithoutRelationships } = personData;

            let personId;

            if (isEditing) {
                await db.collection('familyMembers').doc(id).update(personDataWithoutRelationships);
                personId = id;
            } else {
                personDataWithoutRelationships.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                const docRef = await db.collection('familyMembers').add(personDataWithoutRelationships);
                personId = docRef.id;
            }

            // Handle relationships
            const batch = db.batch();

            // First, clear all existing relationships for this person
            if (isEditing) {
                const relSnapshot = await db.collection('relationships')
                    .where('userId', '==', user.uid)
                    .where('personId', '==', personId)
                    .get();

                relSnapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });

                // Also delete inverse relationships (where this person is the related person)
                const inverseRelSnapshot = await db.collection('relationships')
                    .where('userId', '==', user.uid)
                    .where('relatedPersonId', '==', personId)
                    .get();

                inverseRelSnapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
            }

            // Add new relationships (both directions)
            relationships.forEach(rel => {
                // This person's relationship
                const relData = {
                    userId: user.uid,
                    personId: personId,
                    relatedPersonId: rel.relatedPersonId,
                    type: rel.type,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                const relRef = db.collection('relationships').doc();
                batch.set(relRef, relData);

                // Add the inverse relationship for the related person
                const oppositeType = getOppositeRelationship(rel.type);
                const inverseRelData = {
                    userId: user.uid,
                    personId: rel.relatedPersonId,
                    relatedPersonId: personId,
                    type: oppositeType,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                const inverseRelRef = db.collection('relationships').doc();
                batch.set(inverseRelRef, inverseRelData);
            });

            await batch.commit();

            navigate('/tree');
        } catch (error) {
            console.error("Error saving person:", error);
            alert("Failed to save person. Please try again.");
        }
    };

    // Helper function to get person name from ID
    const getPersonName = (personId) => {
        const person = familyMembers.find(p => p.id === personId);
        if (!person) return 'Unknown Person';

        // Include middle name if available
        const middleName = person.middleName ? ` ${person.middleName}` : '';
        return `${person.firstName || ''}${middleName} ${person.lastName || ''}`.trim();
    };

    if (loading) {
        return <div className="loading">Loading...</div>;
    }

    return (
        <div className="person-form-container">
            <header>
                <h1>{isEditing ? 'Edit Family Member' : 'Add Family Member'}</h1>
                <Link to="/tree" className="btn">Back to Tree</Link>
            </header>

            <form onSubmit={handleSubmit} className="person-form">
                <div className="form-group">
                    <label htmlFor="firstName">First Name</label>
                    <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        value={formData.firstName || ''}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="middleName">Middle Name</label>
                    <input
                        type="text"
                        id="middleName"
                        name="middleName"
                        value={formData.middleName || ''}
                        onChange={handleChange}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="lastName">Last Name</label>
                    <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={formData.lastName || ''}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="gender">Gender</label>
                    <select
                        id="gender"
                        name="gender"
                        value={formData.gender || ''}
                        onChange={handleChange}
                        required
                    >
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                    </select>
                </div>

                <div className="form-group">
                    <label htmlFor="birthDate">Birth Date</label>
                    <input
                        type="date"
                        id="birthDate"
                        name="birthDate"
                        value={formData.birthDate || ''}
                        onChange={handleChange}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="deathDate">Death Date (if applicable)</label>
                    <input
                        type="date"
                        id="deathDate"
                        name="deathDate"
                        value={formData.deathDate || ''}
                        onChange={handleChange}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="bio">Biography/Notes</label>
                    <textarea
                        id="bio"
                        name="bio"
                        value={formData.bio || ''}
                        onChange={handleChange}
                        rows="4"
                    ></textarea>
                </div>

                <div className="relationships-section">
                    <h3>Relationships</h3>

                    <div className="add-relationship">
                        <select
                            value={relationshipType}
                            onChange={(e) => setRelationshipType(e.target.value)}
                        >
                            <option value="">Select relationship type</option>
                            <option value="parent">Parent</option>
                            <option value="child">Child</option>
                            <option value="spouse">Spouse</option>
                            <option value="sibling">Sibling</option>
                        </select>

                        <select
                            value={relatedPersonId}
                            onChange={(e) => setRelatedPersonId(e.target.value)}
                        >
                            <option value="">Select person</option>
                            {familyMembers.map(person => (
                                <option key={person.id} value={person.id}>
                                    {person.firstName} {person.middleName ? person.middleName + ' ' : ''}{person.lastName}
                                </option>
                            ))}
                        </select>

                        <button type="button" onClick={addRelationship}>Add</button>
                    </div>

                    <div className="relationships-list">
                        {formData.relationships && formData.relationships.length > 0 ? (
                            formData.relationships.map((rel, index) => (
                                <div key={rel.id || rel.tempId} className="relationship-item">
                                    <span>
                                        {rel.type.charAt(0).toUpperCase() + rel.type.slice(1)} of{' '}
                                        {getPersonName(rel.relatedPersonId)}
                                    </span>
                                    <button type="button" onClick={() => removeRelationship(index)}>
                                        Remove
                                    </button>
                                </div>
                            ))
                        ) : (
                            <p>No relationships added yet.</p>
                        )}
                    </div>
                </div>

                <div className="form-actions">
                    <button type="submit" className="btn primary">
                        {isEditing ? 'Update' : 'Add'} Family Member
                    </button>
                    <Link to="/tree" className="btn">Cancel</Link>
                </div>
            </form>
        </div>
    );
}

export default PersonForm;