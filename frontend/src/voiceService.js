// A robust function to get the latest list of voices every time,
// handling browser inconsistencies where the list becomes stale.
const getVoices = () => {
    return new Promise(resolve => {
        let voices = window.speechSynthesis.getVoices();
        if (voices.length) {
            resolve(voices);
            return;
        }
        // The 'voiceschanged' event is the most reliable way to know when the list is updated.
        window.speechSynthesis.addEventListener('voiceschanged', () => {
            voices = window.speechSynthesis.getVoices();
            resolve(voices);
        }, { once: true }); // Ensure the listener is removed after firing.
    });
};

export const speak = async (text) => {
    // Speech output is temporarily disabled.
    // To re-enable, uncomment the code below.
    /*
    if (!('speechSynthesis' in window)) {
        console.error("Speech synthesis is not supported by this browser.");
        return;
    }

    try {
        console.log("--- DEBUG: Attempting to speak ---");
        console.log("DEBUG: Fetching available voices...");
        const voices = await getVoices();
        
        console.log(`DEBUG: Found ${voices.length} voices:`);
        voices.forEach((voice, index) => {
            console.log(`Voice ${index}: Name: ${voice.name}, Lang: ${voice.lang}, Default: ${voice.default}`);
        });

        // Prioritize high-quality voices by name, then fall back to any German voice.
        const preferredVoices = ["Anna", "Sandy"];
        let germanVoice = null;

        for (const name of preferredVoices) {
            const foundVoice = voices.find(v => v.lang === 'de-DE' && v.name === name);
            if (foundVoice) {
                germanVoice = foundVoice;
                break;
            }
        }

        // If no preferred voice is found, take the first available German voice.
        if (!germanVoice) {
            germanVoice = voices.find(v => v.lang === 'de-DE');
        }

        window.speechSynthesis.cancel(); // Stop any previous speech

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'de-DE';
        utterance.rate = 1;
        utterance.pitch = 1;

        if (germanVoice) {
            console.log("DEBUG: SUCCESS: Found and selected German (de-DE) voice:", germanVoice.name);
            utterance.voice = germanVoice;
        } else {
            console.warn("DEBUG: WARNING: German (de-DE) voice not found. Using browser default for the language.");
            const defaultVoice = voices.find(v => v.default);
            if (defaultVoice) {
                console.log("DEBUG: Using default voice instead:", defaultVoice.name);
                utterance.voice = defaultVoice;
            }
        }

        window.speechSynthesis.speak(utterance);
    } catch (error) {
        console.error("DEBUG: Error during speech synthesis:", error);
    }
    */
};
