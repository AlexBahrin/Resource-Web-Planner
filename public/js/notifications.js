document.addEventListener('DOMContentLoaded', function() {
  const notificationsList = document.getElementById('notifications-list');
  const showAllButton = document.getElementById('show-all-notifications-btn');
  let showingAll = false;

  function fetchNotifications() {
    const url = showingAll ? '/api/notifications?showAll=true' : '/api/notifications';
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(notifications => {
        console.log('Fetching URL:', url, 'Received data:', notifications);
        
        if (!notifications) {
          notificationsList.innerHTML = '<p>Error loading notifications.</p>';
          return;
        }

        if (notifications.length === 0) {
          notificationsList.innerHTML = '<p>No new notifications.</p>';
          return;
        }
        
        let html = '<ul class="notifications-list">';
        
        notifications.forEach(notification => {
          const date = new Date(notification.created_at).toLocaleString();
          html += `
            <li class="notification-item ${notification.is_read ? 'read' : 'unread'}" id="notification-${notification.id}">
              <span class="notification-message">${notification.message}</span>
              <span class="notification-date">${date}</span>
              <div class="notification-actions">
                ${!notification.is_read ? `<button class="mark-read-btn" data-id="${notification.id}">Mark as Read</button>` : ''}
                <button class="delete-notification-btn" data-id="${notification.id}">Delete</button>
              </div>
            </li>
          `;
        });
        
        html += '</ul>';
        notificationsList.innerHTML = html;

        document.querySelectorAll('.mark-read-btn').forEach(button => {
          button.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            markNotificationAsRead(id, this.closest('li'));
          });
        });
        document.querySelectorAll('.delete-notification-btn').forEach(button => {
          button.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            deleteNotification(id, this.closest('li'));
          });
        });
      })
      .catch(error => {
        console.error('Error fetching notifications:', error);
        notificationsList.innerHTML = '<p>Error fetching notifications. Please try again later.</p>';
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
      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }
      return response.json();
    })
    .then(updatedNotification => {
      if (listItem) {
        listItem.classList.remove('unread');
        listItem.classList.add('read');
        const markReadButton = listItem.querySelector('.mark-read-btn');
        if (markReadButton) {
          markReadButton.remove();
        }
      }
      fetchNotifications();
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
      if (!response.ok) {
        if (response.status === 204) return null;
        throw new Error('Failed to delete notification');
      }
      return response.status === 204 ? null : response.json();
    })
    .then(() => {
      if (listItem) {
        listItem.remove();
      }
      if (notificationsList.children.length === 0 || (notificationsList.firstElementChild && notificationsList.firstElementChild.children.length === 0)) {
        notificationsList.innerHTML = '<p>No new notifications.</p>';
      }
    })
    .catch(error => {
      console.error('Error deleting notification:', error);
    });
  }

  if (showAllButton) {
    showAllButton.addEventListener('click', () => {
      showingAll = !showingAll;
      showAllButton.textContent = showingAll ? 'Show Unread Notifications' : 'Show All Notifications';
      fetchNotifications();
    });
  }

  fetchNotifications();
});
