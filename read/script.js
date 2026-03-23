import { reverseTransliterate } from './modules/ime/reverse.js';

/* --- 2. Database Configuration --- */
const DB_NAME = "HeritageLanguageDB";
const STORE_NAME = "archive";
const DB_VERSION = 1;
let db;

let mediaRecorder;
let audioChunks = [];
let finalAudioBlob = null;

// --- Slider Navigation Logic ---
const slider = document.getElementById('archiveSlider');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');

if (nextBtn && prevBtn && slider) {
    const getScrollStep = () => {
        const card = slider.querySelector('.card');
        if (!card) return 0;
        
        const style = window.getComputedStyle(slider);
        const gap = parseInt(style.gap) || 0;
        return card.offsetWidth + gap;
    };

    nextBtn.onclick = () => {
        slider.scrollBy({ left: getScrollStep(), behavior: 'smooth' });
    };

    prevBtn.onclick = () => {
        slider.scrollBy({ left: -getScrollStep(), behavior: 'smooth' });
    };

    slider.onscroll = () => {
        prevBtn.style.display = slider.scrollLeft <= 5 ? "none" : "flex";
        const maxScroll = slider.scrollWidth - slider.clientWidth;
        nextBtn.style.display = slider.scrollLeft >= maxScroll - 5 ? "none" : "flex";
    };
}

/* --- 3. Initialize Database --- */
const request = indexedDB.open(DB_NAME, DB_VERSION);

request.onupgradeneeded = (e) => {
    const dbInstance = e.target.result;
    if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: "id" });
    }
};

request.onsuccess = (e) => {
    db = e.target.result;
    renderArchive();
};

document.addEventListener('DOMContentLoaded', () => {
    const captureBtn = document.getElementById('captureAction');
    const heritageInput = document.getElementById('heritageInput');
    const transInput = document.getElementById('transInput');
    const imageInput = document.getElementById('imageInput');

    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    
    if (SpeechRecognition && captureBtn) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'bn-BD';
        recognition.interimResults = false;

        captureBtn.onclick = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                audioChunks = [];

                mediaRecorder.ondataavailable = e => {
                    if (e.data.size > 0) audioChunks.push(e.data);
                };

                mediaRecorder.onstop = () => {
                    finalAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    
                    const audioUrl = URL.createObjectURL(finalAudioBlob);
                    const playback = new Audio(audioUrl);
                    
                    playback.play().catch(err => console.error("Playback failed:", err));
                    
                    playback.onended = () => URL.revokeObjectURL(audioUrl);
                };

                mediaRecorder.start();
                recognition.start();

                captureBtn.innerText = "Listening...";
                captureBtn.classList.add('active-rec');
            } catch (err) {
                console.error(err);
                alert("Mic access denied. If you are testing locally, you MUST use a local server (Live Server) or HTTPS.");
            }
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            heritageInput.value = transcript.toLowerCase().replace('.', '').trim();
            transInput.value = ""; 
            heritageInput.focus();

            if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
            captureBtn.innerText = "Speak to Transliterate";
            captureBtn.classList.remove('active-rec');
        };
        
        recognition.onerror = () => {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
            captureBtn.innerText = "Speak to Transliterate";
            captureBtn.classList.remove('active-rec');
        };
    }

    // --- Transliteration Logic ---
    heritageInput.oninput = (e) => {
        transInput.value = reverseTransliterate(e.target.value);
    };
    
    transInput.oninput = (e) => {
        const cursor = e.target.selectionStart;
        const converted = reverseTransliterate(e.target.value);
        if (converted !== e.target.value) {
            e.target.value = converted;
            e.target.setSelectionRange(cursor, cursor);
        }
    };

    // --- Image Processing (Full Image / Proportional) ---
    imageInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    ctx.drawImage(img, 0, 0);
                    
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    const previewContainer = document.getElementById('previewContainer');
                    previewContainer.innerHTML = `<img src="${dataUrl}" style="max-width: 100%; height: auto; border-radius: 8px;">`;
					previewContainer.classList.add('visible');
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    // --- Save Logic ---
    document.getElementById('saveCard').onclick = () => {
        const img = document.querySelector('#previewContainer img');
        const previewContainer = document.getElementById('previewContainer'); // Define it here
        
        if (!img || !finalAudioBlob || !heritageInput.value) return alert("Fill all fields!");

        const reader = new FileReader();
        reader.onload = () => {
            const card = {
                id: Date.now(),
                image: img.src,
                audio: reader.result,
                transliteration: heritageInput.value,
                heritage: transInput.value
            };

            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).add(card).onsuccess = () => {

                heritageInput.value = "";
                transInput.value = "";
                imageInput.value = "";
                
                previewContainer.innerHTML = "";
                previewContainer.classList.remove('visible'); 
                
                finalAudioBlob = null;
                renderArchive();
            };
        };
        reader.readAsDataURL(finalAudioBlob);
    };
	
	// --- RESTORED: Backup, Restore & Clear Logic ---
    if (downloadBtn) {
        downloadBtn.onclick = () => {
            const tx = db.transaction(STORE_NAME, "readonly");
            tx.objectStore(STORE_NAME).getAll().onsuccess = (e) => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(e.target.result));
                const dl = document.createElement('a');
                dl.setAttribute("href", dataStr);
                dl.setAttribute("download", `heritage_backup_${Date.now()}.json`);
                dl.click();
            };
        };
    }

    if (restoreInput) {
        restoreInput.onchange = (e) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const imported = JSON.parse(event.target.result);
                const tx = db.transaction(STORE_NAME, "readwrite");
                const store = tx.objectStore(STORE_NAME);
                imported.forEach(item => store.put(item));
                tx.oncomplete = () => {
                    alert("Archive Restored!");
                    renderArchive();
                };
            };
            reader.readAsText(e.target.files[0]);
        };
    }

    if (clearDbBtn) {
        clearDbBtn.onclick = () => {
            if (confirm("Permanently wipe archive? This cannot be undone.")) {
                const tx = db.transaction(STORE_NAME, "readwrite");
                tx.objectStore(STORE_NAME).clear().onsuccess = () => renderArchive();
            }
        };
    }
});

/* --- 4. Global Helpers (Bridged for HTML) --- */
window.renderArchive = function() {
    if (!db) return;
    const tx = db.transaction(STORE_NAME, "readonly");
    tx.objectStore(STORE_NAME).getAll().onsuccess = (e) => {
        const items = e.target.result;
        const container = document.getElementById('archiveSlider');
        if (!container) return;
        
        container.innerHTML = items.map(card => {
            const vernacular = card.heritage ? ` (${card.heritage})` : "";
            const displayLabel = `${card.transliteration}${vernacular}`;

            return `
                <div class="card">
                    <img src="${card.image}">
                    <div class="script-display" onclick="toggleScript(${card.id})">
                        ${displayLabel}
                    </div>
                    <div class="card-actions">
                        <button class="play-btn" onclick="playAudio('${card.audio}')">
                            <i class="fa-solid fa-volume-high"></i>
                        </button>
                        <button class="delete-btn" onclick="deleteCard(${card.id})">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    };
};

window.playAudio = (src) => {
    if (src) new Audio(src).play();
};

window.toggleScript = (id) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    store.get(id).onsuccess = (e) => {
        const card = e.target.result;
        window.playAudio(card.audio);
    };
};

window.deleteCard = (id) => {
    if(confirm("Delete this entry?")) {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(id).onsuccess = () => renderArchive();
    }
};