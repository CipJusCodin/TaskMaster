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

// Custom sort function for tasks
function sortTasks(tasksArray) {
    const todayFormatted = formatDate(new Date());
    
    return tasksArray.sort((a, b) => {
        // First check: Overdue vs. not overdue
        const aIsOverdue = !a.recurring && new Date(a.date) < new Date(todayFormatted) && a.status !== 'completed';
        const bIsOverdue = !b.recurring && new Date(b.date) < new Date(todayFormatted) && b.status !== 'completed';
        
        if (aIsOverdue && !bIsOverdue) return -1; // a is overdue, b is not -> a comes first
        if (!aIsOverdue && bIsOverdue) return 1;  // b is overdue, a is not -> b comes first
        
        // Second check: Today's tasks vs. future tasks
        const aIsToday = a.date === todayFormatted;
        const bIsToday = b.date === todayFormatted;
        
        if (aIsToday && !bIsToday) return -1; // a is today, b is not -> a comes first
        if (!aIsToday && bIsToday) return 1;  // b is today, a is not -> b comes first
        
        // Third check: Sort by date (for future tasks)
        if (a.date !== b.date) {
            return new Date(a.date) - new Date(b.date); // Sort by date ascending
        }
        
        // Fourth check: If dates are the same, sort by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority]; // High priority comes first
    });
}

// Function to handle fading out task from UI but keeping in database
function fadeOutAndRemoveTask(taskElement, taskId, task, isRecurring = false) {
    if (!taskElement) return; // Safety check
    
    // Apply fade-out animation class
    taskElement.classList.add('fade-out-task');
    
    // Wait for animation to complete before updating task status
    setTimeout(() => {
        if (isRecurring) {
            // For recurring tasks - handle as before with markRecurringTaskForNextDay
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
                                })
                                .catch(error => {
                                    console.error('Error deleting recurring task:', error);
                                    showError('Error completing recurring task: ' + error.message);
                                });
                        })
                        .catch(error => {
                            console.error('Error marking for next day:', error);
                            showError('Error preparing recurring task: ' + error.message);
                        });
                })
                .catch(error => {
                    console.error('Error saving task status:', error);
                    showError('Error saving task status: ' + error.message);
                });
        } else {
            // CHANGE: For regular tasks - mark as completed but DON'T delete from database
            // Instead, update status and hide from UI
            task.completed = true;
            task.status = 'completed';
            task.lastUpdated = new Date().toISOString();
            task.lastUpdatedBy = currentUser;
            task.completedAt = new Date().toISOString(); // Add completion timestamp
            
            // Save to Firestore (keep in database)
            saveTask(task)
                .then(() => {
                    // Update the tasks array with the completed status
                    const index = tasks.findIndex(t => t.id === taskId);
                    if (index !== -1) {
                        tasks[index] = task;
                    }
                    
                    // Task has visually disappeared but is still in the database
                    // Update progress bar which will now include this completed task
                    updateProgressBarForActiveTab();
                    
                    // Show success message
                    const successMsg = document.createElement('div');
                    successMsg.className = 'success-message';
                    successMsg.textContent = `Task "${task.name}" completed`;
                    document.body.appendChild(successMsg);
                    
                    // Remove success message after 3 seconds
                    setTimeout(() => {
                        if (successMsg.parentNode) {
                            successMsg.parentNode.removeChild(successMsg);
                        }
                    }, 3000);
                })
                .catch(error => {
                    console.error('Error updating task status:', error);
                    showError('Error completing task: ' + error.message);
                });
        }
    }, 2000); // Match the CSS animation duration of 2s
}

// New function to schedule midnight cleanup of completed tasks
function scheduleMidnightCleanup() {
    // Calculate time until next midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // Set to midnight (00:00:00)
    
    const timeUntilMidnight = tomorrow - now;
    
    console.log(`Scheduled cleanup of completed tasks in ${Math.round(timeUntilMidnight/1000/60)} minutes`);
    
    // Schedule the cleanup
    setTimeout(() => {
        // Run the cleanup
        cleanupCompletedTasks();
        
        // Schedule the next day's cleanup
        scheduleMidnightCleanup();
    }, timeUntilMidnight);
}

// Function to clean up completed tasks at midnight
function cleanupCompletedTasks() {
    console.log('Running midnight cleanup of completed tasks');
    
    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayFormatted = formatDate(yesterday);
    
    // Find completed tasks from yesterday or earlier
    const tasksToDelete = tasks.filter(task => 
        task.status === 'completed' && 
        (task.date <= yesterdayFormatted || // Task was due yesterday or earlier
         (task.completedAt && new Date(task.completedAt).getDate() < new Date().getDate())) // Or was completed yesterday
    );
    
    if (tasksToDelete.length === 0) {
        console.log('No completed tasks to clean up');
        return;
    }
    
    console.log(`Found ${tasksToDelete.length} completed tasks to delete`);
    
    // Delete each task
    const deletePromises = tasksToDelete.map(task => {
        return deleteTaskFromFirestore(task.id)
            .then(() => {
                console.log(`Deleted completed task: ${task.name}`);
                // Remove from local array
                tasks = tasks.filter(t => t.id !== task.id);
                return task.id;
            })
            .catch(error => {
                console.error(`Error deleting task ${task.id}:`, error);
                return null;
            });
    });
    
    // After all deletions complete
    Promise.all(deletePromises)
        .then(deletedIds => {
            const successfulDeletes = deletedIds.filter(id => id !== null);
            console.log(`Successfully deleted ${successfulDeletes.length} completed tasks during cleanup`);
            
            // Update the UI
            updateTasksUI();
        });
}

// Function to show completed tasks modal
function showCompletedTasksModal() {
    const completedTasksModal = document.getElementById('completedTasksModal');
    const completedTasksList = document.getElementById('completedTasksList');
    const todayFormatted = formatDate(today);
    
    // Clear previous content
    completedTasksList.innerHTML = '';
    
    // Get today's completed tasks
    let todayCompletedTasks = [];
    
    // Check which tab is active to determine which completed tasks to show
    const activeTabId = document.querySelector('.tab.active').getAttribute('data-target');
    if (activeTabId === 'myTasks') {
        // Show current user's completed tasks
        todayCompletedTasks = tasks.filter(task => 
            task.date === todayFormatted && 
            task.status === 'completed' &&
            task.createdBy?.id === currentUser.id
        );
    } else {
        // Show other users' completed tasks
        todayCompletedTasks = tasks.filter(task => 
            task.date === todayFormatted && 
            task.status === 'completed' &&
            task.createdBy?.id !== currentUser.id
        );
    }
    
    // If no completed tasks, show a message
    if (todayCompletedTasks.length === 0) {
        completedTasksList.innerHTML = `
            <div class="no-completed-tasks">
                <i class="fas fa-check-circle"></i>
                <p>No completed tasks for today yet</p>
            </div>
        `;
    } else {
        // Sort completed tasks by completion time (most recent first)
        todayCompletedTasks.sort((a, b) => {
            if (!a.completedAt) return 1;
            if (!b.completedAt) return -1;
            return new Date(b.completedAt) - new Date(a.completedAt);
        });
        
        // Add each completed task to the list
        todayCompletedTasks.forEach(task => {
            const completedTime = task.completedAt ? new Date(task.completedAt) : null;
            const timeString = completedTime ? completedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown';
            
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
            
            // Create task element
            const taskElement = document.createElement('div');
            taskElement.className = 'completed-task-item';
            taskElement.innerHTML = `
                <div class="completed-task-checkbox">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="completed-task-info">
                    <div class="completed-task-name">${task.name}</div>
                    <div class="completed-task-meta">
                        <div class="completed-task-time">
                            <i class="fas fa-clock"></i> ${timeString}
                        </div>
                        <div class="completed-task-priority">
                            <span class="completed-priority-badge ${priorityClass}"></span>
                            ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                        </div>
                        ${task.createdBy?.id !== currentUser.id ? 
                            `<div class="completed-task-user">
                                <i class="fas fa-user"></i> ${task.createdBy?.name || 'Unknown User'}
                            </div>` : ''}
                    </div>
                </div>
            `;
            
            completedTasksList.appendChild(taskElement);
        });
    }
    
    // Show the modal
    completedTasksModal.classList.add('show');
}

// Setup function for completed tasks feature
function setupCompletedTasksFeature() {
    // Add event listener for history button
    const viewCompletedTasksBtn = document.getElementById('viewCompletedTasksBtn');
    if (viewCompletedTasksBtn) {
        viewCompletedTasksBtn.addEventListener('click', showCompletedTasksModal);
    }
    
    // Add event listener for close button
    const closeCompletedTasksModal = document.getElementById('closeCompletedTasksModal');
    if (closeCompletedTasksModal) {
        closeCompletedTasksModal.addEventListener('click', function() {
            document.getElementById('completedTasksModal').classList.remove('show');
        });
    }
}

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

// Update dashboard stats - MODIFIED for contextual progress bar
function updateStats() {
    const todayFormatted = formatDate(today);
    
    // Calculate overall task stats
    const total = tasks.length;
    const completed = tasks.filter(task => task.status === 'completed').length;
    const pending = tasks.filter(task => task.status === 'pending').length;
    
    // Exclude recurring tasks from overdue count
    const overdue = tasks.filter(task => 
        !task.recurring && // Only non-recurring tasks can be overdue
        new Date(task.date) < new Date(todayFormatted) && 
        task.status !== 'completed'
    ).length;
    
    // Update the dashboard stats
    totalTasksEl.textContent = total;
    completedTasksEl.textContent = completed;
    pendingTasksEl.textContent = pending;
    overdueTasksEl.textContent = overdue;
    
    // Calculate progress for the active tab
    updateProgressBarForActiveTab();
}

// Updated progress bar calculation to include completed tasks
function updateProgressBarForActiveTab() {
    const todayFormatted = formatDate(today);
    const activeTabId = document.querySelector('.tab.active').getAttribute('data-target');
    
    let todayTasks = [];
    let todayCompleted = 0;
    
    if (activeTabId === 'myTasks') {
        // For My Tasks tab - all current user's tasks for today (including completed ones)
        todayTasks = tasks.filter(task => 
            task.date === todayFormatted && 
            task.createdBy?.id === currentUser.id
        );
        todayCompleted = todayTasks.filter(task => task.status === 'completed').length;
    } else {
        // For All Tasks tab - all other users' tasks for today (including completed ones)
        todayTasks = tasks.filter(task => 
            task.date === todayFormatted && 
            task.createdBy?.id !== currentUser.id
        );
        todayCompleted = todayTasks.filter(task => task.status === 'completed').length;
    }
    
    // Calculate the progress percentage
    const todayProgress = todayTasks.length > 0 
        ? (todayCompleted / todayTasks.length) * 100 
        : 0;
    
    console.log(`Progress for ${activeTabId}: ${todayCompleted}/${todayTasks.length} = ${todayProgress.toFixed(1)}%`);
    
    // Update the progress bar
    progressBarEl.style.width = `${todayProgress}%`;
}

// Render my tasks - MODIFIED to exclude completed tasks from UI and sort tasks
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
    
    // Filter for current user's tasks AND exclude completed tasks from display
    const myTasks = tasks.filter(task => 
        task.createdBy?.id === currentUser.id && 
        task.status !== 'completed' // Don't show completed tasks in UI
    );
    
    if (myTasks.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="7" style="text-align: center;">You haven't created any tasks yet</td>
        `;
        myTasksTableEl.appendChild(row);
        return;
    }
    
    // Sort tasks before rendering
    const sortedTasks = sortTasks([...myTasks]);
    
    // Today's date for checking overdue tasks
    const todayFormatted = formatDate(today);
    
    sortedTasks.forEach(task => {
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
                    <i class="fas fa-trash action-icon delete-task" data-id="${task.id}"></i>
                </div>
            </td>
        `;
        
        myTasksTableEl.appendChild(row);
    });
    
    // Add event listeners
    addTaskEventListeners();
}

// Render all tasks - MODIFIED to exclude current user's tasks, exclude completed tasks, and sort tasks
function renderAllTasks() {
    allTasksTableEl.innerHTML = '';
    
    // Filter out the current user's tasks AND completed tasks for the "All Tasks" view
    const otherUsersTasks = tasks.filter(task => 
        task.createdBy?.id !== currentUser.id && 
        task.status !== 'completed' // Don't show completed tasks in UI
    );
    
    if (otherUsersTasks.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="7" style="text-align: center;">No other users' tasks found</td>
        `;
        allTasksTableEl.appendChild(row);
        return;
    }
    
    // Sort tasks before rendering
    const sortedTasks = sortTasks([...otherUsersTasks]);
    
    // Today's date for checking overdue tasks
    const todayFormatted = formatDate(today);
    
    // Use the sorted tasks for rendering
    sortedTasks.forEach(task => {
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
        
        // CHANGE: Disable checkbox for tasks that don't belong to current user
        row.innerHTML = `
            <td>
                <input type="checkbox" class="checkbox disabled-checkbox" data-id="${task.id}" ${task.completed ? 'checked' : ''} disabled>
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
                    <i class="fas fa-edit action-icon edit-task disabled-action" data-id="${task.id}"></i>
                    <i class="fas fa-trash action-icon delete-task disabled-action" data-id="${task.id}"></i>
                </div>
            </td>
        `;
        
        allTasksTableEl.appendChild(row);
    });
    
    // Add event listeners
    addTaskEventListeners();
}

// Add event listeners for task actions - MODIFIED to add permission checks
function addTaskEventListeners() {
    // Checkboxes - UPDATED to add permission check
    document.querySelectorAll('.checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const taskId = this.getAttribute('data-id');
            const task = tasks.find(t => t.id === taskId);
            
            if (task) {
                // SECURITY CHECK: Only allow completion if task belongs to current user
                if (task.createdBy?.id !== currentUser.id) {
                    // Reset checkbox state
                    this.checked = !this.checked;
                    
                    // Show error message
                    showError('Permission denied: You can only complete your own tasks');
                    return;
                }
                
                // If checkbox is checked (task is completed)
                if (this.checked) {
                    // Get the task row element (parent of the checkbox)
                    const taskRow = this.closest('tr');
                    
                    // Immediately change the status badge to "Completed"
                    const statusBadge = taskRow.querySelector('.status-badge');
                    if (statusBadge) {
                        statusBadge.className = 'status-badge status-completed';
                        statusBadge.textContent = 'Completed';
                    }
                    
                    // Fade out and handle task completion - without loading spinner
                    fadeOutAndRemoveTask(taskRow, taskId, task, task.recurring === true);
                    
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
    
    // Edit buttons - UPDATED to add permission check
    document.querySelectorAll('.edit-task').forEach(btn => {
        btn.addEventListener('click', function() {
            // Skip if this action is disabled
            if (this.classList.contains('disabled-action')) {
                showError('Permission denied: You can only edit your own tasks');
                return;
            }
            
            const taskId = this.getAttribute('data-id');
            editTask(taskId);
        });
    });
    
    // Delete buttons - UPDATED to add permission check
    document.querySelectorAll('.delete-task').forEach(btn => {
        btn.addEventListener('click', function() {
            // Skip if this action is disabled
            if (this.classList.contains('disabled-action')) {
                showError('Permission denied: You can only delete your own tasks');
                return;
            }
            
            const taskId = this.getAttribute('data-id');
            deleteTask(taskId);
        });
    });
}

// Edit task - Updated for recurring tasks
function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    
    if (task) {
        // Additional permission check
        if (task.createdBy?.id !== currentUser.id) {
            showError('Permission denied: You can only edit your own tasks');
            return;
        }
        
        document.getElementById('taskId').value = task.id;
        document.getElementById('taskName').value = task.name;
        document.getElementById('taskDate').value = task.date;
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskStatus').value = task.status;
        
        // Set recurring checkbox
        const recurringCheckbox = document.getElementById('taskRecurring');
        if (recurringCheckbox) {
            recurringCheckbox.checked = task.recurring === true;
        }
        
        document.getElementById('taskModalTitle').textContent = 'Edit Task';
        taskModal.classList.add('show');
        
        // Focus and scroll to task name field with a slight delay to ensure modal is visible
        setTimeout(() => {
            // Get the task name input element
            const taskNameInput = document.getElementById('taskName');
            
            // Scroll the modal to make the input visible
            taskNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Set focus to trigger keyboard
            taskNameInput.focus();
            
            // Special handling for iOS/mobile
            if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                // Tap the field programmatically to ensure keyboard appears
                taskNameInput.click();
                
                // Force a reflow - sometimes helps with mobile quirks
                void taskNameInput.offsetHeight;
                
                // Some mobile browsers need a slight delay
                setTimeout(() => {
                    taskNameInput.focus();
                    // This trick can help force keyboard on stubborn mobile browsers
                    taskNameInput.blur();
                    taskNameInput.focus();
                }, 100);
            }
        }, 300); // Increased delay for mobile
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
    
    // Additional permission check
    if (taskToDelete.createdBy?.id !== currentUser.id) {
        showError('Permission denied: You can only delete your own tasks');
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
        // Show loading indicator for the delete operation
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

// Setup UI event listeners - MODIFIED to remove filter event listeners
function setupUIEventListeners() {
    // Tab navigation - UPDATED to refresh progress bar on tab switch
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
            
            // Update progress bar for the active tab
            updateProgressBarForActiveTab();
        });
    });
    
    // Add Task button in All Tasks - UPDATED for mobile
    document.getElementById('addTaskBtn').addEventListener('click', function() {
        // Reset form
        document.getElementById('taskForm').reset();
        document.getElementById('taskId').value = '';
        
        document.getElementById('taskDate').value = formatDate(today);
        
        // Update modal title
        document.getElementById('taskModalTitle').textContent = 'Add New Task';
        
        // Show modal
        taskModal.classList.add('show');
        
        // Focus and scroll to task name field with a slight delay to ensure modal is visible
        setTimeout(() => {
            // Get the task name input element
            const taskNameInput = document.getElementById('taskName');
            
            // Scroll the modal to make the input visible
            taskNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Set focus to trigger keyboard
            taskNameInput.focus();
            
            // Special handling for iOS/mobile
            if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                // Tap the field programmatically to ensure keyboard appears
                taskNameInput.click();
                
                // Force a reflow - sometimes helps with mobile quirks
                void taskNameInput.offsetHeight;
                
                // Some mobile browsers need a slight delay
                setTimeout(() => {
                    taskNameInput.focus();
                    // This trick can help force keyboard on stubborn mobile browsers
                    taskNameInput.blur();
                    taskNameInput.focus();
                }, 100);
            }
        }, 300); // Increased delay for mobile
    });
    
    // Add Task button in My Tasks - UPDATED for mobile
    document.getElementById('addMyTaskBtn').addEventListener('click', function() {
        // Reset form
        document.getElementById('taskForm').reset();
        document.getElementById('taskId').value = '';
        
        document.getElementById('taskDate').value = formatDate(today);
        
        // Update modal title
        document.getElementById('taskModalTitle').textContent = 'Add New Task';
        
        // Show modal
        taskModal.classList.add('show');
        
        // Focus and scroll to task name field with a slight delay to ensure modal is visible
        setTimeout(() => {
            // Get the task name input element
            const taskNameInput = document.getElementById('taskName');
            
            // Scroll the modal to make the input visible
            taskNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Set focus to trigger keyboard
            taskNameInput.focus();
            
            // Special handling for iOS/mobile
            if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                // Tap the field programmatically to ensure keyboard appears
                taskNameInput.click();
                
                // Force a reflow - sometimes helps with mobile quirks
                void taskNameInput.offsetHeight;
                
                // Some mobile browsers need a slight delay
                setTimeout(() => {
                    taskNameInput.focus();
                    // This trick can help force keyboard on stubborn mobile browsers
                    taskNameInput.blur();
                    taskNameInput.focus();
                }, 100);
            }
        }, 300); // Increased delay for mobile
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
                // Permission check for editing
                if (task.createdBy?.id !== currentUser.id) {
                    showError('Permission denied: You can only edit your own tasks');
                    return;
                }
                
                // Store original name for duplicate check logic
                const originalName = task.name;
                
                // Update task properties
                task.name = taskName;
                task.date = taskDate;
                task.priority = taskPriority;
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

    // Allow Enter key to save task instead of refreshing the page
    const taskForm = document.getElementById('taskForm');
    if (taskForm) {
        // Prevent default form submission
        taskForm.addEventListener('submit', function(event) {
            event.preventDefault();
            return false;
        });
        
        // Add keydown listener to the form
        taskForm.addEventListener('keydown', function(event) {
            // Check if Enter key was pressed (key code 13)
            if (event.key === 'Enter' || event.keyCode === 13) {
                // Prevent the default action (form submission/page refresh)
                event.preventDefault();
                
                // Trigger the save task button click
                document.getElementById('saveTaskBtn').click();
                
                // Return false to ensure no other action is taken
                return false;
            }
        });
    }
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
    
    // Schedule the midnight cleanup
    scheduleMidnightCleanup();
    
    // Setup completed tasks feature
    setupCompletedTasksFeature();
}