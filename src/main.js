import { fal } from "https://esm.sh/@fal-ai/client@latest";

// ============================================
// INDEXEDDB HELPER FOR BLOB STORAGE
// ============================================

class ModelStorage {
    constructor() {
        this.dbName = 'ARModelsDB';
        this.storeName = 'models';
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
        });
    }

    async saveModel(id, blob, metadata) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const data = { id, blob, metadata };
            const request = store.put(data);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getModel(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllModels() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

// Global storage instance
const modelStorage = new ModelStorage();

// ============================================
// GENERATION SCREEN LOGIC
// ============================================

class ModelGenerator {
    constructor() {
        this.selectedFile = null;
        this.generatedModelData = null;
        
        this.els = {
            genScreen: document.getElementById('generation-screen'),
            imageInput: document.getElementById('gen-image-input'),
            previewImage: document.getElementById('gen-preview-image'),
            uploadPlaceholder: document.getElementById('gen-upload-placeholder'),
            generateBtn: document.getElementById('gen-generate-btn'),
            logs: document.getElementById('gen-logs'),
            viewerPlaceholder: document.getElementById('gen-viewer-placeholder'),
            modelViewer: document.getElementById('gen-model-viewer'),
            loadingOverlay: document.getElementById('gen-loading-overlay'),
            loadingText: document.getElementById('gen-loading-text'),
            resultActions: document.getElementById('gen-result-actions'),
            downloadLink: document.getElementById('gen-download-link'),
            saveBtn: document.getElementById('gen-save-to-library-btn'),
            skipBtn: document.getElementById('gen-skip-btn')
        };

        this.init();
    }

    async init() {
        // Initialize IndexedDB
        try {
            await modelStorage.init();
            this.log('✓ Storage initialized', 'success');
        } catch (error) {
            this.log('⚠ Storage init failed: ' + error.message, 'error');
        }

        // Setup Fal.ai with API Key from environment
        const apiKey = import.meta.env.VITE_FAL_API_KEY;
        if (apiKey && apiKey !== 'your_fal_api_key_here') {
            fal.config({ credentials: apiKey });
            this.log('✓ API Key loaded from environment', 'success');
        } else {
            this.log('⚠ No API Key found in .env file', 'error');
            this.log('Please add VITE_FAL_API_KEY to your .env file', 'error');
        }

        // Event Listeners
        this.els.imageInput.addEventListener('change', (e) => this.handleImageSelect(e));
        this.els.generateBtn.addEventListener('click', () => this.generate3D());
        this.els.saveBtn.addEventListener('click', () => this.saveToLibraryAndStartAR());
        this.els.skipBtn.addEventListener('click', () => this.skipToAR());
    }

    handleImageSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.selectedFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                this.els.previewImage.src = e.target.result;
                this.els.previewImage.classList.remove('hidden');
                this.els.uploadPlaceholder.classList.add('hidden');
                this.els.generateBtn.disabled = false;
            };
            reader.readAsDataURL(file);
            this.log(`Image selected: ${file.name}`);
        }
    }

    log(message, type = 'info') {
        const line = document.createElement('div');
        line.className = 'gen-log-line';
        line.textContent = `> ${message}`;
        if (type === 'error') line.classList.add('gen-log-error');
        if (type === 'success') line.classList.add('gen-log-success');
        this.els.logs.appendChild(line);
        this.els.logs.scrollTop = this.els.logs.scrollHeight;
    }

    async generate3D() {
        if (!this.selectedFile) {
            alert("Please select an image first");
            return;
        }

        // UI Reset
        this.els.generateBtn.disabled = true;
        this.els.loadingOverlay.classList.remove('hidden');
        this.els.modelViewer.classList.add('hidden');
        this.els.viewerPlaceholder.classList.remove('hidden');
        this.els.resultActions.classList.add('hidden');
        this.els.logs.innerHTML = '';

        try {
            // 1. Upload Image
            this.els.loadingText.textContent = "Uploading Image...";
            this.log("Uploading image to Fal storage...");
            
            const imageUrl = await fal.storage.upload(this.selectedFile);
            this.log(`✓ Image uploaded successfully`, 'success');

            // 2. Submit to Seed3D
            this.els.loadingText.textContent = "Generating 3D Model...";
            this.log("Submitting to Seed3D model...");
            this.log("This may take 1-2 minutes...");

            const result = await fal.subscribe("fal-ai/bytedance/seed3d/image-to-3d", {
                input: {
                    image_url: imageUrl
                },
                logs: true,
                onQueueUpdate: (update) => {
                    if (update.status === "IN_PROGRESS" && update.logs) {
                        update.logs.map((l) => l.message).forEach(msg => this.log(msg));
                    }
                }
            });

            // 3. Handle Result
            this.log("✓ Generation complete!", "success");
            console.log("Result Data:", result.data);

            const modelData = result.data.model;
            
            if (modelData && modelData.url) {
                const zipUrl = modelData.url;
                
                // Store generated model data
                this.generatedModelData = {
                    zipUrl: zipUrl,
                    imageName: this.selectedFile.name,
                    timestamp: Date.now()
                };
                
                // Setup Download Link
                this.els.downloadLink.href = zipUrl;
                this.els.resultActions.classList.remove('hidden');
                this.els.resultActions.style.display = 'grid';
                
                // Attempt to visualize
                this.els.loadingText.textContent = "Loading preview...";
                this.log("Extracting model for preview...");
                
                await this.loadZipToViewer(zipUrl);
            } else {
                throw new Error("No model URL found in response.");
            }

        } catch (error) {
            console.error(error);
            this.log(`✗ Error: ${error.message || JSON.stringify(error)}`, 'error');
            alert("Generation failed. See logs for details.");
        } finally {
            this.els.loadingOverlay.classList.add('hidden');
            this.els.generateBtn.disabled = false;
        }
    }

    async loadZipToViewer(zipUrl) {
        try {
            this.log("Downloading ZIP file...");
            
            // Fetch with proper error handling
            const response = await fetch(zipUrl, {
                mode: 'cors',
                credentials: 'omit'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            this.log("✓ ZIP downloaded, extracting...");
            const blob = await response.blob();
            this.log(`✓ ZIP size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
            
            const zip = await JSZip.loadAsync(blob);
            this.log(`✓ ZIP loaded, scanning for 3D files...`);
            
            let modelFile = null;
            const fileList = [];
            
            // Find 3D file inside ZIP
            zip.forEach((relativePath, zipEntry) => {
                fileList.push(zipEntry.name);
                if (zipEntry.name.match(/\.(glb|gltf)$/i) && !modelFile) {
                    modelFile = zipEntry;
                }
            });

            this.log(`Found ${fileList.length} files in ZIP`);
            console.log('ZIP contents:', fileList);

            if (modelFile) {
                this.log(`✓ Found model: ${modelFile.name}`, 'success');
                
                // Extract as blob
                const modelBlob = await modelFile.async("blob");
                this.log(`✓ Model extracted: ${(modelBlob.size / 1024).toFixed(2)} KB`);
                
                // Create blob URL
                const modelUrl = URL.createObjectURL(modelBlob);
                
                // Store complete data for later use
                this.generatedModelData.modelBlob = modelBlob;
                this.generatedModelData.blobUrl = modelUrl;
                this.generatedModelData.fileName = modelFile.name;
                
                // Set to viewer with error handling
                this.els.modelViewer.addEventListener('load', () => {
                    this.log("✓ Preview loaded successfully!", "success");
                }, { once: true });
                
                this.els.modelViewer.addEventListener('error', (e) => {
                    this.log("⚠ Viewer error: " + e.message, 'error');
                    console.error('Model viewer error:', e);
                }, { once: true });
                
                this.els.modelViewer.src = modelUrl;
                this.els.viewerPlaceholder.classList.add('hidden');
                this.els.modelViewer.classList.remove('hidden');
                
            } else {
                this.log("⚠ No GLB/GLTF file found in ZIP.", 'error');
                this.log("Available files: " + fileList.join(', '), 'error');
                this.log("You can still download and save the model.");
                
                // Still allow saving even without preview
                // Store the entire ZIP for later conversion
                this.generatedModelData.zipBlob = blob;
            }

        } catch (err) {
            this.log(`✗ Preview failed: ${err.message}`, 'error');
            console.error('Full error:', err);
            
            if (err.message.includes('CORS')) {
                this.log("CORS policy blocked preview", 'error');
                this.log("The model can still be downloaded & saved", 'info');
            } else if (err.message.includes('HTTP')) {
                this.log("Network error - check connection", 'error');
            }
            
            // Allow download even if preview fails
            this.log("Download is still available below", 'info');
        }
    }

    async saveToLibraryAndStartAR() {
        if (!this.generatedModelData) {
            alert("No model to save. Please generate a model first.");
            return;
        }

        // Check if we have the model blob
        if (!this.generatedModelData.modelBlob && !this.generatedModelData.zipBlob) {
            alert("Model data not available. Please try downloading and generating again.");
            return;
        }

        this.log("Saving model to library...");

        try {
            // Generate unique ID
            const modelId = `generated_${Date.now()}`;
            const modelName = `Generated ${new Date().toLocaleString('id-ID', { 
                day: '2-digit', 
                month: 'short', 
                hour: '2-digit', 
                minute: '2-digit' 
            })}`;

            // Prepare metadata
            const metadata = {
                id: modelId,
                name: modelName,
                icon: '✨',
                isGenerated: true,
                timestamp: this.generatedModelData.timestamp,
                imageName: this.generatedModelData.imageName,
                fileName: this.generatedModelData.fileName,
                zipUrl: this.generatedModelData.zipUrl
            };

            // Save blob to IndexedDB
            const blobToSave = this.generatedModelData.modelBlob || this.generatedModelData.zipBlob;
            await modelStorage.saveModel(modelId, blobToSave, metadata);

            this.log(`✓ Model saved: ${modelName}`, 'success');
            
            // Also save reference to localStorage for quick lookup
            const savedRefs = JSON.parse(localStorage.getItem('generatedModelRefs') || '[]');
            savedRefs.push(metadata);
            localStorage.setItem('generatedModelRefs', JSON.stringify(savedRefs));

            this.log("✓ Model ready for AR!", 'success');
            
            // Proceed to AR
            setTimeout(() => {
                this.skipToAR();
            }, 500);

        } catch (error) {
            console.error('Save error:', error);
            this.log(`✗ Save failed: ${error.message}`, 'error');
            alert('Failed to save model. Check console for details.');
        }
    }

    skipToAR() {
        this.els.genScreen.style.display = 'none';
        document.getElementById('start-screen').style.display = 'block';
        
        // Initialize AR app
        if (!window.arApp) {
            window.arApp = new ARObjectPlacement();
        }
    }
}

// ============================================
// AR OBJECT PLACEMENT LOGIC
// ============================================

class ARObjectPlacement {
    constructor() {
        this.canvas = null;
        this.gl = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.session = null;
        this.referenceSpace = null;
        this.viewerSpace = null;
        this.hitTestSource = null;

        this.reticle = null;
        this.arObject = null;
        
        // Will be loaded asynchronously in init()
        this.availableModels = [];
        this.activeModelIndex = 0;

        this.placedObjects = [];
        this.selectedObject = null;
        this.objectIndex = 0;
        
        this.isUIInteraction = false;
        this.lastUIInteraction = 0;
        
        this.isDragging = false;
        this.touchStartX = 0;
        this.initialRotation = 0;
        this.startDist = 0;
        this.startScale = 1;

        this.raycaster = new THREE.Raycaster();
        this.highlightBox = null;

        // FPV Mode
        this.fpvMode = false;
        this.fpvObject = null;
        this.fpvOriginalScale = new THREE.Vector3();
        this.fpvOriginalPosition = new THREE.Vector3();
        this.fpvOriginalRotation = new THREE.Euler();
        this.fpvTargetScale = 20;
        this.baseMovementSpeed = 0.1;
        this.movementSpeedMultiplier = 1;
        
        this.playerHeight = 1.8;
        this.playerRadius = 0.5;
        this.collisionRaycaster = new THREE.Raycaster();

        this.moveVec = { x: 0, z: 0 };
        this.verticalSpeed = 0;
        this.joystick = null;
        
        this.init();
    }

    async loadAvailableModels() {
        // Default models
        const defaultModels = [
            { name: 'Tower House', url: 'tower_house_design.glb', icon: '🏠' },
            { name: 'Kitchen', url: 'interior-fix2.glb', icon: '🍳' },
            { name: 'Astronaut', url: 'Astronaut.glb', icon: '🧑‍🚀' },
            { name: '3 Bedroom House', url: '3 Bedroom house.glb', icon: '🏡' },
            { name: 'Apartment Floor Plan', url: 'Apartment.glb', icon: '🏢' },
            { name: 'Room', url: 'Room.glb', icon: '🚪' }
        ];

        try {
            // Load generated model references
            const savedRefs = JSON.parse(localStorage.getItem('generatedModelRefs') || '[]');
            
            // Load actual blobs from IndexedDB
            const generatedModels = [];
            for (const ref of savedRefs) {
                try {
                    const modelData = await modelStorage.getModel(ref.id);
                    if (modelData && modelData.blob) {
                        // Create blob URL from stored blob
                        const blobUrl = URL.createObjectURL(modelData.blob);
                        generatedModels.push({
                            ...ref,
                            url: blobUrl,
                            isGenerated: true
                        });
                    }
                } catch (err) {
                    console.error(`Failed to load model ${ref.id}:`, err);
                }
            }
            
            console.log(`Loaded ${generatedModels.length} generated models`);
            
            // Combine both
            return [...generatedModels, ...defaultModels];
            
        } catch (error) {
            console.error('Error loading models:', error);
            return defaultModels;
        }
    }
    
    async init() {
        this.initUI();
        await this.checkWebXRSupport();
        
        // Load models asynchronously (includes generated models from IndexedDB)
        this.availableModels = await this.loadAvailableModels();
        
        await this.loadModels();
        this.renderLibrary();
        this.createSelectionHighlight();
    }

    initUI() {
        document.getElementById('btn-start').onclick = () => this.startAR();
        document.getElementById('btn-exit').onclick = () => this.exitAR();
        document.getElementById('btn-reset').onclick = () => this.resetObjects();

        document.getElementById('btn-library').onclick = (e) => {
            e.stopPropagation();
            this.isUIInteraction = true;
            document.getElementById('library-drawer').classList.add('open');
        };
        document.getElementById('btn-close-lib').onclick = (e) => {
            e.stopPropagation();
            document.getElementById('library-drawer').classList.remove('open');
        };

        this.bindButton('btn-delete', () => this.deleteSelectedObject());
        this.bindButton('btn-deselect', () => this.deselectObject());
        this.bindButton('btn-fpv', () => this.enterFPVMode());
        document.getElementById('btn-exit-fpv').onclick = () => this.exitFPVMode();

        const setupHold = (id, val) => {
            const btn = document.getElementById(id);
            const start = (e) => { e.preventDefault(); this.verticalSpeed = val; };
            const end = (e) => { e.preventDefault(); this.verticalSpeed = 0; };
            btn.ontouchstart = start; btn.ontouchend = end;
            btn.onmousedown = start; btn.onmouseup = end;
        };
        setupHold('btn-up', 0.05);
        setupHold('btn-down', -0.05);

        const uiElements = document.querySelectorAll('.interactive, #library-drawer');
        uiElements.forEach(el => {
            el.addEventListener('touchstart', () => { this.isUIInteraction = true; this.lastUIInteraction = Date.now(); });
            el.addEventListener('touchend', () => { 
                this.lastUIInteraction = Date.now(); 
                setTimeout(() => { this.isUIInteraction = false; }, 200); 
            });
            el.addEventListener('click', (e) => { 
                e.stopPropagation(); 
                this.isUIInteraction = true; 
                this.lastUIInteraction = Date.now(); 
                setTimeout(() => { this.isUIInteraction = false; }, 200); 
            });
        });

        window.addEventListener('touchstart', (e) => this.onTouchStart(e), {passive: false});
        window.addEventListener('touchmove', (e) => this.onTouchMove(e), {passive: false});
        window.addEventListener('touchend', () => this.onTouchEnd());
    }

    bindButton(id, callback) {
        const btn = document.getElementById(id);
        if(btn) btn.onclick = (e) => { e.stopPropagation(); callback(); };
    }

    renderLibrary() {
        const container = document.getElementById('model-list-container');
        container.innerHTML = '';
        this.availableModels.forEach((model, index) => {
            const card = document.createElement('div');
            card.className = `model-card ${index === this.activeModelIndex ? 'active' : ''}`;
            card.innerHTML = `<span class="model-icon">${model.icon}</span><div class="model-name">${model.name}</div>`;
            card.onclick = (e) => { 
                e.stopPropagation(); 
                this.selectModelFromLibrary(index); 
            };
            container.appendChild(card);
        });
    }

    async selectModelFromLibrary(index) {
        this.activeModelIndex = index;
        const model = this.availableModels[index];
        this.renderLibrary();
        
        this.showToast(`Memuat ${model.name}...`);
        
        try {
            const loader = new THREE.GLTFLoader();
            await this.loadSpecificModel(loader, model.url);
            this.showToast(`${model.name} Siap!`);
            document.getElementById('library-drawer').classList.remove('open');
        } catch (e) {
            console.error(e);
            this.showToast('Gagal memuat model');
        }
    }

    showToast(msg) {
        const t = document.getElementById('toast');
        t.innerText = msg;
        t.style.opacity = 1;
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => t.style.opacity = 0, 3000);
    }

    createSelectionHighlight() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const edges = new THREE.EdgesGeometry(geometry);
        const material = new THREE.LineBasicMaterial({ 
            color: 0x00ff00, 
            linewidth: 2,
            transparent: true,
            opacity: 0.8
        });
        this.highlightBox = new THREE.LineSegments(edges, material);
        this.highlightBox.visible = false;
    }

    onTouchStart(e) {
        if (!this.selectedObject || this.fpvMode || this.isUIInteraction) return;
        this.isDragging = false; 
        if (e.touches.length === 2) {
            const dx = e.touches[0].pageX - e.touches[1].pageX;
            const dy = e.touches[0].pageY - e.touches[1].pageY;
            this.startDist = Math.hypot(dx, dy);
            this.startScale = this.selectedObject.scale.x;
        } else if (e.touches.length === 1) {
            this.touchStartX = e.touches[0].pageX;
            this.initialRotation = this.selectedObject.rotation.y;
        }
    }

    onTouchMove(e) {
        if (!this.selectedObject || this.fpvMode || this.isUIInteraction) return;
        
        if (e.touches.length === 2) {
            e.preventDefault(); 
            this.isDragging = true; 
            const dx = e.touches[0].pageX - e.touches[1].pageX;
            const dy = e.touches[0].pageY - e.touches[1].pageY;
            const currDist = Math.hypot(dx, dy);
            if (this.startDist > 0) {
                const scaleFactor = currDist / this.startDist;
                let newScale = this.startScale * scaleFactor;
                newScale = Math.max(0.1, Math.min(newScale, 5.0));
                this.selectedObject.scale.set(newScale, newScale, newScale);
                this.updateHighlightBox();
            }
        } else if (e.touches.length === 1) {
            const dx = e.touches[0].pageX - this.touchStartX;
            if (Math.abs(dx) > 10) {
                this.isDragging = true; 
                const sensitivity = 0.01;
                this.selectedObject.rotation.y = this.initialRotation + (dx * sensitivity);
                this.updateHighlightBox();
            }
        }
    }
    
    onTouchEnd() { 
        setTimeout(() => { this.isDragging = false; }, 100); 
    }

    async checkWebXRSupport() {
        const statusEl = document.getElementById('status-text');
        const startButton = document.getElementById('btn-start');
        
        if (!navigator.xr) {
            statusEl.innerText = 'WebXR tidak tersedia';
            return;
        }
        
        try {
            const supported = await navigator.xr.isSessionSupported('immersive-ar');
            if (supported) {
                statusEl.innerHTML = 'WebXR Siap.<br>Memuat aset...';
            } else {
                statusEl.innerText = 'AR tidak didukung';
            }
        } catch (error) {
            statusEl.innerText = 'Error WebXR';
        }
    }
    
    async loadModels() {
        const startButton = document.getElementById('btn-start');
        const statusEl = document.getElementById('status-text');

        try {
            const loader = new THREE.GLTFLoader();

            try {
                const reticleGltf = await this.loadGLTF(loader, 'https://immersive-web.github.io/webxr-samples/media/gltf/reticle/reticle.gltf');
                this.reticle = reticleGltf.scene;
            } catch (reticleError) {
                const ringGeometry = new THREE.RingGeometry(0.3, 0.4, 32);
                const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x007bff, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
                this.reticle = new THREE.Mesh(ringGeometry, ringMaterial);
            }
            this.reticle.visible = false;

            await this.loadSpecificModel(loader, this.availableModels[0].url);
            
            statusEl.innerText = 'Siap untuk AR';
            startButton.disabled = false;

        } catch (error) {
            console.error(error);
            statusEl.innerText = 'Gagal memuat model';
        }
    }

    async loadSpecificModel(loader, modelUrl) {
        try {
            const objectGltf = await this.loadGLTF(loader, modelUrl);
            this.arObject = objectGltf.scene;
            
            this.arObject.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material && child.material.map) {
                        child.material.map.encoding = THREE.sRGBEncoding;
                    }
                }
            });

            if(this.selectedObject) this.deselectObject();
        } catch (error) {
            throw error;
        }
    }
    
    loadGLTF(loader, url) {
        return new Promise((resolve, reject) => {
            loader.load(url, resolve, undefined, reject);
        });
    }
    
    async startAR() {
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('ar-root').style.display = 'block';

        try {
            this.canvas = document.createElement("canvas");
            document.body.appendChild(this.canvas);
            this.gl = this.canvas.getContext("webgl", { xrCompatible: true, alpha: true, antialias: true });
            
            this.scene = new THREE.Scene();
            
            const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
            dirLight.position.set(10, 15, 10);
            this.scene.add(dirLight);
            
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
            this.scene.add(ambientLight);
            
            this.scene.add(this.reticle);
            this.scene.add(this.highlightBox);
            
            this.renderer = new THREE.WebGLRenderer({
                alpha: true,
                preserveDrawingBuffer: true,
                canvas: this.canvas,
                context: this.gl,
                antialias: true
            });
            this.renderer.autoClear = false;
            this.renderer.outputEncoding = THREE.sRGBEncoding;
            
            this.camera = new THREE.PerspectiveCamera();
            this.camera.matrixAutoUpdate = false;
            
            this.session = await navigator.xr.requestSession("immersive-ar", {
                requiredFeatures: ['hit-test'],
                optionalFeatures: ['dom-overlay'],
                domOverlay: { root: document.getElementById('ar-root') }
            });
            
            this.session.updateRenderState({ baseLayer: new XRWebGLLayer(this.session, this.gl) });
            
            this.referenceSpace = await this.session.requestReferenceSpace('local');
            this.viewerSpace = await this.session.requestReferenceSpace('viewer');
            
            this.hitTestSource = await this.session.requestHitTestSource({ space: this.viewerSpace });
            
            this.session.addEventListener('end', () => this.onSessionEnded());
            this.session.addEventListener('select', (event) => this.onSelect(event));
            
            this.session.requestAnimationFrame((time, frame) => this.onXRFrame(time, frame));
            
            document.getElementById('standard-ui').style.pointerEvents = 'auto';
            this.showToast('Pindai area lantai...');
            
        } catch (error) {
            alert('Gagal memulai AR: ' + error.message);
            this.exitAR();
        }
    }
    
    onXRFrame(time, frame) {
        this.session.requestAnimationFrame((time, frame) => this.onXRFrame(time, frame));
        
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.session.renderState.baseLayer.framebuffer);
        
        const pose = frame.getViewerPose(this.referenceSpace);
        
        if (pose) {
            this.renderer.clear();
            
            if (!this.fpvMode) {
                this.handleHitTest(frame);
            } else {
                this.fpvObject.updateMatrixWorld(true); 
                this.handleFPVMovement(pose);
            }
            
            for (const view of pose.views) {
                const viewport = this.session.renderState.baseLayer.getViewport(view);
                this.renderer.setSize(viewport.width, viewport.height);
                this.camera.matrix.fromArray(view.transform.matrix);
                this.camera.projectionMatrix.fromArray(view.projectionMatrix);
                this.camera.updateMatrixWorld(true);
                this.renderer.render(this.scene, this.camera);
            }
        }
    }

    handleFPVMovement(pose) {
        if (!this.fpvObject) return;

        const moveSpeed = this.baseMovementSpeed * this.movementSpeedMultiplier;
        
        const view = pose.views[0];
        const cameraMatrix = new THREE.Matrix4().fromArray(view.transform.matrix);
        
        const forward = new THREE.Vector3(0, 0, -1).applyMatrix4(cameraMatrix);
        const right = new THREE.Vector3(1, 0, 0).applyMatrix4(cameraMatrix);
        
        forward.y = 0; forward.normalize();
        right.y = 0; right.normalize();

        const desiredMovement = new THREE.Vector3();
        
        if (Math.abs(this.moveVec.z) > 0.1) {
            const speedZ = this.moveVec.z * moveSpeed;
            desiredMovement.sub(forward.clone().multiplyScalar(speedZ));
        }
        if (Math.abs(this.moveVec.x) > 0.1) {
            const speedX = this.moveVec.x * moveSpeed;
            desiredMovement.sub(right.clone().multiplyScalar(speedX));
        }

        if (this.verticalSpeed !== 0) {
            desiredMovement.y -= this.verticalSpeed;
        }

        const adjustedMovement = this.checkFPVCollisions(desiredMovement);
        this.fpvObject.position.add(adjustedMovement);
    }
    
    handleHitTest(frame) {
        if (!this.hitTestSource || !this.reticle) return;
        const hitTestResults = frame.getHitTestResults(this.hitTestSource);
        if (hitTestResults.length > 0) {
            const hitPose = hitTestResults[0].getPose(this.referenceSpace);
            if (hitPose) {
                this.reticle.visible = true;
                this.reticle.position.copy(hitPose.transform.position);
                this.reticle.updateMatrixWorld(true);
            }
        } else {
            this.reticle.visible = false;
        }
    }
    
    onSelect(event) {
        if (this.isUIInteraction || this.isDragging || this.fpvMode) return;

        const frame = event.frame;
        const inputSource = event.inputSource;
        
        if (inputSource && frame && inputSource.targetRaySpace) {
            const pose = frame.getPose(inputSource.targetRaySpace, this.referenceSpace);
            if (pose) {
                const origin = new THREE.Vector3(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
                const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(
                    pose.transform.orientation.x, pose.transform.orientation.y, pose.transform.orientation.z, pose.transform.orientation.w
                ));
                
                this.raycaster.set(origin, direction);
                const intersects = this.raycaster.intersectObjects(this.placedObjects, true);
                
                if (intersects.length > 0) {
                    let selectedObj = intersects[0].object;
                    while (selectedObj.parent && !this.placedObjects.includes(selectedObj)) {
                        selectedObj = selectedObj.parent;
                    }
                    if (this.placedObjects.includes(selectedObj)) {
                        this.selectObject(selectedObj);
                        return;
                    }
                }
            }
        }
        
        if (this.reticle.visible && this.arObject && !this.selectedObject) {
            this.placeObject();
        } else if (this.selectedObject) {
            this.deselectObject();
        }
    }

    placeObject() {
        if (!this.arObject) return;

        const rawModel = this.arObject.clone();
        
        const box = new THREE.Box3().setFromObject(rawModel);
        const center = new THREE.Vector3();
        box.getCenter(center);
        
        const pivotGroup = new THREE.Group();
        
        rawModel.position.x = -center.x;
        rawModel.position.y = -box.min.y;
        rawModel.position.z = -center.z;
        
        pivotGroup.add(rawModel);

        pivotGroup.position.copy(this.reticle.position);
        pivotGroup.rotation.y = 0;
        pivotGroup.scale.set(1, 1, 1);
        
        pivotGroup.userData.objectId = this.objectIndex++;
        
        this.scene.add(pivotGroup);
        this.placedObjects.push(pivotGroup);
        this.selectObject(pivotGroup);
    }

    selectObject(object) {
        this.selectedObject = object;
        this.updateHighlightBox();
        document.getElementById('action-bar').style.display = 'flex';
        document.getElementById('idle-menu').style.display = 'none';
        this.showToast("1 Jari: Putar | 2 Jari: Cubit");
    }

    updateHighlightBox() {
        if (!this.selectedObject || !this.highlightBox) return;
        const box = new THREE.Box3().setFromObject(this.selectedObject);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        this.highlightBox.scale.copy(size);
        this.highlightBox.position.copy(center);
        this.highlightBox.visible = true;
    }

    deselectObject() {
        this.selectedObject = null;
        this.highlightBox.visible = false;
        document.getElementById('action-bar').style.display = 'none';
        document.getElementById('idle-menu').style.display = 'flex';
        this.showToast("Ketuk lantai untuk menempatkan");
    }

    deleteSelectedObject() {
        if (!this.selectedObject) return;
        this.scene.remove(this.selectedObject);
        const index = this.placedObjects.indexOf(this.selectedObject);
        if (index > -1) this.placedObjects.splice(index, 1);
        this.deselectObject();
        this.showToast("Objek dihapus");
    }

    enterFPVMode() {
        if (!this.selectedObject) return;

        this.fpvMode = true;
        this.fpvObject = this.selectedObject;

        this.fpvOriginalScale.copy(this.fpvObject.scale);
        this.fpvOriginalPosition.copy(this.fpvObject.position);
        this.fpvOriginalRotation.copy(this.fpvObject.rotation);

        const targetScale = this.fpvOriginalScale.x * this.fpvTargetScale;
        this.fpvObject.scale.set(targetScale, targetScale, targetScale);
        this.fpvObject.updateMatrixWorld(true);
        
        this.fpvObject.position.set(0, -this.playerHeight, 0);
        this.fpvObject.updateMatrixWorld(true);

        this.reticle.visible = false;
        this.highlightBox.visible = false;
        
        document.getElementById('standard-ui').style.display = 'none';
        document.getElementById('standard-ui').style.pointerEvents = 'none';

        document.getElementById('fpv-ui').style.display = 'block';
        document.getElementById('fpv-ui').style.pointerEvents = 'auto';

        const zone = document.getElementById('joystick-zone');
        if (this.joystick) this.joystick.destroy(); 
        
        this.joystick = nipplejs.create({
            zone: zone,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'white'
        });

        this.joystick.on('move', (evt, data) => {
            if (data.vector) {
                this.moveVec.z = data.vector.y;
                this.moveVec.x = data.vector.x;
            }
        });

        this.joystick.on('end', () => {
            this.moveVec = { x: 0, z: 0 };
        });
        
        this.showToast("Mode FPV Aktif");
    }

    exitFPVMode() {
        if (!this.fpvMode) return;

        this.fpvMode = false;
        if (this.fpvObject) {
            this.fpvObject.scale.copy(this.fpvOriginalScale);
            this.fpvObject.position.copy(this.fpvOriginalPosition);
            this.fpvObject.rotation.copy(this.fpvOriginalRotation);
        }

        this.moveVec = { x: 0, z: 0 };
        this.verticalSpeed = 0;
        this.fpvObject = null;

        if (this.joystick) {
            this.joystick.destroy();
            this.joystick = null;
        }

        document.getElementById('standard-ui').style.display = 'flex';
        document.getElementById('standard-ui').style.pointerEvents = 'auto';

        document.getElementById('fpv-ui').style.display = 'none';
        document.getElementById('fpv-ui').style.pointerEvents = 'none';
        
        this.showToast("Keluar dari FPV");
    }
    
    checkFPVCollisions(movementVector) {
        const finalMovement = movementVector.clone();
        if (!this.fpvObject || finalMovement.lengthSq() === 0) return finalMovement;

        const collisionObjects = [];
        if (this.fpvMode) {
            this.fpvObject.traverse(child => {
                if (child.isMesh) {
                    collisionObjects.push(child);
                }
            });
        }

        if (collisionObjects.length === 0) return finalMovement;

        const playerPos = new THREE.Vector3(0, 0, 0);
        let adjustedMovement = finalMovement.clone();
        const invertedMovement = finalMovement.clone().negate();

        const horizontalMovementAttempt = new THREE.Vector3(invertedMovement.x, 0, invertedMovement.z);
        if (horizontalMovementAttempt.lengthSq() > 0) {
            const horizontalDirection = horizontalMovementAttempt.clone().normalize();
            const rays = [
                horizontalDirection,
                horizontalDirection.clone().applyAxisAngle(new THREE.Vector3(0,1,0), Math.PI / 4),
                horizontalDirection.clone().applyAxisAngle(new THREE.Vector3(0,1,0), -Math.PI / 4)
            ];

            let collisionDetected = false;
            for (const ray of rays) {
                this.collisionRaycaster.set(playerPos, ray);
                this.collisionRaycaster.near = 0;
                this.collisionRaycaster.far = this.playerRadius + horizontalMovementAttempt.length(); 

                const intersects = this.collisionRaycaster.intersectObjects(collisionObjects, true);
                if (intersects.length > 0) {
                    const firstHit = intersects[0];
                    if (firstHit.distance < this.playerRadius) {
                        collisionDetected = true;
                        break;
                    }
                    if (firstHit.distance < horizontalMovementAttempt.length() + this.playerRadius) {
                        if (firstHit.face) {
                            const hitNormal = firstHit.face.normal;
                            hitNormal.y = 0;
                            hitNormal.normalize();

                            const slideDirection = horizontalMovementAttempt.clone().projectOnPlane(hitNormal);
                            if (slideDirection.lengthSq() > 0) {
                                const invertedSlide = slideDirection.negate();
                                adjustedMovement.x = invertedSlide.x;
                                adjustedMovement.z = invertedSlide.z;
                            } else {
                                adjustedMovement.x = 0;
                                adjustedMovement.z = 0;
                            }
                        } else {
                            adjustedMovement.x = 0;
                            adjustedMovement.z = 0;
                        }
                        collisionDetected = true;
                        break;
                    }
                }
            }

            if (collisionDetected) {
                finalMovement.x = adjustedMovement.x;
                finalMovement.z = adjustedMovement.z;
            }
        }

        const verticalMovementAttempt = invertedMovement.y;
        if (Math.abs(verticalMovementAttempt) > 0) {
            const headPos = playerPos.clone().add(new THREE.Vector3(0, this.playerHeight / 2 - this.playerRadius / 2, 0));
            const feetPos = playerPos.clone().add(new THREE.Vector3(0, -this.playerHeight / 2 + this.playerRadius / 2, 0));
            
            if (verticalMovementAttempt > 0) { 
                this.collisionRaycaster.set(headPos, new THREE.Vector3(0, 1, 0));
                this.collisionRaycaster.near = 0;
                this.collisionRaycaster.far = verticalMovementAttempt + this.playerRadius;
                const ceilHits = this.collisionRaycaster.intersectObjects(collisionObjects, true);
                if (ceilHits.length > 0) finalMovement.y = 0;
            }
            else if (verticalMovementAttempt < 0) {
                this.collisionRaycaster.set(feetPos, new THREE.Vector3(0, -1, 0));
                this.collisionRaycaster.near = 0;
                this.collisionRaycaster.far = Math.abs(verticalMovementAttempt) + this.playerRadius;
                const groundHits = this.collisionRaycaster.intersectObjects(collisionObjects, true);
                if (groundHits.length > 0) finalMovement.y = 0;
            }
        }

        return finalMovement;
    }

    resetObjects() {
        if (this.fpvMode) this.exitFPVMode();
        this.placedObjects.forEach(o => this.scene.remove(o));
        this.placedObjects = [];
        this.deselectObject();
        this.showToast("Area dibersihkan");
    }
    
    async exitAR() {
        if (this.session) await this.session.end();
    }
    
    onSessionEnded() {
        this.cleanup();
        document.getElementById('ar-root').style.display = 'none';
        document.getElementById('start-screen').style.display = 'block';
        console.log('AR session ended');
    }
    
    cleanup() {
        if (this.hitTestSource) {
            this.hitTestSource.cancel();
            this.hitTestSource = null;
        }
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
            this.canvas = null;
        }
        this.session = null;
        this.gl = null;
        this.renderer = null;
        this.fpvMode = false;
        this.fpvObject = null;
    }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Start with Generation Screen
    new ModelGenerator();
});