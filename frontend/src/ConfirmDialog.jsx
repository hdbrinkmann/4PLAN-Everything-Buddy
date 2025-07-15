import React, { useEffect, useRef } from 'react';
import './ConfirmDialog.css';

function ConfirmDialog({ isOpen, onClose, onConfirm, title, children }) {
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      cancelButtonRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="confirm-dialog-overlay">
      <div className="confirm-dialog">
        <h3>{title}</h3>
        <div className="confirm-dialog-content">
          {children}
        </div>
        <div className="confirm-dialog-actions">
          <button onClick={onConfirm}>
            Start Process
          </button>
          <button onClick={onClose} ref={cancelButtonRef}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
