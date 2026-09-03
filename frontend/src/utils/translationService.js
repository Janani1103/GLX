// Dictionary of common truck body manufacturing terms for Sinhala <-> English <-> Tamil
const GLX_DICTIONARY = [
    { en: "Lorry Body", si: "ලොරි බොඩි", ta: "லாரி பாடி" },
    { en: "Non Rivet Aluminium Body", si: "නොන් රිවට් ඇලුමිනියම් බොඩි", ta: "ரிவெட் இல்லாத அலுமினிய உடம்பு" },
    { en: "Japan Model Original Corner Set Bar", si: "ජපන් මොඩල් ඔරිජිනල් කෝනර් සෙට් බාර්", ta: "ஜப்பான் மாடல் கார்னர் செட் பார்" },
    { en: "Japan Model Original Bottom Bar", si: "ජපන් මොඩල් ඔරිජිනල් බොටම් බාර්", ta: "ஜப்பான் மாடல் பாட்டம் பார்" },
    { en: "Rear Gutter", si: "පිටුපස ගටරය", ta: "பின்புற சாக்கடை" },
    { en: "Rear Footboard", si: "පිටුපස පා පුවරුව", ta: "பின்புற கால் பலகை" },
    { en: "Rear Light Guard", si: "පිටුපස ලයිට් ගාඩ්", ta: "பின்புற விளக்கு காவலர்" },
    { en: "Taiwan Lock Set & Hinges", si: "තායිවාන් ලොක් සෙට් සහ සරනේරු", ta: "தைவான் பூட்டு செட் மற்றும் கீல்கள்" },
    { en: "Door Stopper Set", si: "දොර ස්ටොපර් සෙට්", ta: "கதவு நிறுத்தி" },
    { en: "Taiwan Door Beading Set", si: "තායිවාන් දොර බීඩිං සෙට්", ta: "தைவான் கதவு பீடிங்" },
    { en: "Roof 1mm Aluminium Sheet", si: "වහල 1mm ඇලුමිනියම් තහඩුව", ta: "கூரை 1மிமீ அலுமினிய தாள்" },
    { en: "Roof Body Sealant 3M USA", si: "රූෆ් බොඩි සීලන්ට් 3M USA", ta: "கூரை சீலண்ட் 3M USA" },
    { en: "Outside Body 1.2mm Aluminium Sheet", si: "පිටත බොඩි 1.2mm ඇලුමිනියම් තහඩුව", ta: "வெளிப்புற உடல் 1.2மிமீ அலுமினிய தாள்" },
    { en: "Inside Body Plywood Sheet", si: "ඇතුළත බොඩි ප්ලයිවුඩ් තහඩුව", ta: "உட்புற உடல் பிளைவுட் தாள்" },
    { en: "Floor Board", si: "තට්ටුවේ ලෑලි", ta: "தரை பலகை" },
    { en: "Body Structure", si: "බොඩි ව්‍යුහය", ta: "உடல் அமைப்பு" },
    { en: "Under Framework", si: "යටි රාමුව", ta: "கீழ் கட்டமைப்பு" },
    { en: "Rear Door Frame", si: "පිටුපස දොර රාමුව", ta: "பின்புற கதவு சட்டகம்" },
    { en: "Original Taiwan Body Lights", si: "ඔරිජිනල් තායිවාන් බොඩි ලයිට්", ta: "அசல் தைவான் உடல் விளக்குகள்" },
    { en: "Inside LED Normal Strip Light", si: "ඇතුළත LED සාමාන්‍ය ස්ට්‍රිප් ලයිට්", ta: "உட்புற எல்இடி விளக்கு" },
    { en: "U Bolt Set", si: "යූ බෝල්ට් සෙට්", ta: "யூ போல்ட் செட்" },
    { en: "Under Bar", si: "යටි බාර්", ta: "கீழ் பார்" },
    { en: "Discount", si: "වට්ටම්", ta: "தள்ளுபடி" },
    { en: "Special Discount", si: "විශේෂ වට්ටම්", ta: "சிறப்பு தள்ளுபடி" },
    { en: "Warranty", si: "වගකීම", ta: "உத்தரவாதம்" }
];

/**
 * Detect language of text (Sinhala, Tamil, or English)
 */
export const detectLanguage = (text) => {
    if (!text) return 'en';
    const cleanText = text.trim();
    // Sinhala unicode range: 0D80 - 0DFF
    if (/[\u0D80-\u0DFF]/.test(cleanText)) return 'si';
    // Tamil unicode range: 0B80 - 0BFF
    if (/[\u0B80-\u0BFF]/.test(cleanText)) return 'ta';
    return 'en';
};

/**
 * Translate using Dictionary or Free Public MyMemory Translation API
 */
export const translateText = async (text, targetLang = 'en') => {
    if (!text || text.trim() === '') return '';
    const cleanText = text.trim();
    const sourceLang = detectLanguage(cleanText);

    if (sourceLang === targetLang) return cleanText;

    // 1. Check local dictionary
    const dictMatch = GLX_DICTIONARY.find(item => {
        if (sourceLang === 'en' && item.en.toLowerCase() === cleanText.toLowerCase()) return true;
        if (sourceLang === 'si' && item.si === cleanText) return true;
        if (sourceLang === 'ta' && item.ta === cleanText) return true;
        return false;
    });

    if (dictMatch) {
        return dictMatch[targetLang];
    }

    // 2. Fallback to MyMemory translation API
    try {
        const langpair = `${sourceLang}|${targetLang}`;
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=${langpair}`;
        
        const response = await fetch(url);
        if (response.ok) {
            const result = await response.json();
            if (result.responseData && result.responseData.translatedText) {
                return result.responseData.translatedText;
            }
        }
    } catch (error) {
        console.warn('Translation API failed, using fallback source text:', error.message);
    }

    return cleanText; // fallback to original text if API fails
};
