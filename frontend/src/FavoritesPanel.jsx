import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './FavoritesPanel.css';

// Draggable Item Component
const SortableItem = ({ item, onSelectFavorite, onDelete, isOver }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      className={`favorite-item draggable ${isDragging ? 'dragging' : ''} ${isOver ? 'drag-over' : ''}`}
    >
      <div className="drag-handle" {...listeners} title="Drag to reorder">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="4" cy="4" r="1.5"/>
          <circle cx="12" cy="4" r="1.5"/>
          <circle cx="4" cy="8" r="1.5"/>
          <circle cx="12" cy="8" r="1.5"/>
          <circle cx="4" cy="12" r="1.5"/>
          <circle cx="12" cy="12" r="1.5"/>
        </svg>
      </div>
      <span onClick={() => onSelectFavorite(item.question)} className="favorite-text" title="Use this question">{item.question}</span>
      <div className="favorite-item-actions">
        <button onClick={() => onDelete(item.id)} className="delete-btn">Delete</button>
      </div>
    </div>
  );
};

// Sortable Group Component
const SortableGroup = ({ group, onSelectFavorite, onDelete, onRename, onStartEditing, editingGroupName, isOver }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: `group-${group.id}` });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            className={`favorite-group ${isDragging ? 'dragging' : ''} ${isOver ? 'drag-over' : ''}`}
        >
            <div className="group-header">
                <div className="drag-handle group-drag-handle" {...attributes} {...listeners} title="Drag to reorder group">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <circle cx="4" cy="4" r="1.5"/>
                        <circle cx="12" cy="4" r="1.5"/>
                        <circle cx="4" cy="8" r="1.5"/>
                        <circle cx="12" cy="8" r="1.5"/>
                        <circle cx="4" cy="12" r="1.5"/>
                        <circle cx="12" cy="12" r="1.5"/>
                    </svg>
                </div>
                {editingGroupName !== undefined ? (
                    <input
                        type="text"
                        value={editingGroupName}
                        onChange={(e) => onStartEditing(group.id, e.target.value)}
                        onBlur={() => onRename(group.id, group.name)}
                        onKeyPress={(e) => e.key === 'Enter' && onRename(group.id, group.name)}
                        autoFocus
                    />
                ) : (
                    <h4>{group.name}</h4>
                )}
                <div className="group-actions">
                    <button onClick={() => onStartEditing(group.id, group.name)}>Rename</button>
                    {group.name !== 'Favorites' && (
                        <button onClick={() => onDelete(group.id)}>Delete</button>
                    )}
                </div>
            </div>
            <DroppableGroup
                id={group.id}
                items={group.questions}
                onSelectFavorite={onSelectFavorite}
                onDelete={(questionId) => onDelete(group.id, questionId)}
            />
        </div>
    );
};

// Droppable Area for Questions
const DroppableGroup = ({ id, items, onSelectFavorite, onDelete }) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <SortableContext id={id.toString()} items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <div 
                ref={setNodeRef} 
                className={`group-questions ${isOver ? 'drag-over' : ''}`}
                data-group-id={id}
            >
                {items.map(item => (
                    <SortableItem key={item.id} item={item} onSelectFavorite={onSelectFavorite} onDelete={onDelete} />
                ))}
                {items.length === 0 && (
                    <p className="no-favorites-text">Drag favorites here.</p>
                )}
            </div>
        </SortableContext>
    );
};


const FavoritesPanel = ({
  isOpen,
  onClose,
  onSelectFavorite,
  token,
}) => {
  const [favoriteGroups, setFavoriteGroups] = useState([]);
  const [editingGroupName, setEditingGroupName] = useState({});
  const [newGroupName, setNewGroupName] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before starting drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (isOpen) {
      // Determine the correct API URL based on the current location
      const apiUrl = window.location.protocol === 'https:' && window.location.port === '' 
        ? `${window.location.protocol}//${window.location.hostname}/favorites/`
        : 'http://localhost:8002/favorites/';
        
      fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
        .then(response => {
          if (!response.ok) {
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
                console.error('Error: Fetched data is not an array.', data);
                setFavoriteGroups([]); // Reset to an empty array on error
            }
        })
        .catch(error => {
            console.error('Error fetching favorites:', error);
            setFavoriteGroups([]); // Ensure it's an array on fetch failure
        });
    }
  }, [isOpen, token]);

  if (!isOpen) return null;

  const handleAddNewGroup = () => {
    if (newGroupName.trim()) {
      // Determine the correct API URL based on the current location
      const apiUrl = window.location.protocol === 'https:' && window.location.port === '' 
        ? `${window.location.protocol}//${window.location.hostname}/favorites/groups`
        : 'http://localhost:8002/favorites/groups';
        
      fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newGroupName.trim() }),
      })
        .then(response => response.json())
        .then(newGroup => {
          setFavoriteGroups(prev => [...prev, newGroup]);
          setNewGroupName('');
        })
        .catch(error => console.error('Error adding group:', error));
    }
  };

  const handleDeleteGroup = (groupId) => {
    // Determine the correct API URL based on the current location
    const baseUrl = window.location.protocol === 'https:' && window.location.port === '' 
      ? `${window.location.protocol}//${window.location.hostname}`
      : 'http://localhost:8002';
      
    fetch(`${baseUrl}/favorites/groups/${groupId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
      .then(() => {
        setFavoriteGroups(prev => prev.filter(g => g.id !== groupId));
      })
      .catch(error => console.error('Error deleting group:', error));
  };

  const handleRenameGroup = (groupId, currentName) => {
    const newName = editingGroupName[groupId];
    if (newName?.trim() && newName.trim() !== currentName) {
      // Determine the correct API URL based on the current location
      const baseUrl = window.location.protocol === 'https:' && window.location.port === '' 
        ? `${window.location.protocol}//${window.location.hostname}`
        : 'http://localhost:8002';
        
      fetch(`${baseUrl}/favorites/groups/${groupId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newName.trim() }),
      })
        .then(() => {
          setFavoriteGroups(prev =>
            prev.map(g => (g.id === groupId ? { ...g, name: newName.trim() } : g))
          );
        })
        .catch(error => console.error('Error renaming group:', error));
    }
    setEditingGroupName(prev => ({ ...prev, [groupId]: undefined }));
  };

  const handleDeleteFavorite = (groupId, questionId) => {
    // Determine the correct API URL based on the current location
    const baseUrl = window.location.protocol === 'https:' && window.location.port === '' 
      ? `${window.location.protocol}//${window.location.hostname}`
      : 'http://localhost:8002';
      
    fetch(`${baseUrl}/favorites/questions/${questionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
      .then(() => {
        setFavoriteGroups(prev =>
          prev.map(g =>
            g.id === groupId
              ? { ...g, questions: g.questions.filter(q => q.id !== questionId) }
              : g
          )
        );
      })
      .catch(error => console.error('Error deleting favorite:', error));
  };

  const findGroupForQuestion = (questionId, groups) => {
      return groups.find(group => group.questions.some(q => q.id === questionId));
  }

  const handleDragStart = (event) => {
    const { active } = event;
    setActiveId(active.id);
  };

  const handleGroupReorder = async (activeId, overId) => {
    const oldIndex = favoriteGroups.findIndex(g => `group-${g.id}` === activeId);
    const newIndex = favoriteGroups.findIndex(g => `group-${g.id}` === overId);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
      return;
    }

    // Optimistic update
    const updatedGroups = arrayMove(favoriteGroups, oldIndex, newIndex);
    setFavoriteGroups(updatedGroups);
    setIsLoading(true);

    try {
      const orderedIds = updatedGroups.map(g => g.id);
      // Determine the correct API URL based on the current location
      const apiUrl = window.location.protocol === 'https:' && window.location.port === '' 
        ? `${window.location.protocol}//${window.location.hostname}/favorites/groups/order`
        : 'http://localhost:8002/favorites/groups/order';
        
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ordered_ids: orderedIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to update group order');
      }
    } catch (error) {
      console.error('Error updating group order:', error);
      // Revert on error
      setFavoriteGroups(favoriteGroups);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuestionMove = async (activeId, overId) => {
    const sourceGroup = findGroupForQuestion(activeId, favoriteGroups);
    if (!sourceGroup) {
      console.error('Source group not found for question:', activeId);
      return;
    }

    // Determine destination group and position
    let destGroup;
    let newOrder;

    // Check if dropping on a group container (empty area)
    const overIsGroupContainer = favoriteGroups.some(g => g.id === overId);
    
    if (overIsGroupContainer) {
      destGroup = favoriteGroups.find(g => g.id === overId);
      newOrder = destGroup ? destGroup.questions.length : 0; // Add to end
    } else {
      // Dropping on another question
      destGroup = findGroupForQuestion(overId, favoriteGroups);
      if (!destGroup) {
        console.error('Destination group not found for question:', overId);
        return;
      }
      newOrder = destGroup.questions.findIndex(q => q.id === overId);
    }

    if (!destGroup) {
      console.error('No destination group determined');
      return;
    }

    // Don't move if it's the same position in the same group
    if (sourceGroup.id === destGroup.id) {
      const currentOrder = sourceGroup.questions.findIndex(q => q.id === activeId);
      if (currentOrder === newOrder || currentOrder === newOrder - 1) {
        return;
      }
    }

    // Create optimistic update
    const updatedGroups = favoriteGroups.map(group => ({
      ...group,
      questions: [...group.questions]
    }));

    const sourceGroupIndex = updatedGroups.findIndex(g => g.id === sourceGroup.id);
    const destGroupIndex = updatedGroups.findIndex(g => g.id === destGroup.id);
    
    // Remove from source
    const questionIndex = updatedGroups[sourceGroupIndex].questions.findIndex(q => q.id === activeId);
    const [movedQuestion] = updatedGroups[sourceGroupIndex].questions.splice(questionIndex, 1);
    
    // Add to destination
    updatedGroups[destGroupIndex].questions.splice(newOrder, 0, movedQuestion);

    // Update UI optimistically
    setFavoriteGroups(updatedGroups);
    setIsLoading(true);

    try {
      // Determine the correct API URL based on the current location
      const apiUrl = window.location.protocol === 'https:' && window.location.port === '' 
        ? `${window.location.protocol}//${window.location.hostname}/favorites/questions/move`
        : 'http://localhost:8002/favorites/questions/move';
        
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          question_id: activeId,
          new_group_id: destGroup.id,
          new_order: newOrder,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to move question');
      }
    } catch (error) {
      console.error('Error moving question:', error);
      // Revert on error
      setFavoriteGroups(favoriteGroups);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const isGroupDrag = typeof active.id === 'string' && active.id.startsWith('group-');
    const isOverGroup = typeof over.id === 'string' && over.id.startsWith('group-');

    if (isGroupDrag && isOverGroup) {
      // Group reordering
      handleGroupReorder(active.id, over.id);
    } else if (!isGroupDrag) {
      // Question moving (could be to another question or to a group container)
      handleQuestionMove(active.id, over.id);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="favorites-panel-overlay">
        <div className="favorites-panel">
          <div className="favorites-panel-header">
            <h3>Favorite Questions</h3>
            {isLoading && <div className="loading-indicator">Updating...</div>}
            <button onClick={onClose} className="close-btn">&times;</button>
          </div>
          
          <div className="add-group-section">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="New group name"
            />
            <button onClick={handleAddNewGroup}>Add Group</button>
          </div>

          <div className="favorites-list">
            <SortableContext items={favoriteGroups.map(g => `group-${g.id}`)} strategy={verticalListSortingStrategy}>
                {favoriteGroups.map(group => (
                    <SortableGroup
                        key={`group-${group.id}`}
                        group={group}
                        onSelectFavorite={onSelectFavorite}
                        onDelete={(groupId, questionId) => {
                            if (questionId) {
                                handleDeleteFavorite(groupId, questionId);
                            } else {
                                handleDeleteGroup(groupId);
                            }
                        }}
                        onRename={handleRenameGroup}
                        onStartEditing={(id, name) => setEditingGroupName({ [id]: name })}
                        editingGroupName={editingGroupName[group.id]}
                    />
                ))}
            </SortableContext>
          </div>
        </div>
      </div>
      <DragOverlay dropAnimation={null} style={{ zIndex: 9999 }}>
        {activeId ? (
          <div className="drag-overlay-item" style={{ 
            zIndex: 9999,
            position: 'relative',
            backgroundColor: 'var(--primary-bg)',
            border: '3px solid var(--accent-color)',
            borderRadius: '8px',
            boxShadow: '0 15px 30px rgba(0,0,0,0.5)',
            padding: '12px 16px',
            maxWidth: '350px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            transform: 'rotate(3deg)',
            cursor: 'grabbing'
          }}>
            <div className="drag-handle" style={{ 
              backgroundColor: 'var(--accent-color)',
              color: 'white',
              borderRadius: '4px',
              padding: '6px'
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="4" cy="4" r="1.5"/>
                <circle cx="12" cy="4" r="1.5"/>
                <circle cx="4" cy="8" r="1.5"/>
                <circle cx="12" cy="8" r="1.5"/>
                <circle cx="4" cy="12" r="1.5"/>
                <circle cx="12" cy="12" r="1.5"/>
              </svg>
            </div>
            <span className="favorite-text" style={{
              fontWeight: '500',
              color: 'var(--text-primary)',
              fontSize: '0.95rem',
              lineHeight: '1.3'
            }}>
              {favoriteGroups.flatMap(g => g.questions).find(q => q.id === activeId)?.question || 'Moving item...'}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default FavoritesPanel;
