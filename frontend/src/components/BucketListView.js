import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  Timestamp, 
  orderBy,
  getDoc,
  getDocs,
  arrayUnion,
  increment,
  setDoc
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import './BucketList.css';

const BucketListView = ({ group, user, onFindTimes }) => {
  const [bucketItems, setBucketItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    durationHours: 2,
    voteThreshold: 3, // Default threshold for votes
  });
  // Add state for editing
  const [editItem, setEditItem] = useState(null);
  const [editItemData, setEditItemData] = useState({
    title: '',
    description: '',
    durationHours: 2,
    voteThreshold: 3,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);

  // Fetch bucket list items for the group
  useEffect(() => {
    if (!group?.id) return;

    setLoading(true);
    const bucketListRef = collection(db, `groups/${group.id}/bucketList`);
    const bucketQuery = query(bucketListRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(bucketQuery, (snapshot) => {
      const items = [];
      snapshot.forEach((doc) => {
        items.push({
          id: doc.id,
          ...doc.data(),
          votes: doc.data().votes || {},
          totalVotes: doc.data().totalVotes || 0
        });
      });
      
      // Sort by totalVotes (most votes first), then by createdAt (newest first)
      items.sort((a, b) => {
        if (b.totalVotes !== a.totalVotes) return b.totalVotes - a.totalVotes;
        return b.createdAt?.seconds - a.createdAt?.seconds || 0;
      });
      
      setBucketItems(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [group]);

  // Fetch group members to calculate vote thresholds
  useEffect(() => {
    if (!group?.id) return;

    const fetchGroupMembers = async () => {
      try {
        const membersSnapshot = await getDocs(collection(db, `groups/${group.id}/members`));
        const members = [];
        membersSnapshot.forEach(doc => {
          members.push({
            userId: doc.id,
            ...doc.data()
          });
        });
        setGroupMembers(members);
      } catch (error) {
        console.error("Error fetching group members:", error);
      }
    };

    fetchGroupMembers();
  }, [group]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Convert numeric fields to numbers
    if (name === 'durationHours' || name === 'voteThreshold') {
      setNewItem({
        ...newItem,
        [name]: Number(value)
      });
    } else {
      setNewItem({
        ...newItem,
        [name]: value
      });
    }
  };

  // Handle input change for editing
  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    
    // Convert numeric fields to numbers
    if (name === 'durationHours' || name === 'voteThreshold') {
      setEditItemData({
        ...editItemData,
        [name]: Number(value)
      });
    } else {
      setEditItemData({
        ...editItemData,
        [name]: value
      });
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newItem.title.trim()) {
      setError('Please enter a title for the event');
      return;
    }

    if (!newItem.durationHours || newItem.durationHours <= 0) {
      setError('Please enter a valid duration');
      return;
    }

    try {
      const bucketListRef = collection(db, `groups/${group.id}/bucketList`);
      
      // Initialize empty votes object and set total votes to 0
      const initialVotesObj = {};
      initialVotesObj[user.email] = 1; // Creator automatically upvotes
      
      await addDoc(bucketListRef, {
        ...newItem,
        createdBy: user.email,
        createdAt: Timestamp.now(),
        status: 'proposed',
        votes: initialVotesObj,
        totalVotes: 1 // Creator's vote
      });

      setSuccess('Item added to bucket list!');
      setNewItem({
        title: '',
        description: '',
        durationHours: 2,
        voteThreshold: 3,
      });
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding bucket list item:', error);
      setError('Failed to add item. Please try again.');
    }
  };

  // Start editing an item
  const handleStartEdit = (item) => {
    setEditItem(item.id);
    setEditItemData({
      title: item.title,
      description: item.description || '',
      durationHours: item.durationHours,
      voteThreshold: item.voteThreshold || 3,
    });
    setShowAddForm(false); // Close add form if it's open
  };

  // Cancel editing an item
  const handleCancelEdit = () => {
    setEditItem(null);
    setEditItemData({
      title: '',
      description: '',
      durationHours: 2,
      voteThreshold: 3,
    });
  };

  // Save edited item
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!editItemData.title.trim()) {
      setError('Please enter a title for the event');
      return;
    }

    if (!editItemData.durationHours || editItemData.durationHours <= 0) {
      setError('Please enter a valid duration');
      return;
    }

    try {
      const bucketItemRef = doc(db, `groups/${group.id}/bucketList`, editItem);
      
      await updateDoc(bucketItemRef, {
        title: editItemData.title,
        description: editItemData.description,
        durationHours: editItemData.durationHours,
        voteThreshold: editItemData.voteThreshold,
        lastEditedAt: Timestamp.now()
      });

      setSuccess('Item updated successfully!');
      setEditItem(null);
      setEditItemData({
        title: '',
        description: '',
        durationHours: 2,
        voteThreshold: 3,
      });
    } catch (error) {
      console.error('Error updating bucket list item:', error);
      setError('Failed to update item. Please try again.');
    }
  };

  const handleFindTimes = (item) => {
    if (onFindTimes) {
      onFindTimes(item);
    }
  };

  // Handle voting on a bucket list item
  const handleVote = async (itemId, voteValue) => {
    if (!user?.email) return;
    
    try {
      const itemRef = doc(db, `groups/${group.id}/bucketList`, itemId);
      const itemSnap = await getDoc(itemRef);
      
      if (!itemSnap.exists()) {
        console.error("Item not found");
        return;
      }
      
      const itemData = itemSnap.data();
      const currentVotes = itemData.votes || {};
      
      // Check if user has already voted this way
      if (currentVotes[user.email] === voteValue) {
        // User is removing their vote
        const updatedVotes = { ...currentVotes };
        delete updatedVotes[user.email];
        
        await updateDoc(itemRef, {
          votes: updatedVotes,
          totalVotes: (itemData.totalVotes || 0) - voteValue
        });
      } else {
        // User is changing vote or voting for first time
        const previousVote = currentVotes[user.email] || 0;
        const voteDifference = voteValue - previousVote;
        
        const updatedVotes = { ...currentVotes };
        updatedVotes[user.email] = voteValue;
        
        await updateDoc(itemRef, {
          votes: updatedVotes,
          totalVotes: (itemData.totalVotes || 0) + voteDifference
        });
        
        // Send notification to item creator if it's an upvote and not their own item
        if (voteValue === 1 && itemData.createdBy !== user.email) {
          await addDoc(collection(db, "inbox"), {
            to: itemData.createdBy,
            from: user.email,
            type: "event-vote",
            status: "unread",
            createdAt: new Date().toISOString(),
            message: `${user.email} voted for your event "${itemData.title}"`,
            groupId: group.id,
            bucketItemId: itemId
          });
        }
      }
    } catch (error) {
      console.error("Error updating vote:", error);
      setError("Failed to update vote. Please try again.");
    }
  };

  // Calculate if an item has reached its voting threshold
  const hasReachedThreshold = (item) => {
    if (!item.votes) return false;
    
    const upvotes = Object.values(item.votes).filter(vote => vote === 1).length;
    return upvotes >= (item.voteThreshold || 3);
  };

  const getUserVote = (votes) => {
    if (!votes || !user?.email) return 0;
    return votes[user.email] || 0;
  };

  const getStatusTag = (status) => {
    switch (status) {
      case 'proposed':
        return <span className="status-tag proposed">Proposed</span>;
      case 'voting':
        return <span className="status-tag voting">Voting</span>;
      case 'scheduled':
        return <span className="status-tag scheduled">Scheduled</span>;
      case 'completed':
        return <span className="status-tag completed">Completed</span>;
      default:
        return <span className="status-tag">{status}</span>;
    }
  };

  // Calculate vote counts for display
  const getVoteCounts = (votes) => {
    if (!votes) return { upvotes: 0, downvotes: 0 };
    
    const upvotes = Object.values(votes).filter(vote => vote === 1).length;
    const downvotes = Object.values(votes).filter(vote => vote === -1).length;
    
    return { upvotes, downvotes };
  };

  if (loading) {
    return <div className="loading">Loading bucket list...</div>;
  }

  return (
    <div className="bucket-list-container">
      <div className="bucket-list-header">
        <h2>Group Bucket List</h2>
        <button 
          className="add-bucket-item-btn"
          onClick={() => {
            setShowAddForm(!showAddForm);
            setEditItem(null); // Cancel any editing when showing add form
          }}
        >
          {showAddForm ? 'Cancel' : '+ Add New Item'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {showAddForm && (
        <div className="add-bucket-form">
          <h3>Add New Bucket List Item</h3>
          <form onSubmit={handleAddItem}>
            <div className="form-group">
              <label htmlFor="title">Event Title*</label>
              <input
                type="text"
                id="title"
                name="title"
                value={newItem.title}
                onChange={handleInputChange}
                placeholder="e.g., Bowling, Movie Night"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={newItem.description}
                onChange={handleInputChange}
                placeholder="Add details about this event"
                rows="3"
              />
            </div>

            <div className="form-group">
              <label htmlFor="durationHours">Duration (hours)*</label>
              <input
                type="number"
                id="durationHours"
                name="durationHours"
                value={newItem.durationHours}
                onChange={handleInputChange}
                min="0.5"
                step="0.5"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="voteThreshold">Voting Threshold*</label>
              <input
                type="number"
                id="voteThreshold"
                name="voteThreshold"
                value={newItem.voteThreshold}
                onChange={handleInputChange}
                min="1"
                step="1"
                required
              />
              <small>Number of upvotes required to finalize the event</small>
            </div>

            <div className="form-actions">
              <button type="submit" className="submit-btn">Add to Bucket List</button>
              <button type="button" className="cancel-btn" onClick={() => setShowAddForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bucket-items-list">
        {bucketItems.length > 0 ? (
          bucketItems.map((item) => {
            const { upvotes, downvotes } = getVoteCounts(item.votes);
            const userVote = getUserVote(item.votes);
            const reachedThreshold = hasReachedThreshold(item);
            
            // Check if this item is being edited
            const isEditing = editItem === item.id;
            
            return (
              <div key={item.id} className="bucket-item">
                {isEditing ? (
                  // Edit form
                  <div className="edit-bucket-form">
                    <h3>Edit Bucket List Item</h3>
                    <form onSubmit={handleSaveEdit}>
                      <div className="form-group">
                        <label htmlFor="edit-title">Event Title*</label>
                        <input
                          type="text"
                          id="edit-title"
                          name="title"
                          value={editItemData.title}
                          onChange={handleEditInputChange}
                          placeholder="e.g., Bowling, Movie Night"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="edit-description">Description</label>
                        <textarea
                          id="edit-description"
                          name="description"
                          value={editItemData.description}
                          onChange={handleEditInputChange}
                          placeholder="Add details about this event"
                          rows="3"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="edit-durationHours">Duration (hours)*</label>
                        <input
                          type="number"
                          id="edit-durationHours"
                          name="durationHours"
                          value={editItemData.durationHours}
                          onChange={handleEditInputChange}
                          min="0.5"
                          step="0.5"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="edit-voteThreshold">Voting Threshold*</label>
                        <input
                          type="number"
                          id="edit-voteThreshold"
                          name="voteThreshold"
                          value={editItemData.voteThreshold}
                          onChange={handleEditInputChange}
                          min="1"
                          step="1"
                          required
                        />
                        <small>Number of upvotes required to finalize the event</small>
                      </div>

                      <div className="form-actions">
                        <button type="submit" className="submit-btn">Save Changes</button>
                        <button type="button" className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                      </div>
                    </form>
                  </div>
                ) : (
                  // Normal view
                  <>
                    <div className="bucket-item-header">
                      <div className="item-title-container">
                        <h3>{item.title}</h3>
                        {getStatusTag(item.status)}
                        {reachedThreshold && item.status !== 'scheduled' && item.status !== 'completed' && (
                          <span className="threshold-reached-badge">Ready to Schedule!</span>
                        )}
                      </div>
                      <div className="voting-controls">
                        <button 
                          className={`vote-btn upvote ${userVote === 1 ? 'active' : ''}`}
                          onClick={() => handleVote(item.id, userVote === 1 ? 0 : 1)}
                          disabled={item.status === 'scheduled' || item.status === 'completed'}
                        >
                          <span className="vote-icon">👍</span>
                          <span className="vote-count">{upvotes}</span>
                        </button>
                        <button 
                          className={`vote-btn downvote ${userVote === -1 ? 'active' : ''}`}
                          onClick={() => handleVote(item.id, userVote === -1 ? 0 : -1)}
                          disabled={item.status === 'scheduled' || item.status === 'completed'}
                        >
                          <span className="vote-icon">👎</span>
                          <span className="vote-count">{downvotes}</span>
                        </button>
                      </div>
                    </div>
                    
                    {item.description && (
                      <div className="bucket-item-description">{item.description}</div>
                    )}
                    
                    <div className="bucket-item-details">
                      <span className="duration">{item.durationHours} hour{item.durationHours !== 1 ? 's' : ''}</span>
                      <span className="creator">Added by: {item.createdBy}</span>
                      <span className="threshold">Threshold: {item.voteThreshold || 3} votes</span>
                    </div>
                    
                    <div className="bucket-item-actions">
                      <button 
                        className="find-times-btn"
                        onClick={() => handleFindTimes(item)}
                        disabled={item.status === 'completed'}
                      >
                        Find Free Times
                      </button>
                      
                      {user.email === item.createdBy && (
                        <button 
                          className="edit-btn"
                          onClick={() => handleStartEdit(item)}
                          disabled={item.status === 'scheduled' || item.status === 'completed'}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })
        ) : (
          <div className="empty-state">
            <p>No bucket list items yet. Add some event ideas for your group!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BucketListView;