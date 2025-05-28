document.addEventListener('DOMContentLoaded', function() {
  const notificationsList = document.getElementById('notifications-list');
  const showAllButton = document.getElementById('show-all-notifications-btn');
  let showingAll = false;

  function fetchNotifications() {
    const url = showingAll ? '/api/notifications?showAll=true' : '/api/notifications';
    fetch(url)
      .then(response => {
        if (!response.ok) {
          console.error('Fetch error response status:', response.status, response.statusText);
          // Attempt to log the error response body as text, as it might not be JSON
          response.text().then(text => console.error('Fetch error response body:', text)).catch(e => console.error('Could not get error response text:', e));
          // We still try to parse as JSON in case the server sends an error JSON object,
          // but the primary error logging is above.
        }
        return response.json();
      })
      .then(notifications => {
        // Log the URL called and the data received from the server
        console.log('Fetching URL:', url, 'Received data:', notifications);
        
        // const notificationsList = document.getElementById('notifications-list'); // Already in scope
        // const showAllButton = document.getElementById('show-all-notifications-btn'); // Already in scope
        
        if (!notifications) { // Check if notifications is null or undefined after response.json()
          console.error('Parsed notifications data is null or undefined. Response might not have been valid JSON.');
          notificationsList.innerHTML = '<p>Error loading notifications: Invalid data received.</p>';
          return;
        }

        if (notifications.length === 0) {
          notificationsList.innerHTML = `<p>No ${showingAll ? '' : 'new '}notifications.</p>`;
          return;
        }
        
        let html = '<ul class="notifications-list">';
        
        notifications.forEach(notification => {
          html += `<li class="notification-item">\
            <div class="notification-message">${notification.message}</div>\
            <div class="notification-date">${new Date(notification.created_at).toLocaleString()}</div>\
            ${!notification.is_read ? `<button class="mark-read-btn" data-id="${notification.id}">Mark as Read</button>` : ''}\
            ${showingAll ? `<button class="delete-notification-btn" data-id="${notification.id}">Delete</button>` : ''}\
          </li>`;
        });
        
        html += '</ul>';
        notificationsList.innerHTML = html;
        
        document.querySelectorAll('.mark-read-btn').forEach(button => {
          button.addEventListener('click', function() {
            const notificationId = this.getAttribute('data-id');
            markNotificationAsRead(notificationId, this.closest('.notification-item'));
          });
        });

        document.querySelectorAll('.delete-notification-btn').forEach(button => {
          button.addEventListener('click', function() {
            const notificationId = this.getAttribute('data-id');
            deleteNotification(notificationId, this.closest('.notification-item'));
          });
        });
      })
      .catch(error => {
        console.error('Error fetching or processing notifications:', error);
        notificationsList.innerHTML = '<p>Error loading notifications. Check console for details.</p>';
      });
  }
    
  function markNotificationAsRead(id, listItem) {
    fetch(`/api/notifications/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      if (response.ok) {
        fetchNotifications(); // Refresh the list
      }
    })
    .catch(error => {
      console.error('Error marking notification as read:', error);
    });
  }

  function deleteNotification(id, listItem) {
    fetch(`/api/notifications/${id}`, {
      method: 'DELETE',
    })
    .then(response => {
      if (response.ok) {
        listItem.remove();
        if (document.querySelectorAll('.notification-item').length === 0) {
          notificationsList.innerHTML = `<p>No ${showingAll ? '' : 'new '}notifications.</p>`;
        }
      } else {
        response.json().then(data => {
          console.error('Error deleting notification:', data.error);
          alert('Error deleting notification: ' + data.error);
        });
      }
    })
    .catch(error => {
      console.error('Error deleting notification:', error);
      alert('Error deleting notification.');
    });
  }

  if (showAllButton) {
    showAllButton.addEventListener('click', () => {
      showingAll = !showingAll;
      showAllButton.textContent = showingAll ? 'Show Unread Notifications' : 'Show All Notifications';
      fetchNotifications();
    });
  }

  // Initial fetch
  fetchNotifications();
});
