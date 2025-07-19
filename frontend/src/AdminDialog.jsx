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
    
    // Backup management states
    const [backupStatus, setBackupStatus] = useState({});
    const [backupConfig, setBackupConfig] = useState({
        enabled: true,
        backup_time: '02:00',
        retention_days: 7,
        retention_months: 12,
        compress: true,
        verify_integrity: true
    });
    const [backupList, setBackupList] = useState([]);
    const [loadingBackupData, setLoadingBackupData] = useState(false);
    const [savingBackupConfig, setSavingBackupConfig] = useState(false);
    const [creatingBackup, setCreatingBackup] = useState(false);
    const [manualBackupDescription, setManualBackupDescription] = useState('');
    
    // Restore states
    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
    const [restoreConfirmText, setRestoreConfirmText] = useState('');
    const [selectedBackup, setSelectedBackup] = useState(null);
    const [restoringBackup, setRestoringBackup] = useState(false);
    
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

    // Backup management functions
    const loadBackupData = async () => {
        if (!accessToken) return;
        setLoadingBackupData(true);
        try {
            // Load backup status
            const statusResponse = await fetch(getApiUrl('backups/status'), {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                setBackupStatus(statusData);
            }

            // Load backup config
            const configResponse = await fetch(getApiUrl('backups/config'), {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            if (configResponse.ok) {
                const configData = await configResponse.json();
                setBackupConfig(configData);
            }

            // Load backup list
            const listResponse = await fetch(getApiUrl('backups/list'), {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            if (listResponse.ok) {
                const listData = await listResponse.json();
                setBackupList(listData.backups);
            }
        } catch (error) {
            console.error('Error loading backup data:', error);
        } finally {
            setLoadingBackupData(false);
        }
    };

    const saveBackupConfig = async () => {
        if (!accessToken) return;
        setSavingBackupConfig(true);
        try {
            const response = await fetch(getApiUrl('backups/config'), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify(backupConfig),
            });
            if (response.ok) {
                const data = await response.json();
                alert('Backup configuration saved successfully!');
                // Reload backup data to reflect changes
                loadBackupData();
            } else {
                const errorData = await response.json();
                alert('Failed to save backup configuration: ' + (errorData.detail || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error saving backup config:', error);
            alert('Error saving backup config: ' + error.message);
        } finally {
            setSavingBackupConfig(false);
        }
    };

    const createManualBackup = async () => {
        if (!accessToken) return;
        setCreatingBackup(true);
        try {
            const response = await fetch(getApiUrl('backups/create'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ description: manualBackupDescription }),
            });
            if (response.ok) {
                const data = await response.json();
                alert('Backup created successfully!');
                setManualBackupDescription('');
                // Reload backup data to show new backup
                loadBackupData();
            } else {
                const errorData = await response.json();
                alert('Failed to create backup: ' + (errorData.detail || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error creating backup:', error);
            alert('Error creating backup: ' + error.message);
        } finally {
            setCreatingBackup(false);
        }
    };

    const deleteBackup = async (backupName) => {
        if (!accessToken) return;
        if (!confirm(`Are you sure you want to delete backup "${backupName}"?`)) return;
        
        try {
            const response = await fetch(getApiUrl(`backups/${backupName}`), {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                alert('Backup deleted successfully!');
                // Reload backup data to reflect changes
                loadBackupData();
            } else {
                const errorData = await response.json();
                alert('Failed to delete backup: ' + (errorData.detail || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error deleting backup:', error);
            alert('Error deleting backup: ' + error.message);
        }
    };

    const cleanupBackups = async () => {
        if (!accessToken) return;
        if (!confirm('This will remove old backups according to your retention policy. Continue?')) return;
        
        try {
            const response = await fetch(getApiUrl('backups/cleanup'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    alert(`Cleanup completed! Deleted ${data.deleted_count} old backups, ${data.remaining_count} backups remaining.`);
                } else {
                    alert('Cleanup failed: ' + (data.error || 'Unknown error'));
                }
                // Reload backup data to reflect changes
                loadBackupData();
            } else {
                const errorData = await response.json();
                alert('Failed to cleanup backups: ' + (errorData.detail || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error cleaning up backups:', error);
            alert('Error cleaning up backups: ' + error.message);
        }
    };

    const handleBackupConfigChange = (field, value) => {
        setBackupConfig(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Restore functions
    const initiateRestore = (backup) => {
        setSelectedBackup(backup);
        setRestoreDialogOpen(true);
        setRestoreConfirmText('');
    };

    const executeRestore = async () => {
        if (!accessToken || !selectedBackup) return;
        if (restoreConfirmText !== 'RESTORE') {
            alert('Please type "RESTORE" to confirm the restore operation.');
            return;
        }

        setRestoringBackup(true);
        try {
            const response = await fetch(getApiUrl('backups/restore'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    backup_name: selectedBackup.name,
                    confirm_text: restoreConfirmText
                }),
            });

            if (response.ok) {
                const data = await response.json();
                alert('⚠️ Backup restore initiated! The system will restart automatically. You may lose connection temporarily.');
                setRestoreDialogOpen(false);
                setSelectedBackup(null);
                setRestoreConfirmText('');
                
                // Close admin dialog as system will restart
                setTimeout(() => {
                    onClose();
                }, 2000);
            } else {
                const errorData = await response.json();
                alert('Failed to restore backup: ' + (errorData.detail || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error restoring backup:', error);
            alert('Error restoring backup: ' + error.message);
        } finally {
            setRestoringBackup(false);
        }
    };

    // Helper function to format backup size
    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // Helper function to convert backup list to table format
    const convertBackupListToTableFormat = (data) => {
        return {
            columns: ['Name', 'Type', 'Size', 'Date', 'Description', 'Actions'],
            data: data.map(backup => [
                backup.name,
                backup.type,
                formatSize(backup.size || 0),
                formatDate(backup.date),
                backup.description || 'No description',
                backup.name // Will be used for actions
            ])
        };
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

            {/* Restore Confirmation Dialog */}
            {restoreDialogOpen && (
                <div className="restore-dialog-overlay" onClick={() => setRestoreDialogOpen(false)}>
                    <div className="restore-dialog" onClick={e => e.stopPropagation()}>
                        <div className="admin-dialog-header">
                            <h3>⚠️ RESTORE BACKUP</h3>
                            <button className="close-btn" onClick={() => setRestoreDialogOpen(false)}>×</button>
                        </div>
                        
                        <div className="admin-dialog-content">
                            <div className="restore-warning">
                                <h4>ACHTUNG: DATENVERLUST MÖGLICH!</h4>
                                
                                <div className="backup-info-display">
                                    <p><strong>Backup wiederherstellen:</strong> {selectedBackup?.name}</p>
                                    <p><strong>Erstellt:</strong> {selectedBackup && formatDate(selectedBackup.date)} ({formatSize(selectedBackup?.size || 0)})</p>
                                    <p><strong>Beschreibung:</strong> "{selectedBackup?.description || 'No description'}"</p>
                                </div>

                                <div className="restore-consequences">
                                    <p><strong>ALLE AKTUELLEN DATEN WERDEN ÜBERSCHRIEBEN!</strong></p>
                                    <ul>
                                        <li>✋ Datenbank wird zurückgesetzt</li>
                                        <li>🔄 Alle Docker Images werden ersetzt</li>
                                        <li>⚙️ Konfiguration wird zurückgesetzt</li>
                                        <li>🔄 System wird automatisch neu gestartet</li>
                                    </ul>
                                </div>

                                <div className="confirmation-input">
                                    <label htmlFor="restoreConfirm">
                                        <strong>Bestätigung: Tippen Sie "RESTORE" ein:</strong>
                                    </label>
                                    <input
                                        id="restoreConfirm"
                                        type="text"
                                        value={restoreConfirmText}
                                        onChange={(e) => setRestoreConfirmText(e.target.value)}
                                        placeholder="RESTORE"
                                        className="restore-confirm-input"
                                        autoFocus
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="admin-dialog-footer restore-footer">
                            <button 
                                className="cancel-btn" 
                                onClick={() => setRestoreDialogOpen(false)}
                                disabled={restoringBackup}
                            >
                                ❌ Abbrechen
                            </button>
                            <button 
                                className="restore-confirm-btn"
                                onClick={executeRestore}
                                disabled={restoringBackup || restoreConfirmText !== 'RESTORE'}
                            >
                                {restoringBackup ? '🔄 Wiederherstellen...' : '⚠️ BACKUP WIEDERHERSTELLEN'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
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
                    <button 
                        className={`tab-btn ${activeTab === 'backups' ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab('backups');
                            loadBackupData();
                        }}
                    >
                        Backups
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

                    {activeTab === 'backups' && (
                        <div className="backups-tab">
                            {loadingBackupData ? (
                                <div className="loading">Loading backup data...</div>
                            ) : (
                                <>
                                    <div className="backup-config-section">
                                        <h4>🔧 Backup Configuration</h4>
                                        <div className="backup-config-grid">
                                            <div className="config-item">
                                                <label>Automatic Backup Time ⏰</label>
                                                <input
                                                    type="time"
                                                    value={backupConfig.backup_time}
                                                    onChange={(e) => handleBackupConfigChange('backup_time', e.target.value)}
                                                />
                                            </div>
                                            <div className="config-item">
                                                <label>Retention Days 📅</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="30"
                                                    value={backupConfig.retention_days}
                                                    onChange={(e) => handleBackupConfigChange('retention_days', parseInt(e.target.value))}
                                                />
                                            </div>
                                            <div className="config-item">
                                                <label>Retention Months 🗓️</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="24"
                                                    value={backupConfig.retention_months}
                                                    onChange={(e) => handleBackupConfigChange('retention_months', parseInt(e.target.value))}
                                                />
                                            </div>
                                            <div className="config-item">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={backupConfig.enabled}
                                                        onChange={(e) => handleBackupConfigChange('enabled', e.target.checked)}
                                                    />
                                                    Enable Automatic Backups
                                                </label>
                                            </div>
                                            <div className="config-item">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={backupConfig.compress}
                                                        onChange={(e) => handleBackupConfigChange('compress', e.target.checked)}
                                                    />
                                                    Enable Compression
                                                </label>
                                            </div>
                                            <div className="config-item">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={backupConfig.verify_integrity}
                                                        onChange={(e) => handleBackupConfigChange('verify_integrity', e.target.checked)}
                                                    />
                                                    Verify Integrity
                                                </label>
                                            </div>
                                        </div>
                                        <button 
                                            className="save-backup-config-btn"
                                            onClick={saveBackupConfig}
                                            disabled={savingBackupConfig}
                                        >
                                            {savingBackupConfig ? 'Saving...' : 'Save Configuration'}
                                        </button>
                                    </div>

                                    <div className="backup-status-section">
                                        <h4>📊 Backup Status</h4>
                                        <div className="status-grid">
                                            <div className="status-item">
                                                <span className="status-label">Last Backup:</span>
                                                <span className="status-value">
                                                    {backupStatus.last_backup ? formatDate(backupStatus.last_backup) : 'Never'}
                                                    {backupStatus.last_backup_success === false && <span className="error-indicator"> ❌</span>}
                                                    {backupStatus.last_backup_success === true && <span className="success-indicator"> ✅</span>}
                                                </span>
                                            </div>
                                            <div className="status-item">
                                                <span className="status-label">Next Backup:</span>
                                                <span className="status-value">
                                                    {backupStatus.next_backup ? formatDate(backupStatus.next_backup) : 'Disabled'}
                                                </span>
                                            </div>
                                            <div className="status-item">
                                                <span className="status-label">Total Backups:</span>
                                                <span className="status-value">
                                                    {backupStatus.total_backups || 0} 
                                                    (Daily: {backupStatus.daily_backups || 0}, 
                                                    Monthly: {backupStatus.monthly_backups || 0}, 
                                                    Manual: {backupStatus.manual_backups || 0})
                                                </span>
                                            </div>
                                            <div className="status-item">
                                                <span className="status-label">Storage Used:</span>
                                                <span className="status-value">{backupStatus.total_storage_human || '0 B'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="backup-management-section">
                                        <h4>📋 Backup Management</h4>
                                        <div className="manual-backup-controls">
                                            <input
                                                type="text"
                                                placeholder="Enter backup description (optional)"
                                                value={manualBackupDescription}
                                                onChange={(e) => setManualBackupDescription(e.target.value)}
                                                className="backup-description-input"
                                            />
                                            <button
                                                onClick={createManualBackup}
                                                disabled={creatingBackup}
                                                className="create-backup-btn"
                                            >
                                                {creatingBackup ? 'Creating...' : 'Create Manual Backup'}
                                            </button>
                                            <button
                                                onClick={cleanupBackups}
                                                className="cleanup-backups-btn"
                                            >
                                                Cleanup Old Backups
                                            </button>
                                        </div>
                                    </div>

                                    <div className="backup-history-section">
                                        <h4>📋 Backup History</h4>
                                        {backupList.length === 0 ? (
                                            <p className="no-data">No backups available</p>
                                        ) : (
                                            <div className="backup-list">
                                                {backupList.map((backup, index) => (
                                                    <div key={index} className="backup-item">
                                                        <div className="backup-info">
                                                            <div className="backup-name">{backup.name}</div>
                                                            <div className="backup-details">
                                                                <span className="backup-type">{backup.type}</span>
                                                                <span className="backup-size">{formatSize(backup.size || 0)}</span>
                                                                <span className="backup-date">{formatDate(backup.date)}</span>
                                                            </div>
                                                            <div className="backup-description">{backup.description || 'No description'}</div>
                                                        </div>
                                                        <div className="backup-actions">
                                                            <button
                                                                onClick={() => initiateRestore(backup)}
                                                                className="restore-backup-btn"
                                                                title="Restore backup"
                                                            >
                                                                <img src="/restore.png" alt="Restore" />
                                                            </button>
                                                            <button
                                                                onClick={() => deleteBackup(backup.name)}
                                                                className="delete-backup-btn"
                                                                title="Delete backup"
                                                            >
                                                                <img src="/trash.png" alt="Delete" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
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
                    {activeTab === 'backups' && (
                        <>
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
