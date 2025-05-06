// Enhanced task deletion functionality
// This is a drop-in replacement for your delete.js file with improved functionality

(function() {
    // Global set to track deleted task IDs to prevent them from being re-added
    window.deletedTaskIds = new Set();
    
    // Add necessary CSS for the delete button (keep existing styling)
    function addStyles() {
        if (!document.querySelector('style#delete-completed-styles')) {
            const style = document.createElement('style');
            style.id = 'delete-completed-styles';
            style.textContent = `
                .btn-danger {
                    background-color: var(--danger-color, #e74c3c);
                    color: white;
                }
                
                .btn-danger:hover {
                    background-color: #c0392b;
                }
                
                #deleteCompletedBtn {
                    margin-left: 0.5rem;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Helper function to delete any files associated with a task
    async function deleteTaskStorage(taskData) {
        // Skip if no Firebase Storage initialized or no attachments
        if (!firebase.storage || !taskData || !taskData.attachments) {
            return Promise.resolve();
        }
        
        const storage = firebase.storage();
        
        // If task has attachments, delete each one from storage
        if (Array.isArray(taskData.attachments) && taskData.attachments.length > 0) {
            const deletePromises = taskData.attachments.map(attachment => {
                // Get a reference to the file
                const fileRef = storage.ref().child(`tasks/${taskData.id}/${attachment.filename}`);
                console.log(`Deleting file: ${attachment.filename} from storage`);
                
                // Delete the file
                return fileRef.delete()
                    .catch(error => {
                        // Log error but don't fail the whole operation
                        console.error(`Error deleting file ${attachment.filename}:`, error);
                    });
            });
            
            return Promise.all(deletePromises);
        }
        
        // If task has a folder in storage, delete the entire folder
        const folderRef = storage.ref().child(`tasks/${taskData.id}`);
        
        // Check if folder exists by listing its contents
        return folderRef.listAll()
            .then(result => {
                // Delete all items in the folder
                const deletePromises = [];
                
                result.items.forEach(itemRef => {
                    console.log(`Deleting file: ${itemRef.name} from storage`);
                    deletePromises.push(itemRef.delete());
                });
                
                return Promise.all(deletePromises);
            })
            .catch(error => {
                // Ignore errors, likely means folder doesn't exist
                console.log(`No storage folder found for task ${taskData.id} or error:`, error);
                return Promise.resolve();
            });
    }
    
    // Enhanced function to delete a task from Firestore completely
    window.deleteTaskPermanently = function(taskId) {
        return new Promise((resolve, reject) => {
            // First, get the task to keep a record of its name for logging
            db.collection('tasks').doc(taskId).get()
                .then(docSnapshot => {
                    if (!docSnapshot.exists) {
                        console.log(`Task ${taskId} already deleted, no need to delete again`);
                        window.deletedTaskIds.add(taskId); // Add to deleted set anyway
                        return resolve({ taskId, alreadyDeleted: true });
                    }
                    
                    const taskData = docSnapshot.data();
                    const taskName = taskData.name || 'Unknown Task';
                    
                    console.log(`Starting permanent deletion for task "${taskName}" (ID: ${taskId})`);
                    
                    // Then delete any associated storage files
                    return deleteTaskStorage(Object.assign({ id: taskId }, taskData))
                        .then(() => {
                            // Now delete the document with transaction to ensure it's gone
                            console.log(`Storage cleaned, now deleting Firestore document for "${taskName}"`);
                            
                            // Use a transaction to ensure atomic deletion
                            return db.runTransaction(transaction => {
                                // Get the document reference
                                const docRef = db.collection('tasks').doc(taskId);
                                
                                // In the transaction, delete the document
                                transaction.delete(docRef);
                                
                                return Promise.resolve();
                            });
                        })
                        .then(() => {
                            // Double-check deletion was successful
                            return db.collection('tasks').doc(taskId).get();
                        })
                        .then(verifyDoc => {
                            if (verifyDoc.exists) {
                                console.error(`Failed to delete task "${taskName}" (${taskId}). Document still exists!`);
                                return reject(new Error(`Failed to delete task "${taskName}"`));
                            }
                            
                            console.log(`Successfully verified deletion of task "${taskName}" (${taskId})`);
                            
                            // Add to our tracking set to prevent re-adding via listeners
                            window.deletedTaskIds.add(taskId);
                            
                            // Remove from local tasks array if it exists
                            if (window.tasks && Array.isArray(window.tasks)) {
                                window.tasks = window.tasks.filter(task => task.id !== taskId);
                            }
                            
                            // Return success
                            resolve({ taskId, name: taskName, success: true });
                        });
                })
                .catch(error => {
                    console.error(`Error in deleteTaskPermanently for task ${taskId}:`, error);
                    reject(error);
                });
        });
    };
    
    // Main function to delete all completed tasks
    function deleteAllCompletedTasks() {
        // Confirm before proceeding
        const confirmDelete = confirm('Are you sure you want to DELETE ALL completed tasks for ALL users? This action cannot be undone.');
        
        if (!confirmDelete) {
            return; // User cancelled
        }
        
        // Safety check: Ensure Firebase and db are initialized
        if (typeof db === 'undefined') {
            console.error('Error: Firestore database not initialized');
            alert('Error: Could not connect to the database. Please refresh the page and try again.');
            return;
        }
        
        // Show loading indicator
        showLoading();
        updateSyncStatus('syncing');
        
        // IMPORTANT: Temporarily disable the real-time listener to prevent re-adding
        let listenerWasActive = false;
        if (window.tasksUnsubscribe && typeof window.tasksUnsubscribe === 'function') {
            console.log('Temporarily disabling real-time listener during batch deletion');
            window.tasksUnsubscribe();
            listenerWasActive = true;
        }
        
        // Query Firestore for all completed tasks
        db.collection('tasks')
            .where('status', '==', 'completed')
            .get()
            .then(snapshot => {
                if (snapshot.empty) {
                    hideLoading();
                    updateSyncStatus('synced');
                    alert('No completed tasks to delete.');
                    
                    // Re-enable listener if it was active
                    if (listenerWasActive) {
                        console.log('Re-enabling real-time listener after finding no tasks');
                        setupTasksListener();
                    }
                    return;
                }
                
                // Count how many tasks will be deleted
                const tasksToDelete = snapshot.docs.length;
                const taskIds = snapshot.docs.map(doc => doc.id);
                
                console.log(`Found ${tasksToDelete} completed tasks to delete permanently:`, taskIds);
                
                // Use our enhanced deletion function for each task
                const deletePromises = taskIds.map(taskId => window.deleteTaskPermanently(taskId));
                
                // Execute all deletes and wait for completion
                Promise.all(deletePromises)
                    .then(results => {
                        console.log(`Successfully processed ${results.length} tasks:`, results);
                        
                        // Update UI
                        updateTasksUI();
                        
                        // Hide loading and update sync status
                        hideLoading();
                        updateSyncStatus('synced');
                        
                        // Show success message
                        const successMsg = document.createElement('div');
                        successMsg.className = 'success-message';
                        successMsg.textContent = `Successfully deleted ${tasksToDelete} completed tasks`;
                        document.body.appendChild(successMsg);
                        
                        // Remove success message after 3 seconds
                        setTimeout(() => {
                            if (successMsg.parentNode) {
                                successMsg.parentNode.removeChild(successMsg);
                            }
                        }, 3000);
                        
                        // Re-enable listener if it was active, but with our deleted tasks exclusion
                        if (listenerWasActive) {
                            console.log('Re-enabling real-time listener with deleted task tracking');
                            setupTasksListener();
                        }
                    })
                    .catch(error => {
                        console.error('Error during task deletion:', error);
                        hideLoading();
                        updateSyncStatus('error');
                        showError('Error deleting tasks: ' + error.message);
                        
                        // Re-enable listener if it was active
                        if (listenerWasActive) {
                            console.log('Re-enabling real-time listener after error');
                            setupTasksListener();
                        }
                    });
            })
            .catch(error => {
                console.error('Error querying completed tasks:', error);
                hideLoading();
                updateSyncStatus('error');
                showError('Error finding completed tasks: ' + error.message);
                
                // Re-enable listener if it was active
                if (listenerWasActive) {
                    console.log('Re-enabling real-time listener after query error');
                    setupTasksListener();
                }
            });
    }
    
    // Patch the original setupTasksListener function to handle deleted tasks
    function patchTasksListener() {
        // Store the original function
        const originalSetupTasksListener = window.setupTasksListener;
        
        // Replace with our enhanced version
        window.setupTasksListener = function() {
            console.log('Setting up enhanced tasks listener with deletion tracking');
            
            const unsubscribe = db.collection('tasks')
                .onSnapshot(snapshot => {
                    let hasChanges = false;
                    
                    // Handle document changes
                    snapshot.docChanges().forEach(change => {
                        const taskId = change.doc.id;
                        console.log(`Document change detected: ${change.type} for task ID: ${taskId}`);
                        
                        // CRITICAL FIX: Skip processing if this task was deleted by our code
                        // This is the key fix to prevent deleted tasks from reappearing
                        if (window.deletedTaskIds && window.deletedTaskIds.has(taskId)) {
                            console.log(`Ignoring ${change.type} event for task ${taskId} as it was manually deleted`);
                            return;
                        }
                        
                        if (change.type === 'added') {
                            const newTask = {
                                id: taskId,
                                ...change.doc.data()
                            };
                            
                            // Only add if not already in the array and not in deleted set
                            if (!tasks.some(task => task.id === newTask.id) && 
                                !(window.deletedTaskIds && window.deletedTaskIds.has(taskId))) {
                                console.log(`Adding new task to local array: ${newTask.name}`);
                                tasks.push(newTask);
                                hasChanges = true;
                            }
                        }
                        
                        if (change.type === 'modified') {
                            const updatedTask = {
                                id: taskId,
                                ...change.doc.data()
                            };
                            
                            // Update the task in the array only if it's not in deleted set
                            if (!(window.deletedTaskIds && window.deletedTaskIds.has(taskId))) {
                                const index = tasks.findIndex(task => task.id === updatedTask.id);
                                if (index !== -1) {
                                    console.log(`Updating task in local array: ${updatedTask.name}`);
                                    tasks[index] = updatedTask;
                                    hasChanges = true;
                                }
                            }
                        }
                        
                        if (change.type === 'removed') {
                            // Check if the task exists in our array
                            const index = tasks.findIndex(task => task.id === taskId);
                            if (index !== -1) {
                                const taskName = tasks[index].name;
                                console.log(`Removing task from local array: ${taskName} (ID: ${taskId})`);
                                
                                // Remove the task from the array
                                tasks = tasks.filter(task => task.id !== taskId);
                                hasChanges = true;
                                
                                // Add to our deleted set to prevent re-adding
                                if (window.deletedTaskIds) {
                                    window.deletedTaskIds.add(taskId);
                                }
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
        };
        
        console.log('Tasks listener patched to handle deleted tasks properly');
    }
    
    // Replace the original deleteTask function with our enhanced version
    function patchDeleteTask() {
        // Store the original function
        const originalDeleteTask = window.deleteTask;
        
        // Replace with our enhanced version
        window.deleteTask = function(taskId) {
            // Find the task for logging purposes
            const taskToDelete = tasks.find(t => t.id === taskId);
            const taskName = taskToDelete ? taskToDelete.name : 'Unknown task';
            
            // Create a single reference to the delete confirmation action
            const confirmDelete = confirm('Are you sure you want to delete this task?');
            
            if (confirmDelete) {
                // Show loading indicator immediately
                showLoading();
                console.log(`Confirmed deletion for task: ${taskName} (ID: ${taskId})`);
                
                // Use our enhanced permanent deletion function
                window.deleteTaskPermanently(taskId)
                    .then(result => {
                        console.log(`Task successfully deleted permanently: ${result.name || taskName}`);
                        
                        // Update UI to reflect the change
                        updateTasksUI();
                        
                        // Hide loading indicator
                        hideLoading();
                        
                        // Show success message
                        const successMsg = document.createElement('div');
                        successMsg.className = 'success-message';
                        successMsg.textContent = `Task "${result.name || taskName}" deleted successfully`;
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
        };
        
        console.log('Individual deleteTask function patched for permanent deletion');
    }
    
    // Attempt to optimize Firebase cache and free up memory
    function optimizeFirebaseUsage() {
        // If Firebase SDK provides any cleanup methods, use them
        if (firebase && firebase.firestore) {
            // Enable aggressive garbage collection on the Firestore cache
            console.log('Optimizing Firebase to prevent cached data reappearing');
            
            // Use more aggressive cache settings
            firebase.firestore().settings({
                cacheSizeBytes: 1048576, // 1 MB cache only
                ignoreUndefinedProperties: true
            });
            
            // Disable offline persistence completely if possible to prevent caching issues
            if (typeof firebase.firestore().enableNetwork === 'function') {
                firebase.firestore().enableNetwork()
                    .then(() => {
                        console.log('Ensuring Firebase is using network connection, not cache');
                    })
                    .catch(err => console.error('Error configuring Firebase network:', err));
            }
        }
    }
    
    // Add the delete button to the UI only for the authorized admin user
    function addDeleteButton() {
        // Check if current user is the authorized admin
        if (!currentUser || currentUser.email !== 'yath@taskmaster.com') {
            // Not the admin user, don't add the button
            console.log('Delete button not added - user is not authorized admin');
            return;
        }
        
        console.log('Admin user detected, adding bulk delete button');
        
        // Make sure styles are added
        addStyles();
        
        // Find the action buttons container in the All Tasks panel
        const actionButtonsContainer = document.querySelector('#allTasks .action-buttons');
        
        // Only add the button if the container exists and the button doesn't already exist
        if (actionButtonsContainer && !document.getElementById('deleteCompletedBtn')) {
            // Create the delete button
            const deleteButton = document.createElement('button');
            deleteButton.id = 'deleteCompletedBtn';
            deleteButton.className = 'btn btn-danger';
            deleteButton.innerHTML = '<i class="fas fa-trash"></i> Delete All Completed';
            deleteButton.title = 'Admin Only: Delete all completed tasks for all users and free up Firebase storage';
            deleteButton.addEventListener('click', deleteAllCompletedTasks);
            
            // Add the button to the container
            actionButtonsContainer.appendChild(deleteButton);
            
            console.log('Admin delete button added successfully');
        }
    }
    
    // Function to check and apply delete button when user state changes
    function checkUserAndUpdateUI() {
        // Try to add the button, the function will check for admin status internally
        addDeleteButton();
    }
    
    // Initialize the functionality when the DOM is loaded
    function initialize() {
        console.log('Initializing enhanced delete functionality');
        
        // Create the global deletedTaskIds set if it doesn't exist
        if (!window.deletedTaskIds) {
            window.deletedTaskIds = new Set();
        }
        
        // Patch the tasks listener first
        if (typeof window.setupTasksListener === 'function') {
            patchTasksListener();
        } else {
            console.warn('Could not patch tasks listener - function not found yet');
            // Wait for the function to be defined
            const checkForFunctions = setInterval(() => {
                if (typeof window.setupTasksListener === 'function') {
                    patchTasksListener();
                    clearInterval(checkForFunctions);
                }
            }, 200);
        }
        
        // Patch the individual delete task function
        if (typeof window.deleteTask === 'function') {
            patchDeleteTask();
        } else {
            console.warn('Could not patch deleteTask function - function not found yet');
            // Wait for the function to be defined
            const checkForDeleteTask = setInterval(() => {
                if (typeof window.deleteTask === 'function') {
                    patchDeleteTask();
                    clearInterval(checkForDeleteTask);
                }
            }, 200);
        }
        
        // Apply optimizations to Firebase
        optimizeFirebaseUsage();
        
        // If the page is already interactive or complete
        if (document.readyState === 'interactive' || document.readyState === 'complete') {
            // Wait a bit to ensure other scripts have initialized
            setTimeout(() => {
                checkUserAndUpdateUI();
            }, 500);
        } else {
            // Otherwise, wait for the DOM to be fully loaded
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(() => {
                    checkUserAndUpdateUI();
                }, 500);
            });
        }
        
        // Add a listener for auth state changes to update button visibility
        if (typeof auth !== 'undefined' && auth.onAuthStateChanged) {
            auth.onAuthStateChanged(user => {
                if (user) {
                    // Wait a moment for the currentUser to be updated in the main app
                    setTimeout(checkUserAndUpdateUI, 300);
                } else {
                    // Remove button if it exists when user logs out
                    const existingButton = document.getElementById('deleteCompletedBtn');
                    if (existingButton && existingButton.parentNode) {
                        existingButton.parentNode.removeChild(existingButton);
                    }
                }
            });
        }
    }
    
    // Start the initialization
    initialize();
})();