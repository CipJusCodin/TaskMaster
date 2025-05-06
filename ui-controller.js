// DOM elements
const loginContainerEl = document.getElementById('loginContainer');
const appContainerEl = document.getElementById('appContainer');
const emailLoginButtonEl = document.getElementById('emailLoginButton');
const logoutButtonEl = document.getElementById('logoutButton');
const errorContainerEl = document.getElementById('errorContainer');
const loadingOverlayEl = document.getElementById('loadingOverlay');

const userAvatarEl = document.getElementById('userAvatar');
const userNameEl = document.getElementById('userName');
const userEmailEl = document.getElementById('userEmail');
let syncStatusEl = document.getElementById('syncStatus'); // Changed to let instead of const
const lastSyncTimeEl = document.getElementById('lastSyncTime');

const currentDateEl = document.getElementById('currentDate');
const totalTasksEl = document.getElementById('totalTasks');
const completedTasksEl = document.getElementById('completedTasks');
const pendingTasksEl = document.getElementById('pendingTasks');
const overdueTasksEl = document.getElementById('overdueTasks');
const progressBarEl = document.getElementById('progressBar');

const allTasksTableEl = document.getElementById('allTasksTable');
const todayTasksTableEl = document.getElementById('todayTasksTable');
const pendingTasksTableEl = document.getElementById('pendingTasksTable');
const myTasksTableEl = document.getElementById('myTasksTable');

const taskModal = document.getElementById('taskModal');

// Set current date
const today = new Date();
const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
currentDateEl.textContent = today.toLocaleDateString('en-US', dateOptions);

// Update tasks UI
function updateTasksUI() {
    updateStats();
    renderAllTasks();
    renderTodayTasks();
    renderPendingTasks();
    renderMyTasks();
}

// Update dashboard stats
function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(task => task.status === 'completed').length;
    const pending = tasks.filter(task => task.status === 'pending').length;
    
    // Calculate overdue tasks (past due date and not completed)
    const todayFormatted = formatDate(today);
    
    const overdue = tasks.filter(task => 
        new Date(task.date) < new Date(todayFormatted) && 
        task.status !== 'completed'
    ).length;
    
    totalTasksEl.textContent = total;
    completedTasksEl.textContent = completed;
    pendingTasksEl.textContent = pending;
    overdueTasksEl.textContent = overdue;
    
    // Calculate progress for today's tasks
    const todayTasks = tasks.filter(task => task.date === todayFormatted);
    const todayCompleted = todayTasks.filter(task => task.status === 'completed').length;
    const todayProgress = todayTasks.length > 0 
        ? (todayCompleted / todayTasks.length) * 100 
        : 0;
    
    progressBarEl.style.width = `${todayProgress}%`;
}

// Render all tasks
function renderAllTasks() {
    allTasksTableEl.innerHTML = '';
    
    if (tasks.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="7" style="text-align: center;">No tasks found</td>
        `;
        allTasksTableEl.appendChild(row);
        
        // Sample task creation code removed
        return;
    }
    
    // Today's date for checking overdue tasks
    const todayFormatted = formatDate(today);
    
    tasks.forEach(task => {
        const row = document.createElement('tr');
        
        // Check if task is overdue
        const isOverdue = new Date(task.date) < new Date(todayFormatted) && 
                          task.status !== 'completed';
        
        // Status styling
        let statusClass = '';
        let statusText = '';
        
        if (isOverdue) {
            statusClass = 'status-failed'; // Use the failed style for overdue
            statusText = 'Overdue';
        } else {
            switch(task.status) {
                case 'completed':
                    statusClass = 'status-completed';
                    statusText = 'Completed';
                    break;
                case 'pending':
                    statusClass = 'status-pending';
                    statusText = 'Pending';
                    break;
                case 'failed':
                    statusClass = 'status-failed';
                    statusText = 'Failed';
                    break;
            }
        }
        
        // Priority styling
        let priorityClass = '';
        switch(task.priority) {
            case 'high':
                priorityClass = 'priority-high';
                break;
            case 'medium':
                priorityClass = 'priority-medium';
                break;
            case 'low':
                priorityClass = 'priority-low';
                break;
        }
        
        // Format date for display
        const displayDate = new Date(task.date).toLocaleDateString('en-US');
        
        // Highlight overdue tasks
        const rowStyle = isOverdue ? 'background-color: #fff3cd;' : '';
        row.setAttribute('style', rowStyle);
        
        // Check if task was created by current user
        const isMyTask = task.createdBy?.id === currentUser?.id;
        
        row.innerHTML = `
            <td>
                <input type="checkbox" class="checkbox" data-id="${task.id}" ${task.completed ? 'checked' : ''}>
            </td>
            <td>${task.name}</td>
            <td>${displayDate}</td>
            <td>
                <span class="priority-badge ${priorityClass}"></span>
                ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </td>
            <td>
                <span class="status-badge ${statusClass}">
                    ${statusText}
                </span>
            </td>
            <td>
                <span class="user-badge">
                    <i class="fas fa-user"></i> ${task.createdBy?.name || 'Unknown User'}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    <i class="fas fa-edit action-icon edit-task" data-id="${task.id}"></i>
                    <i class="fas fa-sticky-note action-icon view-notes" data-id="${task.id}" title="${task.notes}"></i>
                    <i class="fas fa-trash action-icon delete-task" data-id="${task.id}"></i>
                </div>
            </td>
        `;
        
        allTasksTableEl.appendChild(row);
    });
    
    // Add event listeners
    addTaskEventListeners();
}

// The rest of the file remains unchanged