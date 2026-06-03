const envsTextarea = document.getElementById('envs');
const saveBtn = document.getElementById('save-btn');
const btnText = document.querySelector('.btn-text');
const loader = document.getElementById('loader');
const toast = document.getElementById('toast');
const confirmModal = document.getElementById('confirm-modal');
const diffContainer = document.getElementById('diff-container');

let originalData = {};
let pendingPayload = {};

async function load() {
    try {
        const response = await fetch('/env');
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to load');
        }
        
        const data = await response.json();
        originalData = { ...data };
        
        let text = '';
        for (const [key, value] of Object.entries(data)) {
            text += `${key}=${value}\n`;
        }
        
        envsTextarea.value = text;
    } catch (error) {
        console.error('Error loading envs:', error);
        envsTextarea.value = "# Error loading environment variables";
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
    
    // Check for changed or added keys
    for (const [key, value] of Object.entries(pendingPayload)) {
        if (!(key in originalData)) {
            changes.push(`<div class="diff-added">+ ${key}=${value}</div>`);
        } else if (originalData[key] !== value) {
            changes.push(`<div class="diff-removed">- ${key}=${originalData[key]}</div>`);
            changes.push(`<div class="diff-changed">~ ${key}=${value}</div>`);
        }
    }
    
    if (changes.length === 0) {
        changes.push('<div class="diff-none">No variables were added or modified.</div>');
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
        const response = await fetch('/env', {
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

// Init
document.addEventListener('DOMContentLoaded', load);
