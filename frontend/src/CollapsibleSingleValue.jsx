import React from 'react';
import './CollapsibleSingleValue.css';

const CollapsibleSingleValue = ({ value }) => {
    return (
        <div className="single-value-container">
            <div className="single-value-content">
                {value}
            </div>
        </div>
    );
};

export default CollapsibleSingleValue;
