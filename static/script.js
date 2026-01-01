/**
 * =============================================================================
 * ANESTHESIA DEVICE ASSISTANT - FRONTEND JAVASCRIPT
 * =============================================================================
 * 
 * This file contains all the JavaScript code that makes the webpage interactive.
 * It handles:
 *   1. Uploading and processing device images
 *   2. Displaying extraction results and confidence levels
 *   3. Managing the dropdown menus for manufacturer/model selection
 *   4. Handling free-text input when device isn't in the list
 *   5. Sending chat questions to the backend
 * 
 * HOW THE APP FLOW WORKS:
 *   Step 1: User uploads a photo of a medical device
 *   Step 2: AI analyzes the image and extracts manufacturer/model
 *   Step 3: User confirms or corrects the extracted information
 *   Step 4: User can ask questions about the device manual
 * 
 * =============================================================================
 */


// =============================================================================
// STATE MANAGEMENT
// =============================================================================
/**
 * The "state" object holds all the important data that the app needs to remember.
 * Think of it as the app's "memory" - it tracks what's been selected, 
 * what data we've loaded, and what mode we're in.
 */
const state = {
    // Data returned from the AI after analyzing the image
    extractedData: null,
    
    // The manufacturer currently selected in the dropdown
    selectedManufacturer: null,
    
    // The model currently selected in the dropdown  
    selectedModel: null,
    
    // List of all manufacturers loaded from the backend
    manufacturers: [],
    
    // List of models for the currently selected manufacturer
    models: [],
    
    // True when user is typing in free-text fields instead of using dropdowns
    // This happens when they select "Not on this list"
    isUsingFreeText: false,
    
    // True if we have a manual available for the selected device
    manualAvailable: true,
    
    // Current identification mode: "photo" or "select"
    // "photo" = upload image for AI extraction
    // "select" = directly select from dropdowns
    identificationMode: "photo"
};


// =============================================================================
// DOM ELEMENTS - References to HTML elements on the page
// =============================================================================
/**
 * The "elements" object provides easy access to all the HTML elements we need.
 * 
 * Each property is a FUNCTION that returns the element (not the element itself).
 * We use functions because the elements might not exist when this file first loads,
 * so we need to look them up fresh each time we need them.
 * 
 * Example usage:
 *   elements.imageInput()  → returns the file input element
 *   elements.confirmBtn()  → returns the confirm button
 */
const elements = {
    // -------------------------------------------------------------------------
    // STEP 1: Device Identification Elements
    // -------------------------------------------------------------------------
    
    // Mode toggle buttons
    modePhotoBtn: () => document.getElementById("modePhoto"),
    modeSelectBtn: () => document.getElementById("modeSelect"),
    
    // Mode sections (only one visible at a time)
    photoModeSection: () => document.getElementById("photoModeSection"),
    selectModeSection: () => document.getElementById("selectModeSection"),
    
    // The file input where users select/take photos
    imageInput: () => document.getElementById("imageInput"),
    
    // The "Analyzing image..." loading message
    extractionLoading: () => document.getElementById("extractionLoading"),
    
    // -------------------------------------------------------------------------
    // BANNER ELEMENTS - These show messages to the user
    // -------------------------------------------------------------------------
    
    // Yellow warning banner (shown when extraction fails or has low confidence)
    warningBanner: () => document.getElementById("warningBanner"),
    warningTitle: () => document.getElementById("warningTitle"),
    warningSuggestion: () => document.getElementById("warningSuggestion"),
    
    // Green partial success banner (shown when only ONE field is confident)
    partialSuccessBanner: () => document.getElementById("partialSuccessBanner"),
    manufacturerMessage: () => document.getElementById("manufacturerMessage"),
    manufacturerMessageText: () => document.getElementById("manufacturerMessageText"),
    modelMessage: () => document.getElementById("modelMessage"),
    modelMessageText: () => document.getElementById("modelMessageText"),
    partialWarning: () => document.getElementById("partialWarning"),
    
    // Green full success banner (shown when BOTH fields are confident)
    successBanner: () => document.getElementById("successBanner"),
    fullSuccessManufacturer: () => document.getElementById("fullSuccessManufacturer"),
    fullSuccessManufacturerText: () => document.getElementById("fullSuccessManufacturerText"),
    fullSuccessModel: () => document.getElementById("fullSuccessModel"),
    fullSuccessModelText: () => document.getElementById("fullSuccessModelText"),
    confidenceDisplay: () => document.getElementById("confidenceDisplay"),
    
    // Red error banner (shown when no manual is available)
    noManualBanner: () => document.getElementById("noManualBanner"),
    noManualMessage: () => document.getElementById("noManualMessage"),
    
    // -------------------------------------------------------------------------
    // STEP 2: Device Selection Elements
    // -------------------------------------------------------------------------
    
    // The entire device selection section (hidden until image is uploaded)
    deviceSelection: () => document.getElementById("deviceSelection"),
    
    // Dropdown menu for selecting manufacturer
    manufacturerSelect: () => document.getElementById("manufacturerSelect"),
    
    // Dropdown menu for selecting model (disabled until manufacturer is selected)
    modelSelect: () => document.getElementById("modelSelect"),
    
    // Section containing free-text input fields (hidden until "Not on this list" is selected)
    freeTextSection: () => document.getElementById("freeTextSection"),
    
    // Free-text input field for manufacturer name
    manufacturerInput: () => document.getElementById("manufacturerInput"),
    
    // Free-text input field for model number
    modelInput: () => document.getElementById("modelInput"),
    
    // Button to confirm the device selection
    confirmBtn: () => document.getElementById("confirmBtn"),
    
    // Button to reset/start over
    resetBtn: () => document.getElementById("resetBtn"),
    
    // -------------------------------------------------------------------------
    // STEP 3: Chat Elements
    // -------------------------------------------------------------------------
    
    // The entire chat section (hidden until device is confirmed)
    chat: () => document.getElementById("chat"),
    
    // Text input where user types their question
    question: () => document.getElementById("question"),
    
    // Area where the answer is displayed
    answer: () => document.getElementById("answer")
};


// =============================================================================
// INITIALIZATION - Code that runs when the page first loads
// =============================================================================

/**
 * This code runs automatically when the page finishes loading.
 * 
 * "DOMContentLoaded" is an event that fires when the HTML is fully loaded
 * and all elements are available to interact with.
 * 
 * "async" means this function can use "await" to wait for data to load.
 */
document.addEventListener("DOMContentLoaded", async () => {
    // Load the list of manufacturers from the backend
    await loadManufacturers();
    
    // Set up all the event listeners (what happens when user clicks/types)
    setupEventListeners();
});


// =============================================================================
// DATA LOADING FUNCTIONS - Getting data from the backend
// =============================================================================

/**
 * Loads the list of all manufacturers from the backend API.
 * 
 * This function:
 *   1. Calls the /api/manufacturers endpoint
 *   2. Saves the list to state.manufacturers
 *   3. Populates the manufacturer dropdown with options
 * 
 * "async" and "await" are used because fetching data takes time
 * and we need to wait for the response before continuing.
 */
async function loadManufacturers() {
    try {
        // Call the backend API to get manufacturers
        const response = await fetch("/api/manufacturers");
        
        // Convert the JSON response to a JavaScript object
        const data = await response.json();
        
        // Save the list to our state (or empty array if none)
        state.manufacturers = data.manufacturers || [];
        
        // Update the dropdown with these manufacturers
        populateManufacturerDropdown();
    } catch (error) {
        // If something goes wrong, log it to the console for debugging
        console.error("Failed to load manufacturers:", error);
    }
}


/**
 * Fills the manufacturer dropdown with options from our loaded data.
 * 
 * This creates <option> elements for each manufacturer, plus a special
 * "Not on this list" option at the end for devices we don't have in our database.
 */
function populateManufacturerDropdown() {
    // Get the dropdown element
    const select = elements.manufacturerSelect();
    
    // Start with just the placeholder option
    select.innerHTML = '<option value="">-- Select Manufacturer --</option>';
    
    // Add an option for each manufacturer
    state.manufacturers.forEach(mfr => {
        // Create a new <option> element
        const option = document.createElement("option");
        option.value = mfr;        // The value sent when form is submitted
        option.textContent = mfr;  // The text the user sees
        select.appendChild(option);
    });
    
    // Add the "Not on this list" option at the end
    // This allows users to enter custom manufacturer names
    const notListedOption = document.createElement("option");
    notListedOption.value = "__NOT_LISTED__";  // Special value we check for
    notListedOption.textContent = "⚠️ Not on this list";
    select.appendChild(notListedOption);
}


/**
 * Loads the list of models for a specific manufacturer.
 * 
 * This is called when the user selects a manufacturer from the dropdown.
 * It fetches the models for that manufacturer and updates the model dropdown.
 * 
 * @param {string} manufacturer - The name of the selected manufacturer
 */
async function loadModels(manufacturer) {
    // If no manufacturer selected or "Not on this list" selected, clear models
    if (!manufacturer || manufacturer === "__NOT_LISTED__") {
        state.models = [];
        populateModelDropdown();
        return;
    }
    
    try {
        // Call the backend API to get models for this manufacturer
        // encodeURIComponent handles special characters in the manufacturer name
        const response = await fetch(`/api/models/${encodeURIComponent(manufacturer)}`);
        const data = await response.json();
        
        // Save the list to our state
        state.models = data.models || [];
        
        // Update the model dropdown
        populateModelDropdown();
    } catch (error) {
        console.error("Failed to load models:", error);
        state.models = [];
        populateModelDropdown();
    }
}


/**
 * Fills the model dropdown with options for the selected manufacturer.
 * 
 * Similar to populateManufacturerDropdown, but only adds "Not on this list"
 * if there are actual models in the list.
 */
function populateModelDropdown() {
    const select = elements.modelSelect();
    
    // Start with just the placeholder option
    select.innerHTML = '<option value="">-- Select Model --</option>';
    
    // Add an option for each model
    state.models.forEach(model => {
        const option = document.createElement("option");
        option.value = model;
        option.textContent = model;
        select.appendChild(option);
    });
    
    // Only add "Not on this list" if we have models (otherwise it doesn't make sense)
    if (state.models.length > 0) {
        const notListedOption = document.createElement("option");
        notListedOption.value = "__NOT_LISTED__";
        notListedOption.textContent = "⚠️ Not on this list";
        select.appendChild(notListedOption);
    }
    
    // Disable the dropdown if there are no models and we're not in free text mode
    // This prevents the user from selecting nothing
    select.disabled = state.models.length === 0 && !state.isUsingFreeText;
}


// =============================================================================
// EVENT LISTENERS - What happens when the user interacts with the page
// =============================================================================

/**
 * Sets up all the event listeners for user interactions.
 * 
 * An "event listener" is code that runs when something happens,
 * like clicking a button or selecting an option from a dropdown.
 */
function setupEventListeners() {
    // -------------------------------------------------------------------------
    // IMAGE UPLOAD - When user selects/takes a photo
    // -------------------------------------------------------------------------
    elements.imageInput().addEventListener("change", handleImageUpload);
    
    // -------------------------------------------------------------------------
    // MANUFACTURER DROPDOWN - When user selects a manufacturer
    // -------------------------------------------------------------------------
    elements.manufacturerSelect().addEventListener("change", async (e) => {
        // Get the selected value
        const value = e.target.value;
        
        if (value === "__NOT_LISTED__") {
            // User selected "Not on this list" - switch to free text mode
            state.isUsingFreeText = true;
            showFreeTextSection(true);
            elements.modelSelect().disabled = true;  // Disable model dropdown
            state.selectedManufacturer = null;
            state.selectedModel = null;
        } else {
            // User selected a real manufacturer
            state.isUsingFreeText = false;
            showFreeTextSection(false);  // Hide free text fields
            state.selectedManufacturer = value;
            state.selectedModel = null;  // Reset model selection
            elements.modelSelect().value = "";  // Reset dropdown display
            
            // Load the models for this manufacturer
            await loadModels(value);
            
            // Enable/disable model dropdown based on whether manufacturer was selected
            elements.modelSelect().disabled = !value;
        }
        
        // Check if we can enable the confirm button
        validateSelection();
    });
    
    // -------------------------------------------------------------------------
    // MODEL DROPDOWN - When user selects a model
    // -------------------------------------------------------------------------
    elements.modelSelect().addEventListener("change", (e) => {
        const value = e.target.value;
        
        if (value === "__NOT_LISTED__") {
            // User selected "Not on this list" - switch to free text mode
            state.isUsingFreeText = true;
            showFreeTextSection(true);
            state.selectedModel = null;
        } else {
            // User selected a real model
            state.selectedModel = value;
        }
        
        validateSelection();
    });
    
    // -------------------------------------------------------------------------
    // FREE TEXT INPUTS - When user types in the manual entry fields
    // -------------------------------------------------------------------------
    // Every time the user types, we check if we can enable the confirm button
    elements.manufacturerInput().addEventListener("input", validateSelection);
    elements.modelInput().addEventListener("input", validateSelection);
    
    // -------------------------------------------------------------------------
    // CONFIRM BUTTON - When user confirms their selection
    // -------------------------------------------------------------------------
    elements.confirmBtn().addEventListener("click", handleConfirmSelection);
    
    // -------------------------------------------------------------------------
    // RESET BUTTON - When user wants to start over
    // -------------------------------------------------------------------------
    elements.resetBtn().addEventListener("click", fullReset);
    
    // -------------------------------------------------------------------------
    // SEARCHABLE DROPDOWNS - Allow typing to filter options
    // -------------------------------------------------------------------------
    setupSearchableDropdown(elements.manufacturerSelect());
    setupSearchableDropdown(elements.modelSelect());
}


/**
 * Makes a dropdown searchable by typing.
 * 
 * When the user focuses on a dropdown and types letters, it will
 * jump to the first option that starts with those letters.
 * The search resets after 1 second of no typing.
 * 
 * @param {HTMLSelectElement} selectElement - The dropdown to make searchable
 */
function setupSearchableDropdown(selectElement) {
    // Buffer to hold the characters the user has typed
    let searchBuffer = "";
    
    // Timer to reset the buffer after a delay
    let searchTimeout;
    
    // Listen for key presses on the dropdown
    selectElement.addEventListener("keydown", (e) => {
        // Only handle single letters and numbers (not special keys like Enter)
        if (e.key.length === 1 && e.key.match(/[a-zA-Z0-9]/)) {
            // Add the typed character to the search buffer
            searchBuffer += e.key.toLowerCase();
            
            // Reset the timer (so buffer clears after 1 second of no typing)
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchBuffer = "";  // Clear the buffer
            }, 1000);  // 1000 milliseconds = 1 second
            
            // Find an option that starts with the typed text
            const options = Array.from(selectElement.options);
            const match = options.find(opt => 
                opt.textContent.toLowerCase().startsWith(searchBuffer)
            );
            
            // If found, select it
            if (match) {
                selectElement.value = match.value;
                // Trigger the change event so our other code runs
                selectElement.dispatchEvent(new Event("change"));
            }
        }
    });
}


// =============================================================================
// STATE RESET
// =============================================================================

/**
 * Resets the entire application state back to the beginning.
 * Called when user clicks "Start Over" or uploads a new image.
 */
function resetState() {
    // Reset state variables
    state.extractedData = null;
    state.selectedManufacturer = null;
    state.selectedModel = null;
    state.models = [];
    state.isUsingFreeText = false;
    state.manualAvailable = true;
    
    // Reset dropdowns (new inline dropdowns)
    const mfrSelect = document.getElementById('manufacturerSelect');
    const modelSelect = document.getElementById('modelSelect');
    if (mfrSelect) {
        mfrSelect.value = "";
        mfrSelect.disabled = false;
    }
    if (modelSelect) {
        modelSelect.innerHTML = '<option value="">-- Select --</option>';
        modelSelect.disabled = true;
    }
    
    // Reset free text inputs
    const mfrInput = document.getElementById('manufacturerInput');
    const modelInput = document.getElementById('modelInput');
    if (mfrInput) mfrInput.value = "";
    if (modelInput) modelInput.value = "";
    
    // Hide extraction results
    const resultsDiv = document.getElementById('extractionResults');
    if (resultsDiv) resultsDiv.classList.add('hidden');
    
    // Reset detected device view to show detection data (not confirmed state)
    const detectedDeviceView = document.getElementById('detectedDeviceView');
    if (detectedDeviceView) {
        // Restore the original grid layout (in case it was replaced with "confirmed" view)
        detectedDeviceView.innerHTML = `
            <div class="detected-device-grid">
                <div class="detected-field">
                    <div class="detected-label">Manufacturer</div>
                    <div class="detected-value" id="extractedManufacturer">—</div>
                    <div class="detected-conf">
                        <span class="conf-label">Confidence:</span>
                        <span id="manuConfidenceText" class="confidence-value">—%</span>
                    </div>
                </div>
                <div class="detected-field">
                    <div class="detected-label">Model</div>
                    <div class="detected-value" id="extractedModel">—</div>
                    <div class="detected-conf">
                        <span class="conf-label">Confidence:</span>
                        <span id="modelConfidenceText" class="confidence-value">—%</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Reset extraction title
    const extractionTitle = document.getElementById('extractionTitle');
    if (extractionTitle) {
        extractionTitle.textContent = '🎯 Device Detected';
        extractionTitle.className = 'extraction-title status-detected';
    }
    const extractionSubtitle = document.getElementById('extractionSubtitle');
    if (extractionSubtitle) {
        extractionSubtitle.textContent = '';
    }
    
    // Show confirm/edit buttons (hidden by default until results shown)
    const confirmEditButtons = document.getElementById('confirmEditButtons');
    if (confirmEditButtons) confirmEditButtons.classList.add('hidden');
    
    // Hide edit mode
    const editSection = document.getElementById('editModeSection');
    if (editSection) editSection.classList.add('hidden');
    
    // Hide device suggestion and no-match UIs
    const deviceSuggestion = document.getElementById('deviceSuggestion');
    if (deviceSuggestion) deviceSuggestion.classList.add('hidden');
    const noDeviceMatch = document.getElementById('noDeviceMatch');
    if (noDeviceMatch) noDeviceMatch.classList.add('hidden');
    
    // Clear pending suggestion
    pendingSuggestion = null;
    
    // Reset confirm button
    const confirmBtn = document.getElementById('confirmBtn');
    if (confirmBtn) {
        confirmBtn.textContent = "💬 Start Chatting with Halo";
        confirmBtn.disabled = true;
        confirmBtn.classList.add('hidden');
    }
    
    // Hide reset button
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) resetBtn.classList.add('hidden');
    
    // Hide low confidence warning
    const lowConfWarning = document.getElementById('lowConfidenceWarning');
    if (lowConfWarning) lowConfWarning.classList.add('hidden');
    
    // Reset mode to photo
    state.identificationMode = "photo";
    const photoBtn = elements.modePhotoBtn();
    const selectBtn = elements.modeSelectBtn();
    const photoSection = elements.photoModeSection();
    const selectSection = elements.selectModeSection();
    
    if (photoBtn) photoBtn.classList.add("active");
    if (selectBtn) selectBtn.classList.remove("active");
    if (photoSection) photoSection.classList.remove("hidden");
    if (selectSection) selectSection.classList.add("hidden");
    
    // Hide chat section
    elements.chat().classList.remove("show");
    elements.question().value = "";
    elements.answer().textContent = "";
    
    // Hide manual notification
    const manualNotification = document.getElementById("manualNotification");
    if (manualNotification) {
        manualNotification.classList.add("hidden");
    }
    
    // Reset chat subtitle
    const chatDeviceInfo = document.getElementById("chatDeviceInfo");
    if (chatDeviceInfo) {
        chatDeviceInfo.textContent = "Current Device: None selected";
    }
    
    // Clear chat history
    clearChatHistory();
    
    // Reset chat placeholder to generic text
    resetChatPlaceholder();
    
    // Hide all banners
    hideBanners();
    
    // Clear global chat variables
    window.currentManufacturer = null;
    window.currentModel = null;
    
    // Note: We don't clear file input here - it should only be cleared when user clicks "Start Over"
}

/**
 * Full reset including clearing the file input.
 * Called when user clicks "Start Over" button.
 */
function fullReset() {
    resetState();
    
    // Also clear the file input
    const imageInput = elements.imageInput();
    if (imageInput) imageInput.value = "";
}


// =============================================================================
// IDENTIFICATION MODE SWITCHING
// =============================================================================

/**
 * Switches between photo mode and direct selection mode.
 * 
 * Photo mode: User uploads an image for AI-powered extraction
 * Select mode: User directly selects from dropdowns without uploading an image
 * 
 * @param {string} mode - Either "photo" or "select"
 */
function setIdentificationMode(mode) {
    state.identificationMode = mode;
    
    // Update toggle button states
    const photoBtn = elements.modePhotoBtn();
    const selectBtn = elements.modeSelectBtn();
    const photoSection = elements.photoModeSection();
    const selectSection = elements.selectModeSection();
    const resultsDiv = document.getElementById('extractionResults');
    const confirmBtn = document.getElementById('confirmBtn');
    const resetBtn = document.getElementById('resetBtn');
    
    if (mode === "photo") {
        photoBtn?.classList.add("active");
        selectBtn?.classList.remove("active");
        photoSection?.classList.remove("hidden");
        selectSection?.classList.add("hidden");
    } else {
        photoBtn?.classList.remove("active");
        selectBtn?.classList.add("active");
        photoSection?.classList.add("hidden");
        selectSection?.classList.remove("hidden");
        
        // For select mode, show the confirm button and enable inline selection
        if (confirmBtn) confirmBtn.classList.remove('hidden');
        if (resetBtn) resetBtn.classList.remove('hidden');
        
        // Hide extraction results when in select mode
        if (resultsDiv) resultsDiv.classList.add('hidden');
        
        // Setup inline select dropdowns
        setupInlineSelectMode();
    }
}

/**
 * Sets up the inline select mode with dropdowns for manual device selection.
 */
async function setupInlineSelectMode() {
    const mfrSelect = document.getElementById('manufacturerSelect');
    const modelSelect = document.getElementById('modelSelect');
    const confirmBtn = document.getElementById('confirmBtn');
    const freeTextSection = document.getElementById('selectModeFreeText');
    const mfrInput = document.getElementById('selectModeManufacturerInput');
    const modelInput = document.getElementById('selectModeModelInput');
    
    if (!mfrSelect) return;
    
    // Make sure manufacturers are loaded
    if (state.manufacturers.length === 0) {
        await loadManufacturers();
    }
    
    // Hide free text section initially and clear inputs
    if (freeTextSection) freeTextSection.classList.add('hidden');
    if (mfrInput) mfrInput.value = '';
    if (modelInput) modelInput.value = '';
    state.isUsingFreeText = false;
    
    // Populate manufacturer dropdown
    mfrSelect.innerHTML = '<option value="">-- Select --</option>';
    state.manufacturers.forEach(mfr => {
        const option = document.createElement('option');
        option.value = mfr;
        option.textContent = mfr;
        mfrSelect.appendChild(option);
    });
    
    // Add "Not on this list" option
    const notListedMfr = document.createElement('option');
    notListedMfr.value = '__NOT_LISTED__';
    notListedMfr.textContent = '⚠️ Not on this list';
    mfrSelect.appendChild(notListedMfr);
    
    // Handle manufacturer change
    mfrSelect.onchange = async function() {
        const value = this.value;
        
        if (value === '__NOT_LISTED__') {
            // Show free text section for custom entry
            state.isUsingFreeText = true;
            if (freeTextSection) freeTextSection.classList.remove('hidden');
            modelSelect.disabled = true;
            state.selectedManufacturer = null;
            state.selectedModel = null;
        } else if (value) {
            // Hide free text section, load models
            state.isUsingFreeText = false;
            if (freeTextSection) freeTextSection.classList.add('hidden');
            state.selectedManufacturer = value;
            
            const response = await fetch(`/api/models/${encodeURIComponent(value)}`);
            const data = await response.json();
            const models = data.models || [];
            
            modelSelect.innerHTML = '<option value="">-- Select --</option>';
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSelect.appendChild(option);
            });
            
            // Add "Not on this list" option for models
            const notListedModel = document.createElement('option');
            notListedModel.value = '__NOT_LISTED__';
            notListedModel.textContent = '⚠️ Not on this list';
            modelSelect.appendChild(notListedModel);
            
            modelSelect.disabled = false;
        } else {
            state.isUsingFreeText = false;
            if (freeTextSection) freeTextSection.classList.add('hidden');
            modelSelect.innerHTML = '<option value="">-- Select --</option>';
            modelSelect.disabled = true;
        }
        
        state.selectedModel = null;
        updateInlineConfirmButton();
    };
    
    // Handle model change
    modelSelect.onchange = function() {
        const value = this.value;
        
        if (value === '__NOT_LISTED__') {
            // Show free text section for custom model entry
            state.isUsingFreeText = true;
            if (freeTextSection) freeTextSection.classList.remove('hidden');
            state.selectedModel = null;
        } else {
            state.selectedModel = value;
        }
        updateInlineConfirmButton();
    };
    
    // Add input listeners for free text fields to update confirm button
    if (mfrInput) {
        mfrInput.oninput = updateInlineConfirmButton;
    }
    if (modelInput) {
        modelInput.oninput = updateInlineConfirmButton;
    }
    
    // Initially disable confirm button
    if (confirmBtn) confirmBtn.disabled = true;
}

/**
 * Updates confirm button state for inline select mode.
 * Handles both dropdown selection and free text input.
 */
function updateInlineConfirmButton() {
    const confirmBtn = document.getElementById('confirmBtn');
    if (!confirmBtn) return;
    
    let hasManufacturer = false;
    let hasModel = false;
    
    if (state.isUsingFreeText) {
        // In free text mode, check the select mode input fields
        const mfrInput = document.getElementById('selectModeManufacturerInput');
        const modelInput = document.getElementById('selectModeModelInput');
        hasManufacturer = mfrInput && mfrInput.value.trim() !== '';
        hasModel = modelInput && modelInput.value.trim() !== '';
    } else {
        // In dropdown mode, check the state
        hasManufacturer = state.selectedManufacturer && state.selectedManufacturer !== '';
        hasModel = state.selectedModel && state.selectedModel !== '';
    }
    
    confirmBtn.disabled = !(hasManufacturer && hasModel);
}


/**
 * Starts the direct device selection flow.
 * 
 * Called when user clicks "Select Device from List" button.
 * This skips the image upload step and goes directly to Step 2.
 */
function startDirectSelection() {
    // Update the Step 2 title for direct selection mode
    const step2Title = document.getElementById("step2Title");
    if (step2Title) {
        step2Title.textContent = "Step 2: Select Your Device";
    }
    
    // Show the device selection section (Step 2)
    elements.deviceSelection().classList.remove("hidden");
    
    // Show an info message about manual selection
    showDirectSelectionInfo();
    
    // Scroll to the selection section
    elements.deviceSelection().scrollIntoView({ behavior: "smooth", block: "start" });
}


/**
 * Shows an info banner for direct selection mode.
 */
function showDirectSelectionInfo() {
    hideBanners();
    
    // Re-use the success banner with different styling for info
    const banner = elements.successBanner();
    const mfrText = elements.fullSuccessManufacturerText();
    const modelText = elements.fullSuccessModelText();
    const confidence = elements.confidenceDisplay();
    
    // Set the content
    mfrText.textContent = "Select your device's manufacturer and model from the dropdowns below.";
    modelText.textContent = "If your device isn't listed, choose \"Not on this list\" to enter details manually.";
    confidence.textContent = "";
    
    // Change the styling to blue (info) instead of green (success)
    banner.style.background = "#d1ecf1";
    banner.style.borderColor = "#17a2b8";
    banner.style.color = "#0c5460";
    
    banner.classList.add("show");
}


// =============================================================================
// IMAGE UPLOAD HANDLING
// =============================================================================

/**
 * Handles when the user uploads or takes a photo.
 * 
 * This function:
 *   1. Resets any previous state
 *   2. Gets the selected file
 *   3. Shows a loading indicator
 *   4. Sends the image to the backend for AI analysis
 *   5. Processes and displays the results
 * 
 * @param {Event} event - The file input change event
 */
async function handleImageUpload(event) {
    // Get the first (and only) file from the file input
    const file = event.target.files[0];
    
    // If no file was selected, do nothing
    if (!file) return;
    
    // Reset state before processing new image
    resetState();
    
    // Show the loading indicator ("Analyzing image...")
    elements.extractionLoading().classList.remove("hidden");
    
    // Create a FormData object to send the file
    const formData = new FormData();
    formData.append("image", file);
    
    try {
        // Send the image to our backend API
        const response = await fetch("/api/extract-model", {
            method: "POST",
            body: formData
        });
        
        // Convert the response to a JavaScript object
        const data = await response.json();
        
        // Save the extraction data to our state
        state.extractedData = data;
        
        // Hide the loading indicator
        elements.extractionLoading().classList.add("hidden");
        
        // Show the device selection section (Step 2)
        elements.deviceSelection().classList.remove("hidden");
        
        // Process and display the extraction results
        processExtractionResult(data);
        
    } catch (error) {
        // If something went wrong, show an error and let user enter manually
        console.error("Extraction failed:", error);
        elements.extractionLoading().classList.add("hidden");
        showWarning("Failed to analyze image. Please try again or enter details manually.", 
                    "Check your connection and try uploading the image again.");
        elements.deviceSelection().classList.remove("hidden");
    }
}


// =============================================================================
// EXTRACTION RESULT PROCESSING
// =============================================================================

/**
 * Processes the extraction result and shows appropriate UI feedback.
 * 
 * This function evaluates EACH confidence score INDEPENDENTLY:
 *   - If BOTH are confident → Show full success (green banner)
 *   - If ONLY ONE is confident → Show partial success (green banner with warning)
 *   - If NEITHER is confident → Show warning (yellow banner)
 * 
 * In all cases, we try to pre-fill the dropdowns with whatever data we got.
 * 
 * @param {Object} data - The extraction result from the backend, containing:
 *   - manufacturer: The detected manufacturer name (or null)
 *   - model_number: The detected model number (or null)
 *   - manufacturer_confident: Boolean, true if confidence >= threshold
 *   - model_number_confident: Boolean, true if confidence >= threshold
 *   - manufacturer_confidence: Number 0.0-1.0
 *   - model_number_confidence: Number 0.0-1.0
 */
function processExtractionResult(data) {
    // Use the new streamlined UI
    showStreamlinedResults(data);
}

/**
 * Shows extraction results with confirm/edit options.
 * Handles three states: full detection, partial detection, and not found.
 * @param {Object} data - The extraction result from the API
 */
function showStreamlinedResults(data) {
    const resultsDiv = document.getElementById('extractionResults');
    const titleEl = document.getElementById('extractionTitle');
    const subtitleEl = document.getElementById('extractionSubtitle');
    
    if (!resultsDiv) return;
    
    // Calculate confidence percentages
    const mfrConf = data.manufacturer_confidence !== undefined 
        ? Math.round(data.manufacturer_confidence * 100) : 0;
    const modelConf = data.model_number_confidence !== undefined 
        ? Math.round(data.model_number_confidence * 100) : 0;
    
    // Determine what was detected (using 30% as minimum threshold for "detected")
    const mfrDetected = data.manufacturer && mfrConf >= 30;
    const modelDetected = data.model_number && modelConf >= 30;
    
    // Determine detection status
    let detectionStatus;
    if (mfrDetected && modelDetected) {
        detectionStatus = 'detected';
    } else if (mfrDetected || modelDetected) {
        detectionStatus = 'partial';
    } else {
        detectionStatus = 'not-found';
    }
    
    // Update title and subtitle based on detection status
    if (titleEl) {
        titleEl.className = `extraction-title status-${detectionStatus}`;
        if (detectionStatus === 'detected') {
            titleEl.textContent = '🎯 Device Detected';
        } else if (detectionStatus === 'partial') {
            titleEl.textContent = '⚠️ Partial Match';
        } else {
            titleEl.textContent = '❌ Device Not Found';
        }
    }
    
    if (subtitleEl) {
        if (detectionStatus === 'detected') {
            subtitleEl.textContent = 'Please confirm or edit the detected device.';
        } else if (detectionStatus === 'partial') {
            const missing = !mfrDetected ? 'manufacturer' : 'model';
            subtitleEl.textContent = `We found the ${mfrDetected ? 'manufacturer' : 'model'}, but couldn't detect the ${missing}. Please provide the missing information.`;
        } else {
            subtitleEl.textContent = 'We couldn\'t identify this device. Please select or enter the device information manually.';
        }
    }
    
    // Get confidence levels (high, medium, low)
    const mfrLevel = mfrConf >= 80 ? 'high' : mfrConf >= 60 ? 'medium' : 'low';
    const modelLevel = modelConf >= 80 ? 'high' : modelConf >= 60 ? 'medium' : 'low';
    
    // Update manufacturer display
    const extractedMfr = document.getElementById('extractedManufacturer');
    const mfrConfText = document.getElementById('manuConfidenceText');
    
    if (extractedMfr) extractedMfr.textContent = mfrDetected ? data.manufacturer : 'Not detected';
    if (mfrConfText) {
        mfrConfText.textContent = `${mfrConf}%`;
        mfrConfText.className = `confidence-value ${mfrLevel}`;
    }
    
    // Update model display
    const extractedModel = document.getElementById('extractedModel');
    const modelConfText = document.getElementById('modelConfidenceText');
    
    if (extractedModel) extractedModel.textContent = modelDetected ? data.model_number : 'Not detected';
    if (modelConfText) {
        modelConfText.textContent = `${modelConf}%`;
        modelConfText.className = `confidence-value ${modelLevel}`;
    }
    
    // Store extracted data for confirmation
    state.extractedData = data;
    state.selectedManufacturer = mfrDetected ? data.manufacturer : null;
    state.selectedModel = modelDetected ? data.model_number : null;
    
    // Populate edit dropdowns
    populateEditDropdowns(data);
    
    // Show results
    resultsDiv.classList.remove('hidden');
    
    // For partial or not-found, go straight to edit mode
    if (detectionStatus === 'partial' || detectionStatus === 'not-found') {
        // Hide confirm buttons, show edit mode directly
        document.getElementById('confirmEditButtons')?.classList.add('hidden');
        document.getElementById('detectedDeviceView')?.classList.remove('hidden');
        document.getElementById('editModeSection')?.classList.remove('hidden');
        document.getElementById('deviceActionsSection')?.classList.add('hidden');
    } else {
        // Full detection - show confirm/edit buttons
        document.getElementById('confirmEditButtons')?.classList.remove('hidden');
        document.getElementById('detectedDeviceView')?.classList.remove('hidden');
        document.getElementById('editModeSection')?.classList.add('hidden');
        document.getElementById('deviceActionsSection')?.classList.add('hidden');
    }
}

/**
 * Called when user confirms the detected device is correct.
 */
/**
 * Stores the current device suggestion from the AI matching.
 * This is used when the user clicks "Yes, use this device".
 */
let pendingSuggestion = null;


// =============================================================================
// UNIFIED DEVICE VERIFICATION & CONFIRMATION
// =============================================================================
// This section handles device confirmation for BOTH flows:
// 1. Photo upload flow (confirmDeviceCorrect)
// 2. Select device flow (handleConfirmSelection)
//
// The unified flow:
// 1. verifyAndConfirmDevice() - Main entry point, calls match-device API
// 2. showDeviceSuggestion() - Shows "Did you mean?" UI
// 3. showNoDeviceMatch() - Shows "No match found" UI  
// 4. finalizeDeviceConfirmation() - Completes confirmation and shows chat
// =============================================================================


/**
 * UNIFIED DEVICE VERIFICATION
 * 
 * Main function that verifies a device against our database and handles
 * the confirmation flow. Used by both photo upload and select device modes.
 * 
 * @param {string} manufacturer - The manufacturer name to verify
 * @param {string} model - The model name to verify
 * @param {Object} options - Configuration options
 * @param {Function} options.onLoading - Called when verification starts
 * @param {Function} options.onSuggestion - Called when AI suggests a match
 * @param {Function} options.onNoMatch - Called when no match is found
 * @param {Function} options.onComplete - Called when verification completes successfully
 * @param {Function} options.onError - Called on error (defaults to proceeding anyway)
 */
async function verifyAndConfirmDevice(manufacturer, model, options = {}) {
    const {
        onLoading = () => {},
        onSuggestion = showDeviceSuggestion,
        onNoMatch = showNoDeviceMatch,
        onComplete = finalizeDeviceConfirmation,
        onError = (mfr, mdl) => finalizeDeviceConfirmation(mfr, mdl)
    } = options;
    
    // Store values in state
    state.selectedManufacturer = manufacturer;
    state.selectedModel = model;
    
    // Show loading state
    onLoading();
    
    try {
        // Call the match-device API
        const response = await fetch('/api/match-device', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manufacturer, model })
        });
        
        const matchResult = await response.json();
        
        if (matchResult.exact_match) {
            // Exact match found - use the matched values (may have proper casing/umlauts)
            onComplete(matchResult.manufacturer, matchResult.model);
        } else if (matchResult.suggested && matchResult.meets_threshold) {
            // AI found a good suggestion - show "Did you mean...?"
            onSuggestion(matchResult);
        } else {
            // No match found
            onNoMatch(matchResult);
        }
    } catch (error) {
        console.error('Error matching device:', error);
        // On error, proceed with original values (fallback)
        onError(manufacturer, model);
    }
}


/**
 * Confirms the detected device is correct (PHOTO UPLOAD FLOW).
 * Delegates to the unified verification function.
 */
async function confirmDeviceCorrect() {
    const manufacturer = state.selectedManufacturer;
    const model = state.selectedModel;
    
    await verifyAndConfirmDevice(manufacturer, model, {
        onLoading: () => {
            // Hide confirm/edit buttons while checking
            document.getElementById('confirmEditButtons')?.classList.add('hidden');
            
            // Show loading state in the detected device view
            const detectedDevice = document.getElementById('detectedDeviceView');
            if (detectedDevice) {
                detectedDevice.innerHTML = `
                    <div class="detected-device-checking">
                        <span class="checking-spinner">⏳</span>
                        <span>Verifying device in database...</span>
                    </div>
                `;
            }
        }
    });
}


/**
 * Shows the "Did you mean...?" suggestion UI.
 * @param {Object} matchResult - The result from the match-device API
 */
function showDeviceSuggestion(matchResult) {
    // Store the suggestion for later use
    pendingSuggestion = {
        manufacturer: matchResult.manufacturer,
        model: matchResult.model,
        confidence: matchResult.confidence,
        reasoning: matchResult.reasoning
    };
    
    // Hide other elements
    document.getElementById('confirmEditButtons')?.classList.add('hidden');
    document.getElementById('noDeviceMatch')?.classList.add('hidden');
    elements.confirmBtn()?.classList.add('hidden');
    
    // Remove any inline suggestion container
    const inlineContainer = document.getElementById('inlineSuggestionContainer');
    if (inlineContainer) inlineContainer.remove();
    
    // Restore the detected device view
    const detectedDevice = document.getElementById('detectedDeviceView');
    if (detectedDevice) {
        detectedDevice.innerHTML = `
            <div class="detected-device-grid">
                <div class="detected-field">
                    <div class="detected-label">Your Input</div>
                    <div class="detected-value">${state.selectedManufacturer || '—'} ${state.selectedModel || '—'}</div>
                </div>
            </div>
        `;
    }
    
    // Populate the suggestion UI
    const suggestedDeviceInfo = document.getElementById('suggestedDeviceInfo');
    if (suggestedDeviceInfo) {
        suggestedDeviceInfo.innerHTML = `
            <div class="suggested-device-name">${matchResult.manufacturer} ${matchResult.model}</div>
        `;
    }
    
    const suggestionConfidence = document.getElementById('suggestionConfidence');
    if (suggestionConfidence) {
        const confidencePercent = Math.round(matchResult.confidence * 100);
        suggestionConfidence.innerHTML = `
            Match confidence: <strong>${confidencePercent}%</strong>
            ${matchResult.reasoning ? `<br><em>${matchResult.reasoning}</em>` : ''}
        `;
    }
    
    // Show the suggestion UI
    document.getElementById('deviceSuggestion')?.classList.remove('hidden');
}


/**
 * Shows the "no match found" error message.
 */
function showNoDeviceMatch() {
    // Hide other elements
    document.getElementById('confirmEditButtons')?.classList.add('hidden');
    document.getElementById('deviceSuggestion')?.classList.add('hidden');
    elements.confirmBtn()?.classList.add('hidden');
    
    // Remove any inline suggestion container
    const inlineContainer = document.getElementById('inlineSuggestionContainer');
    if (inlineContainer) inlineContainer.remove();
    
    // Restore the detected device view to show what was entered
    const detectedDevice = document.getElementById('detectedDeviceView');
    if (detectedDevice) {
        detectedDevice.innerHTML = `
            <div class="detected-device-grid">
                <div class="detected-field">
                    <div class="detected-label">Your Input</div>
                    <div class="detected-value">${state.selectedManufacturer || '—'} ${state.selectedModel || '—'}</div>
                </div>
            </div>
        `;
    }
    
    // Show the no match UI
    document.getElementById('noDeviceMatch')?.classList.remove('hidden');
}


/**
 * User accepts the suggested device match.
 */
function acceptDeviceSuggestion() {
    if (!pendingSuggestion) return;
    
    // Hide the suggestion UI
    document.getElementById('deviceSuggestion')?.classList.add('hidden');
    
    // Update state with the suggested values
    state.selectedManufacturer = pendingSuggestion.manufacturer;
    state.selectedModel = pendingSuggestion.model;
    
    // Finalize with the suggested device
    finalizeDeviceConfirmation(pendingSuggestion.manufacturer, pendingSuggestion.model);
    
    // Clear the pending suggestion
    pendingSuggestion = null;
}


/**
 * User rejects the suggestion and wants to enter manually.
 */
function rejectDeviceSuggestion() {
    // Hide the suggestion UI
    document.getElementById('deviceSuggestion')?.classList.add('hidden');
    
    // Clear pending suggestion
    pendingSuggestion = null;
    
    // Show edit mode or reset for manual entry
    if (state.identificationMode === 'photo') {
        showEditMode();
    } else {
        // For select mode, reset to allow re-entry
        switchToDropdownSelection();
    }
}


/**
 * UNIFIED FINALIZE CONFIRMATION
 * 
 * Completes the device confirmation and shows the chat.
 * This is the final step for BOTH photo upload and select device flows.
 * 
 * @param {string} manufacturer - The confirmed manufacturer
 * @param {string} model - The confirmed model
 */
function finalizeDeviceConfirmation(manufacturer, model) {
    // Set global variables for chat
    window.currentManufacturer = manufacturer;
    window.currentModel = model;
    
    // Update state
    state.selectedManufacturer = manufacturer;
    state.selectedModel = model;
    
    // Update chat placeholder with device info
    updateChatPlaceholder(manufacturer, model);
    
    // Hide all suggestion/error UIs
    document.getElementById('deviceSuggestion')?.classList.add('hidden');
    document.getElementById('noDeviceMatch')?.classList.add('hidden');
    document.getElementById('confirmEditButtons')?.classList.add('hidden');
    
    // Remove any inline suggestion container
    const inlineContainer = document.getElementById('inlineSuggestionContainer');
    if (inlineContainer) inlineContainer.remove();
    
    // Update UI based on mode
    if (state.identificationMode === 'photo') {
        // Photo mode - update the detected device view
        const detectedDevice = document.getElementById('detectedDeviceView');
        if (detectedDevice) {
            detectedDevice.innerHTML = `
                <div class="detected-device-confirmed">
                    <span class="confirmed-icon">✓</span>
                    <div>
                        <div class="detected-device-name">
                            ${manufacturer || '—'} • ${model || '—'}
                        </div>
                        <div class="detected-status">Device confirmed</div>
                    </div>
                </div>
            `;
        }
    } else {
        // Select mode - update the confirm button
        const confirmBtn = elements.confirmBtn();
        if (confirmBtn) {
            confirmBtn.textContent = "✓ Device Confirmed";
            confirmBtn.style.background = "#6c757d";
            confirmBtn.disabled = true;
            confirmBtn.classList.remove('hidden');
        }
        
        // Disable all input elements
        elements.manufacturerSelect().disabled = true;
        elements.modelSelect().disabled = true;
        elements.manufacturerInput().disabled = true;
        elements.modelInput().disabled = true;
        
        const selectMfrInput = document.getElementById('selectModeManufacturerInput');
        const selectModelInput = document.getElementById('selectModeModelInput');
        if (selectMfrInput) selectMfrInput.disabled = true;
        if (selectModelInput) selectModelInput.disabled = true;
    }
    
    // Hide warning banners
    elements.warningBanner()?.classList.remove("show");
    elements.partialSuccessBanner()?.classList.remove("show");
    elements.noManualBanner()?.classList.remove("show");
    
    // Show the chat section
    elements.chat().classList.add("show");
    
    // Check if manual is available and show notification
    checkAndShowManualStatus(manufacturer, model);
}

/**
 * Shows the edit mode to change the detected device.
 */
function showEditMode() {
    // Hide confirm/edit buttons
    document.getElementById('confirmEditButtons')?.classList.add('hidden');
    
    // Show edit mode section
    document.getElementById('editModeSection')?.classList.remove('hidden');
}

/**
 * Cancels edit mode and returns to confirm/edit view.
 */
function cancelEditMode() {
    // Hide edit mode section
    document.getElementById('editModeSection')?.classList.add('hidden');
    
    // Show confirm/edit buttons again
    document.getElementById('confirmEditButtons')?.classList.remove('hidden');
}

/**
 * Confirms the edited device selection.
 */
async function confirmEditedDevice() {
    const editMfrSelect = document.getElementById('editManufacturerSelect');
    const editModelSelect = document.getElementById('editModelSelect');
    const freeTextMfr = document.getElementById('manufacturerInput');
    const freeTextModel = document.getElementById('modelInput');
    
    // Get final values
    let finalMfr = editMfrSelect?.value;
    let finalModel = editModelSelect?.value;
    
    if (finalMfr === '__NOT_LISTED__') {
        finalMfr = freeTextMfr?.value || '';
    }
    if (finalModel === '__NOT_LISTED__') {
        finalModel = freeTextModel?.value || '';
    }
    
    // Hide edit mode
    document.getElementById('editModeSection')?.classList.add('hidden');
    
    // Check if using free text
    const isFreeText = (editMfrSelect?.value === '__NOT_LISTED__' || editModelSelect?.value === '__NOT_LISTED__');
    
    if (isFreeText) {
        // Free text entry - use unified verification
        await verifyAndConfirmDevice(finalMfr, finalModel, {
            onLoading: () => {
                // Show loading in the device view
                const detectedDevice = document.getElementById('detectedDeviceView');
                if (detectedDevice) {
                    detectedDevice.innerHTML = `
                        <div class="detected-device-checking">
                            <span class="checking-spinner">⏳</span>
                            <span>Verifying device in database...</span>
                        </div>
                    `;
                }
            }
        });
    } else {
        // Device was selected from dropdowns - it's already in our database
        finalizeDeviceConfirmation(finalMfr, finalModel);
    }
}

/**
 * Populates the edit mode dropdowns with manufacturers and models.
 */
async function populateEditDropdowns(data) {
    const editMfrSelect = document.getElementById('editManufacturerSelect');
    const editModelSelect = document.getElementById('editModelSelect');
    
    if (!editMfrSelect) return;
    
    // Populate manufacturer dropdown
    editMfrSelect.innerHTML = '<option value="">-- Select --</option>';
    state.manufacturers.forEach(mfr => {
        const option = document.createElement('option');
        option.value = mfr;
        option.textContent = mfr;
        if (mfr === data.manufacturer) option.selected = true;
        editMfrSelect.appendChild(option);
    });
    
    // Add "Not on this list" option
    const notListedOption = document.createElement('option');
    notListedOption.value = '__NOT_LISTED__';
    notListedOption.textContent = '⚠️ Not on this list';
    editMfrSelect.appendChild(notListedOption);
    
    // Pre-load models for the detected manufacturer
    if (data.manufacturer) {
        try {
            const response = await fetch(`/api/models/${encodeURIComponent(data.manufacturer)}`);
            const modelData = await response.json();
            const models = modelData.models || [];
            
            editModelSelect.innerHTML = '<option value="">-- Select --</option>';
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                // Pre-select the detected model
                if (model === data.model_number) option.selected = true;
                editModelSelect.appendChild(option);
            });
            
            // Add "Not on this list" for models
            const notListedModel = document.createElement('option');
            notListedModel.value = '__NOT_LISTED__';
            notListedModel.textContent = '⚠️ Not on this list';
            editModelSelect.appendChild(notListedModel);
            
            editModelSelect.disabled = false;
        } catch (error) {
            console.error('Error loading models:', error);
        }
    }
    
    // Handle manufacturer change in edit mode
    editMfrSelect.onchange = async function() {
        const value = this.value;
        if (value === '__NOT_LISTED__') {
            document.getElementById('freeTextSection')?.classList.remove('hidden');
            editModelSelect.disabled = true;
            state.isUsingFreeText = true;
        } else if (value) {
            document.getElementById('freeTextSection')?.classList.add('hidden');
            state.isUsingFreeText = false;
            // Load models for selected manufacturer
            const response = await fetch(`/api/models/${encodeURIComponent(value)}`);
            const modelData = await response.json();
            const models = modelData.models || [];
            
            editModelSelect.innerHTML = '<option value="">-- Select --</option>';
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                editModelSelect.appendChild(option);
            });
            
            // Add "Not on this list" for models
            const notListedModel = document.createElement('option');
            notListedModel.value = '__NOT_LISTED__';
            notListedModel.textContent = '⚠️ Not on this list';
            editModelSelect.appendChild(notListedModel);
            
            editModelSelect.disabled = false;
        } else {
            editModelSelect.innerHTML = '<option value="">-- Select --</option>';
            editModelSelect.disabled = true;
        }
        
        // Update state
        state.selectedManufacturer = value === '__NOT_LISTED__' ? null : value;
        state.selectedModel = null; // Reset model when manufacturer changes
    };
    
    editModelSelect.onchange = function() {
        const value = this.value;
        if (value === '__NOT_LISTED__') {
            document.getElementById('freeTextSection')?.classList.remove('hidden');
            state.isUsingFreeText = true;
        }
        state.selectedModel = value === '__NOT_LISTED__' ? null : value;
        updateConfirmButtonState();
    };
    
    // Add input listeners for free text fields in edit mode
    const mfrInput = document.getElementById('manufacturerInput');
    const modelInput = document.getElementById('modelInput');
    
    if (mfrInput) {
        mfrInput.oninput = updateConfirmButtonState;
    }
    if (modelInput) {
        modelInput.oninput = updateConfirmButtonState;
    }
}

/**
 * Toggles between view mode and edit mode for extraction results.
 */
function toggleEditMode() {
    const editSection = document.getElementById('editModeSection');
    const editBtn = document.querySelector('.edit-btn');
    
    if (editSection && editBtn) {
        const isHidden = editSection.classList.toggle('hidden');
        editBtn.textContent = isHidden ? '✏️ Edit' : '✓ Done';
        
        if (!isHidden) {
            // Entering edit mode - populate with current values
            const editMfrSelect = document.getElementById('editManufacturerSelect');
            const editModelSelect = document.getElementById('editModelSelect');
            
            if (editMfrSelect && state.selectedManufacturer) {
                editMfrSelect.value = state.selectedManufacturer;
                // Trigger change to load models
                editMfrSelect.dispatchEvent(new Event('change'));
            }
        } else {
            // Exiting edit mode - update display with selected values
            const editMfrSelect = document.getElementById('editManufacturerSelect');
            const editModelSelect = document.getElementById('editModelSelect');
            const freeTextMfr = document.getElementById('manufacturerInput');
            const freeTextModel = document.getElementById('modelInput');
            
            // Get final values
            let finalMfr = editMfrSelect?.value;
            let finalModel = editModelSelect?.value;
            
            if (finalMfr === '__NOT_LISTED__') {
                finalMfr = freeTextMfr?.value || '';
            }
            if (finalModel === '__NOT_LISTED__') {
                finalModel = freeTextModel?.value || '';
            }
            
            // Update display
            const extractedMfr = document.getElementById('extractedManufacturer');
            const extractedModel = document.getElementById('extractedModel');
            
            if (extractedMfr && finalMfr) extractedMfr.textContent = finalMfr;
            if (extractedModel && finalModel) extractedModel.textContent = finalModel;
            
            // Update state
            state.selectedManufacturer = finalMfr;
            state.selectedModel = finalModel;
        }
    }
}

/**
 * Updates the confirm button state based on current selections.
 */
function updateConfirmButtonState() {
    const confirmBtn = document.getElementById('confirmBtn');
    const freeTextMfr = document.getElementById('manufacturerInput');
    const freeTextModel = document.getElementById('modelInput');
    
    let hasMfr = !!state.selectedManufacturer;
    let hasModel = !!state.selectedModel;
    
    // Check free text inputs
    if (!hasMfr && freeTextMfr?.value) hasMfr = true;
    if (!hasModel && freeTextModel?.value) hasModel = true;
    
    if (confirmBtn) {
        confirmBtn.disabled = !(hasMfr && hasModel);
    }
}


// =============================================================================
// DROPDOWN PRE-FILLING
// =============================================================================

/**
 * Pre-fills the dropdowns with data extracted by the AI.
 * 
 * This function tries to match the extracted values to our known manufacturers/models.
 * If a match isn't found, it switches to free-text mode and fills in the detected value.
 * 
 * IMPORTANT: We pre-fill regardless of confidence level because:
 *   - High confidence: User can just verify and confirm
 *   - Low confidence: User is warned but still gets a starting point
 * 
 * @param {Object} data - The extraction result containing manufacturer and model_number
 */
function prefillDropdowns(data) {
    // Get references to the dropdown elements
    const mfrSelect = elements.manufacturerSelect();
    const modelSelect = elements.modelSelect();
    
    // -------------------------------------------------------------------------
    // MANUFACTURER PRE-FILLING
    // -------------------------------------------------------------------------
    if (data.manufacturer) {
        // Try to find a match in our list of known manufacturers
        const matchedMfr = findBestMatch(data.manufacturer, state.manufacturers);
        
        if (matchedMfr) {
            // Found a match! Select it in the dropdown
            mfrSelect.value = matchedMfr;
            state.selectedManufacturer = matchedMfr;
            
            // Load the models for this manufacturer, then try to match the model
            loadModels(matchedMfr).then(() => {
                // Try to match the model number
                if (data.model_number) {
                    const matchedModel = findBestMatch(data.model_number, state.models);
                    
                    if (matchedModel) {
                        // Found a match! Select it in the dropdown
                        modelSelect.value = matchedModel;
                        state.selectedModel = matchedModel;
                    } else {
                        // Model not found in our list - switch to free text
                        modelSelect.value = "__NOT_LISTED__";
                        state.isUsingFreeText = true;
                        showFreeTextSection(true);
                        // Pre-fill the free text field with the detected value
                        elements.modelInput().value = data.model_number;
                    }
                }
                // Enable the model dropdown
                modelSelect.disabled = false;
                validateSelection();
            });
        } else {
            // Manufacturer not found in our list - switch to free text mode
            mfrSelect.value = "__NOT_LISTED__";
            state.isUsingFreeText = true;
            showFreeTextSection(true);
            // Pre-fill the free text fields
            elements.manufacturerInput().value = data.manufacturer;
            if (data.model_number) {
                elements.modelInput().value = data.model_number;
            }
            validateSelection();
        }
    } 
    // -------------------------------------------------------------------------
    // ONLY MODEL NUMBER (no manufacturer)
    // -------------------------------------------------------------------------
    else if (data.model_number) {
        // We only have a model number - show free text for model
        state.isUsingFreeText = true;
        showFreeTextSection(true);
        elements.modelInput().value = data.model_number;
        validateSelection();
    }
}


/**
 * Finds the best matching option for a search term.
 * 
 * This function tries to match in two ways:
 *   1. Exact match (case-insensitive): "baxter" matches "Baxter"
 *   2. Partial match: "Bax" matches "Baxter", or "Baxter Healthcare" matches "Baxter"
 * 
 * @param {string} search - The text to search for
 * @param {string[]} options - The list of options to search in
 * @returns {string|null} The matching option, or null if not found
 */
function findBestMatch(search, options) {
    // If no search term or empty options, return null
    if (!search || !options.length) return null;
    
    // Convert to lowercase for case-insensitive matching
    const searchLower = search.toLowerCase().trim();
    
    // Try exact match first (most accurate)
    const exact = options.find(opt => opt.toLowerCase() === searchLower);
    if (exact) return exact;
    
    // Try partial match (contains)
    // Matches if the option contains the search term OR vice versa
    const contains = options.find(opt => 
        opt.toLowerCase().includes(searchLower) || 
        searchLower.includes(opt.toLowerCase())
    );
    if (contains) return contains;
    
    // No match found
    return null;
}


// =============================================================================
// UI HELPER FUNCTIONS
// =============================================================================

/**
 * Shows or hides the free-text input section.
 * 
 * When shown, users can type custom manufacturer/model values.
 * When hidden, the text inputs are cleared.
 * 
 * @param {boolean} show - True to show, false to hide
 */
function showFreeTextSection(show) {
    const section = elements.freeTextSection();
    
    if (show) {
        // Show the section by adding the "show" class
        section.classList.add("show");
    } else {
        // Hide the section and clear the inputs
        section.classList.remove("show");
        elements.manufacturerInput().value = "";
        elements.modelInput().value = "";
    }
}


/**
 * Validates the current selection and enables/disables the confirm button.
 * 
 * The confirm button is only enabled when we have BOTH:
 *   - A manufacturer (from dropdown OR free-text)
 *   - A model number (from dropdown OR free-text)
 * 
 * NOTE: Free-text values take precedence over dropdown selections.
 */
function validateSelection() {
    let hasManufacturer = false;
    let hasModel = false;
    
    // Check if we're in free-text mode
    if (state.isUsingFreeText) {
        // In free-text mode, check the input fields
        hasManufacturer = elements.manufacturerInput().value.trim() !== "";
        hasModel = elements.modelInput().value.trim() !== "";
    } else {
        // In dropdown mode, check the state
        hasManufacturer = state.selectedManufacturer && state.selectedManufacturer !== "";
        hasModel = state.selectedModel && state.selectedModel !== "";
    }
    
    // IMPORTANT: Free-text always overrides dropdown
    // If user typed something in the free-text field, use that
    if (elements.manufacturerInput().value.trim()) {
        hasManufacturer = true;
    }
    if (elements.modelInput().value.trim()) {
        hasModel = true;
    }
    
    // Enable the confirm button only if we have both manufacturer and model
    elements.confirmBtn().disabled = !(hasManufacturer && hasModel);
}


// =============================================================================
// MANUAL AVAILABILITY CHECK
// =============================================================================

/**
 * Checks if a manual is available for the selected device and shows
 * an appropriate notification in the chat section.
 * 
 * @param {string} manufacturer - The device manufacturer
 * @param {string} model - The device model
 */
async function checkAndShowManualStatus(manufacturer, model) {
    const notification = document.getElementById("manualNotification");
    if (!notification) return;
    
    try {
        // Call the API to check manual availability
        const response = await fetch(`/api/check-manual/${encodeURIComponent(manufacturer || "Unknown")}/${encodeURIComponent(model)}`);
        const data = await response.json();
        
        // Store the result for later use
        state.manualAvailable = data.has_manual;
        
        // Update chat subtitle with device info
        const chatDeviceInfo = document.getElementById("chatDeviceInfo");
        if (chatDeviceInfo) {
            chatDeviceInfo.innerHTML = `Current Device: <strong>${escapeHtml(data.device_name)}</strong>`;
        }
        
        if (data.has_manual) {
            // Manual found - show compact success notification
            notification.className = "manual-notification has-manual";
            notification.innerHTML = `
                <span class="notification-icon">📚</span>
                <span>Official manual available — Halo will search the documentation for answers.</span>
            `;
        } else {
            // No manual - show compact warning notification
            notification.className = "manual-notification no-manual";
            notification.innerHTML = `
                <span class="notification-icon">🌐</span>
                <span>No manual found — Halo will search the internet. Please verify critical info.</span>
            `;
        }
        
        notification.classList.remove("hidden");
        
    } catch (error) {
        console.error("Failed to check manual availability:", error);
        // Don't show notification on error - the chat will handle it
    }
}


// =============================================================================
// CONFIRM SELECTION HANDLING
// =============================================================================

/**
 * Handles when the user clicks the "Confirm Device Selection" button.
 * 
 * This function:
 *   1. Gets the final manufacturer and model values
 *   2. Stores them for the chat feature
 *   3. Checks if a manual is available (API call)
 *   4. Shows appropriate notification in chat section
 *   5. Disables all inputs (selection is complete)
 *   6. Shows the chat section
 * 
 * IMPORTANT: Free-text values ALWAYS override dropdown selections.
 */
async function handleConfirmSelection() {
    // Get free-text values from both possible locations
    // (edit mode uses manufacturerInput/modelInput, select mode uses selectModeManufacturerInput/selectModeModelInput)
    let freeTextMfr = '';
    let freeTextModel = '';
    
    if (state.identificationMode === 'select') {
        // Check select mode inputs
        const selectMfrInput = document.getElementById('selectModeManufacturerInput');
        const selectModelInput = document.getElementById('selectModeModelInput');
        freeTextMfr = selectMfrInput ? selectMfrInput.value.trim() : '';
        freeTextModel = selectModelInput ? selectModelInput.value.trim() : '';
    } else {
        // Check edit mode inputs (for photo upload flow)
        freeTextMfr = elements.manufacturerInput().value.trim();
        freeTextModel = elements.modelInput().value.trim();
    }
    
    // Free-text takes precedence over dropdown
    // If user typed something, use that; otherwise use the dropdown selection
    const finalManufacturer = freeTextMfr || state.selectedManufacturer;
    const finalModel = freeTextModel || state.selectedModel;
    
    // Check if using free text - either typed values OR the "Not on this list" option was selected
    const isUsingFreeText = !!(freeTextMfr || freeTextModel) || state.isUsingFreeText;
    
    // DEBUG: Log what's happening
    console.log('=== handleConfirmSelection DEBUG ===');
    console.log('identificationMode:', state.identificationMode);
    console.log('freeTextMfr:', freeTextMfr);
    console.log('freeTextModel:', freeTextModel);
    console.log('state.selectedManufacturer:', state.selectedManufacturer);
    console.log('state.selectedModel:', state.selectedModel);
    console.log('state.isUsingFreeText:', state.isUsingFreeText);
    console.log('isUsingFreeText (computed):', isUsingFreeText);
    console.log('finalManufacturer:', finalManufacturer);
    console.log('finalModel:', finalModel);
    console.log('=====================================');
    
    if (isUsingFreeText) {
        console.log('>>> Calling verifyAndConfirmDevice...');
        // Free text entry - use unified verification
        await verifyAndConfirmDevice(finalManufacturer, finalModel, {
            onLoading: () => {
                elements.confirmBtn().textContent = "⏳ Verifying...";
                elements.confirmBtn().disabled = true;
            },
            onError: (mfr, mdl) => {
                // Reset button and proceed anyway on error
                elements.confirmBtn().textContent = "💬 Start Chatting with Halo";
                elements.confirmBtn().disabled = false;
                finalizeDeviceConfirmation(mfr, mdl);
            }
        });
    } else {
        console.log('>>> Skipping verification - using dropdown selection directly');
        // Selected from dropdown - device is already in our database
        finalizeDeviceConfirmation(finalManufacturer, finalModel);
    }
}


/**
 * Switch back to dropdown selection mode.
 */
function switchToDropdownSelection() {
    // Remove any suggestion/no-match UIs
    const container = document.getElementById('inlineSuggestionContainer');
    if (container) container.remove();
    document.getElementById('deviceSuggestion')?.classList.add('hidden');
    document.getElementById('noDeviceMatch')?.classList.add('hidden');
    
    // Show confirm button again
    elements.confirmBtn().classList.remove('hidden');
    elements.confirmBtn().textContent = "💬 Start Chatting with Halo";
    elements.confirmBtn().disabled = true;  // Disabled until valid selection
    
    // Reset the free text inputs
    const selectMfrInput = document.getElementById('selectModeManufacturerInput');
    const selectModelInput = document.getElementById('selectModeModelInput');
    if (selectMfrInput) selectMfrInput.value = '';
    if (selectModelInput) selectModelInput.value = '';
    
    // Reset the manufacturer dropdown to trigger fresh selection
    const mfrSelect = elements.manufacturerSelect();
    if (mfrSelect) {
        mfrSelect.value = '';
        mfrSelect.dispatchEvent(new Event('change'));
    }
    
    // Hide free text section
    const freeTextSection = document.getElementById('selectModeFreeText');
    if (freeTextSection) freeTextSection.classList.add('hidden');
    
    state.isUsingFreeText = false;
    state.selectedManufacturer = null;
    state.selectedModel = null;
}


/**
 * Proceed with the unknown device anyway (will use fallback/web search).
 */
function proceedWithUnknownDevice() {
    // Hide the no-match UI
    document.getElementById('noDeviceMatch')?.classList.add('hidden');
    
    // Proceed with whatever they typed
    finalizeDeviceConfirmation(state.selectedManufacturer, state.selectedModel);
}


// =============================================================================
// CHAT FUNCTIONALITY
// =============================================================================

/**
 * Chat history storage - keeps track of the conversation for follow-up questions.
 * Array of {role: "user"|"assistant", content: "message text"}
 */
window.chatHistory = [];


/**
 * Sends the user's question to the backend and displays the answer.
 * Supports follow-up questions by sending conversation history.
 * 
 * This function is called when the user clicks the "Ask" button.
 * It sends the question along with the manufacturer/model to our chat API,
 * which uses the device manual to generate an answer.
 * 
 * NOTE: This function is called from the HTML onclick attribute.
 */
async function ask() {
    // Get the question text (remove extra spaces)
    const question = elements.question().value.trim();
    
    // Don't do anything if the question is empty
    if (!question) return;
    
    // Add user's question to chat history display
    addMessageToChat("user", question);
    
    // Clear the input field
    elements.question().value = "";
    
    // Show a loading indicator in the answer area
    elements.answer().innerHTML = "Thinking<span class='loading'></span>";
    
    // Clear any previous sources
    const sourcesContainer = document.getElementById("sourcesContainer");
    if (sourcesContainer) sourcesContainer.innerHTML = "";
    
    try {
        // Send the question to our backend API with history
        const response = await fetch("/api/chat", {
        method: "POST",
            headers: { "Content-Type": "application/json" },  // We're sending JSON
            body: JSON.stringify({
                manufacturer: window.currentManufacturer,
                model: window.currentModel,
                question: question,
                history: window.chatHistory  // Send conversation history
            })
        });
        
        // Get the response
        const data = await response.json();
        
        // Check if there was an error (complete failure)
        if (data.error) {
            // Clear the answer area and show error banner
            elements.answer().textContent = "";
            showNoManualError(data.message);
        } else if (data.is_fallback) {
            // FALLBACK MODE: Information from internet, not official manual
            // (User already saw disclaimer when device was confirmed)
            window.chatHistory.push({ role: "user", content: question });
            window.chatHistory.push({ role: "assistant", content: data.answer });
            
            // Add fallback answer with simple indicator (no big warning since disclaimer already shown)
            addFallbackMessageToChat(data.answer);
            
            // Clear the single answer display
            elements.answer().textContent = "";
            elements.noManualBanner().classList.remove("show");
        } else {
            // Success! Official manual-based answer
            window.chatHistory.push({ role: "user", content: question });
            window.chatHistory.push({ role: "assistant", content: data.answer });
            
            // Add assistant's answer to chat display (with images if available)
            addMessageToChat("assistant", data.answer, data.sources, data.confidence, data.images);
            
            // Clear the single answer display (we're using chat now)
            elements.answer().textContent = "";
            elements.noManualBanner().classList.remove("show");
        }
    } catch (error) {
        // Network or other error
        console.error("Chat error:", error);
        elements.answer().textContent = "Failed to get answer. Please try again.";
    }
}


/**
 * Adds a message to the chat display.
 * 
 * @param {string} role - "user" or "assistant"
 * @param {string} content - The message text
 * @param {Array} sources - Optional array of source objects (for assistant messages)
 * @param {number} confidence - Optional confidence score (for assistant messages)
 * @param {Array} images - Optional array of image objects (for assistant messages)
 */
function addMessageToChat(role, content, sources = null, confidence = null, images = null) {
    const chatContainer = document.getElementById("chatHistory");
    if (!chatContainer) return;
    
    const messageDiv = document.createElement("div");
    messageDiv.className = `chat-message ${role}-message`;
    
    const roleLabel = role === "user" ? "You" : "Halo";
    
    // For assistant messages, render markdown; for user messages, escape HTML
    const formattedContent = role === "assistant" 
        ? renderMarkdown(content) 
        : escapeHtml(content);
    
    // Add Halo avatar for assistant messages (animated SVG ring)
    const haloSvg = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="20" stroke="url(#haloGradMsg)" stroke-width="3" fill="none" opacity="0.3"/>
        <circle cx="24" cy="24" r="16" stroke="url(#haloGradMsg)" stroke-width="4" fill="none"/>
        <circle cx="24" cy="24" r="8" fill="url(#haloGradMsg)"/>
        <defs><linearGradient id="haloGradMsg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0d9488"/><stop offset="100%" stop-color="#06b6d4"/>
        </linearGradient></defs>
    </svg>`;
    const avatarHtml = role === "assistant" 
        ? `<span class="halo-mini-avatar">${haloSvg}</span>` 
        : '';
    
    let html = `
        <div class="message-header">
            ${avatarHtml}
            <span class="message-role">${roleLabel}</span>
        </div>
        <div class="message-content">${formattedContent}</div>
    `;
    
    // Add images for assistant messages (if available)
    if (role === "assistant" && images && images.length > 0) {
        html += `
            <div class="message-images" onclick="toggleMessageImages(this)">
                <span class="images-toggle">▶</span>
                📷 Related Images (${images.length})
            </div>
            <div class="message-images-list collapsed">
        `;
        
        images.forEach(img => {
            html += `
                <div class="image-item">
                    <div class="image-page">Page ${img.page}</div>
                    <img src="${img.url}" alt="Manual page ${img.page}" 
                         onclick="showFullImage('${img.url}')" 
                         title="Click to enlarge" />
                </div>
            `;
        });
        
        html += "</div>";
    }
    
    // Add sources for assistant messages
    if (role === "assistant" && sources && sources.length > 0) {
        const confPercent = Math.round((confidence || 0) * 100);
        const pages = sources.map(s => s.page).filter(p => p).join(", ");
        
        html += `
            <div class="message-sources" onclick="toggleMessageSources(this)">
                <span class="sources-toggle">▶</span>
                📚 Sources (${sources.length}) ${pages ? `• Pages: ${pages}` : ""} 
                <span class="confidence-badge">${confPercent}%</span>
            </div>
            <div class="message-sources-list collapsed">
        `;
        
        sources.forEach(source => {
            const scorePercent = Math.round(source.score * 100);
            const pageInfo = source.page ? `Page ${source.page}` : "Page unknown";
            html += `
                <div class="source-item">
                    <div class="source-meta">
                        <span class="source-page">${pageInfo}</span>
                        <span class="source-score">${scorePercent}% match</span>
                    </div>
                    <div class="source-text">${escapeHtml(source.text)}</div>
                </div>
            `;
        });
        
        html += "</div>";
    }
    
    messageDiv.innerHTML = html;
    chatContainer.appendChild(messageDiv);
    
    // Scroll to the bottom of the chat
    chatContainer.scrollTop = chatContainer.scrollHeight;
}


/**
 * Adds a FALLBACK message to the chat display.
 * 
 * This is used when no official manual is found and we're using
 * internet-based information instead. The display includes clear
 * warnings that this is NOT from an official manual.
 * 
 * @param {string} content - The answer text
 * @param {Object} warning - The fallback warning object with title, message, disclaimer, sources
 */
function addFallbackMessageToChat(content) {
    const chatContainer = document.getElementById("chatHistory");
    if (!chatContainer) return;
    
    const messageDiv = document.createElement("div");
    messageDiv.className = "chat-message assistant-message fallback-message";
    
    // Format the answer with markdown
    const formattedContent = renderMarkdown(content);
    
    // Halo SVG avatar for fallback messages
    const haloSvgFallback = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="20" stroke="url(#haloGradFB)" stroke-width="3" fill="none" opacity="0.3"/>
        <circle cx="24" cy="24" r="16" stroke="url(#haloGradFB)" stroke-width="4" fill="none"/>
        <circle cx="24" cy="24" r="8" fill="url(#haloGradFB)"/>
        <defs><linearGradient id="haloGradFB" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0d9488"/><stop offset="100%" stop-color="#06b6d4"/>
        </linearGradient></defs>
    </svg>`;
    
    // Simple fallback message with just the "Internet Source" badge
    // (User already saw the full disclaimer when device was confirmed)
    const html = `
        <div class="message-header">
            <span class="halo-mini-avatar">${haloSvgFallback}</span>
            <span class="message-role">Halo</span>
            <span class="fallback-badge">🌐 Internet Source</span>
        </div>
        <div class="message-content">${formattedContent}</div>
    `;
    
    messageDiv.innerHTML = html;
    chatContainer.appendChild(messageDiv);
    
    // Scroll to the bottom of the chat
    chatContainer.scrollTop = chatContainer.scrollHeight;
}


/**
 * Toggles the visibility of images within a chat message.
 */
function toggleMessageImages(imagesHeader) {
    const imagesList = imagesHeader.nextElementSibling;
    const toggle = imagesHeader.querySelector(".images-toggle");
    
    if (!imagesList || !toggle) return;
    
    const isCollapsed = imagesList.classList.contains("collapsed");
    
    if (isCollapsed) {
        imagesList.classList.remove("collapsed");
        toggle.textContent = "▼";
    } else {
        imagesList.classList.add("collapsed");
        toggle.textContent = "▶";
    }
}


/**
 * Shows a full-size image in a modal/lightbox.
 */
function showFullImage(url) {
    // Create a simple lightbox
    const overlay = document.createElement("div");
    overlay.className = "image-lightbox";
    overlay.onclick = () => overlay.remove();
    
    overlay.innerHTML = `
        <div class="lightbox-content">
            <img src="${url}" alt="Full size image" />
            <div class="lightbox-close">✕ Click anywhere to close</div>
        </div>
    `;
    
    document.body.appendChild(overlay);
}


/**
 * Toggles the visibility of sources within a chat message.
 * 
 * @param {HTMLElement} sourcesHeader - The sources header element that was clicked
 */
function toggleMessageSources(sourcesHeader) {
    const sourcesList = sourcesHeader.nextElementSibling;
    const toggle = sourcesHeader.querySelector(".sources-toggle");
    
    if (!sourcesList || !toggle) return;
    
    const isCollapsed = sourcesList.classList.contains("collapsed");
    
    if (isCollapsed) {
        sourcesList.classList.remove("collapsed");
        toggle.textContent = "▼";
    } else {
        sourcesList.classList.add("collapsed");
        toggle.textContent = "▶";
    }
}


/**
 * Clears the chat history when device changes or reset is clicked.
 */
function clearChatHistory() {
    window.chatHistory = [];
    const chatContainer = document.getElementById("chatHistory");
    if (chatContainer) {
        chatContainer.innerHTML = "";
    }
}


/**
 * Updates the chat input placeholder to show the current device.
 * @param {string} manufacturer - The device manufacturer
 * @param {string} model - The device model
 */
function updateChatPlaceholder(manufacturer, model) {
    const questionInput = document.getElementById('question');
    if (questionInput && manufacturer && model) {
        questionInput.placeholder = `Ask Halo anything about the ${manufacturer} ${model}...`;
    }
}


/**
 * Resets the chat input placeholder to the default text.
 */
function resetChatPlaceholder() {
    const questionInput = document.getElementById('question');
    if (questionInput) {
        questionInput.placeholder = 'Ask Halo anything about this device...';
    }
}


/**
 * Opens edit mode from the chat section.
 * Clears the chat, scrolls to the device section, and shows edit mode.
 */
function editDeviceFromChat() {
    // Clear the chat history since we're changing the device
    clearChatHistory();
    
    // Reset chat placeholder to generic text
    resetChatPlaceholder();
    
    // Hide the manual notification
    const manualNotification = document.getElementById('manualNotification');
    if (manualNotification) {
        manualNotification.classList.add('hidden');
    }
    
    // Reset chat subtitle
    const chatDeviceInfo = document.getElementById('chatDeviceInfo');
    if (chatDeviceInfo) {
        chatDeviceInfo.textContent = 'Current Device: None selected';
    }
    
    // Clear answer and sources
    const answer = document.getElementById('answer');
    if (answer) answer.innerHTML = '';
    const sources = document.getElementById('sourcesContainer');
    if (sources) sources.innerHTML = '';
    
    // Hide the chat section
    elements.chat().classList.remove('show');
    
    // Reset the confirm button
    const confirmBtn = elements.confirmBtn();
    if (confirmBtn) {
        confirmBtn.textContent = '💬 Start Chatting with Halo';
        confirmBtn.style.background = '';
        confirmBtn.disabled = false;
    }
    
    // Re-enable all dropdowns and inputs (they were disabled on confirm)
    const mfrSelect = elements.manufacturerSelect();
    const modelSelect = elements.modelSelect();
    const mfrInput = elements.manufacturerInput();
    const modelInput = elements.modelInput();
    
    if (mfrSelect) mfrSelect.disabled = false;
    if (modelSelect) modelSelect.disabled = false;
    if (mfrInput) mfrInput.disabled = false;
    if (modelInput) modelInput.disabled = false;
    
    // Also re-enable select mode inputs
    const selectMfrInput = document.getElementById('selectModeManufacturerInput');
    const selectModelInput = document.getElementById('selectModeModelInput');
    if (selectMfrInput) selectMfrInput.disabled = false;
    if (selectModelInput) selectModelInput.disabled = false;
    
    // Handle based on identification mode
    if (state.identificationMode === 'select') {
        // For select mode, re-setup the inline select mode and scroll to it
        setupInlineSelectMode();
        
        const deviceSelection = document.getElementById('deviceSelection');
        if (deviceSelection) {
            deviceSelection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } else {
        // For photo mode, show edit mode in the extraction results
        showEditMode();
        
        // Scroll to the device identification section
        const deviceSection = document.getElementById('extractionResults');
        if (deviceSection) {
            deviceSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}


/**
 * Displays the source citations from the RAG system.
 * 
 * Shows the text chunks that were used to generate the answer,
 * along with page numbers and confidence scores.
 * The sources section is collapsible - starts collapsed by default.
 * 
 * @param {Array} sources - Array of source objects with text, score, and page
 * @param {number} confidence - Overall confidence score (0-1)
 */
function displaySources(sources, confidence) {
    const container = document.getElementById("sourcesContainer");
    if (!container) return;
    
    // Calculate confidence percentage
    const confPercent = Math.round(confidence * 100);
    
    // Create page summary for collapsed view
    const pages = sources
        .map(s => s.page)
        .filter(p => p)
        .join(", ");
    const pageSummary = pages ? `Pages: ${pages}` : "";
    
    // Create the sources HTML with collapsible structure
    let html = `
        <div class="sources-header" onclick="toggleSources()">
            <span class="sources-toggle" id="sourcesToggle">▶</span>
            <span class="sources-icon">📚</span>
            <span class="sources-title">Sources (${sources.length})</span>
            <span class="sources-summary" id="sourcesSummary">${pageSummary}</span>
            <span class="confidence-badge">${confPercent}% confidence</span>
        </div>
        <div class="sources-list collapsed" id="sourcesList">
    `;
    
    sources.forEach((source, index) => {
        const scorePercent = Math.round(source.score * 100);
        const pageInfo = source.page ? `Page ${source.page}` : "Page unknown";
        
        html += `
            <div class="source-item">
                <div class="source-meta">
                    <span class="source-page">${pageInfo}</span>
                    <span class="source-score">${scorePercent}% match</span>
                </div>
                <div class="source-text">${escapeHtml(source.text)}</div>
            </div>
        `;
    });
    
    html += "</div>";
    container.innerHTML = html;
}


/**
 * Toggles the visibility of the sources list.
 * 
 * Called when user clicks on the sources header.
 */
function toggleSources() {
    const list = document.getElementById("sourcesList");
    const toggle = document.getElementById("sourcesToggle");
    const summary = document.getElementById("sourcesSummary");
    
    if (!list || !toggle) return;
    
    const isCollapsed = list.classList.contains("collapsed");
    
    if (isCollapsed) {
        // Expand
        list.classList.remove("collapsed");
        toggle.textContent = "▼";
        if (summary) summary.style.display = "none";
    } else {
        // Collapse
        list.classList.add("collapsed");
        toggle.textContent = "▶";
        if (summary) summary.style.display = "inline";
    }
}


/**
 * Escapes HTML special characters to prevent XSS attacks.
 * 
 * @param {string} text - The text to escape
 * @returns {string} - The escaped text
 */
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}


/**
 * Renders markdown text to HTML.
 * Used for formatting AI responses with bold, lists, etc.
 * 
 * @param {string} text - The markdown text to render
 * @returns {string} - The rendered HTML
 */
function renderMarkdown(text) {
    // Check if marked library is available
    if (typeof marked !== 'undefined') {
        // Configure marked for safe rendering
        marked.setOptions({
            breaks: true,  // Convert \n to <br>
            gfm: true,     // GitHub Flavored Markdown
            sanitize: false // We trust the AI output
        });
        return marked.parse(text);
    }
    // Fallback: just escape HTML and convert newlines to <br>
    return escapeHtml(text).replace(/\n/g, '<br>');
}


// =============================================================================
// BANNER DISPLAY FUNCTIONS
// =============================================================================

/**
 * Hides all notification banners.
 * 
 * Called before showing a new banner to ensure only one is visible at a time.
 */
function hideBanners() {
    elements.warningBanner().classList.remove("show");
    elements.successBanner().classList.remove("show");
    elements.partialSuccessBanner().classList.remove("show");
    elements.noManualBanner().classList.remove("show");
    
    // Reset success banner styling (in case it was used for info messages)
    const successBanner = elements.successBanner();
    successBanner.style.background = "";
    successBanner.style.borderColor = "";
    successBanner.style.color = "";
}


/**
 * Shows the yellow warning banner.
 * 
 * Used when extraction fails or has low confidence.
 * 
 * @param {string} title - The main warning message
 * @param {string} suggestion - A helpful suggestion for the user
 */
function showWarning(title, suggestion) {
    hideBanners();  // Hide any other banners first
    elements.warningTitle().textContent = title;
    elements.warningSuggestion().textContent = suggestion;
    elements.warningBanner().classList.add("show");
}


/**
 * Shows the green success banner when BOTH manufacturer and model are confident.
 * 
 * Displays messages like:
 *   "✓ We believe the manufacturer is Baxter."
 *   "✓ We believe the model number is AS50."
 * 
 * @param {Object} data - The extraction result
 */
function showFullSuccess(data) {
    hideBanners();
    
    // Calculate confidence percentages for display
    const mfrConf = Math.round(data.manufacturer_confidence * 100);
    const modelConf = Math.round(data.model_number_confidence * 100);
    
    // Set the success messages
    elements.fullSuccessManufacturerText().textContent = 
        `We believe the manufacturer is ${data.manufacturer}.`;
    elements.fullSuccessModelText().textContent = 
        `We believe the model number is ${data.model_number}.`;
    
    // Show the confidence percentages
    elements.confidenceDisplay().textContent = 
        `Confidence: Manufacturer ${mfrConf}%, Model ${modelConf}%`;
    
    // Show the banner
    elements.successBanner().classList.add("show");
}


/**
 * Shows the partial success banner when only ONE field is confident.
 * 
 * Shows which field(s) were detected with confidence, and warns about
 * which field(s) need manual input.
 * 
 * @param {Object} data - The extraction result
 * @param {boolean} manufacturerConfident - True if manufacturer meets threshold
 * @param {boolean} modelConfident - True if model meets threshold
 */
function showPartialSuccess(data, manufacturerConfident, modelConfident) {
    hideBanners();
    
    // Get references to the message elements
    const mfrMsg = elements.manufacturerMessage();
    const modelMsg = elements.modelMessage();
    const partialWarn = elements.partialWarning();
    
    // Hide all messages initially
    mfrMsg.style.display = "none";
    modelMsg.style.display = "none";
    partialWarn.style.display = "none";
    
    // Track which fields need manual input
    let warningParts = [];
    
    // Show manufacturer message if confident
    if (manufacturerConfident) {
        elements.manufacturerMessageText().textContent = 
            `We believe the manufacturer is ${data.manufacturer}. (${Math.round(data.manufacturer_confidence * 100)}% confidence)`;
        mfrMsg.style.display = "block";
    } else {
        // Manufacturer needs manual input
        warningParts.push("Manufacturer");
    }
    
    // Show model message if confident
    if (modelConfident) {
        elements.modelMessageText().textContent = 
            `We believe the model number is ${data.model_number}. (${Math.round(data.model_number_confidence * 100)}% confidence)`;
        modelMsg.style.display = "block";
    } else {
        // Model needs manual input
        warningParts.push("Model Number");
    }
    
    // Show warning for fields that need manual input
    if (warningParts.length > 0) {
        partialWarn.textContent = `⚠️ Please manually select or enter the ${warningParts.join(" and ")} below.`;
        partialWarn.style.display = "block";
    }
    
    // Show the banner
    elements.partialSuccessBanner().classList.add("show");
}


/**
 * Legacy function for backward compatibility.
 * Just calls showFullSuccess.
 * 
 * @param {Object} data - The extraction result
 */
function showSuccess(data) {
    showFullSuccess(data);
}


/**
 * Shows the red error banner when no manual is available.
 * 
 * @param {string} message - The error message to display
 */
function showNoManualError(message) {
    elements.noManualMessage().textContent = message;
    elements.noManualBanner().classList.add("show");
}


// =============================================================================
// TAB NAVIGATION
// =============================================================================

/**
 * Switches between different tabs in the application.
 * Hides all tab content, then shows the selected one.
 * Also updates the active state of tab buttons.
 * 
 * @param {string} tabId - The ID of the tab to switch to (e.g., 'ask-halo', 'devices')
 */
function switchTab(tabId) {
    // Remove active class from all tab content
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all navigation buttons (header, mobile, sidebar)
    document.querySelectorAll('.header-nav-btn, .mobile-nav-btn, .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Activate the selected tab content
    const selectedTab = document.getElementById(`tab-${tabId}`);
    if (selectedTab) selectedTab.classList.add('active');
    
    // Activate all matching nav buttons (there may be multiple for mobile/desktop)
    document.querySelectorAll(`[data-tab="${tabId}"]`).forEach(btn => {
        btn.classList.add('active');
    });
    
    // Load device list when switching to devices tab (only once)
    if (tabId === 'devices' && !window.devicesLoaded) {
        loadDeviceList();
    }
}

/**
 * Loads the list of supported devices from the backend
 * and displays them in the Supported Devices tab, grouped by manufacturer.
 */
async function loadDeviceList() {
    const container = document.getElementById('deviceList');
    if (!container) return;
    
    container.innerHTML = '<p class="loading-text">Loading device list...</p>';
    
    // Icons for each device type
    const typeIcons = {
        "Anesthesia Machine": "🏥",
        "Standalone Ventilator": "🌬️",
        "Infusion Pump": "💉",
        "Patient Monitor": "📊"
    };
    
    try {
        // Fetch all devices grouped by type (single API call - much faster!)
        const response = await fetch('/api/devices-by-type');
        const devicesByType = await response.json();
        
        let html = '';
        
        // Iterate through each device type
        for (const [deviceType, devices] of Object.entries(devicesByType)) {
            // Skip empty categories
            if (!devices || devices.length === 0) continue;
            
            // Group devices by manufacturer within this type
            const byManufacturer = {};
            let totalManualCount = 0;
            
            for (const device of devices) {
                if (!byManufacturer[device.manufacturer]) {
                    byManufacturer[device.manufacturer] = [];
                }
                byManufacturer[device.manufacturer].push(device);
                if (device.has_manual) totalManualCount++;
            }
            
            // Build manufacturer subgroups HTML
            let manufacturersHtml = '';
            
            for (const [manufacturer, mfrDevices] of Object.entries(byManufacturer)) {
                let mfrManualCount = 0;
                let modelsHtml = '';
                
                for (const device of mfrDevices) {
                    if (device.has_manual) mfrManualCount++;
                    
                    const manualIcon = device.has_manual ? '📚' : '🌐';
                    const manualClass = device.has_manual ? 'has-doc' : 'no-doc';
                    
                    // Escape quotes in manufacturer/model names for onclick
                    const safeManufacturer = device.manufacturer.replace(/'/g, "\\'");
                    const safeModel = device.model.replace(/'/g, "\\'");
                    
                    modelsHtml += `
                        <div class="model-item ${manualClass}" onclick="selectDeviceFromList('${safeManufacturer}', '${safeModel}')">
                            <span class="model-icon">${manualIcon}</span>
                            <span class="model-name">${device.model}</span>
                        </div>
                    `;
                }
                
                const mfrSafeId = `${deviceType}_${manufacturer}`.replace(/[^a-zA-Z0-9]/g, '_');
                
                manufacturersHtml += `
                    <div class="manufacturer-subgroup">
                        <div class="manufacturer-subheader" onclick="toggleManufacturer('${mfrSafeId}')">
                            <div class="manufacturer-subinfo">
                                <span class="manufacturer-subname">${manufacturer}</span>
                                <span class="manufacturer-subcount">${mfrDevices.length} model${mfrDevices.length !== 1 ? 's' : ''} • ${mfrManualCount} with manuals</span>
                            </div>
                            <span class="manufacturer-toggle" id="toggle-${mfrSafeId}">▼</span>
                        </div>
                        <div class="manufacturer-models nested" id="models-${mfrSafeId}">
                            ${modelsHtml}
                        </div>
                    </div>
                `;
            }
            
            // Create device type group
            const safeId = deviceType.replace(/[^a-zA-Z0-9]/g, '_');
            const typeIcon = typeIcons[deviceType] || '📦';
            const manufacturerCount = Object.keys(byManufacturer).length;
            
            html += `
                <div class="device-type-group">
                    <div class="device-type-header" onclick="toggleManufacturer('${safeId}')">
                        <div class="device-type-info">
                            <span class="type-icon">${typeIcon}</span>
                            <span class="device-type-name">${deviceType}</span>
                            <span class="device-type-count">${manufacturerCount} manufacturer${manufacturerCount !== 1 ? 's' : ''} • ${devices.length} device${devices.length !== 1 ? 's' : ''} • ${totalManualCount} with manuals</span>
                        </div>
                        <span class="manufacturer-toggle" id="toggle-${safeId}">▼</span>
                    </div>
                    <div class="device-type-content" id="models-${safeId}">
                        ${manufacturersHtml}
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html || '<p>No devices configured yet.</p>';
        window.devicesLoaded = true;
        
    } catch (error) {
        console.error('Error loading device list:', error);
        container.innerHTML = '<p style="color: var(--error);">Failed to load device list. Please try again.</p>';
    }
}

/**
 * Toggles the visibility of a manufacturer's model list.
 * @param {string} id - The sanitized manufacturer ID
 */
function toggleManufacturer(id) {
    const models = document.getElementById(`models-${id}`);
    const toggle = document.getElementById(`toggle-${id}`);
    
    if (models && toggle) {
        // Toggle visibility using 'hidden' class
        const isCurrentlyHidden = models.classList.contains('hidden');
        
        if (isCurrentlyHidden) {
            models.classList.remove('hidden');
            toggle.textContent = '▼';
        } else {
            models.classList.add('hidden');
            toggle.textContent = '▶';
        }
    }
}

/**
 * When user clicks a device card in the Supported Devices tab,
 * switch to Ask Halo tab and pre-select that device.
 * 
 * @param {string} manufacturer - The device manufacturer
 * @param {string} model - The device model
 */
function selectDeviceFromList(manufacturer, model) {
    // Switch to Ask Halo tab
    switchTab('ask-halo');
    
    // Set to "select" mode
    setIdentificationMode('select');
    
    // Pre-populate the selections
    setTimeout(async () => {
        // Load manufacturers if not loaded
        if (state.manufacturers.length === 0) {
            await loadManufacturers();
        }
        
        // Select manufacturer
        const manuSelect = document.getElementById('manufacturerSelect');
        if (manuSelect) {
            manuSelect.value = manufacturer;
            state.selectedManufacturer = manufacturer;
            await loadModels(manufacturer);
            
            // Select model after models are loaded
            const modelSelect = document.getElementById('modelSelect');
            if (modelSelect) {
                modelSelect.value = model;
                state.selectedModel = model;
                validateSelection();
            }
        }
        
        // Show device selection card
        document.getElementById('deviceSelection')?.classList.remove('hidden');
        document.getElementById('step2Title').textContent = 'Confirm Device Selection';
    }, 100);
}

/**
 * Submits user feedback to the backend (placeholder for now).
 * In the future, this could send to a database or email service.
 */
async function submitFeedback() {
    const textarea = document.getElementById('feedbackText');
    const feedback = textarea?.value?.trim();
    
    if (!feedback) {
        alert('Please enter some feedback before submitting.');
        return;
    }
    
    // For now, just show a thank you message
    // In the future, this would POST to an API endpoint
    alert('Thank you for your feedback! Our team will review it soon. 🙏');
    textarea.value = '';
    
    // TODO: Implement actual feedback submission
    // await fetch('/api/feedback', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ feedback, timestamp: new Date().toISOString() })
    // });
}
