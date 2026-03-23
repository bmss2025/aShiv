const DB_NAME = "HeritageDB";
const STORE_NAME = "archive";
let db;

// Open (or create) the database
const request = indexedDB.open(DB_NAME, 1);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
    }
};

request.onsuccess = (e) => {
    db = e.target.result;
    renderArchive(); // Initial render once DB is ready
};

// --- Function to Save a Card ---
function saveToDB(card) {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(card);
    return tx.complete;
}

// --- Function to Get All Cards ---
function getAllFromDB(callback) {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => callback(request.result);
}

// --- Function to Delete a Card ---
function deleteFromDB(id, callback) {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => callback();
}