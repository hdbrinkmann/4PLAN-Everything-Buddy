import React, { useState, useEffect, useRef } from 'react';
import './FeedbackDialog.css';

function FeedbackDialog({ isOpen, onClose, onSubmit }) {
  const [feedbackType, setFeedbackType] = useState('Idea');
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef(null);
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Reset form when dialog opens
      setFeedbackType('Idea');
      setFeedbackText('');
      setIsSubmitting(false);
      
      // Focus the textarea after a short delay to ensure it's rendered
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!feedbackText.trim()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onSubmit({
        feedback_type: feedbackType,
        feedback_text: feedbackText.trim()
      });
      
      // Close dialog on successful submission
      onClose();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      // Don't close dialog on error, let user retry
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="feedback-dialog-overlay" onClick={handleCancel}>
      <div className="feedback-dialog" onClick={e => e.stopPropagation()}>
        <div className="feedback-dialog-header">
            <h3>We appreciate your feedback</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="feedback-dialog-form">
          <div className="feedback-dialog-content">
            <div className="form-group">
              <label htmlFor="feedback-type">Type</label>
              <select 
                id="feedback-type"
                value={feedbackType} 
                onChange={(e) => setFeedbackType(e.target.value)}
                disabled={isSubmitting}
                className="feedback-type-select"
              >
                <option value="Issue">Issue</option>
                <option value="Idea">Idea</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="feedback-text">Your Feedback</label>
              <textarea
                ref={textareaRef}
                id="feedback-text"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Please describe your feedback..."
                disabled={isSubmitting}
                className="feedback-textarea"
                rows="8"
                maxLength="5000"
                required
              />
              <div className="character-count">
                {feedbackText.length}/5000 characters
              </div>
            </div>
          </div>

          <div className="feedback-dialog-actions">
            <button 
              type="submit" 
              disabled={!feedbackText.trim() || isSubmitting}
              className="send-btn"
            >
              {isSubmitting ? 'Sending...' : 'Send'}
            </button>
            <button 
              type="button" 
              onClick={handleCancel} 
              ref={cancelButtonRef}
              disabled={isSubmitting}
              className="cancel-btn"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FeedbackDialog;
