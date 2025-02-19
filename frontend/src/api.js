const API_BASE = "http://127.0.0.1:5000"; // URL of Flask backend

export async function testConnection() {
    const response = await fetch(`${API_BASE}/test`);
    return response.json();
}

export async function getFriends() {
    const response = await fetch(`${API_BASE}/get-friends`);
    return response.json();
}

export async function addFriend(email, nickname) {
    const response = await fetch(`${API_BASE}/add-friend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, nickname }),
    });
    return response.json();
}

const makeAuthenticatedRequest = async (url, options = {}) => {
const token = localStorage.getItem('token');

const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers
};

const response = await fetch(url, {
    ...options,
    headers
});

if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.reload();
    return;
}

return response;
};

export { makeAuthenticatedRequest };