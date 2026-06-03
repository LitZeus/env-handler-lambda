const envsTextarea = document.getElementById('envs');
const saveBtn = document.getElementById('save-btn');
const btnText = document.querySelector('.btn-text');
const loader = document.getElementById('loader');
const toast = document.getElementById('toast');
const confirmModal = document.getElementById('confirm-modal');
const diffContainer = document.getElementById('diff-container');

let originalData = {};
let pendingPayload = {};
let currentKey = '';

async function load() {
    try {
        const response = await fetch('/list-envs');
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to load env list');
        }
        
        const data = await response.json();
        const selector = document.getElementById('env-selector');
        
        if (data.keys.length === 0) {
            envsTextarea.value = "# No environment files configured.\n# Please set the S3_KEYS environment variable in your Lambda configuration.";
            envsTextarea.disabled = true;
            saveBtn.disabled = true;
            return;
        }
        
        data.keys.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = k;
            selector.appendChild(opt);
        });
        
        currentKey = data.keys[0];
        await loadSelectedEnv();
    } catch (error) {
        console.error('Error loading env list:', error);
        envsTextarea.value = "# Error loading environment list";
    }
}

async function loadSelectedEnv() {
    const selector = document.getElementById('env-selector');
    if (selector.value) {
        currentKey = selector.value;
    }
    
    envsTextarea.value = "Loading...";
    envsTextarea.disabled = true;
    saveBtn.disabled = true;
    
    try {
        const response = await fetch(`/env?key=${encodeURIComponent(currentKey)}`);
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to load env');
        }
        
        const data = await response.json();
        originalData = { ...data };
        
        let text = '';
        for (const [key, value] of Object.entries(data)) {
            text += `${key}=${value}\n`;
        }
        
        envsTextarea.value = text;
        envsTextarea.disabled = false;
        saveBtn.disabled = false;
    } catch (error) {
        console.error('Error loading env:', error);
        envsTextarea.value = `# Error loading environment variables for ${currentKey}`;
    }
}

function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.style.background = type === 'success' ? 'var(--success)' : 'var(--danger)';
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function setSavingState(isSaving) {
    saveBtn.disabled = isSaving;
    btnText.textContent = isSaving ? 'Saving...' : 'Save Changes';
    loader.style.display = isSaving ? 'inline-block' : 'none';
}

function save() {
    const raw = envsTextarea.value;
    pendingPayload = {};
    
    raw.split('\n').forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#') || !line.includes('=')) {
            return;
        }
        
        const parts = line.split('=');
        const key = parts[0].trim();
        const value = parts.slice(1).join('=');
        
        pendingPayload[key] = value;
    });

    const changes = [];
    
    for (const [key, value] of Object.entries(pendingPayload)) {
        if (!(key in originalData)) {
            changes.push(`<div class="diff-added">+ ${key}=${value}</div>`);
        } else if (originalData[key] !== value) {
            changes.push(`<div class="diff-removed">- ${key}=${originalData[key]}</div>`);
            changes.push(`<div class="diff-changed">~ ${key}=${value}</div>`);
        }
    }
    
    for (const key of Object.keys(originalData)) {
        if (!(key in pendingPayload)) {
            changes.push(`<div class="diff-removed">- ${key}=${originalData[key]}</div>`);
        }
    }
    
    if (changes.length === 0) {
        showToast('No changes detected. Nothing to save.', 'success');
        return;
    }
    
    diffContainer.innerHTML = changes.join('');
    confirmModal.classList.add('show');
}

function closeModal() {
    confirmModal.classList.remove('show');
}

async function confirmSave() {
    closeModal();
    setSavingState(true);
    
    try {
        const response = await fetch(`/env?key=${encodeURIComponent(currentKey)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(pendingPayload)
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to save');
        }
        
        showToast('Settings saved successfully!');
        originalData = { ...originalData, ...pendingPayload };
    } catch (error) {
        console.error('Error saving envs:', error);
        showToast('Failed to save settings.', 'error');
    } finally {
        setSavingState(false);
    }
}

document.addEventListener('DOMContentLoaded', load);
