# 4PLAN Everything Buddy - User Manual

## Table of Contents
1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [User Interface Overview](#user-interface-overview)
4. [Core Features](#core-features)
5. [Document Analysis](#document-analysis)
6. [Image Capabilities](#image-capabilities)
7. [Data Analysis & Python Code](#data-analysis--python-code)
8. [Knowledge Management](#knowledge-management)
9. [Chat Management](#chat-management)
10. [Voice Features](#voice-features)
11. [Export & Sharing](#export--sharing)
12. [Tips & Best Practices](#tips--best-practices)
13. [Troubleshooting](#troubleshooting)

---

## Introduction

**4PLAN Everything Buddy** is your intelligent AI assistant designed to help you work more effectively with documents, data, and information. Whether you need to analyze complex business documents, generate insights from data, create visualizations, or simply have intelligent conversations about your work, Everything Buddy is here to assist you.

### What Can Everything Buddy Do?

- **💬 Intelligent Conversations**: Ask questions in natural language and get detailed, contextual answers
- **📄 Document Analysis**: Upload and analyze PDFs, Word documents, Excel files, and more
- **🖼️ Image Processing**: Generate, analyze, and refine images using AI
- **📊 Data Analysis**: Automatically generate Python code to analyze your data and create visualizations
- **🧠 Knowledge Base Search**: Access your organization's knowledge repositories instantly
- **🌐 Web Search**: Get current information from the internet when needed
- **⭐ Personal Organization**: Save favorite questions and manage chat history

---

## Getting Started

### Accessing the Application

1. **Login**: The application uses Microsoft Azure Active Directory for secure authentication
2. **First Time**: If this is your first time, the system will automatically create your user profile
3. **Interface**: Once logged in, you'll see the main chat interface with sidebar controls

### Initial Setup

- **Knowledge Fields**: Select which knowledge bases you want to search (found in the sidebar)
- **Features**: Available features are configured by your administrator
- **Profile**: Your login and preferences are automatically managed

---

## User Interface Overview

### Main Layout

The application consists of three main areas:

#### 1. Sidebar (Left Panel)
- **Logo & Title**: "Everything Buddy" branding
- **Action Buttons**: 
  - New Dialog (start fresh conversation)
  - Administration (admin users only)
- **Knowledge Fields**: Select which knowledge bases to search
- **Status Display**: Shows current activity and mode indicators
- **User Info**: Logout option

#### 2. Chat Area (Center)
- **Message History**: All your conversations with timestamps
- **Interactive Content**: Tables, charts, images, and code blocks
- **Follow-up Suggestions**: AI-suggested related questions
- **Status Indicators**: Visual feedback on processing status

#### 3. Action Panel (Right Side)
- **File Upload**: Add documents, images, or data files
- **Voice Input**: Speak your questions (German language)
- **Chat Controls**: Export, favorites, history management

### Visual Indicators

The application uses intuitive icons to show what mode you're in:

- 🧠 **Documentation Mode**: Searching internal knowledge base
- 🌐 **Web Search Mode**: Getting current information online  
- 📁 **File Analysis Mode**: Analyzing uploaded documents
- 🖼️ **Image Mode**: Working with images
- 🎨 **Image Generation Mode**: Creating AI-generated images
- 📊 **Data Analysis Mode**: Processing tables and datasets

---

## Core Features

### 1. Natural Language Chat

**How to Use:**
- Type your question in the input field at the bottom
- Press Enter or click "Send"
- For multi-line messages, use Shift + Enter

**What You Can Ask:**
- General questions: "What is the current economic situation in Germany?"
- Specific queries: "Explain the key points from the Q3 financial report"
- Follow-up questions: "Can you elaborate on that?"
- Analysis requests: "What trends do you see in this data?"

**Smart Routing:**
The AI automatically determines the best information source:
- **Internal Knowledge**: For company-specific information
- **Web Search**: For current events or general knowledge
- **Direct Answer**: For factual questions from AI training

### 2. Knowledge Base Search

**Purpose**: Access your organization's document repositories instantly

**How to Use:**
1. Select knowledge fields in the sidebar (e.g., "4PLAN Deutsch", "S4U intern")
2. Ask questions related to those documents
3. The AI will search and provide relevant answers with source citations

**Knowledge Fields Available:**
- **4PLAN Deutsch**: German 4PLAN documentation
- **S4U intern**: Internal S4U company documents  
- **Web**: Real-time internet search
- Additional fields as configured by administrators

**Example Questions:**
- "What are the system requirements for 4PLAN?"
- "How do I configure the dashboard designer?"
- "What is our company car policy?"

---

## Document Analysis

### Supported File Types

**Documents:**
- **PDF**: Business reports, manuals, contracts
- **Word (.docx)**: Documents, procedures, guidelines
- **Text (.txt)**: Plain text files, documentation
- **SQL (.sql)**: Database scripts and queries

**Data Files:**
- **Excel (.xlsx)**: Spreadsheets, financial data, reports
- **CSV**: Data tables, exports, datasets

**Images:**
- **PNG, JPG, JPEG**: Photos, screenshots, diagrams
- **GIF, WEBP**: Graphics and illustrations

### How to Upload Files

1. **Click the "+" button** next to the input field
2. **Select your file** from the file picker
3. **Wait for processing** - you'll see a status message
4. **Start asking questions** about the content

### Document Processing Modes

**RAG (Retrieval Augmented Generation):**
- For large documents (PDFs, Word files)
- Creates searchable knowledge base from document
- Best for: Technical manuals, long reports, comprehensive documents
- Processing time: 30 seconds to 2 minutes depending on size

**Direct Analysis:**
- For smaller files and data
- Analyzes entire content at once
- Best for: Spreadsheets, short documents, data files
- Processing time: Immediate to 30 seconds

**Table Processing:**
- Automatically detects and processes tabular data
- Creates interactive, sortable tables
- Supports Excel formulas and formatting
- Can generate visualizations from data

### Example Use Cases

**Business Reports:**
- "Summarize the key findings from this quarterly report"
- "What are the main risk factors mentioned?"
- "Compare the revenue figures across regions"

**Technical Documentation:**
- "How do I install this software?"
- "What are the configuration options for this feature?"
- "Explain the API endpoints available"

**Data Analysis:**
- "What trends do you see in this sales data?"
- "Create a chart showing monthly performance"
- "Which products are performing best?"

---

## Image Capabilities

### Image Analysis

**Upload an Image:**
1. Click the "+" button and select an image file
2. The image will be displayed in the chat
3. Ask questions about what you see

**What You Can Ask:**
- "What do you see in this image?"
- "Describe the chart and its data"
- "What text is visible in this screenshot?"
- "Analyze the trends shown in this graph"

**Automatic Optimization:**
- Images are automatically resized to 2048px maximum dimension
- Maintains quality while reducing file size
- Supports all major image formats

### Image Generation

**How to Generate Images:**
1. Type a description of what you want to create
2. Use keywords like "generate", "create", "draw", or "image of"
3. The AI will create a custom image based on your description

**Example Prompts:**
- "Generate a professional chart showing quarterly sales growth"
- "Create a diagram of a typical office network setup"
- "Draw a flowchart for the approval process"
- "Generate a logo concept for a tech startup"

**Image Refinement:**
- After generating an image, you can request modifications
- "Make it more colorful", "Add a title", "Change the style"
- The AI remembers the previous image for context

**Extended Prompts:**
- The AI automatically enhances your prompts for better results
- You'll see both your original request and the enhanced version
- This ensures higher quality and more accurate image generation

---

## Data Analysis & Python Code

### Automatic Code Generation

**When It Activates:**
- Upload spreadsheet files (.xlsx, .csv)
- Ask for data analysis or visualizations
- Request calculations or statistical analysis
- Use the `/py` command for explicit Python requests

**What It Can Do:**
- **Statistical Analysis**: Calculate averages, trends, correlations
- **Data Visualization**: Create charts, graphs, and plots using Plotly
- **Data Processing**: Clean, filter, and transform datasets  
- **Calculations**: Perform complex mathematical operations

### Security Features

**Multi-Layer Protection:**
1. **Static Analysis**: Scans code for dangerous functions
2. **AI Security Review**: Checks for malicious patterns
3. **Sandboxed Execution**: Runs code in isolated environment
4. **Resource Limits**: 30-second timeout, memory restrictions

**Allowed Operations:**
- Data analysis with pandas, numpy
- Visualization with matplotlib, plotly
- Statistical operations
- File reading (CSV, Excel)
- Mathematical calculations

**Restricted Operations:**
- Network access
- File system modifications
- Operating system commands
- External library installations

### Example Analysis Requests

**Data Exploration:**
- "Show me the summary statistics for this dataset"
- "What are the top 10 values in the sales column?"
- "Find any outliers or unusual patterns"

**Visualizations:**
- "Create a bar chart of monthly revenue"
- "Generate a scatter plot showing correlation between price and sales"
- "Make a pie chart of product categories"

**Calculations:**
- "Calculate the year-over-year growth rate"
- "What's the average order value by customer segment?"
- "Forecast next quarter's performance based on trends"

### Output Formats

**Tables:**
- Interactive, sortable data tables
- Click column headers to sort
- Expandable/collapsible for space saving

**Charts:**
- Interactive Plotly visualizations
- Zoom, pan, and hover features
- Export-ready formats

**Single Values:**
- Key metrics and calculated results
- Clearly displayed with context
- Perfect for KPIs and summaries

**Code Display:**
- Syntax-highlighted Python code
- Show/hide code blocks
- Error details when issues occur

---

## Knowledge Management

### Favorites System

**Organizing Questions:**
1. **Create Groups**: Organize favorites into logical categories
2. **Add Questions**: Star questions from chat history
3. **Drag & Drop**: Reorder questions and groups as needed
4. **Quick Access**: Use favorites panel for frequently asked questions

**How to Add Favorites:**
- Click the star icon next to any question you've asked
- The question is automatically added to your favorites
- First favorite creates a default "Favorites" group

**Managing Groups:**
- **Add New Group**: Use the "Add Group" button in favorites panel
- **Rename Groups**: Click "Rename" next to any group name
- **Delete Groups**: Remove groups you no longer need
- **Drag to Reorder**: Change the order of both groups and questions

**Using Favorites:**
- Click the favorites icon in the action panel
- Browse your organized questions
- Click any question to copy it to the input field
- Modify as needed before sending

### Chat History

**Automatic Saving:**
- Conversations are automatically saved when you start a new dialog
- Only meaningful conversations are saved (excludes file uploads, generated content)
- Maximum of 10 recent conversations are kept per user

**Manual Management:**
- Access history through the history icon in action panel
- Load previous conversations by clicking on them
- Delete conversations you no longer need
- Loaded conversations are automatically deleted when you send a new message

**What Gets Saved:**
- ✅ Text-based Q&A conversations
- ✅ Knowledge base queries
- ✅ Selected knowledge fields
- ❌ File uploads and analysis
- ❌ Generated images
- ❌ Code execution results

---

## Voice Features

### Voice Input

**How to Use:**
1. Click the microphone icon next to the input field
2. Speak your question clearly in German
3. The system automatically detects when you're finished
4. Your speech is converted to text and can be edited before sending

**Language Support:**
- **Primary**: German (de-DE)
- Optimized for business and technical terminology
- Handles German abbreviations and compound words

**Voice Features:**
- **Continuous Listening**: Keeps listening until you finish speaking
- **Silence Detection**: Automatically stops after 1 second of silence
- **Real-time Transcription**: See your words appear as you speak
- **Edit Before Sending**: Modify the transcribed text if needed

**Visual Indicators:**
- **Microphone Button**: Changes color when recording
- **Input Field**: Shows "Listening..." when active
- **Status**: Displays recording state in sidebar

### Voice Response

**Text-to-Speech:**
- Automatically speaks responses for voice-initiated queries
- Uses German language synthesis
- Can be stopped by starting a new recording or typing

**When Voice Responses Occur:**
- After asking a question using voice input
- Provides audio feedback: "Einen Moment, ich schaue, was ich dazu herausfinden kann"
- Helpful for hands-free operation

---

## Export & Sharing

### PDF Export

**How to Export:**
1. Complete your conversation
2. Click the PDF icon in the action panel
3. Your entire chat conversation is exported as a formatted PDF
4. File is automatically downloaded as "chat_export.pdf"

**What's Included:**
- All messages in the current conversation
- Formatted text with proper styling
- Timestamps and user identification
- Clean, professional layout suitable for sharing

**Use Cases:**
- Save important analysis results
- Share insights with colleagues
- Archive decision-making conversations
- Create documentation from Q&A sessions

### Chat Management

**Wipe Chat:**
- Click the wipe icon to clear current conversation
- Removes all messages from display
- Starts fresh while keeping knowledge fields selected
- Useful for starting new topics while maintaining context

**New Dialog:**
- Starts completely fresh conversation
- Clears uploaded files and selected modes
- Resets all context and history
- Auto-saves current conversation if meaningful

---

## Tips & Best Practices

### Asking Effective Questions

**Be Specific:**
- ❌ "Tell me about sales"
- ✅ "What were the Q3 sales figures for the European region?"

**Provide Context:**
- ❌ "How do I fix this?"
- ✅ "How do I configure the user permissions in 4PLAN Dashboard Designer?"

**Use Follow-ups:**
- Ask clarifying questions based on responses
- Use the suggested follow-up questions when available
- Build on previous answers for deeper insights

**Leverage Document Analysis:**
- Upload relevant documents before asking specific questions
- Reference specific sections or data when asking questions
- Use the document context to ask comparative questions

### Optimizing Performance

**Knowledge Fields:**
- Select only relevant knowledge fields for faster searches
- Use "Web" when you need current information
- Deselect unused fields to focus results

**File Uploads:**
- Upload files in supported formats for best results
- Larger files take longer to process but provide more comprehensive analysis
- Use CSV/Excel for data analysis, PDF/DOCX for document analysis

**Voice Input:**
- Speak clearly and at moderate pace
- Use proper German pronunciation for technical terms
- Wait for silence detection rather than manually stopping

### Organization Strategies

**Favorites Management:**
- Create topic-based groups (e.g., "Financial Analysis", "Technical Support")
- Keep frequently used questions easily accessible
- Regularly review and clean up outdated favorites

**Chat History:**
- Let the system auto-save important conversations
- Load previous chats when continuing related topics
- Use the wipe feature to start fresh on new subjects

---

## Troubleshooting

### Common Issues

**Connection Problems:**
- **Status Shows "Disconnected"**: Check internet connection, try refreshing page
- **"Connection Failed"**: Server may be restarting, wait a moment and try again
- **Authentication Errors**: Logout and login again to refresh credentials

**File Upload Issues:**
- **"Upload Failed"**: Check file format and size, ensure feature is enabled
- **Processing Stuck**: Large files may take several minutes, be patient
- **File Not Recognized**: Verify file is not corrupted and in supported format

**Voice Input Problems:**
- **"Microphone Access Denied"**: Allow microphone permissions in browser
- **Not Recording**: Check microphone connection and browser settings
- **Poor Recognition**: Speak more clearly, check microphone quality

**Performance Issues:**
- **Slow Responses**: Large documents or complex queries take more time
- **Code Execution Timeout**: Simplify data analysis requests
- **Memory Errors**: Try smaller datasets or break analysis into parts

### Getting Help

**Status Messages:**
- Always check the status display in the sidebar for current activity
- Error messages provide specific guidance on issues
- Processing indicators show when the system is working

**Feature Availability:**
- Some features may be disabled by administrators
- Check with your system administrator if expected features are missing
- Feature toggles affect what file types and capabilities are available

**Best Practices for Reporting Issues:**
1. Note exactly what you were trying to do
2. Include any error messages displayed
3. Mention what file types or features were involved
4. Describe what happened vs. what you expected

---

## Administrator Features

*Note: These features are only available to designated administrators*

### Feature Management

**Available Feature Toggles:**
- **Image Generation**: AI-powered image creation
- **Image Upload**: Upload and analyze images
- **PDF/DOCX Upload**: Document analysis capabilities  
- **TXT/SQL Upload**: Text file processing
- **XLSX/CSV Analysis**: Data analysis and visualization
- **Web Search**: Real-time internet search

**Knowledge Base Management:**
- Update and refresh document collections
- Add new knowledge domains
- Manage vector store indices
- Configure search parameters

### User Management

**Admin Privileges:**
- Access to administration panel
- Feature configuration control
- Knowledge base update capabilities
- System monitoring and maintenance

---

## Conclusion

4PLAN Everything Buddy is designed to be your intelligent work companion, helping you analyze documents, process data, generate insights, and access organizational knowledge efficiently. By understanding its capabilities and following the best practices outlined in this manual, you can maximize your productivity and make data-driven decisions more effectively.

The application continuously learns and improves, so don't hesitate to experiment with different types of questions and use cases. The AI is designed to understand natural language and provide helpful, contextual responses regardless of how you phrase your requests.

For additional support or feature requests, contact your system administrator or the 4PLAN support team.

---

*This manual covers version 1.0 of 4PLAN Everything Buddy. Features and interface may vary based on administrator configuration and system updates.*
