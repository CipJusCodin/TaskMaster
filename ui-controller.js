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
            // Add the overdue class to the row
            row.classList.add('overdue-row');
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
        
        // Removed the inline styling for overdue tasks
        // const rowStyle = isOverdue ? 'background-color: #fff3cd;' : '';
        // row.setAttribute('style', rowStyle);
        
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

// Render today's tasks
function renderTodayTasks() {
    todayTasksTableEl.innerHTML = '';
    
    const todayFormatted = formatDate(today);
    
    const todayTasks = tasks.filter(task => task.date === todayFormatted);
    
    if (todayTasks.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="6" style="text-align: center;">No tasks for today</td>
        `;
        todayTasksTableEl.appendChild(row);
        return;
    }
    
    todayTasks.forEach(task => {
        const row = document.createElement('tr');
        
        // Status styling
        let statusClass = '';
        let statusText = '';
        
        // Check if task is overdue (unlikely for today's tasks, but possible if time is considered)
        const isOverdue = new Date(task.date) < new Date(todayFormatted) && 
                          task.status !== 'completed';
        
        if (isOverdue) {
            statusClass = 'status-failed'; // Use the failed style for overdue
            statusText = 'Overdue';
            // Add the overdue class to the row
            row.classList.add('overdue-row');
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
        
        row.innerHTML = `
            <td>
                <input type="checkbox" class="checkbox" data-id="${task.id}" ${task.completed ? 'checked' : ''}>
            </td>
            <td>${task.name}</td>
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
        
        todayTasksTableEl.appendChild(row);
    });
    
    // Add event listeners
    addTaskEventListeners();
}

// Render my tasks
function renderMyTasks() {
    myTasksTableEl.innerHTML = '';
    
    if (!currentUser) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="7" style="text-align: center;">Please sign in to view your tasks</td>
        `;
        myTasksTableEl.appendChild(row);
        return;
    }
    
    const myTasks = tasks.filter(task => task.createdBy?.id === currentUser.id);
    
    if (myTasks.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="7" style="text-align: center;">You haven't created any tasks yet</td>
        `;
        myTasksTableEl.appendChild(row);
        return;
    }
    
    // Today's date for checking overdue tasks
    const todayFormatted = formatDate(today);
    
    myTasks.forEach(task => {
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
            // Add the overdue class to the row
            row.classList.add('overdue-row');
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
        const lastUpdated = task.lastUpdated 
            ? new Date(task.lastUpdated).toLocaleString('en-US')
            : 'Never';
        
        // Removed the inline styling for overdue tasks
        // const rowStyle = isOverdue ? 'background-color: #fff3cd;' : '';
        // row.setAttribute('style', rowStyle);
        
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
            <td>${lastUpdated}</td>
            <td>
                <div class="table-actions">
                    <i class="fas fa-edit action-icon edit-task" data-id="${task.id}"></i>
                    <i class="fas fa-sticky-note action-icon view-notes" data-id="${task.id}" title="${task.notes}"></i>
                    <i class="fas fa-trash action-icon delete-task" data-id="${task.id}"></i>
                </div>
            </td>
        `;
        
        myTasksTableEl.appendChild(row);
    });
    
    // Add event listeners
    addTaskEventListeners();
}

// Add event listeners for task actions
function addTaskEventListeners() {
    // Checkboxes
    document.querySelectorAll('.checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const taskId = this.getAttribute('data-id');
            const task = tasks.find(t => t.id === taskId);
            
            if (task) {
                task.completed = this.checked;
                task.status = this.checked ? 'completed' : 'pending';
                task.lastUpdated = new Date().toISOString();
                task.lastUpdatedBy = currentUser;
                
                // Save to Firestore
                saveTask(task);
            }
        });
    });
    
    // Edit buttons
    document.querySelectorAll('.edit-task').forEach(btn => {
        btn.addEventListener('click', function() {
            const taskId = this.getAttribute('data-id');
            editTask(taskId);
        });
    });
    
    // Delete buttons
    document.querySelectorAll('.delete-task').forEach(btn => {
        btn.addEventListener('click', function() {
            const taskId = this.getAttribute('data-id');
            deleteTask(taskId);
        });
    });
    
    // View notes
    document.querySelectorAll('.view-notes').forEach(btn => {
        btn.addEventListener('click', function() {
            const taskId = this.getAttribute('data-id');
            const task = tasks.find(t => t.id === taskId);
            
            if (task && task.notes) {
                alert(`Notes for "${task.name}":\n\n${task.notes}`);
            } else {
                alert('No notes available for this task.');
            }
        });
    });
}

// Edit task
function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    
    if (task) {
        document.getElementById('taskId').value = task.id;
        document.getElementById('taskName').value = task.name;
        document.getElementById('taskDate').value = task.date;
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskNotes').value = task.notes;
        document.getElementById('taskStatus').value = task.status;
        
        document.getElementById('taskModalTitle').textContent = 'Edit Task';
        taskModal.classList.add('show');
    }
}

// Delete task - FIXED VERSION
function deleteTask(taskId) {
    // Find the task for logging purposes
    const taskToDelete = tasks.find(t => t.id === taskId);
    const taskName = taskToDelete ? taskToDelete.name : 'Unknown task';
    
    // Create a single reference to the delete confirmation action
    const confirmDelete = confirm('Are you sure you want to delete this task?');
    
    if (confirmDelete) {
        // Show loading indicator immediately
        showLoading();
        console.log(`Confirmed deletion for task: ${taskName} (ID: ${taskId})`);
        
        // Use a single promise chain for the delete operation
        deleteTaskFromFirestore(taskId)
            .then(() => {
                console.log(`Task successfully deleted from Firestore: ${taskName}`);
                
                // Remove from local array
                tasks = tasks.filter(task => task.id !== taskId);
                
                // Update UI to reflect the change
                updateTasksUI();
                
                // Hide loading indicator
                hideLoading();
                
                // Show success message
                const successMsg = document.createElement('div');
                successMsg.className = 'success-message';
                successMsg.textContent = `Task "${taskName}" deleted successfully`;
                document.body.appendChild(successMsg);
                
                // Remove success message after 3 seconds
                setTimeout(() => {
                    if (successMsg.parentNode) {
                        successMsg.parentNode.removeChild(successMsg);
                    }
                }, 3000);
            })
            .catch(error => {
                console.error(`Error deleting task: ${taskName}`, error);
                showError(`Error deleting task: ${error.message}`);
                hideLoading();
            });
    }
}

// Render filtered tasks
function renderFilteredTasks(filteredTasks) {
    allTasksTableEl.innerHTML = '';
    
    if (filteredTasks.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="7" style="text-align: center;">No tasks match your filters</td>
        `;
        allTasksTableEl.appendChild(row);
        return;
    }
    
    // Today's date for checking overdue tasks
    const todayFormatted = formatDate(today);
    
    filteredTasks.forEach(task => {
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
            // Add the overdue class to the row
            row.classList.add('overdue-row');
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
        
        // Removed the inline styling for overdue tasks
        // const rowStyle = isOverdue ? 'background-color: #fff3cd;' : '';
        // row.setAttribute('style', rowStyle);
        
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

// Apply all filters
function applyFilters() {
    const statusFilter = document.getElementById('statusFilter').value;
    const priorityFilter = document.getElementById('priorityFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;
    const searchTerm = document.getElementById('searchTasks').value.toLowerCase();
    
    let filteredTasks = tasks;
    
    // Apply search filter
    if (searchTerm.trim() !== '') {
        filteredTasks = filteredTasks.filter(task => 
            task.name.toLowerCase().includes(searchTerm) ||
            task.notes.toLowerCase().includes(searchTerm)
        );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
        if (statusFilter === 'overdue') {
            // Show all overdue tasks (past due date and not completed)
            const todayFormatted = formatDate(today);
            filteredTasks = filteredTasks.filter(task => 
                new Date(task.date) < new Date(todayFormatted) && 
                task.status !== 'completed'
            );
        } else {
            // Normal status filtering
            filteredTasks = filteredTasks.filter(task => task.status === statusFilter);
        }
    }
    
    // Apply priority filter
    if (priorityFilter !== 'all') {
        filteredTasks = filteredTasks.filter(task => task.priority === priorityFilter);
    }
    
    // Apply date filter
    if (dateFilter !== 'all') {
        const todayFormatted = formatDate(today);
        
        // Yesterday's date
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayFormatted = formatDate(yesterday);
        
        switch(dateFilter) {
            case 'today':
                filteredTasks = filteredTasks.filter(task => task.date === todayFormatted);
                break;
            case 'yesterday':
                filteredTasks = filteredTasks.filter(task => task.date === yesterdayFormatted);
                break;
            case 'thisWeek':
                const oneWeekAgo = new Date(today);
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                const oneWeekAgoFormatted = formatDate(oneWeekAgo);
                
                filteredTasks = filteredTasks.filter(task => 
                    task.date >= oneWeekAgoFormatted && task.date <= todayFormatted
                );
                break;
        }
    }
    
    renderFilteredTasks(filteredTasks);
}

// Setup UI event listeners
function setupUIEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Hide all panels
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            // Show corresponding panel
            const targetPanel = this.getAttribute('data-target');
            document.getElementById(targetPanel).classList.add('active');
        });
    });
    
    // Add Task button
    document.getElementById('addTaskBtn').addEventListener('click', function() {
        // Reset form
        document.getElementById('taskForm').reset();
        document.getElementById('taskId').value = '';
        
        document.getElementById('taskDate').value = formatDate(today);
        
        // Update modal title
        document.getElementById('taskModalTitle').textContent = 'Add New Task';
        
        // Show modal
        taskModal.classList.add('show');
    });
    
    // Add Today Task button
    document.getElementById('addTodayTaskBtn').addEventListener('click', function() {
        // Reset form
        document.getElementById('taskForm').reset();
        document.getElementById('taskId').value = '';
        
        document.getElementById('taskDate').value = formatDate(today);
        
        // Update modal title
        document.getElementById('taskModalTitle').textContent = 'Add New Task';
        
        // Show modal
        taskModal.classList.add('show');
    });
    
    // Close modal button
    document.getElementById('closeTaskModal').addEventListener('click', function() {
        taskModal.classList.remove('show');
    });
    
    // Cancel button
    document.getElementById('cancelTaskBtn').addEventListener('click', function() {
        taskModal.classList.remove('show');
    });
    
    // Save task button
    document.getElementById('saveTaskBtn').addEventListener('click', function() {
        const taskId = document.getElementById('taskId').value;
        const taskName = document.getElementById('taskName').value;
        const taskDate = document.getElementById('taskDate').value;
        const taskPriority = document.getElementById('taskPriority').value;
        const taskNotes = document.getElementById('taskNotes').value;
        const taskStatus = document.getElementById('taskStatus').value;
        
        if (!taskName || !taskDate) {
            alert('Please fill in all required fields');
            return;
        }
        
        if (taskId) {
            // Edit existing task
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                task.name = taskName;
                task.date = taskDate;
                task.priority = taskPriority;
                task.notes = taskNotes;
                task.status = taskStatus;
                task.completed = taskStatus === 'completed';
                task.lastUpdated = new Date().toISOString();
                task.lastUpdatedBy = currentUser;
                
                // Save to Firestore
                saveTask(task)
                    .then(() => {
                        // Close modal
                        taskModal.classList.remove('show');
                    });
            }
        } else {
            // Add new task
            const newTaskId = generateId();
            
            const newTask = {
                id: newTaskId,
                name: taskName,
                date: taskDate,
                notes: taskNotes,
                priority: taskPriority,
                status: taskStatus,
                completed: taskStatus === 'completed',
                createdAt: new Date().toISOString(),
                createdBy: currentUser,
                lastUpdated: new Date().toISOString(),
                lastUpdatedBy: currentUser
            };
            
            // Save to Firestore
            saveTask(newTask)
                .then(() => {
                    // Close modal
                    taskModal.classList.remove('show');
                });
        }
    });
    
    // Search functionality
    document.getElementById('searchTasks').addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        
        if (searchTerm.trim() === '') {
            renderAllTasks();
            return;
        }
        
        const filteredTasks = tasks.filter(task => 
            task.name.toLowerCase().includes(searchTerm) ||
            task.notes.toLowerCase().includes(searchTerm)
        );
        
        renderFilteredTasks(filteredTasks);
    });
    
    // Status filter
    document.getElementById('statusFilter').addEventListener('change', function() {
        applyFilters();
    });
    
    // Priority filter
    document.getElementById('priorityFilter').addEventListener('change', function() {
        applyFilters();
    });
    
    // Date filter
    document.getElementById('dateFilter').addEventListener('change', function() {
        applyFilters();
    });
}

// COMPLETELY REWRITTEN: Update sync status function
// This is a more robust solution that completely replaces the element
// rather than trying to modify it, ensuring no animation state persists
function updateSyncStatus(status) {
    // Create a completely new element
    const newSyncStatus = document.createElement('div');
    newSyncStatus.id = 'syncStatus';
    newSyncStatus.className = 'sync-status';
    
    // Set content based on status
    switch(status) {
        case 'synced':
            newSyncStatus.classList.add('synced');
            newSyncStatus.innerHTML = '<i class="fas fa-check-circle"></i> Synced';
            break;
        case 'syncing':
            newSyncStatus.classList.add('syncing');
            // Create a static icon without animation
            newSyncStatus.innerHTML = '<i class="fas fa-sync-alt" style="animation: none !important; transform: none !important;"></i> Syncing...';
            break;
        case 'error':
            newSyncStatus.classList.add('error');
            newSyncStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> Sync Error';
            break;
    }
    
    // Replace the existing element with our new one
    if (syncStatusEl && syncStatusEl.parentNode) {
        syncStatusEl.parentNode.replaceChild(newSyncStatus, syncStatusEl);
        // Update our reference to point to the new element
        syncStatusEl = newSyncStatus;
    } else {
        console.error('Cannot update sync status: element not found in DOM');
    }
    
    // For safety, add a CSS class to an ancestor element to help ensure no animations persist
    const userInfo = document.querySelector('.user-info');
    if (userInfo) {
        userInfo.classList.remove('has-animation');
        userInfo.classList.add('no-animation');
        // Force a reflow
        void userInfo.offsetWidth;
    }
    
    // Log status changes for debugging
    console.log(`Sync status updated to: ${status}`);
}

// Show loading overlay
function showLoading() {
    if (loadingOverlayEl) {
        // Force display style first, then remove hidden class
        loadingOverlayEl.style.display = 'flex';
        loadingOverlayEl.classList.remove('hidden');
        
        // Add a safety timeout to automatically hide the loading overlay
        setTimeout(() => {
            hideLoading();
        }, 5000); // Reduced to 5 seconds for better UX
    } else {
        // If element reference is missing, try to get it directly
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
            loadingOverlay.classList.remove('hidden');
        }
    }
}

// Hide loading overlay
function hideLoading() {
    if (loadingOverlayEl) {
        loadingOverlayEl.classList.add('hidden');
        // Use a small delay before setting display none to allow any transitions
        setTimeout(() => {
            if (loadingOverlayEl) {
                loadingOverlayEl.style.display = 'none';
            }
        }, 50);
    } else {
        // If element reference is missing, try to get it directly
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 50);
        }
    }
}

// Show error message
function showError(message) {
    if (errorContainerEl) {
        errorContainerEl.textContent = message;
        errorContainerEl.classList.remove('hidden');
        
        // Hide error after 5 seconds
        setTimeout(() => {
            errorContainerEl.classList.add('hidden');
        }, 5000);
    }
    
    console.error(message);
    
    // Ensure loading overlay is hidden when an error occurs
    hideLoading();
    
    // If there was a sync error, update the status
    if (message.includes('sync') || message.includes('Firestore')) {
        updateSyncStatus('error');
    }
}

// Show login screen
function showLogin() {
    loginContainerEl.classList.remove('hidden');
    appContainerEl.classList.add('hidden');
    
    // Ensure loading overlay is hidden
    hideLoading();
}

// Show app screen
function showApp() {
    loginContainerEl.classList.add('hidden');
    appContainerEl.classList.remove('hidden');
    
    // Ensure loading overlay is hidden
    hideLoading();
}