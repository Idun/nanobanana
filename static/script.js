
document.addEventListener('DOMContentLoaded', async () => {
    // --- 元素获取 ---
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const body = document.body;
    
    // 新的选择器元素
    const modelscopeSelect = document.getElementById('modelscope-select');
    const nanobananaBtn = document.getElementById('nanobanana-btn');
    const downloadBtn = document.getElementById('download-btn');

    const nanobananaControls = document.getElementById('nanobanana-controls');
    const modelscopeControls = document.getElementById('modelscope-controls');
    const apiKeyOpenRouterInput = document.getElementById('api-key-input-openrouter');
    const apiKeyModelScopeInput = document.getElementById('api-key-input-modelscope');
    const generateBtns = document.querySelectorAll('.generate-btn');

    const countButtons = document.querySelectorAll('.count-btn');
    const mainResultImageContainer = document.getElementById('main-result-image');
    const resultThumbnailsContainer = document.getElementById('result-thumbnails');
    
    const nanobananaPromptRemark = document.getElementById('nanobanana-prompt-remark');
    const modelscopePromptRemark = document.getElementById('modelscope-prompt-remark');
    const modelscopeNegativePromptRemark = document.getElementById('modelscope-negative-prompt-remark');

    const fullscreenModal = document.getElementById('fullscreen-modal');
    const modalImage = document.getElementById('modal-image');
    const closeModalBtn = document.querySelector('.close-btn');

    const uploadArea = document.querySelector('.upload-area');
    const fileInput = document.getElementById('image-upload');
    const thumbnailsContainer = document.getElementById('thumbnails-container');
    const promptNanoBananaInput = document.getElementById('prompt-input-nanobanana');

    const promptPositiveInput = document.getElementById('prompt-input-positive');
    const promptNegativeInput = document.getElementById('prompt-input-negative');
    const sizeSelect = document.getElementById('size-select');
    const stepsInput = document.getElementById('steps-input');
    const guidanceInput = document.getElementById('guidance-input');
    const seedInput = document.getElementById('seed-input');

    // --- 状态变量 ---
    let selectedFiles = [];
    let currentModel = modelscopeSelect.value; // 默认使用下拉框的第一个值
    let currentModelType = 'modelscope'; // 'modelscope' 或 'nanobanana'
    
    // 收集所有模型ID以初始化状态
    const allModelIds = Array.from(modelscopeSelect.options).map(opt => opt.value);
    allModelIds.push('nanobanana');

    const modelStates = {};
    allModelIds.forEach(modelId => {
        modelStates[modelId] = {
            inputs: {
                prompt: '',
                negative_prompt: '',
                size: '1328x1328',
                steps: 30,
                guidance: 3.5,
                seed: -1,
                count: 1,
                files: []
            },
            task: {
                isRunning: false,
                statusText: ''
            },
            results: []
        };
    });

    // --- 初始化函数 ---
    function initialize() {
        setupTheme();
        
        // 初始高亮设置
        modelscopeSelect.parentElement.classList.add('active');
        nanobananaBtn.classList.remove('active');
        
        loadStateForCurrentModel();
        setupInputValidation();
        setupModalListeners();
        setupModelSelectionListeners();
        setupDownloadButton();
        
        fetch('/api/key-status').then(res => res.json()).then(data => {
            if (data.isSet) { apiKeyOpenRouterInput.parentElement.style.display = 'none'; }
        }).catch(error => console.error("无法检查 OpenRouter API key 状态:", error));

        fetch('/api/modelscope-key-status').then(res => res.json()).then(data => {
            if (data.isSet) { apiKeyModelScopeInput.parentElement.style.display = 'none'; }
        }).catch(error => console.error("无法检查 ModelScope API key 状态:", error));
    }

    function setupModelSelectionListeners() {
        // 下拉框变更事件
        modelscopeSelect.addEventListener('change', (e) => {
            saveStateForModel(currentModel);
            currentModel = e.target.value;
            currentModelType = 'modelscope';
            
            // 样式切换
            modelscopeSelect.parentElement.classList.add('active');
            nanobananaBtn.classList.remove('active');
            
            loadStateForCurrentModel();
        });

        // Nano Banana 按钮点击事件
        nanobananaBtn.addEventListener('click', () => {
            if (currentModelType === 'nanobanana') return; // 已经是当前选中状态

            saveStateForModel(currentModel);
            currentModel = 'nanobanana';
            currentModelType = 'nanobanana';

            // 样式切换
            nanobananaBtn.classList.add('active');
            modelscopeSelect.parentElement.classList.remove('active');

            loadStateForCurrentModel();
        });
    }

    function setupDownloadButton() {
        downloadBtn.addEventListener('click', async () => {
            const imgElement = mainResultImageContainer.querySelector('img');
            if (!imgElement) return;

            const imageUrl = imgElement.src;
            try {
                downloadBtn.disabled = true;
                downloadBtn.textContent = '下载中...';
                
                // 使用 fetch 获取 blob 以避免跨域直接下载的问题
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                
                const link = document.createElement('a');
                link.href = blobUrl;
                
                // 尝试从 URL 或 Header 获取文件名，这里简单使用时间戳
                const extension = blob.type.split('/')[1] || 'png';
                link.download = `generated-${Date.now()}.${extension}`;
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(blobUrl);
            } catch (err) {
                console.error('下载失败:', err);
                alert('下载图片失败，请尝试右键保存。');
            } finally {
                downloadBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> 下载图片';
                downloadBtn.disabled = false;
            }
        });
    }
    
    function saveStateForModel(modelId) {
        const state = modelStates[modelId];
        if (!state) return;
        
        if (modelId === 'nanobanana') {
            state.inputs.prompt = promptNanoBananaInput.value;
            state.inputs.files = selectedFiles;
        } else {
            state.inputs.prompt = promptPositiveInput.value;
            state.inputs.negative_prompt = promptNegativeInput.value;
            state.inputs.size = sizeSelect.value;
            state.inputs.steps = parseInt(stepsInput.value, 10);
            state.inputs.guidance = parseFloat(guidanceInput.value);
            state.inputs.seed = parseInt(seedInput.value, 10);
            state.inputs.count = parseInt(modelscopeControls.querySelector('.count-btn.active').dataset.count, 10);
        }
    }

    function loadStateForCurrentModel() {
        const state = modelStates[currentModel];
        if (!state) return;
        
        updateActiveModelUI();
        
        if (currentModel === 'nanobanana') {
            promptNanoBananaInput.value = state.inputs.prompt;
            selectedFiles = state.inputs.files;
            thumbnailsContainer.innerHTML = '';
            selectedFiles.forEach(createThumbnail);
        } else {
            promptPositiveInput.value = state.inputs.prompt;
            promptNegativeInput.value = state.inputs.negative_prompt;
            sizeSelect.value = state.inputs.size;
            stepsInput.value = state.inputs.steps;
            guidanceInput.value = state.inputs.guidance;
            seedInput.value = state.inputs.seed;
            countButtons.forEach(btn => {
                btn.classList.toggle('active', parseInt(btn.dataset.count, 10) === state.inputs.count);
            });
        }
        
        if (state.task.isRunning) {
            updateResultStatusWithSpinner(state.task.statusText || '正在生成中...');
        } else if (state.results.length > 0) {
            displayResults(state.results);
        } else {
            clearResults();
        }
        
        updateGenerateButtonState();
    }


    function clearResults() { 
        mainResultImageContainer.innerHTML = `<p>生成的图片将显示在这里</p>`; 
        resultThumbnailsContainer.innerHTML = ''; 
        downloadBtn.classList.add('hidden');
    }
    
    function setupModalListeners() {
        closeModalBtn.onclick = () => { fullscreenModal.classList.add('hidden'); };
        fullscreenModal.onclick = (e) => { if (e.target === fullscreenModal) { fullscreenModal.classList.add('hidden'); } };
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !fullscreenModal.classList.contains('hidden')) { fullscreenModal.classList.add('hidden'); } });
    }

    function openModal(imageUrl) { modalImage.src = imageUrl; fullscreenModal.classList.remove('hidden'); }
    
    function setupTheme() {
        function applyTheme(theme) { body.className = theme + '-mode'; localStorage.setItem('theme', theme); }
        themeToggleBtn.addEventListener('click', () => { const newTheme = body.classList.contains('dark-mode') ? 'light' : 'dark'; applyTheme(newTheme); });
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme) { applyTheme(savedTheme); } else if (prefersDark) { applyTheme('dark'); } else { applyTheme('light'); }
    }
    

    function updateActiveModelUI() {
        if (currentModel === 'nanobanana') { 
            nanobananaControls.classList.remove('hidden'); 
            modelscopeControls.classList.add('hidden'); 
            nanobananaPromptRemark.textContent = '(支持中文提示词)'; 
        } else { 
            nanobananaControls.classList.add('hidden'); 
            modelscopeControls.classList.remove('hidden'); 
            
            nanobananaPromptRemark.textContent = ''; 
            modelscopePromptRemark.textContent = ''; 
            modelscopeNegativePromptRemark.textContent = '';

            let remarkText = ''; 
            // 检查模型 ID 或其显示文本来决定提示词
            // Qwen-Edit (ID 包含 Qwen-Image-Edit) 和 Z-Turbo (ID 包含 Z-Image-Turbo) 和 Qwen-Image
            if (currentModel.includes('Qwen') || currentModel.includes('Z-Image-Turbo')) {
                remarkText = '(支持中文提示词)';
            } else if (currentModel.includes('FLUX') || currentModel.includes('Kontext') || currentModel.includes('Krea')) { 
                remarkText = '(请使用英文提示词)'; 
            } 
            
            modelscopePromptRemark.textContent = remarkText; 
            modelscopeNegativePromptRemark.textContent = remarkText; 
        }
    }
    
    function setupInputValidation() {
        const inputsToValidate = [stepsInput, guidanceInput, seedInput];
        inputsToValidate.forEach(input => {
            input.addEventListener('input', () => validateInput(input));
            if (input.id === 'seed-input') { input.addEventListener('change', () => validateInput(input)); }
        });
    }

    function validateInput(inputElement) {
        const min = inputElement.dataset.min ? parseFloat(inputElement.dataset.min) : null;
        const max = inputElement.dataset.max ? parseFloat(inputElement.dataset.max) : null;
        const value = inputElement.value;
        const errorMessageElement = inputElement.nextElementSibling;
        if (value === '') { errorMessageElement.classList.add('hidden'); inputElement.classList.remove('input-error'); return true; }
        const numValue = parseFloat(value);
        let isValid = true;
        let errorMessage = '';
        if (min !== null && numValue < min) { isValid = false; errorMessage = max !== null ? `值必须在 ${min} 和 ${max} 之间` : `值必须大于等于 ${min}`; } 
        else if (max !== null && numValue > max) { isValid = false; errorMessage = `值必须在 ${min} 和 ${max} 之间`; }
        if (inputElement.step === "1" || !inputElement.step) { if (!Number.isInteger(numValue)) { isValid = false; errorMessage = '请输入一个整数'; } }
        if (isValid) { errorMessageElement.classList.add('hidden'); errorMessageElement.textContent = ''; inputElement.classList.remove('input-error'); } 
        else { errorMessageElement.classList.remove('hidden'); errorMessageElement.textContent = errorMessage; inputElement.classList.add('input-error'); }
        return isValid;
    }

    function updateGenerateButtonState() {
        const isTaskRunning = modelStates[currentModel].task.isRunning;
        const currentPanel = (currentModel === 'nanobanana') ? nanobananaControls : modelscopeControls;
        const currentButton = currentPanel.querySelector('.generate-btn');
        const btnText = currentButton.querySelector('.btn-text');
        const spinner = currentButton.querySelector('.spinner');
        setLoading(isTaskRunning, currentButton, btnText, spinner);
    }


    countButtons.forEach(button => {
        button.addEventListener('click', () => {
            countButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });
    
    // window.addEventListener('resize', setUniformButtonWidth); // 不再需要统一宽度逻辑

    generateBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const modelToGenerate = currentModel;
            if (modelStates[modelToGenerate].task.isRunning) {
                alert('当前模型有任务正在生成中，请稍候...');
                return;
            }
            saveStateForModel(modelToGenerate);
            runGenerationTask(modelToGenerate, btn);
        });
    });

    async function runGenerationTask(modelId, btn) {
        const btnText = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.spinner');
        const state = modelStates[modelId];
        
        try {
            state.task.isRunning = true;
            setLoading(true, btn, btnText, spinner);
            
            const statusUpdate = (text) => {
                state.task.statusText = text;
                if (modelId === currentModel) {
                    updateResultStatusWithSpinner(text);
                }
            };
            
            statusUpdate('准备请求...');

            let imageUrls;
            if (modelId === 'nanobanana') {
                imageUrls = await handleNanoBananaGeneration(statusUpdate);
            } else {
                imageUrls = await handleModelScopeGeneration(statusUpdate);
            }
            
            state.results = imageUrls;

            if (modelId === currentModel) {
                displayResults(imageUrls);
            }

        } catch (error) {
            if (modelId === currentModel) {
                updateResultStatus(error.message);
            }
            console.error(`模型 ${modelId} 生成失败:`, error);
        } finally {
            state.task.isRunning = false;
            state.task.statusText = '';
            if (modelId === currentModel) {
                setLoading(false, btn, btnText, spinner);
            }
        }
    }
    
    async function fetchWithTimeout(resource, options, timeout) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(resource, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    }

    async function handleNanoBananaGeneration(statusUpdate) {
        if (apiKeyOpenRouterInput.parentElement.style.display !== 'none' && !apiKeyOpenRouterInput.value.trim()) { throw new Error('请输入 OpenRouter API 密钥'); }
        if (!promptNanoBananaInput.value.trim()) { throw new Error('请输入提示词'); }
        statusUpdate('正在生成图片...');
        const base64Images = await Promise.all(modelStates.nanobanana.inputs.files.map(fileToBase64));
        const requestBody = { model: 'nanobanana', prompt: modelStates.nanobanana.inputs.prompt, images: base64Images, apikey: apiKeyOpenRouterInput.value };
        const response = await fetch('/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
        const data = await response.json();
        if (!response.ok || data.error) { throw new Error(data.error || `服务器错误: ${response.status}`); }
        return [data.imageUrl];
    }

    async function handleModelScopeGeneration(statusUpdate) {
        const inputs = modelStates[currentModel].inputs;
        const isStepsValid = validateInput(stepsInput);
        const isGuidanceValid = validateInput(guidanceInput);
        const isSeedValid = validateInput(seedInput);
        if (!isStepsValid || !isGuidanceValid || !isSeedValid) { throw new Error('请修正参数错误后再生成'); }
        if (apiKeyModelScopeInput.parentElement.style.display !== 'none' && !apiKeyModelScopeInput.value.trim()) { throw new Error('请输入 Modelscope 的 API Key'); }
        if (!inputs.prompt) { throw new Error('请输入正向提示词'); }
        
        const isQwen = currentModel.includes('Qwen');
        const timeoutPerRequest = isQwen ? 120 * 1000 : 180 * 1000;
        const totalTimeout = isQwen ? 360 * 1000 : timeoutPerRequest;
        
        const baseRequestBody = { model: currentModel, apikey: apiKeyModelScopeInput.value, parameters: { prompt: inputs.prompt, negative_prompt: inputs.negative_prompt, size: inputs.size, steps: inputs.steps, guidance: inputs.guidance, seed: inputs.seed }, timeout: timeoutPerRequest / 1000 };
        const results = [];
        const controller = new AbortController();
        const overallTimeoutId = setTimeout(() => controller.abort(), totalTimeout);
        try {
            if (isQwen && inputs.count > 1) {
                for (let i = 0; i < inputs.count; i++) {
                    statusUpdate(`正在生成 ${i + 1}/${inputs.count} 张图片...`);
                    const requestBody = JSON.parse(JSON.stringify(baseRequestBody));
                    if (requestBody.parameters.seed === -1) { requestBody.parameters.seed = Math.floor(Math.random() * (2**31 - 1)); }
                    const response = await fetchWithTimeout('/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) }, timeoutPerRequest);
                    const data = await response.json();
                    if (!response.ok || data.error) { throw new Error(`第 ${i + 1} 张图片生成失败: ${data.error}`); }
                    results.push(data);
                }
            } else {
                const fetchPromises = [];
                for (let i = 0; i < inputs.count; i++) {
                    const requestBody = JSON.parse(JSON.stringify(baseRequestBody));
                    if (requestBody.parameters.seed === -1) { requestBody.parameters.seed = Math.floor(Math.random() * (2**31 - 1)); }
                    fetchPromises.push(fetchWithTimeout('/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) }, timeoutPerRequest));
                }
                statusUpdate(`正在生成 1/${inputs.count} 张图片...`);
                let completedCount = 0;
                const processPromise = async (promise) => {
                    const response = await promise;
                    const data = await response.json();
                    completedCount++;
                    const statusText = (completedCount < inputs.count) ? `正在生成 ${completedCount + 1}/${inputs.count} 张图片...` : `已完成 ${completedCount}/${inputs.count} 张图片...`;
                    statusUpdate(statusText);
                    if (!response.ok || data.error) { return { error: `第 ${completedCount} 张图片生成失败: ${data.error}` }; }
                    return data;
                };
                const parallelResults = await Promise.all(fetchPromises.map(processPromise));
                const firstError = parallelResults.find(r => r.error);
                if (firstError) { throw new Error(firstError.error); }
                results.push(...parallelResults);
            }
            clearTimeout(overallTimeoutId);
            return results.map(data => data.imageUrl);
        } catch (error) {
            clearTimeout(overallTimeoutId);
            if (error.name === 'AbortError') { throw new Error('生成超时，请稍后再试。'); }
            throw error;
        }
    }

    function displayResults(imageUrls) {
        if (!imageUrls || imageUrls.length === 0 || !imageUrls[0]) { updateResultStatus("模型没有返回有效的图片URL。"); return; }
        
        mainResultImageContainer.innerHTML = ''; 
        resultThumbnailsContainer.innerHTML = '';
        
        // 显示下载按钮
        downloadBtn.classList.remove('hidden');
        
        const mainImg = document.createElement('img');
        mainImg.src = imageUrls[0];
        mainImg.onclick = () => openModal(mainImg.src);
        mainResultImageContainer.appendChild(mainImg);
        
        if (imageUrls.length > 1) {
            imageUrls.forEach((url, index) => {
                const thumbImg = document.createElement('img');
                thumbImg.src = url;
                thumbImg.classList.add('result-thumb');
                if (index === 0) { thumbImg.classList.add('active'); }
                thumbImg.addEventListener('click', () => { 
                    mainImg.src = thumbImg.src; 
                    document.querySelectorAll('.result-thumb').forEach(t => t.classList.remove('active')); 
                    thumbImg.classList.add('active'); 
                });
                resultThumbnailsContainer.appendChild(thumbImg);
            });
        }
    }

    function updateResultStatus(text) { 
        mainResultImageContainer.innerHTML = `<p>${text}</p>`; 
        resultThumbnailsContainer.innerHTML = ''; 
        downloadBtn.classList.add('hidden');
    }
    
    function updateResultStatusWithSpinner(text) { 
        mainResultImageContainer.innerHTML = `<div class="loading-spinner"></div><p>${text}</p>`; 
        resultThumbnailsContainer.innerHTML = ''; 
        downloadBtn.classList.add('hidden');
    }
    
    function setLoading(isLoading, btn, btnText, spinner) {
        btn.disabled = isLoading;
        btnText.textContent = isLoading ? '正在生成...' : '生成';
        spinner.classList.toggle('hidden', !isLoading);
    }

    function fileToBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }
    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
    ['dragenter', 'dragover'].forEach(eventName => uploadArea.addEventListener(eventName, () => uploadArea.classList.add('drag-over')));
    ['dragleave', 'drop'].forEach(eventName => uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('drag-over')));
    uploadArea.addEventListener('drop', (e) => handleFiles(Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'))));
    fileInput.addEventListener('change', (e) => handleFiles(Array.from(e.target.files).filter(file => file.type.startsWith('image/'))));
    
    function handleFiles(files) {
        files.forEach(file => {
             if (!selectedFiles.some(f => f.name === file.name)) {
                selectedFiles.push(file);
                createThumbnail(file);
             }
        });
    }

    function createThumbnail(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const wrapper = document.createElement('div'); wrapper.className = 'thumbnail-wrapper';
            const img = document.createElement('img'); img.src = e.target.result; img.alt = file.name;
            const removeBtn = document.createElement('button'); removeBtn.className = 'remove-btn'; removeBtn.innerHTML = '×';
            removeBtn.onclick = () => {
                selectedFiles = selectedFiles.filter(f => f.name !== file.name);
                wrapper.remove();
            };
            wrapper.appendChild(img); wrapper.appendChild(removeBtn); thumbnailsContainer.appendChild(wrapper);
        };
        reader.readAsDataURL(file);
    }
    
    initialize();
});
