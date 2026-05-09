// static/app.js — offline-first time tracker (FINAL)

// ─── CSRF helper ──────────────────────────────────────────────────────────────
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(name + '=')) {
                cookieValue = cookie.substring(name.length + 1);
                break;
            }
        }
    }
    return cookieValue;
}

// ─── IndexedDB helpers ────────────────────────────────────────────────────────
const DB = { name: 'timetracker', ver: 1, store: 'entries' };

function openDB() {
    return new Promise((res, rej) => {
        const req = indexedDB.open(DB.name, DB.ver);
        req.onupgradeneeded = e => {
            const store = e.target.result.createObjectStore(DB.store, { keyPath: 'id' });
            store.createIndex('date', 'date');
            store.createIndex('synced', 'synced');
        };
        req.onsuccess = e => res(e.target.result);
        req.onerror = e => rej(e.target.error);
    });
}

async function dbOp(mode, fn) {
    const db = await openDB();
    return new Promise((res, rej) => {
        const tx = db.transaction(DB.store, mode);
        const st = tx.objectStore(DB.store);
        const req = fn(st);
        if (req) {
            req.onsuccess = e => res(e.target.result);
            req.onerror = e => rej(e.target.error);
        } else {
            tx.oncomplete = () => res();
            tx.onerror = e => rej(e.target.error);
        }
    });
}

const saveEntry = entry => dbOp('readwrite', s => s.put(entry));
const getAll = () => dbOp('readonly', s => s.getAll());

async function markSynced(id) {
    const db = await openDB();
    return new Promise((res, rej) => {
        const tx = db.transaction(DB.store, 'readwrite');
        const st = tx.objectStore(DB.store);
        const req = st.get(id);
        req.onsuccess = () => {
            if (req.result) {
                req.result.synced = true;
                st.put(req.result);
            }
            res();
        };
        req.onerror = e => rej(e.target.error);
    });
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function calcHours(checkIn, checkOut) {
    const [ih, im] = checkIn.split(':').map(Number);
    const [oh, om] = checkOut.split(':').map(Number);
    const diff = (oh * 60 + om) - (ih * 60 + im);
    return diff > 0 ? Math.round(diff / 60 * 100) / 100 : 0;
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function setStatus(state) {
    const el = document.getElementById('status');
    const map = {
        online: ['✓ Synced', 'online'],
        offline: ['● Offline', 'offline'],
        syncing: ['↻ Syncing…', 'syncing'],
    };
    const [text, cls] = map[state] || map.offline;
    el.textContent = text;
    el.className = cls;
}

// ─── Render entries (offline-first) ───────────────────────────────────────────
async function renderEntries() {
    const entries = await getAll();

    const tbody = document.getElementById('entries-body');
    if (!entries.length) {
        tbody.innerHTML =
            '<tr><td colspan="5" class="empty">No entries yet.</td></tr>';
        return;
    }

    tbody.innerHTML = entries.map(e => `
    <tr>
    <td>${e.date}</td>
    <td>${e.check_in}</td>
    <td>${e.check_out}</td>
    <td class="hours">${e.hours}h</td>
    <td>${e.note || '<span style="color:#ccc">—</span>'}</td>

    <td class="actions">
        <button onclick="editEntry('${e.id}')" class="icon-btn">✏️</button>
        <button onclick="deleteEntryUI('${e.id}')" class="icon-btn danger">🗑</button>
    </td>
    </tr>
    `).join('');
}

// ─── Render summary from server (hours + earnings) ────────────────────────────
async function renderSummaryFromServer() {
    try {
        const res = await fetch('/api/summary/');
        if (!res.ok) return;

        const data = await res.json();

        // HOURS
        document.getElementById('s-day-hours').textContent =
            data.day.hours.toFixed(2) + 'h';
        document.getElementById('s-week-hours').textContent =
            data.week.hours.toFixed(2) + 'h';
        document.getElementById('s-month-hours').textContent =
            data.month.hours.toFixed(2) + 'h';

        // EARNINGS (hidden by default)
        document.getElementById('s-day-earnings').textContent =
            '£' + data.day.earnings.toFixed(2);
        document.getElementById('s-week-earnings').textContent =
            '£' + data.week.earnings.toFixed(2);
        document.getElementById('s-month-earnings').textContent =
            '£' + data.month.earnings.toFixed(2);
    } catch (err) {
        console.warn('Summary fetch failed:', err);
    }
}

// ─── Sync to server ───────────────────────────────────────────────────────────
async function syncToServer() {
    const all = await getAll();
    const unsynced = all.filter(e => !e.synced);
    if (!unsynced.length) {
        setStatus('online');
        await renderSummaryFromServer();
        return;
    }

    setStatus('syncing');

    try {
        const res = await fetch('/api/entries/bulk/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify(unsynced),
        });

        const data = await res.json();
        if (data.synced) {
            for (const entry of unsynced) {
                if (data.synced.includes(entry.id)) {
                    await markSynced(entry.id);
                }
            }
        }

        await renderEntries();
        await renderSummaryFromServer();
        setStatus('online');
    } catch (err) {
        console.error('Sync failed:', err);
        setStatus('offline');
    }
}

// ─── Form submission ──────────────────────────────────────────────────────────
document.getElementById('entry-form').addEventListener('submit', async e => {
    e.preventDefault();

    const checkIn = document.getElementById('check-in').value;
    const checkOut = document.getElementById('check-out').value;
    const hours = calcHours(checkIn, checkOut).toFixed(2);
    const editingId = document.getElementById('editing-id').value;

    if (hours <= 0) {
        alert('Check-out must be after check-in.');
        return;
    }

    const entry = {

        id: editingId || Date.now().toString(),
        date: document.getElementById('date').value,
        check_in: checkIn,
        check_out: checkOut,
        hours,
        note: document.getElementById('note').value.trim(),
        synced: false,
    };

    await saveEntry(entry);
    await renderEntries();


    if (navigator.onLine) {
        await syncToServer();   // ✅ server gets updated
    } else {
        setStatus('offline');
    }

    document.getElementById('editing-id').value = '';
    document.querySelector('#entry-form button').textContent = '＋ Save Entry';

    e.target.reset();
    document.getElementById('date').value = today();
});

// ─── Earnings reveal (10 seconds) ─────────────────────────────────────────────
let earningsTimer = null;

document.getElementById('show-earnings-btn')
    ?.addEventListener('click', () => {
        document.querySelectorAll('.earnings')
            .forEach(el => el.classList.remove('hidden'));

        if (earningsTimer) clearTimeout(earningsTimer);

        earningsTimer = setTimeout(() => {
            document.querySelectorAll('.earnings')
                .forEach(el => el.classList.add('hidden'));
        }, 10000);
    });

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('date').value = today();

    await renderEntries();

    if (navigator.onLine) {
        await renderSummaryFromServer();
        await syncToServer();
    } else {
        setStatus('offline');
    }

    window.addEventListener('online', syncToServer);
    window.addEventListener('offline', () => setStatus('offline'));

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/static/sw.js');
    }
});


async function editEntry(id) {
    const all = await getAll();
    const entry = all.find(e => e.id === id);

    if (!entry) return;

    // Fill form
    document.getElementById('editing-id').value = entry.id;
    document.getElementById('date').value = entry.date;
    document.getElementById('check-in').value = entry.check_in;
    document.getElementById('check-out').value = entry.check_out;
    document.getElementById('note').value = entry.note;

    // Change button text
    document.querySelector('#entry-form button').textContent = 'Update Entry';

    // Scroll to form (nice UX)
    document.getElementById('entry-form').scrollIntoView({
        behavior: 'smooth'
    });
}

async function deleteEntryUI(id) {
    if (!confirm("Delete this entry?")) return;

    // ✅ delete locally first
    const db = await openDB();
    const tx = db.transaction(DB.store, 'readwrite');
    tx.objectStore(DB.store).delete(id);

    if (navigator.onLine) {
        try {
            await fetch(`/api/entries/${id}/`, {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': getCookie('csrftoken')
                }
            });
        } catch (err) {
            console.warn("Server delete failed, will retry later");
        }
    }

    await renderEntries();
    if (navigator.onLine) {
        await syncToServer();   // ✅ sync handles summary
    }

}






// // static/app.js  — offline-first time tracker
// function getCookie(name) {
//     let cookieValue = null;
//     if (document.cookie && document.cookie !== '') {
//         const cookies = document.cookie.split(';');
//         for (let cookie of cookies) {
//             cookie = cookie.trim();
//             if (cookie.startsWith(name + '=')) {
//                 cookieValue = cookie.substring(name.length + 1);
//                 break;
//             }
//         }
//     }
//     return cookieValue;
// }
// // ─── IndexedDB helpers ────────────────────────────────────────────────────────
// const DB = { name: 'timetracker', ver: 1, store: 'entries' };

// function openDB() {
//     return new Promise((res, rej) => {
//         const req = indexedDB.open(DB.name, DB.ver);
//         req.onupgradeneeded = e => {
//             const store = e.target.result.createObjectStore(DB.store, { keyPath: 'id' });
//             store.createIndex('date',   'date',   { unique: false });
//             store.createIndex('synced', 'synced', { unique: false });
//         };
//         req.onsuccess = e => res(e.target.result);
//         req.onerror   = e => rej(e.target.error);
//     });
// }

// async function dbOp(mode, fn) {
//     const db  = await openDB();
//     return new Promise((res, rej) => {
//         const tx  = db.transaction(DB.store, mode);
//         const st  = tx.objectStore(DB.store);
//         const req = fn(st);
//         if (req) {
//             req.onsuccess = e => res(e.target.result);
//             req.onerror   = e => rej(e.target.error);
//         } else {
//             tx.oncomplete = () => res();
//             tx.onerror    = e  => rej(e.target.error);
//         }
//     });
// }

// const saveEntry  = entry  => dbOp('readwrite', s => s.put(entry));
// const getAll     = ()     => dbOp('readonly',  s => s.getAll());

// async function markSynced(id) {
//     const db = await openDB();
//     return new Promise((res, rej) => {
//         const tx  = db.transaction(DB.store, 'readwrite');
//         const st  = tx.objectStore(DB.store);
//         const req = st.get(id);
//         req.onsuccess = () => {
//             if (req.result) { req.result.synced = true; st.put(req.result); }
//             res();
//         };
//         req.onerror = e => rej(e.target.error);
//     });
// }

// // ─── Utilities ────────────────────────────────────────────────────────────────
// function calcHours(checkIn, checkOut) {
//     const [ih, im] = checkIn.split(':').map(Number);
//     const [oh, om] = checkOut.split(':').map(Number);
//     const diff = (oh * 60 + om) - (ih * 60 + im);
//     return diff > 0 ? Math.round(diff / 60 * 100) / 100 : 0;
// }

// function today() {
//     return new Date().toISOString().slice(0, 10);
// }

// function weekStart() {
//     const d = new Date();
//     d.setDate(d.getDate() - d.getDay() + 1); // Monday
//     return d.toISOString().slice(0, 10);
// }

// function monthStart() {
//     return today().slice(0, 7) + '-01';
// }

// // ─── Status badge ─────────────────────────────────────────────────────────────
// function setStatus(state) {
//     const el   = document.getElementById('status');
//     const map  = {
//         online:  ['✓ Synced',   'online'],
//         offline: ['● Offline',  'offline'],
//         syncing: ['↻ Syncing…', 'syncing'],
//     };
//     const [text, cls] = map[state] || map.offline;
//     el.textContent = text;
//     el.className   = cls;
// }

// // ─── Sync ─────────────────────────────────────────────────────────────────────
// async function syncToServer() {
//     setStatus('syncing');

//     const all = await getAll();
//     const unsynced = all.filter(e => !e.synced);
//     const csrftoken = getCookie('csrftoken');

//     if (!unsynced.length) {
//         setStatus('online');
//         return;
//     }

//     try {
//         const res = await fetch('/api/entries/bulk/', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'X-CSRFToken': csrftoken
//             },
//             body: JSON.stringify(unsynced),
//         });

//         if (!res.ok) throw new Error('Server error');

//         const data = await res.json();

//         console.log("Server response:", data);
//         console.log("Unsynced entries:", unsynced);

//         if (data.synced && Array.isArray(data.synced)) {
//             for (const entry of unsynced) {
//                 if (data.synced.includes(entry.id)) {
//                     await markSynced(entry.id);
//                 }
//             }

//             await renderEntries();
//             setStatus('online');
//         } else {
//             console.warn("Invalid response:", data);
//             setStatus(navigator.onLine ? 'online' : 'offline');
//         }

//     } catch (err) {
//         console.error("Sync failed:", err);
//         setStatus(navigator.onLine ? 'online' : 'offline');
//     }
// }

// // ─── Render ───────────────────────────────────────────────────────────────────
// async function renderEntries() {
//     const entries = await getAll();
//     entries.sort((a, b) =>
//         (b.date + b.check_in).localeCompare(a.date + a.check_in)
//     );

//     // Summaries
//     const sum = filter =>
//         entries.filter(filter).reduce((a, e) => a + Number(e.hours), 0).toFixed(2);

//     document.getElementById('s-day').textContent   = sum(e => e.date === today())      + 'h';
//     document.getElementById('s-week').textContent  = sum(e => e.date >= weekStart())   + 'h';
//     document.getElementById('s-month').textContent = sum(e => e.date >= monthStart())  + 'h';

//     // Table rows
//     const tbody = document.getElementById('entries-body');
//     if (!entries.length) {
//         tbody.innerHTML = '<tr><td colspan="5" class="empty">No entries yet.</td></tr>';
//         return;
//     }

//     tbody.innerHTML = entries.map(e => `
//         <tr>
//           <td>${e.date}</td>
//           <td>${e.check_in}</td>
//           <td>${e.check_out}</td>
//           <td class="hours">${e.hours}h</td>
//           <td>
//             ${e.note || '<span style="color:#ccc">—</span>'}
//             ${!e.synced ? '<span class="unsynced"> ⚠ unsynced</span>' : ''}
//           </td>
//         </tr>`).join('');
// }



// // ─── Form submission ──────────────────────────────────────────────────────────
// document.getElementById('entry-form').addEventListener('submit', async e => {
//     e.preventDefault();

//     const checkIn  = document.getElementById('check-in').value;
//     const checkOut = document.getElementById('check-out').value;
//     // const hours    = calcHours(checkIn, checkOut);
//     const hours = calcHours(checkIn, checkOut).toFixed(2);


//     if (hours <= 0) {
//         alert('Check-out must be after check-in.');
//         return;
//     }

//     const entry = {
//         id:        Date.now().toString(),
//         date:      document.getElementById('date').value,
//         check_in:  checkIn,
//         check_out: checkOut,
//         hours,
//         note:      document.getElementById('note').value.trim(),
//         synced:    false,
//     };

//     await saveEntry(entry);
//     await renderEntries();

//     if (navigator.onLine) {
//         await syncToServer();
//     } else {
//         setStatus('offline');
//         // Register background sync so it fires when internet returns
//         if ('serviceWorker' in navigator) {
//             const reg = await navigator.serviceWorker.ready;
//             if ('sync' in reg) reg.sync.register('sync-entries');
//         }
//     }

//     e.target.reset();
//     document.getElementById('date').value = today();
// });

// // ─── Boot ─────────────────────────────────────────────────────────────────────
// document.addEventListener('DOMContentLoaded', async () => {
//     // Prefill today's date
//     document.getElementById('date').value = today();

//     // Initial render from local data
//     await renderEntries();

//     // Set initial status
//     setStatus(navigator.onLine ? 'syncing' : 'offline');
//     if (navigator.onLine) await syncToServer();

//     // Network change listeners
//     window.addEventListener('online',  () => syncToServer());
//     window.addEventListener('offline', () => setStatus('offline'));

//     // Listen for message from Service Worker (background sync trigger)
//     navigator.serviceWorker?.addEventListener('message', e => {
//         if (e.data?.type === 'DO_SYNC') syncToServer();
//     });

//     // Register Service Worker
//     if ('serviceWorker' in navigator) {
//         navigator.serviceWorker.register('/static/sw.js')
//             .then(reg => console.log('SW registered:', reg.scope))
//             .catch(err => console.warn('SW failed:', err));
//     }
// });