// =============================================================================
// FIREBASE FIRESTORE INTEGRATION - GAME JAM COORDINATION
// =============================================================================
// Versi ini menggunakan Firebase SDK compat untuk mendukung file:// protocol
// sehingga bisa dibuka langsung di browser tanpa local server

// =============================================================================
// DEFAULT DATA
// =============================================================================
const defaultChecklists = {
    lead_merger: [
        { text: "Menyatukan asset ke scene utama", done: false },
        { text: "Mengecek build bisa dimainkan", done: false }
    ],
    prog_main: [
        { text: "Player bisa bergerak dan berinteraksi", done: false },
        { text: "Sistem menang / kalah berjalan", done: false }
    ],
    prog_support: [
        { text: "Menu start & pause", done: false },
        { text: "Tidak ada error fatal", done: false }
    ],
    artist_main: [
        { text: "Karakter utama selesai", done: false },
        { text: "Asset environment utama selesai", done: false }
    ],
    ui_animator: [
        { text: "UI dasar tampil jelas", done: false },
        { text: "Animasi feedback sederhana", done: false }
    ],
    audio_designer: [
        { text: "BGM utama masuk", done: false },
        { text: "SFX penting tersedia", done: false }
    ],
    qa_video: [
        { text: "Game dites menyeluruh", done: false },
        { text: "Video highlight direkam", done: false }
    ]
};

const defaultMessages = {
    lead_merger: [
        { text: "Pastikan semua role update progres" },
        { text: "Ingatkan deadline harian" }
    ],
    prog_main: [
        { text: "Core loop harus fun" },
        { text: "Jangan over-engineering" }
    ],
    prog_support: [
        { text: "Prioritaskan bug yang mengganggu gameplay" },
        { text: "Test di WebGL" }
    ],
    artist_main: [
        { text: "Jaga konsistensi warna & style" },
        { text: "Simple lebih baik" }
    ],
    ui_animator: [
        { text: "Jangan animasi berat" },
        { text: "Fokus ke kejelasan" }
    ],
    audio_designer: [
        { text: "Volume seimbang" },
        { text: "Loop musik rapi" }
    ],
    qa_video: [
        { text: "Catat bug dengan jelas" },
        { text: "Rekam gameplay stabil" }
    ]
};

// =============================================================================
// ROLES DATA STRUCTURE
// =============================================================================
const rolesData = [
    { id: 'lead_merger', name: 'Ketua Tim / Penggabung Game', member: 'Nama Anggota', description: 'Fokus: Menggabungkan semua pekerjaan menjadi satu game utuh. Catatan: Jangan menambah fitur di akhir jam' },
    { id: 'prog_main', name: 'Programmer Utama (Gameplay)', member: 'Nama Anggota', description: 'Fokus: Aturan main dan mekanik utama. Catatan: Jangan terlalu banyak fitur' },
    { id: 'prog_support', name: 'Programmer Pendukung (UI & Bug)', member: 'Nama Anggota', description: 'Fokus: Menu, UI, dan perbaikan bug' },
    { id: 'artist_main', name: 'Artist Utama', member: 'Nama Anggota', description: 'Fokus: Visual utama dan konsistensi gaya' },
    { id: 'ui_animator', name: 'UI / Animator', member: 'Nama Anggota', description: 'Fokus: Tampilan UI dan animasi ringan' },
    { id: 'audio_designer', name: 'Audio Designer', member: 'Nama Anggota', description: 'Fokus: Musik dan sound effect' },
    { id: 'qa_video', name: 'QA / Video', member: 'Nama Anggota', description: 'Fokus: Kualitas dan dokumentasi' }
];

// =============================================================================
// FIREBASE INITIALIZATION
// =============================================================================
let db = null;
let isConfigured = false;
let unsubscribers = [];

// Firebase config - akan diinisialisasi setelah SDK dimuat
const firebaseConfig = {
    apiKey: "AIzaSyAVjn8mF5-l7U4Tr-p32c75Hsg6IebHTpk",
    authDomain: "tim-gim-jam.firebaseapp.com",
    projectId: "tim-gim-jam",
    storageBucket: "tim-gim-jam.firebasestorage.app",
    messagingSenderId: "1074994891288",
    appId: "1:1074994891288:web:247cdc1390cbdefdb0d16d"
};

function initializeFirebase() {
    try {
        // Check if Firebase is available (loaded via CDN in HTML)
        if (typeof firebase === 'undefined') {
            console.warn("[Firebase] SDK not loaded");
            return false;
        }

        // Check if config has real values
        isConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "API_KEY_ANDA";

        if (isConfigured) {
            // Initialize Firebase app
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.firestore();
            console.log("[Firebase] Initialized successfully");
            return true;
        } else {
            console.warn("[Firebase] Config belum diatur. Fitur realtime tidak aktif.");
            return false;
        }
    } catch (error) {
        console.error("[Firebase] Initialization failed:", error.message);
        isConfigured = false;
        return false;
    }
}

// =============================================================================
// DOM ELEMENTS & TAB NAVIGATION
// =============================================================================
function setupTabNavigation() {
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Restore saved tab from localStorage
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab) {
        const savedTabBtn = document.querySelector(`.tab-btn[data-tab="${savedTab}"]`);
        const savedTabContent = document.getElementById(savedTab);
        if (savedTabBtn && savedTabContent) {
            // Deactivate default active tab
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            // Activate saved tab
            savedTabBtn.classList.add('active');
            savedTabContent.classList.add('active');
        }
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Deactivate all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Activate selected tab and content
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-tab');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
            }

            // Save active tab to localStorage
            localStorage.setItem('activeTab', targetId);
        });
    });
}

// =============================================================================
// FIRESTORE OPERATIONS
// =============================================================================

/**
 * Ensure role document exists in Firestore
 */
async function ensureRoleDocument(roleId, name, description) {
    if (!db) return;

    try {
        const roleRef = db.collection('roles').doc(roleId);
        const roleDoc = await roleRef.get();

        if (!roleDoc.exists) {
            await roleRef.set({
                name: name,
                description: description,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log(`[Firestore] Created role document: ${roleId}`);
        }
    } catch (error) {
        console.error(`[Firestore] Error ensuring role document ${roleId}:`, error.message);
    }
}

/**
 * Seed default checklists for a role if none exist
 */
async function seedDefaultChecklists(roleId) {
    if (!db) return;

    try {
        const checklistsRef = db.collection('roles').doc(roleId).collection('checklists');
        const snapshot = await checklistsRef.get();

        if (snapshot.empty && defaultChecklists[roleId]) {
            console.log(`[Firestore] Seeding default checklists for ${roleId}`);
            const batch = db.batch();

            defaultChecklists[roleId].forEach((item, index) => {
                const newDocRef = checklistsRef.doc();
                batch.set(newDocRef, {
                    text: item.text,
                    done: item.done,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    order: index
                });
            });

            await batch.commit();
        }
    } catch (error) {
        console.error(`[Firestore] Error seeding checklists for ${roleId}:`, error.message);
    }
}

/**
 * Seed default messages for a role if none exist
 */
async function seedDefaultMessages(roleId) {
    if (!db) return;

    try {
        const messagesRef = db.collection('roles').doc(roleId).collection('messages');
        const snapshot = await messagesRef.get();

        if (snapshot.empty && defaultMessages[roleId]) {
            console.log(`[Firestore] Seeding default messages for ${roleId}`);
            const batch = db.batch();

            defaultMessages[roleId].forEach((item, index) => {
                const newDocRef = messagesRef.doc();
                batch.set(newDocRef, {
                    text: item.text,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    order: index
                });
            });

            await batch.commit();
        }
    } catch (error) {
        console.error(`[Firestore] Error seeding messages for ${roleId}:`, error.message);
    }
}

/**
 * Update the usage text showing how many items are checked
 */
function updateChecklistProgress(roleId) {
    const container = document.getElementById(`checklist-${roleId}`);
    if (!container) return;

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const total = checkboxes.length;
    const done = Array.from(checkboxes).filter(cb => cb.checked).length;

    const progressSpan = document.getElementById(`progress-${roleId}`);
    if (progressSpan) {
        progressSpan.textContent = `(${done}/${total} selesai)`;
    }
}

/**
 * Setup realtime listeners for a role's checklists and messages
 */
function setupRealtimeListeners(roleId) {
    if (!db) return;

    // Checklist listener
    const checklistsRef = db.collection('roles').doc(roleId).collection('checklists');
    const unsubChecklist = checklistsRef.orderBy('order', 'asc').onSnapshot((snapshot) => {
        const container = document.getElementById(`checklist-${roleId}`);
        if (!container) return;

        if (snapshot.empty) {
            container.innerHTML = '<p class="empty-text">Belum ada checklist.</p>';
            updateChecklistProgress(roleId);
            return;
        }

        container.innerHTML = '';
        snapshot.forEach(doc => {
            const item = { id: doc.id, ...doc.data() };
            container.appendChild(renderChecklistItem(roleId, item));
        });

        updateChecklistProgress(roleId);

    }, (error) => {
        console.error(`[Firestore] Checklist listener error for ${roleId}:`, error.message);
    });

    unsubscribers.push(unsubChecklist);

    // Message listener
    const messagesRef = db.collection('roles').doc(roleId).collection('messages');
    const unsubMessage = messagesRef.orderBy('order', 'asc').onSnapshot((snapshot) => {
        const container = document.getElementById(`messages-${roleId}`);
        if (!container) return;

        if (snapshot.empty) {
            container.innerHTML = '<p class="empty-text">Belum ada pesan.</p>';
            return;
        }

        container.innerHTML = '';
        snapshot.forEach(doc => {
            const item = { id: doc.id, ...doc.data() };
            container.appendChild(renderMessageItem(roleId, item));
        });
    }, (error) => {
        console.error(`[Firestore] Message listener error for ${roleId}:`, error.message);
    });

    unsubscribers.push(unsubMessage);

    // Role Info Listener (Member Name)
    const roleDocRef = db.collection('roles').doc(roleId);
    const unsubRole = roleDocRef.onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            const memberSpan = document.getElementById(`member-name-${roleId}`);
            if (memberSpan) {
                // If memberName exists in Firestore use it, otherwise use default
                const displayName = data.memberName || "Nama Anggota";
                memberSpan.textContent = displayName;

                // Also update the class to show if it's filled or default
                if (displayName !== "Nama Anggota") {
                    memberSpan.classList.add('filled');
                } else {
                    memberSpan.classList.remove('filled');
                }
            }
        }
    }, (error) => {
        console.error(`[Firestore] Role info listener error for ${roleId}:`, error.message);
    });

    unsubscribers.push(unsubRole);
}

// =============================================================================
// MODAL & INPUT HANDLING
// =============================================================================

function openModal(title, initialValue = "") {
    return new Promise((resolve) => {
        const modal = document.getElementById('input-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalInput = document.getElementById('modal-input');
        const submitBtn = document.getElementById('modal-submit-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');

        modalTitle.textContent = title;
        modalInput.value = initialValue;
        modal.classList.add('open');
        document.body.classList.add('no-scroll');
        modalInput.focus();

        const cleanup = () => {
            submitBtn.removeEventListener('click', handleSubmit);
            cancelBtn.removeEventListener('click', handleCancel);
            modal.classList.remove('open');
            document.body.classList.remove('no-scroll');
        };

        const handleSubmit = () => {
            const val = modalInput.value;
            if (val && val.trim()) {
                cleanup();
                resolve(val);
            } else {
                modalInput.focus();
            }
        };

        const handleCancel = () => {
            cleanup();
            resolve(null);
        };

        submitBtn.addEventListener('click', handleSubmit);
        cancelBtn.addEventListener('click', handleCancel);

        // Allow close on escape key
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', handleKeydown);
                handleCancel();
            }
        };
        document.addEventListener('keydown', handleKeydown);
    });
}

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

window.handleAddChecklist = async function (roleId) {
    if (!db) {
        alert("Firebase belum tersedia. Pastikan konfigurasi sudah benar.");
        return;
    }

    const text = await openModal("Masukkan tugas baru:");
    if (!text || !text.trim()) return;

    try {
        // Get current count for ordering
        const checklistsRef = db.collection('roles').doc(roleId).collection('checklists');
        const snapshot = await checklistsRef.get();
        const order = snapshot.size;

        await checklistsRef.add({
            text: text.trim(),
            done: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            order: order
        });
        console.log(`[Checklist] Added new item to ${roleId}`);
    } catch (error) {
        console.error("[Checklist] Error adding:", error.message);
        alert("Gagal menambah checklist: " + error.message);
    }
};

window.toggleChecklist = async function (roleId, itemId, newStatus) {
    if (!db) return;

    try {
        await db.collection('roles').doc(roleId).collection('checklists').doc(itemId).update({
            done: newStatus
        });
        console.log(`[Checklist] Toggled ${itemId} to ${newStatus}`);
    } catch (error) {
        console.error("[Checklist] Error toggling:", error.message);
    }
};

window.deleteChecklist = async function (roleId, itemId) {
    if (!db) return;

    if (!confirm("Hapus checklist ini?")) return;

    try {
        await db.collection('roles').doc(roleId).collection('checklists').doc(itemId).delete();
        console.log(`[Checklist] Deleted ${itemId}`);
    } catch (error) {
        console.error("[Checklist] Error deleting:", error.message);
    }
};

window.handleAddMessage = async function (roleId) {
    if (!db) {
        alert("Firebase belum tersedia. Pastikan konfigurasi sudah benar.");
        return;
    }

    const text = await openModal("Tulis pesan/catatan:");
    if (!text || !text.trim()) return;

    try {
        const messagesRef = db.collection('roles').doc(roleId).collection('messages');
        const snapshot = await messagesRef.get();
        const order = snapshot.size;

        await messagesRef.add({
            text: text.trim(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            order: order
        });
        console.log(`[Message] Added new message to ${roleId}`);
    } catch (error) {
        console.error("[Message] Error adding:", error.message);
        alert("Gagal menambah pesan: " + error.message);
    }
};

window.editMessage = async function (roleId, itemId, oldText) {
    if (!db) return;

    const newText = await openModal("Edit pesan:", oldText);
    if (!newText || !newText.trim()) return;

    try {
        await db.collection('roles').doc(roleId).collection('messages').doc(itemId).update({
            text: newText.trim()
        });
        console.log(`[Message] Updated ${itemId}`);
    } catch (error) {
        console.error("[Message] Error updating:", error.message);
    }
};

window.deleteMessage = async function (roleId, itemId) {
    if (!db) return;

    if (!confirm("Hapus pesan ini?")) return;

    try {
        await db.collection('roles').doc(roleId).collection('messages').doc(itemId).delete();
        console.log(`[Message] Deleted ${itemId}`);
    } catch (error) {
        console.error("[Message] Error deleting:", error.message);
    }
};

window.editRoleMemberName = async function (roleId) {
    if (!db) {
        alert("Firebase belum tersedia.");
        return;
    }

    // Get current value
    const currentSpan = document.getElementById(`member-name-${roleId}`);
    const currentName = currentSpan ? currentSpan.textContent : "Nama Anggota";

    // Provide a cleaner default for the prompt if it's the placeholder
    const defaultForInput = currentName === "Nama Anggota" ? "" : currentName;

    const newName = await openModal("Nama Anggota:", defaultForInput);

    if (newName === null) return; // Cancelled

    const nameToSave = newName.trim() === "" ? "Nama Anggota" : newName.trim();

    try {
        // Ensure doc exists first (it should, but just in case)
        const roleRef = db.collection('roles').doc(roleId);
        await roleRef.set({ memberName: nameToSave }, { merge: true });
        console.log(`[Role] Updated member name for ${roleId} to ${nameToSave}`);
    } catch (error) {
        console.error("[Role] Error updating member name:", error.message);
        alert("Gagal update nama: " + error.message);
    }
};

// =============================================================================
// UI RENDERING
// =============================================================================

function createRoleCard(role) {
    const card = document.createElement('div');
    card.className = 'role-card';
    card.id = `role-${role.id}`;

    card.innerHTML = `
        <div class="role-header">
            <h2>
                ${role.name} 
                <span class="role-member-container" onclick="editRoleMemberName('${role.id}')" title="Klik untuk ubah nama">
                    — <span id="member-name-${role.id}" class="role-member-name">${role.member}</span> 
                    <span class="edit-icon">✎</span>
                </span>
            </h2>
            <p>${role.description}</p>
        </div>
        <div class="role-body">
            <!-- Checklist Section -->
            <div class="section-header">
                <h3 class="section-title">
                    <span>Checklist <span id="progress-${role.id}" class="checklist-progress">(0/0 selesai)</span></span>
                    <button class="btn-add" onclick="handleAddChecklist('${role.id}')">+ Tambah</button>
                </h3>
            </div>
            <div id="checklist-${role.id}" class="checklist-container">
                <p class="empty-text">Memuat...</p>
            </div>

            <!-- Message Section -->
            <div class="section-header">
                <h3 class="section-title">
                    Catatan & Pesan
                    <button class="btn-add" onclick="handleAddMessage('${role.id}')">+ Tulis</button>
                </h3>
            </div>
            <p class="helper-text" style="font-size: 0.85em; color: #666; margin-top: -5px; margin-bottom: 15px; font-style: italic;">
                Catatan singkat saja. Diskusi dan file sharing tetap melalui Discord.
            </p>
            <div id="messages-${role.id}" class="message-container">
                <p class="empty-text">Memuat...</p>
            </div>
        </div>
    `;

    return card;
}

function renderChecklistItem(roleId, item) {
    const div = document.createElement('div');
    div.className = `checklist-item ${item.done ? 'done' : ''}`;

    div.innerHTML = `
        <input type="checkbox" class="checklist-checkbox" ${item.done ? 'checked' : ''}>
        <span class="checklist-text">${escapeHtml(item.text)}</span>
        <button class="btn-icon btn-delete" title="Hapus">✕</button>
    `;

    // Event: Toggle checkbox
    const checkbox = div.querySelector('.checklist-checkbox');
    checkbox.addEventListener('change', () => {
        toggleChecklist(roleId, item.id, checkbox.checked);
    });

    // Event: Delete button
    const deleteBtn = div.querySelector('.btn-delete');
    deleteBtn.addEventListener('click', () => {
        deleteChecklist(roleId, item.id);
    });

    return div;
}

function renderMessageItem(roleId, item) {
    const div = document.createElement('div');
    div.className = 'message-item';

    div.innerHTML = `
        <div class="message-text">${escapeHtml(item.text)}</div>
        <div class="message-actions">
            <button class="btn-icon btn-edit" title="Edit">✎</button>
            <button class="btn-icon btn-delete" title="Hapus">✕</button>
        </div>
    `;

    // Event: Edit button
    const editBtn = div.querySelector('.btn-edit');
    editBtn.addEventListener('click', () => {
        editMessage(roleId, item.id, item.text);
    });

    // Event: Delete button
    const deleteBtn = div.querySelector('.btn-delete');
    deleteBtn.addEventListener('click', () => {
        deleteMessage(roleId, item.id);
    });

    return div;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Role Filter Logic
function initRoleFilter() {
    const filterSelect = document.getElementById('role-filter');
    if (!filterSelect) return;

    // Populate options
    rolesData.forEach(role => {
        const option = document.createElement('option');
        option.value = role.id;
        option.textContent = role.name;
        filterSelect.appendChild(option);
    });

    // Restore saved filter from localStorage
    const savedFilter = localStorage.getItem('selectedRole');
    if (savedFilter) {
        filterSelect.value = savedFilter;
        // Apply the filter immediately
        applyRoleFilter(savedFilter);
    }

    // Handle change
    filterSelect.addEventListener('change', (e) => {
        const selectedRole = e.target.value;
        applyRoleFilter(selectedRole);
        // Save to localStorage
        localStorage.setItem('selectedRole', selectedRole);
    });
}

// Helper function to apply role filter
function applyRoleFilter(selectedRole) {
    const cards = document.querySelectorAll('.role-card');
    cards.forEach(card => {
        if (selectedRole === 'all') {
            card.style.display = 'block';
        } else {
            if (card.id === `role-${selectedRole}`) {
                card.style.display = 'block';
                card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                card.style.display = 'none';
            }
        }
    });
}

// =============================================================================
// APP INITIALIZATION
// =============================================================================

async function initApp() {
    console.log("[App] Initializing...");

    // Setup tab navigation first
    setupTabNavigation();

    const rolesContainer = document.getElementById('roles-container');
    if (!rolesContainer) {
        console.error("[App] roles-container not found");
        return;
    }

    // Clear loading text
    rolesContainer.innerHTML = '';

    // Initialize Firebase
    const firebaseReady = initializeFirebase();

    // Show warning if Firebase not configured
    if (!firebaseReady) {
        const warning = document.createElement('div');
        warning.className = 'config-warning';
        warning.innerHTML = `
            <strong>⚠️ Firebase Status</strong><br>
            ${typeof firebase === 'undefined'
                ? 'Firebase SDK belum dimuat. Pastikan koneksi internet aktif.'
                : 'Konfigurasi Firebase belum diatur atau terjadi error. Cek console untuk detail.'}
        `;
        rolesContainer.appendChild(warning);
    }

    // Render all role cards first (UI renders immediately)
    for (const role of rolesData) {
        const roleCard = createRoleCard(role);
        rolesContainer.appendChild(roleCard);
    }

    // Then setup Firebase data asynchronously
    if (firebaseReady && db) {
        for (const role of rolesData) {
            try {
                // These operations happen in background
                await ensureRoleDocument(role.id, role.name, role.description);
                await seedDefaultChecklists(role.id);
                await seedDefaultMessages(role.id);
                setupRealtimeListeners(role.id);
            } catch (error) {
                console.error(`[App] Error setting up ${role.id}:`, error.message);
                // Show error in that role's containers
                const checklistContainer = document.getElementById(`checklist-${role.id}`);
                const messagesContainer = document.getElementById(`messages-${role.id}`);

                if (checklistContainer) {
                    checklistContainer.innerHTML = `<p class="empty-text" style="color: var(--accent-color);">Error memuat data.</p>`;
                }
                if (messagesContainer) {
                    messagesContainer.innerHTML = `<p class="empty-text" style="color: var(--accent-color);">Error memuat data.</p>`;
                }
            }
        }
    } else {
        // Show offline message in all containers
        for (const role of rolesData) {
            const checklistContainer = document.getElementById(`checklist-${role.id}`);
            const messagesContainer = document.getElementById(`messages-${role.id}`);

            if (checklistContainer) {
                checklistContainer.innerHTML = '<p class="empty-text">Firebase belum terhubung.</p>';
            }
            if (messagesContainer) {
                messagesContainer.innerHTML = '<p class="empty-text">Firebase belum terhubung.</p>';
            }
        }
    }

    // Theme Toggle Logic
    function initTheme() {
        const themeBtn = document.getElementById('theme-btn');
        const html = document.documentElement;

        // Check saved theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            html.setAttribute('data-theme', 'dark');
            themeBtn.textContent = '☀️';
        }

        themeBtn.addEventListener('click', () => {
            const currentTheme = html.getAttribute('data-theme');
            if (currentTheme === 'dark') {
                html.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                themeBtn.textContent = '🌙';
            } else {
                html.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                themeBtn.textContent = '☀️';
            }
        });
    }

    // Initialize Role Filter
    initRoleFilter();
    initTheme();

    console.log("[App] Initialization complete");
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
