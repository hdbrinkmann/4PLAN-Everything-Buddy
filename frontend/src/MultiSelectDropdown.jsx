import React, { useState, useRef, useEffect } from 'react';
import './MultiSelectDropdown.css';

const MultiSelectDropdown = ({ options, selectedOptions, onChange, isDisabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleToggle = () => {
        if (!isDisabled) {
            setIsOpen(!isOpen);
        }
    };

    const handleSelectOption = (option) => {
        onChange(option);
    };

    const filteredOptions = options.filter(option =>
        option.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getDisplayText = () => {
        if (selectedOptions.length === 0) {
            return 'Select...';
        }
        if (selectedOptions.length === options.length) {
            return 'All';
        }
        if (selectedOptions.length === 1) {
            return selectedOptions[0];
        }
        return `${selectedOptions.length} Fields Selected`;
    };

    return (
        <div className="multi-select-dropdown" ref={dropdownRef}>
            <div
                className={`dropdown-header ${isDisabled ? 'disabled' : ''}`}
                onClick={handleToggle}
            >
                <span>{getDisplayText()}</span>
                <span className={`arrow ${isOpen ? 'up' : 'down'}`}></span>
            </div>
            {isOpen && (
                <div className="dropdown-list-container">
                    <input
                        type="text"
                        placeholder="Search..."
                        className="search-box"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <div className="dropdown-list">
                        <div className="dropdown-item" onClick={() => onChange('__all__')}>
                            <input
                                type="checkbox"
                                checked={selectedOptions.length === options.length}
                                readOnly
                            />
                            <label>Select All</label>
                        </div>
                        {filteredOptions.map(option => (
                            <div key={option} className="dropdown-item" onClick={() => handleSelectOption(option)}>
                                <input
                                    type="checkbox"
                                    checked={selectedOptions.includes(option)}
                                    readOnly
                                />
                                <label>{option}</label>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MultiSelectDropdown;
