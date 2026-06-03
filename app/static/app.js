const envsTextarea = document.getElementById('envs');
const saveBtn = document.getElementById('save-btn');
const btnText = document.querySelector('.btn-text');
const loader = document.getElementById('loader');
const toast = document.getElementById('toast');

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

async function save() {
    const raw = envsTextarea.value;
    const payload = {};
    
    raw.split('\n').forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#') || !line.includes('=')) {
            return;
        }
        
        const parts = line.split('=');
        const key = parts[0].trim();
        const value = parts.slice(1).join('=');
        
        payload[key] = value;
    });

    setSavingState(true);
    
    try {
        const response = await fetch('/env', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to save');
        }
        
        showToast('Settings saved successfully!');
    } catch (error) {
        console.error('Error saving envs:', error);
        showToast('Failed to save settings.', 'error');
    } finally {
        setSavingState(false);
    }
}

// Init
document.addEventListener('DOMContentLoaded', load);
