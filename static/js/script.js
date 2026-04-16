document.addEventListener('DOMContentLoaded', () => {
    // --- LOAD DATA FROM FLASK ---
    const ALL_SYMPTOMS = JSON.parse(document.getElementById('symptoms-data').textContent);

    // UI Elements
    const wizardSteps = document.querySelectorAll('.wizard-step');
    const formSection = document.getElementById('form-section');
    const skeletonSection = document.getElementById('skeleton-section');
    const resultSection = document.getElementById('result-section');
    
    // --- CUSTOM DROPDOWN LOGIC ---
    function setupCustomDropdown(inputId, listId, hiddenValueId) {
        const input = document.getElementById(inputId);
        const list = document.getElementById(listId);
        const hiddenInput = document.getElementById(hiddenValueId);

        function populateList(filterText = "") {
            list.innerHTML = '';
            let count = 0;
            
            for (const [key, label] of Object.entries(ALL_SYMPTOMS)) {
                if (label.toLowerCase().includes(filterText.toLowerCase())) {
                    const li = document.createElement('li');
                    li.textContent = label;
                    li.dataset.value = key;
                    li.addEventListener('click', () => {
                        input.value = label;
                        hiddenInput.value = key;
                        list.classList.remove('show');
                    });
                    list.appendChild(li);
                    count++;
                }
            }
            if(count === 0) {
                list.innerHTML = '<li class="no-results">No symptoms found</li>';
            }
        }

        input.addEventListener('focus', () => {
            populateList(input.value);
            list.classList.add('show');
        });

        input.addEventListener('input', (e) => {
            populateList(e.target.value);
            hiddenInput.value = ""; 
            list.classList.add('show');
        });

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !list.contains(e.target) && e.target.id !== 'btn-voice') {
                list.classList.remove('show');
            }
        });
    }

    setupCustomDropdown('symptom1-input', 'symptom1-list', 'symptom1-value');
    setupCustomDropdown('symptom_extra_1_input', 'symptom_extra_1_list', 'symptom_extra_1_value');

    // --- VOICE RECOGNITION LOGIC ---
    const btnVoice = document.getElementById('btn-voice');
    const voiceStatus = document.getElementById('voice-status');
    const symptom1Input = document.getElementById('symptom1-input');
    const symptom1Value = document.getElementById('symptom1-value');

    // Check if browser supports Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        btnVoice.addEventListener('click', (e) => {
            e.preventDefault();
            recognition.start();
            btnVoice.classList.add('listening');
            voiceStatus.textContent = "Listening... Speak now.";
            voiceStatus.style.color = "#4318FF";
        });

        recognition.onresult = (event) => {
            btnVoice.classList.remove('listening');
            const transcript = event.results[0][0].transcript.toLowerCase();
            voiceStatus.textContent = `Heard: "${transcript}"`;
            
            // NLP Matching logic (find the closest symptom)
            let matchedKey = "";
            let matchedLabel = "";
            
            for (const [key, label] of Object.entries(ALL_SYMPTOMS)) {
                // If spoken word contains the label, or label contains spoken word
                if (transcript.includes(label.toLowerCase()) || label.toLowerCase().includes(transcript)) {
                    matchedKey = key;
                    matchedLabel = label;
                    break;
                }
            }

            if (matchedKey) {
                symptom1Input.value = matchedLabel;
                symptom1Value.value = matchedKey;
                voiceStatus.textContent = `✅ Matched: ${matchedLabel}`;
                voiceStatus.style.color = "#00E396";
            } else {
                voiceStatus.textContent = `❌ Could not find a matching symptom for "${transcript}". Please type it.`;
                voiceStatus.style.color = "#ff4d4f";
            }
        };

        recognition.onerror = (event) => {
            btnVoice.classList.remove('listening');
            voiceStatus.textContent = "Error capturing voice. Please try typing.";
            voiceStatus.style.color = "#ff4d4f";
        };
    } else {
        btnVoice.style.display = 'none'; // Hide mic if not supported
    }

    // --- NAVIGATION LOGIC ---
    document.getElementById('btn-to-step2').addEventListener('click', async () => {
        const mainSymptom = document.getElementById('symptom1-value').value;
        if (!mainSymptom) {
            alert('Please select a valid primary symptom from the list (or use voice) to continue.');
            return;
        }

        const btn = document.getElementById('btn-to-step2');
        btn.innerText = "Thinking...";
        btn.disabled = true;
        voiceStatus.textContent = ""; // clear voice status

        try {
            const response = await fetch('/get_related', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symptom: mainSymptom })
            });
            const relatedSymptoms = await response.json();

            const container = document.getElementById('dynamic-symptoms-container');
            container.innerHTML = ''; 
            
            if(relatedSymptoms.length === 0) {
                container.innerHTML = '<p style="color:#2b3674;">No common correlations found. Proceed to next step.</p>';
            } else {
                relatedSymptoms.forEach(symp => {
                    const label = document.createElement('label');
                    label.className = 'custom-checkbox';
                    label.innerHTML = `
                        <input type="checkbox" class="dynamic-symp-check" value="${symp.id}">
                        <span class="checkmark"></span>
                        ${symp.label}
                    `;
                    container.appendChild(label);
                });
            }

            wizardSteps.forEach(step => step.style.display = 'none');
            document.getElementById('step-2').style.display = 'block';

        } catch (err) {
            console.error(err);
            alert("Error fetching related symptoms.");
        } finally {
            btn.innerText = "Next →";
            btn.disabled = false;
        }
    });

    document.querySelectorAll('.step-btn[data-target]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.getAttribute('data-target');
            wizardSteps.forEach(step => step.style.display = 'none');
            document.getElementById(target).style.display = 'block';
        });
    });

    // --- FINAL SUBMISSION LOGIC ---
    document.getElementById('btn-submit').addEventListener('click', async () => {
        let finalSymptoms = [];
        finalSymptoms.push(document.getElementById('symptom1-value').value);
        
        document.querySelectorAll('.dynamic-symp-check:checked').forEach(chk => {
            finalSymptoms.push(chk.value);
        });

        const extra1 = document.getElementById('symptom_extra_1_value').value;
        if(extra1) finalSymptoms.push(extra1);

        formSection.style.display = 'none';
        skeletonSection.style.display = 'block';

        try {
            const response = await fetch('/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symptoms: finalSymptoms })
            });
            const data = await response.json();

            document.getElementById('res-disease').textContent = data.disease;
            document.getElementById('res-description').textContent = data.description;
            
            const warningBanner = document.getElementById('risk-warning');
            warningBanner.style.display = data.high_risk ? 'block' : 'none';

            const precList = document.getElementById('res-precautions');
            precList.innerHTML = ''; 
            data.precautions.forEach(prec => {
                const li = document.createElement('li');
                li.textContent = prec;
                precList.appendChild(li);
            });

            setTimeout(() => {
                skeletonSection.style.display = 'none';
                resultSection.style.display = 'block';
                document.getElementById('main-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 1800);

        } catch (error) {
            console.error(error);
            alert("Error analyzing symptoms.");
            skeletonSection.style.display = 'none';
            formSection.style.display = 'block';
        }
    });

    // --- RESET ---
    document.getElementById('btn-new-scan').addEventListener('click', () => {
        document.getElementById('symptom1-input').value = '';
        document.getElementById('symptom1-value').value = '';
        document.getElementById('symptom_extra_1_input').value = '';
        document.getElementById('symptom_extra_1_value').value = '';
        voiceStatus.textContent = '';
        
        wizardSteps.forEach(step => step.style.display = 'none');
        document.getElementById('step-1').style.display = 'block';

        resultSection.style.display = 'none';
        formSection.style.display = 'block';
        document.getElementById('main-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});