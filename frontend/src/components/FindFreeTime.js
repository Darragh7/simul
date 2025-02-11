import React, { useState } from 'react';

function FindFreeTime() {
  const [friendEmail, setFriendEmail] = useState('');
  const [freeTimes, setFreeTimes] = useState([]);

  const handleFindFreeTime = async () => {
    const response = await fetch('http://127.0.0.1:5000/find_free_time', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ friend_email: friendEmail }),
    });

    const data = await response.json();
    setFreeTimes(data);
  };

  return (
    <div>
      <input 
        type="email" 
        placeholder="Friend's email" 
        value={friendEmail} 
        onChange={(e) => setFriendEmail(e.target.value)} 
      />
      <button onClick={handleFindFreeTime}>Find Free Time</button>

      <div>
        <h2>Mutual Free Times</h2>
        <ul>
          {freeTimes.map((time, index) => (
            <li key={index}>
              {time.start} - {time.end}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default FindFreeTime;
