
import React, { useState, useEffect, useRef } from 'react';
import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal, useIsAuthenticated } from "@azure/msal-react";
import io from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import CollapsibleSources from './CollapsibleSources';
import CollapsibleTable from './CollapsibleTable';
import CollapsibleText from './CollapsibleText';
import CollapsibleCode from './CollapsibleCode';
import CollapsibleSingleValue from './CollapsibleSingleValue';
import { speak } from './voiceService';
import microphoneIcon from '../microphone.svg';
import webIcon from '../web_icon.png';
import documentationIcon from '../Documenation_icon.png';
import fileAnalysisIcon from '../file_analylsis.png';
import localFileIcon from '../local_file.png'; // Import the new icon
import imageIcon from '../image.png'; // Import the new icon
import pdfIcon from '../PDF.png'; // Import the PDF icon
import starIcon from '../star_yellow.png'; // Import the star icon
import starFullIcon from '../star_full.png'; // Import the full star icon
import favoritesIcon from '../favorites.png'; // Import the favorites icon
import historyIcon from '../history.png'; // Import the history icon
import cancelIcon from '../Cancel.png'; // Import the cancel icon
import logoutIcon from '../logout.png'; // Import the logout icon
import wipeIcon from '../wipe.png'; // Import the wipe icon
import textFileIcon from '../textfile.png'; // Import the new icon
import docFileIcon from '../docfile.png'; // Import the new icon
import pinselIcon from '../pinsel.png'; // Import the brush icon
import newDialogIcon from '../trash.png'; // Using trash icon for New Dialog
import updateKBIcon from '../update_DB.png';
import knowledgeFieldsIcon from '../brain.png'; // Using brain icon for Knowledge Fields
// Remove the import and use the GIF from public directory instead
import goodIcon from '../good.png'; // Import the good icon
import badIcon from '../bad.png'; // Import the bad icon
import FavoritesPanel from './FavoritesPanel';
import HistoryPanel from './HistoryPanel';
import ConfirmDialog from './ConfirmDialog';
import AdminDialog from './AdminDialog';
import MultiSelectDropdown from './MultiSelectDropdown'; // Import the new component
import Login from './Login'; // Import the Login component
import './App.css';
import './ConfirmDialog.css';
import './MultiSelectDropdown.css'; // Import the new CSS
import './AdminDialog.css';

// Dynamic API configuration based on environment
const isDevelopment = import.meta.env.DEV;

// Determine the base URL dynamically
const getBaseUrl = () => {
    if (isDevelopment) {
        // Development: Use HTTPS backend on port 8443
        return "https://localhost:8443";
    } else {
        // Production/Docker: use current protocol and host with sub-path
        return `${window.location.protocol}//${window.location.host}${import.meta.env.BASE_URL || ''}`.replace(/\/$/, '');
    }
};

const SOCKET_URL = getBaseUrl();
const API_URL = getBaseUrl();

function MainContent() {
    const { instance, accounts } = useMsal();
    const [socket, setSocket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [status, setStatus] = useState('Connecting...');
    const [chatMode, setChatMode] = useState('knowledge_base'); // 'knowledge_base', 'document_chat', or 'image_chat'
    const [uploadedFileName, setUploadedFileName] = useState('');
    const [uploadedFileContent, setUploadedFileContent] = useState('');
    const [uploadedFileType, setUploadedFileType] = useState('');
    const [uploadedImagePreview, setUploadedImagePreview] = useState(''); // State for image preview
    const [uploadedFileHeader, setUploadedFileHeader] = useState(null);
    const [sourceMode, setSourceMode] = useState(null); // 'vector_store', 'web_search', or null
    const [pythonStatus, setPythonStatus] = useState(null); // e.g., { status: 'generating', attempt: 1 }
    const [isProcessingRag, setIsProcessingRag] = useState(false); // For PDF/DOCX processing
    const [wasLastQueryFromVoice, setWasLastQueryFromVoice] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [favoriteGroups, setFavoriteGroups] = useState([]);
    const [isFavoritesPanelOpen, setIsFavoritesPanelOpen] = useState(false);
    const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [accessToken, setAccessToken] = useState(null);
    const [knowledgeFields, setKnowledgeFields] = useState([]);
    const [selectedFields, setSelectedFields] = useState([]);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [isKnowledgeFieldModalOpen, setIsKnowledgeFieldModalOpen] = useState(false);
    const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false); // State to hold admin status
    const [features, setFeatures] = useState({}); // State to hold available features
    const [previousFeatures, setPreviousFeatures] = useState({}); // State to track previous features for comparison
    const [lastImageB64, setLastImageB64] = useState(null); // State for the last generated image
    const [loadedHistoryId, setLoadedHistoryId] = useState(null); // Track loaded history entry to delete later
    const [isAwaitingClarification, setIsAwaitingClarification] = useState(false);
    const [messageRatings, setMessageRatings] = useState({}); // Track ratings for messages
    
    // Sidebar state with localStorage persistence
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
        try {
            const saved = localStorage.getItem('sidebarExpanded');
            return saved ? JSON.parse(saved) : false; // Default to collapsed
        } catch (error) {
            console.error('Error reading sidebar state:', error);
            return false; // Fallback to collapsed
        }
    });
    
    // Track if window is wide enough for expansion
    const [isWindowWideEnough, setIsWindowWideEnough] = useState(window.innerWidth > 768);
    const isCancellingRef = useRef(isCancelling);
    const processingMessageIdRef = useRef(null); // Use a ref to avoid stale state in socket listener
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const speechRecognitionRef = useRef(null);
    const silenceTimerRef = useRef(null);
    const inputValueRef = useRef(inputValue);
    const wasLastQueryFromVoiceRef = useRef(wasLastQueryFromVoice);
    const chatInputRef = useRef(null);
    const textareaRef = useRef(null); // Add a ref for the textarea
    const chatInputAreaRef = useRef(null); // Ref for the input area container
    const [inputAreaHeight, setInputAreaHeight] = useState(85); // State to hold the height

    useEffect(() => {
        inputValueRef.current = inputValue;
    }, [inputValue]);

    // Effect to auto-resize textarea and update container height
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = '48px'; // Reset to single line height
            const scrollHeight = textarea.scrollHeight;
            const maxHeight = 120; // Limit expansion to about 3 lines
            const newHeight = Math.min(scrollHeight, maxHeight);
            textarea.style.height = `${newHeight}px`;
        }
        // Update the container height for positioning the action buttons
        if (chatInputAreaRef.current) {
            setInputAreaHeight(chatInputAreaRef.current.offsetHeight);
        }
    }, [inputValue]);

    useEffect(() => {
        wasLastQueryFromVoiceRef.current = wasLastQueryFromVoice;
    }, [wasLastQueryFromVoice]);

    useEffect(() => {
        isCancellingRef.current = isCancelling;
    }, [isCancelling]);

    // Persist sidebar state to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('sidebarExpanded', JSON.stringify(isSidebarExpanded));
        } catch (error) {
            console.error('Error saving sidebar state:', error);
        }
    }, [isSidebarExpanded]);

    // Auto-collapse sidebar when window becomes too narrow
    useEffect(() => {
        const handleResize = () => {
            const breakpoint = 768; // Same as CSS media query
            const isWide = window.innerWidth > breakpoint;
            
            setIsWindowWideEnough(isWide);
            
            if (!isWide && isSidebarExpanded) {
                setIsSidebarExpanded(false);
            }
        };

        window.addEventListener('resize', handleResize);
        
        // Check on initial load
        handleResize();

        return () => window.removeEventListener('resize', handleResize);
    }, [isSidebarExpanded]);

    useEffect(() => {
        if (accessToken) {
            fetch(`${API_URL}/favorites/`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            })
            .then(response => {
                if (!response.ok) {
                    // You might want to handle errors more gracefully
                    return response.json().then(err => {
                        throw new Error(err.detail || 'Failed to fetch favorites');
                    });
                }
                return response.json();
            })
            .then(data => {
                if (Array.isArray(data)) {
                    setFavoriteGroups(data);
                } else {
                    setFavoriteGroups([]);
                }
            })
            .catch(error => {
                console.error('Error fetching favorites in App.jsx:', error);
                setFavoriteGroups([]);
            });

            fetch(`${API_URL}/knowledge_fields`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            })
            .then(response => response.json())
            .then(data => {
                if (data.fields) {
                    setKnowledgeFields(data.fields);
                    // By default, select all fields from the backend
                    setSelectedFields(data.fields); 
                } else {
                    setKnowledgeFields([]);
                    setSelectedFields([]);
                }
            })
            .catch(error => console.error('Error fetching knowledge fields:', error));

            // Check if the user is an admin
            fetch(`${API_URL}/check_admin`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            })
            .then(response => response.json())
            .then(data => {
                if (data.is_admin) {
                    setIsAdmin(true);
                }
            })
            .catch(error => console.error('Error checking admin status:', error));

            // Load available features
            fetch(`${API_URL}/admin/features`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            })
            .then(response => response.json())
            .then(data => {
                setFeatures(data);
            })
            .catch(error => console.error('Error loading features:', error));
        }
    }, [accessToken]);

    useEffect(() => {
        if (!instance || accounts.length === 0) return;

        const acquireTokenAndConnect = async () => {
            const { loginRequest } = await import('./authConfig');
            const request = {
                ...loginRequest,
                account: accounts[0]
            };

            try {
                const response = await instance.acquireTokenSilent(request);
                setAccessToken(response.accessToken);
                const newSocket = io(SOCKET_URL, {
                    auth: {
                        token: response.accessToken
                    }
                });

                setSocket(newSocket);

                newSocket.on('connect', () => setStatus('Connected'));
                newSocket.on('connect_error', (err) => setStatus(`Connection Failed: ${err.message}`));
                newSocket.on('disconnect', (reason) => {
                    setStatus(`Disconnected: ${reason}`);
                    let userMessage = '';
                    if (reason === 'io server disconnect') {
                        userMessage = "The server has disconnected the session. This might be due to a server restart or an intentional shutdown.";
                    } else if (reason === 'transport close') {
                        userMessage = "The connection was lost unexpectedly. Please check your internet connection. The server might also be temporarily unavailable or has been restarted.";
                    } else if (reason === 'ping timeout') {
                        userMessage = "The connection to the server was lost (ping timeout). The server may be overloaded or taking too long to respond. Please try your request again.";
                    }

                    if (userMessage) {
                        const errorMessage = {
                            role: 'assistant',
                            content: userMessage,
                            isComplete: true,
                            isError: true,
                        };
                        setMessages(prev => [...prev, errorMessage]);
                    }
                });

                newSocket.on('status', (data) => setStatus(data.message));

                newSocket.on('answer_meta', (data) => {
                    setIsThinking(false);
                    setSourceMode(data.source_mode);
                    const newAssistantMessage = {
                        role: 'assistant',
                        content: '',
                        ...data,
                        isComplete: false,
                        questionId: data.question_id // Store the question ID for rating
                    };
                    setMessages(prev => [...prev, newAssistantMessage]);
                });

                newSocket.on('answer_chunk', (chunk) => {
                    setMessages(prev => {
                        const newMessages = [...prev];
                        const lastMessage = newMessages[newMessages.length - 1];
                        // Only add content if the last message is not an image message
                        if (lastMessage && lastMessage.role === 'assistant' && !lastMessage.imageUrl) {
                            lastMessage.content += chunk;
                        }
                        return newMessages;
                    });
                });

                newSocket.on('generation_cancelled', () => {
                    console.log('Generation cancelled event received');
                    setIsCancelling(true);
                    setIsThinking(false);
                    setIsGenerating(false);
                });

                newSocket.on('answer_end', () => {
                    const wasCancelled = isCancellingRef.current;
                    setIsThinking(false);
                    setIsCancelling(false);
                    setIsGenerating(false);
                    setMessages(prev => {
                        const newMessages = [...prev];
                        const lastMessage = newMessages[newMessages.length - 1];
                        if (lastMessage && lastMessage.role === 'assistant') {
                            lastMessage.isComplete = true;
                            if (wasCancelled) {
                                if (lastMessage.content.trim().length < 20) {
                                    lastMessage.content = "Generation was cancelled.";
                                } else {
                                    lastMessage.content += "\n\n*(Generation cancelled)*";
                                }
                                delete lastMessage.follow_ups;
                            }
                            if (!wasCancelled && wasLastQueryFromVoiceRef.current) {
                                setWasLastQueryFromVoice(false);
                            }
                        }
                        return newMessages;
                    });
                    setStatus(wasCancelled ? 'Generation cancelled.' : 'Ready');
                });

                newSocket.on('clarification', (data) => {
                    setIsThinking(false);
                    setIsGenerating(false);
                    const clarificationMessage = {
                        role: 'assistant',
                        content: data.data.question,
                        clarification_options: data.data.options,
                        isComplete: true,
                    };
                    setMessages(prev => [...prev, clarificationMessage]);
                    setStatus('Awaiting clarification...');
                    setIsAwaitingClarification(true);
                });

                newSocket.on('error', (data) => {
                    console.error("Socket Error:", data.message);
                    setStatus(`Error: ${data.message}`);
                    setIsThinking(false);
                    setIsGenerating(false);
                    setPythonStatus(null);
                });

                newSocket.on('python_status', (data) => {
                    // Don't clear thinking state immediately for python_status
                    // Let it continue showing the running man icon
                    setPythonStatus(data);
                    if (data.status === 'generating_code') {
                        setStatus(`Generating code (Attempt ${data.attempt})...`);
                    } else if (data.status === 'security_check') {
                        setStatus('Performing security check...');
                    } else if (data.status === 'executing_code') {
                        setStatus('Executing Python code...');
                    }
                });

                newSocket.on('python_result', (data) => {
                    setPythonStatus(null);
                    setStatus('Ready');
                    setIsGenerating(false);
                    
                    let newAssistantMessage;
                    const baseMessage = {
                        role: 'assistant',
                        code: data.code,
                        explanation: data.explanation,
                        isComplete: true,
                    };
                    if (data.html_plots) {
                        newAssistantMessage = { ...baseMessage, content: ``, html_plots: data.html_plots, html_plot_paths: data.html_plot_paths };
                    } else if (data.images) {
                        newAssistantMessage = { ...baseMessage, content: ``, images: data.images };
                    } else if (data.table) {
                        newAssistantMessage = { ...baseMessage, content: '', table: data.table };
                    } else if (data.single_value) {
                        newAssistantMessage = { ...baseMessage, content: '', single_value: data.single_value };
                    } else {
                        newAssistantMessage = { ...baseMessage, content: `${data.output}` };
                    }
                    setMessages(prev => [...prev, newAssistantMessage]);
                    
                    // Clear thinking state after message is added
                    setIsThinking(false);
                });

                newSocket.on('python_error', (data) => {
                    setPythonStatus(null);
                    setStatus('Error during Python execution. See details below.');
                    setIsGenerating(false);
                    
                    const errorMessage = {
                        role: 'assistant',
                        content: data.error,
                        code: data.code,
                        error_details: data.error_details,
                        isComplete: true,
                        isError: true,
                    };
                    setMessages(prev => [...prev, errorMessage]);
                    
                    // Clear thinking state after message is added
                    setIsThinking(false);
                });

                newSocket.on('rag_status', (data) => {
                    if (data.status === 'ready') {
                        setIsProcessingRag(false);
                        // Clear the chat history instead of showing a message
                        setMessages([]);
                        setStatus('Ready');
                        processingMessageIdRef.current = null; // Reset the ref
                    }
                });

                // This handles the new 'image' event from the backend
                newSocket.on('image', (data) => {
                    setIsThinking(false);
                    setIsGenerating(false);

                    if (data.image_b64) {
                        setLastImageB64(data.image_b64);
                    }

                    setMessages(prev => {
                        const newMessages = [...prev];
                        const lastMessage = newMessages[newMessages.length - 1];

                        // Check if the last message is an incomplete placeholder from 'answer_meta' for image generation
                        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.source_mode === 'image_generation' && !lastMessage.isComplete) {
                            // Update the placeholder message with the image details
                            lastMessage.imageUrl = data.url;
                            lastMessage.image_b64 = data.image_b64;
                            lastMessage.extended_prompt = data.extended_prompt;
                            lastMessage.isComplete = true;
                            lastMessage.content = ''; // Ensure content is empty
                        } else {
                            // Fallback: if no suitable placeholder, create a new message
                            const newImageMessage = {
                                role: 'assistant',
                                content: '', // No text content for image messages
                                imageUrl: data.url,
                                image_b64: data.image_b64,
                                extended_prompt: data.extended_prompt,
                                isComplete: true,
                                source_mode: 'image_generation', // Explicitly set for the new message
                            };
                            newMessages.push(newImageMessage);
                        }
                        return newMessages;
                    });
                    setStatus('Ready');
                });


            } catch (error) {
                console.error("Could not acquire token or connect to socket:", error);
                setStatus("Authentication failed. Please try refreshing the page.");
                // Optionally, trigger a full page reload or a redirect to the login page
                // instance.loginRedirect(loginRequest);
            }
        };

        acquireTokenAndConnect();

        return () => {
            if (socket) {
                socket.close();
            }
        };
    }, [instance, accounts]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Effect to automatically enable "Web" when web_search feature is turned on
    useEffect(() => {
        // Check if web_search was turned on (from false to true)
        if (previousFeatures.web_search === false && features.web_search === true) {
            // Automatically add "Web" to selected fields if it's available and not already selected
            if (knowledgeFields.includes('Web') && !selectedFields.includes('Web')) {
                setSelectedFields(prev => [...prev, 'Web']);
            }
        }
        
        // Update previousFeatures for next comparison
        setPreviousFeatures(features);
    }, [features, knowledgeFields, selectedFields, previousFeatures]);

    // Event handler for knowledge base update from AdminDialog
    useEffect(() => {
        const handleUpdateKnowledgeBase = () => {
            if (socket) {
                setStatus('Updating knowledge base...');
                socket.emit('update_knowledge_base', {});
            }
        };

        const handleFeaturesUpdated = () => {
            // Reload knowledge fields and features when features are updated
            if (accessToken) {
                fetch(`${API_URL}/knowledge_fields`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    },
                })
                .then(response => response.json())
                .then(data => {
                    if (data.fields) {
                        setKnowledgeFields(data.fields);
                        // Update selected fields to only include available ones
                        setSelectedFields(prev => prev.filter(field => data.fields.includes(field)));
                    } else {
                        setKnowledgeFields([]);
                        setSelectedFields([]);
                    }
                })
                .catch(error => console.error('Error reloading knowledge fields:', error));

                // Also reload features
                fetch(`${API_URL}/admin/features`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    },
                })
                .then(response => response.json())
                .then(data => {
                    setFeatures(data);
                })
                .catch(error => console.error('Error reloading features:', error));
            }
        };

        window.addEventListener('updateKnowledgeBase', handleUpdateKnowledgeBase);
        window.addEventListener('featuresUpdated', handleFeaturesUpdated);
        return () => {
            window.removeEventListener('updateKnowledgeBase', handleUpdateKnowledgeBase);
            window.removeEventListener('featuresUpdated', handleFeaturesUpdated);
        };
    }, [socket, accessToken]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleSendMessage = async (e, messageOverride, isFromVoice = false) => {
        if (e) e.preventDefault();
        window.speechSynthesis.cancel(); // Stop any ongoing speech
        const messageToSend = messageOverride || inputValue;

        if (messageToSend.trim() && socket) {
            // If we have a loaded history entry, delete it now (when user sends a new message)
            if (loadedHistoryId) {
                try {
                    await fetch(`${API_URL}/chat_history/${loadedHistoryId}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                        },
                    });
                    setLoadedHistoryId(null); // Clear the loaded history ID
                } catch (error) {
                    console.error('Error deleting loaded history entry:', error);
                }
            }

            setWasLastQueryFromVoice(isFromVoice); // Set the flag
            if (isFromVoice) {
                speak("Einen Moment, ich schaue, was ich dazu herausfinden kann");
            }
            const userMessage = { role: 'user', content: messageToSend };
            setMessages(prev => [...prev, userMessage]);
            
            // Decide which event to emit based on the chat mode
            if (chatMode === 'document_chat' || chatMode === 'image_chat') {
                 const payload = {
                    message: messageToSend,
                    // For RAG, documentContent is not sent with every question.
                    // The backend knows about the RAG session.
                    documentContent: sourceMode === 'rag_document' ? null : uploadedFileContent,
                    documentName: uploadedFileName,
                    documentHeader: uploadedFileHeader,
                    fileType: uploadedFileType
                };
                socket.emit('document_question', payload);
            } else {
                 const payload = {
                    message: messageToSend,
                    selected_fields: selectedFields,
                    image_b64: lastImageB64, // Send the last image for refinement
                };
                 // Check for special commands when no document is uploaded
                if (messageToSend.trim().toLowerCase().startsWith("/py")) {
                    socket.emit('python_code_request', payload);
                } else {
                    socket.emit('chat_message', payload);
                }
            }

            setStatus('Thinking...');

            setInputValue('');
            setIsThinking(true);
            setIsGenerating(true);
            setIsCancelling(false); // Reset cancelling state
        }
    };

    const handleFollowUpClick = (question) => {
        // We can reuse handleSendMessage now
        handleSendMessage(null, question, false); // Follow-ups are not from voice
        setStatus('Thinking...'); // handleSendMessage sets this, but let's be explicit
        setIsAwaitingClarification(false);
    };

    const handleNewDialog = () => {
        // Check if current chat is saveable and auto-save it before starting new dialog
        if (messages.length >= 2 && chatMode === 'knowledge_base' && !uploadedFileContent) {
            // Check for content that should prevent saving (files, generated content, etc.)
            const hasUnsaveableContent = messages.some(msg => 
                msg.imagePreview || msg.imageUrl || msg.image_b64 ||
                msg.table || msg.images || msg.html_plots ||
                msg.file || msg.code
            );

            // Check if we have basic text content
            const hasValidContent = messages.some(msg => 
                msg.role === 'user' && msg.content && typeof msg.content === 'string' && msg.content.trim()
            );

            if (!hasUnsaveableContent && hasValidContent) {
                // Auto-save current chat before starting new dialog
                const title = messages.find(msg => msg.role === 'user')?.content?.substring(0, 47) + "..." || "Auto-saved Chat";
                
                fetch(`${API_URL}/chat_history/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({
                        title: title,
                        messages: messages,
                        selected_fields: selectedFields
                    }),
                })
                .then(response => {
                    if (response.ok) {
                        console.log('Chat automatically saved before new dialog');
                    } else {
                        console.error('Failed to save chat:', response.status);
                    }
                })
                .catch(error => console.error('Error auto-saving current chat:', error));
            } else {
                console.log('Chat not saved - contains unsaveable content or no valid content');
            }
        }

        window.speechSynthesis.cancel(); // Stop any ongoing speech
        if (socket) {
            socket.emit('new_dialog');
        }
        setMessages([]);
        setMessageRatings({}); // Clear message ratings for new dialog
        setUploadedFileName('');
        setUploadedFileContent('');
        setUploadedFileType('');
        setUploadedFileHeader(null);
        setUploadedImagePreview(''); // Reset image preview
        setLastImageB64(null); // Clear the last generated image
        setChatMode('knowledge_base');
        setSourceMode(null); // Reset the icon
        if (fileInputRef.current) {
            fileInputRef.current.value = null;
        }
        setIsAwaitingClarification(false);
        setStatus('Ready');
    };

    const handleFieldSelection = (field) => {
        if (field === '__all__') {
            setSelectedFields(prev =>
                prev.length === knowledgeFields.length ? [] : [...knowledgeFields]
            );
        } else {
            setSelectedFields(prev =>
                prev.includes(field)
                    ? prev.filter(f => f !== field)
                    : [...prev, field]
            );
        }
    };

    const handleCancelGeneration = () => {
        if (socket && isGenerating) {
            socket.emit('cancel_generation');
            setIsCancelling(true);
            setStatus('Cancelling...');
        }
    };

    const handleUpdateKnowledgeBase = () => {
        setIsConfirmDialogOpen(true);
    };

    const executeKnowledgeBaseUpdate = () => {
        if (socket) {
            setStatus('Updating knowledge base...');
            socket.emit('update_knowledge_base', {});
        }
        setIsConfirmDialogOpen(false);
    };

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Handle image files with resizing on the client-side
        if (file.type.startsWith('image/')) {
            // Check if image upload is enabled
            if (!features.image_upload) {
                setStatus('Error: Image upload is currently disabled');
                if (fileInputRef.current) {
                    fileInputRef.current.value = null;
                }
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const MAX_DIMENSION = 2048; // Max width or height
                    let { width, height } = img;
                    let resizedBase64 = e.target.result;

                    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                        if (width > height) {
                            height = Math.round((height * MAX_DIMENSION) / width);
                            width = MAX_DIMENSION;
                        } else {
                            width = Math.round((width * MAX_DIMENSION) / height);
                            height = MAX_DIMENSION;
                        }

                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        // Preserve the original file type
                        resizedBase64 = canvas.toDataURL(file.type);
                    }

                    setUploadedImagePreview(resizedBase64);
                    setUploadedFileContent(resizedBase64.split(',')[1]);
                    setUploadedFileName(file.name);
                    setUploadedFileType(file.type);
                    setChatMode('image_chat');
                    setSourceMode(null);

                    const newFileMessage = {
                        role: 'assistant',
                        content: `I've loaded the image **${file.name}**. What would you like to know about it?`,
                        imagePreview: resizedBase64,
                    };
                    setMessages(prev => [...prev, newFileMessage]);
                    setStatus('Ready');
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
            return;
        }

        // Existing logic for other file types
        const formData = new FormData();
        formData.append('file', file);
        setStatus('Uploading and processing file...');
        try {
            const { loginRequest } = await import('./authConfig');
            const request = {
                ...loginRequest,
                account: accounts[0]
            };
            const { accessToken } = await instance.acquireTokenSilent(request);

            const response = await fetch(`${API_URL}/uploadfile/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
                body: formData,
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'File upload failed');
            }
            const data = await response.json();
            let newFileMessage;

            if (data.type === 'rag_document') {
                // New RAG document flow
                setUploadedFileName(data.filename);
                setUploadedFileType('rag_document'); // Set the file type for the icon
                setChatMode('document_chat'); // Use the same chat mode
                setSourceMode(null);
                setIsProcessingRag(true);
                setStatus('Preparing document for analysis...');
                
                // Emit an event to the backend to start processing
                socket.emit('process_document_for_rag', { temp_path: data.temp_path });

                const messageId = `rag-proc-${Date.now()}`;
                processingMessageIdRef.current = messageId; // Set the ref's current value
                newFileMessage = {
                    id: messageId,
                    role: 'assistant',
                    content: `I've loaded the document **${data.filename}**. I'm preparing it for your questions. This may take a moment...`,
                    fileName: data.filename, // Store filename for later use
                };

            } else if (data.type === 'table_data') {
                const { columns, data: tableRows } = data.data;
                const header = `| ${columns.join(' | ')} |`;
                const separator = `| ${columns.map(() => '---').join(' | ')} |`;
                const rows = tableRows.map(row => `| ${row.map(String).join(' | ')} |`).join('\n');
                const markdownContent = `${header}\n${separator}\n${rows}`;

                setUploadedFileContent(markdownContent);
                setUploadedFileHeader(columns);
                setUploadedFileType('table');
                newFileMessage = {
                    role: 'assistant',
                    content: `I have read the file ${data.filename}. What do you want to know about it?`,
                    table: data.data,
                };

            } else if (data.type === 'text' || data.type === 'sql') {
                setUploadedFileContent(data.content);
                setUploadedFileHeader(null);
                setUploadedFileType(data.type);
                newFileMessage = {
                    role: 'assistant',
                    content: `I have read the file ${data.filename}. What do you want to know about it?`,
                    file: { type: data.type, content: data.content },
                };
            }
            
            setUploadedFileName(data.filename);
            setChatMode('document_chat');
            setSourceMode(null);
            
            if (newFileMessage) {
                setMessages(prev => [...prev, newFileMessage]);
            }
            setStatus('Ready');
        } catch (error) {
            console.error('File upload error:', error);
            setStatus(`Error: ${error.message}`);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current.click();
    };

    const handleToggleRecording = () => {
        try {
            if (isRecording) {
                clearTimeout(silenceTimerRef.current); // Clear any pending send message
                speechRecognitionRef.current?.stop();
                return; // onend will handle setting isRecording to false
            }
            
            window.speechSynthesis.cancel(); // Stop any ongoing speech before starting a new recording
    
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                setStatus("Error: Speech recognition not supported by this browser.");
                return;
            }
    
            // Create and configure the recognition object
            const recognition = new SpeechRecognition();
            recognition.lang = 'de-DE'; // Setting language to German
            recognition.continuous = true; // Continuous listening is needed for silence detection
            recognition.interimResults = true; // Interim results are useful for real-time feedback
            speechRecognitionRef.current = recognition;
    
            // Define event handlers before starting
            recognition.onstart = () => {
                setIsRecording(true);
                setInputValue(''); 
            };
    
            recognition.onresult = (event) => {
                clearTimeout(silenceTimerRef.current);

                let transcript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    transcript += event.results[i][0].transcript;
                }
                setInputValue(transcript);

                if (event.results[event.results.length - 1].isFinal) {
                    silenceTimerRef.current = setTimeout(() => {
                        const finalTranscript = inputValueRef.current;
                        if (finalTranscript.trim()) {
                            handleSendMessage(null, finalTranscript, true); // Indicate this is from voice
                        }
                        // Stop recognition after sending
                        if (isRecording) {
                           speechRecognitionRef.current?.stop();
                        }
                    }, 1000); // 1-second delay
                }
            };
    
            recognition.onerror = (event) => {
                console.error("Speech Recognition Error:", event.error);
                let errorMessage = `Speech Error: ${event.error}`;
                if (event.error === 'not-allowed') {
                    errorMessage = "Speech Error: Microphone access was denied.";
                } else if (event.error === 'language-not-supported') {
                    errorMessage = "Speech Error: The configured language is not supported.";
                }
                setStatus(errorMessage);
            };
    
            recognition.onend = () => {
                setIsRecording(false);
                // The recognition service has disconnected.
            };
    
            // Start recognition
            recognition.start();
        } catch (err) {
            console.error("Failed to start speech recognition:", err);
            setStatus("Error: Could not start speech recognition.");
            setIsRecording(false);
        }
    };

    const handleToggleFavorite = (question) => {
        // Determine the group ID. If no groups exist, send -1 to let the backend create one.
        // Otherwise, use the first group as the default.
        const groupId = favoriteGroups.length > 0 ? favoriteGroups[0].id : -1;

        // No need to check for a specific "Favorites" group on the client-side.
        fetch(`${API_URL}/favorites/questions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ question: question, group_id: groupId }),
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.detail || 'Failed to add favorite'); });
            }
            return response.json();
        })
        .then(response => {
            if (response.status === "exists") {
                console.log('Favorite already exists:', response);
            } else {
                console.log('Favorite added successfully:', response);
                // Optionally, trigger a refetch or update the state to reflect the new favorite.
                // For simplicity, we can rely on the panel refetching when opened.
            }
        })
        .catch(error => console.error('Error adding favorite:', error));
    };

    const handleSelectFavorite = (question) => {
        setInputValue(question);
        setIsFavoritesPanelOpen(false);
        // Focus the input and move cursor to the end
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(question.length, question.length);
            }
        }, 0);
    };

    const handleToggleFavoritesPanel = () => {
        setIsFavoritesPanelOpen(prev => !prev);
    };

    const handleToggleHistoryPanel = () => {
        setIsHistoryPanelOpen(prev => !prev);
    };

    const handleSelectHistory = async (historyData) => {
        try {
            // Step 1: Check if current chat is saveable and auto-save it
            if (messages.length >= 2 && chatMode === 'knowledge_base' && !uploadedFileContent) {
                // Check for content that should prevent saving (files, generated content, etc.)
                const hasUnsaveableContent = messages.some(msg => 
                    msg.imagePreview || msg.imageUrl || msg.image_b64 ||
                    msg.table || msg.images || msg.html_plots ||
                    msg.file || msg.code
                );

                // Check if we have basic text content
                const hasValidContent = messages.some(msg => 
                    msg.role === 'user' && msg.content && typeof msg.content === 'string' && msg.content.trim()
                );

                if (!hasUnsaveableContent && hasValidContent) {
                    // Auto-save current chat before loading new one
                    const title = messages.find(msg => msg.role === 'user')?.content?.substring(0, 47) + "..." || "Auto-saved Chat";
                    
                    await fetch(`${API_URL}/chat_history/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`,
                        },
                        body: JSON.stringify({
                            title: title,
                            messages: messages,
                            selected_fields: selectedFields
                        }),
                    });
                }
            }

            // Step 2: Load the selected history (but don't delete it yet)
            setMessages(historyData.messages);
            setSelectedFields(historyData.selected_fields || []);
            setLoadedHistoryId(historyData.id); // Remember which history entry we loaded
            setMessageRatings({}); // Clear message ratings when loading history
            setChatMode('knowledge_base');
            setSourceMode(null);
            setUploadedFileName('');
            setUploadedFileContent('');
            setUploadedFileType('');
            setUploadedFileHeader(null);
            setUploadedImagePreview('');
            setLastImageB64(null);
            
            if (fileInputRef.current) {
                fileInputRef.current.value = null;
            }
            
            // Send loaded conversation history to backend
            if (socket && historyData.messages && historyData.messages.length > 0) {
                socket.emit('load_conversation_history', {
                    messages: historyData.messages,
                    selected_fields: historyData.selected_fields || []
                });
            }
            
            setStatus('Chat history loaded');
        } catch (error) {
            console.error('Error handling chat history selection:', error);
            setStatus('Error loading chat history');
        }
    };

    const handleLogout = () => {
        instance.logoutRedirect().catch(e => {
            console.error(e);
        });
    };

    const handleWipeChat = () => {
        if (socket) {
            // Tell backend to clear the session messages for a fresh start
            socket.emit('clear_chat_display');
        }
        setMessages([]);
        setMessageRatings({}); // Clear message ratings when wiping chat
        setLastImageB64(null); // Discard the image for refinement
        setStatus('Chat cleared. Ready for new conversation.');
    };

    const handleExportPDF = async () => {
        if (messages.length === 0) {
            return;
        }

        try {
            const { loginRequest } = await import('./authConfig');
            const request = {
                ...loginRequest,
                account: accounts[0]
            };
            const { accessToken } = await instance.acquireTokenSilent(request);

            const response = await fetch(`${API_URL}/export/pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({ messages }),
            });

            if (!response.ok) {
                throw new Error('Failed to export PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'chat_export.pdf';
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (error) {
            console.error('PDF export error:', error);
            setStatus(`Error: ${error.message}`);
        }
    };

    const handleRateAnswer = async (messageIndex, rating) => {
        try {
            // Get the question ID from the assistant message itself
            const assistantMessage = messages[messageIndex];
            console.log('Attempting to rate message:', assistantMessage);
            
            if (!assistantMessage || assistantMessage.role !== 'assistant') {
                console.error('Message is not an assistant message');
                return;
            }

            const questionId = assistantMessage.questionId;
            console.log('Question ID found:', questionId);
            
            if (!questionId) {
                console.error('Question ID not found for rating - this may be an older message');
                // Show a visual feedback that rating is not available for this message
                setStatus('Rating not available for this message');
                return;
            }

            const response = await fetch(`${API_URL}/chat_questions/rate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    question_id: questionId,
                    rating: rating
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to rate answer');
            }

            // Update the local state to show the rating was successful
            setMessageRatings(prev => ({
                ...prev,
                [messageIndex]: rating
            }));

            console.log(`Answer rated as ${rating}`);
            setStatus(`Answer rated as ${rating}`);
        } catch (error) {
            console.error('Error rating answer:', error);
            setStatus(`Error: ${error.message}`);
        }
    };

    const handleToggleSidebar = () => {
        setIsSidebarExpanded(prev => !prev);
    };

    const isChatDisabled = !socket || status.includes('Thinking') || status.includes('Updating') || status.includes('Uploading') || isRecording || isProcessingRag || isAwaitingClarification;

    // Generate dynamic file accept string based on available features
    const getFileAcceptString = () => {
        const acceptedTypes = [];
        
        if (features.xlsx_csv_analysis) {
            acceptedTypes.push('.csv', '.xlsx');
        }
        if (features.pdf_docx_upload) {
            acceptedTypes.push('.docx', '.pdf');
        }
        if (features.txt_sql_upload) {
            acceptedTypes.push('.txt', '.sql');
        }
        if (features.image_upload) {
            acceptedTypes.push('.png', '.jpg', '.jpeg', '.gif', '.webp');
        }
        
        return acceptedTypes.length > 0 ? acceptedTypes.join(',') : '';
    };

    const preprocessContent = (content) => {
        if (!content) return '';
        // This regex finds all markdown links like [1](url) and replaces them with HTML anchor tags.
        // This ensures they are rendered as links even if they are near or inside code blocks.
        const regex = /\[(\d+)\]\(([^)]+)\)/g;
        return content.replace(regex, '<a href="$2" target="_blank" rel="noopener noreferrer">[$1]</a>');
    };

    return (
        <div className="app-container">
            <ConfirmDialog
                isOpen={isConfirmDialogOpen}
                onClose={() => setIsConfirmDialogOpen(false)}
                onConfirm={executeKnowledgeBaseUpdate}
                title="Update Knowledge Base"
            >
                <p>This process can take a very long time. Do you really want to start the process?</p>
            </ConfirmDialog>
            <aside className={`sidebar ${isSidebarExpanded ? 'expanded' : 'collapsed'}`}>
                <div className="sidebar-header">
                    <img src="/S4ULogo.png" alt="Logo" className="logo" />
                    {isSidebarExpanded && <h2>Everything Buddy</h2>}
                </div>
                {isWindowWideEnough && (
                    <div className="sidebar-toggle-container">
                        <button 
                            className="sidebar-toggle-btn" 
                            onClick={handleToggleSidebar}
                            title={isSidebarExpanded ? "Collapse navigation" : "Expand navigation"}
                        >
                            <span className="hamburger-icon">
                                <span></span>
                                <span></span>
                                <span></span>
                            </span>
                        </button>
                    </div>
                )}
                <div className="sidebar-actions">
                    <button onClick={handleNewDialog} title="New Dialog">
                        <img src={newDialogIcon} alt="New Dialog" className="sidebar-action-icon" />
                        {isSidebarExpanded && <span className="sidebar-action-text">New Dialog</span>}
                    </button>
                    {isAdmin && (
                        <button 
                            onClick={() => setIsAdminDialogOpen(true)} 
                            disabled={!!uploadedFileContent}
                            title={uploadedFileContent ? "Administration ist während der Dateianalyse nicht verfügbar" : "Administration"}
                        >
                            <img src={updateKBIcon} alt="Administration" className="sidebar-action-icon" />
                            {isSidebarExpanded && <span className="sidebar-action-text">Administration</span>}
                        </button>
                    )}
                    {!isSidebarExpanded && (
                        <button onClick={() => setIsKnowledgeFieldModalOpen(true)} disabled={!!uploadedFileContent} title="Knowledge Fields">
                            <img src={knowledgeFieldsIcon} alt="Knowledge Fields" className="sidebar-action-icon" />
                        </button>
                    )}
                </div>

                {isSidebarExpanded && (
                    uploadedFileName ? (
                        <div className="sidebar-knowledge-fields-desktop">
                            <h4>Uploaded File</h4>
                            <p className="uploaded-file-name" title={uploadedFileName}>
                                {uploadedFileName}
                            </p>
                        </div>
                    ) : (
                        <div className="sidebar-knowledge-fields-desktop">
                            <h4>
                                <img src={knowledgeFieldsIcon} alt="Knowledge Fields" className="sidebar-action-icon" />
                                Knowledge Fields
                            </h4>
                            <div className="knowledge-fields-body">
                                <MultiSelectDropdown
                                    options={knowledgeFields}
                                    selectedOptions={selectedFields}
                                    onChange={handleFieldSelection}
                                    isDisabled={isChatDisabled}
                                />
                            </div>
                        </div>
                    )
                )}

                {isKnowledgeFieldModalOpen && (
                    <div className="favorites-panel-overlay" onClick={() => setIsKnowledgeFieldModalOpen(false)}>
                        <div className="favorites-panel" onClick={e => e.stopPropagation()}>
                            <div className="favorites-panel-header">
                                <h3>Knowledge Fields</h3>
                                {/* The close button was removed as clicking the overlay serves the same purpose and the button was causing a visual glitch. */}
                            </div>
                            <div className="knowledge-fields-modal-content">
                                <MultiSelectDropdown
                                    options={knowledgeFields}
                                    selectedOptions={selectedFields}
                                    onChange={handleFieldSelection}
                                    isDisabled={isChatDisabled}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {isSidebarExpanded && (
                    <div className="sidebar-status">
                        <div className="status-line">
                            <strong>Status:</strong> {status}
                        </div>
                        <div className="mode-icon-container">
                            {sourceMode === 'rag_document' ? (
                                <img src={localFileIcon} alt="Local Document RAG Mode" title="Local Document RAG Mode" />
                            ) : chatMode === 'image_chat' ? (
                                <img src={imageIcon} alt="Image Analysis Mode" title="Image Analysis Mode" />
                            ) : chatMode === 'document_chat' ? (
                                (uploadedFileType === 'text' || uploadedFileType === 'sql') ? (
                                    <img src={textFileIcon} alt="Text/SQL File Mode" title="Text/SQL File Mode" />
                                ) : (uploadedFileType === 'rag_document') ? (
                                    <img src={docFileIcon} alt="Document File Mode" title="Document File Mode" />
                                ) : (
                                    <img src={fileAnalysisIcon} alt="File Analysis Mode" title="File Analysis Mode" />
                                )
                            ) : sourceMode === 'web_search' ? (
                                <img src={webIcon} alt="Web Search Mode" title="Web Search Mode" />
                            ) : sourceMode === 'image_generation' ? (
                                <img src={pinselIcon} alt="Image Generation Mode" title="Image Generation Mode" />
                            ) : sourceMode === 'vector_store' ? (
                                <img src={documentationIcon} alt="Documentation Mode" title="Documentation Mode" />
                            ) : null}
                        </div>
                    </div>
                )}
                <div className="sidebar-user">
                    {!isSidebarExpanded && (
                        <div className="mobile-mode-icon">
                            {sourceMode === 'rag_document' ? (
                                <img src={localFileIcon} alt="Local Document RAG Mode" title="Local Document RAG Mode" />
                            ) : chatMode === 'image_chat' ? (
                                <img src={imageIcon} alt="Image Analysis Mode" title="Image Analysis Mode" />
                            ) : chatMode === 'document_chat' ? (
                                (uploadedFileType === 'text' || uploadedFileType === 'sql') ? (
                                    <img src={textFileIcon} alt="Text/SQL File Mode" title="Text/SQL File Mode" />
                                ) : (uploadedFileType === 'rag_document') ? (
                                    <img src={docFileIcon} alt="Document File Mode" title="Document File Mode" />
                                ) : (
                                    <img src={fileAnalysisIcon} alt="File Analysis Mode" title="File Analysis Mode" />
                                )
                            ) : sourceMode === 'web_search' ? (
                                <img src={webIcon} alt="Web Search Mode" title="Web Search Mode" />
                            ) : sourceMode === 'image_generation' ? (
                                <img src={pinselIcon} alt="Image Generation Mode" title="Image Generation Mode" />
                            ) : sourceMode === 'vector_store' ? (
                                <img src={documentationIcon} alt="Documentation Mode" title="Documentation Mode" />
                            ) : null}
                        </div>
                    )}
                    {accounts && accounts.length > 0 && (
                        <div className="user-info" onClick={handleLogout} title="Logout">
                            <img src={logoutIcon} alt="Logout" className="sidebar-action-icon" />
                            {isSidebarExpanded && <span>Logout</span>}
                        </div>
                    )}
                </div>
            </aside>
            <main className="chat-area">
                <div className="chat-history">
                                {messages.map((msg, index) => (
                        <div key={msg.id || index} className={`chat-message ${msg.role} ${msg.html_plots || msg.images ? 'chart-message' : ''}`}>
                            <div className={`message-content ${msg.imageUrl ? 'image-only-message' : ''}`}>
                                {msg.imagePreview && (
                                    <div className="image-preview-container">
                                        <img src={msg.imagePreview} alt="Uploaded Preview" className="image-preview" />
                                    </div>
                                )}
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    rehypePlugins={[rehypeRaw]}
                                >
                                    {preprocessContent(msg.content)}
                                </ReactMarkdown>
                                {msg.role === 'user' && (
                                    <button onClick={() => handleToggleFavorite(msg.content)} className="favorite-btn" title={favoriteGroups.some(g => g.questions.some(q => q.question === msg.content)) ? "Remove from favorites" : "Add to favorites"}>
                                        <img src={favoriteGroups.some(g => g.questions.some(q => q.question === msg.content)) ? starFullIcon : starIcon} alt="Favorite" />
                                    </button>
                                )}
                                {msg.explanation && msg.html_plots && <p className="explanation-text">{msg.explanation}</p>}
                                {msg.html_plots && (
                                    <div className="plot-gallery">
                                        {msg.html_plots.map((plot_html, i) => (
                                            <iframe
                                                key={i}
                                                srcDoc={plot_html}
                                                title={`Generated Plot ${i + 1}`}
                                                className="plotly-iframe"
                                                sandbox="allow-scripts"
                                            />
                                        ))}
                                    </div>
                                )}
                                {msg.images && (
                                    <div className="image-gallery">
                                        {msg.images.map((img_b64, i) => (
                                            <img key={i} src={`data:image/png;base64,${img_b64}`} alt={`Generated Chart ${i + 1}`} />
                                        ))}
                                    </div>
                                )}
                                {msg.extended_prompt && <p className="explanation-text">{msg.extended_prompt}</p>}
                                {msg.imageUrl && (
                                    <div className="generated-image-container">
                                        <img src={msg.imageUrl} alt="Generated Content" className="generated-image" onLoad={scrollToBottom} />
                                    </div>
                                )}
                                {msg.table && <CollapsibleTable data={msg.table} explanation={msg.explanation} />}
                                {msg.single_value && <CollapsibleSingleValue value={msg.single_value} />}
                                {msg.file && msg.file.type === 'table' && <CollapsibleTable content={msg.file.content} />}
                                {msg.file && (msg.file.type === 'text' || msg.file.type === 'sql') && (
                                    <CollapsibleCode
                                        code={msg.file.content}
                                        language={msg.file.type === 'sql' ? 'sql' : 'text'}
                                    />
                                )}
                                {msg.code && <CollapsibleCode code={msg.code} errorDetails={msg.error_details} language="python" />}
                                {msg.sources && msg.sources.length > 0 && chatMode !== 'document_chat' && chatMode !== 'image_chat' && msg.isComplete && <CollapsibleSources sources={msg.sources} />}
                                {msg.follow_ups && msg.follow_ups.length > 0 && msg.isComplete && !msg.isError && index === messages.length - 1 && !inputValue && (
                                     <div className="follow-ups">
                                         <h4>You might also be interested in:</h4>
                                         <div className="follow-up-buttons">
                                             {msg.follow_ups.map((q, i) => (
                                                 <button key={i} onClick={() => handleFollowUpClick(q)}>{q}</button>
                                             ))}
                                         </div>
                                     </div>
                                )}
                                {msg.clarification_options && msg.clarification_options.length > 0 && (
                                     <div className="follow-ups">
                                         <div className="follow-up-buttons">
                                             {msg.clarification_options.map((q, i) => (
                                                 <button key={i} onClick={() => handleFollowUpClick(q)}>{q}</button>
                                             ))}
                                         </div>
                                     </div>
                                )}
                            </div>
                            {/* Rating buttons for assistant messages */}
                            {msg.role === 'assistant' && msg.isComplete && !msg.isError && msg.content && (
                                <div className="rating-buttons">
                                    <button 
                                        onClick={() => handleRateAnswer(index, 'good')}
                                        className={`rating-btn ${messageRatings[index] === 'good' ? 'rated good' : ''}`}
                                        disabled={messageRatings[index] && messageRatings[index] !== 'good'}
                                        title="Rate this answer as good"
                                    >
                                        <img src={goodIcon} alt="Good" />
                                    </button>
                                    <button 
                                        onClick={() => handleRateAnswer(index, 'poor')}
                                        className={`rating-btn ${messageRatings[index] === 'poor' ? 'rated poor' : ''}`}
                                        disabled={messageRatings[index] && messageRatings[index] !== 'poor'}
                                        title="Rate this answer as poor"
                                    >
                                        <img src={badIcon} alt="Poor" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                    {isThinking && (
                        <div className="chat-message assistant">
                            <div className="message-content thinking-indicator">
                                {isCancelling ? (
                                    <p>Cancelling...</p>
                                ) : (
                                    <div className="working-indicator">
                                        <img src="/running.gif" alt="Working" className="working-gif" />
                                        <p>Working on it...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <FavoritesPanel
                    isOpen={isFavoritesPanelOpen}
                    onClose={handleToggleFavoritesPanel}
                    onSelectFavorite={handleSelectFavorite}
                    token={accessToken}
                />

                <HistoryPanel
                    isOpen={isHistoryPanelOpen}
                    onClose={handleToggleHistoryPanel}
                    onSelectHistory={handleSelectHistory}
                    token={accessToken}
                />

                <AdminDialog
                    isOpen={isAdminDialogOpen}
                    onClose={() => setIsAdminDialogOpen(false)}
                    accessToken={accessToken}
                />

                <div className="chat-action-buttons" style={{ bottom: `${inputAreaHeight + 10}px` }}>
                    <button onClick={handleWipeChat} className="wipe-chat-btn" disabled={messages.length === 0} title="Wipe chat content">
                        <img src={wipeIcon} alt="Wipe Chat" />
                    </button>
                    <button onClick={handleExportPDF} className="pdf-export-btn" disabled={messages.length === 0} title="Export chat to PDF">
                        <img src={pdfIcon} alt="Export PDF" />
                    </button>
                    <button onClick={handleToggleHistoryPanel} className="history-panel-btn" title="Show Chat History">
                        <img src={historyIcon} alt="Show History" />
                    </button>
                    <button onClick={handleToggleFavoritesPanel} className="favorites-panel-btn" title="Show Favorites">
                        <img src={favoritesIcon} alt="Show Favorites" />
                    </button>
                </div>

                <div className="chat-input-area" ref={chatInputAreaRef}>
                    <form className="chat-input-form" onSubmit={handleSendMessage}>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                            accept={getFileAcceptString()}
                        />
                        <textarea
                            ref={textareaRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(e);
                                }
                            }}
                            placeholder={
                                isRecording
                                    ? 'Listening...'
                                    : chatMode === 'image_chat'
                                    ? 'Ask about the image...'
                                    : uploadedFileContent
                                    ? 'Ask about the document...'
                                    : 'Ask your question...'
                            }
                            disabled={isChatDisabled}
                            rows="1"
                        />
                        {isGenerating && !isCancelling ? (
                            <button type="button" onClick={handleCancelGeneration} className="cancel-btn" title="Cancel Generation">
                                <img src={cancelIcon} alt="Cancel" />
                            </button>
                        ) : (
                            <button type="button" onClick={triggerFileInput} className="upload-btn" disabled={isChatDisabled}>
                                +
                            </button>
                        )}
                        <button 
                            type="button" 
                            onClick={handleToggleRecording} 
                            className={`record-btn ${isRecording ? 'recording' : ''}`}
                            disabled={isChatDisabled && !isRecording}
                        >
                            <img src={microphoneIcon} alt="Record" />
                        </button>
                        <button type="submit" disabled={!socket || !inputValue.trim() || isChatDisabled}>Send</button>
                    </form>
                </div>
            </main>
        </div>
    );
}

function App() {
    return (
        <>
            <AuthenticatedTemplate>
                <MainContent />
            </AuthenticatedTemplate>
            <UnauthenticatedTemplate>
                <Login />
            </UnauthenticatedTemplate>
        </>
    );
}

export default App;
