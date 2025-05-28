document.addEventListener('DOMContentLoaded', function() {
  const userDetailsElement = document.getElementById('user-details');
  const groupStatusTextElement = document.getElementById('group-status-text');
  const groupActionsContainer = document.getElementById('group-actions-container');

  async function fetchCurrentUser() {
    try {
      const response = await fetch('/api/users/me');
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('User not authenticated. Redirecting to login.');
          const userDetailsContainer = document.getElementById('user-details-container');
          if (userDetailsContainer) userDetailsContainer.innerHTML = '<p>Please log in to see your details and manage groups.</p>';
          const groupStatusContainer = document.getElementById('group-status-container');
          if (groupStatusContainer) groupStatusContainer.innerHTML = '';
          const groupActionsContainer = document.getElementById('group-actions-container');
          if (groupActionsContainer) groupActionsContainer.innerHTML = '';
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const user = await response.json();
      displayUserDetails(user);
      updateGroupUI(user);
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      const userDetailsContainer = document.getElementById('user-details-container');
      if (userDetailsContainer) userDetailsContainer.innerHTML = '<p>Could not load your details.</p>';
    }
  }

  async function fetchAllGroups() {
    try {
      const response = await fetch('/api/groups');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching groups:', error);
      return [];
    }
  }

  function displayUserDetails(user) {
    const userDetailsContainer = document.getElementById('user-details-container');
    if (userDetailsContainer) {
      userDetailsContainer.innerHTML = `
        <p><strong>ID:</strong> ${user.id}</p>
        <p><strong>Username:</strong> ${user.username}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Role:</strong> ${user.role}</p>
      `;
    }
  }

  function updateGroupUI(user) {
    const groupStatusContainer = document.getElementById('group-status-container');
    const groupActionsContainer = document.getElementById('group-actions-container');

    if (!groupStatusContainer || !groupActionsContainer) {
      console.error('Group UI containers not found in the HTML.');
      return;
    }

    groupStatusContainer.innerHTML = '';
    groupActionsContainer.innerHTML = '';

    if (user.group_id) {
      groupStatusContainer.textContent = `You are in group ID: ${user.group_id}.`;

      const exitButton = document.createElement('button');
      exitButton.textContent = 'Exit Group';
      exitButton.id = 'exit-group-btn';
      exitButton.className = 'action-button';
      exitButton.addEventListener('click', handleExitGroup);
      groupActionsContainer.appendChild(exitButton);
    } else {
      groupStatusContainer.textContent = 'You are not currently in a group.';

      const createButton = document.createElement('button');
      createButton.textContent = 'Create Group';
      createButton.id = 'create-group-btn';
      createButton.className = 'action-button';
      createButton.addEventListener('click', handleCreateGroup);
      groupActionsContainer.appendChild(createButton);

      const joinButton = document.createElement('button');
      joinButton.textContent = 'Join Group';
      joinButton.id = 'join-group-btn';
      joinButton.className = 'action-button';
      joinButton.addEventListener('click', handleJoinGroup);
      groupActionsContainer.appendChild(joinButton);
    }
  }

  async function handleCreateGroup() {
    const groupName = prompt('Enter the name for the new group:');
    if (!groupName || groupName.trim() === '') {
      alert('Group name cannot be empty.');
      return;
    }

    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ name: groupName }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to create group. Please try again.' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const newGroup = await response.json();
      alert(`Group "${newGroup.name}" (ID: ${newGroup.id}) created successfully! You can now join this group using its ID.`);
      fetchCurrentUser();
    } catch (error) {
      console.error('Failed to create group:', error);
      alert(`Error creating group: ${error.message}`);
    }
  }

  async function handleJoinGroup() {
    const groupIdToJoin = prompt('Enter the ID of the group you want to join:');
    if (!groupIdToJoin || isNaN(parseInt(groupIdToJoin))) {
      alert('Invalid Group ID. Please enter a number.');
      return;
    }

    try {
      const response = await fetch('/api/users/me/join-group', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ groupId: parseInt(groupIdToJoin) }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to join group. Ensure the Group ID is correct and the group exists.' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      await response.json();
      alert('Successfully joined group!');
      fetchCurrentUser();
    } catch (error) {
      console.error('Failed to join group:', error);
      alert(`Error joining group: ${error.message}`);
    }
  }

  async function handleExitGroup() {
    if (!confirm('Are you sure you want to exit your current group?')) {
      return;
    }

    try {
      const response = await fetch('/api/users/me/exit-group', {
        method: 'PUT',
        headers: { 'Accept': 'application/json' },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to exit group. Please try again.' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      await response.json();
      alert('Successfully exited group.');
      fetchCurrentUser();
    } catch (error) {
      console.error('Failed to exit group:', error);
      alert(`Error exiting group: ${error.message}`);
    }
  }

  fetchCurrentUser();
});
