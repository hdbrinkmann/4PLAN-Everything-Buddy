import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { a11yDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './CollapsibleSources.css'; // Reuse the same CSS for styling

function CollapsibleCode({ code, errorDetails, language = 'python' }) {
    const [isOpen, setIsOpen] = useState(!!errorDetails || language !== 'python'); // Open by default for non-Python code or errors

    const toggleOpen = () => {
        setIsOpen(!isOpen);
    };

    if (!code) {
        return null;
    }

    return (
        <div className="collapsible-sources">
            <button onClick={toggleOpen} className="sources-toggle">
                {isOpen ? 'Hide Code' : 'Show Code'}
            </button>
            {isOpen && (
                <div className="sources-content">
                    {errorDetails && (
                        <div className="error-details">
                            <h4>Error Details:</h4>
                            <pre>{errorDetails}</pre>
                        </div>
                    )}
                    <SyntaxHighlighter language={language} style={a11yDark} showLineNumbers>
                        {code}
                    </SyntaxHighlighter>
                </div>
            )}
        </div>
    );
}

export default CollapsibleCode;
