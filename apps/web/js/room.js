import { storiesAPI, utils, authAPI } from './api.js';

(async function() {
    const urlParams = new URLSearchParams(window.location.search);
    let roomId = urlParams.get('room_id') || utils.getRoomId();
    const viewerHash = utils.getViewerHash();

    // Log for debugging
    console.log('Room page loaded');
    console.log('URL params:', Object.fromEntries(urlParams));
    console.log('Room ID from URL:', urlParams.get('room_id'));
    console.log('Room ID from storage:', utils.getRoomId());
    console.log('Final Room ID:', roomId);
    console.log('Viewer Hash:', viewerHash);

    if (!roomId) {
        console.error('No room ID found, redirecting to landing');
        window.location.href = 'index.html';
        return;
    }

    let currentStories = [];
    let currentIndex = -1; // -1 means no story is currently displayed
    let allowUploads = false;
    let isOwner = false;
    let isLoadingStories = false; // Prevent concurrent loads

    // Check if user is owner
    const authToken = utils.getAuthToken();
    const logoutButton = document.getElementById('logoutButton');
    const userEmail = document.getElementById('userEmail');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            utils.clearSession();
            window.location.href = 'index.html';
        });
    }

    if (authToken) {
        try {
            const userInfo = await authAPI.getMe();
            if (userEmail) {
                userEmail.textContent = userInfo.email || '';
                userEmail.title = userInfo.email || '';
                userEmail.classList.remove('hidden');
            }
            if (userInfo.email && utils.setAuthEmail) {
                utils.setAuthEmail(userInfo.email);
            }
            if (logoutButton) {
                logoutButton.classList.remove('hidden');
            }
            // We'll check ownership when loading room details
            isOwner = true; // Assume owner if authenticated, will verify later
        } catch (error) {
            console.log('Not authenticated as owner');
            utils.clearAuthToken();
        }
    }

    // Load stories
    async function loadStories() {
        // Prevent concurrent calls
        if (isLoadingStories) {
            console.log('Stories already loading, skipping...');
            return;
        }

        isLoadingStories = true;
        try {
            console.log('Loading stories for room:', roomId);
            const result = await storiesAPI.getStories(roomId, viewerHash);
            console.log('Stories result:', result);
            
            const newStories = result.stories || [];
            const newAllowUploads = result.allow_uploads || false;

            // Save previous state before updating
            const previousStories = [...currentStories];
            const previousIndex = currentIndex;
            const previousStoryId = previousIndex >= 0 && previousIndex < previousStories.length 
                ? previousStories[previousIndex]?.id 
                : null;

            // Check if stories have actually changed by comparing IDs
            const storiesChanged = 
                previousStories.length !== newStories.length ||
                previousStories.some((story, idx) => 
                    !newStories[idx] || story.id !== newStories[idx].id
                );

            currentStories = newStories;
            allowUploads = newAllowUploads;

            // Show upload button if user is owner OR if uploads are allowed for viewers
            if (isOwner || allowUploads) {
                document.getElementById('uploadButton').classList.remove('hidden');
            }

            // Only reload/re-show story if stories have changed or if we're showing empty state
            if (currentStories.length > 0) {
                // If stories changed or we're not showing a story (empty state), show the story
                // Try to maintain current index if it's still valid, otherwise show first story
                if (storiesChanged || currentIndex < 0 || currentIndex >= currentStories.length) {
                    // Try to keep showing the same story if it still exists at the same index
                    let targetIndex = 0;
                    if (previousIndex >= 0 && previousIndex < currentStories.length) {
                        // Check if the story at the same index has the same ID
                        const newStoryId = currentStories[previousIndex]?.id;
                        if (newStoryId === previousStoryId) {
                            // Same story at same index - keep showing it to avoid glitch
                            targetIndex = previousIndex;
                        } else {
                            // Different story at this index - show first story
                            targetIndex = 0;
                        }
                    }
                    showStory(targetIndex);
                }
                // If stories haven't changed and current index is valid, do nothing (avoid glitch)
            } else {
                // Only show empty state if we're not already showing it
                const container = document.getElementById('storyContainer');
                const isEmptyState = container.querySelector('.empty-state') && 
                                   container.querySelector('.empty-state').textContent.includes('No stories yet');
                if (!isEmptyState) {
                    showEmptyState();
                    currentIndex = -1;
                }
            }
        } catch (error) {
            console.error('Error loading stories:', error);
            console.error('Room ID:', roomId);
            console.error('Viewer Hash:', viewerHash);
            
            // Show error in UI instead of alert
            const container = document.getElementById('storyContainer');
            container.innerHTML = `
                <div class="empty-state">
                    <p class="text-lg mb-2 text-red-400">Failed to load stories</p>
                    <p class="text-sm text-white/40">${error.message || 'Please try again later'}</p>
                    <button onclick="location.reload()" class="mt-4 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm">
                        Retry
                    </button>
                </div>
            `;
        } finally {
            isLoadingStories = false;
        }
    }

    function showStory(index) {
        if (index < 0 || index >= currentStories.length) return;

        currentIndex = index;
        const story = currentStories[index];

        const container = document.getElementById('storyContainer');
        container.innerHTML = '';

        if (!story.media_url) {
            // Si no hay URL (storage no configurado), mostrar mensaje
            container.innerHTML = `
                <div class="empty-state">
                    <p class="text-lg mb-2">Story unavailable</p>
                    <p class="text-sm text-white/40">Storage not configured</p>
                </div>
            `;
            return;
        }

        if (story.media_type === 'image') {
            const img = document.createElement('img');
            img.src = story.media_url;
            img.className = 'story-media';
            img.alt = 'Story';
            img.onerror = () => {
                container.innerHTML = `
                    <div class="empty-state">
                        <p class="text-lg mb-2">Failed to load image</p>
                        <p class="text-sm text-white/40">The story may have been deleted</p>
                    </div>
                `;
            };
            container.appendChild(img);
        } else {
            const video = document.createElement('video');
            video.src = story.media_url;
            video.className = 'story-video';
            video.controls = true;
            video.autoplay = true;
            video.loop = false;
            video.onerror = () => {
                container.innerHTML = `
                    <div class="empty-state">
                        <p class="text-lg mb-2">Failed to load video</p>
                        <p class="text-sm text-white/40">The story may have been deleted</p>
                    </div>
                `;
            };
            container.appendChild(video);
        }

        // Update counter
        document.getElementById('storyCounter').textContent = `${index + 1} / ${currentStories.length}`;

        // Record view
        if (viewerHash) {
            storiesAPI.recordView(story.id, viewerHash).catch(console.error);
        }
    }

    function showEmptyState() {
        const container = document.getElementById('storyContainer');
        container.innerHTML = `
            <div class="empty-state">
                <p class="text-lg mb-2">No stories yet</p>
                <p class="text-sm text-white/40">Be the first to share!</p>
            </div>
        `;
    }

    // Navigation
    document.getElementById('navLeft').addEventListener('click', () => {
        if (currentIndex > 0) {
            showStory(currentIndex - 1);
        }
    });

    document.getElementById('navRight').addEventListener('click', () => {
        if (currentIndex < currentStories.length - 1) {
            showStory(currentIndex + 1);
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' && currentIndex > 0) {
            showStory(currentIndex - 1);
        } else if (e.key === 'ArrowRight' && currentIndex < currentStories.length - 1) {
            showStory(currentIndex + 1);
        }
    });

    // Upload functionality
    const uploadButton = document.getElementById('uploadButton');
    const uploadModal = document.getElementById('uploadModal');
    const fileInput = document.getElementById('fileInput');
    const selectFileButton = document.getElementById('selectFileButton');
    const filePreview = document.getElementById('filePreview');
    const confirmUpload = document.getElementById('confirmUpload');
    const cancelUpload = document.getElementById('cancelUpload');

    let selectedFile = null;

    uploadButton.addEventListener('click', () => {
        uploadModal.classList.remove('hidden');
    });

    selectFileButton.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                filePreview.innerHTML = '';
                if (file.type.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.className = 'max-w-full max-h-64 rounded-lg';
                    filePreview.appendChild(img);
                } else {
                    const video = document.createElement('video');
                    video.src = e.target.result;
                    video.className = 'max-w-full max-h-64 rounded-lg';
                    video.controls = true;
                    filePreview.appendChild(video);
                }
                filePreview.classList.remove('hidden');
                confirmUpload.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    cancelUpload.addEventListener('click', () => {
        uploadModal.classList.add('hidden');
        fileInput.value = '';
        filePreview.classList.add('hidden');
        confirmUpload.classList.add('hidden');
        selectedFile = null;
    });

    confirmUpload.addEventListener('click', async () => {
        if (!selectedFile) return;

        try {
            confirmUpload.disabled = true;
            confirmUpload.textContent = 'Uploading...';

            const mediaType = selectedFile.type.startsWith('image/') ? 'image' : 'video';

            // Get upload URL (will use auth token if owner, or viewer_hash if viewer)
            const uploadData = await storiesAPI.getUploadUrl(roomId, mediaType, selectedFile.size, selectedFile.type);

            async function getUploadErrorDetails(response) {
                try {
                    const text = await response.text();
                    const codeMatch = text.match(/<Code>([^<]+)<\/Code>/);
                    const messageMatch = text.match(/<Message>([^<]+)<\/Message>/);
                    if (codeMatch || messageMatch) {
                        const code = codeMatch ? codeMatch[1] : '';
                        const message = messageMatch ? messageMatch[1] : '';
                        return [code, message].filter(Boolean).join(': ');
                    }
                    return text ? text.slice(0, 200) : '';
                } catch (e) {
                    return '';
                }
            }

            // Upload to S3/R2
            const uploadResponse = await fetch(uploadData.upload_url, {
                method: 'PUT',
                body: selectedFile,
                headers: {
                    'Content-Type': selectedFile.type,
                },
            });

            if (!uploadResponse.ok) {
                const details = await getUploadErrorDetails(uploadResponse);
                const suffix = details ? `: ${details}` : '';
                throw new Error(`Upload failed (HTTP ${uploadResponse.status})${suffix}`);
            }

            // Confirm story creation (will use auth token if owner, or viewer_hash if viewer)
            await storiesAPI.createStory(roomId, uploadData.media_key, mediaType);

            // Reload stories
            await loadStories();

            // Close modal
            cancelUpload.click();
        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload story: ' + (error.message || 'Unknown error'));
        } finally {
            confirmUpload.disabled = false;
            confirmUpload.textContent = 'Upload';
        }
    });

    // Auto-refresh stories every 10 seconds
    setInterval(loadStories, 10000);

    // Initial load
    loadStories();
})();
