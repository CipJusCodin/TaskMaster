// Global variables for task management
let tasks = [];
let lastSyncTime = null;

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

// Save task to Firestore
function saveTask(task) {
    updateSyncStatus('syncing');
    
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

// Delete task from Firestore
function deleteTaskFromFirestore(taskId) {
    updateSyncStatus('syncing');
    
    // Add additional logs to track the deletion process
    console.log(`Starting deletion process for task ID: ${taskId}`);
    
    return db.collection('tasks').doc(taskId)
        .delete()
        .then(() => {
            console.log(`Firestore deletion successful for task ID: ${taskId}`);
            updateSyncStatus('synced');
            return { success: true, taskId };
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

// Create next occurrence of a recurring task
function createNextOccurrence(completedTask) {
    if (!completedTask.recurring) {
        console.log('Task is not recurring, no next occurrence needed');
        return Promise.resolve(null);
    }
    
    console.log(`Creating next occurrence for recurring task: ${completedTask.name}`);
    
    // Create tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowFormatted = formatDate(tomorrow);
    
    // Create a new task for tomorrow
    const newTask = {
        id: generateId(),
        name: completedTask.name,
        date: tomorrowFormatted,
        notes: completedTask.notes,
        priority: completedTask.priority,
        status: 'pending',
        completed: false,
        recurring: true, // Mark as recurring
        parentTaskId: completedTask.id, // Reference to original task
        recurrenceCount: (completedTask.recurrenceCount || 0) + 1, // Track number of recurrences
        createdAt: new Date().toISOString(),
        createdBy: completedTask.createdBy, // Same creator
        lastUpdated: new Date().toISOString(),
        lastUpdatedBy: currentUser
    };
    
    console.log(`Next occurrence created with ID: ${newTask.id} for date: ${newTask.date}`);
    
    // Save the new task to Firestore
    return saveTask(newTask)
        .then(() => {
            // Show a special message for recurring tasks
            const successMsg = document.createElement('div');
            successMsg.className = 'success-message';
            successMsg.innerHTML = `<i class="fas fa-sync-alt"></i> Task "${completedTask.name}" completed for today and scheduled for tomorrow`;
            document.body.appendChild(successMsg);
            
            // Remove success message after 3 seconds
            setTimeout(() => {
                if (successMsg.parentNode) {
                    successMsg.parentNode.removeChild(successMsg);
                }
            }, 3000);
            
            return newTask;
        });
}