// Client-side JavaScript for users page
document.addEventListener('DOMContentLoaded', function() {
  // Fetch users data
  fetch('/users')
    .then(response => response.json())
    .then(users => {
      const usersList = document.getElementById('users-list');
      
      if (users.length === 0) {
        usersList.innerHTML = '<p>No users found.</p>';
        return;
      }
      
      let html = '<table class="data-table">';
      html += '<thead><tr><th>Username</th><th>Email</th><th>Created At</th></tr></thead>';
      html += '<tbody>';
      
      users.forEach(user => {
        html += `<tr>
          <td>${user.username}</td>
          <td>${user.email}</td>
          <td>${new Date(user.created_at).toLocaleString()}</td>
        </tr>`;
      });
      
      html += '</tbody></table>';
      usersList.innerHTML = html;
    })
    .catch(error => {
      console.error('Error fetching users:', error);
      document.getElementById('users-list').innerHTML = '<p>Error loading users.</p>';
    });
});
