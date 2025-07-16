import React, { useState, useEffect } from 'react';
import './HistoryPanel.css';

const HistoryPanel = ({ isOpen, onClose, onSelectHistory, token }) => {
    const [chatHistories, setChatHistories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen && token) {
            fetchChatHistories();
        }
    }, [isOpen, token]);

    const fetchChatHistories = async () => {
        setLoading(true);
        setError(null);
        try {
            // Determine the correct API URL based on the current location
            const apiUrl = window.location.protocol === 'https:' && window.location.port === '' 
                ? `${window.location.protocol}//${window.location.hostname}/chat_history/`
                : 'http://localhost:8002/chat_history/';
                
            const response = await fetch(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch chat histories');
            }

            const data = await response.json();
            setChatHistories(data);
        } catch (error) {
            console.error('Error fetching chat histories:', error);
            setError('Failed to load chat histories');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectHistory = async (historyId) => {
        try {
            setLoading(true);
            // Determine the correct API URL based on the current location
            const baseUrl = window.location.protocol === 'https:' && window.location.port === '' 
                ? `${window.location.protocol}//${window.location.hostname}`
                : 'http://localhost:8002';
                
            const response = await fetch(`${baseUrl}/chat_history/${historyId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch chat history details');
            }

            const historyData = await response.json();
            onSelectHistory(historyData);
            onClose();
        } catch (error) {
            console.error('Error loading chat history:', error);
            setError('Failed to load chat history');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteHistory = async (historyId, event) => {
        event.stopPropagation(); // Prevent triggering the select event
        
        if (!window.confirm('Are you sure you want to delete this chat history?')) {
            return;
        }

        try {
            // Determine the correct API URL based on the current location
            const baseUrl = window.location.protocol === 'https:' && window.location.port === '' 
                ? `${window.location.protocol}//${window.location.hostname}`
                : 'http://localhost:8002';
                
            const response = await fetch(`${baseUrl}/chat_history/${historyId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to delete chat history');
            }

            // Remove from local state
            setChatHistories(prev => prev.filter(chat => chat.id !== historyId));
        } catch (error) {
            console.error('Error deleting chat history:', error);
            setError('Failed to delete chat history');
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = (now - date) / (1000 * 60 * 60);

        if (diffInHours < 1) {
            return 'Just now';
        } else if (diffInHours < 24) {
            return `${Math.floor(diffInHours)} hours ago`;
        } else if (diffInHours < 48) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="history-panel-overlay" onClick={onClose}>
            <div className="history-panel" onClick={e => e.stopPropagation()}>
                <div className="history-panel-header">
                    <h3>Chat History</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                
                <div className="history-panel-content">
                    {loading && <div className="loading">Loading chat histories...</div>}
                    
                    {error && <div className="error">{error}</div>}
                    
                    {!loading && !error && chatHistories.length === 0 && (
                        <div className="no-histories">
                            <p>No chat histories found.</p>
                            <p className="hint">Only text-based chats without files or generated content can be saved.</p>
                        </div>
                    )}
                    
                    {!loading && !error && chatHistories.length > 0 && (
                        <div className="history-list">
                            {chatHistories.map((chat) => (
                                <div
                                    key={chat.id}
                                    className="history-item"
                                    onClick={() => handleSelectHistory(chat.id)}
                                >
                                    <div className="history-item-main">
                                        <div className="history-title">{chat.title}</div>
                                        <div className="history-preview">{chat.preview}</div>
                                        <div className="history-meta">
                                            <span className="history-date">{formatDate(chat.created_at)}</span>
                                            <span className="history-count">{chat.message_count} messages</span>
                                        </div>
                                    </div>
                                    <button
                                        className="delete-btn"
                                        onClick={(e) => handleDeleteHistory(chat.id, e)}
                                        title="Delete chat history"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HistoryPanel;
