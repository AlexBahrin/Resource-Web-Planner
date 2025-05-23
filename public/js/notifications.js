// Client-side JavaScript for notifications page
document.addEventListener('DOMContentLoaded', function() {
  // Fetch notifications data
  fetch('/notifications')
    .then(response => response.json())
    .then(notifications => {
      const notificationsList = document.getElementById('notifications-list');
      
      if (notifications.length === 0) {
        notificationsList.innerHTML = '<p>No new notifications.</p>';
        return;
      }
      
      let html = '<ul class="notifications-list">';
      
      notifications.forEach(notification => {
        html += `<li class="notification-item">
          <div class="notification-message">${notification.message}</div>
          <div class="notification-date">${new Date(notification.created_at).toLocaleString()}</div>
          <button class="mark-read-btn" data-id="${notification.id}">Mark as Read</button>
        </li>`;
      });
      
      html += '</ul>';
      notificationsList.innerHTML = html;
      
      // Add event listeners to "Mark as Read" buttons
      document.querySelectorAll('.mark-read-btn').forEach(button => {
        button.addEventListener('click', function() {
          const notificationId = this.getAttribute('data-id');
          markNotificationAsRead(notificationId, this.parentNode);
        });
      });
    })
    .catch(error => {
      console.error('Error fetching notifications:', error);
      document.getElementById('notifications-list').innerHTML = '<p>Error loading notifications.</p>';
    });
    
  // Function to mark notification as read
  function markNotificationAsRead(id, listItem) {
    fetch(`/notifications/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      if (response.ok) {
        listItem.remove();
        
        // Check if there are any notifications left
        if (document.querySelectorAll('.notification-item').length === 0) {
          document.getElementById('notifications-list').innerHTML = '<p>No new notifications.</p>';
        }
      }
    })
    .catch(error => {
      console.error('Error marking notification as read:', error);
    });
  }
});
