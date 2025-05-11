// Global variables for task management
let tasks = [];
let lastSyncTime = null;

// Store IDs of deleted recurring tasks to prevent recreation
let deletedRecurringTaskIds = new Set();

// Load tasks from Firestore
function loadTasks() {
    showLoading();
    updateSyncStatus('syncing');
    
    return db.collection('tasks')
        .get()
        .then(snapshot => {
            tasks = [];
            snapshot.forEach(doc => {
                tasks.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Initialize the set of deleted recurring tasks
            initializeDeletedRecurringTasks();
            
            // After loading tasks, check for any pending recurring tasks that need to be created
            checkPendingRecurringTasks();
            
            updateTasksUI();
            updateLastSyncTime();
            updateSyncStatus('synced');
            hideLoading();
            
            // Set up real-time listener
            setupTasksListener();
            
            return tasks;
        })
        .catch(error => {
            updateSyncStatus('error');
            showError('Error loading tasks: ' + error.message);
            hideLoading();
            throw error;
        });
}

// Initialize the deletedRecurringTaskIds from localStorage
function initializeDeletedRecurringTasks() {
    try {
        const savedDeleted = JSON.parse(localStorage.getItem('deletedRecurringTaskIds') || '[]');
        deletedRecurringTaskIds = new Set(savedDeleted);
        console.log(`Loaded ${deletedRecurringTaskIds.size} deleted recurring task IDs from localStorage`);
    } catch (e) {
        console.warn('Could not load deleted tasks from localStorage:', e);
        deletedRecurringTaskIds = new Set();
    }
}

// Set up real-time listener for tasks
function setupTasksListener() {
    const unsubscribe = db.collection('tasks')
        .onSnapshot(snapshot => {
            let hasChanges = false;
            
            // Handle document changes
            snapshot.docChanges().forEach(change => {
                console.log(`Document change detected: ${change.type} for task ID: ${change.doc.id}`);
                
                if (change.type === 'added') {
                    const newTask = {
                        id: change.doc.id,
                        ...change.doc.data()
                    };
                    
                    // Skip if this is a recurring task that was deleted
                    if (newTask.recurring && deletedRecurringTaskIds.has(newTask.id)) {
                        console.log(`Skipping addition of deleted recurring task: ${newTask.id}`);
                        return;
                    }
                    
                    // Only add if not already in the array
                    if (!tasks.some(task => task.id === newTask.id)) {
                        console.log(`Adding new task to local array: ${newTask.name}`);
                        tasks.push(newTask);
                        hasChanges = true;
                    }
                }
                
                if (change.type === 'modified') {
                    const updatedTask = {
                        id: change.doc.id,
                        ...change.doc.data()
                    };
                    
                    // Skip if this is a recurring task that was deleted
                    if (updatedTask.recurring && deletedRecurringTaskIds.has(updatedTask.id)) {
                        console.log(`Skipping update of deleted recurring task: ${updatedTask.id}`);
                        return;
                    }
                    
                    // Update the task in the array
                    const index = tasks.findIndex(task => task.id === updatedTask.id);
                    if (index !== -1) {
                        console.log(`Updating task in local array: ${updatedTask.name}`);
                        tasks[index] = updatedTask;
                        hasChanges = true;
                    }
                }
                
                if (change.type === 'removed') {
                    // Check if the task exists in our array
                    const index = tasks.findIndex(task => task.id === change.doc.id);
                    if (index !== -1) {
                        const taskName = tasks[index].name;
                        console.log(`Removing task from local array: ${taskName} (ID: ${change.doc.id})`);
                        
                        // Remove the task from the array
                        tasks = tasks.filter(task => task.id !== change.doc.id);
                        hasChanges = true;
                    }
                }
            });
            
            // Only update UI if there were actual changes
            if (hasChanges) {
                console.log('Changes detected, updating UI');
                updateTasksUI();
                updateLastSyncTime();
                updateSyncStatus('synced');
            }
        }, error => {
            console.error('Error listening to tasks:', error);
            updateSyncStatus('error');
            showError('Error syncing tasks: ' + error.message);
        });
    
    // Store the unsubscribe function for cleanup
    window.tasksUnsubscribe = unsubscribe;
    
    // Add cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (window.tasksUnsubscribe) {
            window.tasksUnsubscribe();
        }
    });
    
    return unsubscribe;
}

// Check if a task is a duplicate (same name, same user, not completed)
function isDuplicateTask(taskToCheck) {
    // Check only against non-completed existing tasks
    return tasks.some(existingTask => {
        // Skip completed tasks in duplicate check
        if (existingTask.status === 'completed') {
            return false;
        }
        
        // Compare task name (case-insensitive)
        const sameTaskName = existingTask.name.toLowerCase() === taskToCheck.name.toLowerCase();
        
        // Compare user who created the task
        const sameUser = existingTask.createdBy && taskToCheck.createdBy && 
                        existingTask.createdBy.id === taskToCheck.createdBy.id;
        
        // If it's the same task being edited, it's not a duplicate
        const isEditingSameTask = existingTask.id === taskToCheck.id;
        
        return sameTaskName && sameUser && !isEditingSameTask;
    });
}

// Save task to Firestore
function saveTask(task) {
    updateSyncStatus('syncing');
    
    // Check if this is a recurring task that was deleted
    if (task.recurring && deletedRecurringTaskIds.has(task.id)) {
        console.log(`Skipping save of deleted recurring task: ${task.id}`);
        return Promise.resolve(task);
    }
    
    // Check for duplicates (only for new tasks or when name is changed)
    if (isDuplicateTask(task)) {
        console.log(`Duplicate task detected: ${task.name}`);
        updateSyncStatus('error');
        showError(`Duplicate task: "${task.name}" already exists. Please use a different name.`);
        return Promise.reject(new Error('Duplicate task'));
    }
    
    return db.collection('tasks').doc(task.id)
        .set(task)
        .then(() => {
            updateSyncStatus('synced');
            return task;
        })
        .catch(error => {
            updateSyncStatus('error');
            showError('Error saving task: ' + error.message);
            throw error;
        });
}

// Delete task from Firestore with enhanced logic for recurring tasks
function deleteTaskFromFirestore(taskId) {
    updateSyncStatus('syncing');
    
    console.log(`Starting deletion process for task ID: ${taskId}`);
    
    // First, get the task to check if it's recurring
    return db.collection('tasks').doc(taskId).get()
        .then(doc => {
            if (!doc.exists) {
                console.log(`Task ${taskId} not found in Firestore, it may have been deleted already`);
                return { success: true, taskId, notFound: true };
            }
            
            const taskData = doc.data();
            const isRecurring = taskData.recurring === true;
            const hasNextOccurrence = taskData.nextOccurrenceDate != null;
            const parentTaskId = taskData.parentTaskId;
            const taskName = taskData.name;
            
            console.log(`Task found: "${taskName}". Is recurring: ${isRecurring}, has next occurrence: ${hasNextOccurrence}`);
            
            // Add to our set of deleted recurring tasks to prevent recreation
            if (isRecurring) {
                console.log(`Adding task "${taskName}" to deletedRecurringTaskIds set`);
                deletedRecurringTaskIds.add(taskId);
                
                // If this task has a parent task ID, also prevent that from recreating
                if (parentTaskId) {
                    console.log(`Also adding parent task ID ${parentTaskId} to prevent recreation`);
                    deletedRecurringTaskIds.add(parentTaskId);
                }
                
                // Store in localStorage for persistence across sessions
                try {
                    const existingDeleted = JSON.parse(localStorage.getItem('deletedRecurringTaskIds') || '[]');
                    existingDeleted.push(taskId);
                    if (parentTaskId) existingDeleted.push(parentTaskId);
                    localStorage.setItem('deletedRecurringTaskIds', JSON.stringify([...new Set(existingDeleted)]));
                } catch (e) {
                    console.warn('Could not save to localStorage:', e);
                }
            }
            
            // Delete the task from Firestore
            return db.collection('tasks').doc(taskId).delete()
                .then(() => {
                    console.log(`Firestore deletion successful for task ID: ${taskId}`);
                    updateSyncStatus('synced');
                    return { 
                        success: true, 
                        taskId, 
                        isRecurring, 
                        hasNextOccurrence,
                        taskName
                    };
                });
        })
        .catch(error => {
            console.error(`Firestore deletion failed for task ID: ${taskId}`, error);
            updateSyncStatus('error');
            showError('Error deleting task: ' + error.message);
            throw error;
        });
}

// Create sample tasks if none exist
function createSampleTasks() {
    const todayFormatted = formatDate(new Date());
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayFormatted = formatDate(yesterday);
    
    const sampleTasks = [
        {
            id: generateId(),
            name: "Complete TaskMaster setup",
            date: todayFormatted,
            notes: "Set up shared task list with my friend",
            priority: "high",
            status: "completed",
            completed: true,
            createdAt: new Date().toISOString(),
            createdBy: currentUser,
            lastUpdated: new Date().toISOString(),
            lastUpdatedBy: currentUser
        },
        {
            id: generateId(),
            name: "Finish planning tasks",
            date: todayFormatted,
            notes: "Decide which tasks to add to our shared list",
            priority: "high",
            status: "pending",
            completed: false,
            createdAt: new Date().toISOString(),
            createdBy: currentUser,
            lastUpdated: new Date().toISOString(),
            lastUpdatedBy: currentUser
        },
        {
            id: generateId(),
            name: "Invite friend to task list",
            date: todayFormatted,
            notes: "Share the link with my friend",
            priority: "medium",
            status: "pending",
            completed: false,
            createdAt: new Date().toISOString(),
            createdBy: currentUser,
            lastUpdated: new Date().toISOString(),
            lastUpdatedBy: currentUser
        },
        {
            id: generateId(),
            name: "Review task list design",
            date: yesterdayFormatted,
            notes: "Check if the task list design works for our needs",
            priority: "low",
            status: "completed",
            completed: true,
            createdAt: new Date().toISOString(),
            createdBy: currentUser,
            lastUpdated: new Date().toISOString(),
            lastUpdatedBy: currentUser
        }
    ];
    
    // Add each sample task to Firestore
    const promises = sampleTasks.map(task => saveTask(task));
    
    return Promise.all(promises);
}

// Generate a unique ID
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Format date to YYYY-MM-DD for input fields
function formatDate(date) {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();
    
    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    
    return [year, month, day].join('-');
}

// Update last sync time
function updateLastSyncTime() {
    lastSyncTime = new Date();
    lastSyncTimeEl.textContent = `Last synced: ${lastSyncTime.toLocaleTimeString()}`;
}

// Mark a recurring task for next day creation
function markRecurringTaskForNextDay(completedTask) {
    if (!completedTask.recurring) {
        console.log('Task is not recurring, no next occurrence needed');
        return Promise.resolve(null);
    }
    
    // Check if this task or its parent is in the deleted list
    if (deletedRecurringTaskIds.has(completedTask.id) || 
        (completedTask.parentTaskId && deletedRecurringTaskIds.has(completedTask.parentTaskId))) {
        console.log(`Skipping next occurrence for deleted recurring task: ${completedTask.id}`);
        return Promise.resolve(null);
    }
    
    console.log(`Marking recurring task for next day creation: ${completedTask.name}`);
    
    // Create tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowFormatted = formatDate(tomorrow);
    
    // Update the task with nextOccurrenceDate
    completedTask.nextOccurrenceDate = tomorrowFormatted;
    completedTask.recurrenceCount = (completedTask.recurrenceCount || 0) + 1;
    
    // Save the updated task to Firestore
    return saveTask(completedTask)
        .then(() => {
            // Show a special message for recurring tasks
            const successMsg = document.createElement('div');
            successMsg.className = 'success-message';
            successMsg.innerHTML = `<i class="fas fa-sync-alt"></i> Task "${completedTask.name}" completed for today, will reappear tomorrow`;
            document.body.appendChild(successMsg);
            
            // Remove success message after 3 seconds
            setTimeout(() => {
                if (successMsg.parentNode) {
                    successMsg.parentNode.removeChild(successMsg);
                }
            }, 3000);
            
            return completedTask;
        });
}

// Check if any recurring tasks need to be created for today
function checkPendingRecurringTasks() {
    const today = new Date();
    const todayFormatted = formatDate(today);
    
    console.log(`Checking for recurring tasks to create for ${todayFormatted}`);
    
    // Find all completed recurring tasks that have a nextOccurrenceDate on or before today
    const recurringTasksToCreate = tasks.filter(task => 
        task.recurring === true && 
        task.status === 'completed' && 
        task.nextOccurrenceDate && 
        task.nextOccurrenceDate <= todayFormatted &&
        !deletedRecurringTaskIds.has(task.id) && // Skip if task is in deleted set
        (!task.parentTaskId || !deletedRecurringTaskIds.has(task.parentTaskId)) // Skip if parent is in deleted set
    );
    
    if (recurringTasksToCreate.length === 0) {
        console.log('No recurring tasks need to be created today');
        return Promise.resolve();
    }
    
    console.log(`Found ${recurringTasksToCreate.length} recurring tasks to create for today`);
    
    // Create a new task for each recurring task
    const createPromises = recurringTasksToCreate.map(task => {
        // Create a new task for today
        const newTask = {
            id: generateId(),
            name: task.name,
            date: todayFormatted,
            notes: task.notes,
            priority: task.priority,
            status: 'pending',
            completed: false,
            recurring: true,
            parentTaskId: task.id,
            createdAt: new Date().toISOString(),
            createdBy: task.createdBy,
            lastUpdated: new Date().toISOString(),
            lastUpdatedBy: currentUser
        };
        
        // Clear the nextOccurrenceDate from the original task
        task.nextOccurrenceDate = null;
        
        // Save both the new task and the updated original task
        return Promise.all([
            saveTask(newTask),
            saveTask(task)
        ]);
    });
    
    return Promise.all(createPromises)
        .then(() => {
            console.log('Successfully created all pending recurring tasks for today');
            // No need to update UI here as the listener will handle it
        })
        .catch(error => {
            console.error('Error creating recurring tasks:', error);
            showError('Error creating recurring tasks: ' + error.message);
        });
}