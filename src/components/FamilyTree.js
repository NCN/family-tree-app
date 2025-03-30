// src/components/FamilyTree.js
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

function FamilyTree({ user, db }) {
    const [familyData, setFamilyData] = useState([]);
    const [relationships, setRelationships] = useState([]);
    const [loading, setLoading] = useState(true);
    const [zoomLevel, setZoomLevel] = useState(1);
    const treeContainer = useRef(null);
    const svgRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchFamilyData = async () => {
            try {
                // Fetch family data from Firestore
                const snapshot = await db.collection('familyMembers')
                    .where('userId', '==', user.uid)
                    .get();

                let members = [];
                snapshot.forEach(doc => {
                    members.push({ id: doc.id, ...doc.data() });
                });

                // Fetch relationships
                const relSnapshot = await db.collection('relationships')
                    .where('userId', '==', user.uid)
                    .get();

                let rels = [];
                relSnapshot.forEach(doc => {
                    rels.push({ id: doc.id, ...doc.data() });
                });

                setFamilyData(members);
                setRelationships(rels);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching family data:", error);
                setLoading(false);
            }
        };

        fetchFamilyData();
    }, [db, user]);

    useEffect(() => {
        if (!loading && familyData.length > 0 && svgRef.current) {
            renderTree();
        }
    }, [familyData, relationships, loading, zoomLevel]);

    const formatName = (person) => {
        if (!person) return "Unknown";
        const firstName = person.firstName || "";
        const middleName = person.middleName ? ` ${person.middleName}` : "";
        const lastName = person.lastName || "";
        return `${firstName}${middleName} ${lastName}`.trim();
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "";
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        } catch (e) {
            return dateStr;
        }
    };

    const findSpouses = (personId) => {
        return relationships
            .filter(rel =>
                rel.type === 'spouse' &&
                (rel.personId === personId || rel.relatedPersonId === personId)
            )
            .map(rel => {
                const spouseId = rel.personId === personId ? rel.relatedPersonId : rel.personId;
                return familyData.find(person => person.id === spouseId);
            })
            .filter(Boolean); // Remove any undefined results
    };

    const findChildren = (personId, spouseId = null) => {
        let childRelationships = relationships.filter(rel =>
            rel.type === 'parent' && rel.personId === personId
        );

        // If spouseId is provided, only include children that are also children of the spouse
        if (spouseId) {
            const spouseChildrenIds = relationships
                .filter(rel => rel.type === 'parent' && rel.personId === spouseId)
                .map(rel => rel.relatedPersonId);

            childRelationships = childRelationships.filter(rel =>
                spouseChildrenIds.includes(rel.relatedPersonId)
            );
        }

        return childRelationships
            .map(rel => familyData.find(person => person.id === rel.relatedPersonId))
            .filter(Boolean);
    };

    const findParents = (personId) => {
        return relationships
            .filter(rel => rel.type === 'child' && rel.personId === personId)
            .map(rel => familyData.find(person => person.id === rel.relatedPersonId))
            .filter(Boolean);
    };

    const renderTree = () => {
        // Clear previous rendering
        d3.select(svgRef.current).selectAll("*").remove();

        const margin = { top: 50, right: 90, bottom: 30, left: 90 };
        const width = 1200 - margin.left - margin.right;
        const height = 900 - margin.top - margin.bottom;

        // Create SVG
        const svg = d3.select(svgRef.current)
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .call(d3.zoom().on("zoom", (event) => {
                g.attr("transform", event.transform);
            }))
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top}) scale(${zoomLevel})`);

        const g = svg.append("g");

        // Find the root person (someone without parents or arbitrarily choose the first person)
        let rootPerson;
        const peopleWithoutParents = familyData.filter(person =>
            !relationships.some(rel => rel.type === 'child' && rel.personId === person.id)
        );

        if (peopleWithoutParents.length > 0) {
            rootPerson = peopleWithoutParents[0];
        } else if (familyData.length > 0) {
            rootPerson = familyData[0];
        } else {
            // No data available
            return;
        }

        // Box dimensions
        const boxWidth = 120;
        const boxHeight = 60;
        const boxMargin = 10;
        const levelHeight = 100;

        // Recursively render a person and their descendants
        const renderPerson = (person, x, y, level = 0) => {
            if (!person) return 0;

            // Person's box
            const nameText = formatName(person);
            const birthText = person.birthDate ? `b. ${formatDate(person.birthDate)}` : '';
            const deathText = person.deathDate ? `d. ${formatDate(person.deathDate)}` : '';

            // Draw person box
            const personGroup = g.append("g")
                .attr("transform", `translate(${x}, ${y})`)
                .style("cursor", "pointer")
                .on("click", () => {
                    navigate(`/person/${person.id}`);
                });

            personGroup.append("rect")
                .attr("width", boxWidth)
                .attr("height", boxHeight)
                .attr("x", -boxWidth / 2)
                .attr("y", -boxHeight / 2)
                .attr("rx", 5)
                .attr("ry", 5)
                .style("fill", "#f0f8ff")
                .style("stroke", "#4285f4")
                .style("stroke-width", 2);

            personGroup.append("text")
                .attr("text-anchor", "middle")
                .attr("y", -10)
                .style("font-size", "12px")
                .style("font-weight", "bold")
                .text(nameText.length > 15 ? nameText.substring(0, 13) + "..." : nameText);

            personGroup.append("text")
                .attr("text-anchor", "middle")
                .attr("y", 10)
                .style("font-size", "10px")
                .text(birthText);

            personGroup.append("text")
                .attr("text-anchor", "middle")
                .attr("y", 25)
                .style("font-size", "10px")
                .text(deathText);

            // Find spouses
            const spouses = findSpouses(person.id);
            let totalWidth = 0;
            let spouseX = x + boxWidth + boxMargin;

            // Render spouses horizontally next to the person
            spouses.forEach((spouse, index) => {
                // Draw line connecting spouse
                g.append("path")
                    .attr("d", `M ${x + boxWidth / 2} ${y} H ${spouseX - boxWidth / 2}`)
                    .style("fill", "none")
                    .style("stroke", "#666")
                    .style("stroke-width", 1);

                // Render spouse
                renderPerson(spouse, spouseX, y, level);

                // Find children with this spouse
                const children = findChildren(person.id, spouse.id);
                const childrenCount = children.length;

                if (childrenCount > 0) {
                    const childrenTotalWidth = childrenCount * (boxWidth + boxMargin);
                    const childrenStartX = spouseX - (childrenTotalWidth / 2) + (boxWidth / 2);

                    // Draw vertical line down from between parents
                    const midX = x + (spouseX - x) / 2;
                    g.append("path")
                        .attr("d", `M ${midX} ${y + boxHeight / 2} V ${y + levelHeight / 2}`)
                        .style("fill", "none")
                        .style("stroke", "#666")
                        .style("stroke-width", 1);

                    // Draw horizontal line connecting all children
                    g.append("path")
                        .attr("d", `M ${childrenStartX} ${y + levelHeight / 2} H ${childrenStartX + childrenTotalWidth - boxWidth}`)
                        .style("fill", "none")
                        .style("stroke", "#666")
                        .style("stroke-width", 1);

                    // Render children
                    children.forEach((child, childIndex) => {
                        const childX = childrenStartX + childIndex * (boxWidth + boxMargin);

                        // Draw vertical line to child
                        g.append("path")
                            .attr("d", `M ${childX} ${y + levelHeight / 2} V ${y + levelHeight - boxHeight / 2}`)
                            .style("fill", "none")
                            .style("stroke", "#666")
                            .style("stroke-width", 1);

                        // Recursively render the child and their descendants
                        renderPerson(child, childX, y + levelHeight, level + 1);
                    });
                }

                spouseX += boxWidth + boxMargin;
                totalWidth += boxWidth + boxMargin;
            });

            // If no spouses, still check for children
            if (spouses.length === 0) {
                const children = findChildren(person.id);
                const childrenCount = children.length;

                if (childrenCount > 0) {
                    const childrenTotalWidth = childrenCount * (boxWidth + boxMargin);
                    const childrenStartX = x - (childrenTotalWidth / 2) + (boxWidth / 2);

                    // Draw vertical line down from parent
                    g.append("path")
                        .attr("d", `M ${x} ${y + boxHeight / 2} V ${y + levelHeight / 2}`)
                        .style("fill", "none")
                        .style("stroke", "#666")
                        .style("stroke-width", 1);

                    // Draw horizontal line connecting all children
                    g.append("path")
                        .attr("d", `M ${childrenStartX} ${y + levelHeight / 2} H ${childrenStartX + childrenTotalWidth - boxWidth}`)
                        .style("fill", "none")
                        .style("stroke", "#666")
                        .style("stroke-width", 1);

                    // Render children
                    children.forEach((child, childIndex) => {
                        const childX = childrenStartX + childIndex * (boxWidth + boxMargin);

                        // Draw vertical line to child
                        g.append("path")
                            .attr("d", `M ${childX} ${y + levelHeight / 2} V ${y + levelHeight - boxHeight / 2}`)
                            .style("fill", "none")
                            .style("stroke", "#666")
                            .style("stroke-width", 1);

                        // Recursively render the child and their descendants
                        renderPerson(child, childX, y + levelHeight, level + 1);
                    });
                }
            }

            return totalWidth;
        };

        // Start rendering from the root person
        renderPerson(rootPerson, width / 2, 50);
    };

    const handleZoomIn = () => {
        setZoomLevel(prevZoom => prevZoom * 1.2);
    };

    const handleZoomOut = () => {
        setZoomLevel(prevZoom => prevZoom / 1.2);
    };

    const handleResetZoom = () => {
        setZoomLevel(1);
    };

    const exportToPDF = async () => {
        const input = treeContainer.current;

        try {
            const canvas = await html2canvas(input);
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('landscape', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const imgX = (pdfWidth - imgWidth * ratio) / 2;
            const imgY = 30;

            pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
            pdf.save('family-tree.pdf');
        } catch (error) {
            console.error("Error exporting to PDF:", error);
            alert("Failed to export to PDF. Please try again.");
        }
    };

    if (loading) {
        return <div className="loading">Loading family tree...</div>;
    }

    return (
        <div className="family-tree-container">
            <header>
                <h1>Family Tree</h1>
                <div className="actions">
                    <Link to="/" className="btn">Back to Home</Link>
                    <Link to="/person" className="btn primary">Add Family Member</Link>
                    <Link to="/members" className="btn secondary">View All Members</Link>
                </div>
            </header>

            <div className="controls">
                <button onClick={handleZoomIn}>Zoom In</button>
                <button onClick={handleZoomOut}>Zoom Out</button>
                <button onClick={handleResetZoom}>Reset</button>
                <button onClick={exportToPDF}>Export to PDF</button>
            </div>

            <div className="tree-view" ref={treeContainer}>
                <svg ref={svgRef}></svg>
            </div>
        </div>
    );
}

export default FamilyTree;