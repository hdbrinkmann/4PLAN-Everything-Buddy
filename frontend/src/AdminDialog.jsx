import React, { useState, useEffect } from 'react';
import ConfirmDialog from './ConfirmDialog';
import CollapsibleTable from './CollapsibleTable';
import './AdminDialog.css';

const AdminDialog = ({ isOpen, onClose, accessToken }) => {
    const [activeTab, setActiveTab] = useState('features');
    const [features, setFeatures] = useState({
        image_generation: true,
        pdf_docx_upload: true,
        txt_sql_upload: true,
        xlsx_csv_analysis: true,
        web_search: true
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [updatingKB, setUpdatingKB] = useState(false);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null);
    const [confirmTitle, setConfirmTitle] = useState('');
    const [confirmMessage, setConfirmMessage] = useState('');
    
    // User logging states
    const [loginSessions, setLoginSessions] = useState([]);
    const [chatQuestions, setChatQuestions] = useState([]);
    const [userSummary, setUserSummary] = useState([]);
    const [faultyCodeLogs, setFaultyCodeLogs] = useState([]);
    const [feedbackEntries, setFeedbackEntries] = useState([]);
    const [loadingData, setLoadingData] = useState(false);
    const [exportingData, setExportingData] = useState(false);
    
    // Knowledge field domain management states
    const [knowledgeFields, setKnowledgeFields] = useState([]);
    const [loadingKnowledgeFields, setLoadingKnowledgeFields] = useState(false);
    const [savingKnowledgeFields, setSavingKnowledgeFields] = useState(false);
    
    // These states are no longer needed since CollapsibleTable handles filtering internally

    useEffect(() => {
        if (isOpen && accessToken) {
            loadFeatures();
        }
    }, [isOpen, accessToken]);

    // Auto-scroll active tab into view on mobile
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                const activeTabButton = document.querySelector('.admin-dialog-tabs .tab-btn.active');
                if (activeTabButton) {
                    activeTabButton.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                        inline: 'center'
                    });
                }
            }, 100);
        }
    }, [activeTab, isOpen]);

    const loadFeatures = async () => {
        setLoading(true);
        try {
            // Determine the correct API URL based on the current location
            const apiUrl = window.location.protocol === 'https:' && window.location.port === '' 
                ? `${window.location.protocol}//${window.location.hostname}/admin/features`
                : 'http://localhost:8002/admin/features';
            
            const response = await fetch(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setFeatures(data);
            } else {
                console.error('Failed to load features:', response.status);
            }
        } catch (error) {
            console.error('Error loading features:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveFeatures = async () => {
        setSaving(true);
        try {
            // Determine the correct API URL based on the current location
            const apiUrl = window.location.protocol === 'https:' && window.location.port === '' 
                ? `${window.location.protocol}//${window.location.hostname}/admin/features`
                : 'http://localhost:8002/admin/features';
            
            const response = await fetch(apiUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify(features),
            });
            if (response.ok) {
                // Features saved successfully
                // Trigger knowledge fields refresh
                window.dispatchEvent(new CustomEvent('featuresUpdated'));
                onClose();
            } else {
                const errorData = await response.json();
                console.error('Failed to save features:', errorData);
                alert('Failed to save features: ' + (errorData.detail || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error saving features:', error);
            alert('Error saving features: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const updateKnowledgeBase = () => {
        setIsConfirmDialogOpen(true);
    };

    const executeKnowledgeBaseUpdate = () => {
        setUpdatingKB(true);
        setIsConfirmDialogOpen(false);
        // This will trigger the existing knowledge base update functionality
        // We emit the socket event that the parent component should handle
        window.dispatchEvent(new CustomEvent('updateKnowledgeBase'));
        setUpdatingKB(false);
        onClose();
    };

    // Load knowledge field domains for admin management
    const loadKnowledgeFieldDomains = async () => {
        if (!accessToken) return;
        setLoadingKnowledgeFields(true);
        try {
            const response = await fetch(getApiUrl('knowledge_field_domains'), {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setKnowledgeFields(data.knowledge_fields);
            } else {
                console.error('Failed to load knowledge field domains:', response.status);
            }
        } catch (error) {
            console.error('Error loading knowledge field domains:', error);
        } finally {
            setLoadingKnowledgeFields(false);
        }
    };

    // Save knowledge field domains
    const saveKnowledgeFieldDomains = async () => {
        if (!accessToken) return;
        setSavingKnowledgeFields(true);
        try {
            const response = await fetch(getApiUrl('knowledge_field_domains'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify(knowledgeFields),
            });
            if (response.ok) {
                const data = await response.json();
                alert(`Knowledge field domains updated successfully: ${data.message}`);
                // Trigger a refresh of knowledge fields in the main app
                window.dispatchEvent(new CustomEvent('knowledgeFieldsUpdated'));
            } else {
                const errorData = await response.json();
                alert('Failed to save knowledge field domains: ' + (errorData.detail || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error saving knowledge field domains:', error);
            alert('Error saving knowledge field domains: ' + error.message);
        } finally {
            setSavingKnowledgeFields(false);
        }
    };

    // Handle domain changes for a specific knowledge field
    const handleDomainChange = (fieldIndex, domainIndex, newDomain) => {
        const updatedFields = [...knowledgeFields];
        updatedFields[fieldIndex].domains[domainIndex] = newDomain;
        setKnowledgeFields(updatedFields);
    };

    // Add a new domain to a knowledge field
    const addDomainToField = (fieldIndex) => {
        const updatedFields = [...knowledgeFields];
        updatedFields[fieldIndex].domains.push('');
        setKnowledgeFields(updatedFields);
    };

    // Remove a domain from a knowledge field
    const removeDomainFromField = (fieldIndex, domainIndex) => {
        const updatedFields = [...knowledgeFields];
        updatedFields[fieldIndex].domains.splice(domainIndex, 1);
        setKnowledgeFields(updatedFields);
    };

    const handleFeatureChange = (featureName, value) => {
        setFeatures(prev => ({
            ...prev,
            [featureName]: value
        }));
    };

    // Helper function to determine API URL
    const getApiUrl = (endpoint) => {
        return window.location.protocol === 'https:' && window.location.port === '' 
            ? `${window.location.protocol}//${window.location.hostname}/admin/${endpoint}`
            : `http://localhost:8002/admin/${endpoint}`;
    };

    // Loading functions for user logging data
    const loadUserSummary = async () => {
        if (!accessToken) return;
        setLoadingData(true);
        try {
            const response = await fetch(getApiUrl('user_summary'), {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setUserSummary(data.user_summary);
            } else {
                console.error('Failed to load user summary:', response.status);
            }
        } catch (error) {
            console.error('Error loading user summary:', error);
        } finally {
            setLoadingData(false);
        }
    };

    const loadLoginSessions = async () => {
        if (!accessToken) return;
        setLoadingData(true);
        try {
            const response = await fetch(getApiUrl('login_sessions'), {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setLoginSessions(data.login_sessions);
            } else {
                console.error('Failed to load login sessions:', response.status);
            }
        } catch (error) {
            console.error('Error loading login sessions:', error);
        } finally {
            setLoadingData(false);
        }
    };

    const loadChatQuestions = async () => {
        if (!accessToken) return;
        setLoadingData(true);
        try {
            const response = await fetch(getApiUrl('chat_questions'), {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setChatQuestions(data.chat_questions);
            } else {
                console.error('Failed to load chat questions:', response.status);
            }
        } catch (error) {
            console.error('Error loading chat questions:', error);
        } finally {
            setLoadingData(false);
        }
    };

    const loadFaultyCodeLogs = async () => {
        if (!accessToken) return;
        setLoadingData(true);
        try {
            const response = await fetch(getApiUrl('faulty_code_logs'), {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setFaultyCodeLogs(data.faulty_code_logs);
            } else {
                console.error('Failed to load faulty code logs:', response.status);
            }
        } catch (error) {
            console.error('Error loading faulty code logs:', error);
        } finally {
            setLoadingData(false);
        }
    };

    const loadFeedbackEntries = async () => {
        if (!accessToken) return;
        setLoadingData(true);
        try {
            const response = await fetch(getApiUrl('feedback_entries'), {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setFeedbackEntries(data.feedback_entries);
            } else {
                console.error('Failed to load feedback entries:', response.status);
            }
        } catch (error) {
            console.error('Error loading feedback entries:', error);
        } finally {
            setLoadingData(false);
        }
    };

    // Export functions
    const exportLoginSessions = async () => {
        if (!accessToken) return;
        setExportingData(true);
        try {
            const response = await fetch(getApiUrl('export_login_sessions'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'anmeldungen.xlsx';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                console.error('Failed to export login sessions:', response.status);
                alert('Export failed. Please try again.');
            }
        } catch (error) {
            console.error('Error exporting login sessions:', error);
            alert('Export failed. Please try again.');
        } finally {
            setExportingData(false);
        }
    };

    const exportChatQuestions = async () => {
        if (!accessToken) return;
        setExportingData(true);
        try {
            const response = await fetch(getApiUrl('export_chat_questions'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'chat_fragen.xlsx';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                console.error('Failed to export chat questions:', response.status);
                alert('Export failed. Please try again.');
            }
        } catch (error) {
            console.error('Error exporting chat questions:', error);
            alert('Export failed. Please try again.');
        } finally {
            setExportingData(false);
        }
    };

    const exportFaultyCodeLogs = async () => {
        if (!accessToken) return;
        setExportingData(true);
        try {
            const response = await fetch(getApiUrl('export_faulty_code_logs'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'fehlerhafter_code.xlsx';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                console.error('Failed to export faulty code logs:', response.status);
                alert('Export failed. Please try again.');
            }
        } catch (error) {
            console.error('Error exporting faulty code logs:', error);
            alert('Export failed. Please try again.');
        } finally {
            setExportingData(false);
        }
    };

    const exportFeedbackEntries = async () => {
        if (!accessToken) return;
        setExportingData(true);
        try {
            const response = await fetch(getApiUrl('export_feedback_entries'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'feedback.xlsx';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                console.error('Failed to export feedback entries:', response.status);
                alert('Export failed. Please try again.');
            }
        } catch (error) {
            console.error('Error exporting feedback entries:', error);
            alert('Export failed. Please try again.');
        } finally {
            setExportingData(false);
        }
    };

    // Data cleanup function
    const cleanupOldData = () => {
        setConfirmTitle('Delete Old Data');
        setConfirmMessage('All data older than 1 year will be permanently deleted. Do you want to continue?');
        setConfirmAction(() => executeCleanupOldData);
        setIsConfirmDialogOpen(true);
    };

    const executeCleanupOldData = async () => {
        if (!accessToken) return;
        setIsConfirmDialogOpen(false);
        setLoadingData(true);
        try {
            const response = await fetch(getApiUrl('cleanup_old_data'), {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                alert(`Daten erfolgreich gelöscht:\n${data.deleted_sessions} Anmeldungen\n${data.deleted_questions} Chat-Fragen`);
                // Refresh current tab data
                if (activeTab === 'login_sessions') loadLoginSessions();
                if (activeTab === 'chat_questions') loadChatQuestions();
                if (activeTab === 'user_summary') loadUserSummary();
            } else {
                const errorData = await response.json();
                alert('Fehler beim Löschen der Daten: ' + (errorData.detail || 'Unbekannter Fehler'));
            }
        } catch (error) {
            console.error('Error cleaning up old data:', error);
            alert('Fehler beim Löschen der Daten: ' + error.message);
        } finally {
            setLoadingData(false);
        }
    };

    // Format date for display with explicit UTC to German timezone conversion
    const formatDate = (dateString) => {
        if (!dateString) return 'Still active';
        
        // Parse the date as UTC (backend sends ISO strings in UTC)
        const utcDate = new Date(dateString + (dateString.includes('Z') ? '' : 'Z'));
        
        // Convert to German timezone
        return utcDate.toLocaleString('de-DE', {
            timeZone: 'Europe/Berlin',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    // Sorting and filtering is now handled by CollapsibleTable component

    // Helper functions to convert data for CollapsibleTable
    const convertUserSummaryToTableFormat = (data) => {
        return {
            columns: ['User', 'Logins', 'Questions', 'Last Login'],
            data: data.map(user => [
                user.username,
                user.login_count.toString(),
                user.question_count.toString(),
                formatDate(user.last_login)
            ])
        };
    };

    const convertLoginSessionsToTableFormat = (data) => {
        return {
            columns: ['User', 'Login', 'Logout', 'Duration'],
            data: data.map(session => [
                session.username,
                formatDate(session.login_time),
                formatDate(session.logout_time),
                session.duration || 'Still active'
            ])
        };
    };

    const convertChatQuestionsToTableFormat = (data) => {
        return {
            columns: ['User', 'Time', 'Question', 'Rating'],
            data: data.map(question => [
                question.username,
                formatDate(question.timestamp),
                question.question_text,
                question.rating === 'good' ? 'good' : question.rating === 'poor' ? 'poor' : 'n/a'
            ])
        };
    };

    const convertFaultyCodeLogsToTableFormat = (data) => {
        return {
            columns: ['User', 'Time', 'Cause', 'Question', 'Code', 'Security Failure', 'Attempt'],
            data: data.map(log => {
                // Determine cause based on security_failure_reason
                const cause = log.security_failure_reason.toLowerCase().includes('sicherheit') || 
                            log.security_failure_reason.toLowerCase().includes('security') ||
                            log.security_failure_reason.toLowerCase().includes('risiko') ||
                            log.security_failure_reason.toLowerCase().includes('verboten') ||
                            log.security_failure_reason.toLowerCase().includes('forbidden') ? 'insecure' : 'error';
                
                return [
                    log.username,
                    formatDate(log.timestamp),
                    cause,
                    log.original_question.length > 100 ? log.original_question.substring(0, 100) + '...' : log.original_question,
                    log.python_code.length > 150 ? log.python_code.substring(0, 150) + '...' : log.python_code,
                    log.security_failure_reason,
                    log.attempt_number.toString()
                ];
            })
        };
    };

    const convertFeedbackEntriesToTableFormat = (data) => {
        return {
            columns: ['User', 'Time', 'Type', 'Feedback'],
            data: data.map(entry => [
                entry.username,
                formatDate(entry.created_at),
                entry.feedback_type,
                entry.feedback_text.length > 200 ? entry.feedback_text.substring(0, 200) + '...' : entry.feedback_text
            ])
        };
    };

    if (!isOpen) return null;

    return (
        <>
            <ConfirmDialog
                isOpen={isConfirmDialogOpen}
                onClose={() => setIsConfirmDialogOpen(false)}
                onConfirm={confirmAction || executeKnowledgeBaseUpdate}
                title={confirmTitle || "Knowledge Base Update"}
            >
                <p>{confirmMessage || "This process can take a very long time and will update the entire knowledge base. Do you really want to start the process?"}</p>
            </ConfirmDialog>
            
            <div className="admin-dialog-overlay" onClick={onClose}>
            <div className="admin-dialog" onClick={e => e.stopPropagation()}>
                <div className="admin-dialog-header">
                    <h3>Administration</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                
                <div className="admin-dialog-tabs">
                    <button 
                        className={`tab-btn ${activeTab === 'features' ? 'active' : ''}`}
                        onClick={() => setActiveTab('features')}
                    >
                        Features
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'knowledge' ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab('knowledge');
                            loadKnowledgeFieldDomains();
                        }}
                    >
                        Knowledge Base
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'user_summary' ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab('user_summary');
                            loadUserSummary();
                        }}
                    >
                        Users
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'login_sessions' ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab('login_sessions');
                            loadLoginSessions();
                        }}
                    >
                        Logins
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'chat_questions' ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab('chat_questions');
                            loadChatQuestions();
                        }}
                    >
                        Questions
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'faulty_code' ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab('faulty_code');
                            loadFaultyCodeLogs();
                        }}
                    >
                        Faulty Code
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'feedback' ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab('feedback');
                            loadFeedbackEntries();
                        }}
                    >
                        Feedback
                    </button>
                </div>

                <div className="admin-dialog-content">
                    {activeTab === 'features' && (
                        <div className="features-tab">
                            <h4>Feature Configuration</h4>
                            <p className="tab-description">
                                Control which features are available to users. Changes take effect immediately.
                            </p>
                            
                            {loading ? (
                                <div className="loading">Loading features...</div>
                            ) : (
                                <div className="feature-list">
                                    <div className="feature-item">
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={features.image_generation}
                                                onChange={(e) => handleFeatureChange('image_generation', e.target.checked)}
                                            />
                                            <span className="feature-name">Image Generation</span>
                                        </label>
                                        <p className="feature-description">
                                            Allow users to generate images using AI
                                        </p>
                                    </div>

                                    <div className="feature-item">
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={features.image_upload}
                                                onChange={(e) => handleFeatureChange('image_upload', e.target.checked)}
                                            />
                                            <span className="feature-name">Image Upload</span>
                                        </label>
                                        <p className="feature-description">
                                            Allow users to upload image files for analysis and ask questions about them
                                        </p>
                                    </div>

                                    <div className="feature-item">
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={features.pdf_docx_upload}
                                                onChange={(e) => handleFeatureChange('pdf_docx_upload', e.target.checked)}
                                            />
                                            <span className="feature-name">PDF/DOCX Upload</span>
                                        </label>
                                        <p className="feature-description">
                                            Allow users to upload PDF and DOCX files for document analysis and Q&A
                                        </p>
                                    </div>

                                    <div className="feature-item">
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={features.txt_sql_upload}
                                                onChange={(e) => handleFeatureChange('txt_sql_upload', e.target.checked)}
                                            />
                                            <span className="feature-name">TXT/SQL Upload</span>
                                        </label>
                                        <p className="feature-description">
                                            Allow users to upload text and SQL files for content analysis
                                        </p>
                                    </div>

                                    <div className="feature-item">
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={features.xlsx_csv_analysis}
                                                onChange={(e) => handleFeatureChange('xlsx_csv_analysis', e.target.checked)}
                                            />
                                            <span className="feature-name">Excel/CSV Analysis</span>
                                        </label>
                                        <p className="feature-description">
                                            Allow users to upload Excel and CSV files for data analysis with Python scripts
                                        </p>
                                    </div>

                                    <div className="feature-item">
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={features.web_search}
                                                onChange={(e) => handleFeatureChange('web_search', e.target.checked)}
                                            />
                                            <span className="feature-name">Web Search</span>
                                        </label>
                                        <p className="feature-description">
                                            Allow users to include web search in their knowledge sources
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'knowledge' && (
                        <div className="knowledge-tab">
                            <div className="knowledge-domain-management">
                                <h4>Domain Access Management</h4>
                                <p className="domain-description">
                                    Control which email domains can access each knowledge field. Users can only access knowledge fields from their email domain.
                                </p>
                                
                                <div className="knowledge-fields-scrollable">
                                    {loadingKnowledgeFields ? (
                                        <div className="loading">Loading knowledge fields...</div>
                                    ) : (
                                        <div className="knowledge-fields-list">
                                            {knowledgeFields.map((field, fieldIndex) => (
                                                <div key={fieldIndex} className="knowledge-field-item">
                                                    <div className="field-header">
                                                        <h6>{field.field_name}</h6>
                                                    </div>
                                                    <div className="field-domains">
                                                        <label>Allowed Domains:</label>
                                                        {field.domains.map((domain, domainIndex) => (
                                                            <div key={domainIndex} className="domain-input-group">
                                                                <input
                                                                    type="text"
                                                                    value={domain}
                                                                    onChange={(e) => handleDomainChange(fieldIndex, domainIndex, e.target.value)}
                                                                    placeholder="example.com"
                                                                    className="domain-input"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeDomainFromField(fieldIndex, domainIndex)}
                                                                    className="remove-domain-btn"
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <button
                                                            type="button"
                                                            onClick={() => addDomainToField(fieldIndex)}
                                                            className="add-domain-btn"
                                                        >
                                                            + Add Domain
                                                        </button>
                                                        {field.domains.length === 0 && (
                                                            <p className="no-domains-warning">
                                                                No domains configured - only admins can access this field
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            {knowledgeFields.length === 0 && (
                                                <p className="no-fields-message">No knowledge fields found. Update the knowledge base first.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="domain-actions-sticky">
                                    <button
                                        onClick={saveKnowledgeFieldDomains}
                                        disabled={savingKnowledgeFields || loadingKnowledgeFields}
                                        className="save-domains-btn"
                                    >
                                        {savingKnowledgeFields ? 'Saving...' : 'Save Domain Settings'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'user_summary' && (
                        <div className="user-summary-tab">
                            {loadingData ? (
                                <div className="loading">Lade Benutzer-Übersicht...</div>
                            ) : userSummary.length === 0 ? (
                                <p className="no-data">Keine Daten verfügbar</p>
                            ) : (
                                <CollapsibleTable 
                                    data={convertUserSummaryToTableFormat(userSummary)} 
                                />
                            )}
                        </div>
                    )}

                    {activeTab === 'login_sessions' && (
                        <div className="login-sessions-tab">
                            {loadingData ? (
                                <div className="loading">Lade Anmeldungen...</div>
                            ) : loginSessions.length === 0 ? (
                                <p className="no-data">Keine Daten verfügbar</p>
                            ) : (
                                <CollapsibleTable 
                                    data={convertLoginSessionsToTableFormat(loginSessions)} 
                                />
                            )}
                        </div>
                    )}

                    {activeTab === 'chat_questions' && (
                        <div className="chat-questions-tab">
                            {loadingData ? (
                                <div className="loading">Lade Chat-Fragen...</div>
                            ) : chatQuestions.length === 0 ? (
                                <p className="no-data">Keine Daten verfügbar</p>
                            ) : (
                                <CollapsibleTable 
                                    data={convertChatQuestionsToTableFormat(chatQuestions)} 
                                />
                            )}
                        </div>
                    )}

                    {activeTab === 'faulty_code' && (
                        <div className="faulty-code-tab">
                            {loadingData ? (
                                <div className="loading">Loading faulty code logs...</div>
                            ) : faultyCodeLogs.length === 0 ? (
                                <p className="no-data">No faulty code logs available</p>
                            ) : (
                                <CollapsibleTable 
                                    data={convertFaultyCodeLogsToTableFormat(faultyCodeLogs)} 
                                />
                            )}
                        </div>
                    )}

                    {activeTab === 'feedback' && (
                        <div className="feedback-tab">
                            {loadingData ? (
                                <div className="loading">Loading feedback entries...</div>
                            ) : feedbackEntries.length === 0 ? (
                                <p className="no-data">No feedback entries available</p>
                            ) : (
                                <CollapsibleTable 
                                    data={convertFeedbackEntriesToTableFormat(feedbackEntries)} 
                                />
                            )}
                        </div>
                    )}
                </div>

                <div className="admin-dialog-footer">
                    {activeTab === 'features' && (
                        <>
                            <button className="cancel-btn" onClick={onClose}>
                                Cancel
                            </button>
                            <button 
                                className="save-btn" 
                                onClick={saveFeatures}
                                disabled={saving || loading}
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </>
                    )}
                    {activeTab === 'knowledge' && (
                        <>
                            <button 
                                className="update-kb-btn" 
                                onClick={updateKnowledgeBase}
                                disabled={updatingKB}
                            >
                                {updatingKB ? 'Starting Update...' : 'Update Knowledge Base'}
                            </button>
                            <button className="cancel-btn" onClick={onClose}>
                                Close
                            </button>
                        </>
                    )}
                    {(activeTab === 'user_summary' || activeTab === 'login_sessions' || activeTab === 'chat_questions' || activeTab === 'faulty_code' || activeTab === 'feedback') && (
                        <>
                            {activeTab === 'login_sessions' && (
                                <button 
                                    className="export-btn" 
                                    onClick={exportLoginSessions}
                                    disabled={exportingData}
                                >
                                    {exportingData ? 'Exporting...' : 'Export Excel'}
                                </button>
                            )}
                            {activeTab === 'chat_questions' && (
                                <button 
                                    className="export-btn" 
                                    onClick={exportChatQuestions}
                                    disabled={exportingData}
                                >
                                    {exportingData ? 'Exporting...' : 'Export Excel'}
                                </button>
                            )}
                            {activeTab === 'faulty_code' && (
                                <button 
                                    className="export-btn" 
                                    onClick={exportFaultyCodeLogs}
                                    disabled={exportingData}
                                >
                                    {exportingData ? 'Exporting...' : 'Export Excel'}
                                </button>
                            )}
                            {activeTab === 'feedback' && (
                                <button 
                                    className="export-btn" 
                                    onClick={exportFeedbackEntries}
                                    disabled={exportingData}
                                >
                                    {exportingData ? 'Exporting...' : 'Export Excel'}
                                </button>
                            )}
                            <button 
                                className="cancel-btn" 
                                onClick={cleanupOldData}
                                disabled={loadingData}
                            >
                                Delete &gt;1 Year
                            </button>
                            <button className="cancel-btn" onClick={onClose}>
                                Close
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
        </>
    );
};

export default AdminDialog;
