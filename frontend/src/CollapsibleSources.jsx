import React, { useState } from 'react';
import './CollapsibleSources.css';

function CollapsibleSources({ sources }) {
    const [isOpen, setIsOpen] = useState(false);

    const toggleOpen = () => {
        setIsOpen(!isOpen);
    };

    // Check if sources is an array before trying to map over it
    const areSourcesAvailable = Array.isArray(sources) && sources.length > 0;

    if (!areSourcesAvailable) {
        return null;
    }

    return (
        <div className="collapsible-sources">
            <button onClick={toggleOpen} className="sources-toggle">
                {isOpen ? 'Hide sources' : 'Show sources'}
            </button>
            {isOpen && (
                <div className="sources-content">
                    <div className="sources-list">
                        {sources.map((source, index) => (
                            <div key={index} className="source-item">
                                <span className="source-number">[{index + 1}]</span>
                                <a href={source} target="_blank" rel="noopener noreferrer" className="source-url">
                                    {source}
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default CollapsibleSources;
