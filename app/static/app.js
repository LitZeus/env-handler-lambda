const envRowsContainer = document.getElementById('env-rows');
const btnAddVar = document.getElementById('btn-add-var');
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
            envRowsContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No environment files configured.<br><br>Please set the S3_KEYS environment variable in your Lambda configuration.</div>';
            btnAddVar.style.display = 'none';
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
        envRowsContainer.innerHTML = '<div style="text-align: center; color: var(--danger); padding: 2rem;">Error loading environment list</div>';
    }
}

async function loadSelectedEnv() {
    const selector = document.getElementById('env-selector');
    if (selector.value) {
        currentKey = selector.value;
    }
    
    envRowsContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">Loading...</div>';
    btnAddVar.style.display = 'none';
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
        
        renderEditor(originalData);
        btnAddVar.style.display = 'block';
        checkChanges();
    } catch (error) {
        console.error('Error loading env:', error);
        envRowsContainer.innerHTML = `<div style="text-align: center; color: var(--danger); padding: 2rem;">Error loading environment variables for ${currentKey}</div>`;
    }
}

function renderEditor(data) {
    envRowsContainer.innerHTML = '';
    const entries = Object.entries(data);
    
    if (entries.length === 0) {
        addEnvRow('', '');
    } else {
        entries.forEach(([key, value]) => addEnvRow(key, value));
    }
}

function addEnvRow(key = '', value = '') {
    const row = document.createElement('div');
    row.className = 'env-row';
    
    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.className = 'env-input key';
    keyInput.placeholder = 'KEY';
    keyInput.value = key;
    keyInput.addEventListener('input', checkChanges);
    
    const valInput = document.createElement('input');
    valInput.type = 'text';
    valInput.className = 'env-input';
    valInput.placeholder = 'VALUE';
    valInput.value = value;
    valInput.addEventListener('input', checkChanges);
    
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-delete';
    delBtn.innerHTML = '&times;';
    delBtn.title = 'Remove variable';
    delBtn.onclick = () => {
        row.remove();
        checkChanges();
    };
    
    row.appendChild(keyInput);
    row.appendChild(valInput);
    row.appendChild(delBtn);
    
    envRowsContainer.appendChild(row);
    checkChanges();
}

function checkChanges() {
    pendingPayload = {};
    const rows = envRowsContainer.querySelectorAll('.env-row');
    
    rows.forEach(row => {
        const keyInput = row.querySelector('.env-input.key');
        const valInput = row.querySelector('.env-input:not(.key)');
        
        const key = keyInput.value.trim();
        const value = valInput.value;
        
        if (key) {
            pendingPayload[key] = value;
        }
    });
    
    let hasChanges = false;
    
    if (Object.keys(pendingPayload).length !== Object.keys(originalData).length) {
        hasChanges = true;
    } else {
        for (const [key, value] of Object.entries(pendingPayload)) {
            if (originalData[key] !== value) {
                hasChanges = true;
                break;
            }
        }
    }
    
    saveBtn.disabled = !hasChanges;
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
    checkChanges(); // Ensure pending payload is updated
    
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
        showToast('No changes detected.', 'success');
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
        originalData = { ...pendingPayload }; // Update original data
        checkChanges(); // Re-evaluate button state (will disable it)
    } catch (error) {
        console.error('Error saving envs:', error);
        showToast('Failed to save settings.', 'error');
        setSavingState(false);
    }
}

async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (error) {
        console.error('Logout failed:', error);
        window.location.href = '/login';
    }
}

document.addEventListener('DOMContentLoaded', load);
