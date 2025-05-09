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
    renderMyTasks();
}

// Update dashboard stats
function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(task => task.status === 'completed').length;
    const pending = tasks.filter(task => task.status === 'pending').length;
    
    // Calculate overdue tasks (past due date and not completed)
    const todayFormatted = formatDate(today);
    
    // Exclude recurring tasks from overdue count
    const overdue = tasks.filter(task => 
        !task.recurring && // Only non-recurring tasks can be overdue
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
        
        // Check if task is recurring
        const isRecurring = task.recurring === true;
        
        // If it's recurring, add the recurring-task class
        if (isRecurring) {
            row.classList.add('recurring-task');
        }
        
        // Check if task is overdue - recurring tasks are never overdue
        const isOverdue = !isRecurring && 
                         new Date(task.date) < new Date(todayFormatted) && 
                         task.status !== 'completed';
        
        // Status styling
        let statusClass = '';
        let statusText = '';
        
        if (isOverdue) {
            statusClass = 'status-failed';
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
        
        // Task name with recurring badge if needed
        const taskNameHtml = isRecurring ? 
            `${task.name} <span class="recurring-badge"><i class="fas fa-sync-alt"></i> Daily</span>` : 
            task.name;
        
        row.innerHTML = `
            <td>
                <input type="checkbox" class="checkbox" data-id="${task.id}" ${task.completed ? 'checked' : ''}>
            </td>
            <td>${taskNameHtml}</td>
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
        
        // Check if task is recurring
        const isRecurring = task.recurring === true;
        
        // If it's recurring, add the recurring-task class
        if (isRecurring) {
            row.classList.add('recurring-task');
        }
        
        // Check if task is overdue
        const isOverdue = !isRecurring && 
                         new Date(task.date) < new Date(todayFormatted) && 
                         task.status !== 'completed';
        
        // Status styling
        let statusClass = '';
        let statusText = '';
        
        if (isOverdue) {
            statusClass = 'status-failed';
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
        
        // Task name with recurring badge if needed
        const taskNameHtml = isRecurring ? 
            `${task.name} <span class="recurring-badge"><i class="fas fa-sync-alt"></i> Daily</span>` : 
            task.name;
        
        row.innerHTML = `
            <td>
                <input type="checkbox" class="checkbox" data-id="${task.id}" ${task.completed ? 'checked' : ''}>
            </td>
            <td>${taskNameHtml}</td>
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
    // Checkboxes - UPDATED to delete completed tasks
    document.querySelectorAll('.checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const taskId = this.getAttribute('data-id');
            const task = tasks.find(t => t.id === taskId);
            
            if (task) {
                // If checkbox is checked (task is completed)
                if (this.checked) {
                    // Show loading indicator
                    showLoading();
                    
                    // For recurring tasks
                    if (task.recurring === true) {
                        // Mark completed status temporarily to trigger next day creation
                        task.completed = true;
                        task.status = 'completed';
                        task.lastUpdated = new Date().toISOString();
                        task.lastUpdatedBy = currentUser;
                        
                        // Save the completed status and then mark for next day
                        saveTask(task)
                            .then(() => {
                                markRecurringTaskForNextDay(task)
                                    .then(() => {
                                        console.log('Recurring task marked for next day creation');
                                        // Now delete the current instance of recurring task
                                        deleteTaskFromFirestore(taskId)
                                            .then(() => {
                                                // Remove from local array
                                                tasks = tasks.filter(t => t.id !== taskId);
                                                // Update UI
                                                updateTasksUI();
                                                // Hide loading
                                                hideLoading();
                                            })
                                            .catch(error => {
                                                console.error('Error deleting recurring task:', error);
                                                hideLoading();
                                                showError('Error completing recurring task: ' + error.message);
                                            });
                                    })
                                    .catch(error => {
                                        console.error('Error marking for next day:', error);
                                        hideLoading();
                                        showError('Error preparing recurring task: ' + error.message);
                                    });
                            })
                            .catch(error => {
                                console.error('Error saving task status:', error);
                                hideLoading();
                                showError('Error saving task status: ' + error.message);
                            });
                    } else {
                        // For regular tasks - delete immediately when completed
                        deleteTaskFromFirestore(taskId)
                            .then(() => {
                                // Remove from local array
                                tasks = tasks.filter(t => t.id !== taskId);
                                // Update UI
                                updateTasksUI();
                                // Hide loading
                                hideLoading();
                                
                                // Show success message
                                const successMsg = document.createElement('div');
                                successMsg.className = 'success-message';
                                successMsg.textContent = `Task "${task.name}" completed and removed`;
                                document.body.appendChild(successMsg);
                                
                                // Remove success message after 3 seconds
                                setTimeout(() => {
                                    if (successMsg.parentNode) {
                                        successMsg.parentNode.removeChild(successMsg);
                                    }
                                }, 3000);
                            })
                            .catch(error => {
                                console.error('Error deleting task:', error);
                                hideLoading();
                                showError('Error completing task: ' + error.message);
                            });
                    }
                } else {
                    // If checkbox is unchecked, just update the status
                    task.completed = false;
                    task.status = 'pending';
                    task.lastUpdated = new Date().toISOString();
                    task.lastUpdatedBy = currentUser;
                    
                    // Save to Firestore
                    saveTask(task)
                        .catch(error => {
                            console.error('Error updating task status:', error);
                            showError('Error updating task status: ' + error.message);
                        });
                }
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

// Edit task - Updated for recurring tasks
function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    
    if (task) {
        document.getElementById('taskId').value = task.id;
        document.getElementById('taskName').value = task.name;
        document.getElementById('taskDate').value = task.date;
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskNotes').value = task.notes;
        document.getElementById('taskStatus').value = task.status;
        
        // Set recurring checkbox
        const recurringCheckbox = document.getElementById('taskRecurring');
        if (recurringCheckbox) {
            recurringCheckbox.checked = task.recurring === true;
        }
        
        document.getElementById('taskModalTitle').textContent = 'Edit Task';
        taskModal.classList.add('show');
    }
}

// Delete task - Updated for handling recurring tasks
function deleteTask(taskId) {
    // Find the task for logging purposes
    const taskToDelete = tasks.find(t => t.id === taskId);
    
    if (!taskToDelete) {
        showError(`Error: Task with ID ${taskId} not found`);
        return;
    }
    
    const taskName = taskToDelete.name;
    const isRecurring = taskToDelete.recurring === true;
    const hasNextOccurrence = taskToDelete.nextOccurrenceDate != null;
    
    // Create confirmation message
    let confirmMessage = 'Are you sure you want to delete this task?';
    if (isRecurring) {
        confirmMessage = 'This is a recurring task. Are you sure you want to delete it? It will not reappear.';
    }
    
    const confirmDelete = confirm(confirmMessage);
    
    if (confirmDelete) {
        // Show loading indicator immediately
        showLoading();
        console.log(`Confirmed deletion for task: ${taskName} (ID: ${taskId})`);
        console.log(`Task is recurring: ${isRecurring}, has next occurrence: ${hasNextOccurrence}`);
        
        // Use a single promise chain for the delete operation
        deleteTaskFromFirestore(taskId)
            .then(result => {
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
                if (isRecurring) {
                    successMsg.innerHTML = `<i class="fas fa-calendar-times"></i> Recurring task "${taskName}" deleted and will not reappear`;
                } else {
                    successMsg.textContent = `Task "${taskName}" deleted successfully`;
                }
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

// Render filtered tasks - Updated for recurring tasks
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
        
        // Check if task is recurring
        const isRecurring = task.recurring === true;
        
        // If it's recurring, add the recurring-task class
        if (isRecurring) {
            row.classList.add('recurring-task');
        }
        
        // Check if task is overdue - recurring tasks are never overdue
        const isOverdue = !isRecurring && 
                         new Date(task.date) < new Date(todayFormatted) && 
                         task.status !== 'completed';
        
        // Status styling
        let statusClass = '';
        let statusText = '';
        
        if (isOverdue) {
            statusClass = 'status-failed';
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
        
        // Task name with recurring badge if needed
        const taskNameHtml = isRecurring ? 
            `${task.name} <span class="recurring-badge"><i class="fas fa-sync-alt"></i> Daily</span>` : 
            task.name;
            
        row.innerHTML = `
            <td>
                <input type="checkbox" class="checkbox" data-id="${task.id}" ${task.completed ? 'checked' : ''}>
            </td>
            <td>${taskNameHtml}</td>
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
    
    // Add Task button in All Tasks
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
    
    // Add Task button in My Tasks
    document.getElementById('addMyTaskBtn').addEventListener('click', function() {
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
    
    // Save task button - Updated for duplicate prevention
    document.getElementById('saveTaskBtn').addEventListener('click', function() {
        const taskId = document.getElementById('taskId').value;
        const taskName = document.getElementById('taskName').value;
        const taskDate = document.getElementById('taskDate').value;
        const taskPriority = document.getElementById('taskPriority').value;
        const taskNotes = document.getElementById('taskNotes').value;
        const taskStatus = document.getElementById('taskStatus').value;
        const taskRecurring = document.getElementById('taskRecurring').checked;
        
        if (!taskName || !taskDate) {
            alert('Please fill in all required fields');
            return;
        }
        
        if (taskId) {
            // Edit existing task
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                // Store original name for duplicate check logic
                const originalName = task.name;
                
                // Update task properties
                task.name = taskName;
                task.date = taskDate;
                task.priority = taskPriority;
                task.notes = taskNotes;
                task.status = taskStatus;
                task.completed = taskStatus === 'completed';
                task.recurring = taskRecurring;
                task.lastUpdated = new Date().toISOString();
                task.lastUpdatedBy = currentUser;
                
                // Save to Firestore
                saveTask(task)
                    .then(() => {
                        // Close modal
                        taskModal.classList.remove('show');
                    })
                    .catch(error => {
                        // Error is already handled in saveTask function
                        // The modal stays open so the user can fix the duplicate
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
                recurring: taskRecurring,
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
                })
                .catch(error => {
                    // Error is already handled in saveTask function
                    // The modal stays open so the user can fix the duplicate
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
            (task.notes && task.notes.toLowerCase().includes(searchTerm))
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

// Function to apply all filters
function applyFilters() {
    const statusFilter = document.getElementById('statusFilter').value;
    const priorityFilter = document.getElementById('priorityFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;
    
    // Today's date for date filtering
    const todayFormatted = formatDate(today);
    
    // Yesterday's date
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayFormatted = formatDate(yesterday);
    
    // This week's start (Sunday)
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
    const thisWeekStartFormatted = formatDate(thisWeekStart);
    
    let filteredTasks = [...tasks];
    
    // Apply status filter
    if (statusFilter !== 'all') {
        if (statusFilter === 'overdue') {
            // Filter overdue tasks (not completed and past due date)
            filteredTasks = filteredTasks.filter(task => 
                !task.recurring && // Recurring tasks can't be overdue
                new Date(task.date) < new Date(todayFormatted) && 
                task.status !== 'completed'
            );
        } else {
            // Filter by status
            filteredTasks = filteredTasks.filter(task => task.status === statusFilter);
        }
    }
    
    // Apply priority filter
    if (priorityFilter !== 'all') {
        filteredTasks = filteredTasks.filter(task => task.priority === priorityFilter);
    }
    
    // Apply date filter
    if (dateFilter !== 'all') {
        switch(dateFilter) {
            case 'today':
                filteredTasks = filteredTasks.filter(task => task.date === todayFormatted);
                break;
            case 'yesterday':
                filteredTasks = filteredTasks.filter(task => task.date === yesterdayFormatted);
                break;
            case 'thisWeek':
                filteredTasks = filteredTasks.filter(task => {
                    // Check if task date is between this week's start (Sunday) and today
                    const taskDate = new Date(task.date);
                    return taskDate >= new Date(thisWeekStartFormatted) && 
                           taskDate <= new Date(todayFormatted);
                });
                break;
        }
    }
    
    // Render filtered tasks
    renderFilteredTasks(filteredTasks);
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