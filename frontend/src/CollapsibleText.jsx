import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './CollapsibleSources.css'; // Reuse the same CSS for styling

function CollapsibleText({ content }) {
    const [isOpen, setIsOpen] = useState(true);

    const toggleOpen = () => setIsOpen(!isOpen);

    // Custom component to render links in a new tab
    const renderLink = ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
        </a>
    );

    return (
        <div className="collapsible-sources">
            <button onClick={toggleOpen} className="sources-toggle">
                {isOpen ? 'Hide Content' : 'Show Content'}
            </button>
            {isOpen && (
                <div className="sources-content">
                    <ReactMarkdown
                        children={content}
                        remarkPlugins={[remarkGfm]}
                        components={{
                            a: renderLink
                        }}
                    />
                </div>
            )}
        </div>
    );
}

export default CollapsibleText;
