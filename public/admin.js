let allEntries = [];
let currentFilterRole = 'all';
let currentSearchTerm = '';

// DOM Elements
const tbody = document.getElementById('waitlist-tbody');
const emptyState = document.getElementById('table-empty');
const searchInput = document.getElementById('search-input');
const roleFilters = document.querySelectorAll('.filter-pill');
const refreshBtn = document.getElementById('refresh-btn');
const dbStatusBadge = document.getElementById('db-status-badge');
const dbStatusText = document.getElementById('db-status-text');

// Stat DOM Elements
const statTotal = document.getElementById('stat-total');
const statStudents = document.getElementById('stat-students');
const statStudentsPct = document.getElementById('stat-students-pct');
const statVendors = document.getElementById('stat-vendors');
const statVendorsPct = document.getElementById('stat-vendors-pct');
const statStaff = document.getElementById('stat-staff');
const statStaffPct = document.getElementById('stat-staff-pct');
const statToday = document.getElementById('stat-today');

// Filter counts
const countAll = document.getElementById('filter-count-all');
const countStudent = document.getElementById('filter-count-student');
const countVendor = document.getElementById('filter-count-vendor');
const countStaff = document.getElementById('filter-count-staff');
const countOther = document.getElementById('filter-count-other');

// Check Database and Server Status
async function checkStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.database === 'connected') {
      dbStatusBadge.className = 'db-status-pill connected';
      dbStatusText.textContent = 'PostgreSQL Connected';
    } else if (data.database === 'connecting/fallback') {
      dbStatusBadge.className = 'db-status-pill';
      dbStatusText.textContent = 'DB Connecting / Local Active';
    } else {
      dbStatusBadge.className = 'db-status-pill error';
      dbStatusText.textContent = 'Database Disconnected';
    }
  } catch (err) {
    dbStatusBadge.className = 'db-status-pill error';
    dbStatusText.textContent = 'Server Offline';
  }
}

// Fetch all entries from API
async function fetchWaitlist() {
  try {
    const res = await fetch('/api/waitlist');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    allEntries = data.entries || [];
    updateStats(data.stats || {});
    applyFilters();
  } catch (err) {
    console.error('Failed to load waitlist:', err);
    tbody.innerHTML = `<tr><td colspan="8" class="table-loading" style="color:#EF4444;">Failed to load entries: ${err.message}</td></tr>`;
  }
}

// Update stats numbers & badges
function updateStats(stats) {
  const total = stats.total || 0;
  statTotal.textContent = total;
  statStudents.textContent = stats.students || 0;
  statVendors.textContent = stats.vendors || 0;
  statStaff.textContent = (stats.staff || 0) + (stats.others || 0);
  statToday.textContent = stats.today || 0;

  statStudentsPct.textContent = total ? `${Math.round((stats.students / total) * 100)}%` : '0%';
  statVendorsPct.textContent = total ? `${Math.round((stats.vendors / total) * 100)}%` : '0%';
  statStaffPct.textContent = total ? `${Math.round(((stats.staff + stats.others) / total) * 100)}%` : '0%';

  // Update filter pill counts
  countAll.textContent = total;
  countStudent.textContent = stats.students || 0;
  countVendor.textContent = stats.vendors || 0;
  countStaff.textContent = stats.staff || 0;
  countOther.textContent = stats.others || 0;
}

// Filter and render
function applyFilters() {
  const term = currentSearchTerm.toLowerCase().trim();

  const filtered = allEntries.filter(entry => {
    // Role filter
    const role = (entry.user_type || '').toLowerCase();
    if (currentFilterRole !== 'all') {
      if (currentFilterRole === 'other') {
        if (role === 'student' || role === 'vendor' || role === 'staff') return false;
      } else if (role !== currentFilterRole) {
        return false;
      }
    }

    // Search term filter
    if (term) {
      const matchName = (entry.name || '').toLowerCase().includes(term);
      const matchEmail = (entry.email || '').toLowerCase().includes(term);
      const matchPhone = (entry.phone || '').toLowerCase().includes(term);
      const matchDept = (entry.department || '').toLowerCase().includes(term);
      if (!matchName && !matchEmail && !matchPhone && !matchDept) return false;
    }

    return true;
  });

  renderTable(filtered);
}

// Render Table Rows
function renderTable(entries) {
  if (entries.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  tbody.innerHTML = entries.map((entry, idx) => {
    const role = (entry.user_type || 'Other').toLowerCase();
    let roleClass = 'role-other';
    if (role === 'student') roleClass = 'role-student';
    else if (role === 'vendor') roleClass = 'role-vendor';
    else if (role === 'staff') roleClass = 'role-staff';

    const initials = (entry.name || '?')
      .split(' ')
      .map(p => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const formattedDate = entry.created_at
      ? new Date(entry.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
      : 'Recently';

    return `
      <tr>
        <td><strong>${entries.length - idx}</strong></td>
        <td>
          <div class="user-cell">
            <div class="user-avatar">${initials}</div>
            <span class="user-name">${escapeHtml(entry.name || '')}</span>
          </div>
        </td>
        <td>
          <a class="contact-link" href="mailto:${escapeHtml(entry.email || '')}">${escapeHtml(entry.email || '')}</a>
        </td>
        <td>
          <a class="contact-link" href="tel:${escapeHtml(entry.phone || '')}">${escapeHtml(entry.phone || '')}</a>
        </td>
        <td>
          <span class="role-pill ${roleClass}">${escapeHtml(entry.user_type || 'Other')}</span>
        </td>
        <td>${escapeHtml(entry.department || '—')}</td>
        <td style="color:#6E6D66; font-size:13px;">${formattedDate}</td>
        <td class="text-right">
          <button class="delete-btn" title="Remove entry" onclick="deleteEntry(${entry.id})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Delete entry
window.deleteEntry = async function (id) {
  if (!confirm('Are you sure you want to remove this waitlist entry?')) return;

  try {
    const res = await fetch(`/api/waitlist/${id}`, { method: 'DELETE' });
    if (res.ok) {
      allEntries = allEntries.filter(e => e.id !== id);
      fetchWaitlist();
    }
  } catch (err) {
    alert('Failed to delete entry: ' + err.message);
  }
};

// HTML escape helper
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Event Listeners
searchInput.addEventListener('input', (e) => {
  currentSearchTerm = e.target.value;
  applyFilters();
});

roleFilters.forEach(pill => {
  pill.addEventListener('click', () => {
    roleFilters.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentFilterRole = pill.dataset.role;
    applyFilters();
  });
});

refreshBtn.addEventListener('click', () => {
  refreshBtn.classList.add('rotating');
  fetchWaitlist().finally(() => {
    setTimeout(() => refreshBtn.classList.remove('rotating'), 600);
  });
});

// Initialize on page load
checkStatus();
fetchWaitlist();

// Auto-refresh every 30 seconds
setInterval(() => {
  checkStatus();
  fetchWaitlist();
}, 30000);
